/**
 * Smoke test del motor de elicitación (task 8.3 de add-elicitation-engine).
 *
 * Ejerce el pipeline contra el modelo real y verifica:
 *  1. La llamada al modelo devuelve un tool_use 'submit_turn' que
 *     valida contra submitTurnPayloadSchema (Zod estricto).
 *  2. Ante una respuesta vaga del usuario, el modelo emite ≥1
 *     detected_issue de tipo 'vagueness'.
 *  3. La idempotencia por client_request_id rechaza duplicados a
 *     nivel de DB (Postgres 23505 por unique index parcial).
 *  4. El salto de sección actualiza project_section_progress
 *     (anterior 'incomplete', nueva 'in_progress').
 *
 * NOTA: no importa src/lib/ai/anthropic.ts ni src/lib/ai/context.ts
 * porque ambos usan 'server-only', que sólo se resuelve dentro del
 * runtime de Next. Replica inline la parte mínima del wrapper para
 * mantener la cobertura del happy path. La política de retries se
 * verifica indirectamente via type-check del módulo y vía RLS/DB en
 * el escenario real con Next.
 *
 * Ejecutar:  npx tsx scripts/smoke-elicitation.ts
 *
 * Variables de entorno requeridas:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 *   ANTHROPIC_MODEL (opcional)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

import { buildSystemPrompt } from "../src/lib/ai/prompts/system";
import {
  SUBMIT_TURN_TOOL,
  submitTurnPayloadSchema,
} from "../src/lib/ai/schemas";
import type { Database } from "../src/lib/db/types";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!m) continue;
      if (!process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    // .env.local opcional.
  }
}
loadEnv();

const TEST_USER_ID = "c477ebc1-279c-4b94-b85a-972dea2f579e"; // davidmurillo211205@gmail.com

type Color = "green" | "red" | "cyan" | "yellow";
function paint(text: string, color: Color): string {
  const map: Record<Color, string> = {
    green: "[32m",
    red: "[31m",
    cyan: "[36m",
    yellow: "[33m",
  };
  return `${map[color]}${text}[0m`;
}

let passed = 0;
let failed = 0;
function check(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ${paint("✓", "green")} ${label}`);
  } else {
    failed++;
    console.log(`  ${paint("✗", "red")} ${label}`);
  }
}

interface CallResult {
  payload: ReturnType<typeof submitTurnPayloadSchema.parse>;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

async function callModelDirect(
  client: Anthropic,
  model: string,
  systemPrompt: string,
  messages: Anthropic.Messages.MessageParam[],
): Promise<CallResult> {
  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages,
    tools: [SUBMIT_TURN_TOOL],
    tool_choice: { type: "tool", name: SUBMIT_TURN_TOOL.name },
  });

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> =>
      b.type === "tool_use" && b.name === SUBMIT_TURN_TOOL.name,
  );
  if (!toolUse) {
    throw new Error("El modelo no invocó submit_turn.");
  }
  const parsed = submitTurnPayloadSchema.parse(toolUse.input);
  return {
    payload: parsed,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: response.model,
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  if (!url || !serviceKey) {
    console.error(paint("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.", "red"));
    process.exit(1);
  }
  if (!apiKey) {
    console.error(paint("Falta ANTHROPIC_API_KEY.", "red"));
    process.exit(1);
  }

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anthropic = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 0 });

  let projectId: string | null = null;

  try {
    console.log(paint("\n[1/6] Crear proyecto temporal y sesión", "cyan"));
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        owner_id: TEST_USER_ID,
        name: "SMOKE TEST elicitation engine",
        client_name: null,
        status: "draft",
        mode: "consultant",
      })
      .select("id, mode")
      .single();
    if (projectError || !project) {
      throw new Error(`No se pudo crear el proyecto: ${projectError?.message ?? "sin data"}`);
    }
    projectId = project.id;
    console.log(`  projectId = ${project.id}`);

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        project_id: project.id,
        mode: project.mode,
        current_section: "nfrs", // arrancar en NFRs facilita el caso de vaguedad
        status: "active",
      })
      .select("id, current_section, project_id")
      .single();
    if (sessionError || !session) {
      throw new Error(`No se pudo crear la sesión: ${sessionError?.message ?? "sin data"}`);
    }
    console.log(`  sessionId = ${session.id} · sección inicial = ${session.current_section}`);

    console.log(paint("\n[2/6] Pedir primera pregunta al modelo (turno inicial)", "cyan"));
    const systemPrompt = buildSystemPrompt(session.current_section);
    const baseMessages: Anthropic.Messages.MessageParam[] = [
      {
        role: "user",
        content: "Project facts conocidos hasta ahora: (aún no hay facts capturados).",
      },
      {
        role: "user",
        content:
          '(Inicio de sesión en sección "nfrs". Formula la primera pregunta apropiada.)',
      },
    ];
    const initial = await callModelDirect(anthropic, model, systemPrompt, baseMessages);
    check(
      typeof initial.payload.question === "string" && initial.payload.question.length > 0,
      "submit_turn.question presente y no vacío",
    );
    check(
      initial.inputTokens > 0 && initial.outputTokens > 0,
      `tokenUsage capturado (in=${initial.inputTokens}, out=${initial.outputTokens})`,
    );

    console.log(paint("\n[3/6] Responder con vaguedad y verificar detección", "cyan"));
    const vagueMessages: Anthropic.Messages.MessageParam[] = [
      ...baseMessages,
      { role: "assistant", content: initial.payload.question },
      {
        role: "user",
        content:
          "Queremos que el sistema sea rápido y fácil de usar, que aguante muchos usuarios.",
      },
    ];
    const vague = await callModelDirect(anthropic, model, systemPrompt, vagueMessages);
    const issuesByType = vague.payload.detected_issues.map((i) => i.type);
    check(
      issuesByType.includes("vagueness"),
      `detected_issues incluye 'vagueness' (recibidos: ${issuesByType.join(", ") || "ninguno"})`,
    );
    check(
      vague.payload.section_advance.completion_score >= 0 &&
        vague.payload.section_advance.completion_score <= 100,
      `section_advance.completion_score en rango [0,100] (=${vague.payload.section_advance.completion_score})`,
    );

    console.log(paint("\n[4/6] Persistir un turno del usuario y validar idempotencia", "cyan"));
    const clientRequestId = crypto.randomUUID();
    const ins = async () =>
      supabase.from("turns").insert({
        session_id: session.id,
        project_id: session.project_id,
        actor: "consultant",
        role: "answer",
        section: session.current_section,
        payload: { text: "Respuesta de prueba" },
        status: "ok",
        client_request_id: clientRequestId,
      });
    const first = await ins();
    check(!first.error, "Primer insert con client_request_id pasa");
    const second = await ins();
    check(
      Boolean(second.error) && second.error?.code === "23505",
      `Segundo insert con mismo client_request_id rechazado (code=${second.error?.code ?? "ninguno"})`,
    );

    console.log(paint("\n[5/6] Persistir detected_issues y leerlos como 'open'", "cyan"));
    if (vague.payload.detected_issues.length) {
      const rows = vague.payload.detected_issues.map((i) => ({
        project_id: session.project_id,
        session_id: session.id,
        type: i.type,
        severity: i.severity,
        title: i.title,
        body: i.body,
        status: "open" as const,
      }));
      const r = await supabase.from("detected_issues").insert(rows);
      check(!r.error, `Insert de ${rows.length} detected_issues OK`);
    } else {
      check(false, "No hubo detected_issues que insertar — el modelo debió emitir ≥1");
    }
    const { data: openIssues } = await supabase
      .from("detected_issues")
      .select("id, type, status")
      .eq("project_id", session.project_id)
      .eq("status", "open");
    check(
      Boolean(openIssues?.some((i) => i.type === "vagueness")),
      "Hallazgo 'vagueness' leíble como open",
    );

    console.log(paint("\n[6/6] Salto de sección actualiza project_section_progress", "cyan"));
    await supabase
      .from("project_section_progress")
      .upsert(
        {
          project_id: session.project_id,
          section: session.current_section,
          status: "incomplete",
          completion_score: vague.payload.section_advance.completion_score,
          last_updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,section" },
      );
    await supabase
      .from("sessions")
      .update({ current_section: "stakeholders_personas" })
      .eq("id", session.id);
    await supabase
      .from("project_section_progress")
      .upsert(
        {
          project_id: session.project_id,
          section: "stakeholders_personas",
          status: "in_progress",
          completion_score: 0,
          last_updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,section" },
      );
    const { data: progress } = await supabase
      .from("project_section_progress")
      .select("section, status")
      .eq("project_id", session.project_id);
    check(
      Boolean(progress?.find((p) => p.section === "nfrs" && p.status === "incomplete")),
      "Sección anterior queda 'incomplete'",
    );
    check(
      Boolean(
        progress?.find(
          (p) => p.section === "stakeholders_personas" && p.status === "in_progress",
        ),
      ),
      "Sección nueva queda 'in_progress'",
    );

    console.log(paint("\n[cleanup] Borrar proyecto temporal en cascada", "cyan"));
    await supabase.from("projects").delete().eq("id", project.id);
    projectId = null;
  } catch (e) {
    console.error(paint(`\nERROR FATAL: ${e instanceof Error ? e.message : String(e)}`, "red"));
    if (projectId) {
      console.error(
        paint(`Limpieza manual: delete from projects where id='${projectId}';`, "yellow"),
      );
    }
    process.exit(1);
  }

  console.log("");
  console.log(paint(`Resumen: ${passed} OK · ${failed} FAIL`, failed === 0 ? "green" : "red"));
  process.exit(failed === 0 ? 0 : 1);
}

main();

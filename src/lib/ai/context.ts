import "server-only";

import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildSystemPrompt } from "@/lib/ai/prompts/system";
import type { SubmitTurnPayload } from "@/lib/ai/schemas";
import type { Database } from "@/lib/db/types";

const TURN_WINDOW = 20;

type Section = Database["public"]["Enums"]["elicitation_section"];

export interface TurnContextSnapshot {
  sessionId: string;
  projectId: string;
  section: Section;
  systemPrompt: string;
  messages: MessageParam[];
}

interface SessionRow {
  id: string;
  project_id: string;
  current_section: Section;
}

export async function loadActiveSession(
  supabase: SupabaseClient<Database>,
  sessionId: string,
): Promise<SessionRow | null> {
  const { data } = await supabase
    .from("sessions")
    .select("id, project_id, current_section")
    .eq("id", sessionId)
    .maybeSingle();
  return data;
}

export async function buildTurnContext(
  supabase: SupabaseClient<Database>,
  session: SessionRow,
): Promise<TurnContextSnapshot> {
  const systemPrompt = buildSystemPrompt(session.current_section);
  const projectFacts = await collectProjectFacts(supabase, session.project_id);
  const recentTurns = await loadRecentTurns(
    supabase,
    session.id,
    session.current_section,
  );

  const messages: MessageParam[] = [];

  messages.push({
    role: "user",
    content: `Project facts conocidos hasta ahora (úsalos para detectar contradicciones y evitar repetir preguntas resueltas):
${projectFacts || "(aún no hay facts capturados)"}`,
  });

  for (const t of recentTurns) {
    messages.push(turnToMessage(t));
  }

  // Si no hay turnos previos en esta sección (sesión recién creada o salto),
  // dispara la primera pregunta.
  if (recentTurns.length === 0) {
    messages.push({
      role: "user",
      content: `(Inicio de sesión en sección "${session.current_section}". Formula la primera pregunta apropiada.)`,
    });
  }

  // Defensa: la API de Anthropic exige que el último mensaje sea 'user'.
  // Si por cualquier motivo el último turno traído fue del motor, anexamos
  // una nota del usuario para cerrar el array como user → assistant.
  const last = messages[messages.length - 1];
  if (last && last.role === "assistant") {
    messages.push({
      role: "user",
      content: "(Continúa la sección. Formula la siguiente pregunta.)",
    });
  }

  return {
    sessionId: session.id,
    projectId: session.project_id,
    section: session.current_section,
    systemPrompt,
    messages,
  };
}

interface TurnRow {
  role: Database["public"]["Enums"]["turn_role"];
  actor: Database["public"]["Enums"]["session_actor"];
  status: Database["public"]["Enums"]["turn_status"];
  payload: Database["public"]["Tables"]["turns"]["Row"]["payload"];
  created_at: string;
}

async function loadRecentTurns(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  section: Section,
): Promise<TurnRow[]> {
  // Excluye 'meta': son eventos del sistema (saltos, fallos del SDK) y NO
  // deben enviarse al modelo. Si entrasen como assistant dejarían la
  // conversación cerrada con un mensaje del motor y la API rechazaría
  // (assistant message prefill no soportado).
  const { data } = await supabase
    .from("turns")
    .select("role, actor, status, payload, created_at")
    .eq("session_id", sessionId)
    .eq("section", section)
    .eq("status", "ok")
    .neq("role", "meta")
    .order("created_at", { ascending: false })
    .limit(TURN_WINDOW);
  if (!data) return [];
  return [...data].reverse();
}

function turnToMessage(t: TurnRow): MessageParam {
  if (t.actor === "engine") {
    const text = extractEngineText(t.payload);
    return { role: "assistant", content: text };
  }
  const text = extractUserText(t.payload);
  return { role: "user", content: text };
}

function extractEngineText(payload: TurnRow["payload"]): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const obj = payload as Record<string, unknown>;
    if (typeof obj.question === "string") {
      return obj.question;
    }
  }
  return "(turno del motor sin texto)";
}

function extractUserText(payload: TurnRow["payload"]): string {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const obj = payload as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.message === "string") return obj.message;
  }
  return JSON.stringify(payload);
}

async function collectProjectFacts(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<string> {
  const lines: string[] = [];

  const [project, stakeholders, personas, scope, nfrs, integrations, entities, glossary, sessionFacts] =
    await Promise.all([
      supabase
        .from("projects")
        .select("name, client_name, status, mode")
        .eq("id", projectId)
        .maybeSingle(),
      supabase
        .from("stakeholders")
        .select("name, role, influence")
        .eq("project_id", projectId)
        .limit(20),
      supabase
        .from("personas")
        .select("name, kind, goals")
        .eq("project_id", projectId)
        .limit(20),
      supabase
        .from("scope_items")
        .select("kind, title, justification")
        .eq("project_id", projectId)
        .limit(40),
      supabase
        .from("nfrs")
        .select("category, description, metric")
        .eq("project_id", projectId)
        .limit(30),
      supabase
        .from("integrations")
        .select("name, direction, format, frequency, criticality")
        .eq("project_id", projectId)
        .limit(20),
      supabase
        .from("entities")
        .select("name, description")
        .eq("project_id", projectId)
        .limit(30),
      supabase
        .from("glossary_terms")
        .select("term, definition")
        .eq("project_id", projectId)
        .limit(40),
      collectExtractedFacts(supabase, projectId),
    ]);

  if (project.data) {
    lines.push(
      `Proyecto: ${project.data.name}${project.data.client_name ? ` — cliente: ${project.data.client_name}` : ""} (status ${project.data.status}, modo ${project.data.mode})`,
    );
  }
  if (stakeholders.data?.length) {
    lines.push("Stakeholders:");
    for (const s of stakeholders.data) {
      lines.push(`  - ${s.name}${s.role ? ` (${s.role})` : ""} — influencia ${s.influence}`);
    }
  }
  if (personas.data?.length) {
    lines.push("Personas:");
    for (const p of personas.data) {
      lines.push(`  - ${p.name} (${p.kind})${p.goals ? `: ${p.goals}` : ""}`);
    }
  }
  if (scope.data?.length) {
    lines.push("Scope:");
    for (const s of scope.data) {
      lines.push(`  - [${s.kind}] ${s.title}${s.justification ? ` — ${s.justification}` : ""}`);
    }
  }
  if (nfrs.data?.length) {
    lines.push("NFRs:");
    for (const n of nfrs.data) {
      lines.push(`  - ${n.category}: ${n.description}${n.metric ? ` (métrica: ${n.metric})` : ""}`);
    }
  }
  if (integrations.data?.length) {
    lines.push("Integraciones:");
    for (const i of integrations.data) {
      lines.push(
        `  - ${i.name} ${i.direction}${i.format ? ` ${i.format}` : ""}${i.frequency ? ` ${i.frequency}` : ""} (crit ${i.criticality})`,
      );
    }
  }
  if (entities.data?.length) {
    lines.push("Entidades:");
    for (const e of entities.data) {
      lines.push(`  - ${e.name}${e.description ? `: ${e.description}` : ""}`);
    }
  }
  if (glossary.data?.length) {
    lines.push("Glosario:");
    for (const g of glossary.data) {
      lines.push(`  - ${g.term}: ${g.definition}`);
    }
  }
  if (sessionFacts.length) {
    lines.push("Facts extraídos en turnos previos:");
    for (const f of sessionFacts) {
      lines.push(`  - ${f.key}: ${f.value}`);
    }
  }

  return lines.join("\n").slice(0, 8000);
}

async function collectExtractedFacts(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<Array<{ key: string; value: string }>> {
  const { data } = await supabase
    .from("turns")
    .select("payload, created_at")
    .eq("project_id", projectId)
    .eq("actor", "engine")
    .eq("status", "ok")
    .order("created_at", { ascending: false })
    .limit(40);
  if (!data) return [];

  const seen = new Set<string>();
  const facts: Array<{ key: string; value: string }> = [];
  for (const turn of data) {
    const payload = turn.payload as Partial<SubmitTurnPayload> | null;
    if (!payload || typeof payload !== "object") continue;
    const extraction = payload.fact_extraction;
    if (!Array.isArray(extraction)) continue;
    for (const f of extraction) {
      if (!f || typeof f.key !== "string" || typeof f.value !== "string") continue;
      if (seen.has(f.key)) continue;
      seen.add(f.key);
      facts.push({ key: f.key, value: f.value });
      if (facts.length >= 50) return facts;
    }
  }
  return facts;
}

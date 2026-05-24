"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AiCallError, callModel } from "@/lib/ai/anthropic";
import { buildTurnContext, loadActiveSession } from "@/lib/ai/context";
import { log } from "@/lib/ai/log";
import {
  elicitationSectionSchema,
  turnRequestSchema,
  type SubmitTurnPayload,
} from "@/lib/ai/schemas";
import { createClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";

type SessionActor = Database["public"]["Enums"]["session_actor"];
type SectionStatus = Database["public"]["Enums"]["section_status"];

export type ElicitationActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

function err(code: string, message: string): ElicitationActionResult<never> {
  return { ok: false, error: { code, message } };
}

const startSessionSchema = z.object({
  projectId: z.string().uuid(),
});

export async function startSession(
  input: z.infer<typeof startSessionSchema>,
): Promise<ElicitationActionResult<{ sessionId: string }>> {
  const parsed = startSessionSchema.safeParse(input);
  if (!parsed.success) {
    return err("bad_input", parsed.error.issues[0]?.message ?? "Input inválido");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return err("unauthorized", "Sesión no válida.");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, mode")
    .eq("id", parsed.data.projectId)
    .maybeSingle();
  if (projectError || !project) {
    return err("not_found", "Proyecto no encontrado o sin acceso.");
  }

  const { data: existing } = await supabase
    .from("sessions")
    .select("id")
    .eq("project_id", project.id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let sessionId: string;
  if (existing) {
    sessionId = existing.id;
  } else {
    const { data: created, error: createError } = await supabase
      .from("sessions")
      .insert({
        project_id: project.id,
        mode: project.mode,
        current_section: "project_context",
        status: "active",
      })
      .select("id")
      .single();
    if (createError || !created) {
      return err("db_error", createError?.message ?? "No se pudo crear la sesión.");
    }
    sessionId = created.id;
  }

  // Si la sesión recién se creó (sin turns) genera el turno inicial del motor.
  const { count } = await supabase
    .from("turns")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if ((count ?? 0) === 0) {
    const generated = await generateAndPersistEngineTurn(supabase, sessionId);
    if (!generated.ok) {
      revalidatePath(`/projects/${project.id}/elicit`);
      return err(generated.error.code, generated.error.message);
    }
  }

  log.info("elicitation.startSession", {
    projectId: project.id,
    sessionId,
    reused: Boolean(existing),
  });
  revalidatePath(`/projects/${project.id}/elicit`);
  return { ok: true, data: { sessionId } };
}

export async function sendTurn(
  input: z.infer<typeof turnRequestSchema>,
): Promise<ElicitationActionResult<{ engineTurnId: string | null }>> {
  const parsed = turnRequestSchema.safeParse(input);
  if (!parsed.success) {
    return err("bad_input", parsed.error.issues[0]?.message ?? "Input inválido");
  }

  const supabase = await createClient();
  const session = await loadActiveSession(supabase, parsed.data.sessionId);
  if (!session) {
    return err("not_found", "Sesión no encontrada o sin acceso.");
  }

  const { data: projectMode } = await supabase
    .from("projects")
    .select("mode")
    .eq("id", session.project_id)
    .maybeSingle();
  if (!projectMode) {
    return err("not_found", "Proyecto no encontrado.");
  }

  const userActor: SessionActor =
    projectMode.mode === "self_service" ? "stakeholder" : "consultant";

  // Persistir el turno del usuario con upsert idempotente por client_request_id.
  const { error: insertUserError } = await supabase.from("turns").insert({
    session_id: session.id,
    project_id: session.project_id,
    actor: userActor,
    role: "answer",
    section: session.current_section,
    payload: { text: parsed.data.userMessage },
    status: "ok",
    client_request_id: parsed.data.clientRequestId,
  });

  if (insertUserError) {
    // Si ya existe ese client_request_id, lo tratamos como éxito idempotente.
    if (
      insertUserError.code === "23505" ||
      /duplicate key|unique/i.test(insertUserError.message)
    ) {
      log.info("elicitation.sendTurn.idempotent_skip", {
        sessionId: session.id,
        clientRequestId: parsed.data.clientRequestId,
      });
      revalidatePath(`/projects/${session.project_id}/elicit`);
      return { ok: true, data: { engineTurnId: null } };
    }
    return err("db_error", insertUserError.message);
  }

  const engineResult = await generateAndPersistEngineTurn(supabase, session.id);
  revalidatePath(`/projects/${session.project_id}/elicit`);
  if (!engineResult.ok) {
    log.warn("elicitation.sendTurn.engine_failed", {
      sessionId: session.id,
      code: engineResult.error.code,
    });
    return err(engineResult.error.code, engineResult.error.message);
  }
  log.info("elicitation.sendTurn.ok", {
    sessionId: session.id,
    section: session.current_section,
    engineTurnId: engineResult.data.engineTurnId,
  });
  return { ok: true, data: { engineTurnId: engineResult.data.engineTurnId } };
}

const jumpSchema = z.object({
  sessionId: z.string().uuid(),
  section: elicitationSectionSchema,
});

export async function jumpToSection(
  input: z.infer<typeof jumpSchema>,
): Promise<ElicitationActionResult<{ section: string }>> {
  const parsed = jumpSchema.safeParse(input);
  if (!parsed.success) {
    return err("bad_input", parsed.error.issues[0]?.message ?? "Input inválido");
  }

  const supabase = await createClient();
  const session = await loadActiveSession(supabase, parsed.data.sessionId);
  if (!session) {
    return err("not_found", "Sesión no encontrada.");
  }

  const previous = session.current_section;
  if (previous === parsed.data.section) {
    return { ok: true, data: { section: parsed.data.section } };
  }

  // Marca la sección anterior como incomplete (si no estaba complete).
  const { data: prevProgress } = await supabase
    .from("project_section_progress")
    .select("status, completion_score")
    .eq("project_id", session.project_id)
    .eq("section", previous)
    .maybeSingle();

  if (!prevProgress || prevProgress.status !== "complete") {
    await supabase.from("project_section_progress").upsert(
      {
        project_id: session.project_id,
        section: previous,
        status: "incomplete" satisfies SectionStatus,
        completion_score: prevProgress?.completion_score ?? 0,
        last_updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,section" },
    );
  }

  // Update sesión a la nueva sección.
  const { error: updateError } = await supabase
    .from("sessions")
    .update({ current_section: parsed.data.section })
    .eq("id", session.id);
  if (updateError) {
    return err("db_error", updateError.message);
  }

  // Asegura que la nueva sección esté al menos in_progress.
  await supabase.from("project_section_progress").upsert(
    {
      project_id: session.project_id,
      section: parsed.data.section,
      status: "in_progress" satisfies SectionStatus,
      completion_score: 0,
      last_updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,section", ignoreDuplicates: false },
  );

  // Persistir turno meta documentando el salto.
  await supabase.from("turns").insert({
    session_id: session.id,
    project_id: session.project_id,
    actor: "engine",
    role: "meta",
    section: parsed.data.section,
    payload: {
      kind: "section_jump",
      from: previous,
      to: parsed.data.section,
    },
    status: "ok",
  });

  // Genera primera pregunta de la nueva sección.
  await generateAndPersistEngineTurn(supabase, session.id);

  log.info("elicitation.jumpToSection", {
    sessionId: session.id,
    from: previous,
    to: parsed.data.section,
  });
  revalidatePath(`/projects/${session.project_id}/elicit`);
  return { ok: true, data: { section: parsed.data.section } };
}

const resolveIssueSchema = z.object({
  issueId: z.string().uuid(),
  action: z.enum(["resolve", "dismiss"]),
  note: z.string().trim().max(2000).optional(),
});

export async function resolveIssue(
  input: z.infer<typeof resolveIssueSchema>,
): Promise<ElicitationActionResult<{ issueId: string }>> {
  const parsed = resolveIssueSchema.safeParse(input);
  if (!parsed.success) {
    return err("bad_input", parsed.error.issues[0]?.message ?? "Input inválido");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return err("unauthorized", "Sesión no válida.");
  }

  const { data: issue, error: loadError } = await supabase
    .from("detected_issues")
    .select("id, project_id")
    .eq("id", parsed.data.issueId)
    .maybeSingle();
  if (loadError || !issue) {
    return err("not_found", "Hallazgo no encontrado.");
  }

  const newStatus = parsed.data.action === "resolve" ? "resolved" : "dismissed";

  const { error: updateError } = await supabase
    .from("detected_issues")
    .update({
      status: newStatus,
      resolution_note: parsed.data.note ?? null,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", parsed.data.issueId);
  if (updateError) {
    return err("db_error", updateError.message);
  }

  log.info("elicitation.resolveIssue", {
    issueId: parsed.data.issueId,
    action: parsed.data.action,
    projectId: issue.project_id,
  });
  revalidatePath(`/projects/${issue.project_id}/elicit`);
  return { ok: true, data: { issueId: parsed.data.issueId } };
}

const closeSessionSchema = z.object({ sessionId: z.string().uuid() });

export async function closeSession(
  input: z.infer<typeof closeSessionSchema>,
): Promise<ElicitationActionResult<{ sessionId: string }>> {
  const parsed = closeSessionSchema.safeParse(input);
  if (!parsed.success) {
    return err("bad_input", parsed.error.issues[0]?.message ?? "Input inválido");
  }

  const supabase = await createClient();
  const session = await loadActiveSession(supabase, parsed.data.sessionId);
  if (!session) return err("not_found", "Sesión no encontrada.");

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("sessions")
    .update({ status: "closed", closed_at: now, ended_at: now })
    .eq("id", session.id);
  if (updateError) return err("db_error", updateError.message);

  log.info("elicitation.closeSession", {
    sessionId: session.id,
    projectId: session.project_id,
  });
  revalidatePath(`/projects/${session.project_id}/elicit`);
  return { ok: true, data: { sessionId: session.id } };
}

const listTurnsSchema = z.object({
  sessionId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  section: elicitationSectionSchema.optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

export type TurnSummary = Pick<
  Database["public"]["Tables"]["turns"]["Row"],
  | "id"
  | "session_id"
  | "project_id"
  | "actor"
  | "role"
  | "section"
  | "payload"
  | "status"
  | "error_code"
  | "created_at"
>;

export async function listTurns(
  input: z.infer<typeof listTurnsSchema>,
): Promise<ElicitationActionResult<{ turns: TurnSummary[] }>> {
  const parsed = listTurnsSchema.safeParse(input);
  if (!parsed.success) {
    return err("bad_input", parsed.error.issues[0]?.message ?? "Input inválido");
  }
  if (!parsed.data.sessionId && !parsed.data.projectId) {
    return err("bad_input", "Debe proveerse sessionId o projectId.");
  }

  const supabase = await createClient();
  let query = supabase
    .from("turns")
    .select(
      "id, session_id, project_id, actor, role, section, payload, status, error_code, created_at",
    )
    .order("created_at", { ascending: true })
    .range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1);

  if (parsed.data.sessionId) {
    query = query.eq("session_id", parsed.data.sessionId);
  }
  if (parsed.data.projectId) {
    query = query.eq("project_id", parsed.data.projectId);
  }
  if (parsed.data.section) {
    query = query.eq("section", parsed.data.section);
  }

  const { data, error: queryError } = await query;
  if (queryError) return err("db_error", queryError.message);

  return { ok: true, data: { turns: (data ?? []) as TurnSummary[] } };
}

const retryFailedSchema = z.object({
  sessionId: z.string().uuid(),
});

export async function retryFailedTurn(
  input: z.infer<typeof retryFailedSchema>,
): Promise<ElicitationActionResult<{ engineTurnId: string | null }>> {
  const parsed = retryFailedSchema.safeParse(input);
  if (!parsed.success) {
    return err("bad_input", parsed.error.issues[0]?.message ?? "Input inválido");
  }
  const supabase = await createClient();
  const session = await loadActiveSession(supabase, parsed.data.sessionId);
  if (!session) return err("not_found", "Sesión no encontrada.");

  const result = await generateAndPersistEngineTurn(supabase, session.id);
  revalidatePath(`/projects/${session.project_id}/elicit`);
  if (!result.ok) return err(result.error.code, result.error.message);
  return { ok: true, data: { engineTurnId: result.data.engineTurnId } };
}

// ------------------------------------------------------------------
// Helpers internos
// ------------------------------------------------------------------

type SupabaseAwaited = Awaited<ReturnType<typeof createClient>>;

async function generateAndPersistEngineTurn(
  supabase: SupabaseAwaited,
  sessionId: string,
): Promise<ElicitationActionResult<{ engineTurnId: string | null }>> {
  const session = await loadActiveSession(supabase, sessionId);
  if (!session) return err("not_found", "Sesión no encontrada al generar turno.");

  let context;
  try {
    context = await buildTurnContext(supabase, session);
  } catch (e) {
    return err("context_error", e instanceof Error ? e.message : String(e));
  }

  try {
    const { payload, tokenUsage } = await callModel({
      systemPrompt: context.systemPrompt,
      messages: context.messages,
    });

    const { data: engineTurn, error: engineInsertError } = await supabase
      .from("turns")
      .insert({
        session_id: session.id,
        project_id: session.project_id,
        actor: "engine",
        role: "question",
        section: session.current_section,
        payload,
        token_usage: tokenUsage,
        status: "ok",
      })
      .select("id")
      .single();
    if (engineInsertError || !engineTurn) {
      return err("db_error", engineInsertError?.message ?? "Insert de turno falló.");
    }

    await persistDetectedIssues(
      supabase,
      session.project_id,
      session.id,
      engineTurn.id,
      payload,
    );

    await applySectionAdvance(supabase, session.project_id, session.current_section, payload);

    log.info("elicitation.engineTurn.persisted", {
      sessionId: session.id,
      turnId: engineTurn.id,
      section: session.current_section,
      detectedIssues: payload.detected_issues.length,
      sectionComplete: payload.section_advance.complete,
      completionScore: payload.section_advance.completion_score,
    });
    return { ok: true, data: { engineTurnId: engineTurn.id } };
  } catch (e) {
    const aiErr = e instanceof AiCallError ? e : null;
    const code = aiErr?.code ?? "unknown";
    const message = e instanceof Error ? e.message : String(e);

    await supabase.from("turns").insert({
      session_id: session.id,
      project_id: session.project_id,
      actor: "engine",
      role: "meta",
      section: session.current_section,
      payload: { kind: "engine_failure", errorMessage: message },
      status: "failed",
      error_code: code,
    });

    log.error("elicitation.engineTurn.failed", {
      sessionId: session.id,
      section: session.current_section,
      code,
    });
    return err(code, message);
  }
}

async function persistDetectedIssues(
  supabase: SupabaseAwaited,
  projectId: string,
  sessionId: string,
  turnId: string,
  payload: SubmitTurnPayload,
) {
  if (!payload.detected_issues.length) return;
  const rows = payload.detected_issues.map((issue) => ({
    project_id: projectId,
    session_id: sessionId,
    turn_id: turnId,
    type: issue.type,
    severity: issue.severity,
    title: issue.title,
    body: issue.body,
    status: "open" as const,
  }));
  await supabase.from("detected_issues").insert(rows);
}

async function applySectionAdvance(
  supabase: SupabaseAwaited,
  projectId: string,
  section: Database["public"]["Enums"]["elicitation_section"],
  payload: SubmitTurnPayload,
) {
  const targetStatus: SectionStatus = payload.section_advance.complete
    ? "complete"
    : "in_progress";
  await supabase.from("project_section_progress").upsert(
    {
      project_id: projectId,
      section,
      status: targetStatus,
      completion_score: payload.section_advance.completion_score,
      last_updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,section" },
  );
}


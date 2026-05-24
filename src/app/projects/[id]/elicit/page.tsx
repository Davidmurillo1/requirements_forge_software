import Link from "next/link";
import { notFound } from "next/navigation";

import { TurnList } from "@/app/projects/[id]/elicit/_turn-list";
import { StartSessionButton } from "@/app/projects/[id]/elicit/_start-button";
import { TurnInput } from "@/app/projects/[id]/elicit/_turn-input";
import { SectionSelector } from "@/app/projects/[id]/elicit/_section-selector";
import { IssuePanel } from "@/app/projects/[id]/elicit/_issue-panel";
import { SECTION_TITLES } from "@/lib/ai/prompts/sections";
import { createClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";

type SectionStatus = Database["public"]["Enums"]["section_status"];

export const dynamic = "force-dynamic";

export default async function ElicitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, client_name, mode, status")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, current_section, status, started_at, mode")
    .eq("project_id", id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [{ data: turns }, { data: issues }, { data: progress }] = await Promise.all([
    session
      ? supabase
          .from("turns")
          .select("id, actor, role, section, payload, status, error_code, created_at")
          .eq("session_id", session.id)
          .order("created_at", { ascending: true })
          .limit(200)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("detected_issues")
      .select("id, type, severity, title, body, status, created_at")
      .eq("project_id", id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("project_section_progress")
      .select("section, status, completion_score")
      .eq("project_id", id),
  ]);

  const progressMap = new Map<string, { status: SectionStatus; completion_score: number }>();
  for (const row of progress ?? []) {
    progressMap.set(row.section, {
      status: row.status,
      completion_score: row.completion_score,
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <Link
        href={`/projects/${project.id}/edit`}
        className="mb-4 inline-block text-sm text-muted-foreground hover:underline"
      >
        ← Volver al proyecto
      </Link>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <p className="text-sm text-muted-foreground">
          Elicitación · modo {project.mode === "consultant" ? "Consultor" : "Autoservicio"}
          {project.client_name ? ` · ${project.client_name}` : ""}
        </p>
      </header>

      {!session ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            No hay sesión activa todavía. Inicia una para comenzar el levantamiento.
          </p>
          <StartSessionButton projectId={project.id} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Sección activa
                </p>
                <p className="text-sm font-medium">
                  {SECTION_TITLES[session.current_section]}
                </p>
              </div>
              <SectionSelector
                sessionId={session.id}
                currentSection={session.current_section}
                progress={Object.fromEntries(progressMap)}
              />
            </div>
            <TurnList turns={turns ?? []} sessionId={session.id} />
            <div className="border-t p-4">
              <TurnInput sessionId={session.id} />
            </div>
          </section>

          <aside className="space-y-4">
            <IssuePanel issues={issues ?? []} />
          </aside>
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/db/server";
import { EditProjectForm } from "@/app/projects/[id]/edit/_edit-form";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name, client_name, start_date, mode, status, version, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !project) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link
        href="/projects"
        className="mb-6 inline-block text-sm text-muted-foreground hover:underline"
      >
        ← Volver a proyectos
      </Link>

      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Editar proyecto</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Versión {project.version} · Creado {new Date(project.created_at).toLocaleString("es-CR")}
      </p>

      <EditProjectForm project={project} />
    </div>
  );
}

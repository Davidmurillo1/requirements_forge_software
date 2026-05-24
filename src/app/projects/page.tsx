import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/db/server";
import { CreateProjectForm } from "@/app/projects/_create-form";
import { SignOutButton } from "@/app/projects/_signout-button";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  active: "Activo",
  exported: "Exportado",
  archived: "Archivado",
};

const MODE_LABEL: Record<string, string> = {
  consultant: "Consultor",
  self_service: "Autoservicio",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-CR", { dateStyle: "medium" });
}

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, client_name, status, mode, start_date, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Proyectos</h1>
          <p className="text-sm text-muted-foreground">
            Levantamientos de requerimientos.{" "}
            {user?.email ? <span>Sesión: {user.email}</span> : null}
          </p>
        </div>
        <SignOutButton />
      </header>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Nuevo proyecto</CardTitle>
          <CardDescription>
            El cliente y la fecha son opcionales. Modo y estado se pueden cambiar después.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateProjectForm />
        </CardContent>
      </Card>

      <h2 className="mb-3 text-lg font-medium">Tus proyectos</h2>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          Error cargando proyectos: {error.message}
        </p>
      ) : null}

      {!projects || projects.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aún no hay proyectos. Crea el primero con el formulario de arriba.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/projects/${p.id}/edit`}
                  className="block truncate font-medium hover:underline"
                >
                  {p.name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {p.client_name ?? "Sin cliente"} · Inicio {formatDate(p.start_date)} · Modo{" "}
                  {MODE_LABEL[p.mode] ?? p.mode}
                </p>
              </div>
              <span className="rounded-full bg-muted px-2 py-1 text-xs">
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
            </li>
          ))}
        </ul>
      )}

    </div>
  );
}

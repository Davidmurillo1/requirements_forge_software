"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteProject, updateProject, type ActionState } from "@/server/projects";

type Project = {
  id: string;
  name: string;
  client_name: string | null;
  start_date: string | null;
  mode: string;
  status: string;
};

export function EditProjectForm({ project }: { project: Project }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateProject, {});

  return (
    <div className="space-y-8">
      <form action={formAction} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="id" value={project.id} />

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Nombre *</Label>
          <Input id="name" name="name" required maxLength={200} defaultValue={project.name} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client_name">Cliente</Label>
          <Input
            id="client_name"
            name="client_name"
            maxLength={200}
            defaultValue={project.client_name ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="start_date">Fecha de inicio</Label>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            defaultValue={project.start_date ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mode">Modo</Label>
          <select
            id="mode"
            name="mode"
            defaultValue={project.mode}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="consultant">Consultor</option>
            <option value="self_service">Autoservicio</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <select
            id="status"
            name="status"
            defaultValue={project.status}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="draft">Borrador</option>
            <option value="active">Activo</option>
            <option value="exported">Exportado</option>
            <option value="archived">Archivado</option>
          </select>
        </div>

        {state.error ? (
          <p className="sm:col-span-2 text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="sm:col-span-2 text-sm text-emerald-600" role="status">
            {state.success}
          </p>
        ) : null}

        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </form>

      <form
        action={deleteProject}
        className="rounded-md border border-destructive/30 p-4"
        onSubmit={(e) => {
          if (!confirm("¿Borrar este proyecto y todos sus datos? Esta acción es irreversible.")) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={project.id} />
        <p className="mb-3 text-sm">
          Borrar el proyecto elimina en cascada stakeholders, historias, NFRs y todas las entidades
          asociadas.
        </p>
        <Button type="submit" variant="destructive">
          Borrar proyecto
        </Button>
      </form>
    </div>
  );
}

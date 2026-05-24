"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProject, type ActionState } from "@/server/projects";

export function CreateProjectForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createProject, {});

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="name">Nombre del proyecto *</Label>
        <Input id="name" name="name" required maxLength={200} placeholder="Ej: ERP Joyería Fortuna" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="client_name">Cliente</Label>
        <Input id="client_name" name="client_name" maxLength={200} placeholder="Razón social" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="start_date">Fecha de inicio</Label>
        <Input id="start_date" name="start_date" type="date" />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="mode">Modo inicial</Label>
        <select
          id="mode"
          name="mode"
          defaultValue="consultant"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          <option value="consultant">Consultor (entrevista en vivo)</option>
          <option value="self_service">Autoservicio (token al stakeholder)</option>
        </select>
      </div>

      {state.error ? (
        <p className="sm:col-span-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear proyecto"}
        </Button>
      </div>
    </form>
  );
}

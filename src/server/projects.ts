"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/db/server";
import {
  projectCreateSchema,
  projectUpdateSchema,
  type ProjectCreateInput,
  type ProjectUpdateInput,
} from "@/lib/validation/projects";

export type ActionState = { error?: string; success?: string };

function flattenZodIssues(issues: { message: string }[]): string {
  return issues.map((i) => i.message).join(" · ");
}

export async function createProject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = projectCreateSchema.safeParse({
    name: formData.get("name"),
    client_name: formData.get("client_name"),
    start_date: formData.get("start_date"),
    mode: formData.get("mode") ?? undefined,
  });

  if (!parsed.success) {
    return { error: flattenZodIssues(parsed.error.issues) };
  }

  const input: ProjectCreateInput = parsed.data;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Sesión no válida. Vuelve a iniciar sesión." };
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: input.name,
      client_name: input.client_name,
      start_date: input.start_date,
      mode: input.mode,
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "No se pudo crear el proyecto." };
  }

  revalidatePath("/projects");
  redirect(`/projects/${data.id}/edit`);
}

export async function updateProject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = projectUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    client_name: formData.get("client_name"),
    start_date: formData.get("start_date"),
    mode: formData.get("mode") ?? undefined,
    status: formData.get("status") ?? undefined,
  });

  if (!parsed.success) {
    return { error: flattenZodIssues(parsed.error.issues) };
  }

  const input: ProjectUpdateInput = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("projects")
    .update({
      name: input.name,
      client_name: input.client_name,
      start_date: input.start_date,
      mode: input.mode,
      ...(input.status ? { status: input.status } : {}),
    })
    .eq("id", input.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${input.id}/edit`);
  return { success: "Proyecto actualizado." };
}

export async function deleteProject(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const supabase = await createClient();
  await supabase.from("projects").delete().eq("id", id);

  revalidatePath("/projects");
  redirect("/projects");
}

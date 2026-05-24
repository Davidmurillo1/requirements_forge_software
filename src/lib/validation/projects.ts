import { z } from "zod";

export const projectStatusSchema = z.enum(["draft", "active", "exported", "archived"]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const projectModeSchema = z.enum(["consultant", "self_service"]);
export type ProjectMode = z.infer<typeof projectModeSchema>;

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(200),
  client_name: z.string().trim().max(200).optional().or(z.literal("")).transform((v) => v || null),
  start_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD.")
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
  mode: projectModeSchema.default("consultant"),
});

export const projectUpdateSchema = projectCreateSchema.extend({
  id: z.string().uuid(),
  status: projectStatusSchema.optional(),
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;

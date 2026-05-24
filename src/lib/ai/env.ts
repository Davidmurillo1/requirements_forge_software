import { z } from "zod";

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY no está definida"),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-4-6"),
});

let cached: z.infer<typeof envSchema> | null = null;

export function getAiEnv() {
  if (cached) return cached;
  const parsed = envSchema.safeParse({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
  });
  if (!parsed.success) {
    throw new Error(
      `Variables de entorno IA inválidas: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  cached = parsed.data;
  return cached;
}

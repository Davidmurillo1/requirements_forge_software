import { z } from "zod";

export const elicitationSectionSchema = z.enum([
  "project_context",
  "stakeholders_personas",
  "scope",
  "business_process",
  "user_stories",
  "nfrs",
  "domain_data",
  "integrations",
  "ui_ux",
  "constraints_assumptions_risks",
  "glossary",
]);
export type ElicitationSection = z.infer<typeof elicitationSectionSchema>;

export const issueTypeSchema = z.enum([
  "vagueness",
  "contradiction",
  "missing_cross_cutting",
  "missing_metric",
  "undefined_glossary",
]);
export type IssueType = z.infer<typeof issueTypeSchema>;

export const issueSeveritySchema = z.enum(["info", "warning", "error"]);
export type IssueSeverity = z.infer<typeof issueSeveritySchema>;

const detectedIssueSchema = z.object({
  type: issueTypeSchema,
  severity: issueSeveritySchema,
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(5000),
});
export type DetectedIssue = z.infer<typeof detectedIssueSchema>;

const sectionAdvanceSchema = z.object({
  complete: z.boolean(),
  completion_score: z.number().int().min(0).max(100),
  next_suggested_section: elicitationSectionSchema.nullable().optional(),
});
export type SectionAdvance = z.infer<typeof sectionAdvanceSchema>;

const factSchema = z.object({
  key: z.string().min(1).max(120),
  value: z.string().min(1).max(1000),
});
export type ExtractedFact = z.infer<typeof factSchema>;

export const submitTurnPayloadSchema = z.object({
  question: z.string().min(1).max(3000),
  suggested_followups: z.array(z.string().min(1).max(300)).max(6).default([]),
  detected_issues: z.array(detectedIssueSchema).max(10).default([]),
  section_advance: sectionAdvanceSchema.default({
    complete: false,
    completion_score: 0,
    next_suggested_section: null,
  }),
  fact_extraction: z.array(factSchema).max(20).default([]),
});
export type SubmitTurnPayload = z.infer<typeof submitTurnPayloadSchema>;

type SubmitTurnTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown> & { type: "object" };
};

export const SUBMIT_TURN_TOOL: SubmitTurnTool = {
  name: "submit_turn",
  description:
    "Devuelve la pregunta del motor, hallazgos detectados, sugerencias de seguimiento, marca de avance de la sección y facts extraídos del último input del usuario. Llama este tool en CADA respuesta.",
  input_schema: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description:
          "Pregunta principal que el motor formula al usuario en este turno. Concisa, accionable, en el idioma del usuario (español por default).",
      },
      suggested_followups: {
        type: "array",
        items: { type: "string" },
        description:
          "Hasta 6 sub-preguntas o aclaraciones opcionales que el consultor podría usar si necesita profundizar. Vacío si no aplica.",
      },
      detected_issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: [
                "vagueness",
                "contradiction",
                "missing_cross_cutting",
                "missing_metric",
                "undefined_glossary",
              ],
            },
            severity: {
              type: "string",
              enum: ["info", "warning", "error"],
            },
            title: {
              type: "string",
              description: "Título corto del hallazgo (≤ 300 chars).",
            },
            body: {
              type: "string",
              description:
                "Explicación del hallazgo y qué se recomienda hacer. Cita el texto del usuario que lo motivó.",
            },
          },
          required: ["type", "severity", "title", "body"],
          additionalProperties: false,
        },
      },
      section_advance: {
        type: "object",
        properties: {
          complete: {
            type: "boolean",
            description:
              "true si la sección actual quedó suficientemente cubierta para marcarse 'complete'.",
          },
          completion_score: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            description:
              "Score de avance estimado de la sección actual (0-100). Se persiste en project_section_progress.",
          },
          next_suggested_section: {
            type: ["string", "null"],
            enum: [
              "project_context",
              "stakeholders_personas",
              "scope",
              "business_process",
              "user_stories",
              "nfrs",
              "domain_data",
              "integrations",
              "ui_ux",
              "constraints_assumptions_risks",
              "glossary",
              null,
            ],
            description:
              "Si complete=true, qué sección sugieres abordar a continuación. null si no aplica.",
          },
        },
        required: ["complete", "completion_score"],
        additionalProperties: false,
      },
      fact_extraction: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string" },
            value: { type: "string" },
          },
          required: ["key", "value"],
          additionalProperties: false,
        },
        description:
          "Hechos atómicos extraídos del último input del usuario, en formato (key, value). Sirven para construir 'project facts' compactos en turnos futuros y detectar contradicciones.",
      },
    },
    required: ["question", "section_advance"],
    additionalProperties: false,
  },
};

export const turnRequestSchema = z.object({
  sessionId: z.string().uuid(),
  clientRequestId: z.string().uuid(),
  userMessage: z.string().trim().min(1).max(10000),
});
export type TurnRequest = z.infer<typeof turnRequestSchema>;

export const tokenUsageSchema = z.object({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
  model: z.string().min(1),
});
export type TokenUsage = z.infer<typeof tokenUsageSchema>;

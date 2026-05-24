import "server-only";

import Anthropic, { APIError } from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

import { getAiEnv } from "@/lib/ai/env";
import { log } from "@/lib/ai/log";
import {
  SUBMIT_TURN_TOOL,
  submitTurnPayloadSchema,
  type SubmitTurnPayload,
  type TokenUsage,
} from "@/lib/ai/schemas";

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1_000;
const MAX_OUTPUT_TOKENS = 2_048;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  const { ANTHROPIC_API_KEY } = getAiEnv();
  client = new Anthropic({
    apiKey: ANTHROPIC_API_KEY,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 0, // gestionamos los retries explícitamente
  });
  return client;
}

export class AiCallError extends Error {
  constructor(
    public readonly code:
      | "rate_limited"
      | "server_error"
      | "network"
      | "timeout"
      | "unauthorized"
      | "bad_request"
      | "malformed_output"
      | "unknown",
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiCallError";
  }
}

function classify(err: unknown): AiCallError {
  if (err instanceof AiCallError) return err;
  if (err instanceof APIError) {
    const status = err.status;
    if (status === 401 || status === 403) {
      return new AiCallError("unauthorized", err.message, err);
    }
    if (status === 400 || status === 404 || status === 422) {
      return new AiCallError("bad_request", err.message, err);
    }
    if (status === 429) {
      return new AiCallError("rate_limited", err.message, err);
    }
    if (status && status >= 500) {
      return new AiCallError("server_error", err.message, err);
    }
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/timeout/i.test(msg)) {
    return new AiCallError("timeout", msg, err);
  }
  if (/network|fetch failed|ECONN|ENOTFOUND|EAI_AGAIN/i.test(msg)) {
    return new AiCallError("network", msg, err);
  }
  return new AiCallError("unknown", msg, err);
}

function isRetryable(code: AiCallError["code"]): boolean {
  return (
    code === "rate_limited" ||
    code === "server_error" ||
    code === "network" ||
    code === "timeout"
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CallModelInput {
  systemPrompt: string;
  messages: MessageParam[];
}

export interface CallModelResult {
  payload: SubmitTurnPayload;
  tokenUsage: TokenUsage;
  rawText: string | null;
}

export async function callModel(input: CallModelInput): Promise<CallModelResult> {
  const { ANTHROPIC_MODEL } = getAiEnv();
  const c = getClient();

  let lastError: AiCallError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const startedAt = Date.now();
    try {
      const response = await c.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: input.systemPrompt,
        messages: input.messages,
        tools: [SUBMIT_TURN_TOOL],
        tool_choice: { type: "tool", name: SUBMIT_TURN_TOOL.name },
      });

      const latencyMs = Date.now() - startedAt;

      const tokenUsage: TokenUsage = {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        model: response.model,
      };

      const toolUse = response.content.find(
        (block): block is Extract<typeof block, { type: "tool_use" }> =>
          block.type === "tool_use" && block.name === SUBMIT_TURN_TOOL.name,
      );

      const rawText =
        response.content.find((b) => b.type === "text")?.text ?? null;

      if (!toolUse) {
        throw new AiCallError(
          "malformed_output",
          "El modelo no invocó submit_turn tool",
        );
      }

      const parsed = submitTurnPayloadSchema.safeParse(toolUse.input);
      if (!parsed.success) {
        throw new AiCallError(
          "malformed_output",
          `Tool input no valida contra schema: ${parsed.error.message}`,
        );
      }

      log.info("ai.call.success", {
        model: response.model,
        attempt,
        latencyMs,
        inputTokens: tokenUsage.input,
        outputTokens: tokenUsage.output,
      });

      return { payload: parsed.data, tokenUsage, rawText };
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      const e = classify(err);
      lastError = e;
      const willRetry = isRetryable(e.code) && attempt < MAX_ATTEMPTS;
      log.warn("ai.call.failure", {
        model: ANTHROPIC_MODEL,
        attempt,
        latencyMs,
        code: e.code,
        retrying: willRetry,
      });
      if (!willRetry) {
        throw e;
      }
      const jitter = 1 + (Math.random() - 0.5) * 0.5; // ±25%
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1) * jitter);
    }
  }

  throw lastError ?? new AiCallError("unknown", "Fallo desconocido en callModel");
}

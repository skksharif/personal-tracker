import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { AiError, aiError } from "@/lib/ai/errors";
import { aiEnv, isAiConfigured } from "@/lib/env";

/**
 * The one place the application talks to Gemini.
 *
 * Nothing else builds a request, reads a response, or knows the API key
 * exists. That keeps three things in a single auditable file: what is sent,
 * what is trusted on the way back, and how failures are named.
 *
 * Built on Google's own SDK rather than raw HTTP. The wire format is the part
 * most likely to be guessed wrong and least likely to be caught by a type
 * checker, and the Interactions/generateContent surface moves faster than a
 * hand-rolled client would keep up with.
 */

const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 3;

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionOptions {
  messages: Message[];
  /** Overrides GEMINI_MODEL for this call. */
  model?: string;
  /** Use the smaller, faster model. For short, frequent tasks. */
  fast?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface CompletionResult {
  text: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  /** Gemini bills reasoning separately; worth surfacing so cost is visible. */
  thoughtTokens?: number;
  elapsedMs: number;
}

/* -------------------------------------------------------------------------- */
/* Client                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The slice of the SDK this module uses.
 *
 * Narrow on purpose: it is the whole surface a test double has to implement,
 * and it documents exactly how much of the SDK the app depends on.
 */
export interface GenerateArgs {
  model: string;
  contents: unknown;
  config?: Record<string, unknown>;
}

export interface GenerateResponse {
  text?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  candidates?: {
    content?: {
      parts?: {
        text?: string;
        inlineData?: { mimeType?: string; data?: string };
      }[];
    };
  }[];
}

export interface GeminiClient {
  models: {
    generateContent: (args: GenerateArgs) => Promise<GenerateResponse>;
  };
}

let injected: GeminiClient | null = null;
let cached: GeminiClient | null = null;

/** Test seam. Passing `null` restores the real SDK client. */
export function setClient(next: GeminiClient | null): void {
  injected = next;
  cached = null;
}

function client(): GeminiClient {
  if (injected) return injected;
  if (cached) return cached;

  cached = new GoogleGenAI({
    apiKey: aiEnv().GEMINI_API_KEY,
  }) as unknown as GeminiClient;

  return cached;
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Map an SDK failure onto a named error.
 *
 * Gemini reports failures as a JSON body inside the thrown message, so the
 * code and text are dug out rather than inferred from the class.
 *
 * The quota case matters: a 429 from Gemini can mean either "slow down"
 * (retryable) or "your plan does not include this" (never retryable, and
 * retrying just makes the user wait three times as long for the same answer).
 * The message text is what separates them.
 */
export function classifyError(error: unknown): AiError {
  if (error instanceof AiError) return error;

  const raw =
    error instanceof Error ? error.message : String(error ?? "unknown");

  let code: number | undefined;
  let message = raw;

  try {
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"))) as {
      error?: { code?: number; message?: string; status?: string };
    };
    code = parsed.error?.code;
    message = parsed.error?.message ?? raw;
  } catch {
    const match = raw.match(/\b(4\d{2}|5\d{2})\b/);
    if (match) code = Number(match[1]);
  }

  const lower = message.toLowerCase();

  if (lower.includes("quota") || lower.includes("billing")) {
    return aiError("quota", message.slice(0, 300));
  }
  if (
    code === 401 ||
    code === 403 ||
    lower.includes("api key") ||
    lower.includes("permission")
  ) {
    return aiError("auth", message.slice(0, 300));
  }
  if (code === 429) return aiError("rate_limited", message.slice(0, 300));
  if (code === 503 || code === 500 || (code ?? 0) >= 500) {
    return aiError("server", `HTTP ${code} — ${message.slice(0, 200)}`);
  }
  if (lower.includes("abort") || lower.includes("timeout")) {
    return aiError("timeout");
  }
  if (lower.includes("fetch") || lower.includes("network")) {
    return aiError("network", message.slice(0, 200));
  }

  return aiError(
    "unknown",
    `${code ? `HTTP ${code} — ` : ""}${message.slice(0, 200)}`,
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 400ms, 800ms — bounded, and short enough that a person will wait. */
function backoff(attempt: number): number {
  return 400 * 2 ** (attempt - 1);
}

/* -------------------------------------------------------------------------- */
/* Requests                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Split our message list into Gemini's shape.
 *
 * Gemini keeps the system prompt outside the conversation and calls the
 * assistant role "model", so the translation happens here rather than leaking
 * a provider's vocabulary into every prompt file.
 */
export function toGeminiRequest(messages: Message[]): {
  systemInstruction?: string;
  contents: { role: "user" | "model"; parts: { text: string }[] }[];
} {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role:
        message.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: message.content }],
    }));

  return {
    contents,
    ...(system ? { systemInstruction: system } : {}),
  };
}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(aiError("timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function run(
  options: CompletionOptions & { config?: Record<string, unknown> },
): Promise<CompletionResult> {
  if (!isAiConfigured()) throw aiError("not_configured");

  const settings = aiEnv();
  const model =
    options.model ??
    (options.fast ? settings.GEMINI_FAST_MODEL : settings.GEMINI_MODEL);

  const { systemInstruction, contents } = toGeminiRequest(options.messages);
  const started = Date.now();

  let lastError: AiError = aiError("unknown");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await withTimeout(
        client().models.generateContent({
          model,
          contents,
          config: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens ?? 1024,
            ...(systemInstruction ? { systemInstruction } : {}),
            ...options.config,
          },
        }),
        options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );

      const text =
        response.text?.trim() ??
        response.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("")
          .trim();

      if (!text) throw aiError("bad_response", "empty completion");

      return {
        text,
        model,
        elapsedMs: Date.now() - started,
        ...(response.usageMetadata?.promptTokenCount !== undefined
          ? { promptTokens: response.usageMetadata.promptTokenCount }
          : {}),
        ...(response.usageMetadata?.candidatesTokenCount !== undefined
          ? { completionTokens: response.usageMetadata.candidatesTokenCount }
          : {}),
        ...(response.usageMetadata?.thoughtsTokenCount !== undefined
          ? { thoughtTokens: response.usageMetadata.thoughtsTokenCount }
          : {}),
      };
    } catch (error) {
      lastError = classifyError(error);
      if (!lastError.retryable || attempt === MAX_ATTEMPTS) throw lastError;
      await sleep(backoff(attempt));
    }
  }

  throw lastError;
}

export async function complete(
  options: CompletionOptions,
): Promise<CompletionResult> {
  return run(options);
}

/* -------------------------------------------------------------------------- */
/* Structured output                                                          */
/* -------------------------------------------------------------------------- */

/**
 * A completion constrained to a schema, and validated against the same one.
 *
 * Gemini enforces the shape server-side from `responseSchema`, and the Zod
 * schema that produced it then re-checks the result. One definition drives
 * both, so the constraint and the validation cannot drift apart.
 *
 * The second check is not redundant: a constrained decode still cannot
 * guarantee semantics, and model output is data from outside the application —
 * treated with the same suspicion as a file upload.
 */
export async function completeJson<T>(
  options: CompletionOptions & { schema: z.ZodType<T> },
): Promise<{ data: T; result: CompletionResult }> {
  const { schema, ...rest } = options;

  const result = await run({
    ...rest,
    // Structured tasks want the model's least creative setting.
    temperature: rest.temperature ?? 0.2,
    config: {
      responseMimeType: "application/json",
      responseSchema: z.toJSONSchema(schema),
    },
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.text);
  } catch {
    // Constrained decoding makes this rare, but a truncated response (hitting
    // maxOutputTokens mid-object) still lands here.
    throw aiError("bad_response", `not JSON: ${result.text.slice(0, 200)}`);
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    throw aiError(
      "bad_response",
      validated.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; "),
    );
  }

  return { data: validated.data, result };
}

/* -------------------------------------------------------------------------- */
/* Images                                                                     */
/* -------------------------------------------------------------------------- */

export interface GeneratedImage {
  bytes: Uint8Array;
  mimeType: string;
}

/**
 * Generate an image.
 *
 * Kept here with everything else that talks to the provider. Phase 6 decides
 * what to do with the result; this only obtains it.
 */
export async function generateImage(
  prompt: string,
  options: { model?: string; timeoutMs?: number } = {},
): Promise<GeneratedImage> {
  if (!isAiConfigured()) throw aiError("not_configured");

  const settings = aiEnv();

  try {
    const response = await withTimeout(
      client().models.generateContent({
        model: options.model ?? settings.GEMINI_IMAGE_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
      options.timeoutMs ?? 90_000,
    );

    const inline = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData?.data,
    )?.inlineData;

    if (!inline?.data) {
      throw aiError("bad_response", "no image in response");
    }

    return {
      bytes: Uint8Array.from(Buffer.from(inline.data, "base64")),
      mimeType: inline.mimeType ?? "image/png",
    };
  } catch (error) {
    throw classifyError(error);
  }
}

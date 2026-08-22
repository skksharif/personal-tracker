import "server-only";

import { z } from "zod";

/**
 * Environment access. Importing this module from a Client Component is a build
 * error, courtesy of `server-only` — that is the guard that keeps GEMINI_API_KEY
 * out of the browser bundle.
 *
 * Config is split in two on purpose:
 *
 *   `env`        always required, validated once at module load.
 *   `aiEnv()`    only required when an AI feature actually runs.
 *
 * The app must be fully usable through Phases 0-3 with no API key present, so
 * a missing key is not a boot failure. It becomes an error at the moment an AI
 * action is invoked, with a message that says what to do about it.
 */

const baseSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATA_DIR: z.string().min(1).default("data"),
});

const baseResult = baseSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  DATA_DIR: process.env.DATA_DIR,
});

if (!baseResult.success) {
  throw new Error(
    `Invalid environment configuration:\n${z.prettifyError(baseResult.error)}`,
  );
}

export const env = baseResult.data;

const aiSchema = z.object({
  GEMINI_API_KEY: z
    .string()
    .min(
      1,
      "GEMINI_API_KEY is empty. Add it to .env.local — see .env.example.",
    ),
  /**
   * Google's current general-purpose recommendation. Naming a live model
   * explicitly keeps behaviour and billing predictable, rather than inheriting
   * whatever an alias happens to point at this month.
   */
  GEMINI_MODEL: z.string().min(1).default("gemini-3.7-flash"),
  /**
   * A smaller model for short, frequent calls — suggesting a title, extracting
   * tags. Measured at roughly a third of the default's latency, which is the
   * difference between an inline control feeling instant and feeling slow.
   */
  GEMINI_FAST_MODEL: z.string().min(1).default("gemini-3.5-flash-lite"),
  GEMINI_IMAGE_MODEL: z.string().min(1).default("gemini-3.1-flash-image"),
});

export type AiEnv = z.infer<typeof aiSchema>;

let cachedAiEnv: AiEnv | null = null;

/**
 * Validated AI configuration. Throws a readable error if the key is missing,
 * so callers can surface "AI isn't configured yet" rather than a raw 401.
 */
export function aiEnv(): AiEnv {
  if (cachedAiEnv) return cachedAiEnv;

  const result = aiSchema.safeParse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GEMINI_FAST_MODEL: process.env.GEMINI_FAST_MODEL,
    GEMINI_IMAGE_MODEL: process.env.GEMINI_IMAGE_MODEL,
  });

  if (!result.success) {
    throw new Error(`AI is not configured:\n${z.prettifyError(result.error)}`);
  }

  cachedAiEnv = result.data;
  return cachedAiEnv;
}

/** Whether AI features should be offered in the UI at all. */
export function isAiConfigured(): boolean {
  return (process.env.GEMINI_API_KEY ?? "").length > 0;
}

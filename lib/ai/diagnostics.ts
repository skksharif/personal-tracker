import "server-only";

import { z } from "zod";

import { AiError } from "@/lib/ai/errors";
import { complete, completeJson, generateImage } from "@/lib/ai/gemini";
import { aiEnv, isAiConfigured } from "@/lib/env";

/**
 * The AI connection check.
 *
 * Three questions the app's design depends on, written as runnable probes
 * rather than a one-off session: does the configured model answer, does
 * structured output hold, and is image generation available on this key.
 *
 * They can be re-run whenever the key, the model, or Google's API changes —
 * which is the point, because each of those has already moved once.
 *
 * Every probe is small and cheap. This is a diagnostic, not a benchmark.
 */

export interface Probe {
  name: string;
  status: "pass" | "fail" | "skipped";
  detail: string;
  elapsedMs?: number;
}

export interface Diagnostics {
  configured: boolean;
  chatModel: string;
  fastModel: string;
  imageModel: string;
  probes: Probe[];
}

const structuredProbeSchema = z.object({
  ok: z.boolean(),
  items: z.array(z.string()),
});

export async function runDiagnostics(): Promise<Diagnostics> {
  if (!isAiConfigured()) {
    return {
      configured: false,
      chatModel: "—",
      fastModel: "—",
      imageModel: "—",
      probes: [
        {
          name: "API key",
          status: "skipped",
          detail:
            "GEMINI_API_KEY is empty. Add it to .env.local and restart the dev server.",
        },
      ],
    };
  }

  const config = aiEnv();

  return {
    configured: true,
    chatModel: config.GEMINI_MODEL,
    fastModel: config.GEMINI_FAST_MODEL,
    imageModel: config.GEMINI_IMAGE_MODEL,
    probes: [await probeChat(), await probeStructured(), await probeImage()],
  };
}

/** Does the configured model answer at all, and how quickly? */
async function probeChat(): Promise<Probe> {
  try {
    const result = await complete({
      messages: [
        { role: "user", content: "Reply with exactly the word: ready" },
      ],
      maxTokens: 500,
      temperature: 0,
      timeoutMs: 30_000,
    });

    const usage = [
      result.promptTokens !== undefined
        ? `${result.promptTokens} prompt`
        : null,
      result.completionTokens !== undefined
        ? `${result.completionTokens} output`
        : null,
      result.thoughtTokens ? `${result.thoughtTokens} thinking` : null,
    ]
      .filter(Boolean)
      .join(" / ");

    return {
      name: "Text generation",
      status: "pass",
      elapsedMs: result.elapsedMs,
      detail: `${result.model} replied in ${result.elapsedMs}ms${
        usage ? ` · ${usage} tokens` : ""
      }`,
    };
  } catch (error) {
    return failure("Text generation", error);
  }
}

/**
 * Does a schema actually constrain the output?
 *
 * This decides how much of the AI layer can rely on structured responses
 * rather than parsing free text defensively. Gemini enforces the schema
 * server-side, so this is checking the whole path: Zod schema → request
 * constraint → response → Zod validation.
 */
async function probeStructured(): Promise<Probe> {
  try {
    const { data, result } = await completeJson({
      messages: [
        {
          role: "system",
          content: "You return structured data. Keep it minimal.",
        },
        {
          role: "user",
          content: 'Return ok = true and items = ["a", "b"].',
        },
      ],
      schema: structuredProbeSchema,
      fast: true,
      maxTokens: 400,
      timeoutMs: 30_000,
    });

    return {
      name: "Structured output",
      status: "pass",
      elapsedMs: result.elapsedMs,
      detail: `${result.model} returned schema-valid JSON in ${result.elapsedMs}ms (${data.items.length} items)`,
    };
  } catch (error) {
    return failure("Structured output", error);
  }
}

/**
 * Is image generation available on this key?
 *
 * Phase 6 is either real image generation or a diagram-and-upload fallback,
 * and this is what decides it. A quota failure here is a plan limit rather
 * than a bug, and says so.
 */
async function probeImage(): Promise<Probe> {
  try {
    const image = await generateImage("A plain grey square, minimal.", {
      timeoutMs: 60_000,
    });

    return {
      name: "Image generation",
      status: "pass",
      detail: `Available — returned ${Math.round(image.bytes.length / 1024)}KB of ${image.mimeType}.`,
    };
  } catch (error) {
    const probe = failure("Image generation", error);

    if (error instanceof AiError && error.kind === "quota") {
      probe.detail =
        "Not included on this key's plan (quota). Visual AI can still work from diagrams and uploads.";
    }

    return probe;
  }
}

function failure(name: string, error: unknown): Probe {
  if (error instanceof AiError) {
    return {
      name,
      status: "fail",
      detail: error.detail
        ? `${error.message} (${error.detail})`
        : error.message,
    };
  }
  return { name, status: "fail", detail: (error as Error).message };
}

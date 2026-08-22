import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

/**
 * The Gemini client, exercised without a network or an API key.
 *
 * The live questions — which model answers, whether structured output holds,
 * whether image generation is on this key — are answered by
 * `lib/ai/diagnostics.ts` against a real key. What is pinned here is
 * everything that must behave correctly *when the provider misbehaves*: the
 * part most likely to be wrong and least likely to be noticed.
 */

let gemini: typeof import("@/lib/ai/gemini");
let errors: typeof import("@/lib/ai/errors");

/** Build the JSON-in-a-message error shape the Gemini SDK throws. */
function apiError(code: number, message: string, status = "ERROR"): Error {
  return new Error(
    `got status: ${code}. ${JSON.stringify({ error: { code, message, status } })}`,
  );
}

function reply(text: string) {
  return {
    text,
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 5,
      thoughtsTokenCount: 7,
    },
  };
}

beforeEach(async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-key-not-real");
  vi.resetModules();

  gemini = await import("@/lib/ai/gemini");
  errors = await import("@/lib/ai/errors");
});

afterEach(() => {
  gemini.setClient(null);
  vi.unstubAllEnvs();
});

describe("configuration", () => {
  it("refuses to call out with no key, without touching the network", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.resetModules();
    const fresh = await import("@/lib/ai/gemini");

    const generateContent = vi.fn();
    fresh.setClient({ models: { generateContent } });

    await expect(
      fresh.complete({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toMatchObject({ kind: "not_configured" });

    expect(generateContent).not.toHaveBeenCalled();
  });

  it("uses the fast model only when asked", async () => {
    vi.stubEnv("GEMINI_MODEL", "big-model");
    vi.stubEnv("GEMINI_FAST_MODEL", "small-model");
    vi.resetModules();
    const fresh = await import("@/lib/ai/gemini");

    const seen: string[] = [];
    fresh.setClient({
      models: {
        generateContent: async (args) => {
          seen.push(args.model);
          return reply("ok");
        },
      },
    });

    await fresh.complete({ messages: [{ role: "user", content: "hi" }] });
    await fresh.complete({
      messages: [{ role: "user", content: "hi" }],
      fast: true,
    });

    expect(seen).toEqual(["big-model", "small-model"]);
    fresh.setClient(null);
  });
});

describe("request shaping", () => {
  it("lifts system messages out of the conversation", () => {
    const request = gemini.toGeminiRequest([
      { role: "system", content: "Be terse." },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
      { role: "user", content: "More" },
    ]);

    // Gemini keeps the system prompt outside the turns, and calls the
    // assistant "model".
    expect(request.systemInstruction).toBe("Be terse.");
    expect(request.contents).toEqual([
      { role: "user", parts: [{ text: "Hello" }] },
      { role: "model", parts: [{ text: "Hi" }] },
      { role: "user", parts: [{ text: "More" }] },
    ]);
  });

  it("omits systemInstruction entirely when there is none", () => {
    const request = gemini.toGeminiRequest([
      { role: "user", content: "Hello" },
    ]);
    expect(request.systemInstruction).toBeUndefined();
  });

  it("passes the key to the SDK, never inside the prompt", async () => {
    let captured: unknown;
    gemini.setClient({
      models: {
        generateContent: async (args) => {
          captured = args;
          return reply("ok");
        },
      },
    });

    await gemini.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(JSON.stringify(captured)).not.toContain("test-key-not-real");
  });
});

describe("retry policy", () => {
  it("retries a 503 and succeeds", async () => {
    let calls = 0;
    gemini.setClient({
      models: {
        generateContent: async () => {
          calls++;
          if (calls < 3) {
            throw apiError(
              503,
              "This model is currently experiencing high demand.",
            );
          }
          return reply("done");
        },
      },
    });

    const result = await gemini.complete({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.text).toBe("done");
    expect(calls).toBe(3);
  });

  it("retries a plain 429 rate limit", async () => {
    let calls = 0;
    gemini.setClient({
      models: {
        generateContent: async () => {
          calls++;
          if (calls === 1) throw apiError(429, "Too many requests, slow down.");
          return reply("recovered");
        },
      },
    });

    expect(
      (await gemini.complete({ messages: [{ role: "user", content: "hi" }] }))
        .text,
    ).toBe("recovered");
    expect(calls).toBe(2);
  });

  it("does NOT retry a quota failure, even though it is also a 429", async () => {
    // Gemini answers both "slow down" and "not on your plan" with 429. Only
    // the message separates them, and retrying the second wastes the user's
    // time for the same refusal. Verified against the live API.
    let calls = 0;
    gemini.setClient({
      models: {
        generateContent: async () => {
          calls++;
          throw apiError(
            429,
            "You exceeded your current quota, please check your plan and billing details.",
          );
        },
      },
    });

    await expect(
      gemini.complete({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toMatchObject({ kind: "quota" });

    expect(calls).toBe(1);
  });

  it("does NOT retry a bad API key", async () => {
    let calls = 0;
    gemini.setClient({
      models: {
        generateContent: async () => {
          calls++;
          throw apiError(
            400,
            "API key not valid. Please pass a valid API key.",
          );
        },
      },
    });

    await expect(
      gemini.complete({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toMatchObject({ kind: "auth" });

    expect(calls).toBe(1);
  });

  it("gives up after three attempts", async () => {
    let calls = 0;
    gemini.setClient({
      models: {
        generateContent: async () => {
          calls++;
          throw apiError(503, "busy");
        },
      },
    });

    await expect(
      gemini.complete({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toMatchObject({ kind: "server" });

    expect(calls).toBe(3);
  });
});

describe("failure mapping", () => {
  it("times out rather than hanging", async () => {
    gemini.setClient({
      models: {
        generateContent: () => new Promise(() => {}),
      },
    });

    await expect(
      gemini.complete({
        messages: [{ role: "user", content: "hi" }],
        timeoutMs: 30,
      }),
    ).rejects.toMatchObject({ kind: "timeout" });
  });

  it("rejects an empty completion rather than returning blank text", async () => {
    gemini.setClient({
      models: { generateContent: async () => ({ text: "" }) },
    });

    await expect(
      gemini.complete({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toMatchObject({ kind: "bad_response" });
  });

  it("falls back to candidate parts when text is absent", async () => {
    gemini.setClient({
      models: {
        generateContent: async () => ({
          candidates: [{ content: { parts: [{ text: "from parts" }] } }],
        }),
      },
    });

    expect(
      (await gemini.complete({ messages: [{ role: "user", content: "hi" }] }))
        .text,
    ).toBe("from parts");
  });

  it("gives every failure a message safe to show the user", () => {
    for (const kind of Object.keys(
      errors.AI_MESSAGES,
    ) as (keyof typeof errors.AI_MESSAGES)[]) {
      const message = errors.AI_MESSAGES[kind];
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toMatch(/undefined|\[object|Error:/);
    }
  });

  it("marks only transient failures as retryable", () => {
    expect(errors.aiError("rate_limited").retryable).toBe(true);
    expect(errors.aiError("timeout").retryable).toBe(true);
    expect(errors.aiError("server").retryable).toBe(true);
    expect(errors.aiError("quota").retryable).toBe(false);
    expect(errors.aiError("auth").retryable).toBe(false);
    expect(errors.aiError("not_configured").retryable).toBe(false);
    expect(errors.aiError("bad_response").retryable).toBe(false);
  });
});

describe("completeJson", () => {
  const schema = z.object({ titles: z.array(z.string()).min(1) });

  it("constrains the request with the same schema it validates against", async () => {
    let captured: Record<string, unknown> | undefined;

    gemini.setClient({
      models: {
        generateContent: async (args) => {
          captured = args.config;
          return reply('{"titles":["two-sum finally clicked"]}');
        },
      },
    });

    const { data } = await gemini.completeJson({
      messages: [{ role: "user", content: "hi" }],
      schema,
    });

    expect(data.titles).toEqual(["two-sum finally clicked"]);
    // One Zod schema drives both sides, so they cannot drift apart.
    expect(captured?.responseMimeType).toBe("application/json");
    expect(JSON.stringify(captured?.responseSchema)).toContain("titles");
  });

  it("rejects output that does not satisfy the schema", async () => {
    // Constrained decoding is not a guarantee — model output stays untrusted.
    gemini.setClient({
      models: { generateContent: async () => reply('{"titles":[]}') },
    });

    await expect(
      gemini.completeJson({
        messages: [{ role: "user", content: "hi" }],
        schema,
      }),
    ).rejects.toMatchObject({ kind: "bad_response" });
  });

  it("reports a truncated response as unreadable rather than crashing", async () => {
    gemini.setClient({
      models: { generateContent: async () => reply('{"titles":["half') },
    });

    await expect(
      gemini.completeJson({
        messages: [{ role: "user", content: "hi" }],
        schema,
      }),
    ).rejects.toMatchObject({ kind: "bad_response" });
  });
});

describe("prompt construction", () => {
  it("bounds what is sent and says so accurately", async () => {
    const { buildTitlePrompt, describeTitleContext, TITLE_CONTEXT_CHARS } =
      await import("@/lib/ai/prompts/title");

    const long = "x".repeat(5000);
    const messages = buildTitlePrompt(long);
    const userMessage = messages.find((m) => m.role === "user")?.content ?? "";

    // The whole entry must not leave the machine when an excerpt will do.
    expect(userMessage.length).toBeLessThan(TITLE_CONTEXT_CHARS + 200);
    expect(describeTitleContext(long)).toContain(
      TITLE_CONTEXT_CHARS.toLocaleString(),
    );
    expect(describeTitleContext(long)).toContain("Gemini");
  });
});

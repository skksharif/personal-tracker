import { z } from "zod";

import type { Message } from "@/lib/ai/gemini";

/**
 * Suggest a title for an entry.
 *
 * The first real AI feature, and the shape the rest follow: a small
 * task-specific prompt, a schema the response must satisfy, and an explicit
 * statement of what is sent — no shared mega-prompt, no ambient context.
 */

export const titleSuggestionSchema = z.object({
  titles: z
    .array(z.string().min(1).max(80))
    .min(1)
    .max(3)
    .describe("Between one and three candidate titles"),
});

export type TitleSuggestion = z.infer<typeof titleSuggestionSchema>;

/** Bounds what is sent. A title needs the opening, not the whole entry. */
export const TITLE_CONTEXT_CHARS = 1200;

const SYSTEM = `You suggest titles for entries in a personal journal kept by \
someone preparing for a software engineering interview.

Rules:
- Write in the author's voice, not a headline voice. This is a diary, not an article.
- Be concrete and specific to what actually happened. "Two-sum finally clicked" \
beats "A day of learning".
- Between 2 and 8 words. No trailing punctuation. No title case — sentence case.
- Never invent events, feelings, or outcomes that are not in the text.
- If the entry is too short or vague to title honestly, suggest something plain \
and factual rather than dramatic.

Respond with JSON only, in this exact shape:
{"titles": ["first suggestion", "second suggestion", "third suggestion"]}`;

export function buildTitlePrompt(body: string): Message[] {
  const excerpt = body.slice(0, TITLE_CONTEXT_CHARS);

  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Suggest up to three titles for this entry:\n\n${excerpt}`,
    },
  ];
}

/**
 * What the user is told before anything is sent.
 *
 * The privacy section of the spec requires the application to make clear when
 * content goes to the external provider. This is that statement, and it is
 * derived from the same value the prompt uses so the two cannot drift.
 */
export function describeTitleContext(body: string): string {
  const sending = Math.min(body.length, TITLE_CONTEXT_CHARS);
  const truncated = body.length > TITLE_CONTEXT_CHARS;

  return truncated
    ? `Sends the first ${sending.toLocaleString()} characters of this entry to Gemini. Nothing else.`
    : `Sends this entry (${sending.toLocaleString()} characters) to Gemini. Nothing else.`;
}

/**
 * AI failure modes, named.
 *
 * Kept free of server-only imports so a Client Component can tell a rate limit
 * from a timeout and word its message accordingly.
 *
 * Every one of these carries a message that could be shown to the user as-is:
 * an AI failure is never allowed to look like a crash, because the entry it
 * was working on is always still safe on disk.
 */

export type AiErrorKind =
  | "not_configured"
  | "auth"
  /** Slow down — transient, worth retrying. */
  | "rate_limited"
  /** Out of allowance on this plan. Retrying changes nothing. */
  | "quota"
  | "timeout"
  | "network"
  | "server"
  | "bad_response"
  | "unknown";

export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "AiError";
  }

  /** Whether trying again unchanged could plausibly succeed. */
  get retryable(): boolean {
    // `quota` is deliberately absent. Gemini answers both "too fast" and
    // "not on your plan" with a 429, and retrying the second just makes the
    // user wait three times as long for the same refusal.
    return (
      this.kind === "rate_limited" ||
      this.kind === "timeout" ||
      this.kind === "network" ||
      this.kind === "server"
    );
  }
}

/** Wording shown to the user. Quiet, specific, and never alarming. */
export const AI_MESSAGES: Record<AiErrorKind, string> = {
  not_configured:
    "AI isn't set up yet. Add your Gemini API key to .env.local to enable it.",
  auth: "Gemini rejected the API key. Check it in .env.local.",
  rate_limited: "Gemini is rate limiting right now. Try again in a moment.",
  quota:
    "This Gemini key is out of quota for that. Check your plan and billing at aistudio.google.com.",
  timeout: "That took too long. Your entry is safe — try again.",
  network: "Couldn't reach Gemini. Check your connection and try again.",
  server: "Gemini is busy right now. Try again in a moment.",
  bad_response: "Gemini replied in a form this app couldn't read. Try again.",
  unknown: "AI couldn't complete this. Your entry is safe.",
};

export function aiError(kind: AiErrorKind, detail?: string): AiError {
  return new AiError(kind, AI_MESSAGES[kind], detail);
}

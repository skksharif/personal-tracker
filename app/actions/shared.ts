import { ZodError } from "zod";

import { ValidationError } from "@/lib/storage/errors";

/**
 * The shape every form action returns.
 *
 * `useActionState` needs a serialisable result, and the UI needs to tell three
 * things apart: nothing has happened yet, it worked, it failed and here is why.
 * Field errors come back keyed by field so each input can show its own message
 * instead of a banner listing everything at once.
 */
export type ActionState =
  | { status: "idle" }
  | { status: "success"; message?: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

export const IDLE: ActionState = { status: "idle" };

/**
 * The result of an action that has actually run.
 *
 * `idle` is the initial value `useActionState` starts from, so it can never
 * come back from a call. Excluding it here means a caller checking for success
 * can read `message` on the other branch without a redundant guard.
 */
export type ActionResult = Exclude<ActionState, { status: "idle" }>;

/**
 * Turn a thrown error into something the user can act on.
 *
 * Never leaks a stack trace or a filesystem path into the UI, and never
 * discards the user's input — the caller keeps the submitted values on screen.
 */
export function toActionState(error: unknown): ActionResult {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const field = issue.path.join(".");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return {
      status: "error",
      message: "Some details need fixing.",
      fieldErrors,
    };
  }

  if (error instanceof ValidationError) {
    return { status: "error", message: error.message };
  }

  console.error(error);
  return {
    status: "error",
    message: "Couldn't save this. Your text is still on screen — try again.",
  };
}

/** Read a trimmed string from a form, or undefined when absent. */
export function field(data: FormData, name: string): string | undefined {
  const value = data.get(name);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

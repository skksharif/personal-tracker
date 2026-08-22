"use client";

import { useCallback, useState, useTransition } from "react";

import type { ActionResult } from "@/app/actions/shared";

/**
 * Submit a form to a Server Action and react to the outcome.
 *
 * Deliberately not `useActionState`: the things that should happen on success —
 * show a toast, reset the form, close the editor — are consequences of the
 * submission, and expressing them as an effect that watches the resulting state
 * both reads backwards and triggers a cascading render. Here the success path
 * is just the next line after the await.
 *
 * The form's own values are never cleared on failure. Error handling must not
 * cost the user what they typed.
 */
export function useFormAction(
  action: (formData: FormData) => Promise<ActionResult>,
  onSuccess?: (result: Extract<ActionResult, { status: "success" }>) => void,
) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = useCallback(
    (formData: FormData) => {
      startTransition(async () => {
        try {
          const outcome = await action(formData);
          setResult(outcome);
          if (outcome.status === "success") onSuccess?.(outcome);
        } catch {
          // A rejected action means the request never completed — a dev server
          // restart, a dropped connection. Say so plainly.
          setResult({
            status: "error",
            message: "Couldn't reach the server. Your text is still here.",
          });
        }
      });
    },
    [action, onSuccess],
  );

  const fieldError = useCallback(
    (name: string) =>
      result?.status === "error" ? result.fieldErrors?.[name] : undefined,
    [result],
  );

  return {
    submit,
    pending,
    error: result?.status === "error" ? result.message : null,
    fieldError,
  };
}

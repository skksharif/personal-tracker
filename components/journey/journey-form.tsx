"use client";

import { useCallback, useState } from "react";

import { rebuildIndexAction, saveJourneyAction } from "@/app/actions/journey";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useFormAction } from "@/components/ui/use-form-action";
import type { Journey } from "@/lib/storage/journey";

export function JourneyForm({ journey }: { journey: Journey }) {
  const { show } = useToast();

  const onSuccess = useCallback(() => {
    show("Journey saved", "success");
  }, [show]);

  const { submit, pending, error, fieldError } = useFormAction(
    saveJourneyAction,
    onSuccess,
  );

  return (
    <form action={submit} className="max-w-md space-y-5">
      <Field label="Journey title" error={fieldError("title")}>
        {({ id }) => (
          <Input id={id} name="title" required defaultValue={journey.title} />
        )}
      </Field>

      <Field label="Target" error={fieldError("target")}>
        {({ id }) => (
          <Input
            id={id}
            name="target"
            required
            defaultValue={journey.target}
            placeholder="Amazon SDE interview"
          />
        )}
      </Field>

      <Field label="Start date" error={fieldError("startDate")}>
        {({ id }) => (
          <Input
            id={id}
            name="startDate"
            type="date"
            required
            defaultValue={journey.startDate}
          />
        )}
      </Field>

      <Field
        label="Target date"
        hint="Optional. Used for the countdown on the home page."
        error={fieldError("targetDate")}
      >
        {({ id, describedBy }) => (
          <Input
            id={id}
            name="targetDate"
            type="date"
            defaultValue={journey.targetDate ?? ""}
            aria-describedby={describedBy}
          />
        )}
      </Field>

      <Field
        label="Current focus"
        hint="What you are working on right now."
        error={fieldError("currentFocus")}
      >
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            name="currentFocus"
            minRows={2}
            defaultValue={journey.currentFocus}
            aria-describedby={describedBy}
            placeholder="Arrays and hashing"
          />
        )}
      </Field>

      {error ? (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : "Save journey"}
      </Button>
    </form>
  );
}

/**
 * Manual index rebuild.
 *
 * The index is a cache of the entity files, so it can drift — after editing
 * something in `data/` by hand, or restoring a backup. Rebuilding reads the
 * files and rewrites the cache; no user content is touched.
 */
export function RebuildIndex() {
  const [pending, setPending] = useState(false);
  const { show } = useToast();

  const rebuild = async () => {
    setPending(true);
    const result = await rebuildIndexAction();
    setPending(false);

    show(
      result.status === "success"
        ? (result.message ?? "Index rebuilt")
        : result.message,
      result.status === "success" ? "success" : "danger",
    );
  };

  return (
    <Button onClick={rebuild} disabled={pending}>
      {pending ? "Rebuilding…" : "Rebuild index"}
    </Button>
  );
}

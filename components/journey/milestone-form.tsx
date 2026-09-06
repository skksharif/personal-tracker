"use client";

import { useCallback, useRef, useState } from "react";

import {
  createMilestoneAction,
  deleteMilestoneAction,
  updateMilestoneAction,
} from "@/app/actions/milestones";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/sheet";
import { Surface } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { useFormAction } from "@/components/ui/use-form-action";
import type { Milestone } from "@/lib/storage/milestones";

/** Adds a milestone. Collapsed until asked for — the list is the point of the page. */
export function AddMilestone({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { show } = useToast();

  const onSuccess = useCallback(() => {
    show("Milestone added", "success");
    formRef.current?.reset();
    setOpen(false);
  }, [show]);

  const { submit, pending, error, fieldError } = useFormAction(
    createMilestoneAction,
    onSuccess,
  );

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        Add milestone
      </Button>
    );
  }

  return (
    <Surface bordered className="p-5">
      <form ref={formRef} action={submit} className="space-y-4">
        <Field label="Date" error={fieldError("date")}>
          {({ id, describedBy }) => (
            <Input
              id={id}
              name="date"
              type="date"
              required
              defaultValue={today}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <Field label="What happened" error={fieldError("title")}>
          {({ id, describedBy }) => (
            <Input
              id={id}
              name="title"
              required
              maxLength={140}
              autoFocus
              placeholder="First mock interview"
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <Field
          label="Note"
          hint="Optional. Why this mattered."
          error={fieldError("note")}
        >
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              name="note"
              minRows={3}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        {error ? (
          <p role="alert" className="text-meta text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button
            loading={pending}
            type="submit"
            variant="primary"
            disabled={pending}
          >
            {pending ? "Saving…" : "Add milestone"}
          </Button>
          <Button onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </Surface>
  );
}

/** Edits or deletes an existing milestone. */
export function MilestoneActions({ milestone }: { milestone: Milestone }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { show } = useToast();

  const onSuccess = useCallback(() => {
    show("Milestone updated", "success");
    setEditing(false);
  }, [show]);

  const { submit, pending, error, fieldError } = useFormAction(
    updateMilestoneAction,
    onSuccess,
  );

  const remove = async () => {
    setDeleting(true);
    const result = await deleteMilestoneAction(milestone.id);
    setDeleting(false);
    setConfirming(false);

    show(
      result.status === "success"
        ? (result.message ?? "Deleted")
        : result.message,
      result.status === "success" ? "success" : "danger",
    );
  };

  if (editing) {
    return (
      <form action={submit} className="mt-3 space-y-4">
        <input type="hidden" name="id" value={milestone.id} />

        <Field label="Date" error={fieldError("date")}>
          {({ id }) => (
            <Input
              id={id}
              name="date"
              type="date"
              required
              defaultValue={milestone.date}
            />
          )}
        </Field>

        <Field label="What happened" error={fieldError("title")}>
          {({ id }) => (
            <Input
              id={id}
              name="title"
              required
              defaultValue={milestone.title}
            />
          )}
        </Field>

        <Field label="Note" error={fieldError("note")}>
          {({ id }) => (
            <Textarea
              id={id}
              name="note"
              minRows={3}
              defaultValue={milestone.note}
            />
          )}
        </Field>

        {error ? (
          <p role="alert" className="text-meta text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button
            loading={pending}
            type="submit"
            variant="primary"
            size="sm"
            disabled={pending}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button
            size="sm"
            onClick={() => setEditing(false)}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <>
      <div className="mt-2 flex gap-1">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
          Delete
        </Button>
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete this milestone?"
        footer={
          <>
            <Button size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              loading={deleting}
              size="sm"
              variant="danger"
              onClick={remove}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </>
        }
      >
        <strong className="text-ink">{milestone.title}</strong> will be removed
        from the journey and the timeline. This cannot be undone.
      </Dialog>
    </>
  );
}

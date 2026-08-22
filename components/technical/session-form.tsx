"use client";

import { useRef, useState } from "react";

import {
  createSessionAction,
  deleteSessionAction,
} from "@/app/actions/technical";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/sheet";
import { Surface } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { today } from "@/lib/dates";

/**
 * Records a sitting.
 *
 * Every field is optional except the date, so "ninety minutes, nothing to show
 * for it" is a complete and valid record — which is exactly the kind of day a
 * solved-problem count would erase.
 */
export function AddSession() {
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const submit = async (formData: FormData) => {
    setPending(true);

    const number = (name: string) => {
      const raw = formData.get(name);
      return raw ? Number(raw) : 0;
    };

    const result = await createSessionAction({
      date: String(formData.get("date") ?? today()),
      minutes: number("minutes"),
      attempted: number("attempted"),
      solved: number("solved"),
      topics: String(formData.get("topics") ?? "")
        .split(",")
        .map((topic) => topic.trim().toLowerCase())
        .filter(Boolean),
      notes: String(formData.get("notes") ?? "").trim(),
      reflection: String(formData.get("reflection") ?? "").trim(),
    });

    setPending(false);

    if (result.status === "success") {
      show("Session recorded", "success");
      formRef.current?.reset();
      setOpen(false);
    } else {
      show(result.message, "danger");
    }
  };

  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        Record a session
      </Button>
    );
  }

  return (
    <Surface bordered className="p-5">
      <form ref={formRef} action={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Date">
            {({ id }) => (
              <Input
                id={id}
                name="date"
                type="date"
                required
                defaultValue={today()}
              />
            )}
          </Field>
          <Field label="Minutes">
            {({ id }) => (
              <Input id={id} name="minutes" type="number" min={0} max={1440} />
            )}
          </Field>
          <Field label="Attempted">
            {({ id }) => (
              <Input id={id} name="attempted" type="number" min={0} max={200} />
            )}
          </Field>
          <Field label="Solved">
            {({ id }) => (
              <Input id={id} name="solved" type="number" min={0} max={200} />
            )}
          </Field>
        </div>

        <Field label="Topics" hint="Comma separated.">
          {({ id, describedBy }) => (
            <Input
              id={id}
              name="topics"
              aria-describedby={describedBy}
              placeholder="arrays, hashing"
            />
          )}
        </Field>

        <Field label="How it went" hint="Optional.">
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              name="reflection"
              minRows={2}
              aria-describedby={describedBy}
              placeholder="Tired, but the second one clicked."
            />
          )}
        </Field>

        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Record session"}
          </Button>
          <Button onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </Surface>
  );
}

export function DeleteSession({ id }: { id: string }) {
  const { show } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  const remove = async () => {
    setPending(true);
    const result = await deleteSessionAction(id);
    setPending(false);
    setConfirming(false);
    show(
      result.status === "success" ? "Session deleted" : result.message,
      result.status === "success" ? "success" : "danger",
    );
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Delete
      </Button>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete this session?"
        footer={
          <>
            <Button size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={remove}
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </>
        }
      >
        This sitting will be removed from the record.
      </Dialog>
    </>
  );
}

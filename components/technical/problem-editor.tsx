"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import {
  addAttemptAction,
  createProblemAction,
  deleteProblemAction,
  saveProblemAction,
} from "@/app/actions/technical";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/sheet";
import { Separator, Surface } from "@/components/ui/surface";
import { TagInput } from "@/components/ui/tag-input";
import { useToast } from "@/components/ui/toast";
import { today } from "@/lib/dates";
// Values come from `lib/technical`, never from the storage module — importing
// a runtime constant from a `server-only` file pulls it into the browser
// bundle. Only the type is taken from storage, and types are erased.
import type { Problem } from "@/lib/storage/problems";
import {
  DIFFICULTIES,
  PROBLEM_STATUSES,
  PROBLEM_STATUS_LABELS,
} from "@/lib/technical";

/** Adds a problem. Only the name is required — the rest can come later. */
export function AddProblem() {
  const router = useRouter();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const submit = async (formData: FormData) => {
    setPending(true);
    setError(null);

    const result = await createProblemAction({
      name: String(formData.get("name") ?? "").trim(),
      source: String(formData.get("source") ?? "").trim(),
      url: String(formData.get("url") ?? "").trim(),
      difficulty:
        (formData.get("difficulty") as (typeof DIFFICULTIES)[number]) ||
        undefined,
      topics: String(formData.get("topics") ?? "")
        .split(",")
        .map((topic) => topic.trim().toLowerCase())
        .filter(Boolean),
      date: today(),
    });

    setPending(false);

    if (result.status === "success" && result.id) {
      show("Problem added", "success");
      router.push(`/technical/problems/${result.id}`);
    } else {
      setError(result.status === "error" ? result.message : "Couldn't add it.");
    }
  };

  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        Add problem
      </Button>
    );
  }

  return (
    <Surface bordered className="p-5">
      <form ref={formRef} action={submit} className="space-y-4">
        <Field label="Problem">
          {({ id }) => (
            <Input
              id={id}
              name="name"
              required
              autoFocus
              placeholder="Two Sum"
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source">
            {({ id }) => <Input id={id} name="source" placeholder="LeetCode" />}
          </Field>

          <Field label="Difficulty">
            {({ id }) => (
              <Select id={id} name="difficulty" defaultValue="">
                <option value="">Not set</option>
                {DIFFICULTIES.map((level) => (
                  <option key={level} value={level}>
                    {level[0]?.toUpperCase()}
                    {level.slice(1)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Link" hint="Optional.">
          {({ id, describedBy }) => (
            <Input
              id={id}
              name="url"
              type="url"
              aria-describedby={describedBy}
              placeholder="https://leetcode.com/problems/two-sum/"
            />
          )}
        </Field>

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
            {pending ? "Adding…" : "Add problem"}
          </Button>
          <Button onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </Surface>
  );
}

/**
 * The learning record.
 *
 * Five plain textareas following the spec's structure. Each saves on blur
 * rather than behind a submit button, so writing a thought and moving on is
 * the whole interaction — no form to complete, nothing to lose by leaving.
 */
export function ProblemRecord({ problem }: { problem: Problem }) {
  const { show } = useToast();
  const [saving, setSaving] = useState<string | null>(null);

  const saveField = useCallback(
    async (field: keyof Problem, value: string) => {
      setSaving(field);
      const result = await saveProblemAction(problem.id, { [field]: value });
      setSaving(null);
      if (result.status === "error") show(result.message, "danger");
    },
    [problem.id, show],
  );

  const sections: {
    field: "struggle" | "breakthrough" | "understanding" | "reflection";
    label: string;
    hint: string;
  }[] = [
    {
      field: "struggle",
      label: "What went wrong",
      hint: "Where you got stuck, and what you kept reaching for.",
    },
    {
      field: "breakthrough",
      label: "What made it click",
      hint: "The moment it became understandable.",
    },
    {
      field: "understanding",
      label: "Final understanding",
      hint: "The approach in your own words.",
    },
    {
      field: "reflection",
      label: "Why it mattered",
      hint: "Optional. What this one taught you.",
    },
  ];

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <Field
          key={section.field}
          label={section.label}
          hint={saving === section.field ? "Saving…" : section.hint}
        >
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              minRows={3}
              defaultValue={problem[section.field]}
              onBlur={(event) => {
                if (event.target.value !== problem[section.field]) {
                  void saveField(section.field, event.target.value);
                }
              }}
            />
          )}
        </Field>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Time complexity">
          {({ id }) => (
            <Input
              id={id}
              defaultValue={problem.timeComplexity}
              placeholder="O(n)"
              onBlur={(event) => {
                if (event.target.value !== problem.timeComplexity) {
                  void saveField("timeComplexity", event.target.value);
                }
              }}
            />
          )}
        </Field>

        <Field label="Space complexity">
          {({ id }) => (
            <Input
              id={id}
              defaultValue={problem.spaceComplexity}
              placeholder="O(n)"
              onBlur={(event) => {
                if (event.target.value !== problem.spaceComplexity) {
                  void saveField("spaceComplexity", event.target.value);
                }
              }}
            />
          )}
        </Field>
      </div>
    </div>
  );
}

/** Records another go at a problem, and moves its status to match. */
export function AddAttempt({ problem }: { problem: Problem }) {
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const submit = async (formData: FormData) => {
    setPending(true);

    const result = await addAttemptAction(problem.id, {
      date: String(formData.get("date") ?? today()),
      approach: String(formData.get("approach") ?? "").trim(),
      result: formData.get("result") as "solved" | "partial" | "stuck",
      ...(formData.get("minutes")
        ? { minutes: Number(formData.get("minutes")) }
        : {}),
    });

    setPending(false);

    if (result.status === "success") {
      show("Attempt recorded", "success");
      formRef.current?.reset();
      setOpen(false);
    } else {
      show(result.message, "danger");
    }
  };

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Record an attempt
      </Button>
    );
  }

  return (
    <Surface bordered className="p-4">
      <form ref={formRef} action={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date">
            {({ id }) => (
              <Input id={id} name="date" type="date" defaultValue={today()} />
            )}
          </Field>

          <Field label="Result">
            {({ id }) => (
              <Select id={id} name="result" defaultValue="partial">
                <option value="solved">Solved</option>
                <option value="partial">Partly</option>
                <option value="stuck">Stuck</option>
              </Select>
            )}
          </Field>

          <Field label="Minutes">
            {({ id }) => (
              <Input id={id} name="minutes" type="number" min={0} max={1440} />
            )}
          </Field>
        </div>

        <Field label="Approach" hint="What you tried this time.">
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              name="approach"
              minRows={2}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <div className="flex gap-2">
          <Button
            loading={pending}
            type="submit"
            variant="primary"
            size="sm"
            disabled={pending}
          >
            {pending ? "Saving…" : "Record attempt"}
          </Button>
          <Button size="sm" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </Surface>
  );
}

/** Status, topics and tags — the metadata row above the record. */
export function ProblemMeta({ problem }: { problem: Problem }) {
  const { show } = useToast();
  const [topics, setTopics] = useState(problem.topics);

  const save = async (patch: Parameters<typeof saveProblemAction>[1]) => {
    const result = await saveProblemAction(problem.id, patch);
    if (result.status === "error") show(result.message, "danger");
  };

  return (
    <div className="grid max-w-md gap-4">
      <Field label="Status">
        {({ id }) => (
          <Select
            id={id}
            defaultValue={problem.status}
            onChange={(event) =>
              void save({
                status: event.target.value as Problem["status"],
              })
            }
          >
            {PROBLEM_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PROBLEM_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Topics" hint="Counts on the DSA page come from these.">
        {({ id, describedBy }) => (
          <div id={id} aria-describedby={describedBy}>
            <TagInput
              value={topics}
              onChange={(next) => {
                setTopics(next);
                void save({ topics: next });
              }}
              placeholder="Add a topic"
            />
          </div>
        )}
      </Field>
    </div>
  );
}

export function DeleteProblem({ problem }: { problem: Problem }) {
  const router = useRouter();
  const { show } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  const remove = async () => {
    setPending(true);
    const result = await deleteProblemAction(problem.id);
    setPending(false);
    setConfirming(false);

    if (result.status === "success") {
      show("Problem deleted", "success");
      router.push("/technical/problems");
    } else {
      show(result.message, "danger");
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Delete
      </Button>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete this problem?"
        footer={
          <>
            <Button size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              loading={pending}
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
        <strong className="text-ink">{problem.name}</strong> and everything you
        wrote about it will be removed. This cannot be undone.
      </Dialog>
    </>
  );
}

export { Separator };

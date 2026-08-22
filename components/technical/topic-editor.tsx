"use client";

import { useCallback, useRef, useState } from "react";

import { saveTopicAction } from "@/app/actions/technical";
import { Field, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  TOPIC_STATUSES,
  TOPIC_STATUS_LABELS,
  type TopicStatus,
} from "@/lib/technical";

/**
 * The only editable part of a topic: how you'd describe where you are with it,
 * and your notes. Everything numeric on the page is derived from problems.
 */
export function TopicEditor({
  id,
  name,
  status,
  notes,
}: {
  id: string;
  name: string;
  status: TopicStatus;
  notes: string;
}) {
  const { show } = useToast();
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (patch: { status?: TopicStatus; notes?: string }) => {
      setSaving(true);
      const result = await saveTopicAction(id, { name, ...patch });
      setSaving(false);
      if (result.status === "error") show(result.message, "danger");
    },
    [id, name, show],
  );

  return (
    <div className="max-w-md space-y-5">
      <Field label="Where you are">
        {({ id: fieldId }) => (
          <Select
            id={fieldId}
            defaultValue={status}
            onChange={(event) =>
              void save({ status: event.target.value as TopicStatus })
            }
          >
            {TOPIC_STATUSES.map((value) => (
              <option key={value} value={value}>
                {TOPIC_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        label="Notes"
        hint={saving ? "Saving…" : "Patterns, pitfalls, the thing you forget."}
      >
        {({ id: fieldId, describedBy }) => (
          <Textarea
            id={fieldId}
            aria-describedby={describedBy}
            minRows={5}
            defaultValue={notes}
            onChange={(event) => {
              const value = event.target.value;
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(
                () => void save({ notes: value }),
                800,
              );
            }}
          />
        )}
      </Field>
    </div>
  );
}

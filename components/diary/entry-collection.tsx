"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createEntryAction, deleteEntryAction } from "@/app/actions/entries";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { today } from "@/lib/dates";
import type { WrittenEntryType } from "@/lib/storage/entries";

/**
 * Start a new reflection, experience or letter.
 *
 * Creates an empty entry and opens it straight away, so the first thing the
 * user meets is a cursor rather than a "new item" form asking for a title
 * before they know what they want to say.
 */
export function NewEntryButton({
  type,
  label,
}: {
  type: WrittenEntryType;
  label: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, setPending] = useState(false);

  const create = async () => {
    setPending(true);
    const result = await createEntryAction(type, { date: today() });
    setPending(false);

    if (result.status === "success" && result.id) {
      router.push(`/diary/${collectionPath(type)}/${result.id}`);
    } else {
      show(
        result.status === "error" ? result.message : "Couldn't create that.",
        "danger",
      );
    }
  };

  return (
    <Button variant="primary" size="sm" onClick={create} disabled={pending}>
      {pending ? "Opening…" : label}
    </Button>
  );
}

export function DeleteEntryButton({
  type,
  id,
  title,
}: {
  type: WrittenEntryType;
  id: string;
  title: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  const remove = async () => {
    setPending(true);
    const result = await deleteEntryAction(type, id);
    setPending(false);
    setConfirming(false);

    if (result.status === "success") {
      show("Entry deleted", "success");
      router.push(`/diary/${collectionPath(type)}`);
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
        title="Delete this entry?"
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
        <strong className="text-ink">{title || "This entry"}</strong> and
        everything written in it will be removed from disk. This cannot be
        undone.
      </Dialog>
    </>
  );
}

function collectionPath(type: WrittenEntryType): string {
  return type === "reflection"
    ? "reflections"
    : type === "experience"
      ? "experiences"
      : "future";
}

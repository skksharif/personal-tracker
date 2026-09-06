"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteTopicAction } from "@/app/actions/technical";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";

/**
 * Clear a topic's record.
 *
 * The honest label here is not "Delete topic". A topic file holds only the
 * status and the notes; the topic itself exists for as long as a problem
 * carries it, and it will come straight back with an empty status. Calling
 * this Delete and then watching the row reappear would look like a bug, so
 * the button says what it does.
 */
export function DeleteTopic({
  id,
  name,
  problemCount,
  /** Nothing is stored yet — there is no record to clear. */
  implicit,
}: {
  id: string;
  name: string;
  problemCount: number;
  implicit: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  if (implicit) return null;

  const remove = async () => {
    setPending(true);
    const result = await deleteTopicAction(id);
    setPending(false);
    setConfirming(false);

    if (result.status === "success") {
      show(result.message ?? "Cleared", "success");
      router.push("/technical/dsa");
    } else {
      show(result.message, "danger");
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-ink-muted hover:text-danger"
        onClick={() => setConfirming(true)}
      >
        Clear notes
      </Button>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Clear "${name.replace(/-/g, " ")}"?`}
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
              {pending ? "Clearing…" : "Clear it"}
            </Button>
          </>
        }
      >
        Your notes and the status you set are deleted. This cannot be undone.
        {problemCount > 0 ? (
          <>
            {" "}
            The{" "}
            <strong className="text-ink">
              {problemCount} {problemCount === 1 ? "problem" : "problems"}
            </strong>{" "}
            filed under this topic {problemCount === 1 ? "is" : "are"}{" "}
            <strong className="text-ink">not</strong> touched, so the topic
            itself stays in the list — with nothing written about it.
          </>
        ) : null}
      </Dialog>
    </>
  );
}

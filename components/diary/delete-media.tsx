"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteMediaAction } from "@/app/actions/entries";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import type { WrittenEntryType } from "@/lib/storage/entries";

/**
 * Remove one image from the entry that holds it.
 *
 * Deleting an image is three removals that have to happen together — the
 * record, the markdown that displayed it, and the file — so the confirmation
 * says all three rather than the vague "this cannot be undone". The entry's
 * words are not touched, and it says that too, because "delete" next to a
 * picture inside a diary is exactly the kind of button people hesitate over.
 */
export function DeleteMediaButton({
  type,
  entryId,
  entryTitle,
  mediaPath,
  alt,
}: {
  type: WrittenEntryType;
  entryId: string;
  entryTitle: string;
  mediaPath: string;
  alt?: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  const remove = async () => {
    setPending(true);
    const result = await deleteMediaAction(type, entryId, mediaPath);
    setPending(false);
    setConfirming(false);

    if (result.status === "success") {
      show(result.message ?? "Image removed", "success");
      router.refresh();
    } else {
      show(result.message, "danger");
    }
  };

  return (
    <>
      <IconButton
        label={alt ? `Delete image: ${alt}` : "Delete this image"}
        onClick={() => setConfirming(true)}
        className="text-ink-muted hover:text-danger"
      >
        <TrashIcon />
      </IconButton>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete this image?"
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
        The image is removed from{" "}
        <strong className="text-ink">{entryTitle || "the entry"}</strong>, along
        with the line that displayed it, and the file is deleted from disk.
        Everything else you wrote in that entry stays exactly as it is.
      </Dialog>
    </>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 4h11M6 4V2.5h4V4M12.5 4l-.6 8.6a1 1 0 0 1-1 .9H5.1a1 1 0 0 1-1-.9L3.5 4M6.5 6.5v5M9.5 6.5v5" />
    </svg>
  );
}

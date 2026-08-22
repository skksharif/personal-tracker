"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteTagAction, renameTagAction } from "@/app/actions/organise";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Dialog } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { ENTRY_TYPES, type EntryType } from "@/lib/types";

export interface TagSummaryView {
  tag: string;
  count: number;
  types: EntryType[];
  lastUsed: string;
}

/**
 * The tag index, with maintenance.
 *
 * Renaming is the operation this page exists for: tags accumulate as `dp`,
 * `dynamic-programming` and `dyn-prog`, and only a merge fixes that. Renaming
 * onto an existing tag merges deliberately — the confirmation says so, because
 * a merge cannot be undone by renaming back.
 */
export function TagList({ tags }: { tags: TagSummaryView[] }) {
  const [editing, setEditing] = useState<TagSummaryView | null>(null);
  const [removing, setRemoving] = useState<TagSummaryView | null>(null);

  return (
    <>
      <ul>
        {tags.map((summary, position) => (
          <li key={summary.tag}>
            {position > 0 ? <hr className="border-line border-t" /> : null}

            <div className="flex items-center gap-3 py-2.5">
              <Link
                href={`/tags/${encodeURIComponent(summary.tag)}`}
                className="group min-w-0 flex-1"
              >
                <span className="text-ink group-hover:text-accent truncate font-medium transition-colors">
                  {summary.tag}
                </span>
                <span className="text-meta text-ink-faint ml-2 tabular-nums">
                  {summary.count}
                </span>
                <span className="text-meta text-ink-muted mt-0.5 block truncate">
                  {summary.types
                    .map((type) => ENTRY_TYPES[type].plural)
                    .join(" · ")}
                </span>
              </Link>

              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(summary)}
                >
                  Rename
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-ink-muted hover:text-danger"
                  onClick={() => setRemoving(summary)}
                >
                  Remove
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/*
        Keyed on the tag so each dialog starts from the right values without an
        effect copying props into state.
      */}
      {editing ? (
        <RenameDialog
          key={editing.tag}
          target={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {removing ? (
        <RemoveDialog
          key={removing.tag}
          target={removing}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </>
  );
}

function RenameDialog({
  target,
  onClose,
}: {
  target: TagSummaryView;
  onClose: () => void;
}) {
  const [value, setValue] = useState(target.tag);
  const [pending, startTransition] = useTransition();
  const { show } = useToast();
  const router = useRouter();

  // Normalised the same way TagInput normalises, so what the dialog previews
  // is what actually lands on the entries.
  const normalised = value.trim().toLowerCase().replace(/\s+/g, "-");
  const unchanged = normalised === target.tag || normalised.length === 0;

  const submit = () => {
    startTransition(async () => {
      const result = await renameTagAction(target.tag, normalised);
      show(
        result.message ?? "",
        result.status === "error" ? "danger" : "success",
      );
      if (result.status === "success") {
        router.refresh();
        onClose();
      }
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Rename ${target.tag}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={pending || unchanged}
          >
            {pending ? "Renaming…" : "Rename"}
          </Button>
        </>
      }
    >
      <Input
        value={value}
        autoFocus
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !unchanged) submit();
        }}
        aria-label="New tag name"
      />

      <p className="mt-3">
        This rewrites the tag on{" "}
        <span className="text-ink tabular-nums">{target.count}</span>{" "}
        {target.count === 1 ? "entry" : "entries"}. Renaming onto a tag that
        already exists merges the two, which renaming back will not separate.
      </p>
    </Dialog>
  );
}

function RemoveDialog({
  target,
  onClose,
}: {
  target: TagSummaryView;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const { show } = useToast();
  const router = useRouter();

  const submit = () => {
    startTransition(async () => {
      const result = await deleteTagAction(target.tag);
      show(
        result.message ?? "",
        result.status === "error" ? "danger" : "success",
      );
      if (result.status === "success") {
        router.refresh();
        onClose();
      }
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Remove ${target.tag}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} disabled={pending}>
            {pending ? "Removing…" : "Remove tag"}
          </Button>
        </>
      }
    >
      <p>
        The tag comes off{" "}
        <span className="text-ink tabular-nums">{target.count}</span>{" "}
        {target.count === 1 ? "entry" : "entries"}.{" "}
        <span className="text-ink">Nothing you wrote is deleted</span> — only
        the label.
      </p>
    </Dialog>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  createNoteAction,
  deleteNoteAction,
  saveNoteAction,
} from "@/app/actions/technical";
import { DiagramAssist } from "@/components/ai/diagram-assist";
import { RenderedMarkdown } from "@/components/markdown/rendered-markdown";
import { Button } from "@/components/ui/button";
import { BareInput, BareTextarea, Field, Select } from "@/components/ui/field";
import { Dialog } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/surface";
import { TagInput } from "@/components/ui/tag-input";
import { useCaretInsert } from "@/components/ui/use-caret-insert";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { Note } from "@/lib/storage/notes";
import {
  NOTE_LABELS,
  NOTE_PATHS,
  SUBJECTS,
  type NoteKind,
} from "@/lib/technical";

/**
 * Editor for learning notes, CS fundamentals and system design records.
 *
 * Shares the diary's contract — debounced autosave, a visible save state, no
 * submit button — because the writing experience should not change depending
 * on which part of the journal you are in.
 *
 * It deliberately does *not* share the diary's `localStorage` mirror. That net
 * exists because a diary entry is often the only record of a day and cannot be
 * reconstructed; a technical note is usually being copied from something the
 * user still has in front of them.
 */
export function NoteEditor({
  kind,
  note,
  aiConfigured = false,
}: {
  kind: NoteKind;
  note: Note;
  /** Whether a Gemini key is present. Resolved on the server. */
  aiConfigured?: boolean;
}) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [tags, setTags] = useState(note.tags);
  const [subject, setSubject] = useState(note.subject ?? "");
  const [status, setStatus] = useState<"idle" | "dirty" | "saving" | "saved">(
    "idle",
  );
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const {
    ref: bodyRef,
    selection,
    trackSelection,
    insert,
  } = useCaretInsert(body);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ title, body, tags, subject });

  const save = useCallback(async () => {
    const snapshot = latest.current;
    setStatus("saving");

    const result = await saveNoteAction(kind, note.id, {
      title: snapshot.title,
      body: snapshot.body,
      tags: snapshot.tags,
      ...(kind === "fundamentals" ? { subject: snapshot.subject } : {}),
    });

    if (result.status === "success") {
      setStatus("saved");
      setSavedAt(result.savedAt ?? new Date().toISOString());
    } else {
      setStatus("idle");
    }
  }, [kind, note.id]);

  const update = useCallback(
    (patch: Partial<typeof latest.current>) => {
      latest.current = { ...latest.current, ...patch };
      setStatus("dirty");

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void save();
      }, 800);
    },
    [save],
  );

  // Commit a pending edit rather than discarding it when leaving the page.
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void save();
      }
    };
  }, [save]);

  const label =
    status === "saving"
      ? "Saving…"
      : status === "dirty"
        ? "Unsaved"
        : savedAt
          ? `Saved ${new Date(savedAt).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : "";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-meta text-ink-muted">{note.date}</p>
        <span
          aria-live="polite"
          className={cn(
            "text-meta",
            status === "dirty" ? "text-ink-faint" : "text-ink-muted",
          )}
        >
          {label}
        </span>
      </div>

      <BareInput
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          update({ title: event.target.value });
        }}
        placeholder={NOTE_LABELS[kind].defaultTitle}
        aria-label="Title"
        className="mt-3"
      />

      {preview ? (
        <div className="mt-6">
          <RenderedMarkdown body={body} />
        </div>
      ) : (
        <BareTextarea
          ref={bodyRef}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            update({ body: event.target.value });
          }}
          onSelect={trackSelection}
          placeholder={
            kind === "design"
              ? "Work through the design. ```mermaid blocks become diagrams."
              : "Explain it in your own words. Code fences are highlighted."
          }
          aria-label="Note"
          minRows={14}
          className="text-body mt-6 font-sans"
        />
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {/*
          A system design record is the place this earns its keep: the shape of
          a system is the part that is hardest to write down in prose.
        */}
        <DiagramAssist
          configured={aiConfigured}
          selection={selection}
          disabled={preview}
          onInsert={(block) => {
            insert(block, (next) => {
              setBody(next);
              update({ body: next });
            });
          }}
        />

        {body.trim() ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPreview((on) => !on)}
            aria-pressed={preview}
          >
            {preview ? "Keep writing" : "Preview"}
          </Button>
        ) : null}
      </div>

      <Separator className="mt-4 mb-6" />

      <div className="max-w-md space-y-5">
        {kind === "fundamentals" ? (
          <Field label="Subject">
            {({ id }) => (
              <Select
                id={id}
                value={subject}
                onChange={(event) => {
                  setSubject(event.target.value);
                  update({ subject: event.target.value });
                }}
              >
                <option value="">Not set</option>
                {SUBJECTS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}

        <Field label="Tags">
          {({ id }) => (
            <div id={id}>
              <TagInput
                value={tags}
                onChange={(next) => {
                  setTags(next);
                  update({ tags: next });
                }}
              />
            </div>
          )}
        </Field>
      </div>
    </div>
  );
}

/** Creates an empty record and opens it, so the first thing seen is a cursor. */
export function NewNoteButton({
  kind,
  label,
}: {
  kind: NoteKind;
  label: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, setPending] = useState(false);

  const create = async () => {
    setPending(true);
    const result = await createNoteAction(kind);
    setPending(false);

    if (result.status === "success" && result.id) {
      router.push(`${NOTE_PATHS[kind]}/${result.id}`);
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

export function DeleteNoteButton({
  kind,
  id,
  title,
}: {
  kind: NoteKind;
  id: string;
  title: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  const remove = async () => {
    setPending(true);
    const result = await deleteNoteAction(kind, id);
    setPending(false);
    setConfirming(false);

    if (result.status === "success") {
      show("Deleted", "success");
      router.push(NOTE_PATHS[kind]);
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
        title="Delete this?"
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
        <strong className="text-ink">
          {title || NOTE_LABELS[kind].defaultTitle}
        </strong>{" "}
        will be removed from disk. This cannot be undone.
      </Dialog>
    </>
  );
}

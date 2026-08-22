"use client";

import { useState } from "react";

import { DiagramAssist } from "@/components/ai/diagram-assist";
import { EntryBody } from "@/components/diary/entry-body";
import { MediaPicker } from "@/components/diary/media-picker";
import {
  ExtractLearning,
  ImproveWriting,
  ReflectOnEntry,
  SuggestTags,
  SuggestTitle,
  SummariseEntry,
} from "@/components/diary/ai-assists";
import { useEntryEditor } from "@/components/diary/use-entry-editor";
import type {
  EditorValue,
  SaveStatus,
} from "@/components/diary/use-entry-editor";
import { Button } from "@/components/ui/button";
import {
  BareInput,
  BareTextarea,
  Field,
  Input,
  Select,
} from "@/components/ui/field";
import { RelationPicker } from "@/components/ui/relation-picker";
import { Separator } from "@/components/ui/surface";
import { TagInput } from "@/components/ui/tag-input";
import { useCaretInsert } from "@/components/ui/use-caret-insert";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/dates";
import type { Media, WrittenEntryType } from "@/lib/storage/entries";
import type { IndexRecord } from "@/lib/storage/index-store";
import { MOODS, type Mood } from "@/lib/types";

/**
 * The writing surface.
 *
 * UX rule 4: this must not feel like a database form. The title and body have
 * no borders and no background — the page *is* the field — and every piece of
 * metadata lives behind a collapsed row so the first thing the cursor meets is
 * an empty page.
 */
export function EntryEditor({
  type,
  id,
  date,
  initial,
  placeholder = "What happened today?",
  showOpenOn = false,
  aiConfigured = false,
  linkedProblems = [],
  linkedNotes = [],
}: {
  type: WrittenEntryType;
  id: string;
  date: string;
  initial: EditorValue;
  placeholder?: string;
  /** Letters: offer a date before which the entry stays sealed. */
  showOpenOn?: boolean;
  /** Whether a Gemini key is present. Resolved on the server. */
  aiConfigured?: boolean;
  /** Linked records, resolved server-side so opening costs no round trip. */
  linkedProblems?: IndexRecord[];
  linkedNotes?: IndexRecord[];
}) {
  const {
    value,
    update,
    saveNow,
    status,
    savedAt,
    recovered,
    restoreDraft,
    discardDraft,
  } = useEntryEditor({ type, id, date, initial });

  const [showDetails, setShowDetails] = useState(
    Boolean(initial.mood || initial.category || initial.tags.length),
  );
  const [preview, setPreview] = useState(false);

  const {
    ref: bodyRef,
    selection,
    trackSelection,
    insert,
  } = useCaretInsert(value.body);

  /**
   * Place an image where the caret is, so text can flow around it — the
   * "text → image → text" shape the spec asks for.
   */
  const insertMedia = (media: Media) => {
    insert(`![${media.alt}](${media.path})`, (body) =>
      update({ body, media: [...value.media, media] }),
    );
  };

  return (
    <div>
      {recovered ? (
        <RecoveredDraftBanner
          at={recovered.at}
          onRestore={restoreDraft}
          onDiscard={discardDraft}
        />
      ) : null}

      <div className="flex items-baseline justify-between gap-4">
        <p className="text-meta text-ink-muted">{formatDay(date)}</p>
        <SaveIndicator status={status} savedAt={savedAt} onRetry={saveNow} />
      </div>

      {/*
        The AI control sits with the field it affects. Design spec section 20:
        assistance appears next to the input, not behind a global button.
      */}
      <div className="mt-3 flex items-start gap-3">
        <BareInput
          value={value.title}
          onChange={(event) => update({ title: event.target.value })}
          placeholder="Untitled"
          aria-label="Title"
        />
        <div className="shrink-0 pt-1.5">
          <SuggestTitle
            body={value.body}
            configured={aiConfigured}
            onAccept={(title) => update({ title })}
          />
        </div>
      </div>

      {preview ? (
        <div className="mt-6">
          <EntryBody body={value.body} />
        </div>
      ) : (
        <BareTextarea
          ref={bodyRef}
          value={value.body}
          onChange={(event) => update({ body: event.target.value })}
          onSelect={trackSelection}
          placeholder={placeholder}
          aria-label="Entry"
          minRows={12}
          className="text-body mt-6"
        />
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <MediaPicker onInsert={insertMedia} disabled={preview} />

        {/*
          A diagram is written into the body as Mermaid source, so it belongs
          with the image control rather than with the assists below, which
          only read what is already there.
        */}
        <DiagramAssist
          configured={aiConfigured}
          selection={selection}
          disabled={preview}
          onInsert={(block) => insert(block, (body) => update({ body }))}
        />

        {/*
          Writing is the default; preview is where images and formatting show
          as they will read. Only offered once there is something to show.
        */}
        {value.body.trim() ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPreview((on) => !on)}
            aria-pressed={preview}
          >
            {preview ? "Keep writing" : "Preview"}
          </Button>
        ) : null}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowDetails((open) => !open)}
          aria-expanded={showDetails}
        >
          {showDetails ? "Hide details" : "Details"}
        </Button>
      </div>

      {/*
        AI assists for the body, kept together under the writing rather than
        floating over it. Each is optional and none of them is the primary
        action — that is still writing.
      */}
      {aiConfigured && value.body.trim() ? (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <ReflectOnEntry
            type={type}
            id={id}
            date={date}
            title={value.title}
            body={value.body}
            configured={aiConfigured}
          />
          <ImproveWriting
            body={value.body}
            configured={aiConfigured}
            onAccept={(text) => update({ body: text })}
          />
          <SummariseEntry body={value.body} configured={aiConfigured} />
          <ExtractLearning body={value.body} configured={aiConfigured} />
        </div>
      ) : null}

      {showDetails ? (
        <>
          <Separator className="mt-4 mb-6" />

          <div className="max-w-md space-y-5">
            <Field label="Mood" hint="How the day felt. Optional.">
              {({ id: fieldId, describedBy }) => (
                <Select
                  id={fieldId}
                  aria-describedby={describedBy}
                  value={value.mood ?? ""}
                  onChange={(event) =>
                    update({
                      mood: (event.target.value || undefined) as
                        Mood | undefined,
                    })
                  }
                >
                  <option value="">Not recorded</option>
                  {MOODS.map((mood) => (
                    <option key={mood} value={mood}>
                      {mood.charAt(0).toUpperCase() + mood.slice(1)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              label="Tags"
              action={
                <SuggestTags
                  body={value.body}
                  existing={value.tags}
                  configured={aiConfigured}
                  onAccept={(tags) => update({ tags })}
                />
              }
            >
              {({ id: fieldId }) => (
                <TagInput
                  id={fieldId}
                  value={value.tags}
                  onChange={(tags) => update({ tags })}
                />
              )}
            </Field>

            {/*
              Linking here is what lets a problem page later show the days it
              was written about — the forward link is easy, the way back is
              what makes the journal feel joined up months later.
            */}
            <Field
              label="Related problems"
              hint="They'll show this entry in return."
            >
              {({ id: fieldId }) => (
                <div id={fieldId}>
                  <RelationPicker
                    value={value.relatedProblems}
                    onChange={(ids) => update({ relatedProblems: ids })}
                    initialLinked={linkedProblems}
                    types={["problem"]}
                    placeholder="Search problems…"
                  />
                </div>
              )}
            </Field>

            <Field label="Related notes">
              {({ id: fieldId }) => (
                <div id={fieldId}>
                  <RelationPicker
                    value={value.relatedNotes}
                    onChange={(ids) => update({ relatedNotes: ids })}
                    initialLinked={linkedNotes}
                    types={["note", "design"]}
                    placeholder="Search notes and designs…"
                  />
                </div>
              )}
            </Field>

            {showOpenOn ? (
              <Field
                label="Open on"
                hint="Until this date the letter stays sealed — hidden from the timeline and from AI."
              >
                {({ id: fieldId, describedBy }) => (
                  <Input
                    id={fieldId}
                    type="date"
                    aria-describedby={describedBy}
                    value={value.openOn ?? ""}
                    onChange={(event) =>
                      update({ openOn: event.target.value || undefined })
                    }
                  />
                )}
              </Field>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Save state, stated plainly.
 *
 * Autosave that gives no feedback asks the user to trust something invisible.
 * A quiet line that says exactly when the last write landed is what makes it
 * safe to close the tab.
 */
function SaveIndicator({
  status,
  savedAt,
  onRetry,
}: {
  status: SaveStatus;
  savedAt: string | null;
  onRetry: () => void;
}) {
  if (status === "error") {
    return (
      <span className="text-meta text-danger flex items-center gap-2">
        Couldn&rsquo;t save
        <button
          type="button"
          onClick={onRetry}
          className="underline underline-offset-2"
        >
          Retry
        </button>
      </span>
    );
  }

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
    <span
      aria-live="polite"
      className={cn(
        "text-meta transition-colors",
        status === "dirty" ? "text-ink-faint" : "text-ink-muted",
      )}
    >
      {label}
    </span>
  );
}

function RecoveredDraftBanner({
  at,
  onRestore,
  onDiscard,
}: {
  at: number;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      role="alert"
      className="border-warning/40 bg-warning-soft mb-6 rounded-md border p-4"
    >
      <p className="text-small text-ink">
        There are unsaved changes from{" "}
        {new Date(at).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
        , newer than what was saved.
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="primary" onClick={onRestore}>
          Restore them
        </Button>
        <Button size="sm" onClick={onDiscard}>
          Keep the saved version
        </Button>
      </div>
    </div>
  );
}

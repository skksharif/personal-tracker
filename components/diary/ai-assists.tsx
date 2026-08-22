"use client";

import { useState } from "react";

import {
  extractLearningAction,
  improveWritingAction,
  reflectOnEntryAction,
  saveReflectionAction,
  suggestTagsAction,
  suggestTitleAction,
  summariseAction,
} from "@/app/actions/ai";
import { AiField, AiList, AiPanel } from "@/components/ai/ai-panel";
import { Button } from "@/components/ui/button";
import { describeTitleContext } from "@/lib/ai/prompts/title";
import type { Reflection } from "@/lib/ai/schema";
import type { WrittenEntryType } from "@/lib/storage/entries";

/**
 * The AI controls inside the editor.
 *
 * Each sits next to the thing it affects rather than behind one global button
 * — design spec section 20 — and every one of them goes through `AiPanel`, so
 * the accept/ignore contract is identical across all of them.
 */

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 2l1.2 3.3L12.5 6.5l-3.3 1.2L8 11 6.8 7.7 3.5 6.5l3.3-1.2z" />
    </svg>
  );
}

/** A short excerpt disclosure, for assists that send only the entry. */
function entryDisclosure(body: string, limit: number): string {
  return body.length > limit
    ? `Sends the first ${limit.toLocaleString()} characters of this entry to Gemini. Nothing else.`
    : `Sends this entry (${body.length.toLocaleString()} characters) to Gemini. Nothing else.`;
}

/* -------------------------------------------------------------------------- */
/* Title                                                                      */
/* -------------------------------------------------------------------------- */

export function SuggestTitle({
  body,
  onAccept,
  configured,
}: {
  body: string;
  onAccept: (title: string) => void;
  configured: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);

  if (!configured) return null;

  return (
    <>
      <Button
        size="sm"
        variant="ai"
        icon={<SparkIcon />}
        onClick={() => setOpen(true)}
        disabled={!body.trim()}
        title={body.trim() ? undefined : "Write something first"}
      >
        Suggest
      </Button>

      <AiPanel<string[]>
        open={open}
        onClose={() => setOpen(false)}
        title="Suggest a title"
        disclosure={describeTitleContext(body)}
        runLabel="Suggest titles"
        pendingLabel="Reading what you wrote…"
        acceptLabel="Use this title"
        run={() => suggestTitleAction(body)}
        onAccept={() => {
          if (chosen) onAccept(chosen);
        }}
      >
        {(titles) => (
          <ul className="space-y-2">
            {titles.map((title) => (
              <li key={title}>
                <button
                  type="button"
                  onClick={() => setChosen(title)}
                  aria-pressed={chosen === title}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${
                    chosen === title
                      ? "border-accent bg-accent-soft"
                      : "border-line hover:border-accent hover:bg-accent-soft"
                  }`}
                >
                  <span className="text-ink">{title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </AiPanel>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Tags                                                                       */
/* -------------------------------------------------------------------------- */

export function SuggestTags({
  body,
  existing,
  onAccept,
  configured,
}: {
  body: string;
  existing: string[];
  onAccept: (tags: string[]) => void;
  configured: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  if (!configured) return null;

  const toggle = (tag: string) =>
    setPicked((current) =>
      current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag],
    );

  return (
    <>
      <Button
        size="sm"
        variant="ai"
        icon={<SparkIcon />}
        onClick={() => {
          setPicked([]);
          setOpen(true);
        }}
        disabled={!body.trim()}
      >
        Suggest
      </Button>

      <AiPanel<string[]>
        open={open}
        onClose={() => setOpen(false)}
        title="Suggest tags"
        disclosure={entryDisclosure(body, 4_000)}
        runLabel="Suggest tags"
        acceptLabel={picked.length ? `Add ${picked.length}` : "Add"}
        run={() => suggestTagsAction(body)}
        onAccept={() => {
          const merged = [...new Set([...existing, ...picked])];
          onAccept(merged);
        }}
      >
        {(tags) => (
          <>
            <p className="text-meta text-ink-muted mb-3">
              Choose the ones worth keeping.
            </p>
            <ul className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const already = existing.includes(tag);
                return (
                  <li key={tag}>
                    <button
                      type="button"
                      disabled={already}
                      onClick={() => toggle(tag)}
                      aria-pressed={picked.includes(tag)}
                      className={`text-meta rounded-full px-3 py-1.5 transition-colors ${
                        already
                          ? "bg-surface-sunken text-ink-faint"
                          : picked.includes(tag)
                            ? "bg-accent text-accent-ink"
                            : "bg-surface-sunken text-ink-secondary hover:text-ink"
                      }`}
                    >
                      {tag}
                      {already ? " · added" : ""}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </AiPanel>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Writing assists                                                            */
/* -------------------------------------------------------------------------- */

export function ImproveWriting({
  body,
  onAccept,
  configured,
}: {
  body: string;
  onAccept: (text: string) => void;
  configured: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!configured) return null;

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        disabled={!body.trim()}
      >
        Improve
      </Button>

      <AiPanel<{ text: string; note?: string }>
        open={open}
        onClose={() => setOpen(false)}
        title="Improve the writing"
        disclosure={entryDisclosure(body, 8_000)}
        runLabel="Suggest an edit"
        acceptLabel="Replace my text"
        run={() => improveWritingAction(body)}
        onAccept={(data) => onAccept(data.text)}
      >
        {(data) => (
          <div className="space-y-3">
            {data.note ? (
              <p className="text-meta text-ink-muted">{data.note}</p>
            ) : null}
            {/*
              The suggestion is shown in full before anything is replaced.
              The original stays on the page behind this panel, untouched
              unless the user explicitly accepts.
            */}
            <div className="border-line bg-surface-sunken max-h-80 overflow-y-auto rounded-md border p-3">
              <p className="text-small text-ink whitespace-pre-wrap">
                {data.text}
              </p>
            </div>
            <p className="text-meta text-ink-faint">
              Accepting replaces the body of this entry. Your original is not
              kept, so read it first.
            </p>
          </div>
        )}
      </AiPanel>
    </>
  );
}

export function SummariseEntry({
  body,
  configured,
}: {
  body: string;
  configured: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!configured) return null;

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        disabled={!body.trim()}
      >
        Summarise
      </Button>

      <AiPanel<string>
        open={open}
        onClose={() => setOpen(false)}
        title="Summarise this entry"
        disclosure={entryDisclosure(body, 8_000)}
        runLabel="Summarise"
        run={() => summariseAction(body)}
      >
        {(summary) => (
          <p className="text-small text-ink whitespace-pre-wrap">{summary}</p>
        )}
      </AiPanel>
    </>
  );
}

export function ExtractLearning({
  body,
  configured,
}: {
  body: string;
  configured: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!configured) return null;

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        disabled={!body.trim()}
      >
        Extract learning
      </Button>

      <AiPanel<{ learned: string[]; mistakes: string[] }>
        open={open}
        onClose={() => setOpen(false)}
        title="What this entry shows"
        disclosure={entryDisclosure(body, 8_000)}
        runLabel="Extract"
        run={() => extractLearningAction(body)}
      >
        {(data) => (
          <div className="space-y-4">
            <AiList label="Learned" items={data.learned} />
            <AiList label="Misunderstood" items={data.mistakes} />
            {data.learned.length === 0 && data.mistakes.length === 0 ? (
              <p className="text-small text-ink-muted">
                Nothing specific enough to pull out yet.
              </p>
            ) : null}
          </div>
        )}
      </AiPanel>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Diary reflection                                                           */
/* -------------------------------------------------------------------------- */

export function ReflectOnEntry({
  type,
  id,
  date,
  title,
  body,
  configured,
}: {
  type: WrittenEntryType;
  id: string;
  date: string;
  title: string;
  body: string;
  configured: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!configured) return null;

  return (
    <>
      <Button
        size="sm"
        variant="ai"
        icon={<SparkIcon />}
        onClick={() => setOpen(true)}
        disabled={!body.trim()}
      >
        Reflect
      </Button>

      <AiPanel<Reflection>
        open={open}
        onClose={() => setOpen(false)}
        title="AI Reflection"
        task="reflection"
        runLabel="Reflect on today"
        pendingLabel="Thinking about today's journey…"
        acceptLabel="Keep this"
        run={() => reflectOnEntryAction({ type, id, date, title, body })}
        onAccept={async (data) => {
          await saveReflectionAction(type, id, data);
        }}
      >
        {(data) => (
          <div className="space-y-4">
            <AiField label="Summary" value={data.summary} />
            <AiField label="What you learned" value={data.learning} />
            <AiField label="What went wrong" value={data.mistakes} />
            <AiField label="Breakthrough" value={data.breakthrough} />
            <AiField label="A pattern" value={data.pattern} />
            <AiField label="Next step" value={data.nextStep} />
            <AiList label="Worth sitting with" items={data.questions} />

            <p className="text-meta text-ink-faint">
              Keeping this stores it alongside the entry. Your own words are
              never changed.
            </p>
          </div>
        )}
      </AiPanel>
    </>
  );
}

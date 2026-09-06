"use client";

import { useEffect, useState, type ReactNode } from "react";

import { describeContextAction, type AiResult } from "@/app/actions/ai";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { IndexRecord } from "@/lib/storage/index-store";

/**
 * The shape every AI interaction takes.
 *
 * Written once so the rules cannot be forgotten in the ninth feature:
 *
 *   - Nothing is sent until the user asks. Opening the panel shows what
 *     *would* be sent and stops there.
 *   - Ignore is the default and costs nothing. It is the left-hand button,
 *     and closing the panel is the same thing.
 *   - Accept is always explicit. Suggestions never write themselves in.
 *   - Regenerate is always available, because a first answer is a draft.
 *   - A failure changes nothing and says the entry is safe.
 *
 * On mobile this is a bottom sheet and on desktop a right-hand panel — the
 * presentation the design spec asks for, never a chat bubble.
 */

export type ContextTask = Parameters<typeof describeContextAction>[0];

export interface AiPanelProps<T> {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Which context this task sends, so the disclosure can be fetched. */
  task?: ContextTask;
  /** Extra input the disclosure depends on, e.g. the question being asked. */
  taskInput?: { question?: string; from?: string; to?: string };
  /** A fixed disclosure, when the context does not need a server round trip. */
  disclosure?: string;
  /**
   * Fields the task needs before it can run — a description, a mode toggle.
   * Rendered above everything and always visible, so the inputs and the
   * disclosure describing what they will send sit together.
   */
  inputs?: ReactNode;
  /** Blocks Run while the inputs are incomplete. */
  runDisabled?: boolean;
  /** Runs the feature. Called only when the user asks. */
  run: () => Promise<AiResult<T>>;
  /** Renders a successful result. */
  children: (data: T, sources: IndexRecord[]) => ReactNode;
  /** Shown when the user accepts. Omit for read-only features. */
  onAccept?: (data: T) => void | Promise<void>;
  acceptLabel?: string;
  runLabel?: string;
  /** Quiet line shown while waiting. */
  pendingLabel?: string;
}

export function AiPanel<T>({
  open,
  onClose,
  title,
  task,
  taskInput,
  disclosure,
  inputs,
  runDisabled = false,
  run,
  children,
  onAccept,
  acceptLabel = "Use this",
  runLabel = "Run",
  pendingLabel = "Reading your journal…",
}: AiPanelProps<T>) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AiResult<T> | null>(null);
  const [sources, setSources] = useState<IndexRecord[]>([]);
  /*
   * A fixed `disclosure` is used as given rather than copied into state: for
   * a task with inputs it changes as the user types, and a value copied once
   * at mount would keep describing the wrong thing.
   */
  const [fetchedNotice, setFetchedNotice] = useState<string | null>(null);
  const notice = disclosure ?? fetchedNotice;
  const [accepting, setAccepting] = useState(false);

  /*
   * Ask the server what this *would* send, without sending it.
   *
   * Runs when the panel opens, and sets state from the resolved promise
   * rather than synchronously in the effect body — the disclosure is a fact
   * fetched from outside React, not derived state.
   */
  const inputKey = JSON.stringify(taskInput ?? {});

  useEffect(() => {
    if (!open || disclosure || !task) return;

    let cancelled = false;
    void describeContextAction(task, JSON.parse(inputKey)).then((described) => {
      if (!cancelled) setFetchedNotice(described.disclosure);
    });

    return () => {
      cancelled = true;
    };
  }, [open, disclosure, task, inputKey]);

  const execute = async () => {
    setPending(true);
    const outcome = await run();
    setPending(false);
    setResult(outcome);
    if (outcome.status === "success") setSources(outcome.sources ?? []);
  };

  const accept = async () => {
    if (!onAccept || result?.status !== "success") return;
    setAccepting(true);
    await onAccept(result.data);
    setAccepting(false);
    onClose();
  };

  const close = () => {
    setResult(null);
    setSources([]);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={title}
      description={notice ?? undefined}
      footer={
        <div className="flex items-center justify-between gap-2">
          {/* Ignore sits first and costs nothing. That is the point. */}
          <Button size="sm" onClick={close}>
            Ignore
          </Button>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={result?.status === "success" ? "secondary" : "ai"}
              onClick={execute}
              loading={pending}
              disabled={accepting || runDisabled}
            >
              {pending
                ? "Working…"
                : result?.status === "success"
                  ? "Regenerate"
                  : runLabel}
            </Button>

            {onAccept && result?.status === "success" ? (
              <Button
                loading={accepting}
                size="sm"
                variant="ai"
                onClick={accept}
                disabled={accepting}
              >
                {accepting ? "Saving…" : acceptLabel}
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      {inputs ? <div className="mb-5">{inputs}</div> : null}

      {!result && !pending ? (
        <p className="text-small text-ink-secondary">
          Nothing has been sent yet. Choosing{" "}
          <strong className="text-ink">{runLabel}</strong> sends the text
          described above to Gemini.
        </p>
      ) : null}

      {pending ? (
        <p className="text-small text-ink-muted">{pendingLabel}</p>
      ) : null}

      {result?.status === "error" ? (
        <div role="alert">
          <p className="text-small text-danger">{result.message}</p>
          <p className="text-meta text-ink-muted mt-2">
            Nothing was changed. Your entry is exactly as you left it.
          </p>
        </div>
      ) : null}

      {result?.status === "success" ? (
        <div className="space-y-4">
          {children(result.data, sources)}

          {sources.length > 0 ? (
            <details className="border-line border-t pt-3">
              <summary className="text-meta text-ink-muted hover:text-ink cursor-pointer">
                Based on {sources.length}{" "}
                {sources.length === 1 ? "entry" : "entries"}
              </summary>
              <ul className="mt-2 space-y-1">
                {sources.map((source) => (
                  <li key={source.id} className="text-meta text-ink-muted">
                    {source.date} · {source.title}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared result pieces                                                       */
/* -------------------------------------------------------------------------- */

/** A labelled block of AI prose. Omitted entirely when empty. */
export function AiField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value?.trim()) return null;

  return (
    <div>
      <h3 className="text-meta text-ink-muted">{label}</h3>
      <p className="text-small text-ink mt-1 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

/** A labelled list. Omitted entirely when empty. */
export function AiList({
  label,
  items,
}: {
  label: string;
  items?: string[] | null;
}) {
  if (!items?.length) return null;

  return (
    <div>
      <h3 className="text-meta text-ink-muted">{label}</h3>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={item} className="text-small text-ink flex gap-2">
            <span aria-hidden="true" className="text-ink-faint">
              —
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

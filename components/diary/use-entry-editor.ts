"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { saveEntryAction } from "@/app/actions/entries";
import type { Media, WrittenEntryType } from "@/lib/storage/entries";
import type { Mood } from "@/lib/types";

/**
 * The diary editor's state.
 *
 * Two independent guarantees, because the product's central promise is that
 * the user's words are never lost:
 *
 *   1. **Autosave** writes to disk on a debounce once typing pauses.
 *   2. **A local mirror** writes to `localStorage` on every keystroke, before
 *      any network call. If the process dies between a keystroke and the
 *      save — a crashed dev server, a closed laptop, a browser kill — the
 *      text is still there on reload.
 *
 * The mirror is deliberately *not* applied automatically on load. Silently
 * replacing what is on disk with a draft of unknown age is its own kind of
 * data loss, so a recovered draft is offered and the user chooses.
 */

export interface EditorValue {
  title: string;
  body: string;
  mood?: Mood;
  category?: string;
  tags: string[];
  media: Media[];
  /** Ids of problems and notes this entry links to. */
  relatedProblems: string[];
  relatedNotes: string[];
  /** Letters only: the date this becomes readable. */
  openOn?: string;
}

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

interface StoredDraft {
  value: EditorValue;
  at: number;
}

const DRAFT_PREFIX = "journey-draft";
const DEBOUNCE_MS = 800;

function draftKey(type: WrittenEntryType, id: string): string {
  return `${DRAFT_PREFIX}:${type}:${id}`;
}

/* -------------------------------------------------------------------------- */
/* Draft store                                                                */
/* -------------------------------------------------------------------------- */

/*
 * `localStorage` is external state, so it is read through
 * `useSyncExternalStore` rather than copied into React state in an effect.
 *
 * The snapshot is cached per key. Without that, the per-keystroke mirror write
 * would change the snapshot on every character and force an extra render each
 * time. What matters for recovery is what was on disk *when the editor
 * opened*, so the first read is the one worth keeping.
 */
const snapshotCache = new Map<string, string | null>();
const draftListeners = new Set<() => void>();

function subscribeToDrafts(onChange: () => void): () => void {
  draftListeners.add(onChange);
  return () => draftListeners.delete(onChange);
}

function readRawDraft(key: string): string | null {
  if (snapshotCache.has(key)) return snapshotCache.get(key) ?? null;

  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    raw = null;
  }

  snapshotCache.set(key, raw);
  return raw;
}

function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to clean up */
  }
  snapshotCache.set(key, null);
  draftListeners.forEach((listener) => listener());
}

function writeDraft(key: string, draft: StoredDraft): void {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Quota exceeded or private browsing. Autosave still runs; only the crash
    // net is gone, and interrupting someone mid-sentence to say so is worse.
  }
}

function parseDraft(raw: string | null): StoredDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredDraft;
    return parsed?.value ? parsed : null;
  } catch {
    return null;
  }
}

function sameContent(a: EditorValue, b: EditorValue): boolean {
  return (
    a.title === b.title &&
    a.body === b.body &&
    a.mood === b.mood &&
    a.category === b.category &&
    a.openOn === b.openOn &&
    a.tags.join(" ") === b.tags.join(" ") &&
    a.relatedProblems.join(" ") === b.relatedProblems.join(" ") &&
    a.relatedNotes.join(" ") === b.relatedNotes.join(" ") &&
    a.media.map((m) => m.path).join(" ") ===
      b.media.map((m) => m.path).join(" ")
  );
}

/* -------------------------------------------------------------------------- */

export function useEntryEditor({
  type,
  id,
  date,
  initial,
}: {
  type: WrittenEntryType;
  id: string;
  date: string;
  initial: EditorValue;
}) {
  const [value, setValue] = useState<EditorValue>(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const key = draftKey(type, id);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(value);

  /* ---------------------------------------------------------------------- */
  /* Saving                                                                 */
  /* ---------------------------------------------------------------------- */

  const save = useCallback(async () => {
    const snapshot = latest.current;
    setStatus("saving");

    const result = await saveEntryAction(type, id, {
      date,
      title: snapshot.title,
      body: snapshot.body,
      tags: snapshot.tags,
      media: snapshot.media,
      relatedProblems: snapshot.relatedProblems,
      relatedNotes: snapshot.relatedNotes,
      ...(snapshot.mood ? { mood: snapshot.mood } : {}),
      ...(snapshot.category ? { category: snapshot.category } : {}),
      ...(snapshot.openOn ? { openOn: snapshot.openOn } : {}),
    });

    if (result.status === "success") {
      // Only clear the mirror once the bytes are on disk. Until then it is
      // the only copy that survives a crash.
      clearDraft(key);
      setStatus("saved");
      setSavedAt(result.savedAt ?? new Date().toISOString());
    } else {
      setStatus("error");
    }
  }, [type, id, date, key]);

  /** Save immediately, cancelling any pending debounce. */
  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    return save();
  }, [save]);

  /* ---------------------------------------------------------------------- */
  /* Editing                                                                */
  /* ---------------------------------------------------------------------- */

  const update = useCallback(
    (patch: Partial<EditorValue>) => {
      const next = { ...latest.current, ...patch };
      latest.current = next;

      // Mirror first, network second. This ordering is the whole point.
      writeDraft(key, { value: next, at: Date.now() });

      setValue(next);
      setStatus("dirty");

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void save();
      }, DEBOUNCE_MS);
    },
    [key, save],
  );

  /* ---------------------------------------------------------------------- */
  /* Draft recovery                                                         */
  /* ---------------------------------------------------------------------- */

  const rawDraft = useSyncExternalStore(
    subscribeToDrafts,
    () => readRawDraft(key),
    () => null, // the server has no drafts
  );

  const stored = parseDraft(rawDraft);

  // Offer a draft only when it actually differs from what loaded. A draft
  // identical to the file is just a save that landed before the tab closed.
  const recovered =
    stored && !dismissed && !sameContent(stored.value, initial) ? stored : null;

  const restoreDraft = useCallback(() => {
    if (!stored) return;
    setDismissed(true);
    update(stored.value);
  }, [stored, update]);

  const discardDraft = useCallback(() => {
    setDismissed(true);
    clearDraft(key);
  }, [key]);

  /* ---------------------------------------------------------------------- */
  /* Flushing                                                               */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    // A tab being hidden is the last reliable moment to write. `beforeunload`
    // does not fire on mobile when an app is backgrounded or swiped away.
    const flush = () => {
      if (document.visibilityState === "hidden" && timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void save();
      }
    };

    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [save]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (timer.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // Save on unmount if a debounce is still pending, so navigating away
  // mid-sentence commits rather than discards.
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void save();
      }
    };
  }, [save]);

  return {
    value,
    update,
    saveNow,
    status,
    savedAt,
    recovered,
    restoreDraft,
    discardDraft,
  };
}

/**
 * Shared vocabulary for the technical modules.
 *
 * Deliberately free of `server-only` and of any filesystem import, because
 * both the storage layer and the editors need these values — and a Client
 * Component importing a runtime constant from a `server-only` module drags
 * that whole module into the browser bundle, where it throws on load and
 * silently kills hydration for every page sharing the chunk.
 *
 * Rule of thumb: types may be imported from `lib/storage/*` (they are erased);
 * **values must come from here**.
 */

/* -------------------------------------------------------------------------- */
/* Problems                                                                   */
/* -------------------------------------------------------------------------- */

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const PROBLEM_STATUSES = [
  "attempted",
  "solved-with-help",
  "solved",
  "needs-revisit",
] as const;
export type ProblemStatus = (typeof PROBLEM_STATUSES)[number];

export const PROBLEM_STATUS_LABELS: Record<ProblemStatus, string> = {
  attempted: "Attempted",
  "solved-with-help": "Solved with help",
  solved: "Solved",
  "needs-revisit": "Needs revisit",
};

export const ATTEMPT_RESULTS = ["solved", "partial", "stuck"] as const;
export type AttemptResult = (typeof ATTEMPT_RESULTS)[number];

/* -------------------------------------------------------------------------- */
/* Topics                                                                     */
/* -------------------------------------------------------------------------- */

export const TOPIC_STATUSES = [
  "not-started",
  "learning",
  "practising",
  "comfortable",
] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export const TOPIC_STATUS_LABELS: Record<TopicStatus, string> = {
  "not-started": "Not started",
  learning: "Learning",
  practising: "Practising",
  comfortable: "Comfortable",
};

/** The usual interview surface. A starting point, not a fixed list. */
export const SUGGESTED_TOPICS = [
  "arrays",
  "hashing",
  "two-pointers",
  "sliding-window",
  "stack",
  "binary-search",
  "linked-list",
  "trees",
  "tries",
  "heap",
  "backtracking",
  "graphs",
  "dynamic-programming",
  "greedy",
  "intervals",
  "bit-manipulation",
  "math",
] as const;

/* -------------------------------------------------------------------------- */
/* Notes                                                                      */
/* -------------------------------------------------------------------------- */

export const NOTE_KINDS = ["learning", "fundamentals", "design"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

/** Subjects for CS fundamentals, from the product spec. */
export const SUBJECTS = [
  "Operating Systems",
  "DBMS",
  "Networking",
  "OOP",
  "Java",
  "HTTP",
  "APIs",
  "Concurrency",
] as const;

/** Where each kind of note lives in the URL space. */
export const NOTE_PATHS: Record<NoteKind, string> = {
  learning: "/technical/notes",
  fundamentals: "/technical/fundamentals",
  design: "/technical/design",
};

export const NOTE_LABELS: Record<
  NoteKind,
  { singular: string; plural: string; defaultTitle: string }
> = {
  learning: {
    singular: "note",
    plural: "Learning Notes",
    defaultTitle: "Untitled note",
  },
  fundamentals: {
    singular: "note",
    plural: "CS Fundamentals",
    defaultTitle: "Untitled note",
  },
  design: {
    singular: "design",
    plural: "System Design",
    defaultTitle: "Untitled design",
  },
};

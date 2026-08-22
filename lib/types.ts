/**
 * The entry types that make up the journey.
 *
 * Everything the user records — a diary page, a solved problem, a milestone,
 * a mock interview — is one of these, and every one of them appears on the
 * timeline. Later phases fill in the types they own; the registry exists from
 * Phase 2 so the timeline and filters never need changing to accommodate them.
 */

export const ENTRY_TYPES = {
  // Phase 2
  milestone: { label: "Milestone", plural: "Milestones", tone: "accent" },

  // Phase 3
  diary: { label: "Diary", plural: "Diary", tone: "neutral" },
  reflection: { label: "Reflection", plural: "Reflections", tone: "neutral" },
  experience: { label: "Experience", plural: "Experiences", tone: "neutral" },
  letter: { label: "Letter", plural: "Dear Future Me", tone: "neutral" },

  // Phase 4
  problem: { label: "Problem", plural: "Problems", tone: "success" },
  note: { label: "Note", plural: "Learning Notes", tone: "neutral" },
  design: { label: "Design", plural: "System Design", tone: "success" },
  session: { label: "Session", plural: "Coding Practice", tone: "neutral" },

  // Phase 5
  interview: { label: "Interview", plural: "Interviews", tone: "ai" },
} as const;

export type EntryType = keyof typeof ENTRY_TYPES;

export const ENTRY_TYPE_LIST = Object.keys(ENTRY_TYPES) as EntryType[];

export function isEntryType(value: string): value is EntryType {
  return value in ENTRY_TYPES;
}

/** Moods, as listed in the product spec. Neutral and descriptive, never clinical. */
export const MOODS = [
  "motivated",
  "confident",
  "confused",
  "frustrated",
  "tired",
  "proud",
  "disappointed",
  "hopeful",
  "neutral",
] as const;

export type Mood = (typeof MOODS)[number];

/* -------------------------------------------------------------------------- */
/* Interviews                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Kept here rather than in `lib/storage/interviews.ts` because the interview
 * UI needs these values, and importing a runtime constant from a `server-only`
 * module drags the filesystem layer into the browser bundle. Types may come
 * from storage; values must come from here.
 */
export const INTERVIEW_KINDS = ["dsa", "system-design", "behavioural"] as const;

export type InterviewKind = (typeof INTERVIEW_KINDS)[number];

export const INTERVIEW_LABELS: Record<InterviewKind, string> = {
  dsa: "DSA",
  "system-design": "System design",
  behavioural: "Behavioural",
};

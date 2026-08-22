import "server-only";

import path from "node:path";

import { z } from "zod";

import {
  listFiles,
  readJson,
  remove,
  resolve,
  withLock,
  writeJson,
} from "@/lib/storage/fs";
import {
  registerCollector,
  removeIndexEntry,
  toExcerpt,
  upsertIndexEntry,
  type IndexRecord,
} from "@/lib/storage/index-store";
import { allocateId, slugify } from "@/lib/storage/ids";
import { providedKeysOnly } from "@/lib/storage/patch";
import { DATA_ROOT } from "@/lib/storage/paths";
import {
  ATTEMPT_RESULTS,
  DIFFICULTIES,
  PROBLEM_STATUSES,
  PROBLEM_STATUS_LABELS,
  type ProblemStatus,
} from "@/lib/technical";

/**
 * The Problem Journal.
 *
 * The most valuable record in the technical half of the product, because it
 * stores the part a problem list cannot: what went wrong, what made it make
 * sense, and why it mattered. A solved/unsolved checkbox is worth nothing in
 * six months; "I kept reaching for a nested loop" is worth a great deal.
 *
 * The structure follows the spec exactly — Attempt, Struggle, Breakthrough,
 * Final understanding, Reflection — and every section is plain prose. Nothing
 * here is a wizard or a required field.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected a YYYY-MM-DD date");

export const attemptSchema = z.object({
  date: isoDate,
  /** What was tried. Free prose — an approach is not an enum. */
  approach: z.string().max(2000).default(""),
  result: z.enum(ATTEMPT_RESULTS),
  minutes: z.number().int().min(0).max(1440).optional(),
});

export type Attempt = z.infer<typeof attemptSchema>;

export const problemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "a problem needs a name").max(160),
  source: z.string().max(80).default(""),
  url: z.string().max(500).default(""),
  difficulty: z.enum(DIFFICULTIES).optional(),
  topics: z.array(z.string()).default([]),
  status: z.enum(PROBLEM_STATUSES).default("attempted"),

  attempts: z.array(attemptSchema).default([]),

  // The learning record. All optional — a problem logged in a hurry with just
  // a name is still worth having.
  struggle: z.string().max(8000).default(""),
  breakthrough: z.string().max(8000).default(""),
  understanding: z.string().max(8000).default(""),
  reflection: z.string().max(8000).default(""),

  timeComplexity: z.string().max(80).default(""),
  spaceComplexity: z.string().max(80).default(""),

  tags: z.array(z.string()).default([]),
  /** Ids of related diary entries and notes. */
  related: z.array(z.string()).default([]),

  /** First recorded. Fixes the problem's place on the timeline. */
  date: isoDate,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Problem = z.infer<typeof problemSchema>;

export const problemInputSchema = problemSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial()
  .extend({ name: z.string().min(1, "a problem needs a name").max(160) });

export type ProblemInput = z.input<typeof problemInputSchema>;

const DIR = () => path.join(DATA_ROOT, "problems");
const FILE = (id: string) => resolve("data", "problems", `${id}.json`);

/* -------------------------------------------------------------------------- */
/* Ids                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * `two-sum`, `lru-cache`.
 *
 * Named for the problem rather than the day, because a problem is revisited —
 * its identity is the thing itself, and the attempts carry the dates.
 */
export function slugifyProblem(name: string): string {
  return slugify(name, "problem");
}

async function uniqueId(name: string): Promise<string> {
  const taken = new Set(
    (await listFiles(DIR(), ".json")).map((file) =>
      file.replace(/\.json$/, ""),
    ),
  );

  return allocateId(slugifyProblem(name), taken);
}

/* -------------------------------------------------------------------------- */
/* Derived values                                                             */
/* -------------------------------------------------------------------------- */

/** The most recent attempt date, or the date it was first recorded. */
export function lastPracticed(problem: Problem): string {
  return problem.attempts.reduce(
    (latest, attempt) => (attempt.date > latest ? attempt.date : latest),
    problem.date,
  );
}

export function solvedCount(problem: Problem): number {
  return problem.attempts.filter((attempt) => attempt.result === "solved")
    .length;
}

/* -------------------------------------------------------------------------- */
/* Index                                                                      */
/* -------------------------------------------------------------------------- */

function toIndexRecord(problem: Problem): IndexRecord {
  // The excerpt favours what was learned over what was attempted — the
  // breakthrough is the line worth seeing on a timeline months later.
  const summary =
    problem.breakthrough || problem.understanding || problem.struggle;

  const meta = [
    problem.difficulty,
    problem.topics[0],
    PROBLEM_STATUS_LABELS[problem.status],
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    id: problem.id,
    type: "problem",
    date: problem.date,
    title: problem.name,
    excerpt: summary ? toExcerpt(summary) : meta,
    tags: [...problem.topics, ...problem.tags],
    href: `/technical/problems/${problem.id}`,
    related: problem.related,
    updatedAt: problem.updatedAt,
  };
}

registerCollector("problems", async () => {
  const problems = await listProblems();
  return problems.map(toIndexRecord);
});

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export async function getProblem(id: string): Promise<Problem | null> {
  return readJson(FILE(id), problemSchema);
}

/** All problems, most recently practised first. */
export async function listProblems(): Promise<Problem[]> {
  const files = await listFiles(DIR(), ".json");

  const problems = await Promise.all(
    files.map(async (name) => {
      try {
        return await readJson(path.join(DIR(), name), problemSchema);
      } catch {
        // A hand-edited file that no longer parses should not take the whole
        // list down with it.
        return null;
      }
    }),
  );

  return problems
    .filter((problem): problem is Problem => problem !== null)
    .sort((a, b) => {
      const left = lastPracticed(a);
      const right = lastPracticed(b);
      return left === right ? a.id.localeCompare(b.id) : left < right ? 1 : -1;
    });
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

export async function createProblem(input: ProblemInput): Promise<Problem> {
  const data = problemInputSchema.parse(input);
  const now = new Date().toISOString();

  const problem = problemSchema.parse({
    ...data,
    id: await uniqueId(data.name),
    date: data.date ?? now.slice(0, 10),
    createdAt: now,
    updatedAt: now,
  });

  await writeJson(FILE(problem.id), problem, problemSchema);
  await upsertIndexEntry(toIndexRecord(problem));
  return problem;
}

export async function updateProblem(
  id: string,
  input: Partial<ProblemInput>,
): Promise<Problem> {
  const file = FILE(id);

  const updated = await withLock(file, async () => {
    const existing = await readJson(file, problemSchema);
    if (!existing) throw new Error(`Problem ${id} no longer exists.`);

    // Only the fields actually supplied are merged — see lib/storage/patch.ts.
    const patch = providedKeysOnly(
      input,
      problemInputSchema.partial().parse(input),
    );

    const next = problemSchema.parse({
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    });

    return writeJson(file, next, problemSchema);
  });

  await upsertIndexEntry(toIndexRecord(updated));
  return updated;
}

/** Append an attempt, and move the status to match its result. */
export async function addAttempt(
  id: string,
  attempt: Attempt,
): Promise<Problem> {
  const parsed = attemptSchema.parse(attempt);
  const existing = await getProblem(id);
  if (!existing) throw new Error(`Problem ${id} no longer exists.`);

  // Solving once is not undone by a later stuck attempt — the record is of
  // what was achieved, not of the latest mood.
  const status: ProblemStatus =
    parsed.result === "solved"
      ? existing.status === "solved-with-help"
        ? "solved-with-help"
        : "solved"
      : existing.status === "solved" || existing.status === "solved-with-help"
        ? existing.status
        : parsed.result === "stuck"
          ? "needs-revisit"
          : "attempted";

  return updateProblem(id, {
    attempts: [...existing.attempts, parsed],
    status,
  });
}

export async function deleteProblem(id: string): Promise<void> {
  await remove(FILE(id));
  await removeIndexEntry(id);
}

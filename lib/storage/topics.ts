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
import { DATA_ROOT } from "@/lib/storage/paths";
import {
  lastPracticed,
  listProblems,
  type Problem,
} from "@/lib/storage/problems";
import {
  TOPIC_STATUSES,
  type Difficulty,
  type TopicStatus,
} from "@/lib/technical";

/**
 * DSA topics.
 *
 * A topic file holds only what the user says about it — status and notes.
 * Everything countable is **derived from the problem records** rather than
 * stored: attempts, solved, difficulty spread, first and last practised.
 *
 * That is a deliberate constraint from the spec. A stored counter is a second
 * source of truth that drifts the first time a problem is edited or deleted,
 * and a progress number that quietly lies is worse than no number.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected a YYYY-MM-DD date");

export const topicSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  status: z.enum(TOPIC_STATUSES).default("not-started"),
  notes: z.string().max(20_000).default(""),
  startedOn: isoDate.optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Topic = z.infer<typeof topicSchema>;

/** A topic together with everything computed from its problems. */
export interface TopicSummary {
  id: string;
  name: string;
  status: TopicStatus;
  notes: string;
  startedOn?: string;
  problemCount: number;
  attemptCount: number;
  solvedCount: number;
  difficulty: Record<Difficulty, number>;
  firstPractised?: string;
  lastPractised?: string;
  problems: Problem[];
  /** True when no topic file exists — seen only in problem records so far. */
  implicit: boolean;
}

const DIR = () => path.join(DATA_ROOT, "topics");
const FILE = (id: string) => resolve("data", "topics", `${id}.json`);

export function slugifyTopic(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "topic"
  );
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export async function getTopic(id: string): Promise<Topic | null> {
  return readJson(FILE(id), topicSchema);
}

export async function listTopics(): Promise<Topic[]> {
  const files = await listFiles(DIR(), ".json");

  const topics = await Promise.all(
    files.map(async (name) => {
      try {
        return await readJson(path.join(DIR(), name), topicSchema);
      } catch {
        return null;
      }
    }),
  );

  return topics
    .filter((topic): topic is Topic => topic !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Every topic the journal knows about, with its counts.
 *
 * Includes topics that exist only because a problem mentioned them — tagging a
 * problem `graphs` should make graphs appear, without a separate step to
 * declare the topic first.
 */
export async function summariseTopics(): Promise<TopicSummary[]> {
  const [topics, problems] = await Promise.all([listTopics(), listProblems()]);

  const byId = new Map<string, TopicSummary>();

  const ensure = (id: string, name: string, stored?: Topic): TopicSummary => {
    const existing = byId.get(id);
    if (existing) return existing;

    const summary: TopicSummary = {
      id,
      name: stored?.name ?? name,
      status: stored?.status ?? "not-started",
      notes: stored?.notes ?? "",
      problemCount: 0,
      attemptCount: 0,
      solvedCount: 0,
      difficulty: { easy: 0, medium: 0, hard: 0 },
      problems: [],
      implicit: !stored,
      ...(stored?.startedOn ? { startedOn: stored.startedOn } : {}),
    };

    byId.set(id, summary);
    return summary;
  };

  for (const topic of topics) ensure(topic.id, topic.name, topic);

  for (const problem of problems) {
    for (const raw of problem.topics) {
      const id = slugifyTopic(raw);
      const summary = ensure(id, raw);

      summary.problemCount += 1;
      summary.attemptCount += problem.attempts.length;
      summary.solvedCount += problem.attempts.filter(
        (attempt) => attempt.result === "solved",
      ).length;

      if (problem.difficulty) summary.difficulty[problem.difficulty] += 1;

      const practised = lastPracticed(problem);
      if (!summary.lastPractised || practised > summary.lastPractised) {
        summary.lastPractised = practised;
      }
      if (!summary.firstPractised || problem.date < summary.firstPractised) {
        summary.firstPractised = problem.date;
      }

      summary.problems.push(problem);
    }
  }

  return [...byId.values()].sort((a, b) => {
    // Topics with work on them first; the rest alphabetically.
    if (a.problemCount !== b.problemCount) {
      return b.problemCount - a.problemCount;
    }
    return a.name.localeCompare(b.name);
  });
}

export async function summariseTopic(id: string): Promise<TopicSummary | null> {
  return (await summariseTopics()).find((topic) => topic.id === id) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Create or update the user's notes on a topic.
 *
 * Topics are not indexed for the timeline: a topic is a standing subject
 * rather than something that happened on a day, and the problems beneath it
 * already carry the dates.
 */
export async function saveTopic(
  id: string,
  input: {
    name?: string;
    status?: TopicStatus;
    notes?: string;
    startedOn?: string;
  },
): Promise<Topic> {
  const file = FILE(id);

  return withLock(file, async () => {
    const existing = await readJson(file, topicSchema);
    const now = new Date().toISOString();

    const next = topicSchema.parse({
      ...(existing ?? {
        id,
        name: input.name ?? id,
        createdAt: now,
      }),
      ...input,
      id,
      updatedAt: now,
    });

    return writeJson(file, next, topicSchema);
  });
}

export async function deleteTopic(id: string): Promise<void> {
  await remove(FILE(id));
}

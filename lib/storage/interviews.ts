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
import { allocateId } from "@/lib/storage/ids";
import {
  registerCollector,
  removeIndexEntry,
  toExcerpt,
  upsertIndexEntry,
  type IndexRecord,
} from "@/lib/storage/index-store";
import { DATA_ROOT } from "@/lib/storage/paths";
import {
  INTERVIEW_KINDS,
  INTERVIEW_LABELS,
  type InterviewKind,
} from "@/lib/types";

/**
 * Mock interview records.
 *
 * A session is kept in full — every turn, plus the evaluation — because the
 * value months later is being able to reread what you actually said, not a
 * remembered impression of it. The spec asks for a stored interview record,
 * and this is it.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected a YYYY-MM-DD date");

export const turnSchema = z.object({
  role: z.enum(["assistant", "user"]),
  content: z.string().max(20_000),
  at: z.iso.datetime(),
});

export type Turn = z.infer<typeof turnSchema>;

export const interviewSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(INTERVIEW_KINDS),
  date: isoDate,
  turns: z.array(turnSchema).default([]),
  finished: z.boolean().default(false),
  evaluation: z
    .object({
      summary: z.string().max(2_000),
      strengths: z.array(z.string().max(400)).default([]),
      improvements: z.array(z.string().max(400)).default([]),
    })
    .optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Interview = z.infer<typeof interviewSchema>;

const DIR = () => path.join(DATA_ROOT, "interviews");
const FILE = (id: string) => resolve("data", "interviews", `${id}.json`);

function toIndexRecord(interview: Interview): IndexRecord {
  const firstQuestion = interview.turns.find(
    (turn) => turn.role === "assistant",
  )?.content;

  return {
    id: interview.id,
    type: "interview",
    date: interview.date,
    title: `${INTERVIEW_LABELS[interview.kind]} interview`,
    excerpt: toExcerpt(interview.evaluation?.summary ?? firstQuestion ?? ""),
    tags: [interview.kind],
    href: `/ai/interview/${interview.id}`,
    related: [],
    updatedAt: interview.updatedAt,
  };
}

registerCollector("interviews", async () => {
  const interviews = await listInterviews();
  return interviews.map(toIndexRecord);
});

/* -------------------------------------------------------------------------- */

export async function getInterview(id: string): Promise<Interview | null> {
  return readJson(FILE(id), interviewSchema);
}

export async function listInterviews(): Promise<Interview[]> {
  const files = await listFiles(DIR(), ".json");

  const interviews = await Promise.all(
    files.map(async (name) => {
      try {
        return await readJson(path.join(DIR(), name), interviewSchema);
      } catch {
        return null;
      }
    }),
  );

  return interviews
    .filter((interview): interview is Interview => interview !== null)
    .sort((a, b) =>
      a.date === b.date ? b.id.localeCompare(a.id) : a.date < b.date ? 1 : -1,
    );
}

export async function createInterview(
  kind: InterviewKind,
  date: string,
): Promise<Interview> {
  const now = new Date().toISOString();
  const id = await allocateId(
    `interview-${date}-${kind}`,
    new Set(
      (await listFiles(DIR(), ".json")).map((file) =>
        file.replace(/\.json$/, ""),
      ),
    ),
  );

  const interview = interviewSchema.parse({
    id,
    kind,
    date,
    turns: [],
    finished: false,
    createdAt: now,
    updatedAt: now,
  });

  await writeJson(FILE(id), interview, interviewSchema);
  await upsertIndexEntry(toIndexRecord(interview));
  return interview;
}

/** Append turns and, when the interviewer is done, the evaluation. */
export async function appendTurns(
  id: string,
  turns: Turn[],
  finish?: Interview["evaluation"],
): Promise<Interview> {
  const file = FILE(id);

  const updated = await withLock(file, async () => {
    const existing = await readJson(file, interviewSchema);
    if (!existing) throw new Error(`Interview ${id} no longer exists.`);

    const next = interviewSchema.parse({
      ...existing,
      turns: [...existing.turns, ...turns],
      finished: finish ? true : existing.finished,
      ...(finish ? { evaluation: finish } : {}),
      updatedAt: new Date().toISOString(),
    });

    return writeJson(file, next, interviewSchema);
  });

  await upsertIndexEntry(toIndexRecord(updated));
  return updated;
}

export async function deleteInterview(id: string): Promise<void> {
  await remove(FILE(id));
  await removeIndexEntry(id);
}

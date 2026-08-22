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
import { allocateId } from "@/lib/storage/ids";
import { providedKeysOnly } from "@/lib/storage/patch";
import { DATA_ROOT } from "@/lib/storage/paths";

/**
 * Coding practice sessions.
 *
 * A session is the shape of the time itself — how long, how much, how it felt
 * — separate from the problems worked on inside it. Kept apart so that "I sat
 * down for ninety minutes and got nowhere" is still a recordable fact, which
 * is exactly the kind of day a solved-problems count erases.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected a YYYY-MM-DD date");

export const sessionSchema = z.object({
  id: z.string().min(1),
  date: isoDate,
  minutes: z.number().int().min(0).max(1440).default(0),
  attempted: z.number().int().min(0).max(200).default(0),
  solved: z.number().int().min(0).max(200).default(0),
  topics: z.array(z.string()).default([]),
  notes: z.string().max(8000).default(""),
  reflection: z.string().max(8000).default(""),
  related: z.array(z.string()).default([]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Session = z.infer<typeof sessionSchema>;

export const sessionInputSchema = sessionSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial()
  .extend({ date: isoDate });

export type SessionInput = z.input<typeof sessionInputSchema>;

const DIR = () => path.join(DATA_ROOT, "sessions");
const FILE = (id: string) => resolve("data", "sessions", `${id}.json`);

/**
 * `practice-2026-08-16`.
 *
 * Prefixed so a session can never take the bare date, which is the diary's id
 * space. More than one sitting in a day is normal, so the suffix follows.
 */
async function uniqueId(date: string): Promise<string> {
  const taken = new Set(
    (await listFiles(DIR(), ".json")).map((file) =>
      file.replace(/\.json$/, ""),
    ),
  );

  return allocateId(`practice-${date}`, taken);
}

function describe(session: Session): string {
  const parts: string[] = [];
  if (session.minutes) parts.push(formatMinutes(session.minutes));
  if (session.attempted) {
    parts.push(`${session.solved}/${session.attempted} solved`);
  }
  if (session.topics.length) parts.push(session.topics.join(", "));
  return parts.join(" · ");
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function toIndexRecord(session: Session): IndexRecord {
  const summary = session.reflection || session.notes;

  return {
    id: session.id,
    type: "session",
    date: session.date,
    title: describe(session) || "Practice session",
    excerpt: summary ? toExcerpt(summary) : "",
    tags: session.topics,
    href: `/technical/sessions#${session.id}`,
    related: session.related,
    updatedAt: session.updatedAt,
  };
}

registerCollector("sessions", async () => {
  const sessions = await listSessions();
  return sessions.map(toIndexRecord);
});

/* -------------------------------------------------------------------------- */

export async function getSession(id: string): Promise<Session | null> {
  return readJson(FILE(id), sessionSchema);
}

export async function listSessions(): Promise<Session[]> {
  const files = await listFiles(DIR(), ".json");

  const sessions = await Promise.all(
    files.map(async (name) => {
      try {
        return await readJson(path.join(DIR(), name), sessionSchema);
      } catch {
        return null;
      }
    }),
  );

  return sessions
    .filter((session): session is Session => session !== null)
    .sort((a, b) =>
      a.date === b.date ? b.id.localeCompare(a.id) : a.date < b.date ? 1 : -1,
    );
}

export async function createSession(input: SessionInput): Promise<Session> {
  const data = sessionInputSchema.parse(input);
  const now = new Date().toISOString();

  const session = sessionSchema.parse({
    ...data,
    id: await uniqueId(data.date),
    createdAt: now,
    updatedAt: now,
  });

  await writeJson(FILE(session.id), session, sessionSchema);
  await upsertIndexEntry(toIndexRecord(session));
  return session;
}

export async function updateSession(
  id: string,
  input: Partial<SessionInput>,
): Promise<Session> {
  const file = FILE(id);

  const updated = await withLock(file, async () => {
    const existing = await readJson(file, sessionSchema);
    if (!existing) throw new Error(`Session ${id} no longer exists.`);

    const next = sessionSchema.parse({
      ...existing,
      ...providedKeysOnly(input, sessionInputSchema.partial().parse(input)),
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    });

    return writeJson(file, next, sessionSchema);
  });

  await upsertIndexEntry(toIndexRecord(updated));
  return updated;
}

export async function deleteSession(id: string): Promise<void> {
  await remove(FILE(id));
  await removeIndexEntry(id);
}

/** Totals across all sessions. Feeds Progress and Phase 7. */
export async function sessionTotals(): Promise<{
  count: number;
  minutes: number;
  attempted: number;
  solved: number;
  days: number;
}> {
  const sessions = await listSessions();

  return {
    count: sessions.length,
    minutes: sessions.reduce((sum, s) => sum + s.minutes, 0),
    attempted: sessions.reduce((sum, s) => sum + s.attempted, 0),
    solved: sessions.reduce((sum, s) => sum + s.solved, 0),
    days: new Set(sessions.map((s) => s.date)).size,
  };
}

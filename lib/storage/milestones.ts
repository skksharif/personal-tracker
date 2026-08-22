import "server-only";

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
import path from "node:path";

/**
 * Milestones — the moments worth marking. First interview scheduled, first
 * hard problem solved unaided, a month of consistency.
 *
 * This is the template every later entity module follows: schema, read, write,
 * delete, and an index update on **every** write.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected a YYYY-MM-DD date");

export const milestoneSchema = z.object({
  id: z.string().min(1),
  date: isoDate,
  title: z.string().min(1, "a milestone needs a title").max(140),
  note: z.string().max(4000).default(""),
  /** Public path under /uploads, set in Phase 3 once media exists. */
  image: z.string().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Milestone = z.infer<typeof milestoneSchema>;

export const milestoneInputSchema = milestoneSchema
  .pick({ date: true, title: true, note: true, image: true })
  .partial({ note: true, image: true });

export type MilestoneInput = z.infer<typeof milestoneInputSchema>;

const DIR = () => path.join(DATA_ROOT, "milestones");
const FILE = (id: string) => resolve("data", "milestones", `${id}.json`);

/* -------------------------------------------------------------------------- */
/* Ids                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * `2026-08-16-first-mock-interview`.
 *
 * Date-prefixed so the directory lists chronologically, and slugged so the
 * filename says what it is — someone browsing `data/` without the app should
 * be able to read their own journal.
 *
 * Assigned once at creation and never changed, so renaming a milestone does
 * not orphan its file or break links to it.
 */
async function uniqueId(date: string, title: string): Promise<string> {
  const existing = new Set(
    (await listFiles(DIR(), ".json")).map((name) =>
      name.replace(/\.json$/, ""),
    ),
  );

  return allocateId(`${date}-${slugify(title, "milestone")}`, existing);
}

/* -------------------------------------------------------------------------- */
/* Index                                                                      */
/* -------------------------------------------------------------------------- */

function toIndexRecord(milestone: Milestone): IndexRecord {
  return {
    id: milestone.id,
    type: "milestone",
    date: milestone.date,
    title: milestone.title,
    excerpt: toExcerpt(milestone.note),
    tags: [],
    related: [],
    href: `/journey/milestones#${milestone.id}`,
    updatedAt: milestone.updatedAt,
    ...(milestone.image ? { thumb: milestone.image } : {}),
  };
}

registerCollector("milestones", async () => {
  const milestones = await listMilestones();
  return milestones.map(toIndexRecord);
});

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export async function getMilestone(id: string): Promise<Milestone | null> {
  return readJson(FILE(id), milestoneSchema);
}

/** All milestones, newest first. */
export async function listMilestones(): Promise<Milestone[]> {
  const files = await listFiles(DIR(), ".json");

  const milestones = await Promise.all(
    files.map((name) =>
      readJson(path.join(DIR(), name), milestoneSchema).catch(() => null),
    ),
  );

  return milestones
    .filter((milestone): milestone is Milestone => milestone !== null)
    .sort((a, b) =>
      a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? 1 : -1,
    );
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

export async function createMilestone(
  input: MilestoneInput,
): Promise<Milestone> {
  const data = milestoneInputSchema.parse(input);
  const now = new Date().toISOString();

  const milestone: Milestone = {
    id: await uniqueId(data.date, data.title),
    date: data.date,
    title: data.title,
    note: data.note ?? "",
    createdAt: now,
    updatedAt: now,
    ...(data.image ? { image: data.image } : {}),
  };

  await writeJson(FILE(milestone.id), milestone, milestoneSchema);
  await upsertIndexEntry(toIndexRecord(milestone));

  return milestone;
}

export async function updateMilestone(
  id: string,
  input: Partial<MilestoneInput>,
): Promise<Milestone> {
  const file = FILE(id);

  const updated = await withLock(file, async () => {
    const existing = await readJson(file, milestoneSchema);
    if (!existing) throw new Error(`Milestone ${id} no longer exists.`);

    const next: Milestone = {
      ...existing,
      ...providedKeysOnly(input, milestoneInputSchema.partial().parse(input)),
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    return writeJson(file, next, milestoneSchema);
  });

  await upsertIndexEntry(toIndexRecord(updated));
  return updated;
}

export async function deleteMilestone(id: string): Promise<void> {
  await remove(FILE(id));
  await removeIndexEntry(id);
}

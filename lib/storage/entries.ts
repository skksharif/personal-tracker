import "server-only";

import path from "node:path";

import { z } from "zod";

import {
  listFiles,
  readMarkdown,
  remove,
  resolve,
  withLock,
  writeMarkdown,
} from "@/lib/storage/fs";
import {
  registerCollector,
  removeIndexEntry,
  toExcerpt,
  upsertIndexEntry,
  type IndexRecord,
} from "@/lib/storage/index-store";
import { allocateId, slugify } from "@/lib/storage/ids";
import { deleteImage } from "@/lib/storage/media";
import { listNotes } from "@/lib/storage/notes";
import { DATA_ROOT } from "@/lib/storage/paths";
import { NOTE_KINDS } from "@/lib/technical";
import { MOODS } from "@/lib/types";

/**
 * The written journal: diary entries, reflections, life experiences, and
 * letters to a future self.
 *
 * All four share a shape — dated, titled, tagged, with a Markdown body — so
 * they share one module. What differs is where they live and how they are
 * identified, which is the whole of `ENTRY_CONFIG` below.
 *
 * Stored as Markdown with YAML front matter rather than JSON. This is the
 * most personal content in the product, and it should still be readable in a
 * text editor in five years, with or without this application.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected a YYYY-MM-DD date");

export const mediaSchema = z.object({
  /** Public path, e.g. `/uploads/images/desk.webp`. */
  path: z.string().startsWith("/uploads/"),
  type: z.literal("image"),
  alt: z.string().default(""),
  caption: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** Set on AI-generated images so their origin is never lost. */
  generated: z.boolean().optional(),
  prompt: z.string().optional(),
});

export type Media = z.infer<typeof mediaSchema>;

/** AI output is stored beside the entry, never merged into the body. */
export const aiReflectionSchema = z.object({
  summary: z.string().optional(),
  learning: z.string().optional(),
  mistakes: z.string().optional(),
  breakthrough: z.string().optional(),
  pattern: z.string().optional(),
  nextStep: z.string().optional(),
  generatedAt: z.iso.datetime(),
});

export const entryTypeSchema = z.enum([
  "diary",
  "reflection",
  "experience",
  "letter",
]);

export type WrittenEntryType = z.infer<typeof entryTypeSchema>;

/** Every type that owns a file on disk. Derived, so it cannot fall behind. */
export const WRITTEN_ENTRY_TYPES = entryTypeSchema.options;

export const entryFrontmatterSchema = z.object({
  id: z.string().min(1),
  type: entryTypeSchema,
  date: isoDate,
  title: z.string().max(200).default(""),
  mood: z.enum(MOODS).optional(),
  category: z.string().max(60).optional(),
  tags: z.array(z.string()).default([]),
  /** Ids of related problems and notes. Populated from Phase 4. */
  relatedProblems: z.array(z.string()).default([]),
  relatedNotes: z.array(z.string()).default([]),
  media: z.array(mediaSchema).default([]),
  aiReflection: aiReflectionSchema.optional(),
  /** Letters only: the date this becomes readable. */
  openOn: isoDate.optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type EntryFrontmatter = z.infer<typeof entryFrontmatterSchema>;

export interface Entry extends EntryFrontmatter {
  body: string;
}

/* -------------------------------------------------------------------------- */
/* Per-type configuration                                                     */
/* -------------------------------------------------------------------------- */

interface EntryConfig {
  dir: string;
  /**
   * Diary is one entry per calendar day, so the date *is* the id — opening
   * `/diary/2026-08-16` either finds that day or starts it. The other types
   * can occur many times a day and get a slugged id instead.
   */
  idIsDate: boolean;
  href: (id: string) => string;
  defaultTitle: string;
}

export const ENTRY_CONFIG: Record<WrittenEntryType, EntryConfig> = {
  diary: {
    dir: "diary",
    idIsDate: true,
    href: (id) => `/diary/${id}`,
    defaultTitle: "Untitled entry",
  },
  reflection: {
    dir: "reflections",
    idIsDate: false,
    href: (id) => `/diary/reflections/${id}`,
    defaultTitle: "Untitled reflection",
  },
  experience: {
    dir: "experiences",
    idIsDate: false,
    href: (id) => `/diary/experiences/${id}`,
    defaultTitle: "Untitled experience",
  },
  letter: {
    dir: "letters",
    idIsDate: false,
    href: (id) => `/diary/future/${id}`,
    defaultTitle: "Letter to future me",
  },
};

const dirOf = (type: WrittenEntryType) =>
  path.join(DATA_ROOT, ENTRY_CONFIG[type].dir);

const fileOf = (type: WrittenEntryType, id: string) =>
  resolve("data", ENTRY_CONFIG[type].dir, `${id}.md`);

/* -------------------------------------------------------------------------- */
/* Ids                                                                        */
/* -------------------------------------------------------------------------- */

async function nextId(
  type: WrittenEntryType,
  date: string,
  title: string,
): Promise<string> {
  // The diary is one entry per day, so the date *is* the id. Nothing else in
  // the journal may claim a bare date — see `lib/storage/ids.ts`.
  if (ENTRY_CONFIG[type].idIsDate) return date;

  const taken = new Set(
    (await listFiles(dirOf(type), ".md")).map((name) =>
      name.replace(/\.md$/, ""),
    ),
  );

  return allocateId(`${date}-${slugify(title, "entry")}`, taken);
}

/* -------------------------------------------------------------------------- */
/* Sealed letters                                                             */
/* -------------------------------------------------------------------------- */

/**
 * A letter written to be read later stays closed until its date.
 *
 * Enforced in the storage layer rather than the UI, so a sealed body cannot
 * leak through the timeline, search, or an AI context payload by accident.
 */
export function isSealed(entry: EntryFrontmatter, on: string): boolean {
  return entry.type === "letter" && !!entry.openOn && entry.openOn > on;
}

/* -------------------------------------------------------------------------- */
/* Index                                                                      */
/* -------------------------------------------------------------------------- */

function toIndexRecord(entry: Entry, on: string): IndexRecord {
  const sealed = isSealed(entry, on);
  const firstImage = entry.media.find((item) => item.type === "image");

  return {
    id: entry.id,
    type: entry.type,
    date: entry.date,
    title: entry.title || ENTRY_CONFIG[entry.type].defaultTitle,
    excerpt: sealed ? "Sealed until it is time." : toExcerpt(entry.body),
    tags: entry.tags,
    href: ENTRY_CONFIG[entry.type].href(entry.id),
    // Relations a diary entry declares, so a problem page can find the entries
    // that mention it without opening every file.
    related: [...entry.relatedProblems, ...entry.relatedNotes],
    updatedAt: entry.updatedAt,
    ...(entry.mood ? { mood: entry.mood } : {}),
    ...(firstImage && !sealed ? { thumb: firstImage.path } : {}),
  };
}

for (const type of Object.keys(ENTRY_CONFIG) as WrittenEntryType[]) {
  registerCollector(type, async () => {
    const entries = await listEntries(type);
    const on = todayLocal();
    return entries.map((entry) => toIndexRecord(entry, on));
  });
}

/** Local calendar day. Duplicated from lib/dates to keep storage self-contained. */
function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export async function getEntry(
  type: WrittenEntryType,
  id: string,
): Promise<Entry | null> {
  const file = await readMarkdown(fileOf(type, id), entryFrontmatterSchema);
  if (!file) return null;
  return { ...file.frontmatter, body: file.body };
}

/** All entries of a type, newest first. */
export async function listEntries(type: WrittenEntryType): Promise<Entry[]> {
  const files = await listFiles(dirOf(type), ".md");

  const entries = await Promise.all(
    files.map(async (name) => {
      try {
        const file = await readMarkdown(
          path.join(dirOf(type), name),
          entryFrontmatterSchema,
        );
        return file ? { ...file.frontmatter, body: file.body } : null;
      } catch {
        // A hand-edited file that no longer parses should not take down the
        // whole list. It stays on disk; the rest of the journal still opens.
        return null;
      }
    }),
  );

  return entries
    .filter((entry): entry is Entry => entry !== null)
    .sort((a, b) =>
      a.date === b.date ? b.id.localeCompare(a.id) : a.date < b.date ? 1 : -1,
    );
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

export const entryInputSchema = z.object({
  date: isoDate,
  title: z.string().max(200).optional(),
  body: z.string().max(200_000).optional(),
  mood: z.enum(MOODS).optional(),
  category: z.string().max(60).optional(),
  tags: z.array(z.string()).optional(),
  relatedProblems: z.array(z.string()).optional(),
  relatedNotes: z.array(z.string()).optional(),
  media: z.array(mediaSchema).optional(),
  openOn: isoDate.optional(),
});

export type EntryInput = z.infer<typeof entryInputSchema>;

export async function createEntry(
  type: WrittenEntryType,
  input: EntryInput,
): Promise<Entry> {
  const data = entryInputSchema.parse(input);
  const now = new Date().toISOString();
  const id = await nextId(type, data.date, data.title ?? "");

  return saveEntry(
    type,
    id,
    {
      id,
      type,
      date: data.date,
      title: data.title ?? "",
      tags: data.tags ?? [],
      relatedProblems: data.relatedProblems ?? [],
      relatedNotes: data.relatedNotes ?? [],
      media: data.media ?? [],
      createdAt: now,
      updatedAt: now,
      ...(data.mood ? { mood: data.mood } : {}),
      ...(data.category ? { category: data.category } : {}),
      ...(data.openOn ? { openOn: data.openOn } : {}),
    },
    data.body ?? "",
  );
}

/**
 * Update an entry, creating it if it does not exist.
 *
 * Upsert rather than update because the diary opens at a date whether or not
 * anything has been written there — the first autosave is what brings the file
 * into being, and that must not fail.
 */
export async function updateEntry(
  type: WrittenEntryType,
  id: string,
  input: EntryInput,
): Promise<Entry> {
  const data = entryInputSchema.parse(input);
  const file = fileOf(type, id);

  return withLock(file, async () => {
    const existing = await readMarkdown(file, entryFrontmatterSchema);
    const now = new Date().toISOString();

    const frontmatter: EntryFrontmatter = {
      ...(existing?.frontmatter ?? {
        id,
        type,
        date: data.date,
        title: "",
        tags: [],
        relatedProblems: [],
        relatedNotes: [],
        media: [],
        createdAt: now,
        updatedAt: now,
      }),
      id,
      type,
      date: data.date,
      updatedAt: now,
    };

    // Only overwrite what was actually supplied. An autosave that carries the
    // body must not blank out tags the user set in a different control.
    if (data.title !== undefined) frontmatter.title = data.title;
    if (data.tags !== undefined) frontmatter.tags = data.tags;
    if (data.mood !== undefined) frontmatter.mood = data.mood;
    if (data.category !== undefined) frontmatter.category = data.category;
    if (data.media !== undefined) frontmatter.media = data.media;
    if (data.openOn !== undefined) frontmatter.openOn = data.openOn;
    if (data.relatedProblems !== undefined) {
      frontmatter.relatedProblems = data.relatedProblems;
    }
    if (data.relatedNotes !== undefined) {
      frontmatter.relatedNotes = data.relatedNotes;
    }

    const body = data.body ?? existing?.body ?? "";
    return saveEntry(type, id, frontmatter, body);
  });
}

async function saveEntry(
  type: WrittenEntryType,
  id: string,
  frontmatter: EntryFrontmatter,
  body: string,
): Promise<Entry> {
  const written = await writeMarkdown(
    fileOf(type, id),
    frontmatter,
    body,
    entryFrontmatterSchema,
  );

  const entry: Entry = { ...written.frontmatter, body: written.body };
  await upsertIndexEntry(toIndexRecord(entry, todayLocal()));
  return entry;
}

/**
 * Delete an entry, and the images only it was using.
 *
 * An upload belongs to the entry that inserted it, so deleting the entry and
 * leaving a megabyte of orphaned WebP behind is a slow leak the user can
 * neither see nor clean up.
 *
 * The same file can legitimately be referenced twice — a path copied into
 * another day, an image mentioned in a note — so nothing is removed until the
 * rest of the journal has been checked for it. Deleting a file another entry
 * still points at would turn a tidy-up into a broken page, which is much worse
 * than a file left on disk.
 */
export async function deleteEntry(
  type: WrittenEntryType,
  id: string,
): Promise<void> {
  const entry = await getEntry(type, id);

  await remove(fileOf(type, id));
  await removeIndexEntry(id);

  const owned = entry?.media ?? [];
  if (owned.length === 0) return;

  const stillUsed = await referencedPaths();

  for (const item of owned) {
    if (stillUsed.has(item.path)) continue;

    try {
      await deleteImage(item.path);
    } catch (error) {
      // A file that will not delete is not a reason to fail a delete the user
      // already saw succeed. The entry is gone either way.
      console.warn(`[entries] couldn't remove ${item.path}`, error);
    }
  }
}

/**
 * Every upload path still referenced anywhere in the journal.
 *
 * Reads bodies as well as media records: a media record is how the app tracks
 * an image, but a hand-written `![](/uploads/…)` is just as real a reference.
 */
async function referencedPaths(): Promise<Set<string>> {
  const [entryLists, noteLists] = await Promise.all([
    Promise.all(WRITTEN_ENTRY_TYPES.map((each) => listEntries(each))),
    Promise.all(NOTE_KINDS.map((kind) => listNotes(kind))),
  ]);

  const used = new Set<string>();

  const collectFromBody = (body: string) => {
    for (const match of body.matchAll(/\/uploads\/[^\s)"'<>]+/g)) {
      used.add(match[0]);
    }
  };

  for (const entry of entryLists.flat()) {
    for (const item of entry.media) used.add(item.path);
    collectFromBody(entry.body);
  }

  for (const note of noteLists.flat()) collectFromBody(note.body);

  return used;
}

/**
 * Take the markdown that displays one image out of a body.
 *
 * Removing the record but leaving `![](…)` behind would turn the entry into a
 * broken image, which is a worse outcome than either keeping it or removing
 * it properly. The blank lines the image was sitting between go with it, so
 * the paragraphs close up instead of leaving a hole — and only there: the
 * rest of the author's spacing is not touched.
 */
export function stripImageMarkdown(body: string, mediaPath: string): string {
  const escaped = mediaPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const image = new RegExp(
    String.raw`[ \t]*!\[[^\]]*\]\(\s*${escaped}\s*(?:"[^"]*")?\)[ \t]*`,
    "g",
  );

  /*
   * A sentinel keeps the surrounding-newline handling local to each
   * removal, so blank lines elsewhere in the entry are left exactly as
   * written. NUL cannot occur in a Markdown file this app wrote, and it is
   * written as an escape so this file stays plain text.
   */
  return body
    .replace(image, "\u0000")
    .replace(/\n*\u0000\n*/g, (gap) =>
      gap.startsWith("\n") && gap.endsWith("\n") ? "\n\n" : "",
    )
    .replace(/\u0000/g, "");
}

/**
 * Remove one image from an entry.
 *
 * Three things have to happen together or the journal ends up inconsistent:
 * the media record goes, the markdown that displayed it goes, and the file
 * goes — the last only once nothing else in the journal points at it.
 *
 * Returns the updated entry, or `null` if the entry or the image was already
 * gone. Deleting something twice is not an error worth surfacing.
 */
export async function removeMedia(
  type: WrittenEntryType,
  id: string,
  mediaPath: string,
): Promise<Entry | null> {
  const file = fileOf(type, id);

  const updated = await withLock(file, async () => {
    const existing = await readMarkdown(file, entryFrontmatterSchema);
    if (!existing) return null;

    const media = existing.frontmatter.media.filter(
      (item) => item.path !== mediaPath,
    );
    if (media.length === existing.frontmatter.media.length) return null;

    return saveEntry(
      type,
      id,
      {
        ...existing.frontmatter,
        media,
        updatedAt: new Date().toISOString(),
      },
      stripImageMarkdown(existing.body, mediaPath),
    );
  });

  if (!updated) return null;

  // Checked after the write, so the reference just removed is not counted.
  const stillUsed = await referencedPaths();
  if (!stillUsed.has(mediaPath)) {
    try {
      await deleteImage(mediaPath);
    } catch (error) {
      console.warn(`[entries] couldn't remove ${mediaPath}`, error);
    }
  }

  return updated;
}

/** Store an AI reflection alongside the entry. Never touches the body. */
export async function saveAiReflection(
  type: WrittenEntryType,
  id: string,
  reflection: z.infer<typeof aiReflectionSchema>,
): Promise<Entry> {
  const file = fileOf(type, id);

  return withLock(file, async () => {
    const existing = await readMarkdown(file, entryFrontmatterSchema);
    if (!existing) throw new Error(`Entry ${id} no longer exists.`);

    return saveEntry(
      type,
      id,
      {
        ...existing.frontmatter,
        aiReflection: aiReflectionSchema.parse(reflection),
        updatedAt: new Date().toISOString(),
      },
      existing.body,
    );
  });
}

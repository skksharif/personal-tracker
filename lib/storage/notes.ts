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
import { DATA_ROOT } from "@/lib/storage/paths";
import { NOTE_KINDS, type NoteKind } from "@/lib/technical";

/**
 * Learning notes, CS fundamentals, and system design records.
 *
 * All three are long-form technical writing with a little metadata, so they
 * share a module and a Markdown-with-front-matter format — the same reasoning
 * as the diary: this should still be readable in a text editor years from now.
 *
 * They differ only in `kind`, which decides where they appear and what
 * scaffold a new one starts from.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected a YYYY-MM-DD date");

export const noteFrontmatterSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(NOTE_KINDS),
  title: z.string().max(200).default(""),
  date: isoDate,
  /** CS fundamentals only. */
  subject: z.string().max(60).optional(),
  tags: z.array(z.string()).default([]),
  /** Ids of related problems, notes and diary entries. */
  related: z.array(z.string()).default([]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type NoteFrontmatter = z.infer<typeof noteFrontmatterSchema>;

export interface Note extends NoteFrontmatter {
  body: string;
}

interface KindConfig {
  dir: string;
  href: (id: string) => string;
  defaultTitle: string;
  indexType: "note" | "design";
  /** Section scaffold a new record opens with. */
  template: string;
}

/**
 * The system design template mirrors the spec's section list. It is a
 * scaffold, not a form — headings can be deleted, reordered or ignored, and
 * the file is still a valid note.
 */
const DESIGN_TEMPLATE = `## Problem

## Functional requirements

## Non-functional requirements

## Initial architecture

## Revised architecture

## Components

## Data flow

## Scaling

## Bottlenecks

## Trade-offs

## Lessons
`;

export const NOTE_CONFIG: Record<NoteKind, KindConfig> = {
  learning: {
    dir: "notes",
    href: (id) => `/technical/notes/${id}`,
    defaultTitle: "Untitled note",
    indexType: "note",
    template: "",
  },
  fundamentals: {
    dir: "fundamentals",
    href: (id) => `/technical/fundamentals/${id}`,
    defaultTitle: "Untitled note",
    indexType: "note",
    template: "",
  },
  design: {
    dir: "designs",
    href: (id) => `/technical/design/${id}`,
    defaultTitle: "Untitled design",
    indexType: "design",
    template: DESIGN_TEMPLATE,
  },
};

const dirOf = (kind: NoteKind) => path.join(DATA_ROOT, NOTE_CONFIG[kind].dir);
const fileOf = (kind: NoteKind, id: string) =>
  resolve("data", NOTE_CONFIG[kind].dir, `${id}.md`);

async function uniqueId(kind: NoteKind, title: string): Promise<string> {
  const taken = new Set(
    (await listFiles(dirOf(kind), ".md")).map((file) =>
      file.replace(/\.md$/, ""),
    ),
  );

  return allocateId(slugify(title, "note"), taken);
}

/* -------------------------------------------------------------------------- */
/* Index                                                                      */
/* -------------------------------------------------------------------------- */

function toIndexRecord(note: Note): IndexRecord {
  const config = NOTE_CONFIG[note.kind];

  return {
    id: note.id,
    type: config.indexType,
    date: note.date,
    title: note.title || config.defaultTitle,
    excerpt: toExcerpt(note.body),
    tags: note.subject ? [...note.tags, note.subject] : note.tags,
    href: config.href(note.id),
    related: note.related,
    updatedAt: note.updatedAt,
  };
}

for (const kind of NOTE_KINDS) {
  registerCollector(`notes:${kind}`, async () => {
    const notes = await listNotes(kind);
    return notes.map(toIndexRecord);
  });
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export async function getNote(
  kind: NoteKind,
  id: string,
): Promise<Note | null> {
  const file = await readMarkdown(fileOf(kind, id), noteFrontmatterSchema);
  if (!file) return null;
  return { ...file.frontmatter, body: file.body };
}

export async function listNotes(kind: NoteKind): Promise<Note[]> {
  const files = await listFiles(dirOf(kind), ".md");

  const notes = await Promise.all(
    files.map(async (name) => {
      try {
        const file = await readMarkdown(
          path.join(dirOf(kind), name),
          noteFrontmatterSchema,
        );
        return file ? { ...file.frontmatter, body: file.body } : null;
      } catch {
        return null;
      }
    }),
  );

  return notes
    .filter((note): note is Note => note !== null)
    .sort((a, b) =>
      a.date === b.date ? b.id.localeCompare(a.id) : a.date < b.date ? 1 : -1,
    );
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

export interface NoteInput {
  title?: string;
  body?: string;
  date?: string;
  subject?: string;
  tags?: string[];
  related?: string[];
}

export async function createNote(
  kind: NoteKind,
  input: NoteInput = {},
): Promise<Note> {
  const now = new Date().toISOString();
  const date = input.date ?? now.slice(0, 10);
  const id = await uniqueId(kind, input.title ?? date);

  const frontmatter = noteFrontmatterSchema.parse({
    id,
    kind,
    title: input.title ?? "",
    date,
    tags: input.tags ?? [],
    related: input.related ?? [],
    createdAt: now,
    updatedAt: now,
    ...(input.subject ? { subject: input.subject } : {}),
  });

  return write(kind, id, frontmatter, input.body ?? NOTE_CONFIG[kind].template);
}

export async function updateNote(
  kind: NoteKind,
  id: string,
  input: NoteInput,
): Promise<Note> {
  const file = fileOf(kind, id);

  return withLock(file, async () => {
    const existing = await readMarkdown(file, noteFrontmatterSchema);
    if (!existing) throw new Error(`Note ${id} no longer exists.`);

    const frontmatter: NoteFrontmatter = {
      ...existing.frontmatter,
      updatedAt: new Date().toISOString(),
    };

    // Only what was supplied is written, so a body autosave cannot blank the
    // tags set in another control.
    if (input.title !== undefined) frontmatter.title = input.title;
    if (input.date !== undefined) frontmatter.date = input.date;
    if (input.tags !== undefined) frontmatter.tags = input.tags;
    if (input.related !== undefined) frontmatter.related = input.related;
    if (input.subject !== undefined) frontmatter.subject = input.subject;

    return write(kind, id, frontmatter, input.body ?? existing.body);
  });
}

async function write(
  kind: NoteKind,
  id: string,
  frontmatter: NoteFrontmatter,
  body: string,
): Promise<Note> {
  const written = await writeMarkdown(
    fileOf(kind, id),
    frontmatter,
    body,
    noteFrontmatterSchema,
  );

  const note: Note = { ...written.frontmatter, body: written.body };
  await upsertIndexEntry(toIndexRecord(note));
  return note;
}

export async function deleteNote(kind: NoteKind, id: string): Promise<void> {
  await remove(fileOf(kind, id));
  await removeIndexEntry(id);
}

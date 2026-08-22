import "server-only";

import { z } from "zod";

import { readJson, resolve, withLock, writeJson } from "@/lib/storage/fs";
import { ENTRY_TYPE_LIST, type EntryType } from "@/lib/types";

/**
 * The journey index.
 *
 * One lightweight record per entry, in `data/index.json`. The timeline,
 * search, home page and analytics all read this instead of opening every
 * file in `data/` — without it each of those becomes a full directory scan
 * that gets slower every day the journal is used.
 *
 * It is a **cache, never the source of truth**. The entity files own the
 * data; `rebuildIndex()` regenerates this file from them at any time. That
 * rule is what makes the index safe: if it drifts, it is discarded, not
 * repaired.
 */

export const indexRecordSchema = z.object({
  id: z.string().min(1),
  type: z.enum(ENTRY_TYPE_LIST as [EntryType, ...EntryType[]]),
  /** YYYY-MM-DD. The date the entry belongs to, not when it was written. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string(),
  /** First ~160 characters of the body, for the timeline row. */
  excerpt: z.string().default(""),
  tags: z.array(z.string()).default([]),
  mood: z.string().optional(),
  /** Relative URL of a representative image, if the entry has one. */
  thumb: z.string().optional(),
  /** Where this entry opens. Keeps the timeline generic across types. */
  href: z.string().min(1),
  /**
   * Ids this entry points at — a diary entry naming a problem, a note naming
   * another note. Held here so the reverse question ("what mentions this?")
   * is answerable without opening every file in `data/`.
   */
  related: z.array(z.string()).default([]),
  updatedAt: z.iso.datetime(),
});

export type IndexRecord = z.infer<typeof indexRecordSchema>;

const indexFileSchema = z.object({
  version: z.literal(1),
  entries: z.array(indexRecordSchema),
});

const INDEX_FILE = () => resolve("data", "index.json");

/* -------------------------------------------------------------------------- */
/* Ordering                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Newest first, ties broken by id.
 *
 * Deterministic on purpose: an index written by incremental upserts must be
 * byte-identical to one produced by `rebuildIndex()`, or the two can silently
 * disagree about paging boundaries.
 */
function compare(a: IndexRecord, b: IndexRecord): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function sortEntries(entries: IndexRecord[]): IndexRecord[] {
  return [...entries].sort(compare);
}

/** Trim body text down to a timeline-sized excerpt. */
export function toExcerpt(body: string, limit = 160): string {
  const flat = body
    .replace(/^---[\s\S]*?---/, "") // stray front matter
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/[#*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (flat.length <= limit) return flat;
  // Cut at a word boundary so the excerpt does not end mid-word.
  const cut = flat.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

export async function getIndex(): Promise<IndexRecord[]> {
  const file = await readJson(INDEX_FILE(), indexFileSchema);
  return file?.entries ?? [];
}

export interface QueryOptions {
  types?: EntryType[];
  tags?: string[];
  /** Inclusive YYYY-MM-DD bounds. */
  from?: string;
  to?: string;
  /** Free-text match over title, excerpt and tags. */
  search?: string;
  limit?: number;
  /** Opaque cursor from a previous page. */
  cursor?: string;
}

export interface QueryResult {
  entries: IndexRecord[];
  nextCursor: string | null;
  /** Total matching the filters, before pagination. */
  total: number;
}

/** A cursor points *at* a record; the next page starts after it. */
function toCursor(record: IndexRecord): string {
  return `${record.date}|${record.id}`;
}

/**
 * Filter and page the index.
 *
 * Cursor-based rather than offset-based: entries are inserted at arbitrary
 * points in a date-ordered list, so an offset taken before a write points
 * somewhere else after it, silently skipping or repeating a row.
 */
export async function queryIndex(
  options: QueryOptions = {},
): Promise<QueryResult> {
  const { types, tags, from, to, search, limit = 25, cursor } = options;

  let entries = await getIndex();

  if (types?.length) {
    const wanted = new Set(types);
    entries = entries.filter((entry) => wanted.has(entry.type));
  }

  if (tags?.length) {
    const wanted = new Set(tags);
    entries = entries.filter((entry) => entry.tags.some((t) => wanted.has(t)));
  }

  if (from) entries = entries.filter((entry) => entry.date >= from);
  if (to) entries = entries.filter((entry) => entry.date <= to);

  if (search) {
    const needle = search.toLowerCase().trim();
    if (needle) {
      entries = entries.filter(
        (entry) =>
          entry.title.toLowerCase().includes(needle) ||
          entry.excerpt.toLowerCase().includes(needle) ||
          entry.tags.some((tag) => tag.includes(needle)),
      );
    }
  }

  const total = entries.length;

  if (cursor) {
    const at = entries.findIndex((entry) => toCursor(entry) === cursor);
    // An unknown cursor means the entry was deleted between pages. Starting
    // over beats throwing away the rest of the list.
    entries = at === -1 ? entries : entries.slice(at + 1);
  }

  const page = entries.slice(0, limit);
  const last = page.at(-1);
  const nextCursor = last && entries.length > limit ? toCursor(last) : null;

  return { entries: page, nextCursor, total };
}

/**
 * Entries that point at `id`.
 *
 * The reverse of `related`. A problem page uses this to show the diary entries
 * that mention it, which is where most of the value of cross-linking lives —
 * the forward link is easy, the way back is what makes the journal feel joined
 * up months later.
 */
export async function findReferencesTo(id: string): Promise<IndexRecord[]> {
  const entries = await getIndex();
  return entries.filter((entry) => entry.related.includes(id));
}

/**
 * Resolve ids to their index records, preserving the order given.
 *
 * Lets a page render what an entry links to — titles, not slugs — without the
 * browser making a round trip on load.
 */
export async function resolveRelations(ids: string[]): Promise<IndexRecord[]> {
  if (ids.length === 0) return [];

  const entries = await getIndex();
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  return ids
    .map((id) => byId.get(id))
    .filter((entry): entry is IndexRecord => entry !== undefined);
}

/** Counts per type across the whole index. Feeds Progress and Analytics. */
export async function countByType(): Promise<Record<EntryType, number>> {
  const entries = await getIndex();
  const counts = Object.fromEntries(
    ENTRY_TYPE_LIST.map((type) => [type, 0]),
  ) as Record<EntryType, number>;

  for (const entry of entries) counts[entry.type] += 1;
  return counts;
}

/* -------------------------------------------------------------------------- */
/* Writing                                                                    */
/* -------------------------------------------------------------------------- */

async function writeIndex(entries: IndexRecord[]): Promise<IndexRecord[]> {
  const sorted = sortEntries(entries);
  await writeJson(
    INDEX_FILE(),
    { version: 1 as const, entries: sorted },
    indexFileSchema,
  );
  return sorted;
}

/**
 * Add or replace a record. Called by every entity `save*()` — an entry that
 * is not indexed does not exist as far as the timeline is concerned.
 */
export async function upsertIndexEntry(record: IndexRecord): Promise<void> {
  const validated = indexRecordSchema.parse(record);

  await withLock(INDEX_FILE(), async () => {
    const entries = await getIndex();
    const without = entries.filter((entry) => entry.id !== validated.id);
    await writeIndex([...without, validated]);
  });
}

export async function removeIndexEntry(id: string): Promise<void> {
  await withLock(INDEX_FILE(), async () => {
    const entries = await getIndex();
    const without = entries.filter((entry) => entry.id !== id);
    if (without.length !== entries.length) await writeIndex(without);
  });
}

/* -------------------------------------------------------------------------- */
/* Rebuilding                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A source of index records. Each entity module registers one, so
 * `rebuildIndex()` never needs to know what types exist.
 */
export type Collector = () => Promise<IndexRecord[]>;

const collectors = new Map<string, Collector>();

export function registerCollector(name: string, collector: Collector): void {
  collectors.set(name, collector);
}

/**
 * Regenerate the index from the entity files on disk.
 *
 * The escape hatch that keeps the index safe to rely on: hand-edit a file,
 * restore from a backup, or hit a bug that skips an upsert, and this puts
 * things right without touching any user content.
 */
export async function rebuildIndex(): Promise<IndexRecord[]> {
  return withLock(INDEX_FILE(), async () => {
    const collected = await Promise.all(
      [...collectors.values()].map((collect) => collect()),
    );

    const seen = new Set<string>();
    const entries: IndexRecord[] = [];

    for (const record of collected.flat()) {
      // Ids are unique across the whole journey; a duplicate means two
      // entities collided and the second would be unreachable from the
      // timeline. Keep the first and carry on rather than fail the rebuild.
      if (seen.has(record.id)) continue;
      seen.add(record.id);
      entries.push(indexRecordSchema.parse(record));
    }

    return writeIndex(entries);
  });
}

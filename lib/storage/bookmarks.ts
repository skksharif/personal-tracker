import "server-only";

import { z } from "zod";

import { readJson, resolve, withLock, writeJson } from "@/lib/storage/fs";
import { getIndex, type IndexRecord } from "@/lib/storage/index-store";

/**
 * Bookmarks.
 *
 * A flat list of ids in one small file. Nothing about the entity changes when
 * it is starred, so a bookmark can never corrupt an entry, and clearing the
 * whole file loses nothing but the stars.
 *
 * An id whose entity has since been deleted is simply skipped on read rather
 * than pruned on write — cheaper, and it means a bookmark survives a file
 * being restored from a backup.
 */

const bookmarksSchema = z.object({
  version: z.literal(1),
  ids: z.array(z.string().min(1)).default([]),
});

const FILE = () => resolve("data", "bookmarks.json");

async function read(): Promise<string[]> {
  const file = await readJson(FILE(), bookmarksSchema);
  return file?.ids ?? [];
}

export async function bookmarkedIds(): Promise<Set<string>> {
  return new Set(await read());
}

export async function isBookmarked(id: string): Promise<boolean> {
  return (await read()).includes(id);
}

/** Bookmarked entries, newest first. Missing entities are skipped. */
export async function listBookmarks(): Promise<IndexRecord[]> {
  const [ids, index] = await Promise.all([read(), getIndex()]);
  const starred = new Set(ids);

  return index.filter((record) => starred.has(record.id));
}

/** Star or unstar. Returns the state afterwards, so the UI can reflect it. */
export async function toggleBookmark(id: string): Promise<boolean> {
  const file = FILE();

  return withLock(file, async () => {
    const ids = await read();
    const already = ids.includes(id);

    const next = already ? ids.filter((value) => value !== id) : [...ids, id];

    await writeJson(file, { version: 1 as const, ids: next }, bookmarksSchema);
    return !already;
  });
}

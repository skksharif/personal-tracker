import "server-only";

import { getIndex, type IndexRecord } from "@/lib/storage/index-store";
import { ENTRY_CONFIG, getEntry, updateEntry } from "@/lib/storage/entries";
import { getNote, updateNote } from "@/lib/storage/notes";
import { getProblem, updateProblem } from "@/lib/storage/problems";
import { getSession, updateSession } from "@/lib/storage/sessions";
import type { EntryType } from "@/lib/types";

/**
 * Tags.
 *
 * There is no tag registry on disk, and deliberately so. A tag exists because
 * something carries it; a stored list would be a second source of truth that
 * drifts the moment an entry is edited or deleted — the same reasoning as the
 * DSA counts.
 *
 * Renaming is the one operation that has to reach the entity files, since the
 * tag lives on each record rather than in a table.
 */

export interface TagSummary {
  tag: string;
  count: number;
  /** Types that use this tag, so the tag page can say what it covers. */
  types: EntryType[];
  lastUsed: string;
}

export async function summariseTags(): Promise<TagSummary[]> {
  const index = await getIndex();
  const byTag = new Map<string, TagSummary>();

  for (const record of index) {
    for (const tag of record.tags) {
      const existing = byTag.get(tag);

      if (existing) {
        existing.count += 1;
        if (!existing.types.includes(record.type)) {
          existing.types.push(record.type);
        }
        if (record.date > existing.lastUsed) existing.lastUsed = record.date;
      } else {
        byTag.set(tag, {
          tag,
          count: 1,
          types: [record.type],
          lastUsed: record.date,
        });
      }
    }
  }

  return [...byTag.values()].sort((a, b) =>
    b.count === a.count ? a.tag.localeCompare(b.tag) : b.count - a.count,
  );
}

export async function recordsWithTag(tag: string): Promise<IndexRecord[]> {
  const index = await getIndex();
  return index.filter((record) => record.tags.includes(tag));
}

/* -------------------------------------------------------------------------- */
/* Renaming                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Replace a tag everywhere it appears.
 *
 * Renaming onto an existing tag is a merge, which is the useful behaviour —
 * `dp` and `dynamic-programming` become one thing. Duplicates are collapsed
 * so a record never ends up carrying the same tag twice.
 *
 * Returns how many records changed, so the UI can say what happened rather
 * than claim success blindly.
 */
export async function renameTag(from: string, to: string): Promise<number> {
  const normalised = to.trim().toLowerCase().replace(/\s+/g, "-");
  if (!normalised || normalised === from) return 0;

  const affected = await recordsWithTag(from);
  let changed = 0;

  for (const record of affected) {
    const swap = (tags: string[]) => [
      ...new Set(tags.map((tag) => (tag === from ? normalised : tag))),
    ];

    if (await retag(record, swap)) changed++;
  }

  return changed;
}

/** Remove a tag everywhere. The entries themselves are untouched. */
export async function deleteTag(tag: string): Promise<number> {
  const affected = await recordsWithTag(tag);
  let changed = 0;

  for (const record of affected) {
    if (await retag(record, (tags) => tags.filter((t) => t !== tag))) {
      changed++;
    }
  }

  return changed;
}

/**
 * Apply a tag transformation to whichever entity a record points at.
 *
 * The index says what type something is; this turns that back into the right
 * storage module. Anything whose type does not carry user tags — a milestone,
 * an interview — is skipped rather than failing the whole rename.
 */
async function retag(
  record: IndexRecord,
  transform: (tags: string[]) => string[],
): Promise<boolean> {
  if (record.type in ENTRY_CONFIG) {
    const type = record.type as keyof typeof ENTRY_CONFIG;
    const entry = await getEntry(type, record.id);
    if (!entry) return false;

    await updateEntry(type, record.id, {
      date: entry.date,
      tags: transform(entry.tags),
    });
    return true;
  }

  if (record.type === "problem") {
    const problem = await getProblem(record.id);
    if (!problem) return false;

    // A problem's topics and tags are both rendered as index tags, so both
    // have to be transformed or a rename would only half apply.
    await updateProblem(record.id, {
      topics: transform(problem.topics),
      tags: transform(problem.tags),
    });
    return true;
  }

  if (record.type === "note" || record.type === "design") {
    for (const kind of ["learning", "fundamentals", "design"] as const) {
      const note = await getNote(kind, record.id);
      if (!note) continue;

      await updateNote(kind, record.id, { tags: transform(note.tags) });
      return true;
    }
    return false;
  }

  if (record.type === "session") {
    const session = await getSession(record.id);
    if (!session) return false;

    await updateSession(record.id, { topics: transform(session.topics) });
    return true;
  }

  return false;
}

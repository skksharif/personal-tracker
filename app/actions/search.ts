"use server";

import { queryIndex, type IndexRecord } from "@/lib/storage/index-store";
import { isEntryType, type EntryType } from "@/lib/types";

/**
 * Search the index for things to link to.
 *
 * Reads the index rather than the entity files, which is why linking stays
 * fast regardless of how large the journal gets.
 */
export async function searchIndexAction(
  query: string,
  types?: string[],
): Promise<IndexRecord[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const filtered = (types ?? []).filter(isEntryType) as EntryType[];

  const { entries } = await queryIndex({
    search: trimmed,
    limit: 8,
    ...(filtered.length ? { types: filtered } : {}),
  });

  return entries;
}

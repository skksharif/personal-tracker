"use server";

import { queryIndex, type IndexRecord } from "@/lib/storage/index-store";
import { isEntryType, type EntryType } from "@/lib/types";

export interface TimelinePage {
  entries: IndexRecord[];
  nextCursor: string | null;
}

/**
 * Fetch a further page of the timeline.
 *
 * Paging happens through an action rather than a navigation so that "Load
 * more" appends to what is on screen instead of replacing it — scrolling back
 * through a long journey should not lose your place.
 */
export async function loadTimelinePage(
  cursor: string,
  types: string[] = [],
): Promise<TimelinePage> {
  const filtered = types.filter(isEntryType) as EntryType[];

  const { entries, nextCursor } = await queryIndex({
    cursor,
    limit: 25,
    ...(filtered.length ? { types: filtered } : {}),
  });

  return { entries, nextCursor };
}

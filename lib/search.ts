import "server-only";

import { getIndex, type IndexRecord } from "@/lib/storage/index-store";
import { isEntryType, type EntryType } from "@/lib/types";

/**
 * Search across the whole journey.
 *
 * Reads the index, so one pass covers diary, reflections, problems, notes,
 * designs, sessions, milestones and interviews without opening a single file.
 * That is the point of the index: search that stays fast as the journal grows.
 *
 * Scoring is deliberately simple and explainable rather than clever. Someone
 * looking for a half-remembered phrase wants the obvious match first, and a
 * ranking they cannot predict is worse than one they can.
 */

export interface SearchFilters {
  query: string;
  types?: EntryType[];
  tags?: string[];
  mood?: string;
  from?: string;
  to?: string;
}

export interface SearchHit {
  record: IndexRecord;
  score: number;
  /** Where the match was found, for showing why a result is here. */
  matchedIn: ("title" | "tag" | "text")[];
}

export interface SearchResults {
  hits: SearchHit[];
  total: number;
  /** Every type present in the unfiltered matches, with counts. */
  typeCounts: Partial<Record<EntryType, number>>;
}

/** Split a query into terms, keeping quoted phrases whole. */
export function parseQuery(query: string): string[] {
  const terms: string[] = [];
  const pattern = /"([^"]+)"|(\S+)/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(query)) !== null) {
    const term = (match[1] ?? match[2] ?? "").toLowerCase().trim();
    if (term) terms.push(term);
  }

  return terms;
}

/**
 * Score one record against the search terms.
 *
 * A title hit outranks a tag hit, which outranks body text — that ordering
 * matches how people remember their own writing. Every term must appear
 * somewhere, so a two-word search narrows rather than widens.
 */
function scoreRecord(
  record: IndexRecord,
  terms: string[],
): { score: number; matchedIn: SearchHit["matchedIn"] } | null {
  const title = record.title.toLowerCase();
  const text = record.excerpt.toLowerCase();
  const tags = record.tags.join(" ").toLowerCase();

  let score = 0;
  const matchedIn = new Set<SearchHit["matchedIn"][number]>();

  for (const term of terms) {
    let termScore = 0;

    if (title.includes(term)) {
      // An exact title match is what someone searching a remembered title wants.
      termScore += title === term ? 12 : 6;
      matchedIn.add("title");
    }
    if (tags.includes(term)) {
      termScore += 4;
      matchedIn.add("tag");
    }
    if (text.includes(term)) {
      termScore += 2;
      matchedIn.add("text");
    }

    // Every term has to land somewhere, or this is not a result.
    if (termScore === 0) return null;
    score += termScore;
  }

  return { score, matchedIn: [...matchedIn] };
}

export async function search(filters: SearchFilters): Promise<SearchResults> {
  const terms = parseQuery(filters.query);
  const all = await getIndex();

  // Filters apply first, so the type counts describe what the query found
  // within the current filters rather than across the whole journal.
  const scoped = all.filter((record) => {
    if (filters.tags?.length) {
      const wanted = new Set(filters.tags);
      if (!record.tags.some((tag) => wanted.has(tag))) return false;
    }
    if (filters.mood && record.mood !== filters.mood) return false;
    if (filters.from && record.date < filters.from) return false;
    if (filters.to && record.date > filters.to) return false;
    return true;
  });

  const matched: SearchHit[] =
    terms.length === 0
      ? scoped.map((record) => ({ record, score: 0, matchedIn: [] }))
      : scoped.flatMap((record) => {
          const scored = scoreRecord(record, terms);
          return scored ? [{ record, ...scored }] : [];
        });

  const typeCounts: Partial<Record<EntryType, number>> = {};
  for (const hit of matched) {
    typeCounts[hit.record.type] = (typeCounts[hit.record.type] ?? 0) + 1;
  }

  const byType = filters.types?.length
    ? matched.filter((hit) => filters.types!.includes(hit.record.type))
    : matched;

  // Score first, then recency. A tie broken by date puts the fresher memory
  // on top, which is almost always the one being looked for.
  const hits = byType.sort((a, b) =>
    b.score === a.score
      ? b.record.date.localeCompare(a.record.date)
      : b.score - a.score,
  );

  return { hits, total: hits.length, typeCounts };
}

/** Parse `?type=` values from a URL into real entry types. */
export function readTypes(raw: string | string[] | undefined): EntryType[] {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return values.filter(isEntryType) as EntryType[];
}

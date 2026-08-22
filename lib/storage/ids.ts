import "server-only";

import { getIndex } from "@/lib/storage/index-store";

/**
 * Id allocation.
 *
 * Ids must be unique across the **whole journey**, not just within their own
 * directory. The index is keyed by id, and relations point at bare ids, so two
 * entities sharing one means the second silently replaces the first on the
 * timeline and a link becomes ambiguous.
 *
 * That is not hypothetical: a diary entry is identified by its date, and a
 * practice session recorded the same day once produced exactly that collision
 * — the session overwrote the diary entry in the index and a rebuild dropped
 * one of them entirely.
 */

/** Turn free text into an id-safe slug. */
export function slugify(text: string, fallback = "entry"): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/^\d+\.\s*/, "") // a pasted "1. Two Sum"
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || fallback
  );
}

/**
 * Find a free id, suffixing `-2`, `-3`… until one is unused.
 *
 * `localTaken` covers files already on disk in this collection; the index
 * covers everything else in the journal.
 */
export async function allocateId(
  base: string,
  localTaken: Set<string>,
): Promise<string> {
  const indexed = new Set((await getIndex()).map((entry) => entry.id));

  const free = (candidate: string) =>
    !localTaken.has(candidate) && !indexed.has(candidate);

  if (free(base)) return base;

  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (free(candidate)) return candidate;
  }
}

"use client";

import { useState, useTransition } from "react";

import { loadTimelinePage } from "@/app/actions/timeline";
import { Timeline } from "@/components/journey/timeline";
import { Button } from "@/components/ui/button";
import type { IndexRecord } from "@/lib/storage/index-store";

/**
 * Appends further pages beneath the server-rendered first page.
 *
 * Only the button and the accumulated rows are client-side; the initial
 * timeline is still rendered on the server, so the page is complete and
 * readable before any JavaScript runs.
 */
export function LoadMore({
  initialCursor,
  types,
}: {
  initialCursor: string;
  types: string[];
}) {
  const [entries, setEntries] = useState<IndexRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loadMore = () => {
    if (!cursor) return;

    startTransition(async () => {
      try {
        setError(null);
        const page = await loadTimelinePage(cursor, types);
        setEntries((current) => [...current, ...page.entries]);
        setCursor(page.nextCursor);
      } catch {
        setError("Couldn't load more entries. Try again.");
      }
    });
  };

  return (
    <>
      {entries.length > 0 ? (
        <div className="mt-8">
          <Timeline entries={entries} />
        </div>
      ) : null}

      {cursor ? (
        <div className="mt-8 flex flex-col items-center gap-2">
          <Button loading={pending} onClick={loadMore} disabled={pending}>
            {pending ? "Loading…" : "Load more"}
          </Button>
          {error ? (
            <p role="alert" className="text-meta text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

import Link from "next/link";
import { Suspense } from "react";

import { EntryList } from "@/components/organise/entry-list";
import { SearchForm } from "@/components/organise/search-form";
import { Page, PageHeader } from "@/components/shell/app-shell";
import { EmptyState, Skeleton } from "@/components/ui/surface";
import { search, readTypes, type SearchHit } from "@/lib/search";
import { ENTRY_TYPES, type EntryType } from "@/lib/types";

export const metadata = { title: "Search" };

/**
 * Search across everything.
 *
 * One index read covers every module, so a phrase written in a diary entry, a
 * problem's breakthrough or a design's trade-offs all surface together — which
 * is the point: the journal is one thing, not six.
 *
 * Results are grouped by type because "where did I write that" is usually
 * answered faster by kind than by date.
 */
export default async function SearchPage({
  searchParams,
}: PageProps<"/search">) {
  const params = await searchParams;

  const query = typeof params.q === "string" ? params.q : "";
  const types = readTypes(params.type);
  const tag = typeof params.tag === "string" ? params.tag : undefined;

  const results = await search({
    query,
    ...(types.length ? { types } : {}),
    ...(tag ? { tags: [tag] } : {}),
  });

  const asked = query.trim().length > 0 || tag !== undefined;

  // Grouped, but each group keeps the score order it arrived in.
  const grouped = new Map<EntryType, SearchHit[]>();
  for (const hit of results.hits) {
    const bucket = grouped.get(hit.record.type);
    if (bucket) bucket.push(hit);
    else grouped.set(hit.record.type, [hit]);
  }

  return (
    <Page>
      <PageHeader
        meta={
          asked
            ? `${results.total} ${results.total === 1 ? "result" : "results"}`
            : undefined
        }
        title="Search"
        description="Diary, problems, notes, designs, sessions and interviews — all searched together."
      />

      {/*
        The form reads the URL, so it suspends. The fallback is the same height
        as the input to keep the page from jumping on first paint.
      */}
      <Suspense fallback={<Skeleton className="h-11 w-full" />}>
        <SearchForm typeCounts={results.typeCounts} />
      </Suspense>

      {tag ? (
        <p className="text-meta text-ink-muted mt-3">
          Limited to entries tagged <span className="text-ink">{tag}</span>{" "}
          <Link
            href={query ? `/search?q=${encodeURIComponent(query)}` : "/search"}
            className="text-accent underline underline-offset-4"
          >
            remove
          </Link>
        </p>
      ) : null}

      <div className="mt-section">
        {!asked ? (
          <EmptyState
            title="Search your journey"
            description="Type a phrase you remember writing. Put quotes around it to keep the words together."
          />
        ) : results.total === 0 ? (
          <EmptyState
            title="Nothing matched"
            description="Every word has to appear somewhere for an entry to count as a result, so fewer words find more."
          />
        ) : (
          <div className="space-y-10">
            {[...grouped.entries()].map(([type, hits]) => (
              <section key={type}>
                <h2 className="text-meta text-ink-muted border-line mb-1 border-b pb-2">
                  {ENTRY_TYPES[type].plural}
                  <span className="text-ink-faint ml-2 tabular-nums">
                    {hits.length}
                  </span>
                </h2>

                <EntryList
                  records={hits.map((hit) => hit.record)}
                  showType={false}
                  footnote={(record) => {
                    const hit = hits.find((h) => h.record.id === record.id);
                    if (!hit || hit.matchedIn.length === 0) return undefined;
                    return `matched in ${hit.matchedIn.join(", ")}`;
                  }}
                />
              </section>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}

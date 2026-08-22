import Link from "next/link";

import { Page, PageHeader } from "@/components/shell/app-shell";
import { LoadMore } from "@/components/journey/load-more";
import { Timeline } from "@/components/journey/timeline";
import { EmptyState } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { countByType, queryIndex } from "@/lib/storage/index-store";
import { ENTRY_TYPES, isEntryType, type EntryType } from "@/lib/types";

export const metadata = { title: "Timeline" };

const PAGE_SIZE = 25;

/**
 * The journey, in order.
 *
 * Reads the index rather than the entity files — the whole reason the index
 * exists. Filtering is done through the URL so a filtered view can be linked
 * and returned to.
 */
export default async function TimelinePage({
  searchParams,
}: PageProps<"/journey/timeline">) {
  const params = await searchParams;

  const raw = params.type;
  const selected = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(
    isEntryType,
  ) as EntryType[];

  const [{ entries, nextCursor, total }, counts] = await Promise.all([
    queryIndex({
      limit: PAGE_SIZE,
      ...(selected.length ? { types: selected } : {}),
    }),
    countByType(),
  ]);

  // Only offer filters for types that exist. An empty journal should not show
  // ten dead buttons.
  const available = (Object.keys(ENTRY_TYPES) as EntryType[]).filter(
    (type) => counts[type] > 0,
  );

  return (
    <Page>
      <PageHeader
        meta={`${total} ${total === 1 ? "entry" : "entries"}`}
        title="Timeline"
        action={
          <Link href="/journey/milestones">
            <Button size="sm">Add milestone</Button>
          </Link>
        }
      />

      {available.length > 1 ? (
        <nav aria-label="Filter by type" className="mb-8 flex flex-wrap gap-2">
          <FilterLink active={selected.length === 0} href="/journey/timeline">
            All
          </FilterLink>
          {available.map((type) => (
            <FilterLink
              key={type}
              active={selected.includes(type)}
              href={`/journey/timeline?type=${type}`}
            >
              {ENTRY_TYPES[type].plural}
              <span className="text-ink-faint ml-1.5 tabular-nums">
                {counts[type]}
              </span>
            </FilterLink>
          ))}
        </nav>
      ) : null}

      {entries.length === 0 ? (
        <EmptyState
          title={
            selected.length > 0
              ? "Nothing of that kind yet"
              : "The journey starts here"
          }
          description={
            selected.length > 0
              ? "Try a different filter, or clear it to see everything."
              : "Milestones, diary entries, problems and notes all appear here in order."
          }
          action={
            <Link href="/journey/milestones">
              <Button variant="primary">Add your first milestone</Button>
            </Link>
          }
        />
      ) : (
        <>
          <Timeline entries={entries} />
          {nextCursor ? (
            <LoadMore initialCursor={nextCursor} types={selected} />
          ) : null}
        </>
      )}
    </Page>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "text-meta rounded-full px-3 py-1.5 transition-colors",
        active
          ? "bg-accent-soft text-accent"
          : "bg-surface-sunken text-ink-secondary hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

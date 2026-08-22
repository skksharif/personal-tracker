import Link from "next/link";

import { Page, PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatDayShort, today } from "@/lib/dates";
import { listEntries } from "@/lib/storage/entries";

export const metadata = { title: "Daily Diary" };

/**
 * The diary, by month.
 *
 * One primary action — write today — and a quiet list of what is already
 * there. Days without an entry are simply absent; an empty day is not a gap
 * to be shamed about, and this product does not do streaks.
 */
export default async function DiaryPage() {
  const entries = await listEntries("diary");
  const now = today();
  const hasToday = entries.some((entry) => entry.date === now);

  const months = new Map<string, typeof entries>();
  for (const entry of entries) {
    const month = entry.date.slice(0, 7);
    const bucket = months.get(month);
    if (bucket) bucket.push(entry);
    else months.set(month, [entry]);
  }

  return (
    <Page>
      <PageHeader
        meta={`${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
        title="Daily Diary"
        action={
          <Link href={`/diary/${now}`}>
            <Button variant="primary" size="sm">
              {hasToday ? "Continue today" : "Write today"}
            </Button>
          </Link>
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          title="Nothing written yet"
          description="Today is as good a place to start as any. Write a line about where you are."
          action={
            <Link href={`/diary/${now}`}>
              <Button variant="primary">Write today&rsquo;s entry</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {[...months.entries()].map(([month, monthEntries]) => (
            <section key={month}>
              <h2 className="text-meta text-ink-muted border-line mb-1 border-b py-2">
                {new Date(
                  Number(month.slice(0, 4)),
                  Number(month.slice(5, 7)) - 1,
                  1,
                ).toLocaleDateString("en-GB", {
                  month: "long",
                  year: "numeric",
                })}
              </h2>

              <ul>
                {monthEntries.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      href={`/diary/${entry.id}`}
                      className={cn(
                        "group -mx-3 block rounded-md px-3 py-3 transition-colors",
                        "hover:bg-surface-sunken",
                      )}
                    >
                      <div className="flex items-baseline gap-3">
                        <span className="text-meta text-ink-muted w-20 shrink-0 tabular-nums">
                          {formatDayShort(entry.date)}
                        </span>
                        <span className="text-ink group-hover:text-accent min-w-0 truncate font-medium transition-colors">
                          {entry.title || "Untitled entry"}
                        </span>
                        {entry.mood ? (
                          <span className="text-meta text-ink-faint ml-auto shrink-0">
                            {entry.mood}
                          </span>
                        ) : null}
                      </div>

                      {entry.body ? (
                        <p className="text-small text-ink-muted mt-0.5 ml-[5.75rem] line-clamp-1">
                          {entry.body
                            .replace(/[#*_`>!\[\]]/g, "")
                            .slice(0, 140)}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}

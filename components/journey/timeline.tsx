import Link from "next/link";

import { cn } from "@/lib/cn";
import type { IndexRecord } from "@/lib/storage/index-store";
import { ENTRY_TYPES } from "@/lib/types";

/**
 * The timeline.
 *
 * The design spec is explicit that this stays visually lightweight — the
 * separation comes from whitespace, typography and a small marker, not from a
 * card per row. Months carry a sticky label so the reader keeps their place in
 * a list that will eventually run to hundreds of entries.
 */

const markerTones: Record<string, string> = {
  neutral: "bg-ink-faint",
  accent: "bg-accent",
  ai: "bg-ai",
  success: "bg-success",
};

/** Group consecutive records by `YYYY-MM`. The index is already date-sorted. */
export function groupByMonth(
  entries: IndexRecord[],
): { month: string; entries: IndexRecord[] }[] {
  const groups: { month: string; entries: IndexRecord[] }[] = [];

  for (const entry of entries) {
    const month = entry.date.slice(0, 7);
    const last = groups.at(-1);
    if (last?.month === month) {
      last.entries.push(entry);
    } else {
      groups.push({ month, entries: [entry] });
    }
  }

  return groups;
}

export function formatMonth(month: string): string {
  const [year, monthPart] = month.split("-");
  const date = new Date(Number(year), Number(monthPart) - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Day of month, used as the row's leading marker. */
function dayOf(date: string): string {
  return date.slice(8, 10).replace(/^0/, "");
}

export function TimelineRow({ entry }: { entry: IndexRecord }) {
  const meta = ENTRY_TYPES[entry.type];

  return (
    <li id={entry.id} className="scroll-mt-24">
      <Link
        href={entry.href}
        className={cn(
          "group -mx-3 flex gap-4 rounded-md px-3 py-3 transition-colors",
          "hover:bg-surface-sunken",
        )}
      >
        <div className="flex w-7 shrink-0 flex-col items-center pt-1">
          <span className="text-meta text-ink-muted tabular-nums">
            {dayOf(entry.date)}
          </span>
          <span
            aria-hidden="true"
            className={cn(
              "mt-1.5 size-1.5 rounded-full",
              markerTones[meta.tone] ?? markerTones.neutral,
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="text-ink group-hover:text-accent min-w-0 truncate font-medium transition-colors">
              {entry.title}
            </h3>
            <span className="text-meta text-ink-faint shrink-0">
              {meta.label}
            </span>
          </div>

          {entry.excerpt ? (
            <p className="text-small text-ink-muted mt-0.5 line-clamp-2">
              {entry.excerpt}
            </p>
          ) : null}

          {entry.tags.length > 0 || entry.mood ? (
            <p className="text-meta text-ink-faint mt-1">
              {[entry.mood, ...entry.tags].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>

        {entry.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- local file, dimensions unknown until Phase 3 stores them
          <img
            src={entry.thumb}
            alt=""
            loading="lazy"
            className="size-12 shrink-0 rounded object-cover"
          />
        ) : null}
      </Link>
    </li>
  );
}

export function Timeline({ entries }: { entries: IndexRecord[] }) {
  const months = groupByMonth(entries);

  return (
    <div className="space-y-8">
      {months.map((group) => (
        <section key={group.month}>
          <h2
            className={cn(
              "text-meta text-ink-muted bg-canvas/95 sticky top-14 z-10",
              "border-line mb-1 border-b py-2 backdrop-blur lg:top-0",
            )}
          >
            {formatMonth(group.month)}
          </h2>

          <ul>
            {group.entries.map((entry) => (
              <TimelineRow key={entry.id} entry={entry} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

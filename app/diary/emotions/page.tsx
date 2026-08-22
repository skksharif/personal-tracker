import Link from "next/link";

import { Page, PageHeader } from "@/components/shell/app-shell";
import { EmptyState, Separator } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatDayShort } from "@/lib/dates";
import { getIndex } from "@/lib/storage/index-store";
import { MOODS, type Mood } from "@/lib/types";

export const metadata = { title: "Emotional Journey" };

/**
 * Moods over time.
 *
 * Presented as a record, not an assessment. The spec is explicit that this
 * must never read as a diagnosis, so there is no "score", no baseline, no
 * trend line, and no interpretation — only what was written, when.
 */

/** Ordered roughly from heavy to light, purely so the strip reads consistently. */
const MOOD_ORDER: Mood[] = [
  "disappointed",
  "frustrated",
  "tired",
  "confused",
  "neutral",
  "hopeful",
  "motivated",
  "confident",
  "proud",
];

const MOOD_TONE: Record<Mood, string> = {
  disappointed: "bg-danger",
  frustrated: "bg-danger",
  tired: "bg-warning",
  confused: "bg-warning",
  neutral: "bg-ink-faint",
  hopeful: "bg-accent",
  motivated: "bg-accent",
  confident: "bg-success",
  proud: "bg-success",
};

export default async function EmotionsPage() {
  const index = await getIndex();

  const recorded = index
    .filter((entry): entry is typeof entry & { mood: Mood } =>
      Boolean(entry.mood && MOODS.includes(entry.mood as Mood)),
    )
    .slice(0, 120)
    .reverse(); // oldest first, so the strip reads left to right

  const counts = new Map<Mood, number>();
  for (const entry of recorded) {
    counts.set(entry.mood, (counts.get(entry.mood) ?? 0) + 1);
  }

  return (
    <Page>
      <PageHeader
        meta={`${recorded.length} recorded`}
        title="Emotional Journey"
        description="What you noted about how each day felt. A record, not a reading."
      />

      {recorded.length === 0 ? (
        <EmptyState
          title="No moods recorded yet"
          description="Setting a mood on an entry is optional. When you do, it shows up here."
          action={
            <Link
              href="/diary"
              className="text-small text-accent underline underline-offset-4"
            >
              Go to the diary
            </Link>
          }
        />
      ) : (
        <>
          {/*
            One column per entry, positioned by mood. Deliberately not a line
            chart — connecting these points would imply a continuous measure
            that moods are not.
          */}
          <div className="border-line overflow-x-auto rounded-md border p-4">
            <div className="flex min-w-max items-end gap-1">
              {recorded.map((entry) => {
                const row = MOOD_ORDER.indexOf(entry.mood);
                const height = ((row + 1) / MOOD_ORDER.length) * 100;

                return (
                  <Link
                    key={entry.id}
                    href={entry.href}
                    title={`${formatDayShort(entry.date)} — ${entry.mood}`}
                    className="group flex h-32 w-2 items-end"
                  >
                    <span
                      className={cn(
                        "w-full rounded-sm opacity-70 transition-opacity group-hover:opacity-100",
                        MOOD_TONE[entry.mood],
                      )}
                      style={{ height: `${height}%` }}
                    />
                    <span className="sr-only">
                      {formatDayShort(entry.date)}: {entry.mood}
                    </span>
                  </Link>
                );
              })}
            </div>

            <p className="text-meta text-ink-faint mt-3">
              Oldest on the left. Taller means lighter — the ordering is for
              readability, not a scale.
            </p>
          </div>

          <Separator className="my-section" />

          <h2 className="text-meta text-ink-muted mb-4">How often</h2>

          <ul className="space-y-2">
            {MOOD_ORDER.filter((mood) => counts.has(mood)).map((mood) => (
              <li key={mood} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={cn("size-2 rounded-full", MOOD_TONE[mood])}
                />
                <span className="text-small text-ink capitalize">{mood}</span>
                <span className="text-meta text-ink-muted ml-auto tabular-nums">
                  {counts.get(mood)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Page>
  );
}

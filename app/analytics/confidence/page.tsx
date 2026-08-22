import Link from "next/link";

import { Page, PageHeader } from "@/components/shell/app-shell";
import {
  DataTable,
  Figure,
  Legend,
  StackedBar,
  type Segment,
} from "@/components/charts/primitives";
import { EmptyState } from "@/components/ui/surface";
import { confidenceTimeline } from "@/lib/analytics/compute";
import { formatMonth } from "@/components/journey/timeline";

export const metadata = { title: "Confidence timeline" };

/**
 * How the months felt, from the moods recorded on entries.
 *
 * A diverging form, because the data is an ordered scale with a real middle —
 * that is exactly what diverging is for. Two opposed hues with a neutral grey
 * midpoint, never a hue in the middle.
 *
 * The framing matters as much as the form. The spec forbids presenting
 * emotional data as a diagnosis, so this counts the words the user chose and
 * says so plainly. There is no score, no average, and no trend line.
 */
export default async function ConfidencePage() {
  const timeline = await confidenceTimeline();

  return (
    <Page>
      <PageHeader
        meta={`${timeline.recorded} recorded`}
        title="Confidence timeline"
        description="Counted from the moods you set on entries. Your words, grouped — not a measurement of you."
      />

      {timeline.recorded === 0 ? (
        <EmptyState
          title="No moods recorded yet"
          description="Setting a mood on an entry is optional. When you do, the months show up here."
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
          <Figure
            title="By month"
            caption="Lower and higher are groupings of the mood words themselves, with neutral in the middle."
            table={
              <DataTable
                head={["Month", "Lower", "Neutral", "Higher", "Entries"]}
                rows={timeline.months.map((month) => [
                  formatMonth(month.month),
                  month.lower,
                  month.neutral,
                  month.higher,
                  month.total,
                ])}
              />
            }
          >
            <ul className="space-y-4">
              {timeline.months.map((month) => {
                const segments: Segment[] = [
                  {
                    label: "lower",
                    value: month.lower,
                    color: "var(--chart-low)",
                  },
                  {
                    label: "neutral",
                    value: month.neutral,
                    color: "var(--chart-mid)",
                  },
                  {
                    label: "higher",
                    value: month.higher,
                    color: "var(--chart-high)",
                  },
                ];

                return (
                  <li key={month.month}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-small text-ink">
                        {formatMonth(month.month)}
                      </span>
                      <span className="text-meta text-ink-muted tabular-nums">
                        {month.total} {month.total === 1 ? "entry" : "entries"}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <StackedBar segments={segments} />
                    </div>
                  </li>
                );
              })}
            </ul>

            <Legend
              segments={[
                {
                  label: "lower",
                  value: timeline.months.reduce((s, m) => s + m.lower, 0),
                  color: "var(--chart-low)",
                },
                {
                  label: "neutral",
                  value: timeline.months.reduce((s, m) => s + m.neutral, 0),
                  color: "var(--chart-mid)",
                },
                {
                  label: "higher",
                  value: timeline.months.reduce((s, m) => s + m.higher, 0),
                  color: "var(--chart-high)",
                },
              ]}
            />
          </Figure>

          <p className="text-small text-ink-secondary">
            &ldquo;Lower&rdquo; groups tired, confused, frustrated and
            disappointed; &ldquo;higher&rdquo; groups hopeful, motivated,
            confident and proud. It is a way of sorting what you wrote, not an
            assessment of how you were.
          </p>
        </>
      )}
    </Page>
  );
}

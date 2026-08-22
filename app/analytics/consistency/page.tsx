import { Page, PageHeader } from "@/components/shell/app-shell";
import {
  DataTable,
  Figure,
  StatRow,
  StatTile,
} from "@/components/charts/primitives";
import { formatDay } from "@/lib/dates";
import { studyConsistency } from "@/lib/analytics/compute";

export const metadata = { title: "Study consistency" };

/**
 * Days recorded, as a calendar strip.
 *
 * A sequential ramp: one hue, more entries means darker. Empty days are the
 * track colour rather than a red mark — the product principles are explicit
 * that an unproductive day is a valid part of the journey, and this page
 * reports rather than scores.
 */
function shadeFor(count: number): string {
  if (count === 0) return "var(--surface-sunken)";
  if (count === 1) return "var(--chart-1)";
  if (count <= 3) return "var(--chart-2)";
  return "var(--chart-3)";
}

export default async function ConsistencyPage() {
  const consistency = await studyConsistency();

  // Group into weeks so the strip wraps like a calendar.
  const weeks: (typeof consistency.days)[] = [];
  for (let i = 0; i < consistency.days.length; i += 7) {
    weeks.push(consistency.days.slice(i, i + 7));
  }

  const recorded = consistency.days.filter((day) => day.count > 0);

  return (
    <Page>
      <PageHeader
        meta={`Last ${consistency.totalDays} days`}
        title="Study consistency"
        description="Which days you recorded something. A blank day is a day, not a failure."
      />

      <StatRow>
        <StatTile
          label="Days recorded"
          value={consistency.activeDays}
          detail={`of ${consistency.totalDays}`}
        />
        <StatTile
          label="Current run"
          value={consistency.currentStreak}
          detail={consistency.currentStreak === 1 ? "day" : "days"}
        />
        <StatTile
          label="Longest run"
          value={consistency.longestStreak}
          detail={consistency.longestStreak === 1 ? "day" : "days"}
        />
        {consistency.busiestDay ? (
          <StatTile
            label="Busiest day"
            value={consistency.busiestDay.count}
            detail={formatDay(consistency.busiestDay.date)}
          />
        ) : null}
      </StatRow>

      <div className="mt-section">
        <Figure
          title="Every day since you started"
          caption="Darker means more recorded that day. Oldest at the top left."
          table={
            recorded.length === 0 ? (
              <p className="text-small text-ink-muted">Nothing recorded yet.</p>
            ) : (
              <DataTable
                head={["Day", "Entries", "Practice"]}
                rows={recorded
                  .slice()
                  .reverse()
                  .slice(0, 60)
                  .map((day) => [
                    formatDay(day.date),
                    day.count,
                    day.minutes ? `${day.minutes}m` : "—",
                  ])}
              />
            )
          }
        >
          <div className="flex flex-wrap gap-1">
            {weeks.map((week) => (
              <div key={week[0]?.date} className="flex flex-col gap-1">
                {week.map((day) => (
                  <span
                    key={day.date}
                    title={`${formatDay(day.date)} — ${day.count} ${
                      day.count === 1 ? "entry" : "entries"
                    }`}
                    className="size-3 rounded-[2px]"
                    style={{ background: shadeFor(day.count) }}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-meta text-ink-muted">Fewer</span>
            {[0, 1, 2, 4].map((count) => (
              <span
                key={count}
                aria-hidden="true"
                className="size-3 rounded-[2px]"
                style={{ background: shadeFor(count) }}
              />
            ))}
            <span className="text-meta text-ink-muted">More</span>
          </div>
        </Figure>
      </div>

      <p className="text-small text-ink-secondary">
        This is a record, not a target. A run ending means a day happened, and
        the point of the journal is that those days are part of it too.
      </p>
    </Page>
  );
}

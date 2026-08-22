import Link from "next/link";

import { Page, PageHeader } from "@/components/shell/app-shell";
import {
  DataTable,
  Figure,
  Legend,
  StackedBar,
  StatRow,
  StatTile,
  type Segment,
} from "@/components/charts/primitives";
import { EmptyState, Separator } from "@/components/ui/surface";
import { problemStats } from "@/lib/analytics/compute";
import { PROBLEM_STATUS_LABELS } from "@/lib/technical";

export const metadata = { title: "Problem statistics" };

/**
 * Difficulty is an *ordered* scale, so it gets the ordinal ramp — one hue,
 * light to dark. Green/amber/red would read as good/warning/bad, and a hard
 * problem is not a failure.
 */
const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "var(--chart-1)",
  medium: "var(--chart-2)",
  hard: "var(--chart-3)",
  unset: "var(--chart-mid)",
};

export default async function ProblemAnalyticsPage() {
  const stats = await problemStats();

  const difficultySegments: Segment[] = stats.byDifficulty.map((row) => ({
    label: row.level === "unset" ? "not set" : row.level,
    value: row.count,
    color: DIFFICULTY_COLOR[row.level] ?? "var(--chart-mid)",
  }));

  const solvedTotal = stats.firstTime + stats.neededMoreThanOne;

  return (
    <Page>
      <PageHeader
        meta={`${stats.total} ${stats.total === 1 ? "problem" : "problems"}`}
        title="Problem statistics"
        description="What you attempted, and what it took."
      />

      {stats.total === 0 ? (
        <EmptyState
          title="No problems recorded"
          description="These numbers come from the Problem Journal."
          action={
            <Link
              href="/technical/problems"
              className="text-small text-accent underline underline-offset-4"
            >
              Go to the Problem Journal
            </Link>
          }
        />
      ) : (
        <>
          <StatRow>
            <StatTile label="Problems" value={stats.total} />
            <StatTile label="Attempts" value={stats.totalAttempts} />
            <StatTile
              label="Median attempts"
              value={stats.medianAttempts}
              detail="per problem attempted"
            />
            <StatTile
              label="Solved first time"
              value={solvedTotal > 0 ? stats.firstTime : 0}
              detail={
                solvedTotal > 0 ? `of ${solvedTotal} solved` : "none solved yet"
              }
            />
          </StatRow>

          <Separator className="my-section" />

          <Figure
            title="By difficulty"
            caption="An ordered scale, so one hue from light to dark — not a traffic light. A hard problem isn't a failure."
            table={
              <DataTable
                head={["Difficulty", "Problems", "Solved"]}
                rows={stats.byDifficulty.map((row) => [
                  row.level === "unset" ? "Not set" : row.level,
                  row.count,
                  row.solved,
                ])}
              />
            }
          >
            <StackedBar segments={difficultySegments} />
            <Legend segments={difficultySegments} />
          </Figure>

          <Figure
            title="Where each problem stands"
            caption="Status is your own judgement, not a computed score."
            table={
              <DataTable
                head={["Status", "Problems"]}
                rows={stats.byStatus.map((row) => [
                  PROBLEM_STATUS_LABELS[row.status],
                  row.count,
                ])}
              />
            }
          >
            <ul className="space-y-3">
              {stats.byStatus.map((row) => {
                const share = (row.count / stats.total) * 100;
                return (
                  <li key={row.status}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-small text-ink">
                        {PROBLEM_STATUS_LABELS[row.status]}
                      </span>
                      <span className="text-meta text-ink-muted tabular-nums">
                        {row.count}
                      </span>
                    </div>
                    <div className="bg-surface-sunken mt-1.5 h-2 overflow-hidden rounded-full">
                      <div
                        className="bg-chart-2 h-full rounded-full"
                        style={{ width: `${Math.max(share, 2)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Figure>

          {solvedTotal > 0 ? (
            <p className="text-small text-ink-secondary">
              Of {solvedTotal} solved, {stats.neededMoreThanOne} took more than
              one attempt. That is the useful number — the ones you had to come
              back to are the ones you learned from.
            </p>
          ) : null}
        </>
      )}
    </Page>
  );
}

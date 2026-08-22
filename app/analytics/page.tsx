import Link from "next/link";

import { Page, PageHeader } from "@/components/shell/app-shell";
import { StatRow, StatTile } from "@/components/charts/primitives";
import { Separator } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/dates";
import { preparationProgress } from "@/lib/analytics/compute";
import { formatMinutes } from "@/lib/storage/sessions";

export const metadata = { title: "Analytics" };

/**
 * Preparation progress — the headline view.
 *
 * Numbers, not charts. Six values that each answer a question someone actually
 * asks themselves, and a list of the deeper views. The spec is explicit that
 * this must not become a BI dashboard.
 */
export default async function AnalyticsPage() {
  const progress = await preparationProgress();

  const views = [
    {
      href: "/analytics/topics",
      title: "Topic progress",
      description: "Where the work has actually gone.",
    },
    {
      href: "/analytics/problems",
      title: "Problem statistics",
      description: "Difficulty, status, and how many attempts it took.",
    },
    {
      href: "/analytics/consistency",
      title: "Study consistency",
      description: "Which days you recorded something.",
    },
    {
      href: "/analytics/confidence",
      title: "Confidence timeline",
      description: "How you said the months felt.",
    },
    {
      href: "/analytics/trends",
      title: "Learning trends",
      description: "Solving, writing and practice over time.",
    },
  ];

  return (
    <Page>
      <PageHeader
        meta={`Day ${progress.dayNumber}`}
        title="Analytics"
        description={`Everything here is counted from your records. Since ${formatDay(progress.startDate)}.`}
      />

      <StatRow>
        <StatTile label="Entries" value={progress.entries} />
        <StatTile
          label="Days recorded"
          value={progress.activeDays}
          detail={`${Math.round(progress.consistency * 100)}% of days so far`}
        />
        <StatTile
          label="Problems"
          value={progress.problems}
          detail={
            progress.problems > 0 ? `${progress.solved} solved` : undefined
          }
        />
        <StatTile
          label="Practice"
          value={formatMinutes(progress.practiceMinutes)}
        />
      </StatRow>

      {progress.daysToTarget !== null || progress.lastActive ? (
        <p className="text-small text-ink-muted mt-8">
          {progress.daysToTarget !== null && progress.targetDate
            ? progress.daysToTarget >= 0
              ? `${progress.daysToTarget} days to ${formatDay(progress.targetDate)}. `
              : `Target date passed ${Math.abs(progress.daysToTarget)} days ago. `
            : ""}
          {progress.lastActive
            ? progress.daysSinceActive === 0
              ? "Last recorded today."
              : `Last recorded ${progress.daysSinceActive} ${
                  progress.daysSinceActive === 1 ? "day" : "days"
                } ago.`
            : ""}
        </p>
      ) : null}

      <Separator className="my-section" />

      <h2 className="text-meta text-ink-muted mb-3">Deeper views</h2>

      <ul>
        {views.map((view, position) => (
          <li key={view.href}>
            {position > 0 ? <hr className="border-line border-t" /> : null}
            <Link
              href={view.href}
              className={cn(
                "group -mx-3 block rounded-md px-3 py-3.5 transition-colors",
                "hover:bg-surface-sunken",
              )}
            >
              <span className="text-ink group-hover:text-accent font-medium transition-colors">
                {view.title}
              </span>
              <p className="text-small text-ink-muted mt-0.5">
                {view.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}

import Link from "next/link";

import { Page, PageHeader } from "@/components/shell/app-shell";
import { AddProblem } from "@/components/technical/problem-editor";
import { EmptyState } from "@/components/ui/surface";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { formatDayShort } from "@/lib/dates";
import { lastPracticed, listProblems } from "@/lib/storage/problems";
import { PROBLEM_STATUS_LABELS, type ProblemStatus } from "@/lib/technical";

export const metadata = { title: "Problem Journal" };

const statusTone: Record<ProblemStatus, "neutral" | "success" | "warning"> = {
  attempted: "neutral",
  "solved-with-help": "warning",
  solved: "success",
  "needs-revisit": "warning",
};

export default async function ProblemsPage() {
  const problems = await listProblems();

  return (
    <Page>
      <PageHeader
        meta={`${problems.length} ${problems.length === 1 ? "problem" : "problems"}`}
        title="Problem Journal"
        description="Not a checklist. What you tried, where you got stuck, and what made it make sense."
      />

      <AddProblem />

      {problems.length === 0 ? (
        <EmptyState
          title="No problems yet"
          description="Add the last one you worked on — even if you didn't solve it. Especially if you didn't solve it."
        />
      ) : (
        <ul className="mt-section">
          {problems.map((problem, position) => (
            <li key={problem.id}>
              {position > 0 ? <hr className="border-line border-t" /> : null}

              <Link
                href={`/technical/problems/${problem.id}`}
                className={cn(
                  "group -mx-3 block rounded-md px-3 py-3.5 transition-colors",
                  "hover:bg-surface-sunken",
                )}
              >
                <div className="flex items-baseline gap-3">
                  <h2 className="text-ink group-hover:text-accent min-w-0 truncate font-medium transition-colors">
                    {problem.name}
                  </h2>

                  {problem.difficulty ? (
                    <span className="text-meta text-ink-faint shrink-0 capitalize">
                      {problem.difficulty}
                    </span>
                  ) : null}

                  <span className="text-meta text-ink-muted ml-auto shrink-0 tabular-nums">
                    {formatDayShort(lastPracticed(problem))}
                  </span>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Tag tone={statusTone[problem.status]}>
                    {PROBLEM_STATUS_LABELS[problem.status]}
                  </Tag>

                  {problem.topics.slice(0, 3).map((topic) => (
                    <Tag key={topic}>{topic}</Tag>
                  ))}

                  {problem.attempts.length > 1 ? (
                    <span className="text-meta text-ink-faint">
                      {problem.attempts.length} attempts
                    </span>
                  ) : null}
                </div>

                {problem.breakthrough || problem.struggle ? (
                  <p className="text-small text-ink-muted mt-1.5 line-clamp-1">
                    {(problem.breakthrough || problem.struggle).slice(0, 160)}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

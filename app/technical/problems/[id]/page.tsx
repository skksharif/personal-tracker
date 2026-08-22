import Link from "next/link";
import { notFound } from "next/navigation";

import { Page } from "@/components/shell/app-shell";
import { BookmarkButton } from "@/components/organise/bookmark-button";
import {
  AddAttempt,
  DeleteProblem,
  ProblemMeta,
  ProblemRecord,
} from "@/components/technical/problem-editor";
import { Separator, Surface } from "@/components/ui/surface";
import { Tag } from "@/components/ui/tag";
import { formatDay } from "@/lib/dates";
import { findReferencesTo } from "@/lib/storage/index-store";
import { getProblem, lastPracticed } from "@/lib/storage/problems";
import { isBookmarked } from "@/lib/storage/bookmarks";
import { PROBLEM_STATUS_LABELS } from "@/lib/technical";

export const metadata = { title: "Problem" };

export default async function ProblemPage({
  params,
}: PageProps<"/technical/problems/[id]">) {
  const { id } = await params;
  const problem = await getProblem(id);

  if (!problem) notFound();

  const bookmarked = await isBookmarked(id);

  // The way back: entries elsewhere in the journal that named this problem.
  const references = await findReferencesTo(id);

  return (
    <Page width="reading">
      <nav className="mb-6 flex items-center justify-between">
        <Link
          href="/technical/problems"
          className="text-meta text-ink-muted hover:text-ink transition-colors"
        >
          ← All problems
        </Link>
        <div className="flex items-center gap-1">
          <BookmarkButton id={id} initial={bookmarked} />
          <DeleteProblem problem={problem} />
        </div>
      </nav>

      <header>
        <p className="text-meta text-ink-muted">
          {[
            problem.source,
            problem.difficulty,
            `last practised ${formatDay(lastPracticed(problem))}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <h1 className="text-page text-ink mt-1 font-medium tracking-tight">
          {problem.name}
        </h1>

        {problem.url ? (
          <a
            href={problem.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-meta text-accent mt-2 inline-block underline underline-offset-4"
          >
            Open the problem ↗
          </a>
        ) : null}
      </header>

      <div className="mt-section">
        <ProblemMeta problem={problem} />
      </div>

      <Separator className="my-section" />

      <h2 className="text-meta text-ink-muted mb-4">
        Attempts
        {problem.attempts.length > 0 ? ` · ${problem.attempts.length}` : ""}
      </h2>

      {problem.attempts.length > 0 ? (
        <ol className="mb-6 space-y-3">
          {[...problem.attempts]
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .map((attempt, position) => (
              <li key={`${attempt.date}-${position}`}>
                <Surface className="p-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-meta text-ink-muted tabular-nums">
                      {formatDay(attempt.date)}
                    </span>
                    <Tag
                      tone={
                        attempt.result === "solved"
                          ? "success"
                          : attempt.result === "stuck"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {attempt.result}
                    </Tag>
                    {attempt.minutes ? (
                      <span className="text-meta text-ink-faint ml-auto">
                        {attempt.minutes}m
                      </span>
                    ) : null}
                  </div>

                  {attempt.approach ? (
                    <p className="text-small text-ink-secondary mt-1.5 whitespace-pre-wrap">
                      {attempt.approach}
                    </p>
                  ) : null}
                </Surface>
              </li>
            ))}
        </ol>
      ) : (
        <p className="text-small text-ink-muted mb-6">
          No attempts recorded yet.
        </p>
      )}

      <AddAttempt problem={problem} />

      <Separator className="my-section" />

      <h2 className="text-meta text-ink-muted mb-4">
        What you learned
        <span className="text-ink-faint ml-2 normal-case">
          — saves as you leave each field
        </span>
      </h2>

      <ProblemRecord problem={problem} />

      {references.length > 0 ? (
        <>
          <Separator className="my-section" />

          <h2 className="text-meta text-ink-muted mb-3">Mentioned in</h2>

          <ul className="space-y-1">
            {references.map((reference) => (
              <li key={reference.id}>
                <Link
                  href={reference.href}
                  className="text-small text-accent underline-offset-4 hover:underline"
                >
                  {reference.title}
                </Link>
                <span className="text-meta text-ink-muted ml-2">
                  {formatDay(reference.date)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="text-meta text-ink-faint mt-section">
        Status: {PROBLEM_STATUS_LABELS[problem.status]} · first recorded{" "}
        {formatDay(problem.date)}
      </p>
    </Page>
  );
}

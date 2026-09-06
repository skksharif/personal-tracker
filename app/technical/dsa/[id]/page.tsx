import Link from "next/link";
import { notFound } from "next/navigation";

import { Page } from "@/components/shell/app-shell";
import { DeleteTopic } from "@/components/technical/delete-topic";
import { TopicEditor } from "@/components/technical/topic-editor";
import { Separator } from "@/components/ui/surface";
import { Tag } from "@/components/ui/tag";
import { formatDay } from "@/lib/dates";
import { lastPracticed } from "@/lib/storage/problems";
import { summariseTopic } from "@/lib/storage/topics";
import { PROBLEM_STATUS_LABELS } from "@/lib/technical";

export const metadata = { title: "Topic" };

export default async function TopicPage({
  params,
}: PageProps<"/technical/dsa/[id]">) {
  const { id } = await params;
  const topic = await summariseTopic(id);

  if (!topic) notFound();

  return (
    <Page width="reading">
      <nav className="mb-6 flex items-center justify-between">
        <Link
          href="/technical/dsa"
          className="text-meta text-ink-muted hover:text-ink transition-colors"
        >
          ← All topics
        </Link>
        <DeleteTopic
          id={topic.id}
          name={topic.name}
          problemCount={topic.problemCount}
          implicit={topic.implicit}
        />
      </nav>

      <header>
        <p className="text-meta text-ink-muted">
          {topic.firstPractised
            ? `First worked on ${formatDay(topic.firstPractised)}`
            : "Not started yet"}
        </p>
        <h1 className="text-page text-ink mt-1 font-medium tracking-tight capitalize">
          {topic.name.replace(/-/g, " ")}
        </h1>
      </header>

      <dl className="mt-section grid grid-cols-3 gap-6">
        <div>
          <dt className="text-meta text-ink-muted">Problems</dt>
          <dd className="text-title text-ink mt-0.5 tabular-nums">
            {topic.problemCount}
          </dd>
        </div>
        <div>
          <dt className="text-meta text-ink-muted">Attempts</dt>
          <dd className="text-title text-ink mt-0.5 tabular-nums">
            {topic.attemptCount}
          </dd>
        </div>
        <div>
          <dt className="text-meta text-ink-muted">Solved</dt>
          <dd className="text-title text-ink mt-0.5 tabular-nums">
            {topic.solvedCount}
          </dd>
        </div>
      </dl>

      <p className="text-meta text-ink-faint mt-3">
        Counted from your problem records. Nothing here is entered by hand.
      </p>

      <Separator className="my-section" />

      <TopicEditor
        id={topic.id}
        name={topic.name}
        status={topic.status}
        notes={topic.notes}
      />

      <Separator className="my-section" />

      <h2 className="text-meta text-ink-muted mb-3">
        Problems tagged {topic.name.replace(/-/g, " ")}
      </h2>

      {topic.problems.length === 0 ? (
        <p className="text-small text-ink-muted">
          None yet. Tag a problem with{" "}
          <code className="font-mono">{topic.id}</code> and it appears here.
        </p>
      ) : (
        <ul className="space-y-2">
          {topic.problems
            .slice()
            .sort((a, b) => (lastPracticed(a) < lastPracticed(b) ? 1 : -1))
            .map((problem) => (
              <li key={problem.id} className="flex items-baseline gap-3">
                <Link
                  href={`/technical/problems/${problem.id}`}
                  className="text-small text-accent min-w-0 truncate underline-offset-4 hover:underline"
                >
                  {problem.name}
                </Link>
                <Tag>{PROBLEM_STATUS_LABELS[problem.status]}</Tag>
                <span className="text-meta text-ink-muted ml-auto shrink-0 tabular-nums">
                  {formatDay(lastPracticed(problem))}
                </span>
              </li>
            ))}
        </ul>
      )}
    </Page>
  );
}

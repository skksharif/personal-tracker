import Link from "next/link";

import { Page, PageHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/surface";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { formatDayShort } from "@/lib/dates";
import { summariseTopics } from "@/lib/storage/topics";
import { TOPIC_STATUS_LABELS, type TopicStatus } from "@/lib/technical";

export const metadata = { title: "DSA" };

const statusTone: Record<TopicStatus, "neutral" | "warning" | "success"> = {
  "not-started": "neutral",
  learning: "warning",
  practising: "warning",
  comfortable: "success",
};

/**
 * Topics, with everything countable computed from the problem records.
 *
 * Nothing on this page is a stored counter. Delete a problem and these numbers
 * fall; a progress figure that can drift from the underlying work is worse
 * than no figure at all.
 */
export default async function DsaPage() {
  const topics = await summariseTopics();
  const worked = topics.filter((topic) => topic.problemCount > 0);

  return (
    <Page>
      <PageHeader
        meta={`${worked.length} ${worked.length === 1 ? "topic" : "topics"} with work on them`}
        title="DSA"
        description="Counts come from your problem records, not from a checklist."
      />

      {topics.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Tag a problem with a topic and it appears here — no need to declare topics first."
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
        <ul>
          {topics.map((topic, position) => (
            <li key={topic.id}>
              {position > 0 ? <hr className="border-line border-t" /> : null}

              <Link
                href={`/technical/dsa/${topic.id}`}
                className={cn(
                  "group -mx-3 block rounded-md px-3 py-3.5 transition-colors",
                  "hover:bg-surface-sunken",
                )}
              >
                <div className="flex items-baseline gap-3">
                  <h2 className="text-ink group-hover:text-accent min-w-0 truncate font-medium capitalize transition-colors">
                    {topic.name.replace(/-/g, " ")}
                  </h2>

                  <Tag tone={statusTone[topic.status]}>
                    {TOPIC_STATUS_LABELS[topic.status]}
                  </Tag>

                  {topic.lastPractised ? (
                    <span className="text-meta text-ink-muted ml-auto shrink-0 tabular-nums">
                      {formatDayShort(topic.lastPractised)}
                    </span>
                  ) : null}
                </div>

                <p className="text-meta text-ink-muted mt-1">
                  {topic.problemCount === 0
                    ? "No problems yet"
                    : [
                        `${topic.problemCount} ${topic.problemCount === 1 ? "problem" : "problems"}`,
                        `${topic.attemptCount} ${topic.attemptCount === 1 ? "attempt" : "attempts"}`,
                        `${topic.solvedCount} solved`,
                      ].join(" · ")}
                </p>

                {topic.problemCount > 0 ? (
                  <div
                    aria-hidden="true"
                    className="mt-2 flex h-1 gap-0.5 overflow-hidden rounded-full"
                  >
                    {(
                      [
                        ["easy", "bg-success"],
                        ["medium", "bg-warning"],
                        ["hard", "bg-danger"],
                      ] as const
                    ).map(([level, tone]) =>
                      topic.difficulty[level] > 0 ? (
                        <span
                          key={level}
                          className={cn("h-full rounded-full", tone)}
                          style={{
                            flexGrow: topic.difficulty[level],
                          }}
                        />
                      ) : null,
                    )}
                  </div>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

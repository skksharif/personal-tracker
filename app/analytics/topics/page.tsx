import Link from "next/link";

import { Page, PageHeader } from "@/components/shell/app-shell";
import { BarList, DataTable, Figure } from "@/components/charts/primitives";
import { EmptyState } from "@/components/ui/surface";
import { formatDay } from "@/lib/dates";
import { topicProgress } from "@/lib/analytics/compute";
import { TOPIC_STATUS_LABELS } from "@/lib/technical";

export const metadata = { title: "Topic progress" };

export default async function TopicAnalyticsPage() {
  const topics = await topicProgress();

  return (
    <Page>
      <PageHeader
        meta={`${topics.length} ${topics.length === 1 ? "topic" : "topics"}`}
        title="Topic progress"
        description="Where the work has actually gone, counted from your problem records."
      />

      {topics.length === 0 ? (
        <EmptyState
          title="Nothing to show yet"
          description="Tag a problem with a topic and it appears here."
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
        <Figure
          title="Problems by topic"
          caption="The darker inner bar is how many of those attempts ended solved."
          table={
            <DataTable
              head={["Topic", "Problems", "Attempts", "Solved", "Last"]}
              rows={topics.map((topic) => [
                topic.name.replace(/-/g, " "),
                topic.problems,
                topic.attempts,
                topic.solved,
                topic.lastPractised ? formatDay(topic.lastPractised) : "—",
              ])}
            />
          }
        >
          <BarList
            data={topics.map((topic) => ({
              label: topic.name,
              value: topic.attempts || topic.problems,
              inner: topic.solved,
            }))}
            valueLabel={(datum) => `${datum.inner ?? 0}/${datum.value} solved`}
          />
        </Figure>
      )}

      {topics.length > 0 ? (
        <section>
          <h2 className="text-meta text-ink-muted mb-3">
            Where you said you are
          </h2>
          <ul className="space-y-2">
            {topics.map((topic) => (
              <li key={topic.id} className="flex items-baseline gap-3">
                <Link
                  href={`/technical/dsa/${topic.id}`}
                  className="text-small text-accent capitalize underline-offset-4 hover:underline"
                >
                  {topic.name.replace(/-/g, " ")}
                </Link>
                <span className="text-meta text-ink-muted ml-auto">
                  {TOPIC_STATUS_LABELS[topic.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Page>
  );
}

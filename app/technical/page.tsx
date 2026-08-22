import Link from "next/link";

import { Page, PageHeader } from "@/components/shell/app-shell";
import { cn } from "@/lib/cn";
import { listNotes } from "@/lib/storage/notes";
import { listProblems } from "@/lib/storage/problems";
import { sessionTotals } from "@/lib/storage/sessions";
import { summariseTopics } from "@/lib/storage/topics";

export const metadata = { title: "Technical Preparation" };

/**
 * The way in to the technical half.
 *
 * A short index rather than a dashboard — each module states what it holds so
 * far, which is enough to know where to go next.
 */
export default async function TechnicalPage() {
  const [problems, topics, learning, fundamentals, designs, sessions] =
    await Promise.all([
      listProblems(),
      summariseTopics(),
      listNotes("learning"),
      listNotes("fundamentals"),
      listNotes("design"),
      sessionTotals(),
    ]);

  const worked = topics.filter((topic) => topic.problemCount > 0).length;

  const modules = [
    {
      href: "/technical/problems",
      title: "Problem Journal",
      description: "What you tried, where you stuck, what made it click.",
      count: `${problems.length} ${problems.length === 1 ? "problem" : "problems"}`,
    },
    {
      href: "/technical/dsa",
      title: "DSA",
      description: "Topics, with counts derived from your problems.",
      count: `${worked} ${worked === 1 ? "topic" : "topics"} in progress`,
    },
    {
      href: "/technical/design",
      title: "System Design",
      description: "Requirements, architecture, trade-offs, lessons.",
      count: `${designs.length} ${designs.length === 1 ? "design" : "designs"}`,
    },
    {
      href: "/technical/fundamentals",
      title: "CS Fundamentals",
      description: "The questions that aren't algorithms.",
      count: `${fundamentals.length} ${fundamentals.length === 1 ? "note" : "notes"}`,
    },
    {
      href: "/technical/sessions",
      title: "Coding Practice",
      description: "The sittings themselves — time, volume, how it went.",
      count: `${sessions.count} ${sessions.count === 1 ? "session" : "sessions"}`,
    },
    {
      href: "/technical/notes",
      title: "Learning Notes",
      description: "Concepts in your own words.",
      count: `${learning.length} ${learning.length === 1 ? "note" : "notes"}`,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Technical Preparation"
        description="Six records, one journey. Everything here is linkable from the diary."
      />

      <ul className="space-y-0">
        {modules.map((module, position) => (
          <li key={module.href}>
            {position > 0 ? <hr className="border-line border-t" /> : null}

            <Link
              href={module.href}
              className={cn(
                "group -mx-3 block rounded-md px-3 py-4 transition-colors",
                "hover:bg-surface-sunken",
              )}
            >
              <div className="flex items-baseline gap-3">
                <h2 className="text-title text-ink group-hover:text-accent transition-colors">
                  {module.title}
                </h2>
                <span className="text-meta text-ink-muted ml-auto shrink-0">
                  {module.count}
                </span>
              </div>
              <p className="text-small text-ink-muted mt-0.5">
                {module.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}

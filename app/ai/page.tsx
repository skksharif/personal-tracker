import Link from "next/link";

import { Page, PageHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { isAiConfigured } from "@/lib/env";

export const metadata = { title: "AI Companion" };

/**
 * The way in to the AI half.
 *
 * Every one of these reads the journal and none of them writes to it without
 * being asked. That promise is stated here once, and repeated on each page
 * with the specifics of what it would send.
 */
export default function AiIndexPage() {
  const configured = isAiConfigured();

  const features = [
    {
      href: "/ai/ask",
      title: "Ask My Journey",
      description: "A question about your own record, answered from it.",
    },
    {
      href: "/ai/coach",
      title: "Personal Coach",
      description: "One thing worth doing next, and why.",
    },
    {
      href: "/ai/interview",
      title: "Mock Interviewer",
      description: "DSA, system design or behavioural. Kept as a transcript.",
    },
    {
      href: "/ai/weekly",
      title: "Weekly Reflection",
      description: "What moved this week, and what was hard.",
    },
    {
      href: "/ai/progress",
      title: "Progress Analysis",
      description: "How the preparation has changed, beyond the counts.",
    },
    {
      href: "/ai/insights",
      title: "Learning Insights",
      description: "Connections across months you cannot see from inside.",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="AI Companion"
        description="Everything here reads your journal and suggests. Nothing writes to it unless you accept, and each page says what it sends before it sends anything."
      />

      {!configured ? (
        <EmptyState
          title="AI isn't set up yet"
          description="Add a Gemini API key to .env.local and restart the dev server. The rest of the journal works without it."
        />
      ) : null}

      <ul className={cn(!configured && "mt-section opacity-60")}>
        {features.map((feature, position) => (
          <li key={feature.href}>
            {position > 0 ? <hr className="border-line border-t" /> : null}
            <Link
              href={feature.href}
              className={cn(
                "group -mx-3 block rounded-md px-3 py-4 transition-colors",
                "hover:bg-surface-sunken",
              )}
            >
              <h2 className="text-title text-ink group-hover:text-accent transition-colors">
                {feature.title}
              </h2>
              <p className="text-small text-ink-muted mt-0.5">
                {feature.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}

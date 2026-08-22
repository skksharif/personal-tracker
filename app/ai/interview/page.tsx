import Link from "next/link";

import { Page, PageHeader } from "@/components/shell/app-shell";
import { StartInterview } from "@/components/ai/interview";
import { EmptyState, Separator } from "@/components/ui/surface";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/dates";
import { isAiConfigured } from "@/lib/env";
import { listInterviews } from "@/lib/storage/interviews";
import { INTERVIEW_LABELS } from "@/lib/types";

export const metadata = { title: "Mock Interviewer" };

export default async function InterviewIndexPage() {
  const configured = isAiConfigured();
  const interviews = await listInterviews();

  return (
    <Page>
      <PageHeader
        meta={interviews.length ? `${interviews.length} recorded` : undefined}
        title="Mock Interviewer"
        description="Practice out loud. Every session is kept, so you can reread what you actually said."
      />

      {!configured ? (
        <EmptyState
          title="AI isn't set up yet"
          description="Add a Gemini API key to .env.local and restart. Everything else in the journal works without it."
        />
      ) : (
        <StartInterview />
      )}

      {interviews.length > 0 ? (
        <>
          <Separator className="my-section" />
          <h2 className="text-meta text-ink-muted mb-3">Past interviews</h2>

          <ul>
            {interviews.map((interview, position) => (
              <li key={interview.id}>
                {position > 0 ? <hr className="border-line border-t" /> : null}
                <Link
                  href={`/ai/interview/${interview.id}`}
                  className={cn(
                    "group -mx-3 block rounded-md px-3 py-3 transition-colors",
                    "hover:bg-surface-sunken",
                  )}
                >
                  <div className="flex items-baseline gap-3">
                    <span className="text-ink group-hover:text-accent font-medium transition-colors">
                      {INTERVIEW_LABELS[interview.kind]}
                    </span>
                    <Tag tone={interview.finished ? "success" : "warning"}>
                      {interview.finished ? "finished" : "unfinished"}
                    </Tag>
                    <span className="text-meta text-ink-muted ml-auto">
                      {formatDay(interview.date)}
                    </span>
                  </div>
                  {interview.evaluation ? (
                    <p className="text-small text-ink-muted mt-1 line-clamp-2">
                      {interview.evaluation.summary}
                    </p>
                  ) : (
                    <p className="text-meta text-ink-faint mt-1">
                      {interview.turns.length} turns
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Page>
  );
}

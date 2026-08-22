import Link from "next/link";
import { notFound } from "next/navigation";

import { Page, PageHeader } from "@/components/shell/app-shell";
import { InterviewSession } from "@/components/ai/interview";
import { BookmarkButton } from "@/components/organise/bookmark-button";
import { formatDay } from "@/lib/dates";
import { isBookmarked } from "@/lib/storage/bookmarks";
import { getInterview } from "@/lib/storage/interviews";
import { INTERVIEW_LABELS } from "@/lib/types";

export const metadata = { title: "Mock interview" };

export default async function InterviewPage({
  params,
}: PageProps<"/ai/interview/[id]">) {
  const { id } = await params;
  const interview = await getInterview(id);

  if (!interview) notFound();

  const bookmarked = await isBookmarked(id);

  return (
    <Page width="reading">
      <nav className="mb-6 flex items-center justify-between">
        <Link
          href="/ai/interview"
          className="text-meta text-ink-muted hover:text-ink transition-colors"
        >
          ← All interviews
        </Link>
        <BookmarkButton id={id} initial={bookmarked} />
      </nav>

      <PageHeader
        meta={formatDay(interview.date)}
        title={`${INTERVIEW_LABELS[interview.kind]} interview`}
      />

      <InterviewSession interview={interview} />
    </Page>
  );
}

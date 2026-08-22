import Link from "next/link";
import { notFound } from "next/navigation";

import { EntryEditor } from "@/components/diary/editor";
import { Page } from "@/components/shell/app-shell";
import { BookmarkButton } from "@/components/organise/bookmark-button";
import { formatDay, isValidDay, today } from "@/lib/dates";
import { getEntry } from "@/lib/storage/entries";
import { isBookmarked } from "@/lib/storage/bookmarks";
import { isAiConfigured } from "@/lib/env";
import { resolveRelations } from "@/lib/storage/index-store";

export const metadata = { title: "Diary" };

/**
 * A single day's diary entry.
 *
 * The page exists for every date, written or not — opening it *is* how an
 * entry is started. The file appears on the first autosave.
 */
export default async function DiaryDayPage({
  params,
}: PageProps<"/diary/[date]">) {
  const { date } = await params;

  // Guards against a typo becoming a file called `data/diary/foo.md`.
  if (!isValidDay(date)) notFound();

  const entry = await getEntry("diary", date);
  const aiConfigured = isAiConfigured();
  const [linkedProblems, linkedNotes] = await Promise.all([
    resolveRelations(entry?.relatedProblems ?? []),
    resolveRelations(entry?.relatedNotes ?? []),
  ]);
  const now = today();
  const bookmarked = entry ? await isBookmarked(date) : false;

  return (
    <Page width="reading">
      <nav className="mb-6 flex items-center justify-between">
        <Link
          href="/diary"
          className="text-meta text-ink-muted hover:text-ink transition-colors"
        >
          ← All entries
        </Link>
        <div className="flex items-center gap-3">
          {date !== now ? (
            <Link
              href={`/diary/${now}`}
              className="text-meta text-accent underline-offset-4 hover:underline"
            >
              Today
            </Link>
          ) : null}
          {/* A day with nothing written has no entry to star yet. */}
          {entry ? <BookmarkButton id={date} initial={bookmarked} /> : null}
        </div>
      </nav>

      <EntryEditor
        type="diary"
        id={date}
        date={date}
        initial={{
          title: entry?.title ?? "",
          body: entry?.body ?? "",
          tags: entry?.tags ?? [],
          media: entry?.media ?? [],
          relatedProblems: entry?.relatedProblems ?? [],
          relatedNotes: entry?.relatedNotes ?? [],
          ...(entry?.mood ? { mood: entry.mood } : {}),
          ...(entry?.category ? { category: entry.category } : {}),
        }}
        aiConfigured={aiConfigured}
        linkedProblems={linkedProblems}
        linkedNotes={linkedNotes}
        placeholder={
          date === now
            ? "What happened today?"
            : `What happened on ${formatDay(date)}?`
        }
      />
    </Page>
  );
}

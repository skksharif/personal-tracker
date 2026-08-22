import Link from "next/link";
import { notFound } from "next/navigation";

import { EntryEditor } from "@/components/diary/editor";
import { DeleteEntryButton } from "@/components/diary/entry-collection";
import { SealedLetter } from "@/components/diary/sealed-letter";
import { Page } from "@/components/shell/app-shell";
import { BookmarkButton } from "@/components/organise/bookmark-button";
import { today } from "@/lib/dates";
import { getEntry, isSealed } from "@/lib/storage/entries";
import { isBookmarked } from "@/lib/storage/bookmarks";
import { isAiConfigured } from "@/lib/env";
import { resolveRelations } from "@/lib/storage/index-store";

export const metadata = { title: "Dear Future Me" };

export default async function LetterPage({
  params,
}: PageProps<"/diary/future/[id]">) {
  const { id } = await params;
  const entry = await getEntry("letter", id);
  const aiConfigured = isAiConfigured();
  const [linkedProblems, linkedNotes] = await Promise.all([
    resolveRelations(entry?.relatedProblems ?? []),
    resolveRelations(entry?.relatedNotes ?? []),
  ]);

  if (!entry) notFound();

  const sealed = isSealed(entry, today());
  const bookmarked = await isBookmarked(id);

  return (
    <Page width="reading">
      <nav className="mb-6 flex items-center justify-between">
        <Link
          href="/diary/future"
          className="text-meta text-ink-muted hover:text-ink transition-colors"
        >
          ← All letters
        </Link>
        <div className="flex items-center gap-1">
          <BookmarkButton id={id} initial={bookmarked} />
          <DeleteEntryButton type="letter" id={id} title={entry.title} />
        </div>
      </nav>

      {sealed ? (
        /*
         * A sealed letter is hidden from the timeline, search and AI context.
         * It is not hidden from its author — the file is theirs and sits in
         * plain text on their own disk. Sealing is an intention to be honoured,
         * not a lock to be enforced, so opening early is one deliberate click.
         */
        <SealedLetter entry={entry}>
          <EntryEditor
            type="letter"
            id={id}
            date={entry.date}
            initial={{
              title: entry.title,
              body: entry.body,
              tags: entry.tags,
              media: entry.media,
              relatedProblems: entry.relatedProblems,
              relatedNotes: entry.relatedNotes,
              ...(entry.mood ? { mood: entry.mood } : {}),
              ...(entry.openOn ? { openOn: entry.openOn } : {}),
            }}
            aiConfigured={aiConfigured}
            linkedProblems={linkedProblems}
            linkedNotes={linkedNotes}
            placeholder="Dear future me…"
            showOpenOn
          />
        </SealedLetter>
      ) : (
        <EntryEditor
          type="letter"
          id={id}
          date={entry.date}
          initial={{
            title: entry.title,
            body: entry.body,
            tags: entry.tags,
            media: entry.media,
            relatedProblems: entry.relatedProblems,
            relatedNotes: entry.relatedNotes,
            ...(entry.mood ? { mood: entry.mood } : {}),
            ...(entry.openOn ? { openOn: entry.openOn } : {}),
          }}
          aiConfigured={aiConfigured}
          linkedProblems={linkedProblems}
          linkedNotes={linkedNotes}
          placeholder="Dear future me…"
          showOpenOn
        />
      )}
    </Page>
  );
}

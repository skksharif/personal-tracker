import Link from "next/link";
import { notFound } from "next/navigation";

import { EntryEditor } from "@/components/diary/editor";
import { DeleteEntryButton } from "@/components/diary/entry-collection";
import { Page } from "@/components/shell/app-shell";
import { BookmarkButton } from "@/components/organise/bookmark-button";
import { getEntry } from "@/lib/storage/entries";
import { isBookmarked } from "@/lib/storage/bookmarks";
import { isAiConfigured } from "@/lib/env";
import { resolveRelations } from "@/lib/storage/index-store";

export const metadata = { title: "Life Experience" };

export default async function ExperiencePage({
  params,
}: PageProps<"/diary/experiences/[id]">) {
  const { id } = await params;
  const entry = await getEntry("experience", id);
  const aiConfigured = isAiConfigured();
  const [linkedProblems, linkedNotes] = await Promise.all([
    resolveRelations(entry?.relatedProblems ?? []),
    resolveRelations(entry?.relatedNotes ?? []),
  ]);

  if (!entry) notFound();

  const bookmarked = await isBookmarked(id);

  return (
    <Page width="reading">
      <nav className="mb-6 flex items-center justify-between">
        <Link
          href="/diary/experiences"
          className="text-meta text-ink-muted hover:text-ink transition-colors"
        >
          ← All experiences
        </Link>
        <div className="flex items-center gap-1">
          <BookmarkButton id={id} initial={bookmarked} />
          <DeleteEntryButton type="experience" id={id} title={entry.title} />
        </div>
      </nav>

      <EntryEditor
        type="experience"
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
        }}
        aiConfigured={aiConfigured}
        linkedProblems={linkedProblems}
        linkedNotes={linkedNotes}
        placeholder="What happened?"
      />
    </Page>
  );
}

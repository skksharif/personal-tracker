import Link from "next/link";
import { notFound } from "next/navigation";

import { Page } from "@/components/shell/app-shell";
import { BookmarkButton } from "@/components/organise/bookmark-button";
import {
  DeleteNoteButton,
  NoteEditor,
} from "@/components/technical/note-editor";
import { isAiConfigured } from "@/lib/env";
import { getNote } from "@/lib/storage/notes";
import { isBookmarked } from "@/lib/storage/bookmarks";

export const metadata = { title: "CS Fundamentals" };

export default async function FundamentalPage({
  params,
}: PageProps<"/technical/fundamentals/[id]">) {
  const { id } = await params;
  const note = await getNote("fundamentals", id);

  if (!note) notFound();

  const bookmarked = await isBookmarked(id);

  return (
    <Page width="reading">
      <nav className="mb-6 flex items-center justify-between">
        <Link
          href="/technical/fundamentals"
          className="text-meta text-ink-muted hover:text-ink transition-colors"
        >
          ← All fundamentals
        </Link>
        <div className="flex items-center gap-1">
          <BookmarkButton id={id} initial={bookmarked} />
          <DeleteNoteButton kind="fundamentals" id={id} title={note.title} />
        </div>
      </nav>

      <NoteEditor
        kind="fundamentals"
        note={note}
        aiConfigured={isAiConfigured()}
      />
    </Page>
  );
}

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

export const metadata = { title: "System Design" };

export default async function DesignRecordPage({
  params,
}: PageProps<"/technical/design/[id]">) {
  const { id } = await params;
  const design = await getNote("design", id);

  if (!design) notFound();

  const bookmarked = await isBookmarked(id);

  return (
    <Page width="reading">
      <nav className="mb-6 flex items-center justify-between">
        <Link
          href="/technical/design"
          className="text-meta text-ink-muted hover:text-ink transition-colors"
        >
          ← All designs
        </Link>
        <div className="flex items-center gap-1">
          <BookmarkButton id={id} initial={bookmarked} />
          <DeleteNoteButton kind="design" id={id} title={design.title} />
        </div>
      </nav>

      <NoteEditor kind="design" note={design} aiConfigured={isAiConfigured()} />
    </Page>
  );
}

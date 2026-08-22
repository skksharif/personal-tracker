import { EntryList } from "@/components/organise/entry-list";
import { Page, PageHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/surface";
import { listBookmarks } from "@/lib/storage/bookmarks";

export const metadata = { title: "Bookmarks" };

/** The entries worth coming back to. */
export default async function BookmarksPage() {
  const bookmarks = await listBookmarks();

  return (
    <Page>
      <PageHeader
        meta={`${bookmarks.length} saved`}
        title="Bookmarks"
        description="Starred from an entry's own page. Nothing about the entry changes when you star it."
      />

      {bookmarks.length === 0 ? (
        <EmptyState
          title="Nothing bookmarked"
          description="Star a problem you want to revisit, a note you keep needing, or the day something clicked."
        />
      ) : (
        <EntryList records={bookmarks} />
      )}
    </Page>
  );
}

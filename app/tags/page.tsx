import { TagList } from "@/components/organise/tags";
import { Page, PageHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/surface";
import { summariseTags } from "@/lib/storage/tags";

export const metadata = { title: "Tags" };

/**
 * Every tag in the journal.
 *
 * The list is derived from the entries themselves rather than stored, so it
 * can never disagree with them.
 */
export default async function TagsPage() {
  const tags = await summariseTags();

  return (
    <Page>
      <PageHeader
        meta={`${tags.length} ${tags.length === 1 ? "tag" : "tags"}`}
        title="Tags"
        description="Derived from what your entries carry, so there is no second list to keep in step."
      />

      {tags.length === 0 ? (
        <EmptyState
          title="No tags yet"
          description="Tag a diary entry, a problem or a note and it shows up here."
        />
      ) : (
        <TagList tags={tags} />
      )}
    </Page>
  );
}

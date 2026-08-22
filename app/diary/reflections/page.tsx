import { Page, PageHeader } from "@/components/shell/app-shell";
import { NewEntryButton } from "@/components/diary/entry-collection";
import { EntryList } from "@/components/diary/entry-list";
import { EmptyState } from "@/components/ui/surface";
import { listEntries } from "@/lib/storage/entries";

export const metadata = { title: "Reflections" };

export default async function ReflectionsPage() {
  const entries = await listEntries("reflection");

  return (
    <Page>
      <PageHeader
        meta={`${entries.length} ${entries.length === 1 ? "reflection" : "reflections"}`}
        title="Reflections"
        description="Deeper than a day's entry. Motivation, doubt, what changed and why."
        action={<NewEntryButton type="reflection" label="New reflection" />}
      />

      {entries.length === 0 ? (
        <EmptyState
          title="No reflections yet"
          description="A reflection is for the things a daily entry doesn't hold — why something was hard, what you'd tell yourself a month ago."
        />
      ) : (
        <EntryList
          entries={entries}
          basePath="/diary/reflections"
          defaultTitle="Untitled reflection"
        />
      )}
    </Page>
  );
}

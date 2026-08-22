import { Page, PageHeader } from "@/components/shell/app-shell";
import { NewEntryButton } from "@/components/diary/entry-collection";
import { EntryList } from "@/components/diary/entry-list";
import { EmptyState } from "@/components/ui/surface";
import { listEntries } from "@/lib/storage/entries";

export const metadata = { title: "Life Experiences" };

export default async function ExperiencesPage() {
  const entries = await listEntries("experience");

  return (
    <Page>
      <PageHeader
        meta={`${entries.length} ${entries.length === 1 ? "experience" : "experiences"}`}
        title="Life Experiences"
        description="The things that happened around the preparation, not inside it."
        action={<NewEntryButton type="experience" label="New experience" />}
      />

      {entries.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="A move, an illness, a good week, a hard month. These shape the journey as much as the problems do."
        />
      ) : (
        <EntryList
          entries={entries}
          basePath="/diary/experiences"
          defaultTitle="Untitled experience"
        />
      )}
    </Page>
  );
}

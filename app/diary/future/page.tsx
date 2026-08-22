import { Page, PageHeader } from "@/components/shell/app-shell";
import { NewEntryButton } from "@/components/diary/entry-collection";
import { EntryList } from "@/components/diary/entry-list";
import { EmptyState } from "@/components/ui/surface";
import { isSealed, listEntries } from "@/lib/storage/entries";
import { today } from "@/lib/dates";

export const metadata = { title: "Dear Future Me" };

export default async function FuturePage() {
  const entries = await listEntries("letter");
  const now = today();
  const sealed = entries.filter((entry) => isSealed(entry, now)).length;

  return (
    <Page>
      <PageHeader
        meta={
          sealed > 0
            ? `${entries.length} ${entries.length === 1 ? "letter" : "letters"} · ${sealed} sealed`
            : `${entries.length} ${entries.length === 1 ? "letter" : "letters"}`
        }
        title="Dear Future Me"
        description="Written now, read later. A letter with an open date stays closed until then."
        action={<NewEntryButton type="letter" label="Write a letter" />}
      />

      {entries.length === 0 ? (
        <EmptyState
          title="No letters yet"
          description="Write to the version of you who has already been through the interview. Set a date, and it stays sealed until then."
        />
      ) : (
        <EntryList
          entries={entries}
          basePath="/diary/future"
          defaultTitle="Letter to future me"
        />
      )}
    </Page>
  );
}

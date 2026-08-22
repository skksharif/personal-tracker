import { Page, PageHeader } from "@/components/shell/app-shell";
import { NewNoteButton } from "@/components/technical/note-editor";
import { NoteList } from "@/components/technical/note-list";
import { EmptyState } from "@/components/ui/surface";
import { listNotes } from "@/lib/storage/notes";

export const metadata = { title: "Learning Notes" };

export default async function NotesPage() {
  const notes = await listNotes("learning");

  return (
    <Page>
      <PageHeader
        meta={`${notes.length} ${notes.length === 1 ? "note" : "notes"}`}
        title="Learning Notes"
        description="Concepts in your own words, rather than a problem at a time."
        action={<NewNoteButton kind="learning" label="New note" />}
      />

      {notes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Write down the thing you keep having to look up. Code fences are highlighted."
        />
      ) : (
        <NoteList kind="learning" notes={notes} />
      )}
    </Page>
  );
}

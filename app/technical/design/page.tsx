import { Page, PageHeader } from "@/components/shell/app-shell";
import { NewNoteButton } from "@/components/technical/note-editor";
import { NoteList } from "@/components/technical/note-list";
import { EmptyState } from "@/components/ui/surface";
import { listNotes } from "@/lib/storage/notes";

export const metadata = { title: "System Design" };

export default async function DesignPage() {
  const designs = await listNotes("design");

  return (
    <Page>
      <PageHeader
        meta={`${designs.length} ${designs.length === 1 ? "design" : "designs"}`}
        title="System Design"
        description="Requirements, architecture, what you'd change, and what it cost."
        action={<NewNoteButton kind="design" label="New design" />}
      />

      {designs.length === 0 ? (
        <EmptyState
          title="No designs yet"
          description="A new design opens with the section headings already in place. Diagrams go in a ```mermaid block."
        />
      ) : (
        <NoteList kind="design" notes={designs} />
      )}
    </Page>
  );
}

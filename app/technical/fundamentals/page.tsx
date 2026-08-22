import { Page, PageHeader } from "@/components/shell/app-shell";
import { NewNoteButton } from "@/components/technical/note-editor";
import { NoteList } from "@/components/technical/note-list";
import { EmptyState } from "@/components/ui/surface";
import { listNotes } from "@/lib/storage/notes";
import { SUBJECTS } from "@/lib/technical";

export const metadata = { title: "CS Fundamentals" };

/**
 * Fundamentals, grouped by subject.
 *
 * The grouping is the point — an interview asks about operating systems or
 * concurrency, not about "note 14" — so notes without a subject are collected
 * at the end rather than hidden.
 */
export default async function FundamentalsPage() {
  const notes = await listNotes("fundamentals");

  const bySubject = new Map<string, typeof notes>();
  for (const note of notes) {
    const key = note.subject ?? "Unsorted";
    const bucket = bySubject.get(key);
    if (bucket) bucket.push(note);
    else bySubject.set(key, [note]);
  }

  // Known subjects in their canonical order, then anything else.
  const ordered = [
    ...SUBJECTS.filter((subject) => bySubject.has(subject)),
    ...[...bySubject.keys()].filter(
      (key) => !SUBJECTS.includes(key as (typeof SUBJECTS)[number]),
    ),
  ];

  return (
    <Page>
      <PageHeader
        meta={`${notes.length} ${notes.length === 1 ? "note" : "notes"}`}
        title="CS Fundamentals"
        description="Operating systems, databases, networking — the questions that aren't algorithms."
        action={<NewNoteButton kind="fundamentals" label="New note" />}
      />

      {notes.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Pick a subject you'd struggle to explain out loud, and write it down."
        />
      ) : (
        <div className="space-y-8">
          {ordered.map((subject) => (
            <section key={subject}>
              <h2 className="text-meta text-ink-muted border-line mb-1 border-b py-2">
                {subject}
              </h2>
              <NoteList
                kind="fundamentals"
                notes={bySubject.get(subject) ?? []}
              />
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}

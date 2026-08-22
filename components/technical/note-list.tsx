import Link from "next/link";

import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { formatDayShort } from "@/lib/dates";
import type { Note } from "@/lib/storage/notes";
import { NOTE_LABELS, NOTE_PATHS, type NoteKind } from "@/lib/technical";

/** A list of notes, fundamentals or designs. Identical in shape, so shared. */
export function NoteList({ kind, notes }: { kind: NoteKind; notes: Note[] }) {
  return (
    <ul>
      {notes.map((note, position) => (
        <li key={note.id}>
          {position > 0 ? <hr className="border-line border-t" /> : null}

          <Link
            href={`${NOTE_PATHS[kind]}/${note.id}`}
            className={cn(
              "group -mx-3 block rounded-md px-3 py-3.5 transition-colors",
              "hover:bg-surface-sunken",
            )}
          >
            <div className="flex items-baseline gap-3">
              <h2 className="text-ink group-hover:text-accent min-w-0 truncate font-medium transition-colors">
                {note.title || NOTE_LABELS[kind].defaultTitle}
              </h2>
              <span className="text-meta text-ink-muted ml-auto shrink-0 tabular-nums">
                {formatDayShort(note.date)}
              </span>
            </div>

            {note.body.trim() ? (
              <p className="text-small text-ink-muted mt-1 line-clamp-2">
                {note.body
                  .replace(/```[\s\S]*?```/g, " ")
                  .replace(/[#*_`>![\]]/g, "")
                  .trim()
                  .slice(0, 200)}
              </p>
            ) : (
              <p className="text-small text-ink-faint mt-1 italic">
                Nothing written yet.
              </p>
            )}

            {note.subject || note.tags.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {note.subject ? <Tag tone="accent">{note.subject}</Tag> : null}
                {note.tags.slice(0, 4).map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

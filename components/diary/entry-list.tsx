import Link from "next/link";

import { cn } from "@/lib/cn";
import { formatDay, today } from "@/lib/dates";
import { isSealed, type Entry } from "@/lib/storage/entries";

/**
 * A list of reflections, experiences or letters.
 *
 * Shared across all three because they differ only in wording — the shape of
 * the record and the way it is read are identical.
 */
export function EntryList({
  entries,
  basePath,
  defaultTitle,
}: {
  entries: Entry[];
  basePath: string;
  defaultTitle: string;
}) {
  const now = today();

  return (
    <ul className="space-y-0">
      {entries.map((entry, position) => {
        const sealed = isSealed(entry, now);

        return (
          <li key={entry.id}>
            {position > 0 ? <hr className="border-line my-1 border-t" /> : null}

            <Link
              href={`${basePath}/${entry.id}`}
              className={cn(
                "group -mx-3 block rounded-md px-3 py-4 transition-colors",
                "hover:bg-surface-sunken",
              )}
            >
              <p className="text-meta text-ink-muted">
                {formatDay(entry.date)}
                {entry.mood ? ` · ${entry.mood}` : ""}
              </p>

              <h3 className="text-title text-ink group-hover:text-accent mt-1 transition-colors">
                {entry.title || defaultTitle}
              </h3>

              {sealed ? (
                <p className="text-small text-ink-faint mt-1 italic">
                  Sealed until {formatDay(entry.openOn!)}.
                </p>
              ) : entry.body ? (
                <p className="text-small text-ink-muted mt-1 line-clamp-2">
                  {entry.body.replace(/[#*_`>![\]]/g, "").slice(0, 200)}
                </p>
              ) : (
                <p className="text-small text-ink-faint mt-1 italic">
                  Nothing written yet.
                </p>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

import Link from "next/link";

import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { formatDayShort } from "@/lib/dates";
import type { IndexRecord } from "@/lib/storage/index-store";
import { ENTRY_TYPES } from "@/lib/types";

/**
 * A list of index records.
 *
 * Search, tags and bookmarks all answer the same question — "which of my
 * entries are these?" — so they share one row rather than three that drift.
 * A Server Component: nothing here is interactive beyond the link itself.
 */
export function EntryList({
  records,
  showType = true,
  footnote,
}: {
  records: IndexRecord[];
  showType?: boolean;
  /** Extra line under a row, e.g. why a search matched. */
  footnote?: (record: IndexRecord) => string | undefined;
}) {
  return (
    <ul>
      {records.map((record, position) => {
        const note = footnote?.(record);

        return (
          <li key={record.id}>
            {position > 0 ? <hr className="border-line border-t" /> : null}

            <Link
              href={record.href}
              className={cn(
                "group -mx-3 block rounded-md px-3 py-3.5 transition-colors",
                "hover:bg-surface-sunken focus-visible:bg-surface-sunken",
              )}
            >
              <div className="flex items-baseline gap-3">
                <span className="text-ink group-hover:text-accent min-w-0 flex-1 truncate font-medium transition-colors">
                  {record.title}
                </span>

                {showType ? (
                  <span className="text-meta text-ink-faint shrink-0">
                    {ENTRY_TYPES[record.type].label}
                  </span>
                ) : null}

                <time
                  dateTime={record.date}
                  className="text-meta text-ink-muted shrink-0 tabular-nums"
                >
                  {formatDayShort(record.date)}
                </time>
              </div>

              {record.excerpt ? (
                <p className="text-small text-ink-muted mt-1 line-clamp-2">
                  {record.excerpt}
                </p>
              ) : null}

              {record.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {record.tags.slice(0, 4).map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                  {record.tags.length > 4 ? (
                    <span className="text-meta text-ink-faint self-center">
                      +{record.tags.length - 4}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {note ? (
                <p className="text-meta text-ink-faint mt-1.5">{note}</p>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { searchIndexAction } from "@/app/actions/search";
import { Spinner } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Tag } from "@/components/ui/tag";
import type { IndexRecord } from "@/lib/storage/index-store";
import { ENTRY_TYPES, type EntryType } from "@/lib/types";

/**
 * Links this entry to something else in the journal.
 *
 * Searches the index, so anything already recorded — a problem, a note, a
 * design — can be attached in a couple of keystrokes. The link is stored on
 * this side and surfaced on the other, which is what lets a problem page show
 * the days it was written about.
 *
 * What is already linked arrives resolved from the server (`initialLinked`),
 * so opening an entry costs no round trip, and every change after that comes
 * from an interaction where the full record is already in hand. That is why
 * there is no data-fetching effect here.
 */
export function RelationPicker({
  value,
  onChange,
  initialLinked = [],
  types,
  placeholder = "Search the journal…",
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  /** Records for `value`, resolved server-side. */
  initialLinked?: IndexRecord[];
  /** Restrict what can be linked. Omit to search everything. */
  types?: EntryType[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IndexRecord[]>([]);
  const [linked, setLinked] = useState<IndexRecord[]>(initialLinked);
  const [searching, setSearching] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = useRef(0);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const search = useCallback(
    (text: string) => {
      if (timer.current) clearTimeout(timer.current);

      if (text.trim().length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }

      setSearching(true);

      timer.current = setTimeout(async () => {
        // Ignore a slow response that lands after a newer keystroke.
        const ticket = ++run.current;
        const found = await searchIndexAction(text, types);
        if (ticket !== run.current) return;

        setResults(found.filter((record) => !value.includes(record.id)));
        setSearching(false);
      }, 250);
    },
    [types, value],
  );

  const add = (record: IndexRecord) => {
    onChange([...value, record.id]);
    setLinked((current) => [...current, record]);
    setQuery("");
    setResults([]);
  };

  const remove = (id: string) => {
    onChange(value.filter((linkedId) => linkedId !== id));
    setLinked((current) => current.filter((record) => record.id !== id));
  };

  return (
    <div className="space-y-2">
      {linked.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {linked.map((record) => (
            <li key={record.id}>
              <Tag
                tone="accent"
                onRemove={() => remove(record.id)}
                removeLabel={`Unlink ${record.title}`}
              >
                {record.title}
              </Tag>
            </li>
          ))}
        </ul>
      ) : null}

      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          search(event.target.value);
        }}
        placeholder={placeholder}
        aria-label="Search the journal to link something"
      />

      {query.trim().length >= 2 ? (
        <div className="border-line bg-surface overflow-hidden rounded-md border">
          {searching && results.length === 0 ? (
            <p className="text-meta text-ink-muted flex items-center gap-2 p-3">
              <Spinner />
              Looking…
            </p>
          ) : results.length === 0 ? (
            <p className="text-meta text-ink-muted p-3">
              Nothing matches. Only things already recorded can be linked.
            </p>
          ) : (
            <ul>
              {results.map((record) => (
                <li key={record.id}>
                  <button
                    type="button"
                    onClick={() => add(record)}
                    className="hover:bg-surface-sunken w-full px-3 py-2 text-left transition-colors"
                  >
                    <span className="text-small text-ink block truncate">
                      {record.title}
                    </span>
                    <span className="text-meta text-ink-muted">
                      {ENTRY_TYPES[record.type].label} · {record.date}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

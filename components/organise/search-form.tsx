"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { ENTRY_TYPES, type EntryType } from "@/lib/types";

/**
 * The search box and its filters.
 *
 * Everything lives in the URL, so a search can be linked, bookmarked and
 * returned to — and the results themselves stay a Server Component, which is
 * what keeps a large journal fast to search.
 */
export function SearchForm({
  typeCounts,
}: {
  typeCounts: Partial<Record<EntryType, number>>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const push = (next: URLSearchParams) => {
    const search = next.toString();
    router.replace(search ? `/search?${search}` : "/search", { scroll: false });
  };

  const onQueryChange = (value: string) => {
    setQuery(value);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      push(next);
    }, 300);
  };

  const toggleType = (type: EntryType) => {
    const next = new URLSearchParams(params.toString());
    const active = next.getAll("type");

    next.delete("type");
    for (const value of active.filter((v) => v !== type)) {
      next.append("type", value);
    }
    if (!active.includes(type)) next.append("type", type);

    push(next);
  };

  const activeTypes = params.getAll("type");
  const available = (Object.keys(ENTRY_TYPES) as EntryType[]).filter(
    (type) => (typeCounts[type] ?? 0) > 0,
  );

  return (
    <div>
      <Input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search everything you've written…"
        aria-label="Search the journal"
        autoFocus
      />

      {available.length > 0 ? (
        <div
          role="group"
          aria-label="Filter by type"
          className="mt-3 flex flex-wrap gap-2"
        >
          {available.map((type) => {
            const active = activeTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                aria-pressed={active}
                className={cn(
                  "text-meta rounded-full px-3 py-1.5 transition-colors",
                  active
                    ? "bg-accent-soft text-accent"
                    : "bg-surface-sunken text-ink-secondary hover:text-ink",
                )}
              >
                {ENTRY_TYPES[type].plural}
                <span className="text-ink-faint ml-1.5 tabular-nums">
                  {typeCounts[type]}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";

import { toggleBookmarkAction } from "@/app/actions/organise";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

/**
 * Star an entry.
 *
 * Optimistic on purpose: a star is cosmetic and instant feedback is the whole
 * point of it. If the write fails the star goes back and the toast says so —
 * nothing about the entry itself is at risk either way.
 */
export function BookmarkButton({
  id,
  initial,
  className,
}: {
  id: string;
  initial: boolean;
  className?: string;
}) {
  const [bookmarked, setBookmarked] = useState(initial);
  const [pending, startTransition] = useTransition();
  const { show } = useToast();

  const toggle = () => {
    const optimistic = !bookmarked;
    setBookmarked(optimistic);

    startTransition(async () => {
      const result = await toggleBookmarkAction(id);

      if (result.status === "error") {
        setBookmarked(!optimistic);
        show(result.message ?? "Couldn't save that bookmark.", "danger");
        return;
      }

      setBookmarked(result.bookmarked ?? optimistic);
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={bookmarked}
      title={bookmarked ? "Remove bookmark" : "Bookmark this"}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md transition-colors",
        bookmarked
          ? "text-accent hover:bg-surface-sunken"
          : "text-ink-faint hover:text-ink-secondary hover:bg-surface-sunken",
        className,
      )}
    >
      <span className="sr-only">
        {bookmarked ? "Remove bookmark" : "Bookmark this entry"}
      </span>

      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="size-5"
        fill={bookmarked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      >
        <path d="M5 3.5h10a.5.5 0 0 1 .5.5v12.2a.3.3 0 0 1-.47.25L10 13.2l-5.03 3.25a.3.3 0 0 1-.47-.25V4a.5.5 0 0 1 .5-.5Z" />
      </svg>
    </button>
  );
}

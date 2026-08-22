"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { daysBetween, formatDay, today } from "@/lib/dates";
import type { Entry } from "@/lib/storage/entries";

/**
 * Wraps a letter that is not yet due.
 *
 * The seal is a promise the user made to themselves, so the default is to keep
 * it — but the content is their own writing in a plain file on their own
 * machine, and pretending otherwise would be theatre. One deliberate click
 * opens it.
 */
export function SealedLetter({
  entry,
  children,
}: {
  entry: Entry;
  children: ReactNode;
}) {
  const [opened, setOpened] = useState(false);

  if (opened) return <>{children}</>;

  const daysLeft = entry.openOn ? daysBetween(today(), entry.openOn) : 0;

  return (
    <Surface className="py-16 text-center">
      <p className="text-meta text-ink-muted">
        Written {formatDay(entry.date)}
      </p>

      <h1 className="text-title text-ink mt-2">
        {entry.title || "Letter to future me"}
      </h1>

      <p className="text-small text-ink-muted mx-auto mt-4 max-w-sm">
        Sealed until {formatDay(entry.openOn ?? entry.date)} —{" "}
        {daysLeft === 1 ? "tomorrow" : `${daysLeft} days from now`}. It stays
        out of your timeline and away from AI until then.
      </p>

      <div className="mt-8">
        <Button onClick={() => setOpened(true)}>Open it early</Button>
      </div>
    </Surface>
  );
}

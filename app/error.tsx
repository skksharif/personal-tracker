"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Page } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Page-level error boundary.
 *
 * The tone is set by the spec: say what happened, say the user's content is
 * safe, offer a way forward. No stack traces, no apologising, no blame.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Nothing is written to disk here — the detail belongs in the dev console,
    // not on the page.
    console.error(error);
  }, [error]);

  return (
    <Page width="reading">
      <h1 className="text-page text-ink font-medium tracking-tight">
        Something went wrong on this page.
      </h1>

      <p className="text-body text-ink-secondary mt-3">
        Nothing was lost. Your journal is on disk exactly as you left it.
      </p>

      <div className="mt-8 flex gap-3">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <Link
          href="/"
          className={cn(
            "border-line inline-flex h-11 items-center rounded-md border",
            "bg-surface text-small text-ink px-4 font-medium transition-colors",
            "hover:border-line-strong hover:bg-surface-sunken",
          )}
        >
          Back to the journey
        </Link>
      </div>

      {process.env.NODE_ENV === "development" ? (
        <pre className="bg-surface-sunken text-meta text-ink-secondary mt-10 overflow-x-auto rounded-md p-4 font-mono">
          {error.message}
        </pre>
      ) : null}
    </Page>
  );
}

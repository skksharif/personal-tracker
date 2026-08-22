import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import {
  BottomNav,
  MobileHeader,
  SideNav,
} from "@/components/shell/navigation";

/**
 * The frame every page lives in.
 *
 * Mobile is the baseline: one column, a compact header, a bottom bar.
 * Desktop is a different layout rather than a stretched one — a left rail, a
 * centred reading column, and an optional right context panel that disappears
 * below `xl` instead of squeezing the content.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <SideNav />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />

        {/*
          Bottom padding clears the mobile navigation bar so the last line of
          an entry is never hidden behind it.
        */}
        <main id="content" className="flex-1 pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}

/**
 * A standard page: a reading column with room to breathe.
 *
 * `context` fills the right-hand panel on wide screens — AI output, tags,
 * progress. It is supplementary by definition, so it is simply not rendered
 * when there is no room for it.
 */
export function Page({
  children,
  context,
  className,
  width = "content",
}: {
  children: ReactNode;
  context?: ReactNode;
  className?: string;
  /** `reading` for long-form prose, `content` for lists and forms. */
  width?: "reading" | "content";
}) {
  return (
    <div className="flex justify-center gap-10 px-5 py-10 sm:px-8 lg:py-16">
      <div
        className={cn(
          "min-w-0 flex-1",
          width === "reading" ? "max-w-reading" : "max-w-content",
          className,
        )}
      >
        {children}
      </div>

      {context ? (
        <aside className="hidden w-72 shrink-0 xl:block">
          <div className="sticky top-10 space-y-6">{context}</div>
        </aside>
      ) : null}
    </div>
  );
}

/**
 * Page heading. `action` holds the single primary action the screen is
 * organised around — UX rule 3.
 */
export function PageHeader({
  title,
  meta,
  description,
  action,
}: {
  title: string;
  /** Small line above the title: a date, a count, a status. */
  meta?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-section">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {meta ? <p className="text-meta text-ink-muted">{meta}</p> : null}
          <h1 className="text-page text-ink mt-1 font-medium tracking-tight">
            {title}
          </h1>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {description ? (
        <p className="text-small text-ink-secondary mt-3">{description}</p>
      ) : null}
    </header>
  );
}

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * A grouped block of content.
 *
 * Called `Surface` rather than `Card` deliberately: the design direction warns
 * against excessive cards, so the default is a tinted region with no border and
 * no shadow. Borders are opt-in for the rare case that needs one.
 */
export function Surface({
  children,
  className,
  bordered = false,
  raised = false,
  as: Component = "div",
  role,
}: {
  children: ReactNode;
  className?: string;
  bordered?: boolean;
  raised?: boolean;
  as?: "div" | "section" | "article" | "aside";
  /** For the cases where a surface carries a live message, e.g. an error. */
  role?: string;
}) {
  return (
    <Component
      role={role}
      className={cn(
        "rounded-lg p-4",
        raised
          ? "bg-surface-raised shadow-[var(--shadow-raised)]"
          : "bg-surface-sunken",
        bordered && "border-line border",
        className,
      )}
    >
      {children}
    </Component>
  );
}

/** A quiet horizontal rule. Prefer whitespace; use this only where a break is genuinely ambiguous. */
export function Separator({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  if (label) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <span className="bg-line h-px flex-1" />
        <span className="text-meta text-ink-muted">{label}</span>
        <span className="bg-line h-px flex-1" />
      </div>
    );
  }
  return <hr className={cn("border-line border-0 border-t", className)} />;
}

/**
 * Shown where content would be. Empty states carry real copy — an empty diary
 * is the normal state on day one, not an error.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("py-16 text-center", className)}>
      <p className="text-title text-ink">{title}</p>
      {description ? (
        <p className="text-small text-ink-muted mx-auto mt-2 max-w-sm">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

/** Placeholder block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-surface-sunken animate-pulse rounded", className)}
    />
  );
}

/**
 * The standard loading treatment for a page of entries: a few lines of
 * greyed-out text rather than a spinner.
 */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn("h-4", index === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

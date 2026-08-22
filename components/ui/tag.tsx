import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "ai" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-ink-secondary",
  accent: "bg-accent-soft text-accent",
  ai: "bg-ai-soft text-ai",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

/*
 * Deliberately *not* a client component. A tag is a coloured span, and it is
 * rendered by more Server Components than client ones — timeline rows, problem
 * lists, search results. Marking this file "use client" would drag all of them
 * across the boundary for a label. `onRemove` is only ever passed from a client
 * component, which is where the handler is allowed to exist.
 */

export interface TagProps {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  /** When given, the tag shows a remove control. */
  onRemove?: () => void;
  /** Describes what is being removed, for screen readers. */
  removeLabel?: string;
}

export function Tag({
  children,
  tone = "neutral",
  className,
  onRemove,
  removeLabel,
}: TagProps) {
  return (
    <span
      className={cn(
        "text-meta inline-flex items-center gap-1 rounded-full px-2.5 py-1",
        tones[tone],
        className,
      )}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? `Remove ${String(children)}`}
          className="ml-0.5 rounded-full opacity-60 transition-opacity hover:opacity-100"
        >
          <svg
            viewBox="0 0 12 12"
            className="size-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
          </svg>
        </button>
      ) : null}
    </span>
  );
}

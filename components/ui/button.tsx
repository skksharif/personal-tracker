import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "ai" | "danger";
type Size = "sm" | "md" | "lg";

/*
 * `cursor-pointer` is explicit because it has to be: a `<button>` defaults to
 * the arrow cursor, and Tailwind's reset does not change that. Without it the
 * whole app reads as unclickable.
 *
 * Disabled buttons keep their pointer events. The `disabled` attribute already
 * blocks the click, and switching them off as well would suppress the `title`
 * that several buttons use to explain *why* they are disabled.
 */
const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium " +
  "transition-colors duration-150 select-none cursor-pointer " +
  "disabled:cursor-not-allowed disabled:opacity-45";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  secondary:
    "bg-surface text-ink border border-control-border hover:bg-surface-sunken hover:border-ink-faint",
  ghost: "text-ink-secondary hover:bg-surface-sunken hover:text-ink",
  // Violet marks AI throughout the product, so its affordances are recognisable
  // before the label is read.
  ai: "bg-ai-soft text-ai hover:bg-ai hover:text-surface",
  danger: "bg-danger-soft text-danger hover:bg-danger hover:text-surface",
};

/*
 * Minimum 44px tall at `md` and above — the spec asks for touch-friendly
 * targets, and the diary is meant to be written from a phone.
 */
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-meta",
  md: "h-11 px-4 text-small",
  lg: "h-12 px-6 text-body",
};

/**
 * The waiting indicator.
 *
 * Drawn at `1em` so it matches whatever text it sits beside, and it takes the
 * icon slot rather than adding a third element — a button that grows when you
 * press it shifts everything next to it.
 *
 * Under `prefers-reduced-motion` the global rule in `globals.css` collapses
 * every animation, so this stops turning and simply sits there. That is the
 * right outcome and not a gap: the label beside it already says "Saving…",
 * which is what actually carries the meaning.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cn("size-[1em] shrink-0 animate-spin", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      {/* The faint ring gives the moving arc something to travel around. */}
      <circle cx="8" cy="8" r="6" className="opacity-25" />
      <path d="M14 8a6 6 0 0 0-6-6" />
    </svg>
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Rendered before the label. Decorative — give the button a real label too. */
  icon?: ReactNode;
  /**
   * Work is in flight. Shows a spinner in the icon slot and stops the button
   * being pressed again, so a slow save cannot be submitted twice.
   */
  loading?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  loading = false,
  className,
  children,
  type = "button",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading ? (
        <Spinner />
      ) : icon ? (
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Required: an icon alone is not a label. */
  label: string;
  loading?: boolean;
}

const iconSizes: Record<Size, string> = {
  sm: "size-9",
  md: "size-11",
  lg: "size-12",
};

export function IconButton({
  variant = "ghost",
  size = "md",
  label,
  loading = false,
  className,
  children,
  type = "button",
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], iconSizes[size], "p-0", className)}
      {...props}
    >
      <span aria-hidden="true">{loading ? <Spinner /> : children}</span>
    </button>
  );
}

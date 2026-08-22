import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "ai" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium " +
  "transition-colors duration-150 select-none " +
  "disabled:pointer-events-none disabled:opacity-45";

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

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Rendered before the label. Decorative — give the button a real label too. */
  icon?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {icon ? (
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
  className,
  children,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(base, variants[variant], iconSizes[size], "p-0", className)}
      {...props}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

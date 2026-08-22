"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/cn";

/**
 * Form controls.
 *
 * Two shapes, on purpose. `Field` is the labelled, bordered control used in
 * settings and metadata. `Bare` variants have no chrome at all and are for the
 * diary editor, where a border around the writing would make it feel like a
 * database form — UX rule 4.
 */

const control =
  "w-full rounded-md border border-control-border bg-surface px-3 py-2.5 text-body " +
  "text-ink transition-colors placeholder:text-ink-faint " +
  "hover:border-ink-faint focus:border-accent focus:outline-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-accent disabled:opacity-50";

interface FieldWrapperProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** Right-aligned slot on the label row — where AI assist buttons live. */
  action?: ReactNode;
  children: (ids: { id: string; describedBy?: string }) => ReactNode;
}

export function Field({
  label,
  hint,
  error,
  action,
  children,
}: FieldWrapperProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={id}
          className="text-meta text-ink-secondary font-medium"
        >
          {label}
        </label>
        {action}
      </div>

      {children({ id, describedBy })}

      {hint && !error ? (
        <p id={hintId} className="text-meta text-ink-muted">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-meta text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return <input className={cn(control, className)} {...props} />;
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select className={cn(control, "pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Grow to fit content instead of scrolling. */
  autoGrow?: boolean;
  /** Rows to show before growing. */
  minRows?: number;
  /**
   * The caller needs the element to read the caret position — the diary
   * inserts images where the cursor is. Merged with the internal ref used
   * for auto-growing.
   */
  ref?: Ref<HTMLTextAreaElement>;
}

/**
 * Textarea that grows with its content.
 *
 * A scrollbar inside the writing area breaks the sense of a continuous page,
 * so the element resizes to fit and the page scrolls instead.
 */
export function Textarea({
  autoGrow = true,
  minRows = 3,
  className,
  onChange,
  value,
  ref: externalRef,
  ...props
}: TextareaProps) {
  const innerRef = useRef<HTMLTextAreaElement>(null);

  const setRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof externalRef === "function") externalRef(node);
      else if (externalRef) externalRef.current = node;
    },
    [externalRef],
  );

  const resize = () => {
    const element = innerRef.current;
    if (!element || !autoGrow) return;

    const previous = element.style.height;
    element.style.height = "auto";
    const measured = element.scrollHeight;

    /*
     * A hidden element measures zero, and this runs on mount — including
     * inside a `<dialog>` that has not been shown yet, where applying the
     * measurement would collapse the field to a sliver. Keep whatever height
     * it had and let the next change re-fit it.
     */
    element.style.height = measured > 0 ? `${measured}px` : previous;
  };

  // Re-fit when the value changes from outside (AI suggestions, drafts).
  useEffect(resize, [value, autoGrow]);

  return (
    <textarea
      ref={setRef}
      rows={minRows}
      value={value}
      onChange={(event) => {
        resize();
        onChange?.(event);
      }}
      className={cn(
        control,
        autoGrow && "resize-none overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The diary title. No border, no background — it reads as the document's
 * heading, not as a form field.
 */
export function BareInput({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "text-page w-full border-0 bg-transparent p-0 font-medium tracking-tight",
        "text-ink placeholder:text-ink-faint focus:outline-none",
        "focus-visible:outline-2 focus-visible:outline-offset-4",
        "focus-visible:outline-accent",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The diary body. Serif, generous leading, no chrome — the page is the field.
 */
export function BareTextarea({ className, ...props }: TextareaProps) {
  return (
    <Textarea
      className={cn(
        "border-0 bg-transparent p-0 font-serif leading-[1.75]",
        "focus:outline-none focus-visible:outline-2",
        "focus-visible:outline-accent focus-visible:outline-offset-4",
        className,
      )}
      {...props}
    />
  );
}

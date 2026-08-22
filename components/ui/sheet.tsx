"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/button";

/**
 * Overlays, built on the native `<dialog>` element.
 *
 * Focus trapping, Escape to dismiss, background inerting and the backdrop are
 * all browser behaviour here. A hand-rolled focus trap is a common source of
 * keyboard-accessibility bugs, and there is no reason to own one.
 *
 * `Sheet` is the AI surface: a bottom sheet on mobile, a right panel on
 * desktop, per the design spec. `Dialog` is a centred box for confirmations.
 */

function useNativeDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // `showModal` inerts the background but does not stop it scrolling.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    // Fires for Escape as well as programmatic close, so state stays in sync.
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  /** Clicks land on the dialog itself only when they hit the backdrop. */
  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === ref.current) onClose();
  };

  return { ref, handleBackdropClick };
}

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Small line under the title — used for the AI context disclosure. */
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: SheetProps) {
  const { ref, handleBackdropClick } = useNativeDialog(open, onClose);

  return (
    <dialog
      ref={ref}
      onClick={handleBackdropClick}
      aria-label={title}
      className={cn(
        "app-sheet text-ink m-0 bg-transparent p-0 backdrop:bg-transparent",
        // Mobile: pinned to the bottom, full width.
        "mt-auto mb-0 ml-0 max-h-[85dvh] w-full max-w-full",
        // Desktop: a panel on the right, full height.
        "sm:mt-0 sm:ml-auto sm:h-full sm:max-h-full sm:w-[26rem]",
      )}
    >
      <div
        className={cn(
          "bg-surface flex h-full max-h-[85dvh] flex-col shadow-[var(--shadow-sheet)]",
          "rounded-t-[var(--radius-sheet)] sm:max-h-full sm:rounded-none",
          "sm:border-line sm:border-l",
        )}
      >
        <header className="border-line flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-title text-ink">{title}</h2>
            {description ? (
              <p className="text-meta text-ink-muted mt-1">{description}</p>
            ) : null}
          </div>
          <IconButton label="Close" size="sm" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {footer ? (
          <footer className="border-line border-t px-5 py-3">{footer}</footer>
        ) : null}
      </div>
    </dialog>
  );
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: DialogProps) {
  const { ref, handleBackdropClick } = useNativeDialog(open, onClose);

  return (
    <dialog
      ref={ref}
      onClick={handleBackdropClick}
      aria-label={title}
      className={cn(
        "app-dialog border-line m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border",
        "bg-surface text-ink p-0 shadow-[var(--shadow-sheet)]",
      )}
    >
      <div className="px-5 py-4">
        <h2 className="text-title text-ink">{title}</h2>
        {children ? (
          <div className="text-small text-ink-secondary mt-2">{children}</div>
        ) : null}
      </div>
      {footer ? (
        <div className="border-line flex justify-end gap-2 border-t px-5 py-3">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

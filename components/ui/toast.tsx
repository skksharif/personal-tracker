"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

/**
 * Transient messages.
 *
 * Deliberately quiet: no icons, no colour by default, no progress bars. A
 * toast reports that something happened; errors that need a decision belong in
 * the page, next to the content they concern.
 */

type ToastTone = "neutral" | "success" | "danger";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const tones: Record<ToastTone, string> = {
  neutral: "bg-ink text-ink-inverted",
  success: "bg-success text-surface",
  danger: "bg-danger text-surface",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = "neutral") => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, tone }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), tone === "danger" ? 8000 : 4000),
      );
    },
    [dismiss],
  );

  // Clear pending timers on unmount so nothing fires into a dead tree.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/*
        `polite` so a save confirmation never interrupts what a screen reader
        is already reading — the diary is the priority, not the notification.
      */}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2",
          // Clear of the mobile bottom navigation.
          "bottom-20 px-4 lg:bottom-6",
        )}
      >
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            onClick={() => dismiss(toast.id)}
            className={cn(
              "text-small pointer-events-auto max-w-sm rounded-md px-4 py-2.5 shadow-[var(--shadow-sheet)]",
              tones[toast.tone],
            )}
          >
            {toast.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return context;
}

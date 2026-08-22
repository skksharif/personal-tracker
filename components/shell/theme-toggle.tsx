"use client";

import { useSyncExternalStore } from "react";

import { cn } from "@/lib/cn";

/**
 * Theme control.
 *
 * Three states, cycled in order: System, Light, Dark. "System" is the default
 * and is a real option rather than an absence — someone journalling at night
 * with an OS-scheduled dark mode should not have to think about this.
 *
 * The choice is written to `data-theme` on `<html>`, which the token blocks in
 * globals.css key off. `THEME_SCRIPT` below applies it before first paint.
 */

export type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "journey-theme";
const ORDER: Theme[] = ["system", "light", "dark"];

const LABELS: Record<Theme, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

/**
 * Runs before paint to stop a light flash on a dark-themed reload. Kept as a
 * string because it must execute ahead of hydration, not as part of it.
 */
export const THEME_SCRIPT = `
try {
  var t = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {}
`.trim();

/* -------------------------------------------------------------------------- */
/* Theme store                                                                */
/* -------------------------------------------------------------------------- */

/*
 * `localStorage` is external state, so it is read through
 * `useSyncExternalStore` rather than mirrored into React state in an effect.
 * That gives a correct server snapshot for free — no hydration mismatch, and
 * no cascading render on mount.
 */

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Keeps a second tab in sync if the theme is changed there.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // Private browsing. Fall through to the default.
  }
  return "system";
}

/** The server cannot know the preference; "system" is the honest answer. */
function serverTheme(): Theme {
  return "system";
}

function setTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Persistence failed; the theme still applies for this session, which is
    // not worth interrupting the user over.
  }

  listeners.forEach((listener) => listener());
}

/* -------------------------------------------------------------------------- */

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);

  const cycle = () => {
    setTheme(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? "system");
  };

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${LABELS[theme]}. Change theme.`}
      className={cn(
        "text-meta flex h-9 items-center gap-2 rounded-md px-2.5 transition-colors",
        "text-ink-muted hover:bg-surface-sunken hover:text-ink",
      )}
    >
      <ThemeIcon theme={theme} />
      <span>{LABELS[theme]}</span>
    </button>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "size-4 shrink-0",
    "aria-hidden": true,
  };

  if (theme === "dark") {
    return (
      <svg {...props}>
        <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
      </svg>
    );
  }

  if (theme === "light") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
      </svg>
    );
  }

  return (
    <svg {...props}>
      <rect x="3" y="4.5" width="18" height="13" rx="1.5" />
      <path d="M8.5 20.5h7" />
    </svg>
  );
}

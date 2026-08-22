"use client";

import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Renders a Mermaid diagram.
 *
 * Mermaid is a large dependency, so it is imported dynamically and only when a
 * document actually contains a diagram — a note with no diagram costs nothing.
 *
 * The source stays visible on failure. A system design record is worth more as
 * readable text than as a broken picture, and a typo in a diagram should never
 * hide what was written.
 */
export function MermaidDiagram({ source }: { source: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);
  const id = useId().replace(/:/g, "");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;

        // Read the resolved token so diagrams follow the app's theme rather
        // than shipping their own palette.
        const styles = getComputedStyle(document.documentElement);
        const ink = styles.getPropertyValue("--ink").trim() || "#1c1b19";
        const line = styles.getPropertyValue("--line-strong").trim() || "#ccc";
        const surface =
          styles.getPropertyValue("--surface-sunken").trim() || "#f4f2ef";
        const accent = styles.getPropertyValue("--accent").trim() || "#2f5d8a";

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          fontFamily: "var(--font-sans)",
          themeVariables: {
            background: "transparent",
            primaryColor: surface,
            primaryTextColor: ink,
            primaryBorderColor: line,
            lineColor: accent,
            secondaryColor: surface,
            tertiaryColor: surface,
          },
        });

        const { svg } = await mermaid.render(`mermaid-${id}`, source);
        if (cancelled) return;

        if (container.current) {
          container.current.innerHTML = svg;
          setRendered(true);
        }
      } catch (failure) {
        if (!cancelled) {
          setError(
            failure instanceof Error ? failure.message : "Couldn't draw this.",
          );
        }
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [source, id]);

  return (
    <figure className="my-6">
      <div
        ref={container}
        className={cn("overflow-x-auto text-center", rendered ? "" : "hidden")}
      />

      {!rendered ? (
        <pre className="bg-surface-sunken text-meta overflow-x-auto rounded-md p-4 font-mono">
          {source}
        </pre>
      ) : null}

      {error ? (
        <figcaption className="text-meta text-danger mt-2">
          Diagram couldn&rsquo;t be drawn: {error}
        </figcaption>
      ) : null}
    </figure>
  );
}

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Chart primitives.
 *
 * Inline SVG rather than a charting library: these are simple shapes, and a
 * ~100KB dependency to draw a bar is exactly the "unnecessary client-side
 * JavaScript" the spec warns against. Everything here renders on the server.
 *
 * Shared rules, applied by construction:
 *   - bars cap at 24px thick, with a 4px rounded data-end
 *   - a 2px surface gap separates touching marks
 *   - gridlines are hairline, solid, and recessive
 *   - text wears ink tokens; only marks wear chart colours
 *   - every chart is followed by the same numbers as readable text
 */

/* -------------------------------------------------------------------------- */
/* Frame                                                                      */
/* -------------------------------------------------------------------------- */

export function Figure({
  title,
  caption,
  children,
  table,
}: {
  title: string;
  caption?: ReactNode;
  children: ReactNode;
  /**
   * The same data as text. Required — a chart is never the only way to read a
   * number here, which is what makes these pages usable without sight of the
   * marks.
   */
  table: ReactNode;
}) {
  return (
    <figure className="mb-section">
      <figcaption className="mb-3">
        <h2 className="text-title text-ink">{title}</h2>
        {caption ? (
          <p className="text-small text-ink-muted mt-1">{caption}</p>
        ) : null}
      </figcaption>

      {children}

      <details className="mt-4">
        <summary className="text-meta text-ink-muted hover:text-ink cursor-pointer">
          Show the numbers
        </summary>
        <div className="mt-3 overflow-x-auto">{table}</div>
      </details>
    </figure>
  );
}

export function DataTable({
  head,
  rows,
}: {
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="text-small w-full border-collapse">
      <thead>
        <tr>
          {head.map((cell, index) => (
            <th
              key={cell}
              scope="col"
              className={cn(
                "border-line text-ink-secondary border-b py-2 font-medium",
                index === 0 ? "text-left" : "text-right",
              )}
            >
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={String(row[0])}>
            {row.map((cell, index) => (
              <td
                key={index}
                className={cn(
                  "border-line text-ink border-b py-2",
                  index === 0 ? "text-left" : "text-right tabular-nums",
                )}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat tiles                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A number is often the right form.
 *
 * The spec asks for a few high-value visualisations, not a dashboard — and a
 * single value drawn as a one-bar chart says less than the value itself.
 */
export function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    // A `<dl>` may wrap each pair in a `<div>`, but nothing other than
    // `<dt>`/`<dd>` may sit beside them — so the detail line lives inside the
    // `<dd>` it describes rather than after it.
    <div>
      <dt className="text-meta text-ink-muted">{label}</dt>
      <dd className="text-page text-ink mt-1 font-medium tabular-nums">
        {value}
        {detail ? (
          <span className="text-meta text-ink-faint mt-0.5 block font-normal">
            {detail}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
      {children}
    </dl>
  );
}

/* -------------------------------------------------------------------------- */
/* Horizontal bars                                                            */
/* -------------------------------------------------------------------------- */

export interface BarDatum {
  label: string;
  value: number;
  /** Optional second value drawn inside the bar, e.g. solved within attempted. */
  inner?: number;
  href?: string;
}

/**
 * Horizontal bars, laid out in HTML rather than SVG.
 *
 * Long topic names wrap and truncate properly this way, and the bars stay
 * legible at 375px — an SVG bar chart with rotated labels does neither.
 *
 * One hue for every bar: these categories are nominal, so shading them by
 * value would double-encode length as colour and say nothing new.
 */
export function BarList({
  data,
  max,
  valueLabel,
}: {
  data: BarDatum[];
  max?: number;
  /** Suffix for the direct label at the bar tip. */
  valueLabel?: (datum: BarDatum) => string;
}) {
  const ceiling = max ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <ul className="space-y-3">
      {data.map((datum) => {
        const width = (datum.value / ceiling) * 100;
        const innerWidth =
          datum.inner !== undefined && datum.value > 0
            ? (datum.inner / ceiling) * 100
            : 0;

        return (
          <li key={datum.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-small text-ink min-w-0 truncate capitalize">
                {datum.label.replace(/-/g, " ")}
              </span>
              <span className="text-meta text-ink-muted shrink-0 tabular-nums">
                {valueLabel ? valueLabel(datum) : datum.value}
              </span>
            </div>

            {/* The track is one step off the surface; the bar carries the hue. */}
            <div className="bg-surface-sunken mt-1.5 h-2 w-full overflow-hidden rounded-full">
              <div
                className="bg-chart-2 relative h-full rounded-full"
                style={{ width: `${Math.max(width, 2)}%` }}
              >
                {innerWidth > 0 ? (
                  /*
                   * The solved portion sits inside the attempted bar. A 2px
                   * surface-coloured ring keeps the two readable where they
                   * meet, rather than a stroke that would add non-data ink.
                   */
                  <span
                    className="bg-chart-ink absolute inset-y-0 left-0 rounded-full ring-2 ring-[var(--surface)]"
                    style={{
                      width: `${(innerWidth / width) * 100}%`,
                    }}
                  />
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Stacked proportion bar                                                     */
/* -------------------------------------------------------------------------- */

export interface Segment {
  label: string;
  value: number;
  /** A CSS colour, from the chart tokens. */
  color: string;
}

/**
 * One bar showing how a whole divides.
 *
 * Segments are separated by a 2px gap in the surface colour rather than a
 * border, so neighbouring steps of the same ramp stay distinct without extra
 * ink.
 */
export function StackedBar({
  segments,
  height = 12,
}: {
  segments: Segment[];
  height?: number;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) return null;

  const visible = segments.filter((segment) => segment.value > 0);

  return (
    <div className="flex w-full gap-0.5" style={{ height }}>
      {visible.map((segment, index) => (
        <div
          key={segment.label}
          title={`${segment.label}: ${segment.value}`}
          className={cn(
            index === 0 && "rounded-l-full",
            index === visible.length - 1 && "rounded-r-full",
          )}
          style={{
            width: `${(segment.value / total) * 100}%`,
            background: segment.color,
          }}
        />
      ))}
    </div>
  );
}

export function Legend({ segments }: { segments: Segment[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {segments.map((segment) => (
        <li key={segment.label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: segment.color }}
          />
          <span className="text-meta text-ink-secondary capitalize">
            {segment.label}
          </span>
          <span className="text-meta text-ink-muted tabular-nums">
            {segment.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Sparkline                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A single trend line.
 *
 * One series, so no legend — the figure title already says what is plotted.
 * The end point is marked and directly labelled; the rest is left to the
 * table, because a value on every point is chaos and goes unread.
 *
 * The line is drawn in a stretched SVG, but the end marker is an HTML dot
 * positioned over it. A `<circle>` inside `preserveAspectRatio="none"` is
 * scaled non-uniformly and renders as an ellipse at any non-square size.
 */
export function TrendLine({
  points,
  height = 120,
  ariaLabel,
}: {
  points: { label: string; value: number }[];
  height?: number;
  ariaLabel: string;
}) {
  if (points.length < 2) return null;

  const max = Math.max(...points.map((p) => p.value), 1);
  const step = 100 / (points.length - 1);

  const coords = points.map((point, index) => ({
    x: index * step,
    y: 100 - (point.value / max) * 100,
  }));

  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)},${c.y.toFixed(2)}`)
    .join(" ");

  const last = coords.at(-1);

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
        className="h-full w-full"
      >
        {/* One hairline baseline. No grid — the table carries exact values. */}
        <line
          x1="0"
          y1="100"
          x2="100"
          y2="100"
          stroke="var(--chart-grid)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />

        <path
          d={`${path} L100,100 L0,100 Z`}
          fill="var(--chart-2)"
          opacity="0.1"
          stroke="none"
        />

        <path
          d={path}
          fill="none"
          stroke="var(--chart-2)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {last ? (
        <span
          aria-hidden="true"
          className="bg-chart-ink absolute size-2.5 rounded-full ring-2 ring-[var(--surface)]"
          style={{
            left: `${last.x}%`,
            top: `${last.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ) : null}
    </div>
  );
}

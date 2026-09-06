"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import {
  analyseProgressAction,
  coachAction,
  learningInsightsAction,
  planTomorrowAction,
  weeklyReflectionAction,
  type AiResult,
} from "@/app/actions/ai";
import { AiField, AiList } from "@/components/ai/ai-panel";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { formatDay } from "@/lib/dates";

/**
 * The full-page AI reports: coach, weekly, progress, insights, planner.
 *
 * These are not panels — they are the whole point of their page, so they get
 * the page. What they keep from `AiPanel` is the contract: nothing is sent
 * until asked, results are regenerable, a failure changes nothing, and the
 * entries behind an answer are always listed.
 */

function Report<T>({
  run,
  runLabel,
  pendingLabel,
  disclosure,
  empty,
  children,
}: {
  run: () => Promise<AiResult<T>>;
  runLabel: string;
  pendingLabel: string;
  disclosure: string;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AiResult<T> | null>(null);

  const execute = async () => {
    setPending(true);
    setResult(await run());
    setPending(false);
  };

  return (
    <div>
      <p className="text-small text-ink-muted">{disclosure}</p>

      <div className="mt-4 flex gap-2">
        <Button
          loading={pending}
          variant="ai"
          onClick={execute}
          disabled={pending}
        >
          {pending ? pendingLabel : result ? "Run again" : runLabel}
        </Button>
      </div>

      {!result && !pending && empty ? (
        <div className="mt-section">{empty}</div>
      ) : null}

      {result?.status === "error" ? (
        <Surface className="mt-6" role="alert">
          <p className="text-small text-danger">{result.message}</p>
          <p className="text-meta text-ink-muted mt-2">
            Nothing was changed. Your journal is exactly as you left it.
          </p>
        </Surface>
      ) : null}

      {result?.status === "success" ? (
        <div className="mt-section space-y-6">
          {children(result.data)}

          {result.sources?.length ? (
            <details className="border-line border-t pt-3">
              <summary className="text-meta text-ink-muted hover:text-ink cursor-pointer">
                Based on {result.sources.length}{" "}
                {result.sources.length === 1 ? "entry" : "entries"}
              </summary>
              <ul className="mt-2 space-y-1">
                {result.sources.map((source) => (
                  <li key={source.id}>
                    <Link
                      href={source.href}
                      className="text-meta text-ink-muted hover:text-ink"
                    >
                      {formatDay(source.date)} · {source.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Priorities                                                                 */
/* -------------------------------------------------------------------------- */

function Priority({
  label,
  item,
}: {
  label: string;
  item: { title: string; reason: string; minutes?: number };
}) {
  return (
    <div>
      <p className="text-meta text-ink-muted">
        {label}
        {item.minutes ? ` · about ${item.minutes} minutes` : ""}
      </p>
      <h3 className="text-title text-ink mt-0.5">{item.title}</h3>
      <p className="text-small text-ink-secondary mt-1">{item.reason}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pages                                                                      */
/* -------------------------------------------------------------------------- */

export function CoachReport() {
  return (
    <Report
      run={coachAction}
      runLabel="Suggest what to focus on"
      pendingLabel="Reading your recent work…"
      disclosure="Reads a short summary of your recent entries and your counted progress. Nothing is sent until you ask."
      empty={
        <p className="text-small text-ink-muted">
          The coach suggests one thing worth doing next, and says why — drawn
          from what you have actually recorded, not from general advice.
        </p>
      }
    >
      {(data) => (
        <>
          {data.standing ? (
            <p className="text-body text-ink">{data.standing}</p>
          ) : null}
          <Priority label="Start here" item={data.primary} />
          {data.supporting.map((item) => (
            <Priority key={item.title} label="Then" item={item} />
          ))}
        </>
      )}
    </Report>
  );
}

export function PlannerReport() {
  return (
    <Report
      run={planTomorrowAction}
      runLabel="Plan tomorrow"
      pendingLabel="Looking at how today went…"
      disclosure="Reads a short summary of today and the last few days, plus your counted progress."
      empty={
        <p className="text-small text-ink-muted">
          Tomorrow&rsquo;s plan comes from today. If today was hard, the plan
          gets smaller — that is deliberate.
        </p>
      }
    >
      {(data) => (
        <>
          <Priority label="Tomorrow's target" item={data.primary} />
          {data.supporting.map((item) => (
            <Priority key={item.title} label="If there's time" item={item} />
          ))}
          {data.optional ? (
            <Priority label="Optional" item={data.optional} />
          ) : null}

          <div className="border-line border-t pt-4">
            <AiField label="Why this plan" value={data.reason} />
            {data.totalMinutes ? (
              <p className="text-meta text-ink-faint mt-2">
                About {data.totalMinutes} minutes in total.
              </p>
            ) : null}
          </div>
        </>
      )}
    </Report>
  );
}

export function WeeklyReport({ from, to }: { from: string; to: string }) {
  return (
    <Report
      run={() => weeklyReflectionAction(from, to)}
      runLabel="Write the weekly reflection"
      pendingLabel="Reading the week…"
      disclosure={`Reads a short summary of everything recorded between ${formatDay(from)} and ${formatDay(to)}.`}
      empty={
        <p className="text-small text-ink-muted">
          A summary of the week in your own terms — what moved, what was hard,
          and what to carry into next week.
        </p>
      }
    >
      {(data) => (
        <>
          <AiField label="Technically" value={data.technical} />
          <AiList label="What mattered" items={data.important} />
          <AiList label="Worth remembering" items={data.highlights} />
          <AiField label="What was hard" value={data.difficult} />
          <AiList label="Breakthroughs" items={data.breakthroughs} />
          <AiList label="Kept coming up" items={data.weaknesses} />
          <AiField label="Next week" value={data.nextFocus} />
        </>
      )}
    </Report>
  );
}

export function ProgressReport() {
  return (
    <Report
      run={analyseProgressAction}
      runLabel="Read the journey"
      pendingLabel="Finding patterns in your preparation…"
      disclosure="Reads a sample of entries from across the whole journey, plus your counted progress."
      empty={
        <p className="text-small text-ink-muted">
          The numbers on the Analytics pages answer &ldquo;how much&rdquo;. This
          is the part they cannot: how the preparation has changed.
        </p>
      }
    >
      {(data) => (
        <>
          <div className="prose-journal max-w-reading">
            {data.narrative.split("\n\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <AiList
            label="Strengths the record supports"
            items={data.strengths}
          />
          <AiList label="Where it's thin" items={data.gaps} />
        </>
      )}
    </Report>
  );
}

export function InsightsReport() {
  return (
    <Report
      run={learningInsightsAction}
      runLabel="Look for connections"
      pendingLabel="Looking across the months…"
      disclosure="Reads a sample of entries from across the whole journey, weighted towards recent ones."
      empty={
        <p className="text-small text-ink-muted">
          The thing you cannot see from inside it: a struggle in one month that
          resolves in another.
        </p>
      }
    >
      {(data) =>
        data.insights.length === 0 ? (
          <p className="text-small text-ink-muted">
            Nothing connected up this time. That is a real answer — there may
            simply not be enough months yet.
          </p>
        ) : (
          <ul className="space-y-6">
            {data.insights.map((insight, index) => (
              <li key={index}>
                <p className="text-body text-ink">{insight.observation}</p>
                {insight.cited.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {insight.cited.map((record) => (
                      <li key={record.id}>
                        <Link
                          href={record.href}
                          className="text-meta text-accent underline-offset-4 hover:underline"
                        >
                          {formatDay(record.date)} · {record.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )
      }
    </Report>
  );
}

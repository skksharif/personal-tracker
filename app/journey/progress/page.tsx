import { Page, PageHeader } from "@/components/shell/app-shell";
import { Separator } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { dayNumber, daysBetween, formatDay, today } from "@/lib/dates";
import { countByType, getIndex } from "@/lib/storage/index-store";
import { getOrCreateJourney } from "@/lib/storage/journey";
import { ENTRY_TYPES, type EntryType } from "@/lib/types";

export const metadata = { title: "Progress" };

/**
 * Progress.
 *
 * Real numbers only — elapsed time and what has actually been recorded.
 * Charts arrive in Phase 7, once there is enough data for them to say
 * something. A chart of zeros is worse than a sentence.
 */
export default async function ProgressPage() {
  const [journey, counts, index] = await Promise.all([
    getOrCreateJourney(),
    countByType(),
    getIndex(),
  ]);

  const now = today();
  const day = dayNumber(journey.startDate, now);
  const daysLeft = journey.targetDate
    ? daysBetween(now, journey.targetDate)
    : null;

  const recorded = (Object.keys(ENTRY_TYPES) as EntryType[]).filter(
    (type) => counts[type] > 0,
  );

  // Distinct days with at least one entry — the honest measure of consistency.
  const activeDays = new Set(index.map((entry) => entry.date)).size;
  const lastEntry = index[0];

  return (
    <Page>
      <PageHeader
        meta={`Day ${day}`}
        title="Progress"
        description={`Since ${formatDay(journey.startDate)}.`}
      />

      <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
        <Stat label="Days in" value={day} />
        <Stat label="Days recorded" value={activeDays} />
        <Stat label="Entries" value={index.length} />
        {daysLeft !== null ? (
          <Stat
            label={daysLeft >= 0 ? "Days to target" : "Days past target"}
            value={Math.abs(daysLeft)}
          />
        ) : null}
      </dl>

      {lastEntry ? (
        <p className="text-small text-ink-muted mt-8">
          Last recorded {formatDay(lastEntry.date)} — {lastEntry.title}.
        </p>
      ) : null}

      <Separator className="my-section" />

      <h2 className="text-meta text-ink-muted mb-4">What&rsquo;s recorded</h2>

      {recorded.length === 0 ? (
        <p className="text-small text-ink-muted">
          Nothing yet. Every entry you write shows up here.
        </p>
      ) : (
        <ul className="space-y-3">
          {recorded.map((type) => {
            const count = counts[type];
            const share = index.length > 0 ? count / index.length : 0;

            return (
              <li key={type}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-small text-ink">
                    {ENTRY_TYPES[type].plural}
                  </span>
                  <span className="text-meta text-ink-muted tabular-nums">
                    {count}
                  </span>
                </div>
                {/*
                  A proportion bar, not a chart. Decorative width only — the
                  number above it is the accessible value.
                */}
                <div
                  aria-hidden="true"
                  className="bg-surface-sunken mt-1.5 h-1 overflow-hidden rounded-full"
                >
                  <div
                    className={cn("h-full rounded-full", barTone(type))}
                    style={{ width: `${Math.max(share * 100, 2)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-meta text-ink-muted">{label}</dt>
      <dd className="text-page text-ink mt-1 font-medium tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function barTone(type: EntryType): string {
  const tones: Record<string, string> = {
    neutral: "bg-ink-faint",
    accent: "bg-accent",
    ai: "bg-ai",
    success: "bg-success",
  };
  return tones[ENTRY_TYPES[type].tone] ?? "bg-ink-faint";
}

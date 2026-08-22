import { Page, PageHeader } from "@/components/shell/app-shell";
import { WeeklyReport } from "@/components/ai/reports";
import { EmptyState } from "@/components/ui/surface";
import { formatDay, parseDay, today } from "@/lib/dates";
import { isAiConfigured } from "@/lib/env";

export const metadata = { title: "Weekly Reflection" };

/**
 * The week just gone.
 *
 * Defaults to the last seven days ending today, and accepts an explicit range
 * so an earlier week can be revisited — the reflection is regenerable, and
 * looking back at a hard week from a distance is often the point.
 */
export default async function WeeklyPage({
  searchParams,
}: PageProps<"/ai/weekly">) {
  const params = await searchParams;
  const configured = isAiConfigured();

  const to = typeof params.to === "string" ? params.to : today();
  const start = parseDay(to);
  start.setDate(start.getDate() - 6);
  const from = typeof params.from === "string" ? params.from : today(start);

  return (
    <Page>
      <PageHeader
        meta={`${formatDay(from)} — ${formatDay(to)}`}
        title="Weekly Reflection"
        description="What moved, what was hard, and what to carry forward."
      />

      {!configured ? (
        <EmptyState
          title="AI isn't set up yet"
          description="Add a Gemini API key to .env.local and restart. Everything else in the journal works without it."
        />
      ) : (
        <WeeklyReport from={from} to={to} />
      )}
    </Page>
  );
}

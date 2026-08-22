import { Page, PageHeader } from "@/components/shell/app-shell";
import { DataTable, Figure, TrendLine } from "@/components/charts/primitives";
import { EmptyState } from "@/components/ui/surface";
import { learningTrends } from "@/lib/analytics/compute";
import { formatMonth } from "@/components/journey/timeline";
import { formatMinutes } from "@/lib/storage/sessions";

export const metadata = { title: "Learning trends" };

/**
 * Three separate charts rather than one with three lines.
 *
 * Problems, entries and minutes are measures of different scale, and putting
 * them on one plot would need a second y-axis — which invents a correlation
 * the data does not contain. Small multiples on a shared time axis instead.
 */
export default async function TrendsPage() {
  const trends = await learningTrends();

  // Two points is a straight line between two numbers, not a trend. Below
  // three months the honest thing is to show the values and say why.
  const ENOUGH = 3;

  if (trends.months.length < ENOUGH) {
    return (
      <Page>
        <PageHeader
          title="Learning trends"
          description="How solving, writing and practice have moved over time."
        />
        <EmptyState
          title="Not enough recorded yet"
          description={
            trends.months.length === 0
              ? "Trends need a few months of entries before they say anything honest."
              : `Only ${trends.months.length} ${trends.months.length === 1 ? "month has" : "months have"} entries so far. A line between two points is not a trend — this fills in from three months on.`
          }
        />
      </Page>
    );
  }

  const charts = [
    {
      title: "Problems solved",
      caption:
        "Counted in the month you first solved it, not the month you wrote it down.",
      points: trends.solvedByMonth,
      unit: "solved",
      format: (value: number) => String(value),
    },
    {
      title: "Entries written",
      caption: "Diary, reflections, experiences and letters.",
      points: trends.writtenByMonth,
      unit: "entries",
      format: (value: number) => String(value),
    },
    {
      title: "Practice time",
      caption: "From recorded sessions.",
      points: trends.practiceMinutesByMonth,
      unit: "minutes",
      format: (value: number) => (value ? formatMinutes(value) : "—"),
    },
  ];

  return (
    <Page>
      <PageHeader
        meta={`${trends.months.length} ${trends.months.length === 1 ? "month" : "months"}`}
        title="Learning trends"
        description="Three measures, three charts. Putting them on one plot would need two scales, and that invents a relationship the data doesn't have."
      />

      {charts.map((chart) => {
        const total = chart.points.reduce((sum, p) => sum + p.value, 0);
        const latest = chart.points.at(-1);

        return (
          <Figure
            key={chart.title}
            title={chart.title}
            caption={chart.caption}
            table={
              <DataTable
                head={["Month", chart.title]}
                rows={chart.points.map((point) => [
                  formatMonth(point.label),
                  chart.format(point.value),
                ])}
              />
            }
          >
            {total === 0 ? (
              <p className="text-small text-ink-faint italic">
                Nothing recorded yet.
              </p>
            ) : (
              <>
                <TrendLine
                  points={chart.points}
                  ariaLabel={`${chart.title} by month. ${chart.points
                    .map(
                      (p) =>
                        `${formatMonth(p.label)}: ${chart.format(p.value)}`,
                    )
                    .join(". ")}`}
                />
                <p className="text-meta text-ink-muted mt-2 text-right">
                  {latest
                    ? `${formatMonth(latest.label)}: ${chart.format(latest.value)}`
                    : null}
                </p>
              </>
            )}
          </Figure>
        );
      })}
    </Page>
  );
}

import { Page, PageHeader } from "@/components/shell/app-shell";
import {
  AddMilestone,
  MilestoneActions,
} from "@/components/journey/milestone-form";
import { EmptyState, Separator } from "@/components/ui/surface";
import { formatDay, today } from "@/lib/dates";
import { listMilestones } from "@/lib/storage/milestones";

export const metadata = { title: "Milestones" };

export default async function MilestonesPage() {
  const milestones = await listMilestones();

  return (
    <Page>
      <PageHeader
        meta={`${milestones.length} ${milestones.length === 1 ? "milestone" : "milestones"}`}
        title="Milestones"
        description="The moments worth marking."
      />

      <AddMilestone today={today()} />

      {milestones.length === 0 ? (
        <EmptyState
          title="No milestones yet"
          description="The day you started counts as one. So does the first problem you solve without help."
        />
      ) : (
        <ol className="mt-section space-y-0">
          {milestones.map((milestone, position) => (
            <li key={milestone.id} id={milestone.id} className="scroll-mt-24">
              {position > 0 ? <Separator className="my-6" /> : null}

              <p className="text-meta text-ink-muted">
                {formatDay(milestone.date)}
              </p>
              <h2 className="text-title text-ink mt-1">{milestone.title}</h2>

              {milestone.note ? (
                <p className="prose-journal text-small mt-2 whitespace-pre-wrap">
                  {milestone.note}
                </p>
              ) : null}

              <MilestoneActions milestone={milestone} />
            </li>
          ))}
        </ol>
      )}
    </Page>
  );
}

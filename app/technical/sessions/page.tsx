import { Page, PageHeader } from "@/components/shell/app-shell";
import { AddSession, DeleteSession } from "@/components/technical/session-form";
import { EmptyState, Separator } from "@/components/ui/surface";
import { Tag } from "@/components/ui/tag";
import { formatDay } from "@/lib/dates";
import {
  formatMinutes,
  listSessions,
  sessionTotals,
} from "@/lib/storage/sessions";

export const metadata = { title: "Coding Practice" };

export default async function SessionsPage() {
  const [sessions, totals] = await Promise.all([
    listSessions(),
    sessionTotals(),
  ]);

  return (
    <Page>
      <PageHeader
        meta={`${totals.count} ${totals.count === 1 ? "session" : "sessions"} across ${totals.days} ${totals.days === 1 ? "day" : "days"}`}
        title="Coding Practice"
        description="The shape of the time itself, separate from the problems inside it."
      />

      <AddSession />

      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions recorded"
          description="A session with nothing solved is still worth recording. That is most of them."
        />
      ) : (
        <>
          <dl className="mt-section grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <dt className="text-meta text-ink-muted">Time</dt>
              <dd className="text-title text-ink mt-0.5 tabular-nums">
                {formatMinutes(totals.minutes)}
              </dd>
            </div>
            <div>
              <dt className="text-meta text-ink-muted">Attempted</dt>
              <dd className="text-title text-ink mt-0.5 tabular-nums">
                {totals.attempted}
              </dd>
            </div>
            <div>
              <dt className="text-meta text-ink-muted">Solved</dt>
              <dd className="text-title text-ink mt-0.5 tabular-nums">
                {totals.solved}
              </dd>
            </div>
            <div>
              <dt className="text-meta text-ink-muted">Days</dt>
              <dd className="text-title text-ink mt-0.5 tabular-nums">
                {totals.days}
              </dd>
            </div>
          </dl>

          <Separator className="my-section" />

          <ol className="space-y-0">
            {sessions.map((session, position) => (
              <li key={session.id} id={session.id} className="scroll-mt-24">
                {position > 0 ? (
                  <hr className="border-line my-1 border-t" />
                ) : null}

                <div className="py-3">
                  <div className="flex items-baseline gap-3">
                    <span className="text-ink font-medium">
                      {formatDay(session.date)}
                    </span>
                    {session.minutes ? (
                      <span className="text-meta text-ink-muted">
                        {formatMinutes(session.minutes)}
                      </span>
                    ) : null}
                    {session.attempted ? (
                      <span className="text-meta text-ink-muted">
                        {session.solved}/{session.attempted} solved
                      </span>
                    ) : null}
                    <span className="ml-auto">
                      <DeleteSession id={session.id} />
                    </span>
                  </div>

                  {session.topics.length ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {session.topics.map((topic) => (
                        <Tag key={topic}>{topic}</Tag>
                      ))}
                    </div>
                  ) : null}

                  {session.reflection ? (
                    <p className="text-small text-ink-secondary mt-1.5 whitespace-pre-wrap">
                      {session.reflection}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </Page>
  );
}

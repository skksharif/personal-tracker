"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  deleteInterviewAction,
  replyToInterviewAction,
  startInterviewAction,
} from "@/app/actions/interview";
import { AiList } from "@/components/ai/ai-panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/sheet";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
// Values come from `lib/types` (client-safe); only the type comes from the
// server-only storage module, and types are erased.
import type { Interview } from "@/lib/storage/interviews";
import {
  INTERVIEW_KINDS,
  INTERVIEW_LABELS,
  type InterviewKind,
} from "@/lib/types";

/**
 * The mock interview.
 *
 * The one place in the product that is a genuine back-and-forth, so it is
 * allowed to look like one. Turns alternate down the page rather than sitting
 * in coloured bubbles — this is a transcript to reread later, and the design
 * direction rules out chat styling everywhere else for good reason.
 */

const DESCRIPTIONS: Record<InterviewKind, string> = {
  dsa: "One problem, worked through out loud. It will not give you the solution.",
  "system-design":
    "A design problem, then pressure on requirements, scale and trade-offs.",
  behavioural:
    "Questions about real experience, with follow-ups on the specifics.",
};

export function StartInterview() {
  const router = useRouter();
  const [pending, setPending] = useState<InterviewKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (kind: InterviewKind) => {
    setPending(kind);
    setError(null);

    const result = await startInterviewAction(kind);

    setPending(null);
    if (result.status === "success") {
      router.push(`/ai/interview/${result.interview.id}`);
    } else {
      setError(result.message);
    }
  };

  return (
    <div>
      <p className="text-small text-ink-muted">
        Sends a short summary of your recent entries so the questions land at
        the right level, plus whatever you say during the interview.
      </p>

      <ul className="mt-section space-y-0">
        {INTERVIEW_KINDS.map((kind, position) => (
          <li key={kind}>
            {position > 0 ? <hr className="border-line border-t" /> : null}
            <div className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <h2 className="text-title text-ink">
                  {INTERVIEW_LABELS[kind]}
                </h2>
                <p className="text-small text-ink-muted mt-0.5">
                  {DESCRIPTIONS[kind]}
                </p>
              </div>
              <Button
                variant="ai"
                size="sm"
                onClick={() => start(kind)}
                disabled={pending !== null}
              >
                {pending === kind ? "Starting…" : "Start"}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {error ? (
        <Surface className="mt-6" role="alert">
          <p className="text-small text-danger">{error}</p>
        </Surface>
      ) : null}
    </div>
  );
}

export function InterviewSession({ interview }: { interview: Interview }) {
  const router = useRouter();
  const [session, setSession] = useState(interview);
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const send = async () => {
    if (!answer.trim()) return;

    setPending(true);
    setError(null);
    const said = answer;
    setAnswer("");

    const result = await replyToInterviewAction(session.id, said);

    setPending(false);
    if (result.status === "success") {
      setSession(result.interview);
    } else {
      setError(result.message);
      // Give them their words back rather than making them retype.
      setAnswer(said);
    }
  };

  const remove = async () => {
    await deleteInterviewAction(session.id);
    setConfirming(false);
    router.push("/ai/interview");
  };

  return (
    <div>
      <ol className="space-y-6">
        {session.turns.map((turn, index) => (
          <li key={index}>
            <p
              className={cn(
                "text-meta",
                turn.role === "assistant" ? "text-ai" : "text-ink-muted",
              )}
            >
              {turn.role === "assistant" ? "Interviewer" : "You"}
            </p>
            <div
              className={cn(
                "text-body mt-1 whitespace-pre-wrap",
                turn.role === "assistant" ? "text-ink" : "text-ink-secondary",
              )}
            >
              {turn.content}
            </div>
          </li>
        ))}
      </ol>

      {pending ? (
        <p className="text-small text-ink-muted mt-6">Thinking…</p>
      ) : null}

      {error ? (
        <Surface className="mt-6" role="alert">
          <p className="text-small text-danger">{error}</p>
          <p className="text-meta text-ink-muted mt-2">
            Your answer is still in the box below.
          </p>
        </Surface>
      ) : null}

      {session.finished && session.evaluation ? (
        <Surface className="mt-section space-y-4 p-5">
          <div>
            <h2 className="text-meta text-ai">How it went</h2>
            <p className="text-body text-ink mt-1 whitespace-pre-wrap">
              {session.evaluation.summary}
            </p>
          </div>
          <AiList label="Did well" items={session.evaluation.strengths} />
          <AiList label="Work on" items={session.evaluation.improvements} />
          <p className="text-meta text-ink-faint">
            One interviewer&rsquo;s reading of one conversation. It is a
            practice signal, not a verdict.
          </p>
        </Surface>
      ) : (
        <div className="mt-section">
          <Textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            minRows={4}
            aria-label="Your answer"
            placeholder="Think out loud. Partial reasoning is fine — that is what the interviewer wants to hear."
            disabled={pending}
          />
          <div className="mt-3 flex gap-2">
            <Button
              variant="ai"
              onClick={send}
              disabled={pending || !answer.trim()}
            >
              {pending ? "Sending…" : "Reply"}
            </Button>
            <Button onClick={() => setConfirming(true)} disabled={pending}>
              End and delete
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete this interview?"
        footer={
          <>
            <Button size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={remove}>
              Delete
            </Button>
          </>
        }
      >
        The whole transcript will be removed from disk. If you want to keep it
        for later, leave it instead — an unfinished interview is still a record.
      </Dialog>
    </div>
  );
}

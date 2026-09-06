"use client";

import Link from "next/link";
import { useState } from "react";

import { askJourneyAction, describeContextAction } from "@/app/actions/ai";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Surface } from "@/components/ui/surface";
import { formatDay } from "@/lib/dates";
import type { IndexRecord } from "@/lib/storage/index-store";

/**
 * Ask My Journey.
 *
 * One of only two conversational surfaces in the product, and even here the
 * answer is a page rather than a chat bubble — a question about months of
 * journal deserves room to be read.
 *
 * Two things make the answer checkable rather than merely plausible: the
 * disclosure states what will be sent before it is sent, and the answer links
 * to the entries it was drawn from. A citation the model invented simply does
 * not resolve to a record, so it cannot appear as a link.
 */

const EXAMPLES = [
  "What have I improved since I started?",
  "Which topics do I keep struggling with?",
  "When did recursion start making sense?",
  "What were my hardest weeks?",
  "Which problems taught me the most?",
];

export function AskJourney() {
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [disclosure, setDisclosure] = useState<string | null>(null);
  const [answer, setAnswer] = useState<{
    answer: string;
    insufficient: boolean;
    cited: IndexRecord[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = async (text: string) => {
    if (text.trim().length < 3) {
      setDisclosure(null);
      return;
    }
    const described = await describeContextAction("ask", { question: text });
    setDisclosure(described.disclosure);
  };

  const ask = async () => {
    setPending(true);
    setError(null);
    setAnswer(null);

    const result = await askJourneyAction(question);

    setPending(false);
    if (result.status === "success") setAnswer(result.data);
    else setError(result.message);
  };

  return (
    <div>
      <Field
        label="Your question"
        hint="Answered only from what you have written."
      >
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            minRows={2}
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value);
              setDisclosure(null);
            }}
            onBlur={(event) => void preview(event.target.value)}
            placeholder="What have I improved since I started?"
          />
        )}
      </Field>

      {disclosure ? (
        <p className="text-meta text-ink-muted mt-2">{disclosure}</p>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <Button
          loading={pending}
          variant="ai"
          onClick={ask}
          disabled={pending || question.trim().length < 3}
        >
          {pending ? "Reading your journey…" : "Ask"}
        </Button>
        {answer ? (
          <Button onClick={ask} loading={pending}>
            Ask again
          </Button>
        ) : null}
      </div>

      {!answer && !pending && !error ? (
        <div className="mt-section">
          <h2 className="text-meta text-ink-muted mb-2">Things worth asking</h2>
          <ul className="space-y-1">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  onClick={() => {
                    setQuestion(example);
                    void preview(example);
                  }}
                  className="text-small text-accent text-left underline-offset-4 hover:underline"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <Surface className="mt-6" role="alert">
          <p className="text-small text-danger">{error}</p>
          <p className="text-meta text-ink-muted mt-2">
            Your journal is unchanged.
          </p>
        </Surface>
      ) : null}

      {answer ? (
        <div className="mt-section">
          {answer.insufficient ? (
            <p className="text-meta text-warning mb-3">
              There wasn&rsquo;t enough recorded to answer this fully.
            </p>
          ) : null}

          <div className="prose-journal max-w-reading">
            {answer.answer.split("\n\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>

          {answer.cited.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-meta text-ink-muted mb-2">
                Drawn from these entries
              </h2>
              <ul className="space-y-1">
                {answer.cited.map((record) => (
                  <li key={record.id} className="flex items-baseline gap-3">
                    <Link
                      href={record.href}
                      className="text-small text-accent underline-offset-4 hover:underline"
                    >
                      {record.title}
                    </Link>
                    <span className="text-meta text-ink-muted">
                      {formatDay(record.date)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="text-meta text-ink-faint mt-6">
              No specific entries were cited for this answer.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

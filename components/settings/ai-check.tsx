"use client";

import { useState } from "react";

import { runDiagnosticsAction } from "@/app/actions/ai-diagnostics";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import type { Diagnostics } from "@/lib/ai/diagnostics";

/**
 * Runs the AI connection check and shows what came back.
 *
 * Deliberately explicit about cost and privacy: it makes three real API calls,
 * and the user chooses to make them.
 */
export function AiCheck({ configured }: { configured: boolean }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Diagnostics | null>(null);

  const run = async () => {
    setPending(true);
    setResult(await runDiagnosticsAction());
    setPending(false);
  };

  return (
    <div>
      <p className="text-small text-ink-muted">
        {configured
          ? "Sends three short test requests to Gemini to confirm the model answers, that structured output is reliable, and whether image generation is available on your key."
          : "No API key is configured, so nothing can be sent yet."}
      </p>

      <div className="mt-4">
        <Button onClick={run} disabled={pending}>
          {pending ? "Checking…" : "Check AI connection"}
        </Button>
      </div>

      {result ? (
        <Surface className="mt-4">
          {result.configured ? (
            <p className="text-meta text-ink-muted mb-3">
              <code className="text-ink font-mono">{result.chatModel}</code> ·
              fast{" "}
              <code className="text-ink font-mono">{result.fastModel}</code> ·
              images{" "}
              <code className="text-ink font-mono">{result.imageModel}</code>
            </p>
          ) : null}

          <ul className="space-y-3">
            {result.probes.map((probe) => (
              <li key={probe.name} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    probe.status === "pass"
                      ? "bg-success"
                      : probe.status === "fail"
                        ? "bg-danger"
                        : "bg-ink-faint",
                  )}
                />
                <div className="min-w-0">
                  <p className="text-small text-ink">
                    {probe.name}
                    <span className="text-meta text-ink-muted ml-2">
                      {probe.status}
                    </span>
                  </p>
                  <p className="text-meta text-ink-muted break-words">
                    {probe.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Surface>
      ) : null}
    </div>
  );
}

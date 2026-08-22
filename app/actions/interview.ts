"use server";

import { revalidatePath } from "next/cache";

import { recentContext } from "@/lib/ai/context";
import { AiError, AI_MESSAGES } from "@/lib/ai/errors";
import { completeJson } from "@/lib/ai/gemini";
import { interviewPrompt } from "@/lib/ai/prompts";
import { interviewTurnSchema } from "@/lib/ai/schema";
import { today } from "@/lib/dates";
import {
  appendTurns,
  createInterview,
  deleteInterview,
  getInterview,
  type Interview,
} from "@/lib/storage/interviews";
import type { InterviewKind } from "@/lib/types";
import type { ActionResult } from "@/app/actions/shared";

/**
 * The mock interviewer.
 *
 * One of the two genuinely conversational features, so it keeps a real
 * transcript: every turn is written to disk as it happens, not assembled at
 * the end. If the tab closes mid-interview the session is still there, which
 * matters because a half-finished interview is often the interesting one.
 */

export type InterviewResult =
  | { status: "success"; interview: Interview }
  | { status: "error"; message: string; retryable: boolean };

function toError(error: unknown): InterviewResult {
  if (error instanceof AiError) {
    if (error.detail) console.error(`[ai] ${error.kind}: ${error.detail}`);
    return {
      status: "error",
      message: error.message,
      retryable: error.retryable,
    };
  }

  console.error(error);
  return { status: "error", message: AI_MESSAGES.unknown, retryable: true };
}

export async function startInterviewAction(
  kind: InterviewKind,
): Promise<InterviewResult> {
  try {
    const interview = await createInterview(kind, today());
    revalidatePath("/ai/interview");
    return await advance(interview);
  } catch (error) {
    return toError(error);
  }
}

export async function replyToInterviewAction(
  id: string,
  answer: string,
): Promise<InterviewResult> {
  try {
    const existing = await getInterview(id);
    if (!existing) {
      return {
        status: "error",
        message: "That interview no longer exists.",
        retryable: false,
      };
    }

    // The answer is written before the model is called, so a failed or slow
    // response never costs the user what they typed.
    const withAnswer = await appendTurns(id, [
      { role: "user", content: answer, at: new Date().toISOString() },
    ]);

    return await advance(withAnswer);
  } catch (error) {
    return toError(error);
  }
}

/** Ask the interviewer for its next turn and store it. */
async function advance(interview: Interview): Promise<InterviewResult> {
  const background = await recentContext({ limit: 6, budget: 3_000 });

  const { data } = await completeJson({
    messages: interviewPrompt(
      interview.kind,
      interview.turns.map((turn) => ({
        role: turn.role,
        content: turn.content,
      })),
      background.text,
    ),
    schema: interviewTurnSchema,
    maxTokens: 3_000,
  });

  const updated = await appendTurns(
    interview.id,
    [
      {
        role: "assistant",
        content: data.message,
        at: new Date().toISOString(),
      },
    ],
    data.finished ? data.evaluation : undefined,
  );

  revalidatePath("/ai/interview");
  revalidatePath(`/ai/interview/${interview.id}`);
  revalidatePath("/journey/timeline");

  return { status: "success", interview: updated };
}

export async function deleteInterviewAction(id: string): Promise<ActionResult> {
  try {
    await deleteInterview(id);
    revalidatePath("/ai/interview");
    revalidatePath("/journey/timeline");
    return { status: "success", message: "Interview deleted" };
  } catch (error) {
    console.error(error);
    return {
      status: "error",
      message: "Couldn't delete that interview.",
    };
  }
}

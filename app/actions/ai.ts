"use server";

import { revalidatePath } from "next/cache";

import {
  BUDGETS,
  rangeContext,
  recentContext,
  relevantContext,
  spanContext,
  withCurrentEntry,
  type Context,
} from "@/lib/ai/context";
import { AiError, AI_MESSAGES } from "@/lib/ai/errors";
import { completeJson } from "@/lib/ai/gemini";
import {
  analysisPrompt,
  askPrompt,
  coachPrompt,
  extractLearningPrompt,
  improvePrompt,
  insightsPrompt,
  plannerPrompt,
  reflectionPrompt,
  summarisePrompt,
  tagsPrompt,
  weeklyPrompt,
} from "@/lib/ai/prompts";
import {
  diagramPrompt,
  sanitiseMermaid,
  type DiagramKind,
} from "@/lib/ai/prompts/diagram";
import {
  buildTitlePrompt,
  titleSuggestionSchema,
} from "@/lib/ai/prompts/title";
import {
  analysisSchema,
  answerSchema,
  coachSchema,
  diagramSchema,
  insightSchema,
  learningSchema,
  type Diagram,
  planSchema,
  reflectionSchema,
  rewriteSchema,
  summarySchema,
  tagSuggestionSchema,
  weeklySchema,
} from "@/lib/ai/schema";
import {
  preparationProgress,
  problemStats,
  topicProgress,
} from "@/lib/analytics/compute";
import { formatDay, today } from "@/lib/dates";
import { isAiConfigured } from "@/lib/env";
import { saveAiReflection, type WrittenEntryType } from "@/lib/storage/entries";
import type { IndexRecord } from "@/lib/storage/index-store";
import { formatMinutes } from "@/lib/storage/sessions";

/**
 * AI actions.
 *
 * Every one returns a result rather than throwing: an AI failure must never
 * take down the page someone is writing on. The entry is always safe, and the
 * message says so.
 *
 * Each action that reads the journal returns the sources it used alongside the
 * answer, so the UI can show what it was based on instead of asking for trust.
 */

export type AiResult<T> =
  | { status: "success"; data: T; sources?: IndexRecord[]; elapsedMs?: number }
  | { status: "error"; message: string; retryable: boolean };

function toAiResult(error: unknown): AiResult<never> {
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

function needsWriting(): AiResult<never> {
  return {
    status: "error",
    message: "Write something first, then AI has something to work with.",
    retryable: false,
  };
}

function needsJournal(): AiResult<never> {
  return {
    status: "error",
    message:
      "There isn't enough in the journal yet for this. Record a few days first.",
    retryable: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Disclosure                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * What a feature would send, without sending it.
 *
 * The UI calls this to show the disclosure *before* the user chooses to run
 * anything, which is what the privacy section of the spec asks for.
 */
export async function describeContextAction(
  task: "reflection" | "ask" | "coach" | "weekly" | "insights" | "planner",
  input?: { question?: string; from?: string; to?: string },
): Promise<{ disclosure: string; characters: number }> {
  const context = await contextFor(task, input);
  return { disclosure: context.disclosure, characters: context.characters };
}

async function contextFor(
  task: string,
  input?: { question?: string; from?: string; to?: string },
): Promise<Context> {
  switch (task) {
    case "ask":
      return relevantContext(input?.question ?? "");
    case "weekly":
      return rangeContext(input?.from ?? today(), input?.to ?? today());
    case "insights":
      return spanContext();
    case "coach":
      return recentContext({ limit: 12, budget: BUDGETS.coach });
    case "planner":
      return recentContext({ limit: 8, budget: BUDGETS.planner });
    default:
      return recentContext({ limit: 6 });
  }
}

/* -------------------------------------------------------------------------- */
/* Facts                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The counted half of the picture.
 *
 * Given to the model as fact so it does not have to infer numbers from
 * excerpts and get them wrong. It is also shown to the user directly, which is
 * why the prompts tell the model not to restate it.
 */
async function journeyFacts(): Promise<string> {
  const [progress, problems, topics] = await Promise.all([
    preparationProgress(),
    problemStats(),
    topicProgress(),
  ]);

  const weak = topics
    .filter((topic) => topic.solved < topic.problems)
    .slice(0, 5)
    .map((topic) => `${topic.name} (${topic.solved}/${topic.problems} solved)`);

  return [
    `Day ${progress.dayNumber} of the journey, started ${formatDay(progress.startDate)}.`,
    progress.targetDate
      ? `Target ${formatDay(progress.targetDate)}, ${progress.daysToTarget} days away.`
      : "No target date set.",
    `Recorded on ${progress.activeDays} of ${progress.dayNumber} days.`,
    `${progress.problems} problems, ${progress.solved} solved. ${problems.totalAttempts} attempts total.`,
    `${formatMinutes(progress.practiceMinutes)} of recorded practice.`,
    progress.daysSinceActive !== null
      ? `Last recorded ${progress.daysSinceActive} days ago.`
      : "",
    weak.length ? `Topics with unsolved problems: ${weak.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* -------------------------------------------------------------------------- */
/* Inline assists                                                             */
/* -------------------------------------------------------------------------- */

export async function suggestTitleAction(
  body: string,
): Promise<AiResult<string[]>> {
  if (!body.trim()) return needsWriting();

  try {
    const { data, result } = await completeJson({
      messages: buildTitlePrompt(body),
      schema: titleSuggestionSchema,
      fast: true,
      maxTokens: 400,
    });
    return {
      status: "success",
      data: data.titles,
      elapsedMs: result.elapsedMs,
    };
  } catch (error) {
    return toAiResult(error);
  }
}

export async function suggestTagsAction(
  body: string,
): Promise<AiResult<string[]>> {
  if (!body.trim()) return needsWriting();

  try {
    const { data, result } = await completeJson({
      messages: tagsPrompt(body),
      schema: tagSuggestionSchema,
      fast: true,
      maxTokens: 400,
    });
    return { status: "success", data: data.tags, elapsedMs: result.elapsedMs };
  } catch (error) {
    return toAiResult(error);
  }
}

export async function improveWritingAction(
  body: string,
): Promise<AiResult<{ text: string; note?: string }>> {
  if (!body.trim()) return needsWriting();

  try {
    const { data, result } = await completeJson({
      messages: improvePrompt(body),
      schema: rewriteSchema,
      maxTokens: 8_000,
    });
    return { status: "success", data, elapsedMs: result.elapsedMs };
  } catch (error) {
    return toAiResult(error);
  }
}

export async function summariseAction(body: string): Promise<AiResult<string>> {
  if (!body.trim()) return needsWriting();

  try {
    const { data, result } = await completeJson({
      messages: summarisePrompt(body),
      schema: summarySchema,
      fast: true,
      maxTokens: 800,
    });
    return {
      status: "success",
      data: data.summary,
      elapsedMs: result.elapsedMs,
    };
  } catch (error) {
    return toAiResult(error);
  }
}

export async function extractLearningAction(
  body: string,
): Promise<AiResult<{ learned: string[]; mistakes: string[] }>> {
  if (!body.trim()) return needsWriting();

  try {
    const { data, result } = await completeJson({
      messages: extractLearningPrompt(body),
      schema: learningSchema,
      maxTokens: 1_200,
    });
    return { status: "success", data, elapsedMs: result.elapsedMs };
  } catch (error) {
    return toAiResult(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Diary reflection                                                           */
/* -------------------------------------------------------------------------- */

export async function reflectOnEntryAction(input: {
  type: WrittenEntryType;
  id: string;
  date: string;
  title: string;
  body: string;
}): Promise<AiResult<import("@/lib/ai/schema").Reflection>> {
  if (!input.body.trim()) return needsWriting();

  try {
    const background = await recentContext({
      limit: 6,
      excludeId: input.id,
      budget: BUDGETS.reflection,
    });
    const context = withCurrentEntry(background, input);

    const { data, result } = await completeJson({
      messages: reflectionPrompt(context.text),
      schema: reflectionSchema,
      maxTokens: 2_000,
    });

    return {
      status: "success",
      data,
      sources: context.sources,
      elapsedMs: result.elapsedMs,
    };
  } catch (error) {
    return toAiResult(error);
  }
}

/** Store an accepted reflection beside the entry. Never touches the body. */
export async function saveReflectionAction(
  type: WrittenEntryType,
  id: string,
  reflection: import("@/lib/ai/schema").Reflection,
): Promise<AiResult<true>> {
  try {
    await saveAiReflection(type, id, {
      ...reflection,
      generatedAt: new Date().toISOString(),
    });
    revalidatePath("/");
    return { status: "success", data: true };
  } catch (error) {
    return toAiResult(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Ask My Journey                                                             */
/* -------------------------------------------------------------------------- */

export async function askJourneyAction(
  question: string,
): Promise<
  AiResult<{ answer: string; insufficient: boolean; cited: IndexRecord[] }>
> {
  if (question.trim().length < 3) {
    return {
      status: "error",
      message: "Ask a longer question.",
      retryable: false,
    };
  }

  try {
    const context = await relevantContext(question);
    if (context.sources.length === 0) return needsJournal();

    const { data, result } = await completeJson({
      messages: askPrompt(question, context.text),
      schema: answerSchema,
      maxTokens: 3_000,
    });

    // Resolve the ids the model cited back to real records. Anything it
    // invented simply does not resolve, so a fabricated citation cannot
    // appear as a link.
    const byId = new Map(context.sources.map((record) => [record.id, record]));
    const cited = data.sources
      .map((id) => byId.get(id))
      .filter((record): record is IndexRecord => record !== undefined);

    return {
      status: "success",
      data: { answer: data.answer, insufficient: data.insufficient, cited },
      sources: context.sources,
      elapsedMs: result.elapsedMs,
    };
  } catch (error) {
    return toAiResult(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Coach, planner, weekly, analysis, insights                                 */
/* -------------------------------------------------------------------------- */

export async function coachAction(): Promise<
  AiResult<import("zod").infer<typeof coachSchema>>
> {
  try {
    const context = await recentContext({ limit: 12, budget: BUDGETS.coach });
    if (context.sources.length === 0) return needsJournal();

    const { data, result } = await completeJson({
      messages: coachPrompt(context.text, await journeyFacts()),
      schema: coachSchema,
      maxTokens: 2_000,
    });

    return {
      status: "success",
      data,
      sources: context.sources,
      elapsedMs: result.elapsedMs,
    };
  } catch (error) {
    return toAiResult(error);
  }
}

export async function planTomorrowAction(): Promise<
  AiResult<import("zod").infer<typeof planSchema>>
> {
  try {
    const context = await recentContext({ limit: 8, budget: BUDGETS.planner });
    if (context.sources.length === 0) return needsJournal();

    const { data, result } = await completeJson({
      messages: plannerPrompt(context.text, await journeyFacts()),
      schema: planSchema,
      maxTokens: 2_000,
    });

    return {
      status: "success",
      data,
      sources: context.sources,
      elapsedMs: result.elapsedMs,
    };
  } catch (error) {
    return toAiResult(error);
  }
}

export async function weeklyReflectionAction(
  from: string,
  to: string,
): Promise<AiResult<import("zod").infer<typeof weeklySchema>>> {
  try {
    const context = await rangeContext(from, to);
    if (context.sources.length === 0) {
      return {
        status: "error",
        message: "Nothing was recorded in that week.",
        retryable: false,
      };
    }

    const { data, result } = await completeJson({
      messages: weeklyPrompt(
        `${formatDay(from)} to ${formatDay(to)}`,
        context.text,
      ),
      schema: weeklySchema,
      maxTokens: 2_500,
    });

    return {
      status: "success",
      data,
      sources: context.sources,
      elapsedMs: result.elapsedMs,
    };
  } catch (error) {
    return toAiResult(error);
  }
}

export async function analyseProgressAction(): Promise<
  AiResult<import("zod").infer<typeof analysisSchema>>
> {
  try {
    const context = await spanContext({ budget: BUDGETS.insights });
    if (context.sources.length === 0) return needsJournal();

    const { data, result } = await completeJson({
      messages: analysisPrompt(await journeyFacts(), context.text),
      schema: analysisSchema,
      maxTokens: 3_000,
    });

    return {
      status: "success",
      data,
      sources: context.sources,
      elapsedMs: result.elapsedMs,
    };
  } catch (error) {
    return toAiResult(error);
  }
}

export async function learningInsightsAction(): Promise<
  AiResult<{
    insights: { observation: string; cited: IndexRecord[] }[];
  }>
> {
  try {
    const context = await spanContext();
    if (context.sources.length < 4) return needsJournal();

    const { data, result } = await completeJson({
      messages: insightsPrompt(context.text),
      schema: insightSchema,
      maxTokens: 3_000,
    });

    const byId = new Map(context.sources.map((record) => [record.id, record]));

    return {
      status: "success",
      data: {
        insights: data.insights.map((insight) => ({
          observation: insight.observation,
          cited: insight.sources
            .map((id) => byId.get(id))
            .filter((record): record is IndexRecord => record !== undefined),
        })),
      },
      sources: context.sources,
      elapsedMs: result.elapsedMs,
    };
  } catch (error) {
    return toAiResult(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Diagrams                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Draw something as a Mermaid diagram.
 *
 * Sends only what the user described, plus any text they highlighted — never
 * the whole entry and never the journal. A diagram is about one idea, so the
 * context it needs is the one the user pointed at.
 *
 * The source is sanitised here as well as in the browser: the model wrapping
 * its answer in a code fence is the single most likely failure, and a fence
 * inside a fence is a mess to discover in a saved file.
 */
export async function generateDiagramAction(input: {
  kind: DiagramKind;
  description: string;
  selection?: string;
}): Promise<AiResult<Diagram>> {
  if (!input.description.trim()) {
    return {
      status: "error",
      message: "Say what the diagram should show, then try again.",
      retryable: false,
    };
  }

  try {
    const { data, result } = await completeJson({
      messages: diagramPrompt(input),
      schema: diagramSchema,
      maxTokens: 2_000,
    });

    const source = sanitiseMermaid(data.source);
    if (!source) {
      return {
        status: "error",
        message: AI_MESSAGES.bad_response,
        retryable: true,
      };
    }

    return {
      status: "success",
      data: { ...data, source },
      elapsedMs: result.elapsedMs,
    };
  } catch (error) {
    return toAiResult(error);
  }
}

/** Whether the UI should offer AI controls at all. */
export async function aiConfiguredAction(): Promise<boolean> {
  return isAiConfigured();
}

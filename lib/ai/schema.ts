import { z } from "zod";

/**
 * The shapes AI responses must satisfy.
 *
 * Every schema here does double duty: it constrains the request (Gemini
 * enforces it server-side) and re-validates the reply. One definition, so the
 * two cannot drift apart.
 *
 * Fields are kept short and optional wherever the honest answer might be
 * "nothing to say". A model given a required field will fill it, and an
 * invented breakthrough is worse than a blank one — this journal is supposed
 * to be a true record.
 */

const line = z.string().max(400);
const paragraph = z.string().max(1_500);

/* -------------------------------------------------------------------------- */
/* Inline assists                                                             */
/* -------------------------------------------------------------------------- */

export const tagSuggestionSchema = z.object({
  tags: z.array(z.string().min(1).max(30)).max(6),
});

export const rewriteSchema = z.object({
  /** The improved text. Never applied without an explicit accept. */
  text: z.string().max(20_000),
  /** What changed, so the user can judge it rather than trust it. */
  note: line.optional(),
});

export const summarySchema = z.object({
  summary: paragraph,
});

export const learningSchema = z.object({
  learned: z.array(line).max(5),
  /** Things the entry shows were misunderstood. Empty is a valid answer. */
  mistakes: z.array(line).max(5),
});

/* -------------------------------------------------------------------------- */
/* Diary reflection                                                           */
/* -------------------------------------------------------------------------- */

export const reflectionSchema = z.object({
  summary: paragraph.optional(),
  learning: paragraph.optional(),
  mistakes: paragraph.optional(),
  breakthrough: paragraph.optional(),
  /** Something recurring across entries, only if it genuinely recurs. */
  pattern: paragraph.optional(),
  nextStep: paragraph.optional(),
  /** Questions worth sitting with. The spec asks for these explicitly. */
  questions: z.array(line).max(3).optional(),
});

export type Reflection = z.infer<typeof reflectionSchema>;

/* -------------------------------------------------------------------------- */
/* Ask My Journey                                                             */
/* -------------------------------------------------------------------------- */

export const answerSchema = z.object({
  answer: z.string().max(4_000),
  /**
   * Ids of entries the answer rests on, so it can be checked rather than
   * believed. An answer with no citations is allowed — it just says so.
   */
  sources: z.array(z.string().max(120)).max(8).default([]),
  /** Set when the journal does not contain enough to answer. */
  insufficient: z.boolean().default(false),
});

/* -------------------------------------------------------------------------- */
/* Coach and planner                                                          */
/* -------------------------------------------------------------------------- */

export const prioritySchema = z.object({
  title: line,
  reason: paragraph,
  minutes: z.number().int().min(5).max(480).optional(),
});

export const coachSchema = z.object({
  primary: prioritySchema,
  supporting: z.array(prioritySchema).max(2).default([]),
  /** One sentence on where things stand. Sets the tone, not a score. */
  standing: paragraph.optional(),
});

export const planSchema = z.object({
  primary: prioritySchema,
  supporting: z.array(prioritySchema).max(2).default([]),
  optional: prioritySchema.optional(),
  totalMinutes: z.number().int().min(5).max(720).optional(),
  /** Why this plan and not another. Required — advice without a why is noise. */
  reason: paragraph,
});

/* -------------------------------------------------------------------------- */
/* Weekly reflection and analysis                                             */
/* -------------------------------------------------------------------------- */

export const weeklySchema = z.object({
  technical: paragraph.optional(),
  important: z.array(line).max(5).default([]),
  highlights: z.array(line).max(5).default([]),
  difficult: paragraph.optional(),
  breakthroughs: z.array(line).max(3).default([]),
  weaknesses: z.array(line).max(3).default([]),
  nextFocus: paragraph.optional(),
});

export const analysisSchema = z.object({
  /** The narrative half. The objective half is computed, never asked for. */
  narrative: z.string().max(3_000),
  strengths: z.array(line).max(4).default([]),
  gaps: z.array(line).max(4).default([]),
});

export const insightSchema = z.object({
  insights: z
    .array(
      z.object({
        observation: paragraph,
        /** Ids the connection is drawn between. */
        sources: z.array(z.string().max(120)).max(4).default([]),
      }),
    )
    .max(5)
    .default([]),
});

/* -------------------------------------------------------------------------- */
/* Mock interview                                                             */
/* -------------------------------------------------------------------------- */

export const interviewTurnSchema = z.object({
  /** What the interviewer says next. */
  message: z.string().max(3_000),
  /** True once the interviewer has finished and evaluated. */
  finished: z.boolean().default(false),
  evaluation: z
    .object({
      summary: paragraph,
      strengths: z.array(line).max(4).default([]),
      improvements: z.array(line).max(4).default([]),
    })
    .optional(),
});

export type InterviewTurn = z.infer<typeof interviewTurnSchema>;

/* -------------------------------------------------------------------------- */
/* Diagrams                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Mermaid source, plus what the model wants to say about it.
 *
 * `note` is where a hedge belongs — "the description didn't say what happens
 * on a cache miss, so that branch is missing" — rather than inside the
 * diagram, where a guess would look like a fact.
 */
export const diagramSchema = z.object({
  source: z.string().min(1).max(6_000),
  /** A caption for the diagram. Optional; the entry may already say it. */
  title: line.optional(),
  /** What was assumed or left out. Empty is the normal case. */
  note: line.optional(),
});

export type Diagram = z.infer<typeof diagramSchema>;

import "server-only";

import { formatDay } from "@/lib/dates";
import {
  getIndex,
  queryIndex,
  type IndexRecord,
} from "@/lib/storage/index-store";
import { ENTRY_TYPES, type EntryType } from "@/lib/types";

/**
 * What the AI is allowed to see.
 *
 * The single most important module in the AI layer, and the one worth reading
 * first. Three rules hold everywhere:
 *
 *   1. **Context is selected per task**, never ambient. Nothing sends "the
 *      journal" — each feature asks for the specific slice it needs.
 *   2. **It is built from the index, not the files.** Index records carry a
 *      160-character excerpt, which bounds every payload by construction and
 *      means a sealed letter's body cannot reach a prompt even by mistake —
 *      the storage layer already replaced it before it got here.
 *   3. **Every selection returns its own disclosure**, derived from the same
 *      data that will be sent. The UI shows that sentence *before* anything
 *      leaves the machine, and the two cannot drift apart.
 *
 * Budgets are in characters rather than tokens. It is an approximation
 * (roughly four characters to a token), but it is one that can be checked
 * exactly and cheaply, and being wrong in the safe direction costs nothing.
 */

export interface Context {
  /** The text handed to the model. */
  text: string;
  /** Records it was built from, so an answer can cite them. */
  sources: IndexRecord[];
  /** Plain statement of what is being sent, for the UI to show first. */
  disclosure: string;
  characters: number;
}

const EMPTY: Context = {
  text: "",
  sources: [],
  disclosure: "Nothing to send yet.",
  characters: 0,
};

/** Roughly four characters to a token; deliberately conservative. */
export const BUDGETS = {
  reflection: 6_000,
  ask: 12_000,
  coach: 8_000,
  weekly: 8_000,
  insights: 12_000,
  planner: 6_000,
} as const;

/* -------------------------------------------------------------------------- */
/* Rendering                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * One entry, as the model sees it.
 *
 * The id leads the block because features that cite their sources need
 * something to cite. Showing only a formatted date meant the model quoted
 * dates in prose but returned no resolvable ids, so citations silently
 * vanished — the answer looked fine and the links were simply absent.
 */
function renderRecord(record: IndexRecord): string {
  const parts = [
    `[id: ${record.id}] ${formatDay(record.date)} · ${ENTRY_TYPES[record.type].label}: ${record.title}`,
  ];

  if (record.mood) parts.push(`  mood: ${record.mood}`);
  if (record.tags.length) parts.push(`  tags: ${record.tags.join(", ")}`);
  if (record.excerpt) parts.push(`  ${record.excerpt}`);

  return parts.join("\n");
}

/**
 * Fill up to `budget` characters, newest first, and stop.
 *
 * Truncation is by whole records rather than by cutting mid-entry: half a
 * diary entry is worse than none, because the model reads the fragment as the
 * whole thought.
 */
function pack(
  records: IndexRecord[],
  budget: number,
): { text: string; used: IndexRecord[] } {
  const used: IndexRecord[] = [];
  const blocks: string[] = [];
  let size = 0;

  for (const record of records) {
    const block = renderRecord(record);
    if (size + block.length > budget) break;
    blocks.push(block);
    used.push(record);
    size += block.length + 2;
  }

  return { text: blocks.join("\n\n"), used };
}

function describe(used: IndexRecord[], extra?: string): string {
  if (used.length === 0) return "Nothing to send yet.";

  // Computed rather than read off the ends: relevance-ranked selections are
  // not in date order, and a disclosure that misstates the range is worse
  // than one that gives none.
  const dates = used.map((record) => record.date).sort();
  const oldest = dates[0];
  const newest = dates.at(-1);

  const span =
    oldest && newest && oldest !== newest
      ? ` from ${formatDay(oldest)} to ${formatDay(newest)}`
      : newest
        ? ` from ${formatDay(newest)}`
        : "";

  const summary = `${used.length} ${used.length === 1 ? "entry" : "entries"}${span}`;
  return `Sends ${extra ? `${extra}, plus ` : ""}a short summary of ${summary}. Nothing else.`;
}

/* -------------------------------------------------------------------------- */
/* Selections                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The most recent entries, optionally excluding one.
 *
 * Used by diary reflection and the planner, where "what has been happening
 * lately" is the whole question.
 */
export async function recentContext(options: {
  limit?: number;
  budget?: number;
  excludeId?: string;
  types?: EntryType[];
}): Promise<Context> {
  const { entries } = await queryIndex({
    limit: (options.limit ?? 8) + 1,
    ...(options.types ? { types: options.types } : {}),
  });

  const candidates = entries
    .filter((entry) => entry.id !== options.excludeId)
    .slice(0, options.limit ?? 8);

  if (candidates.length === 0) return EMPTY;

  const { text, used } = pack(candidates, options.budget ?? BUDGETS.reflection);

  return {
    text,
    sources: used,
    disclosure: describe(used),
    characters: text.length,
  };
}

/**
 * Entries matching a question.
 *
 * Ask My Journey needs breadth, but sending everything is both expensive and
 * a privacy decision nobody made. Keyword overlap against the index narrows it
 * to what the question is actually about, and the recent entries are folded in
 * so a vague question still has something to stand on.
 */
export async function relevantContext(
  question: string,
  options: { budget?: number; limit?: number } = {},
): Promise<Context> {
  const budget = options.budget ?? BUDGETS.ask;
  const limit = options.limit ?? 40;

  const words = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3);

  const all = await getIndex();

  const scored = all
    .map((record) => {
      const haystack =
        `${record.title} ${record.excerpt} ${record.tags.join(" ")}`.toLowerCase();
      const score = words.reduce(
        (sum, word) => sum + (haystack.includes(word) ? 1 : 0),
        0,
      );
      return { record, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) =>
      b.score === a.score
        ? b.record.date.localeCompare(a.record.date)
        : b.score - a.score,
    )
    .map((entry) => entry.record);

  // Recent entries as a floor, so a question that matches nothing still gets
  // grounded in the actual journal rather than answered from thin air.
  const recent = all.slice(0, 10);
  const seen = new Set<string>();
  const merged = [...scored, ...recent].filter((record) => {
    if (seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });

  if (merged.length === 0) return EMPTY;

  const { text, used } = pack(merged.slice(0, limit), budget);

  return {
    text,
    sources: used,
    disclosure: describe(used),
    characters: text.length,
  };
}

/** Everything inside a date range. Used by the weekly reflection. */
export async function rangeContext(
  from: string,
  to: string,
  options: { budget?: number } = {},
): Promise<Context> {
  const { entries } = await queryIndex({ from, to, limit: 200 });
  if (entries.length === 0) return EMPTY;

  const { text, used } = pack(entries, options.budget ?? BUDGETS.weekly);

  return {
    text,
    sources: used,
    disclosure: `Sends a short summary of ${used.length} ${
      used.length === 1 ? "entry" : "entries"
    } from ${formatDay(from)} to ${formatDay(to)}. Nothing else.`,
    characters: text.length,
  };
}

/**
 * A wider slice for spotting patterns over time.
 *
 * Learning Insights is the one feature whose whole job is connecting things
 * that are months apart, so it samples across the journey rather than taking
 * the most recent block — otherwise it can only ever notice this week.
 */
export async function spanContext(
  options: { budget?: number; limit?: number } = {},
): Promise<Context> {
  const all = await getIndex();
  if (all.length === 0) return EMPTY;

  const limit = options.limit ?? 60;

  let sampled = all;
  if (all.length > limit) {
    // Keep the most recent third whole, then thin the rest evenly so older
    // months are still represented instead of falling off the end.
    const recentCount = Math.floor(limit / 3);
    const recent = all.slice(0, recentCount);
    const rest = all.slice(recentCount);
    const step = Math.ceil(rest.length / (limit - recentCount));
    sampled = [...recent, ...rest.filter((_, index) => index % step === 0)];
  }

  const { text, used } = pack(sampled, options.budget ?? BUDGETS.insights);

  return {
    text,
    sources: used,
    disclosure: describe(used),
    characters: text.length,
  };
}

/** Combine a context with the entry currently being written. */
export function withCurrentEntry(
  context: Context,
  entry: { date: string; title: string; body: string },
  options: { budget?: number } = {},
): Context {
  const budget = options.budget ?? 4_000;
  const body = entry.body.slice(0, budget);

  const current = [
    `--- The entry being written ---`,
    `[${formatDay(entry.date)}] ${entry.title || "Untitled"}`,
    body,
  ].join("\n");

  const text = context.text
    ? `${current}\n\n--- Earlier entries, for context ---\n${context.text}`
    : current;

  const truncated = entry.body.length > budget;

  return {
    text,
    sources: context.sources,
    disclosure:
      context.sources.length > 0
        ? describe(
            context.sources,
            truncated
              ? `the first ${budget.toLocaleString()} characters of this entry`
              : "this entry",
          )
        : `Sends this entry (${body.length.toLocaleString()} characters). Nothing else.`,
    characters: text.length,
  };
}

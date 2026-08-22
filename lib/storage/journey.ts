import "server-only";

import { z } from "zod";

import { readJson, resolve, withLock, writeJson } from "@/lib/storage/fs";

/**
 * The journey record — title, start date, target, current focus.
 *
 * First of the entity storage modules, and the shape every later one follows:
 * a Zod schema, a typed reader, a typed writer. Nothing outside `lib/storage`
 * knows where any of this lives on disk.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected a YYYY-MM-DD date");

export const journeySchema = z.object({
  title: z.string().min(1).max(120),
  startDate: isoDate,
  targetDate: isoDate.optional(),
  target: z.string().min(1).max(200),
  currentFocus: z.string().max(200).default(""),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Journey = z.infer<typeof journeySchema>;

const JOURNEY_FILE = () => resolve("data", "journey.json");

export const DEFAULT_JOURNEY: Omit<Journey, "createdAt" | "updatedAt"> = {
  title: "My Amazon SDE Journey",
  startDate: "2026-08-16",
  target: "Amazon SDE interview",
  currentFocus: "",
};

/** Read the journey. Returns `null` before it has been started. */
export async function getJourney(): Promise<Journey | null> {
  return readJson(JOURNEY_FILE(), journeySchema);
}

/**
 * Read the journey, creating it from defaults on first run so the app always
 * has something to render.
 */
export async function getOrCreateJourney(): Promise<Journey> {
  const file = JOURNEY_FILE();

  return withLock(file, async () => {
    const existing = await readJson(file, journeySchema);
    if (existing) return existing;

    const now = new Date().toISOString();
    return writeJson(
      file,
      { ...DEFAULT_JOURNEY, createdAt: now, updatedAt: now },
      journeySchema,
    );
  });
}

/** Apply a partial update. `createdAt` is never overwritten. */
export async function saveJourney(
  patch: Partial<Omit<Journey, "createdAt" | "updatedAt">>,
): Promise<Journey> {
  const file = JOURNEY_FILE();

  return withLock(file, async () => {
    const existing = await readJson(file, journeySchema);
    const now = new Date().toISOString();

    const next: Journey = {
      ...DEFAULT_JOURNEY,
      ...existing,
      ...patch,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    return writeJson(file, next, journeySchema);
  });
}

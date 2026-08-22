import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Analytics correctness.
 *
 * Every figure on these pages is derived from the records, so the only way it
 * earns the right to be believed is a test that builds a known journal and
 * checks the numbers that come out.
 */

let dataDir: string;
let analytics: typeof import("@/lib/analytics/compute");
let problems: typeof import("@/lib/storage/problems");
let sessions: typeof import("@/lib/storage/sessions");
let entries: typeof import("@/lib/storage/entries");
let journey: typeof import("@/lib/storage/journey");

beforeEach(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "journey-analytics-"));
  vi.stubEnv("DATA_DIR", dataDir);
  vi.resetModules();

  analytics = await import("@/lib/analytics/compute");
  problems = await import("@/lib/storage/problems");
  sessions = await import("@/lib/storage/sessions");
  entries = await import("@/lib/storage/entries");
  journey = await import("@/lib/storage/journey");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  await fsp.rm(dataDir, { recursive: true, force: true });
});

/** Freeze the clock so "today" is stable across the suite. */
function freezeAt(date: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${date}T12:00:00`));
}

describe("preparation progress", () => {
  it("counts days, entries and active days from the records", async () => {
    freezeAt("2026-08-20");
    await journey.saveJourney({ startDate: "2026-08-16" });

    await entries.updateEntry("diary", "2026-08-16", { date: "2026-08-16" });
    await entries.updateEntry("diary", "2026-08-18", { date: "2026-08-18" });
    await problems.createProblem({ name: "Two Sum", date: "2026-08-18" });

    const progress = await analytics.preparationProgress();

    expect(progress.dayNumber).toBe(5); // 16th is day 1
    expect(progress.entries).toBe(3);
    // Two distinct dates carry entries, even though one holds two of them.
    expect(progress.activeDays).toBe(2);
    expect(progress.problems).toBe(1);
  });

  it("never reports consistency above 100%", async () => {
    freezeAt("2026-08-16");
    await journey.saveJourney({ startDate: "2026-08-16" });
    await entries.updateEntry("diary", "2026-08-16", { date: "2026-08-16" });

    const progress = await analytics.preparationProgress();
    expect(progress.consistency).toBeLessThanOrEqual(1);
  });

  it("reports days since the last entry", async () => {
    freezeAt("2026-08-20");
    await journey.saveJourney({ startDate: "2026-08-16" });
    await entries.updateEntry("diary", "2026-08-17", { date: "2026-08-17" });

    const progress = await analytics.preparationProgress();
    expect(progress.lastActive).toBe("2026-08-17");
    expect(progress.daysSinceActive).toBe(3);
  });

  it("handles an empty journal without dividing by zero", async () => {
    freezeAt("2026-08-16");
    const progress = await analytics.preparationProgress();

    expect(progress.entries).toBe(0);
    expect(progress.consistency).toBe(0);
    expect(progress.daysSinceActive).toBeNull();
    expect(Number.isFinite(progress.consistency)).toBe(true);
  });
});

describe("problem statistics", () => {
  beforeEach(async () => {
    freezeAt("2026-08-20");

    const a = await problems.createProblem({
      name: "Two Sum",
      date: "2026-08-16",
      difficulty: "easy",
    });
    await problems.addAttempt(a.id, {
      date: "2026-08-16",
      result: "solved",
      approach: "",
    });

    const b = await problems.createProblem({
      name: "LRU Cache",
      date: "2026-08-17",
      difficulty: "hard",
    });
    await problems.addAttempt(b.id, {
      date: "2026-08-17",
      result: "stuck",
      approach: "",
    });
    await problems.addAttempt(b.id, {
      date: "2026-08-18",
      result: "solved",
      approach: "",
    });

    await problems.createProblem({
      name: "Unlabelled",
      date: "2026-08-19",
    });
  });

  it("splits by difficulty and keeps unset separate", async () => {
    const stats = await analytics.problemStats();

    expect(stats.total).toBe(3);
    expect(stats.byDifficulty).toEqual([
      { level: "easy", count: 1, solved: 1 },
      { level: "hard", count: 1, solved: 1 },
      { level: "unset", count: 1, solved: 0 },
    ]);
  });

  it("separates solved-first-time from solved-eventually", async () => {
    const stats = await analytics.problemStats();

    expect(stats.firstTime).toBe(1); // Two Sum
    expect(stats.neededMoreThanOne).toBe(1); // LRU Cache
    expect(stats.totalAttempts).toBe(3);
  });

  it("computes the median attempts over attempted problems only", async () => {
    // Attempt counts are [1, 2]; the third problem has none and is excluded.
    expect((await analytics.problemStats()).medianAttempts).toBe(1.5);
  });

  it("omits statuses with no problems", async () => {
    const stats = await analytics.problemStats();
    expect(stats.byStatus.every((row) => row.count > 0)).toBe(true);
  });
});

describe("study consistency", () => {
  it("marks the days that have entries and leaves the rest blank", async () => {
    freezeAt("2026-08-20");
    await journey.saveJourney({ startDate: "2026-08-16" });

    await entries.updateEntry("diary", "2026-08-18", { date: "2026-08-18" });
    await entries.updateEntry("diary", "2026-08-20", { date: "2026-08-20" });

    const consistency = await analytics.studyConsistency();

    expect(consistency.totalDays).toBe(5);
    expect(consistency.activeDays).toBe(2);
    expect(consistency.days.at(-1)?.date).toBe("2026-08-20");
    expect(consistency.days[0]?.date).toBe("2026-08-16");
    expect(consistency.days[0]?.count).toBe(0);
  });

  it("counts a run only up to the most recent gap", async () => {
    freezeAt("2026-08-20");
    await journey.saveJourney({ startDate: "2026-08-16" });

    // 16th, 17th, then a gap, then 19th and 20th.
    for (const date of [
      "2026-08-16",
      "2026-08-17",
      "2026-08-19",
      "2026-08-20",
    ]) {
      await entries.updateEntry("diary", date, { date });
    }

    const consistency = await analytics.studyConsistency();
    expect(consistency.currentStreak).toBe(2);
    expect(consistency.longestStreak).toBe(2);
  });

  it("reports no run when today has nothing", async () => {
    freezeAt("2026-08-20");
    await journey.saveJourney({ startDate: "2026-08-16" });
    await entries.updateEntry("diary", "2026-08-18", { date: "2026-08-18" });

    expect((await analytics.studyConsistency()).currentStreak).toBe(0);
  });

  it("adds up practice minutes per day", async () => {
    freezeAt("2026-08-20");
    await journey.saveJourney({ startDate: "2026-08-16" });

    await sessions.createSession({ date: "2026-08-18", minutes: 60 });
    await sessions.createSession({ date: "2026-08-18", minutes: 30 });

    const day = (await analytics.studyConsistency()).days.find(
      (d) => d.date === "2026-08-18",
    );
    expect(day?.minutes).toBe(90);
  });
});

describe("confidence timeline", () => {
  it("groups moods into lower, neutral and higher by month", async () => {
    freezeAt("2026-09-05");

    await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      mood: "frustrated",
    });
    await entries.updateEntry("diary", "2026-08-17", {
      date: "2026-08-17",
      mood: "neutral",
    });
    await entries.updateEntry("diary", "2026-09-01", {
      date: "2026-09-01",
      mood: "proud",
    });
    await entries.updateEntry("diary", "2026-09-02", {
      date: "2026-09-02",
      mood: "confident",
    });

    const timeline = await analytics.confidenceTimeline();

    expect(timeline.recorded).toBe(4);
    expect(timeline.months).toEqual([
      { month: "2026-08", lower: 1, neutral: 1, higher: 0, total: 2 },
      { month: "2026-09", lower: 0, neutral: 0, higher: 2, total: 2 },
    ]);
  });

  it("ignores entries with no mood", async () => {
    freezeAt("2026-08-20");
    await entries.updateEntry("diary", "2026-08-16", { date: "2026-08-16" });

    expect((await analytics.confidenceTimeline()).recorded).toBe(0);
  });

  it("places every mood on the scale exactly once", async () => {
    const { MOODS } = await import("@/lib/types");
    for (const mood of MOODS) {
      expect(analytics.MOOD_SCALE[mood]).toBeDefined();
    }
  });
});

describe("learning trends", () => {
  it("counts a problem in the month it was first solved", async () => {
    freezeAt("2026-09-30");

    // Recorded in August, solved in September.
    const problem = await problems.createProblem({
      name: "LRU Cache",
      date: "2026-08-16",
    });
    await problems.addAttempt(problem.id, {
      date: "2026-08-16",
      result: "stuck",
      approach: "",
    });
    await problems.addAttempt(problem.id, {
      date: "2026-09-10",
      result: "solved",
      approach: "",
    });

    // An entry in each month so both appear on the axis.
    await entries.updateEntry("diary", "2026-08-16", { date: "2026-08-16" });
    await entries.updateEntry("diary", "2026-09-10", { date: "2026-09-10" });

    const trends = await analytics.learningTrends();
    const byMonth = new Map(
      trends.solvedByMonth.map((p) => [p.label, p.value]),
    );

    expect(byMonth.get("2026-08")).toBe(0);
    expect(byMonth.get("2026-09")).toBe(1);
  });

  it("returns every month on the axis, including empty ones", async () => {
    freezeAt("2026-09-30");
    await entries.updateEntry("diary", "2026-08-16", { date: "2026-08-16" });
    await entries.updateEntry("diary", "2026-09-01", { date: "2026-09-01" });

    const trends = await analytics.learningTrends();

    expect(trends.months).toEqual(["2026-08", "2026-09"]);
    expect(trends.solvedByMonth.map((p) => p.label)).toEqual([
      "2026-08",
      "2026-09",
    ]);
    // Series are the same length as the axis, so charts line up.
    expect(trends.writtenByMonth).toHaveLength(2);
    expect(trends.practiceMinutesByMonth).toHaveLength(2);
  });

  it("sums practice minutes per month", async () => {
    freezeAt("2026-08-31");
    await entries.updateEntry("diary", "2026-08-16", { date: "2026-08-16" });
    await sessions.createSession({ date: "2026-08-16", minutes: 60 });
    await sessions.createSession({ date: "2026-08-20", minutes: 45 });

    const trends = await analytics.learningTrends();
    expect(trends.practiceMinutesByMonth[0]).toEqual({
      label: "2026-08",
      value: 105,
    });
  });

  it("counts only written types as entries written", async () => {
    freezeAt("2026-08-31");
    await entries.updateEntry("diary", "2026-08-16", { date: "2026-08-16" });
    await entries.createEntry("reflection", { date: "2026-08-16" });
    await problems.createProblem({ name: "Two Sum", date: "2026-08-16" });

    const trends = await analytics.learningTrends();
    // The problem is not "written".
    expect(trends.writtenByMonth[0]?.value).toBe(2);
  });
});

describe("topic progress", () => {
  it("only lists topics with problems, most first", async () => {
    freezeAt("2026-08-20");

    await problems.createProblem({
      name: "Two Sum",
      date: "2026-08-16",
      topics: ["arrays", "hashing"],
    });
    await problems.createProblem({
      name: "Group Anagrams",
      date: "2026-08-17",
      topics: ["hashing"],
    });

    const topics = await analytics.topicProgress();

    expect(topics.map((t) => t.id)).toEqual(["hashing", "arrays"]);
    expect(topics[0]?.problems).toBe(2);
  });
});

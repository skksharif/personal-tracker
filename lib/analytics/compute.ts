import "server-only";

import { daysBetween, parseDay, today } from "@/lib/dates";
import { getIndex, type IndexRecord } from "@/lib/storage/index-store";
import { getOrCreateJourney } from "@/lib/storage/journey";
import {
  lastPracticed,
  listProblems,
  type Problem,
} from "@/lib/storage/problems";
import { listSessions, sessionTotals } from "@/lib/storage/sessions";
import { summariseTopics, type TopicSummary } from "@/lib/storage/topics";
import type { Difficulty } from "@/lib/technical";
import { MOODS, type EntryType, type Mood } from "@/lib/types";

/**
 * Analytics computation.
 *
 * Pure functions over the stored records — no chart code, no colours, no JSX.
 * Keeping the numbers apart from their drawing means they can be tested for
 * correctness on their own, which is the only way a progress figure earns the
 * right to be believed.
 *
 * Nothing here reads a stored counter. Every value is derived, so it cannot
 * drift from the journal it describes.
 */

export interface Point {
  /** YYYY-MM-DD or YYYY-MM, depending on the series. */
  label: string;
  value: number;
}

/* -------------------------------------------------------------------------- */
/* Preparation progress                                                       */
/* -------------------------------------------------------------------------- */

export interface PreparationProgress {
  dayNumber: number;
  daysToTarget: number | null;
  targetDate?: string;
  startDate: string;
  entries: number;
  activeDays: number;
  /** Share of elapsed days with at least one entry, 0–1. */
  consistency: number;
  problems: number;
  solved: number;
  practiceMinutes: number;
  topicsTouched: number;
  lastActive?: string;
  /** Days since anything was last recorded. */
  daysSinceActive: number | null;
}

export async function preparationProgress(): Promise<PreparationProgress> {
  const [journey, index, problems, sessions, topics] = await Promise.all([
    getOrCreateJourney(),
    getIndex(),
    listProblems(),
    sessionTotals(),
    summariseTopics(),
  ]);

  const now = today();
  const dayNumber = daysBetween(journey.startDate, now) + 1;
  const activeDays = new Set(index.map((entry) => entry.date)).size;
  const last = index[0]?.date;

  return {
    dayNumber,
    startDate: journey.startDate,
    daysToTarget: journey.targetDate
      ? daysBetween(now, journey.targetDate)
      : null,
    entries: index.length,
    activeDays,
    consistency: dayNumber > 0 ? Math.min(activeDays / dayNumber, 1) : 0,
    problems: problems.length,
    solved: problems.filter(
      (p) => p.status === "solved" || p.status === "solved-with-help",
    ).length,
    practiceMinutes: sessions.minutes,
    topicsTouched: topics.filter((t) => t.problemCount > 0).length,
    ...(journey.targetDate ? { targetDate: journey.targetDate } : {}),
    ...(last ? { lastActive: last } : {}),
    daysSinceActive: last ? daysBetween(last, now) : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Topic progress                                                             */
/* -------------------------------------------------------------------------- */

export interface TopicBar {
  id: string;
  name: string;
  problems: number;
  solved: number;
  attempts: number;
  status: TopicSummary["status"];
  lastPractised?: string;
}

/** Topics with work on them, most problems first. */
export async function topicProgress(): Promise<TopicBar[]> {
  const topics = await summariseTopics();

  return topics
    .filter((topic) => topic.problemCount > 0)
    .map((topic) => ({
      id: topic.id,
      name: topic.name,
      problems: topic.problemCount,
      solved: topic.solvedCount,
      attempts: topic.attemptCount,
      status: topic.status,
      ...(topic.lastPractised ? { lastPractised: topic.lastPractised } : {}),
    }));
}

/* -------------------------------------------------------------------------- */
/* Problem statistics                                                         */
/* -------------------------------------------------------------------------- */

export interface ProblemStats {
  total: number;
  byDifficulty: {
    level: Difficulty | "unset";
    count: number;
    solved: number;
  }[];
  byStatus: { status: Problem["status"]; count: number }[];
  /** Solved, but not on the first attempt. */
  neededMoreThanOne: number;
  /** Solved on the first attempt. */
  firstTime: number;
  totalAttempts: number;
  medianAttempts: number;
}

export async function problemStats(): Promise<ProblemStats> {
  const problems = await listProblems();

  const levels: (Difficulty | "unset")[] = ["easy", "medium", "hard", "unset"];
  const byDifficulty = levels
    .map((level) => {
      const matching = problems.filter(
        (p) => (p.difficulty ?? "unset") === level,
      );
      return {
        level,
        count: matching.length,
        solved: matching.filter(
          (p) => p.status === "solved" || p.status === "solved-with-help",
        ).length,
      };
    })
    .filter((row) => row.count > 0);

  const statuses: Problem["status"][] = [
    "solved",
    "solved-with-help",
    "attempted",
    "needs-revisit",
  ];
  const byStatus = statuses
    .map((status) => ({
      status,
      count: problems.filter((p) => p.status === status).length,
    }))
    .filter((row) => row.count > 0);

  const attemptCounts = problems
    .map((p) => p.attempts.length)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);

  const middle = Math.floor(attemptCounts.length / 2);
  const medianAttempts =
    attemptCounts.length === 0
      ? 0
      : attemptCounts.length % 2 === 1
        ? (attemptCounts[middle] ?? 0)
        : ((attemptCounts[middle - 1] ?? 0) + (attemptCounts[middle] ?? 0)) / 2;

  const solvedProblems = problems.filter((p) =>
    p.attempts.some((a) => a.result === "solved"),
  );

  return {
    total: problems.length,
    byDifficulty,
    byStatus,
    totalAttempts: problems.reduce((sum, p) => sum + p.attempts.length, 0),
    medianAttempts,
    firstTime: solvedProblems.filter((p) => p.attempts[0]?.result === "solved")
      .length,
    neededMoreThanOne: solvedProblems.filter(
      (p) => p.attempts[0]?.result !== "solved",
    ).length,
  };
}

/* -------------------------------------------------------------------------- */
/* Study consistency                                                          */
/* -------------------------------------------------------------------------- */

export interface ConsistencyDay {
  date: string;
  /** Entries recorded on this day, across every type. */
  count: number;
  minutes: number;
}

export interface Consistency {
  days: ConsistencyDay[];
  activeDays: number;
  totalDays: number;
  currentStreak: number;
  longestStreak: number;
  busiestDay?: ConsistencyDay;
}

/**
 * A day-by-day record ending today.
 *
 * Streaks are computed but presented as observation, never as a target. The
 * product principles are explicit that an unproductive day is a valid part of
 * the journey, and a streak counter is the fastest way to turn that into
 * pressure.
 */
export async function studyConsistency(limitDays = 180): Promise<Consistency> {
  const [journey, index, sessions] = await Promise.all([
    getOrCreateJourney(),
    getIndex(),
    listSessions(),
  ]);

  const now = today();
  const span = Math.max(daysBetween(journey.startDate, now) + 1, 1);
  const total = Math.min(span, limitDays);

  const counts = new Map<string, number>();
  for (const entry of index) {
    counts.set(entry.date, (counts.get(entry.date) ?? 0) + 1);
  }

  const minutes = new Map<string, number>();
  for (const session of sessions) {
    minutes.set(
      session.date,
      (minutes.get(session.date) ?? 0) + session.minutes,
    );
  }

  // Walk forward from the first day shown, so the strip reads left to right.
  const first = parseDay(now);
  first.setDate(first.getDate() - (total - 1));

  const days: ConsistencyDay[] = [];
  for (let offset = 0; offset < total; offset++) {
    const day = new Date(first);
    day.setDate(first.getDate() + offset);
    const date = today(day);

    days.push({
      date,
      count: counts.get(date) ?? 0,
      minutes: minutes.get(date) ?? 0,
    });
  }

  let currentStreak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if ((days[i]?.count ?? 0) > 0) currentStreak++;
    else break;
  }

  let longestStreak = 0;
  let run = 0;
  for (const day of days) {
    if (day.count > 0) {
      run++;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 0;
    }
  }

  const busiest = days.reduce<ConsistencyDay | undefined>(
    (best, day) => (day.count > (best?.count ?? 0) ? day : best),
    undefined,
  );

  return {
    days,
    activeDays: days.filter((day) => day.count > 0).length,
    totalDays: total,
    currentStreak,
    longestStreak,
    ...(busiest && busiest.count > 0 ? { busiestDay: busiest } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Confidence timeline                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Where each mood sits on a low → high scale.
 *
 * An ordering of the words the user chose, not a measurement of them. Every
 * page rendering it says so: the spec forbids presenting emotional data as a
 * diagnosis, and a score with a decimal point is the fastest way to imply one.
 */
export const MOOD_SCALE: Record<Mood, -1 | 0 | 1> = {
  disappointed: -1,
  frustrated: -1,
  tired: -1,
  confused: -1,
  neutral: 0,
  hopeful: 1,
  motivated: 1,
  confident: 1,
  proud: 1,
};

export interface ConfidenceMonth {
  month: string;
  lower: number;
  neutral: number;
  higher: number;
  total: number;
}

export interface ConfidenceTimeline {
  months: ConfidenceMonth[];
  recorded: number;
  entries: { date: string; mood: Mood; href: string; title: string }[];
}

export async function confidenceTimeline(): Promise<ConfidenceTimeline> {
  const index = await getIndex();

  const recorded = index.filter(
    (entry): entry is IndexRecord & { mood: Mood } =>
      Boolean(entry.mood) && MOODS.includes(entry.mood as Mood),
  );

  const byMonth = new Map<string, ConfidenceMonth>();

  for (const entry of recorded) {
    const month = entry.date.slice(0, 7);
    const row = byMonth.get(month) ?? {
      month,
      lower: 0,
      neutral: 0,
      higher: 0,
      total: 0,
    };

    const side = MOOD_SCALE[entry.mood];
    if (side < 0) row.lower++;
    else if (side > 0) row.higher++;
    else row.neutral++;
    row.total++;

    byMonth.set(month, row);
  }

  return {
    months: [...byMonth.values()].sort((a, b) =>
      a.month.localeCompare(b.month),
    ),
    recorded: recorded.length,
    entries: recorded
      .slice(0, 200)
      .reverse()
      .map((entry) => ({
        date: entry.date,
        mood: entry.mood,
        href: entry.href,
        title: entry.title,
      })),
  };
}

/* -------------------------------------------------------------------------- */
/* Learning trends                                                            */
/* -------------------------------------------------------------------------- */

export interface LearningTrends {
  months: string[];
  /** Problems solved per month, oldest first. */
  solvedByMonth: Point[];
  writtenByMonth: Point[];
  practiceMinutesByMonth: Point[];
  activityByMonth: { month: string; total: number }[];
}

const WRITTEN: EntryType[] = ["diary", "reflection", "experience", "letter"];

export async function learningTrends(): Promise<LearningTrends> {
  const [index, problems, sessions] = await Promise.all([
    getIndex(),
    listProblems(),
    listSessions(),
  ]);

  const months = [
    ...new Set(index.map((entry) => entry.date.slice(0, 7))),
  ].sort();

  const bucket = (source: { month: string; value: number }[]): Point[] => {
    const map = new Map(months.map((month) => [month, 0]));
    for (const { month, value } of source) {
      if (map.has(month)) map.set(month, (map.get(month) ?? 0) + value);
    }
    return months.map((month) => ({
      label: month,
      value: map.get(month) ?? 0,
    }));
  };

  // A problem counts in the month it was first *solved* — the month the
  // learning actually landed, not the month it was first written down.
  const solved = problems
    .filter((p) => p.attempts.some((a) => a.result === "solved"))
    .map((p) => {
      const first = [...p.attempts]
        .filter((a) => a.result === "solved")
        .sort((a, b) => a.date.localeCompare(b.date))[0];
      return { month: (first?.date ?? lastPracticed(p)).slice(0, 7), value: 1 };
    });

  return {
    months,
    solvedByMonth: bucket(solved),
    writtenByMonth: bucket(
      index
        .filter((entry) => WRITTEN.includes(entry.type))
        .map((entry) => ({ month: entry.date.slice(0, 7), value: 1 })),
    ),
    practiceMinutesByMonth: bucket(
      sessions.map((s) => ({ month: s.date.slice(0, 7), value: s.minutes })),
    ),
    activityByMonth: months.map((month) => ({
      month,
      total: index.filter((entry) => entry.date.startsWith(month)).length,
    })),
  };
}

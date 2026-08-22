import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 4's two load-bearing claims:
 *
 *   1. Topic counts are *derived* from problem records, so they cannot drift.
 *   2. A link made in one place is answerable from the other.
 */

let dataDir: string;
let problems: typeof import("@/lib/storage/problems");
let topics: typeof import("@/lib/storage/topics");
let notes: typeof import("@/lib/storage/notes");
let sessions: typeof import("@/lib/storage/sessions");
let entries: typeof import("@/lib/storage/entries");
let store: typeof import("@/lib/storage/index-store");

beforeEach(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "journey-tech-"));
  vi.stubEnv("DATA_DIR", dataDir);
  vi.resetModules();

  problems = await import("@/lib/storage/problems");
  topics = await import("@/lib/storage/topics");
  notes = await import("@/lib/storage/notes");
  sessions = await import("@/lib/storage/sessions");
  entries = await import("@/lib/storage/entries");
  store = await import("@/lib/storage/index-store");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fsp.rm(dataDir, { recursive: true, force: true });
});

describe("problems", () => {
  it("names the file after the problem, not the day", async () => {
    const problem = await problems.createProblem({
      name: "Two Sum",
      date: "2026-08-16",
    });

    expect(problem.id).toBe("two-sum");
    expect(await fsp.readdir(path.join(dataDir, "problems"))).toEqual([
      "two-sum.json",
    ]);
  });

  it("strips a pasted leading number from the title", async () => {
    expect(problems.slugifyProblem("1. Two Sum")).toBe("two-sum");
  });

  it("keeps two problems with the same name apart", async () => {
    const a = await problems.createProblem({
      name: "Two Sum",
      date: "2026-08-16",
    });
    const b = await problems.createProblem({
      name: "Two Sum",
      date: "2026-08-17",
    });

    expect(a.id).toBe("two-sum");
    expect(b.id).toBe("two-sum-2");
  });

  it("records an attempt and moves the status", async () => {
    const created = await problems.createProblem({
      name: "Two Sum",
      date: "2026-08-16",
    });
    expect(created.status).toBe("attempted");

    const stuck = await problems.addAttempt(created.id, {
      date: "2026-08-16",
      approach: "nested loops",
      result: "stuck",
    });
    expect(stuck.status).toBe("needs-revisit");

    const solved = await problems.addAttempt(created.id, {
      date: "2026-08-18",
      approach: "hash map",
      result: "solved",
    });
    expect(solved.status).toBe("solved");
    expect(solved.attempts).toHaveLength(2);
  });

  it("does not un-solve a problem after a later stuck attempt", async () => {
    // The record is of what was achieved, not of the latest mood.
    const created = await problems.createProblem({
      name: "LRU Cache",
      date: "2026-08-16",
    });

    await problems.addAttempt(created.id, {
      date: "2026-08-16",
      result: "solved",
      approach: "",
    });
    const after = await problems.addAttempt(created.id, {
      date: "2026-09-01",
      result: "stuck",
      approach: "forgot the eviction order",
    });

    expect(after.status).toBe("solved");
  });

  it("tracks the most recent attempt as last practised", async () => {
    const created = await problems.createProblem({
      name: "Two Sum",
      date: "2026-08-16",
    });

    expect(problems.lastPracticed(created)).toBe("2026-08-16");

    const after = await problems.addAttempt(created.id, {
      date: "2026-09-02",
      result: "solved",
      approach: "",
    });

    expect(problems.lastPracticed(after)).toBe("2026-09-02");
  });

  it("puts the breakthrough on the timeline, not the metadata", async () => {
    const created = await problems.createProblem({
      name: "Two Sum",
      date: "2026-08-16",
      difficulty: "easy",
      topics: ["arrays"],
    });

    // With nothing written, the excerpt falls back to metadata.
    expect((await store.getIndex())[0]?.excerpt).toContain("easy");

    await problems.updateProblem(created.id, {
      breakthrough: "You store what you need, not what you have.",
    });

    expect((await store.getIndex())[0]?.excerpt).toBe(
      "You store what you need, not what you have.",
    );
  });

  it("keeps topics and tags when only an attempt is recorded", async () => {
    // Zod's .partial() still applies field defaults, so a patch of
    // {attempts, status} used to arrive carrying `topics: []` and silently
    // wipe the real topics on every save.
    const created = await problems.createProblem({
      name: "Two Sum",
      date: "2026-08-16",
      topics: ["arrays", "hashing"],
      tags: ["revisit"],
      difficulty: "easy",
    });

    const after = await problems.addAttempt(created.id, {
      date: "2026-08-17",
      result: "solved",
      approach: "hash map",
    });

    expect(after.topics).toEqual(["arrays", "hashing"]);
    expect(after.tags).toEqual(["revisit"]);
    expect(after.difficulty).toBe("easy");
  });

  it("keeps the learning record when only one field is edited", async () => {
    const created = await problems.createProblem({
      name: "LRU Cache",
      date: "2026-08-16",
      topics: ["design"],
    });

    await problems.updateProblem(created.id, {
      struggle: "Kept losing the eviction order.",
    });
    const after = await problems.updateProblem(created.id, {
      breakthrough: "The list holds order, the map holds lookup.",
    });

    expect(after.struggle).toBe("Kept losing the eviction order.");
    expect(after.breakthrough).toBe(
      "The list holds order, the map holds lookup.",
    );
    expect(after.topics).toEqual(["design"]);
  });

  it("rejects a problem with no name", async () => {
    await expect(
      problems.createProblem({ name: "", date: "2026-08-16" }),
    ).rejects.toThrow();
  });
});

describe("topic counts are derived, never stored", () => {
  it("counts problems, attempts and solves from the records", async () => {
    const a = await problems.createProblem({
      name: "Two Sum",
      date: "2026-08-16",
      topics: ["arrays", "hashing"],
      difficulty: "easy",
    });
    await problems.addAttempt(a.id, {
      date: "2026-08-16",
      result: "stuck",
      approach: "",
    });
    await problems.addAttempt(a.id, {
      date: "2026-08-17",
      result: "solved",
      approach: "",
    });

    const b = await problems.createProblem({
      name: "Group Anagrams",
      date: "2026-08-20",
      topics: ["hashing"],
      difficulty: "medium",
    });
    await problems.addAttempt(b.id, {
      date: "2026-08-20",
      result: "solved",
      approach: "",
    });

    const summary = await topics.summariseTopics();
    const hashing = summary.find((topic) => topic.id === "hashing");
    const arrays = summary.find((topic) => topic.id === "arrays");

    expect(hashing).toMatchObject({
      problemCount: 2,
      attemptCount: 3,
      solvedCount: 2,
    });
    expect(hashing?.difficulty).toEqual({ easy: 1, medium: 1, hard: 0 });
    expect(hashing?.firstPractised).toBe("2026-08-16");
    expect(hashing?.lastPractised).toBe("2026-08-20");

    expect(arrays).toMatchObject({ problemCount: 1, solvedCount: 1 });
  });

  it("drops the counts when a problem is deleted", async () => {
    const problem = await problems.createProblem({
      name: "Two Sum",
      date: "2026-08-16",
      topics: ["arrays"],
    });

    expect(
      (await topics.summariseTopics()).find((t) => t.id === "arrays")
        ?.problemCount,
    ).toBe(1);

    await problems.deleteProblem(problem.id);

    // A stored counter would still read 1 here. That is the whole point.
    expect(
      (await topics.summariseTopics()).find((t) => t.id === "arrays")
        ?.problemCount ?? 0,
    ).toBe(0);
  });

  it("surfaces a topic seen only on a problem, with no topic file", async () => {
    await problems.createProblem({
      name: "Course Schedule",
      date: "2026-08-16",
      topics: ["graphs"],
    });

    const graphs = (await topics.summariseTopics()).find(
      (topic) => topic.id === "graphs",
    );

    expect(graphs?.implicit).toBe(true);
    expect(graphs?.problemCount).toBe(1);
    expect(graphs?.status).toBe("not-started");
  });

  it("keeps the user's own status and notes alongside derived counts", async () => {
    await problems.createProblem({
      name: "Course Schedule",
      date: "2026-08-16",
      topics: ["graphs"],
    });

    await topics.saveTopic("graphs", {
      name: "graphs",
      status: "practising",
      notes: "Remember to mark visited before recursing.",
    });

    const graphs = await topics.summariseTopic("graphs");
    expect(graphs?.status).toBe("practising");
    expect(graphs?.notes).toContain("mark visited");
    expect(graphs?.problemCount).toBe(1);
    expect(graphs?.implicit).toBe(false);
  });

  it("does not put topics on the timeline", async () => {
    await topics.saveTopic("graphs", { name: "graphs", status: "learning" });
    expect(await store.getIndex()).toEqual([]);
  });
});

describe("cross-linking", () => {
  it("answers the reverse question from a diary link", async () => {
    const problem = await problems.createProblem({
      name: "Two Sum",
      date: "2026-08-16",
    });

    await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      title: "It finally clicked",
      relatedProblems: [problem.id],
    });

    // The link was made on the diary entry; the problem can find it.
    const references = await store.findReferencesTo(problem.id);
    expect(references).toHaveLength(1);
    expect(references[0]).toMatchObject({
      type: "diary",
      title: "It finally clicked",
      href: "/diary/2026-08-16",
    });
  });

  it("stops referencing once the link is removed", async () => {
    const problem = await problems.createProblem({
      name: "Two Sum",
      date: "2026-08-16",
    });

    await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      relatedProblems: [problem.id],
    });
    expect(await store.findReferencesTo(problem.id)).toHaveLength(1);

    await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      relatedProblems: [],
    });
    expect(await store.findReferencesTo(problem.id)).toHaveLength(0);
  });

  it("resolves ids to records in the order given", async () => {
    const a = await problems.createProblem({
      name: "Alpha",
      date: "2026-08-16",
    });
    const b = await problems.createProblem({
      name: "Beta",
      date: "2026-08-17",
    });

    const resolved = await store.resolveRelations([b.id, a.id]);
    expect(resolved.map((record) => record.title)).toEqual(["Beta", "Alpha"]);
  });

  it("ignores ids that no longer exist", async () => {
    const problem = await problems.createProblem({
      name: "Alpha",
      date: "2026-08-16",
    });

    expect(
      await store.resolveRelations([problem.id, "deleted-long-ago"]),
    ).toHaveLength(1);
  });
});

describe("notes, designs and sessions", () => {
  it("keeps each note kind in its own directory with the right href", async () => {
    await notes.createNote("learning", { title: "Recursion" });
    await notes.createNote("fundamentals", {
      title: "Deadlock",
      subject: "Operating Systems",
    });
    await notes.createNote("design", { title: "URL shortener" });

    const index = await store.getIndex();
    const byTitle = new Map(index.map((r) => [r.title, r]));

    expect(byTitle.get("Recursion")?.href).toBe("/technical/notes/recursion");
    expect(byTitle.get("Deadlock")?.href).toBe(
      "/technical/fundamentals/deadlock",
    );
    expect(byTitle.get("URL shortener")?.href).toBe(
      "/technical/design/url-shortener",
    );

    // Designs are their own timeline type; notes and fundamentals share one.
    expect(byTitle.get("URL shortener")?.type).toBe("design");
    expect(byTitle.get("Deadlock")?.type).toBe("note");
  });

  it("opens a design with the section scaffold in place", async () => {
    const design = await notes.createNote("design", { title: "URL shortener" });

    expect(design.body).toContain("## Functional requirements");
    expect(design.body).toContain("## Trade-offs");
    expect(design.body).toContain("## Lessons");
  });

  it("does not scaffold an ordinary note", async () => {
    expect(
      (await notes.createNote("learning", { title: "Recursion" })).body,
    ).toBe("");
  });

  it("carries a fundamentals subject into the index tags", async () => {
    await notes.createNote("fundamentals", {
      title: "Deadlock",
      subject: "Operating Systems",
    });

    expect((await store.getIndex())[0]?.tags).toContain("Operating Systems");
  });

  it("records a session with nothing solved", async () => {
    // The kind of day a solved-count would erase.
    const session = await sessions.createSession({
      date: "2026-08-16",
      minutes: 90,
      attempted: 3,
      solved: 0,
      reflection: "Got nowhere. Still showed up.",
    });

    expect(session.solved).toBe(0);

    const [record] = await store.getIndex();
    expect(record?.title).toContain("1h 30m");
    expect(record?.excerpt).toBe("Got nowhere. Still showed up.");
  });

  it("allows more than one session in a day", async () => {
    const a = await sessions.createSession({ date: "2026-08-16" });
    const b = await sessions.createSession({ date: "2026-08-16" });

    expect(a.id).toBe("practice-2026-08-16");
    expect(b.id).toBe("practice-2026-08-16-2");
  });

  it("never lets a session take the diary's id for that day", async () => {
    // Both used to be identified by the bare date, so recording a session on a
    // day you also wrote made one of them vanish from the index.
    await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      title: "A day I wrote about",
    });
    const session = await sessions.createSession({
      date: "2026-08-16",
      minutes: 60,
    });

    expect(session.id).not.toBe("2026-08-16");

    const index = await store.getIndex();
    expect(index).toHaveLength(2);
    expect(index.map((record) => record.type).sort()).toEqual([
      "diary",
      "session",
    ]);
  });

  it("keeps ids unique across different collections", async () => {
    // A milestone and a reflection with the same title on the same day would
    // otherwise both slug to `2026-08-16-first-mock-interview`.
    const milestones = await import("@/lib/storage/milestones");

    const milestone = await milestones.createMilestone({
      date: "2026-08-16",
      title: "First mock interview",
    });
    const reflection = await entries.createEntry("reflection", {
      date: "2026-08-16",
      title: "First mock interview",
    });

    expect(milestone.id).not.toBe(reflection.id);
    expect(await store.getIndex()).toHaveLength(2);
  });

  it("totals sessions across distinct days", async () => {
    await sessions.createSession({
      date: "2026-08-16",
      minutes: 60,
      solved: 1,
      attempted: 2,
    });
    await sessions.createSession({
      date: "2026-08-16",
      minutes: 30,
      solved: 0,
      attempted: 1,
    });
    await sessions.createSession({
      date: "2026-08-17",
      minutes: 45,
      solved: 2,
      attempted: 2,
    });

    expect(await sessions.sessionTotals()).toEqual({
      count: 3,
      minutes: 135,
      attempted: 5,
      solved: 3,
      days: 2,
    });
  });

  it("formats durations readably", async () => {
    expect(sessions.formatMinutes(45)).toBe("45m");
    expect(sessions.formatMinutes(60)).toBe("1h");
    expect(sessions.formatMinutes(135)).toBe("2h 15m");
  });
});

describe("index rebuild covers every technical type", () => {
  it("reproduces the index exactly from the entity files", async () => {
    await problems.createProblem({
      name: "Two Sum",
      date: "2026-08-16",
      topics: ["arrays"],
    });
    await notes.createNote("learning", { title: "Recursion" });
    await notes.createNote("design", { title: "URL shortener" });
    await sessions.createSession({ date: "2026-08-16", minutes: 60 });
    await entries.updateEntry("diary", "2026-08-16", { date: "2026-08-16" });

    const indexFile = path.join(dataDir, "index.json");
    const incremental = await fsp.readFile(indexFile, "utf8");

    await fsp.rm(indexFile);
    await import("@/lib/storage/register");
    await store.rebuildIndex();

    expect(await fsp.readFile(indexFile, "utf8")).toBe(incremental);
  });
});

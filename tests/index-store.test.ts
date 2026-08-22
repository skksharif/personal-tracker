import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IndexRecord } from "@/lib/storage/index-store";

/**
 * The index is what the timeline, home page and progress all read. Two
 * properties matter most and are hard to notice breaking by eye:
 *
 *   1. Its ordering is deterministic, so an index grown by incremental writes
 *      matches one produced by a full rebuild.
 *   2. Cursor paging visits every entry exactly once.
 */

let dataDir: string;
let store: typeof import("@/lib/storage/index-store");
let milestones: typeof import("@/lib/storage/milestones");

beforeEach(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "journey-index-"));
  vi.stubEnv("DATA_DIR", dataDir);
  vi.resetModules();

  store = await import("@/lib/storage/index-store");
  milestones = await import("@/lib/storage/milestones");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fsp.rm(dataDir, { recursive: true, force: true });
});

const record = (
  id: string,
  date: string,
  overrides: Partial<IndexRecord> = {},
): IndexRecord => ({
  id,
  type: "milestone",
  date,
  title: id,
  excerpt: "",
  tags: [],
  href: `/journey/milestones#${id}`,
  related: [],
  updatedAt: "2026-08-16T10:00:00.000Z",
  ...overrides,
});

describe("index ordering", () => {
  it("returns entries newest first regardless of insertion order", async () => {
    await store.upsertIndexEntry(record("b", "2026-08-10"));
    await store.upsertIndexEntry(record("a", "2026-09-01"));
    await store.upsertIndexEntry(record("c", "2026-08-20"));

    const dates = (await store.getIndex()).map((entry) => entry.date);
    expect(dates).toEqual(["2026-09-01", "2026-08-20", "2026-08-10"]);
  });

  it("breaks ties on the same date by id", async () => {
    await store.upsertIndexEntry(record("zebra", "2026-08-16"));
    await store.upsertIndexEntry(record("alpha", "2026-08-16"));
    await store.upsertIndexEntry(record("mango", "2026-08-16"));

    const ids = (await store.getIndex()).map((entry) => entry.id);
    expect(ids).toEqual(["alpha", "mango", "zebra"]);
  });

  it("replaces rather than duplicates on re-upsert", async () => {
    await store.upsertIndexEntry(record("a", "2026-08-16", { title: "First" }));
    await store.upsertIndexEntry(
      record("a", "2026-08-16", { title: "Second" }),
    );

    const entries = await store.getIndex();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.title).toBe("Second");
  });

  it("moves an entry when its date changes", async () => {
    await store.upsertIndexEntry(record("a", "2026-08-01"));
    await store.upsertIndexEntry(record("b", "2026-08-15"));
    await store.upsertIndexEntry(record("a", "2026-09-01"));

    expect((await store.getIndex()).map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("removes an entry", async () => {
    await store.upsertIndexEntry(record("a", "2026-08-16"));
    await store.upsertIndexEntry(record("b", "2026-08-17"));
    await store.removeIndexEntry("a");

    expect((await store.getIndex()).map((e) => e.id)).toEqual(["b"]);
  });

  it("treats removing an unknown id as a no-op", async () => {
    await store.upsertIndexEntry(record("a", "2026-08-16"));
    await expect(store.removeIndexEntry("nope")).resolves.toBeUndefined();
    expect(await store.getIndex()).toHaveLength(1);
  });

  it("returns an empty index before anything is written", async () => {
    expect(await store.getIndex()).toEqual([]);
  });
});

describe("queryIndex", () => {
  beforeEach(async () => {
    await store.upsertIndexEntry(
      record("m1", "2026-08-01", { tags: ["start"] }),
    );
    await store.upsertIndexEntry(
      record("d1", "2026-08-05", {
        type: "diary",
        title: "Recursion clicked",
        excerpt: "Finally understood the call stack.",
        tags: ["dsa", "recursion"],
      }),
    );
    await store.upsertIndexEntry(
      record("p1", "2026-08-10", { type: "problem", title: "Two Sum" }),
    );
  });

  it("filters by type", async () => {
    const { entries, total } = await store.queryIndex({ types: ["diary"] });
    expect(entries.map((e) => e.id)).toEqual(["d1"]);
    expect(total).toBe(1);
  });

  it("filters by multiple types", async () => {
    const { entries } = await store.queryIndex({
      types: ["diary", "problem"],
    });
    expect(entries.map((e) => e.id)).toEqual(["p1", "d1"]);
  });

  it("filters by tag", async () => {
    const { entries } = await store.queryIndex({ tags: ["recursion"] });
    expect(entries.map((e) => e.id)).toEqual(["d1"]);
  });

  it("filters by date range inclusively", async () => {
    const { entries } = await store.queryIndex({
      from: "2026-08-05",
      to: "2026-08-10",
    });
    expect(entries.map((e) => e.id)).toEqual(["p1", "d1"]);
  });

  it("searches title, excerpt and tags", async () => {
    expect(
      (await store.queryIndex({ search: "recursion" })).entries.map(
        (e) => e.id,
      ),
    ).toEqual(["d1"]);
    expect(
      (await store.queryIndex({ search: "call stack" })).entries.map(
        (e) => e.id,
      ),
    ).toEqual(["d1"]);
    expect(
      (await store.queryIndex({ search: "Two Sum" })).entries.map((e) => e.id),
    ).toEqual(["p1"]);
  });

  it("reports total before pagination", async () => {
    const { entries, total } = await store.queryIndex({ limit: 1 });
    expect(entries).toHaveLength(1);
    expect(total).toBe(3);
  });
});

describe("cursor pagination", () => {
  beforeEach(async () => {
    // 60 entries across 60 consecutive days.
    for (let day = 1; day <= 60; day++) {
      const date = `2026-08-${`${day}`.padStart(2, "0")}`;
      const iso =
        day <= 31 ? date : `2026-09-${`${day - 31}`.padStart(2, "0")}`;
      await store.upsertIndexEntry(record(`e${day}`, iso));
    }
  });

  it("walks every entry exactly once with no gaps or repeats", async () => {
    const seen: string[] = [];
    let cursor: string | null | undefined;

    for (let page = 0; page < 10; page++) {
      const result = await store.queryIndex({
        limit: 25,
        ...(cursor ? { cursor } : {}),
      });
      seen.push(...result.entries.map((entry) => entry.id));
      cursor = result.nextCursor;
      if (!cursor) break;
    }

    expect(seen).toHaveLength(60);
    expect(new Set(seen).size).toBe(60);

    const all = (await store.getIndex()).map((entry) => entry.id);
    expect(seen).toEqual(all);
  });

  it("stops offering a cursor on the final page", async () => {
    const { nextCursor } = await store.queryIndex({ limit: 100 });
    expect(nextCursor).toBeNull();
  });

  it("falls back to the start when a cursor no longer exists", async () => {
    const { nextCursor } = await store.queryIndex({ limit: 25 });
    expect(nextCursor).not.toBeNull();

    // The entry the cursor pointed at is deleted between pages.
    await store.removeIndexEntry(nextCursor!.split("|")[1]!);

    const result = await store.queryIndex({ limit: 25, cursor: nextCursor! });
    // No throw, no empty page — the reader keeps going.
    expect(result.entries.length).toBeGreaterThan(0);
  });
});

describe("rebuildIndex", () => {
  it("reproduces the index file exactly from the entity files", async () => {
    await milestones.createMilestone({
      date: "2026-08-16",
      title: "Started the journey",
      note: "Set up the project.",
    });
    await milestones.createMilestone({
      date: "2026-09-01",
      title: "First mock interview",
      note: "Went badly. Learned a lot.",
    });
    await milestones.createMilestone({
      date: "2026-08-20",
      title: "Solved a hard problem",
    });

    const indexFile = path.join(dataDir, "index.json");
    const incremental = await fsp.readFile(indexFile, "utf8");

    // Throw the cache away entirely, then rebuild from the milestone files.
    await fsp.rm(indexFile);
    await store.rebuildIndex();

    const rebuilt = await fsp.readFile(indexFile, "utf8");
    expect(rebuilt).toBe(incremental);
  });

  it("recovers an index that was deleted", async () => {
    await milestones.createMilestone({
      date: "2026-08-16",
      title: "Started",
    });

    await fsp.rm(path.join(dataDir, "index.json"));
    expect(await store.getIndex()).toEqual([]);

    const entries = await store.rebuildIndex();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.title).toBe("Started");
  });

  it("drops records for entities that no longer exist", async () => {
    const milestone = await milestones.createMilestone({
      date: "2026-08-16",
      title: "Temporary",
    });

    // Delete the file directly, leaving the index stale.
    await fsp.rm(path.join(dataDir, "milestones", `${milestone.id}.json`));
    expect(await store.getIndex()).toHaveLength(1);

    expect(await store.rebuildIndex()).toEqual([]);
  });
});

describe("milestones maintain the index", () => {
  it("indexes on create", async () => {
    const milestone = await milestones.createMilestone({
      date: "2026-08-16",
      title: "First mock interview",
      note: "It went badly, but I learned what to fix.",
    });

    const entries = await store.getIndex();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: milestone.id,
      type: "milestone",
      date: "2026-08-16",
      title: "First mock interview",
      excerpt: "It went badly, but I learned what to fix.",
    });
  });

  it("updates the index on edit", async () => {
    const milestone = await milestones.createMilestone({
      date: "2026-08-16",
      title: "Old title",
    });

    await milestones.updateMilestone(milestone.id, {
      date: "2026-08-18",
      title: "New title",
    });

    const entries = await store.getIndex();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      title: "New title",
      date: "2026-08-18",
    });
  });

  it("removes from the index on delete", async () => {
    const milestone = await milestones.createMilestone({
      date: "2026-08-16",
      title: "Gone",
    });

    await milestones.deleteMilestone(milestone.id);
    expect(await store.getIndex()).toEqual([]);
  });

  it("gives milestones readable, chronological, unique ids", async () => {
    const a = await milestones.createMilestone({
      date: "2026-08-16",
      title: "First mock interview!",
    });
    const b = await milestones.createMilestone({
      date: "2026-08-16",
      title: "First mock interview!",
    });

    expect(a.id).toBe("2026-08-16-first-mock-interview");
    expect(b.id).toBe("2026-08-16-first-mock-interview-2");

    const files = await fsp.readdir(path.join(dataDir, "milestones"));
    expect(files.sort()).toEqual([
      "2026-08-16-first-mock-interview-2.json",
      "2026-08-16-first-mock-interview.json",
    ]);
  });

  it("rejects a milestone with no title", async () => {
    await expect(
      milestones.createMilestone({ date: "2026-08-16", title: "" }),
    ).rejects.toThrow();
    expect(await store.getIndex()).toEqual([]);
  });

  it("rejects a malformed date", async () => {
    await expect(
      milestones.createMilestone({ date: "16-08-2026", title: "Bad date" }),
    ).rejects.toThrow();
  });
});

describe("toExcerpt", () => {
  it("returns short text unchanged", async () => {
    expect(store.toExcerpt("A short note.")).toBe("A short note.");
  });

  it("strips markdown and collapses whitespace", async () => {
    expect(store.toExcerpt("# Heading\n\n**bold**  and `code`")).toBe(
      "Heading bold and code",
    );
  });

  it("drops image syntax", async () => {
    expect(store.toExcerpt("Before ![alt](/uploads/a.webp) after")).toBe(
      "Before after",
    );
  });

  it("truncates on a word boundary with an ellipsis", async () => {
    const excerpt = store.toExcerpt(`${"word ".repeat(60)}`, 40);
    expect(excerpt.length).toBeLessThanOrEqual(41);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt).not.toMatch(/wor…$/);
  });
});

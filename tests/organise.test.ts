import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Search, tags and bookmarks.
 *
 * These are the features that reach *across* the modules, so the risk they
 * carry is different from the storage layer's: not losing a file, but quietly
 * failing to find one, or rewriting the wrong thing while renaming a tag.
 *
 * Every test builds a real journal on disk and asks the real question.
 */

let dataDir: string;
let search: typeof import("@/lib/search");
let tags: typeof import("@/lib/storage/tags");
let bookmarks: typeof import("@/lib/storage/bookmarks");
let entries: typeof import("@/lib/storage/entries");
let problems: typeof import("@/lib/storage/problems");
let notes: typeof import("@/lib/storage/notes");

beforeEach(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "journey-organise-"));
  vi.stubEnv("DATA_DIR", dataDir);
  vi.resetModules();

  search = await import("@/lib/search");
  tags = await import("@/lib/storage/tags");
  bookmarks = await import("@/lib/storage/bookmarks");
  entries = await import("@/lib/storage/entries");
  problems = await import("@/lib/storage/problems");
  notes = await import("@/lib/storage/notes");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fsp.rm(dataDir, { recursive: true, force: true });
});

/**
 * One entry of each kind that carries user text, so a search test can prove it
 * reaches every module rather than only the one it was written against.
 */
async function seed() {
  await entries.updateEntry("diary", "2026-08-01", {
    date: "2026-08-01",
    title: "Sliding window finally clicked",
    body: "Spent the evening on the sliding window pattern. It clicked.",
    tags: ["dp", "arrays"],
  });

  await entries.updateEntry("reflection", "reflection-week-one", {
    date: "2026-08-02",
    title: "Week one",
    body: "Consistency matters more than intensity.",
    tags: ["habits"],
  });

  const problem = await problems.createProblem({
    name: "Longest Substring Without Repeating Characters",
    date: "2026-08-03",
    topics: ["sliding-window"],
    tags: ["dp"],
  });

  await problems.updateProblem(problem.id, {
    breakthrough: "The window only ever needs to shrink from the left.",
  });

  const note = await notes.createNote("learning", {
    title: "Hash maps",
    date: "2026-08-04",
    body: "Amortised O(1) is an average, not a promise.",
    tags: ["hashing"],
  });

  return { problemId: problem.id, noteId: note.id };
}

describe("parseQuery", () => {
  it("splits on whitespace", () => {
    expect(search.parseQuery("sliding window")).toEqual(["sliding", "window"]);
  });

  it("keeps a quoted phrase whole", () => {
    expect(search.parseQuery('"sliding window" hash')).toEqual([
      "sliding window",
      "hash",
    ]);
  });

  it("ignores empty input", () => {
    expect(search.parseQuery("   ")).toEqual([]);
  });
});

describe("search", () => {
  it("finds a phrase written in any module", async () => {
    const { problemId, noteId } = await seed();

    const window = await search.search({ query: "sliding window" });
    const ids = window.hits.map((hit) => hit.record.id);

    // The diary entry (title), the problem (topic tag) — one phrase, two
    // modules, one result set.
    expect(ids).toContain("2026-08-01");
    expect(ids).toContain(problemId);

    const hashing = await search.search({ query: "amortised" });
    expect(hashing.hits.map((hit) => hit.record.id)).toEqual([noteId]);
  });

  it("requires every term to match somewhere", async () => {
    await seed();

    const both = await search.search({ query: "sliding unicorn" });
    expect(both.total).toBe(0);
  });

  it("ranks a title match above a body match", async () => {
    await entries.updateEntry("diary", "2026-08-10", {
      date: "2026-08-10",
      title: "Recursion",
      body: "Nothing to see here.",
    });
    await entries.updateEntry("diary", "2026-08-11", {
      date: "2026-08-11",
      title: "Tuesday",
      body: "A long slog through recursion problems.",
    });

    const results = await search.search({ query: "recursion" });
    expect(results.hits[0]?.record.id).toBe("2026-08-10");
    expect(results.hits[0]?.matchedIn).toContain("title");
  });

  it("counts types before applying the type filter, so the filter chips stay usable", async () => {
    await seed();

    const filtered = await search.search({
      query: "sliding",
      types: ["diary"],
    });

    expect(filtered.hits.every((hit) => hit.record.type === "diary")).toBe(
      true,
    );
    // The chip for problems still has to show a number, or filtering to diary
    // would strand the user with no way back.
    expect(filtered.typeCounts.problem).toBeGreaterThan(0);
  });

  it("never returns a sealed letter's body", async () => {
    await entries.updateEntry("letter", "letter-2027", {
      date: "2026-08-05",
      title: "For the offer day",
      body: "A secret written for later.",
      openOn: "2030-01-01",
    });

    const bySecret = await search.search({ query: "secret" });
    expect(bySecret.total).toBe(0);

    // The letter itself is still findable by its title — it is the author's
    // own journal, and only the body is held back.
    const byTitle = await search.search({ query: "offer day" });
    expect(byTitle.hits.map((hit) => hit.record.id)).toContain("letter-2027");
  });

  it("with no query, returns everything the filters allow", async () => {
    await seed();

    const tagged = await search.search({ query: "", tags: ["dp"] });
    expect(tagged.total).toBe(2);
  });
});

describe("tags", () => {
  it("derives the registry from the entries", async () => {
    await seed();

    const summary = await tags.summariseTags();
    const dp = summary.find((entry) => entry.tag === "dp");

    expect(dp?.count).toBe(2);
    expect(dp?.types).toContain("diary");
    expect(dp?.types).toContain("problem");
  });

  it("renames a tag everywhere it appears", async () => {
    await seed();

    const changed = await tags.renameTag("dp", "dynamic-programming");
    expect(changed).toBe(2);

    expect(await tags.recordsWithTag("dp")).toEqual([]);
    expect(await tags.recordsWithTag("dynamic-programming")).toHaveLength(2);
  });

  it("renaming onto an existing tag merges without duplicating it", async () => {
    await seed();

    await tags.renameTag("arrays", "dp");

    const diary = await entries.getEntry("diary", "2026-08-01");
    expect(diary?.tags).toEqual(["dp"]);
  });

  it("normalises the new name the way the tag input does", async () => {
    await seed();
    await tags.renameTag("habits", "  Daily Habits  ");

    expect(await tags.recordsWithTag("daily-habits")).toHaveLength(1);
  });

  it("leaves the entry's own words untouched when a tag is deleted", async () => {
    await seed();
    const before = await entries.getEntry("diary", "2026-08-01");

    await tags.deleteTag("dp");

    const after = await entries.getEntry("diary", "2026-08-01");
    expect(after?.body).toBe(before?.body);
    expect(after?.title).toBe(before?.title);
    expect(after?.tags).toEqual(["arrays"]);
  });

  it("reports how many records a rename actually changed", async () => {
    await seed();
    expect(await tags.renameTag("nonexistent", "something")).toBe(0);
    expect(await tags.renameTag("dp", "dp")).toBe(0);
  });
});

describe("bookmarks", () => {
  it("toggles and reports the state afterwards", async () => {
    await seed();

    expect(await bookmarks.toggleBookmark("2026-08-01")).toBe(true);
    expect(await bookmarks.isBookmarked("2026-08-01")).toBe(true);

    expect(await bookmarks.toggleBookmark("2026-08-01")).toBe(false);
    expect(await bookmarks.isBookmarked("2026-08-01")).toBe(false);
  });

  it("skips an id whose entry has since been deleted", async () => {
    await seed();

    await bookmarks.toggleBookmark("2026-08-01");
    await bookmarks.toggleBookmark("reflection-week-one");
    await entries.deleteEntry("diary", "2026-08-01");

    const listed = await bookmarks.listBookmarks();
    expect(listed.map((record) => record.id)).toEqual(["reflection-week-one"]);

    // The id is skipped, not pruned — so restoring the file from a backup
    // brings the bookmark back with it.
    expect(await bookmarks.isBookmarked("2026-08-01")).toBe(true);
  });

  it("does not touch the entry it stars", async () => {
    await seed();
    const before = await fsp.readFile(
      path.join(dataDir, "diary", "2026-08-01.md"),
      "utf8",
    );

    await bookmarks.toggleBookmark("2026-08-01");

    const after = await fsp.readFile(
      path.join(dataDir, "diary", "2026-08-01.md"),
      "utf8",
    );
    expect(after).toBe(before);
  });
});

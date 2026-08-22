import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The diary is the most personal content in the product, and the only copy of
 * it is the file on disk. These tests are mostly about one thing: what the
 * user wrote comes back exactly as they wrote it.
 */

let dataDir: string;
let entries: typeof import("@/lib/storage/entries");
let store: typeof import("@/lib/storage/index-store");

beforeEach(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "journey-entries-"));
  vi.stubEnv("DATA_DIR", dataDir);
  vi.resetModules();

  entries = await import("@/lib/storage/entries");
  store = await import("@/lib/storage/index-store");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fsp.rm(dataDir, { recursive: true, force: true });
});

describe("diary entries", () => {
  it("creates the file on first save at a date that has none", async () => {
    // The editor opens at a date whether or not anything exists there, so the
    // first autosave must upsert rather than fail.
    const entry = await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      body: "First words.",
    });

    expect(entry.id).toBe("2026-08-16");
    expect(entry.body).toBe("First words.");

    const raw = await fsp.readFile(
      path.join(dataDir, "diary", "2026-08-16.md"),
      "utf8",
    );
    expect(raw).toContain("First words.");
  });

  it("round-trips a body exactly", async () => {
    const body = [
      "Started with two-sum. Got stuck on the hash map.",
      "",
      "![the whiteboard](/uploads/images/board.webp)",
      "",
      "Then it clicked — you store what you *need*, not what you have.",
      "",
      "```python",
      "seen = {}",
      "```",
    ].join("\n");

    await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      body,
    });

    expect((await entries.getEntry("diary", "2026-08-16"))?.body).toBe(body);
  });

  it("preserves a body that opens with a horizontal rule", async () => {
    // The gray-matter failure mode from Phase 0, guarded end to end.
    const body = "---\n\nA line under a rule.";
    await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      body,
    });

    expect((await entries.getEntry("diary", "2026-08-16"))?.body).toBe(body);
  });

  it("does not blank out metadata on a body-only autosave", async () => {
    await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      title: "Recursion",
      tags: ["dsa", "recursion"],
      mood: "hopeful",
    });

    // The editor's next autosave carries only the body.
    await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      body: "More words.",
    });

    const entry = await entries.getEntry("diary", "2026-08-16");
    expect(entry?.title).toBe("Recursion");
    expect(entry?.tags).toEqual(["dsa", "recursion"]);
    expect(entry?.mood).toBe("hopeful");
    expect(entry?.body).toBe("More words.");
  });

  it("keeps createdAt across edits and moves updatedAt", async () => {
    const first = await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      body: "One",
    });

    await new Promise((resolve) => setTimeout(resolve, 5));

    const second = await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      body: "Two",
    });

    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).not.toBe(first.updatedAt);
  });

  it("uses the date as the id, one entry per day", async () => {
    await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      body: "A",
    });
    await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      body: "B",
    });

    expect(await fsp.readdir(path.join(dataDir, "diary"))).toEqual([
      "2026-08-16.md",
    ]);
  });

  it("stays readable as plain Markdown", async () => {
    await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      title: "A good day",
      body: "It went well.",
      mood: "proud",
    });

    const raw = await fsp.readFile(
      path.join(dataDir, "diary", "2026-08-16.md"),
      "utf8",
    );

    expect(raw.startsWith("---\n")).toBe(true);
    expect(raw).toContain("title: A good day");
    expect(raw).toContain("mood: proud");
    expect(raw).toContain("It went well.");
  });

  it("rejects an invalid mood", async () => {
    await expect(
      entries.updateEntry("diary", "2026-08-16", {
        date: "2026-08-16",
        mood: "ecstatic" as never,
      }),
    ).rejects.toThrow();
  });
});

describe("collections", () => {
  it("gives reflections slugged, unique ids", async () => {
    const a = await entries.createEntry("reflection", {
      date: "2026-08-16",
      title: "Why this is hard",
    });
    const b = await entries.createEntry("reflection", {
      date: "2026-08-16",
      title: "Why this is hard",
    });

    expect(a.id).toBe("2026-08-16-why-this-is-hard");
    expect(b.id).toBe("2026-08-16-why-this-is-hard-2");
  });

  it("allows several entries on one day", async () => {
    await entries.createEntry("experience", {
      date: "2026-08-16",
      title: "Morning",
    });
    await entries.createEntry("experience", {
      date: "2026-08-16",
      title: "Evening",
    });

    expect(await entries.listEntries("experience")).toHaveLength(2);
  });

  it("keeps each type in its own directory", async () => {
    await entries.updateEntry("diary", "2026-08-16", { date: "2026-08-16" });
    await entries.createEntry("reflection", { date: "2026-08-16" });
    await entries.createEntry("experience", { date: "2026-08-16" });
    await entries.createEntry("letter", { date: "2026-08-16" });

    expect((await fsp.readdir(dataDir)).sort()).toEqual([
      "diary",
      "experiences",
      "index.json",
      "letters",
      "reflections",
    ]);
  });

  it("lists newest first", async () => {
    await entries.createEntry("reflection", {
      date: "2026-08-01",
      title: "Older",
    });
    await entries.createEntry("reflection", {
      date: "2026-09-01",
      title: "Newer",
    });

    expect(
      (await entries.listEntries("reflection")).map((e) => e.title),
    ).toEqual(["Newer", "Older"]);
  });

  it("skips a file that no longer parses instead of failing the list", async () => {
    await entries.createEntry("reflection", {
      date: "2026-08-16",
      title: "Good",
    });

    await fsp.writeFile(
      path.join(dataDir, "reflections", "broken.md"),
      "---\nid: broken\ndate: not-a-date\n---\n\nBroken.",
      "utf8",
    );

    const list = await entries.listEntries("reflection");
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe("Good");
  });
});

describe("sealed letters", () => {
  it("hides the body from the index until its date", async () => {
    await entries.createEntry("letter", {
      date: "2026-08-16",
      title: "Read this after the interview",
      body: "Whatever happened, you did the work.",
      openOn: "2027-01-01",
    });

    const [record] = await store.getIndex();
    expect(record?.title).toBe("Read this after the interview");
    expect(record?.excerpt).toBe("Sealed until it is time.");
    expect(record?.excerpt).not.toContain("you did the work");
  });

  it("reveals the excerpt once the date has passed", async () => {
    await entries.createEntry("letter", {
      date: "2026-08-16",
      title: "Already open",
      body: "You can read this now.",
      openOn: "2026-01-01",
    });

    const [record] = await store.getIndex();
    expect(record?.excerpt).toBe("You can read this now.");
  });

  it("treats a letter with no open date as readable", async () => {
    await entries.createEntry("letter", {
      date: "2026-08-16",
      body: "No seal on this one.",
    });

    const [record] = await store.getIndex();
    expect(record?.excerpt).toBe("No seal on this one.");
  });

  it("computes sealing against a given day", async () => {
    const sealed = {
      type: "letter" as const,
      openOn: "2027-01-01",
    } as Parameters<typeof entries.isSealed>[0];

    expect(entries.isSealed(sealed, "2026-08-16")).toBe(true);
    expect(entries.isSealed(sealed, "2027-01-01")).toBe(false);
    expect(entries.isSealed(sealed, "2027-06-01")).toBe(false);
  });
});

describe("index integration", () => {
  it("indexes every entry type with the right href", async () => {
    await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      title: "Diary",
    });
    await entries.createEntry("reflection", {
      date: "2026-08-15",
      title: "Reflection",
    });
    await entries.createEntry("experience", {
      date: "2026-08-14",
      title: "Experience",
    });
    await entries.createEntry("letter", {
      date: "2026-08-13",
      title: "Letter",
    });

    const index = await store.getIndex();
    expect(index).toHaveLength(4);

    expect(index.map((e) => [e.type, e.href])).toEqual([
      ["diary", "/diary/2026-08-16"],
      ["reflection", "/diary/reflections/2026-08-15-reflection"],
      ["experience", "/diary/experiences/2026-08-14-experience"],
      ["letter", "/diary/future/2026-08-13-letter"],
    ]);
  });

  it("carries mood and the first image into the index", async () => {
    await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      title: "With a photo",
      mood: "proud",
      media: [
        { path: "/uploads/images/a.webp", type: "image", alt: "desk" },
        { path: "/uploads/images/b.webp", type: "image", alt: "second" },
      ],
    });

    const [record] = await store.getIndex();
    expect(record?.mood).toBe("proud");
    expect(record?.thumb).toBe("/uploads/images/a.webp");
  });

  it("falls back to a default title when none was written", async () => {
    await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      body: "Wrote something, titled nothing.",
    });

    expect((await store.getIndex())[0]?.title).toBe("Untitled entry");
  });

  it("removes the entry from the index on delete", async () => {
    await entries.updateEntry("diary", "2026-08-16", { date: "2026-08-16" });
    await entries.deleteEntry("diary", "2026-08-16");

    expect(await store.getIndex()).toEqual([]);
  });

  it("rebuilds identically from the entry files", async () => {
    await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      title: "Day one",
      body: "Words.",
      mood: "hopeful",
    });
    await entries.createEntry("reflection", {
      date: "2026-08-15",
      title: "A reflection",
      body: "More words.",
    });

    const indexFile = path.join(dataDir, "index.json");
    const incremental = await fsp.readFile(indexFile, "utf8");

    await fsp.rm(indexFile);
    await store.rebuildIndex();

    expect(await fsp.readFile(indexFile, "utf8")).toBe(incremental);
  });
});

describe("ai reflections", () => {
  it("stores AI output beside the body without touching it", async () => {
    const body = "My own words, exactly as I wrote them.";
    await entries.updateEntry("diary", "2026-08-16", {
      date: "2026-08-16",
      body,
    });

    await entries.saveAiReflection("diary", "2026-08-16", {
      summary: "A productive day.",
      nextStep: "Try the harder variant.",
      generatedAt: new Date().toISOString(),
    });

    const entry = await entries.getEntry("diary", "2026-08-16");
    expect(entry?.body).toBe(body);
    expect(entry?.aiReflection?.summary).toBe("A productive day.");
  });
});

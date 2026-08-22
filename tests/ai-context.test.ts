import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the AI is allowed to see.
 *
 * This is the privacy boundary of the whole product, so it gets tested the way
 * a boundary should be: with a journal deliberately larger than any budget,
 * asserting that what comes out is bounded, excludes what it must exclude, and
 * describes itself accurately.
 */

let dataDir: string;
let context: typeof import("@/lib/ai/context");
let entries: typeof import("@/lib/storage/entries");
let problems: typeof import("@/lib/storage/problems");

beforeEach(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "journey-ai-"));
  vi.stubEnv("DATA_DIR", dataDir);
  vi.resetModules();

  context = await import("@/lib/ai/context");
  entries = await import("@/lib/storage/entries");
  problems = await import("@/lib/storage/problems");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fsp.rm(dataDir, { recursive: true, force: true });
});

/** A journal far larger than any single budget. */
async function seed(days = 60) {
  for (let i = 0; i < days; i++) {
    const day = new Date(2026, 5, 1 + i);
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;

    await entries.updateEntry("diary", date, {
      date,
      title: `Day ${i + 1}`,
      body: `Worked on recursion and hashing. ${"Long detail. ".repeat(40)}`,
      tags: i % 2 === 0 ? ["recursion"] : ["hashing"],
    });
  }
}

describe("budgets", () => {
  it("never exceeds the budget it was given", async () => {
    await seed();

    for (const [name, build] of [
      ["recent", () => context.recentContext({ limit: 50, budget: 3_000 })],
      [
        "relevant",
        () => context.relevantContext("recursion", { budget: 3_000 }),
      ],
      ["span", () => context.spanContext({ budget: 3_000 })],
      [
        "range",
        () =>
          context.rangeContext("2026-06-01", "2026-08-01", { budget: 3_000 }),
      ],
    ] as const) {
      const built = await build();
      expect(built.characters, name).toBeLessThanOrEqual(3_000);
      expect(built.text.length, name).toBe(built.characters);
    }
  });

  it("truncates by whole entries, never mid-entry", async () => {
    await seed(20);
    const built = await context.recentContext({ limit: 20, budget: 2_000 });

    // Every block that made it in is complete, so the model never reads half
    // a thought as the whole thought.
    for (const source of built.sources) {
      expect(built.text).toContain(source.title);
    }
    expect(built.sources.length).toBeLessThan(20);
  });

  it("reports the number of entries it actually used", async () => {
    await seed(40);
    const built = await context.recentContext({ limit: 40, budget: 2_500 });

    expect(built.disclosure).toContain(String(built.sources.length));
    expect(built.sources.length).toBeGreaterThan(0);
  });
});

describe("what is excluded", () => {
  it("never sends a sealed letter's body", async () => {
    // The storage layer replaces a sealed excerpt before it reaches the index,
    // and the context builder reads the index — so the secret cannot arrive
    // here even by mistake. This is the test that keeps that true.
    await entries.createEntry("letter", {
      date: "2026-06-01",
      title: "Read after the interview",
      body: "SECRET-CONTENTS-DO-NOT-SEND",
      openOn: "2099-01-01",
    });

    const built = await context.recentContext({ limit: 10 });

    expect(built.text).not.toContain("SECRET-CONTENTS-DO-NOT-SEND");
    expect(built.text).toContain("Sealed until it is time.");
  });

  it("excludes the entry being reflected on from its own background", async () => {
    await seed(5);

    const built = await context.recentContext({
      limit: 10,
      excludeId: "2026-06-05",
    });

    expect(built.sources.map((s) => s.id)).not.toContain("2026-06-05");
  });

  it("sends nothing when the journal is empty", async () => {
    const built = await context.recentContext({ limit: 10 });

    expect(built.text).toBe("");
    expect(built.sources).toEqual([]);
    expect(built.disclosure).toBe("Nothing to send yet.");
  });
});

describe("relevance", () => {
  it("prefers entries matching the question", async () => {
    await entries.updateEntry("diary", "2026-06-01", {
      date: "2026-06-01",
      title: "Topological sort finally made sense",
      body: "Course Schedule clicked once I drew the dependency graph.",
    });
    await entries.updateEntry("diary", "2026-06-02", {
      date: "2026-06-02",
      title: "A quiet day",
      body: "Nothing much happened.",
    });

    const built = await context.relevantContext("topological sort");
    expect(built.sources[0]?.id).toBe("2026-06-01");
  });

  it("still grounds a question that matches nothing", async () => {
    await seed(5);

    // No keyword overlap at all — but answering from thin air is worse than
    // answering from recent entries, so recency is the floor.
    const built = await context.relevantContext("quantum entanglement");
    expect(built.sources.length).toBeGreaterThan(0);
  });
});

describe("span sampling", () => {
  it("keeps old months represented, not just the recent block", async () => {
    await seed(60);

    const built = await context.spanContext({ limit: 20, budget: 100_000 });
    const months = new Set(built.sources.map((s) => s.date.slice(0, 7)));

    // A plain "most recent 20" would only ever see the last month, and the
    // whole job of Learning Insights is connecting things months apart.
    expect(months.size).toBeGreaterThan(1);
  });
});

describe("current entry", () => {
  it("puts the entry being written first, and says so", async () => {
    await seed(3);
    const background = await context.recentContext({ limit: 3 });

    const built = context.withCurrentEntry(background, {
      date: "2026-08-20",
      title: "Today",
      body: "This is what I wrote today.",
    });

    expect(built.text.indexOf("This is what I wrote today.")).toBeLessThan(
      built.text.indexOf("--- Earlier entries"),
    );
    expect(built.disclosure).toContain("this entry");
  });

  it("caps a very long entry and says it was truncated", async () => {
    const background = await context.recentContext({ limit: 3 });

    const built = context.withCurrentEntry(
      background,
      { date: "2026-08-20", title: "Long", body: "x".repeat(50_000) },
      { budget: 1_000 },
    );

    expect(built.characters).toBeLessThan(2_000);
    expect(built.disclosure).toContain("1,000");
  });
});

describe("index-only", () => {
  it("sends excerpts, never whole bodies", async () => {
    const marker = "UNIQUE-DEEP-IN-THE-BODY";
    await entries.updateEntry("diary", "2026-06-01", {
      date: "2026-06-01",
      title: "A day",
      // The marker sits well past the 160-character excerpt cutoff.
      body: `${"padding ".repeat(60)}${marker}`,
    });

    const built = await context.recentContext({ limit: 5 });
    expect(built.text).not.toContain(marker);
  });

  it("includes problems and other types, not just the diary", async () => {
    await problems.createProblem({
      name: "Course Schedule",
      date: "2026-06-02",
      topics: ["graphs"],
    });
    await entries.updateEntry("diary", "2026-06-01", { date: "2026-06-01" });

    const built = await context.recentContext({ limit: 10 });
    expect(built.sources.map((s) => s.type)).toContain("problem");
  });
});

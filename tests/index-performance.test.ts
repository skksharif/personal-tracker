import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { IndexRecord } from "@/lib/storage/index-store";

/**
 * Phase 2 exit criterion: a timeline of 500 entries pages quickly.
 *
 * Five hundred is roughly a year of daily journalling with a problem or two
 * alongside — the scale this has to stay comfortable at.
 */

let dataDir: string;
let store: typeof import("@/lib/storage/index-store");

const TOTAL = 500;

beforeAll(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "journey-perf-"));
  vi.stubEnv("DATA_DIR", dataDir);
  vi.resetModules();

  store = await import("@/lib/storage/index-store");

  // Seed the index file directly. Going through upsert would rewrite the file
  // 500 times, which measures the writer rather than the reader.
  const entries: IndexRecord[] = Array.from({ length: TOTAL }, (_, i) => {
    const day = new Date(2026, 0, 1 + i);
    const date = `${day.getFullYear()}-${`${day.getMonth() + 1}`.padStart(2, "0")}-${`${day.getDate()}`.padStart(2, "0")}`;

    return {
      id: `entry-${`${i}`.padStart(4, "0")}`,
      type: i % 3 === 0 ? "diary" : i % 3 === 1 ? "problem" : "milestone",
      date,
      title: `Entry ${i}`,
      excerpt: "A representative excerpt of about the length a real one has.",
      tags: i % 2 === 0 ? ["dsa"] : ["reflection"],
      related: [],
      href: `/entry/${i}`,
      updatedAt: new Date(2026, 0, 1 + i).toISOString(),
    };
  });

  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.writeFile(
    path.join(dataDir, "index.json"),
    JSON.stringify({ version: 1, entries }, null, 2),
    "utf8",
  );
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await fsp.rm(dataDir, { recursive: true, force: true });
});

/*
 * Wall-clock budgets, so they are retried: these files run in parallel with
 * fourteen other suites that are hammering the same disk, and a cold first
 * read behind an on-access virus scanner has been measured at 300ms for work
 * that takes 5ms warm. A retry keeps the budget meaningful — a real regression
 * is an order of magnitude out and fails every attempt — without failing the
 * build because the machine was busy.
 */
describe(`timeline at ${TOTAL} entries`, { retry: 2 }, () => {
  it("loads the first page quickly", async () => {
    const started = performance.now();
    const { entries, total, nextCursor } = await store.queryIndex({
      limit: 25,
    });
    const elapsed = performance.now() - started;

    expect(entries).toHaveLength(25);
    expect(total).toBe(TOTAL);
    expect(nextCursor).not.toBeNull();
    expect(elapsed).toBeLessThan(250);
  });

  it("pages through the whole timeline in reasonable time", async () => {
    const started = performance.now();

    let cursor: string | null | undefined;
    let seen = 0;
    let pages = 0;

    do {
      const result = await store.queryIndex({
        limit: 25,
        ...(cursor ? { cursor } : {}),
      });
      seen += result.entries.length;
      cursor = result.nextCursor;
      pages++;
    } while (cursor && pages < 100);

    const elapsed = performance.now() - started;

    expect(seen).toBe(TOTAL);
    expect(pages).toBe(TOTAL / 25);
    expect(elapsed).toBeLessThan(3000);
  });

  it("filters a large index quickly", async () => {
    const started = performance.now();
    const { total } = await store.queryIndex({ types: ["diary"], limit: 25 });
    const elapsed = performance.now() - started;

    expect(total).toBeGreaterThan(150);
    expect(elapsed).toBeLessThan(250);
  });
});

describe("write cost", () => {
  /**
   * Each save fsyncs, which is what makes a crash mid-write survivable. This
   * measures what that costs, because Phase 3's diary autosave fires on a
   * debounce while the user is still typing — if a single write were slow
   * enough to be felt, the durability trade would need revisiting.
   */
  it("completes a single indexed write well inside a typing pause", async () => {
    const record: IndexRecord = {
      id: "timed-entry",
      type: "diary",
      date: "2026-08-16",
      title: "Timing",
      excerpt: "",
      tags: [],
      href: "/diary/2026-08-16",
      related: [],
      updatedAt: new Date().toISOString(),
    };

    // Warm up, then time a handful and take the median.
    await store.upsertIndexEntry(record);

    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const started = performance.now();
      await store.upsertIndexEntry({ ...record, title: `Timing ${i}` });
      samples.push(performance.now() - started);
    }

    samples.sort((a, b) => a - b);
    const median = samples[2] ?? 0;

    // Generous: this runs on whatever disk CI or a laptop provides, and the
    // point is to catch an order-of-magnitude regression, not to benchmark.
    expect(median).toBeLessThan(800);
  });
});

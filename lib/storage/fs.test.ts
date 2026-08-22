import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import {
  ValidationError,
  atomicWrite,
  listFiles,
  readJson,
  readMarkdown,
  remove,
  sweepTempFiles,
  withLock,
  writeJson,
  writeMarkdown,
} from "./fs";

let dir: string;

beforeEach(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), "journey-fs-"));
});

afterEach(async () => {
  await fsp.rm(dir, { recursive: true, force: true });
});

const file = (name: string) => path.join(dir, name);

describe("atomicWrite", () => {
  it("creates missing parent directories", async () => {
    const target = file("a/b/c/entry.md");
    await atomicWrite(target, "hello");
    expect(await fsp.readFile(target, "utf8")).toBe("hello");
  });

  it("replaces existing content", async () => {
    const target = file("entry.md");
    await atomicWrite(target, "first");
    await atomicWrite(target, "second");
    expect(await fsp.readFile(target, "utf8")).toBe("second");
  });

  it("refuses to write inside the project while tests are running", async () => {
    // The guard that exists because a seed script with an unset DATA_DIR once
    // wrote fixtures into the real `data/`.
    await expect(
      atomicWrite(path.join(process.cwd(), "data", "journey.json"), "{}"),
    ).rejects.toThrow(/Refusing to write inside the project/);
  });

  it("leaves no temp files behind", async () => {
    await atomicWrite(file("entry.md"), "content");
    const leftovers = (await fsp.readdir(dir)).filter((n) =>
      n.endsWith(".tmp"),
    );
    expect(leftovers).toEqual([]);
  });
});

describe("readJson / writeJson", () => {
  const schema = z.object({ title: z.string(), day: z.number().int() });

  it("round-trips", async () => {
    const target = file("journey.json");
    await writeJson(target, { title: "My Journey", day: 1 }, schema);
    expect(await readJson(target, schema)).toEqual({
      title: "My Journey",
      day: 1,
    });
  });

  it("returns null for a missing file", async () => {
    expect(await readJson(file("nope.json"))).toBeNull();
  });

  it("refuses to write data that fails its schema", async () => {
    const target = file("journey.json");
    await expect(
      writeJson(target, { title: "x", day: 1.5 }, schema),
    ).rejects.toThrow(ValidationError);
    // Nothing was created — the invalid value never reached the disk.
    expect(await readJson(target)).toBeNull();
  });

  it("does not clobber a good file when a later write is invalid", async () => {
    const target = file("journey.json");
    await writeJson(target, { title: "good", day: 1 }, schema);
    await expect(
      writeJson(target, { title: "bad", day: 0.5 }, schema),
    ).rejects.toThrow(ValidationError);
    expect(await readJson(target, schema)).toEqual({ title: "good", day: 1 });
  });

  it("reports a schema mismatch on read", async () => {
    const target = file("journey.json");
    await atomicWrite(target, JSON.stringify({ title: "x" }));
    await expect(readJson(target, schema)).rejects.toThrow(ValidationError);
  });

  it("reports malformed JSON", async () => {
    const target = file("broken.json");
    await atomicWrite(target, "{ not json");
    await expect(readJson(target)).rejects.toThrow(/not valid JSON/);
  });
});

describe("readMarkdown / writeMarkdown", () => {
  const schema = z.object({
    id: z.string(),
    date: z.string(),
    mood: z.string().optional(),
  });

  it("round-trips front matter and body", async () => {
    const target = file("2026-08-16.md");
    await writeMarkdown(
      target,
      { id: "abc", date: "2026-08-16", mood: "hopeful" },
      "Solved two-sum today.\n\nIt finally clicked.",
      schema,
    );

    const read = await readMarkdown(target, schema);
    expect(read?.frontmatter).toEqual({
      id: "abc",
      date: "2026-08-16",
      mood: "hopeful",
    });
    expect(read?.body).toBe("Solved two-sum today.\n\nIt finally clicked.");
  });

  it("stays readable as plain Markdown", async () => {
    const target = file("2026-08-16.md");
    await writeMarkdown(target, { id: "a", date: "2026-08-16" }, "# Today");
    const raw = await fsp.readFile(target, "utf8");
    expect(raw.startsWith("---\n")).toBe(true);
    expect(raw).toContain("# Today");
  });

  it("returns null for a missing file", async () => {
    expect(await readMarkdown(file("nope.md"))).toBeNull();
  });

  it("preserves body content containing dashes", async () => {
    const body = "---\nnot front matter\n---";
    const target = file("tricky.md");
    await writeMarkdown(target, { id: "a", date: "2026-08-16" }, body);
    expect((await readMarkdown(target))?.body).toBe(body);
  });
});

describe("listFiles", () => {
  it("returns an empty list for a missing directory", async () => {
    expect(await listFiles(file("absent"))).toEqual([]);
  });

  it("sorts, and skips dotfiles and temp files", async () => {
    await atomicWrite(file("b.md"), "b");
    await atomicWrite(file("a.md"), "a");
    await atomicWrite(file("notes.json"), "{}");
    await fsp.writeFile(file(".entry.md.abc.tmp"), "partial");

    expect(await listFiles(dir)).toEqual(["a.md", "b.md", "notes.json"]);
    expect(await listFiles(dir, ".md")).toEqual(["a.md", "b.md"]);
  });
});

describe("remove", () => {
  it("deletes a file and tolerates a second call", async () => {
    const target = file("gone.md");
    await atomicWrite(target, "x");
    await remove(target);
    await expect(remove(target)).resolves.toBeUndefined();
    expect(await readJson(target)).toBeNull();
  });
});

describe("sweepTempFiles", () => {
  it("removes orphaned temp files recursively, keeping real entries", async () => {
    await atomicWrite(file("diary/a.md"), "keep");
    await fsp.writeFile(file("diary/.a.md.123.tmp"), "orphan");
    await fsp.writeFile(file(".root.json.456.tmp"), "orphan");

    expect(await sweepTempFiles(dir)).toBe(2);
    expect(await listFiles(file("diary"))).toEqual(["a.md"]);
  });
});

describe("withLock", () => {
  it("serializes operations sharing a key", async () => {
    const order: string[] = [];

    const slow = async (label: string, ms: number) =>
      withLock("same-key", async () => {
        order.push(`${label}:start`);
        await new Promise((r) => setTimeout(r, ms));
        order.push(`${label}:end`);
      });

    await Promise.all([slow("first", 30), slow("second", 1)]);

    expect(order).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end",
    ]);
  });

  it("keeps running the queue after a failure", async () => {
    const failing = withLock("k", async () => {
      throw new Error("boom");
    });
    await expect(failing).rejects.toThrow("boom");
    await expect(withLock("k", async () => "ok")).resolves.toBe("ok");
  });

  it("is reentrant for the same key", async () => {
    const result = await withLock("k", async () =>
      withLock("k", async () => withLock("k", async () => "deep")),
    );
    expect(result).toBe("deep");
  });

  it("allows a locked read-modify-write to call writeJson on the same file", async () => {
    // writeJson locks internally; without reentrancy this deadlocks.
    const target = file("journey.json");
    await writeJson(target, { count: 1 });

    const updated = await withLock(target, async () => {
      const current = await readJson<{ count: number }>(target);
      return writeJson(target, { count: (current?.count ?? 0) + 1 });
    });

    expect(updated).toEqual({ count: 2 });
  });

  it("still serializes different keys independently", async () => {
    const order: string[] = [];
    await Promise.all([
      withLock("a", async () => {
        await new Promise((r) => setTimeout(r, 20));
        order.push("a");
      }),
      withLock("b", async () => {
        order.push("b");
      }),
    ]);
    // "b" is not blocked behind "a".
    expect(order).toEqual(["b", "a"]);
  });

  it("keeps concurrent writes to one file from interleaving", async () => {
    const target = file("counter.json");
    await writeJson(target, { count: 0 });

    // Read-modify-write, run twenty times concurrently.
    const bump = () =>
      withLock(`bump:${target}`, async () => {
        const current = (await readJson<{ count: number }>(target)) ?? {
          count: 0,
        };
        await writeJson(target, { count: current.count + 1 });
      });

    await Promise.all(Array.from({ length: 20 }, bump));

    expect(await readJson<{ count: number }>(target)).toEqual({ count: 20 });
  });
});

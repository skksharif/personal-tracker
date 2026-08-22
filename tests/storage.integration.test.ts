import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * End-to-end check of the storage layer as the app will actually use it:
 * env -> DATA_ROOT -> safePath -> atomic write -> read back.
 *
 * DATA_DIR is pointed at a temp directory and the modules are imported fresh,
 * so this exercises the real wiring without touching the user's journal.
 */

let dataDir: string;
let storage: typeof import("@/lib/storage/fs");
let paths: typeof import("@/lib/storage/paths");
let journey: typeof import("@/lib/storage/journey");

beforeAll(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "journey-data-"));
  vi.stubEnv("DATA_DIR", dataDir);
  vi.resetModules();

  paths = await import("@/lib/storage/paths");
  storage = await import("@/lib/storage/fs");
  journey = await import("@/lib/storage/journey");
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await fsp.rm(dataDir, { recursive: true, force: true });
});

describe("storage wiring", () => {
  it("resolves DATA_ROOT from DATA_DIR", () => {
    expect(paths.DATA_ROOT).toBe(path.resolve(dataDir));
  });

  it("round-trips a diary entry through the data root", async () => {
    const file = storage.resolve("data", "diary", "2026-08-16.md");
    expect(paths.isInside(paths.DATA_ROOT, file)).toBe(true);

    const frontmatter = {
      id: "entry-1",
      date: "2026-08-16",
      title: "Day one",
      mood: "hopeful",
      tags: ["start"],
    };
    const body =
      "Started the journey today.\n\n" +
      "Set up the project. Nothing solved yet, but it begins.";

    await storage.writeMarkdown(file, frontmatter, body);

    const read = await storage.readMarkdown<typeof frontmatter>(file);
    expect(read?.frontmatter).toEqual(frontmatter);
    expect(read?.body).toBe(body);

    // Readable as a plain Markdown file, without the app.
    const raw = await fsp.readFile(file, "utf8");
    expect(raw).toContain("title: Day one");
    expect(raw).toContain("Started the journey today.");

    // And discoverable by directory listing, which the timeline will rely on.
    expect(await storage.listFiles(path.join(dataDir, "diary"), ".md")).toEqual(
      ["2026-08-16.md"],
    );
  });

  it("refuses to write outside the data root", () => {
    expect(() => storage.resolve("data", "..", ".env.local")).toThrow(
      paths.UnsafePathError,
    );
    expect(() => storage.resolve("data", "../../../etc/passwd")).toThrow(
      paths.UnsafePathError,
    );
  });

  it("creates the journey on first run and updates it", async () => {
    const created = await journey.getOrCreateJourney();
    expect(created.title).toBe("My Amazon SDE Journey");
    expect(created.createdAt).toBe(created.updatedAt);

    const again = await journey.getOrCreateJourney();
    expect(again.createdAt).toBe(created.createdAt);

    const updated = await journey.saveJourney({
      currentFocus: "Arrays and hashing",
    });
    expect(updated.currentFocus).toBe("Arrays and hashing");
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).not.toBe(created.updatedAt);

    expect((await journey.getJourney())?.currentFocus).toBe(
      "Arrays and hashing",
    );
  });

  it("rejects a journey update that fails validation", async () => {
    await expect(
      journey.saveJourney({ startDate: "16-08-2026" }),
    ).rejects.toThrow(storage.ValidationError);

    // The good record on disk is untouched.
    expect((await journey.getJourney())?.startDate).toBe("2026-08-16");
  });
});

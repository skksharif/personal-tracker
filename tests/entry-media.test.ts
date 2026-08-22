import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What happens to an entry's images when the entry goes.
 *
 * The Phase 6 exit criterion: deleting an entry cleans up the media it owned.
 * An upload the user can no longer see, cannot reach, and cannot delete is a
 * leak — but deleting a file another entry still points at is worse, so both
 * halves are tested.
 *
 * `process.chdir` is how the uploads root is redirected: it is fixed at
 * `public/uploads` because that is where Next serves it from, and it resolves
 * against the working directory at module load.
 */

let projectDir: string;
let dataDir: string;
let cwd: string;

let entries: typeof import("@/lib/storage/entries");
let notes: typeof import("@/lib/storage/notes");
let media: typeof import("@/lib/storage/media");

async function makeImage(): Promise<Uint8Array> {
  const buffer = await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .png()
    .toBuffer();

  return new Uint8Array(buffer);
}

/** Absolute path of a stored image, from its public path. */
function onDisk(publicPath: string): string {
  return path.join(projectDir, "public", publicPath.replace(/^\//, ""));
}

async function exists(target: string): Promise<boolean> {
  try {
    await fsp.access(target);
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  projectDir = await fsp.mkdtemp(path.join(os.tmpdir(), "journey-em-proj-"));
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "journey-em-data-"));

  await fsp.mkdir(path.join(projectDir, "public", "uploads"), {
    recursive: true,
  });

  cwd = process.cwd();
  process.chdir(projectDir);

  // The data root is kept outside the fake project so it is unambiguously
  // stubbed — see the write guard in `lib/storage/fs.ts`.
  vi.stubEnv("DATA_DIR", dataDir);
  vi.resetModules();

  entries = await import("@/lib/storage/entries");
  notes = await import("@/lib/storage/notes");
  media = await import("@/lib/storage/media");
});

afterEach(async () => {
  process.chdir(cwd);
  vi.unstubAllEnvs();
  await fsp.rm(projectDir, { recursive: true, force: true });
  await fsp.rm(dataDir, { recursive: true, force: true });
});

async function entryWithImage(id: string) {
  const record = await media.saveImage(await makeImage(), "photo.png");

  await entries.updateEntry("diary", id, {
    date: id,
    title: "A day",
    body: `Before the picture.\n\n![](${record.path})\n\nAfter it.`,
    media: [record],
  });

  return record;
}

describe("deleting an entry", () => {
  it("removes the images only that entry was using", async () => {
    const image = await entryWithImage("2026-08-01");
    expect(await exists(onDisk(image.path))).toBe(true);

    await entries.deleteEntry("diary", "2026-08-01");

    expect(await exists(onDisk(image.path))).toBe(false);
  });

  it("keeps an image another entry still records", async () => {
    const image = await entryWithImage("2026-08-01");

    // The same file referenced from a second day — a path copied across.
    await entries.updateEntry("diary", "2026-08-02", {
      date: "2026-08-02",
      title: "The next day",
      body: "Still thinking about it.",
      media: [image],
    });

    await entries.deleteEntry("diary", "2026-08-01");

    expect(await exists(onDisk(image.path))).toBe(true);
  });

  it("keeps an image referenced only from another entry's text", async () => {
    const image = await entryWithImage("2026-08-01");

    // No media record — just the markdown, as a hand-edit would leave it.
    await entries.updateEntry("reflection", "week-one", {
      date: "2026-08-03",
      title: "Week one",
      body: `Looking back.\n\n![](${image.path})`,
    });

    await entries.deleteEntry("diary", "2026-08-01");

    expect(await exists(onDisk(image.path))).toBe(true);
  });

  it("keeps an image a note points at", async () => {
    const image = await entryWithImage("2026-08-01");

    await notes.createNote("design", {
      title: "The whiteboard",
      date: "2026-08-01",
      body: `What we drew:\n\n![](${image.path})`,
    });

    await entries.deleteEntry("diary", "2026-08-01");

    expect(await exists(onDisk(image.path))).toBe(true);
  });

  it("still deletes the entry when an image cannot be removed", async () => {
    const image = await entryWithImage("2026-08-01");

    // Remove the file behind the app's back, so the cleanup hits a miss.
    await fsp.rm(onDisk(image.path));

    await entries.deleteEntry("diary", "2026-08-01");

    expect(await entries.getEntry("diary", "2026-08-01")).toBeNull();
  });

  it("leaves other entries' files alone", async () => {
    const first = await entryWithImage("2026-08-01");
    const second = await entryWithImage("2026-08-02");

    await entries.deleteEntry("diary", "2026-08-01");

    expect(await exists(onDisk(first.path))).toBe(false);
    expect(await exists(onDisk(second.path))).toBe(true);
    expect(await entries.getEntry("diary", "2026-08-02")).not.toBeNull();
  });
});

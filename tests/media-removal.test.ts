import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Removing one image from an entry.
 *
 * This function edits the author's own writing — it takes a line out of the
 * body — so it gets tested harder than most. The thing that must never happen
 * is collateral damage: a stray space removed, a blank line closed somewhere
 * else, another image caught by the same path prefix.
 */

let projectDir: string;
let dataDir: string;
let cwd: string;

let entries: typeof import("@/lib/storage/entries");
let media: typeof import("@/lib/storage/media");

async function makeImage(): Promise<Uint8Array> {
  const buffer = await sharp({
    create: {
      width: 24,
      height: 24,
      channels: 3,
      background: { r: 1, g: 2, b: 3 },
    },
  })
    .png()
    .toBuffer();

  return new Uint8Array(buffer);
}

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
  projectDir = await fsp.mkdtemp(path.join(os.tmpdir(), "journey-mr-proj-"));
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "journey-mr-data-"));

  await fsp.mkdir(path.join(projectDir, "public", "uploads"), {
    recursive: true,
  });

  cwd = process.cwd();
  process.chdir(projectDir);

  vi.stubEnv("DATA_DIR", dataDir);
  vi.resetModules();

  entries = await import("@/lib/storage/entries");
  media = await import("@/lib/storage/media");
});

afterEach(async () => {
  process.chdir(cwd);
  vi.unstubAllEnvs();
  await fsp.rm(projectDir, { recursive: true, force: true });
  await fsp.rm(dataDir, { recursive: true, force: true });
});

describe("stripImageMarkdown", () => {
  const strip = (body: string, at = "/uploads/images/a.webp") =>
    entries.stripImageMarkdown(body, at);

  it("closes the paragraphs around the image", () => {
    expect(
      strip("Before it.\n\n![a desk](/uploads/images/a.webp)\n\nAfter it."),
    ).toBe("Before it.\n\nAfter it.");
  });

  it("leaves nothing behind when the image opens the entry", () => {
    expect(strip("![](/uploads/images/a.webp)\n\nThe day itself.")).toBe(
      "The day itself.",
    );
  });

  it("leaves nothing behind when the image ends the entry", () => {
    expect(strip("The day itself.\n\n![](/uploads/images/a.webp)")).toBe(
      "The day itself.",
    );
  });

  it("does not touch spaces anywhere in the entry", () => {
    const body = "A  b   c.\n\n![](/uploads/images/a.webp)\n\nd  e   f.";
    expect(strip(body)).toBe("A  b   c.\n\nd  e   f.");
  });

  it("does not close blank lines it did not create", () => {
    // Four blank lines the author put there on purpose, nowhere near the image.
    const body =
      "One.\n\n\n\n\nTwo.\n\n![](/uploads/images/a.webp)\n\nThree.\n\n\n\nFour.";

    expect(strip(body)).toBe("One.\n\n\n\n\nTwo.\n\nThree.\n\n\n\nFour.");
  });

  it("removes every occurrence of the same image", () => {
    const body =
      "a\n\n![](/uploads/images/a.webp)\n\nb\n\n![again](/uploads/images/a.webp)\n\nc";

    expect(strip(body)).toBe("a\n\nb\n\nc");
  });

  it("leaves a different image alone", () => {
    const body =
      "a\n\n![](/uploads/images/a.webp)\n\n![](/uploads/images/b.webp)\n\nc";

    expect(strip(body)).toBe("a\n\n![](/uploads/images/b.webp)\n\nc");
  });

  it("does not match an image whose path merely starts the same", () => {
    // `a.webp` must not take `a.webp.webp` with it.
    const body = "![](/uploads/images/a.webp.webp)";
    expect(strip(body)).toBe(body);
  });

  it("handles a markdown title after the url", () => {
    expect(strip('![alt](/uploads/images/a.webp "A title")')).toBe("");
  });

  it("returns the body unchanged when the image is not in it", () => {
    const body = "Nothing pictorial here at all.";
    expect(strip(body)).toBe(body);
  });

  it("never leaves the sentinel in the result", () => {
    const body = "a\n\n![](/uploads/images/a.webp)\n\nb";
    expect(strip(body)).not.toContain("\u0000");
  });
});

describe("removeMedia", () => {
  async function entryWithTwoImages() {
    const first = await media.saveImage(await makeImage(), "one.png");
    const second = await media.saveImage(await makeImage(), "two.png");

    await entries.updateEntry("diary", "2026-08-01", {
      date: "2026-08-01",
      title: "A day",
      body: `Before.\n\n![one](${first.path})\n\nBetween.\n\n![two](${second.path})\n\nAfter.`,
      media: [first, second],
    });

    return { first, second };
  }

  it("removes the record, the markdown and the file together", async () => {
    const { first, second } = await entryWithTwoImages();

    const updated = await entries.removeMedia(
      "diary",
      "2026-08-01",
      first.path,
    );

    expect(updated?.media.map((item) => item.path)).toEqual([second.path]);
    expect(updated?.body).toBe(
      "Before.\n\nBetween.\n\n![two]" + `(${second.path})` + "\n\nAfter.",
    );
    expect(await exists(onDisk(first.path))).toBe(false);
    expect(await exists(onDisk(second.path))).toBe(true);
  });

  it("keeps the file when another entry still references it", async () => {
    const { first } = await entryWithTwoImages();

    await entries.updateEntry("reflection", "week-one", {
      date: "2026-08-02",
      title: "Week one",
      body: `Still thinking.\n\n![](${first.path})`,
    });

    await entries.removeMedia("diary", "2026-08-01", first.path);

    expect(await exists(onDisk(first.path))).toBe(true);
  });

  it("returns null for an image the entry does not have", async () => {
    await entryWithTwoImages();

    expect(
      await entries.removeMedia(
        "diary",
        "2026-08-01",
        "/uploads/images/never.webp",
      ),
    ).toBeNull();
  });

  it("returns null for an entry that is not there", async () => {
    expect(
      await entries.removeMedia(
        "diary",
        "1999-01-01",
        "/uploads/images/a.webp",
      ),
    ).toBeNull();
  });

  it("leaves the rest of the entry exactly as written", async () => {
    const { first } = await entryWithTwoImages();
    const before = await entries.getEntry("diary", "2026-08-01");

    const after = await entries.removeMedia("diary", "2026-08-01", first.path);

    expect(after?.title).toBe(before?.title);
    expect(after?.date).toBe(before?.date);
    expect(after?.tags).toEqual(before?.tags);
  });
});

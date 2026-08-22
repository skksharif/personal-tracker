import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Uploads are the one place where a filename, a declared MIME type and a byte
 * stream all arrive from outside the application. None of the three is
 * trusted, and these tests are what hold that line.
 */

let projectDir: string;
let cwd: string;
let media: typeof import("@/lib/storage/media");

async function makeImage(
  format: "png" | "jpeg" | "webp",
  size = 64,
): Promise<Uint8Array> {
  const image = sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 120, g: 90, b: 60 },
    },
  });

  const buffer =
    format === "png"
      ? await image.png().toBuffer()
      : format === "jpeg"
        ? await image.jpeg().toBuffer()
        : await image.webp().toBuffer();

  return new Uint8Array(buffer);
}

beforeEach(async () => {
  projectDir = await fsp.mkdtemp(path.join(os.tmpdir(), "journey-media-"));
  await fsp.mkdir(path.join(projectDir, "public", "uploads"), {
    recursive: true,
  });

  // UPLOADS_ROOT is derived from cwd at module load.
  cwd = process.cwd();
  process.chdir(projectDir);
  vi.resetModules();

  media = await import("@/lib/storage/media");
});

afterEach(async () => {
  process.chdir(cwd);
  await fsp.rm(projectDir, { recursive: true, force: true });
});

describe("detectImageFormat", () => {
  it("identifies real images by their leading bytes", async () => {
    expect(media.detectImageFormat(await makeImage("png"))).toBe("png");
    expect(media.detectImageFormat(await makeImage("jpeg"))).toBe("jpeg");
    expect(media.detectImageFormat(await makeImage("webp"))).toBe("webp");
  });

  it("rejects content that is not an image", () => {
    const html = new TextEncoder().encode(
      "<html><script>alert(1)</script></html>",
    );
    expect(media.detectImageFormat(html)).toBeNull();

    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    // SVG is script-bearing markup and is deliberately not accepted.
    expect(media.detectImageFormat(svg)).toBeNull();
  });

  it("rejects a payload too short to identify", () => {
    expect(media.detectImageFormat(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("saveImage", () => {
  it("stores an upload as WebP under public/uploads/images", async () => {
    const record = await media.saveImage(
      await makeImage("png"),
      "My Photo.PNG",
    );

    expect(record.path).toMatch(
      /^\/uploads\/images\/my-photo-[a-f0-9]{8}\.webp$/,
    );
    expect(record.type).toBe("image");
    expect(record.width).toBe(64);
    expect(record.height).toBe(64);

    const onDisk = path.join(projectDir, "public", record.path);
    expect((await sharp(await fsp.readFile(onDisk)).metadata()).format).toBe(
      "webp",
    );
  });

  it("refuses a file whose bytes are not an image, whatever it is called", async () => {
    const disguised = new TextEncoder().encode("<html>not an image</html>");

    await expect(media.saveImage(disguised, "innocent.png")).rejects.toThrow(
      media.UploadError,
    );

    // And nothing was written.
    expect(
      await fsp.readdir(path.join(projectDir, "public", "uploads")),
    ).toEqual([]);
  });

  it("refuses an empty file", async () => {
    await expect(
      media.saveImage(new Uint8Array(), "empty.png"),
    ).rejects.toThrow(media.UploadError);
  });

  it("refuses a file over the size cap", async () => {
    const oversized = new Uint8Array(media.MAX_UPLOAD_BYTES + 1);
    // Give it a valid PNG signature so it is the size check that rejects it.
    oversized.set([0x89, 0x50, 0x4e, 0x47], 0);

    await expect(media.saveImage(oversized, "huge.png")).rejects.toThrow(
      /under 8MB/,
    );
  });

  it("neutralises a traversing filename", async () => {
    const record = await media.saveImage(
      await makeImage("png"),
      "../../../../etc/passwd.png",
    );

    expect(record.path).toMatch(
      /^\/uploads\/images\/passwd-[a-f0-9]{8}\.webp$/,
    );

    const written = await fsp.readdir(
      path.join(projectDir, "public", "uploads", "images"),
    );
    expect(written).toHaveLength(1);
    expect(written[0]).not.toContain("..");
  });

  it("keeps two files with the same name apart", async () => {
    const a = await media.saveImage(await makeImage("png"), "IMG_0001.jpg");
    const b = await media.saveImage(await makeImage("png"), "IMG_0001.jpg");

    expect(a.path).not.toBe(b.path);
    expect(
      await fsp.readdir(path.join(projectDir, "public", "uploads", "images")),
    ).toHaveLength(2);
  });

  it("scales a large image down", async () => {
    const record = await media.saveImage(
      await makeImage("png", 3000),
      "big.png",
    );

    expect(record.width).toBe(2000);
    expect(record.height).toBe(2000);
  });

  it("records AI-generated origin when told to", async () => {
    const record = await media.saveImage(
      await makeImage("png"),
      "recursion.png",
      "generated",
      { generated: true, prompt: "a recursion tree" },
    );

    expect(record.generated).toBe(true);
    expect(record.prompt).toBe("a recursion tree");
    expect(record.path).toContain("/uploads/generated/");
  });
});

describe("deleteImage", () => {
  it("removes a stored image", async () => {
    const record = await media.saveImage(await makeImage("png"), "gone.png");
    await media.deleteImage(record.path);

    expect(
      await fsp.readdir(path.join(projectDir, "public", "uploads", "images")),
    ).toEqual([]);
  });

  it("refuses a path outside uploads", async () => {
    for (const attempt of [
      "/etc/passwd",
      "/uploads/../../../.env.local",
      "/uploads/../../package.json",
      "../.env.local",
    ]) {
      await expect(media.deleteImage(attempt)).rejects.toThrow();
    }
  });
});

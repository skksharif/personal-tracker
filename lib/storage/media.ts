import "server-only";

import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import sharp from "sharp";

import { StorageError } from "@/lib/storage/errors";
import { ensureDir, remove } from "@/lib/storage/fs";
import {
  UPLOADS_ROOT,
  isInside,
  safePath,
  sanitizeFilename,
  toPublicUrl,
} from "@/lib/storage/paths";
import type { Media } from "@/lib/storage/entries";

/**
 * Image handling for the journal.
 *
 * Uploads are the one place where a filename, a MIME type and a byte stream
 * all arrive from outside. None of the three is trusted: the extension is
 * discarded, the declared type is ignored, and the format is determined from
 * the file's own leading bytes.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Formats accepted, identified by signature.
 *
 * A file called `photo.png` that is actually an HTML document with a script
 * tag would be served from our own origin — checking the magic bytes is what
 * stops that, and an extension check never could.
 */
const SIGNATURES: { format: string; test: (bytes: Uint8Array) => boolean }[] = [
  {
    format: "jpeg",
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    format: "png",
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    format: "gif",
    test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
  },
  {
    format: "webp",
    test: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
  {
    // AVIF and HEIC both sit inside an ISO-BMFF container: `ftyp` at offset 4.
    format: "avif",
    test: (b) =>
      b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70,
  },
];

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

/** Identify an image by its leading bytes, ignoring what the client claimed. */
export function detectImageFormat(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  return SIGNATURES.find((entry) => entry.test(bytes))?.format ?? null;
}

export type UploadFolder = "images" | "generated";

/**
 * Store an uploaded image.
 *
 * Everything is re-encoded to WebP through sharp. That normalises the output,
 * strips EXIF — which can carry GPS coordinates from a phone photo, and this
 * is a private journal — and means a malformed file fails during decode rather
 * than sitting on disk waiting to be served.
 */
export async function saveImage(
  bytes: Uint8Array,
  originalName: string,
  folder: UploadFolder = "images",
  options: { alt?: string; prompt?: string; generated?: boolean } = {},
): Promise<Media> {
  if (bytes.length === 0) {
    throw new UploadError("That file is empty.");
  }

  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      `Images must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB.`,
    );
  }

  const format = detectImageFormat(bytes);
  if (!format) {
    throw new UploadError(
      "That doesn't look like an image. JPEG, PNG, GIF, WebP and AVIF are supported.",
    );
  }

  const stem = sanitizeFilename(originalName, "image").replace(/\.[^.]*$/, "");
  // A short random suffix keeps two photos named `IMG_0001.jpg` apart without
  // making the filename unreadable.
  const filename = `${stem}-${randomUUID().slice(0, 8)}.webp`;
  const target = safePath("uploads", folder, filename);

  await ensureDir(path.dirname(target));

  let width: number | undefined;
  let height: number | undefined;

  try {
    const pipeline = sharp(bytes as Buffer, { animated: format === "gif" });
    const metadata = await pipeline.metadata();

    // Cap the stored size. A 6000px phone photo helps nobody in a journal and
    // makes the timeline slow to load.
    const resized = pipeline.rotate().resize({
      width: 2000,
      height: 2000,
      fit: "inside",
      withoutEnlargement: true,
    });

    const output = await resized.webp({ quality: 82 }).toBuffer({
      resolveWithObject: true,
    });

    await fsp.writeFile(target, output.data);
    width = output.info.width;
    height = output.info.height;

    void metadata;
  } catch (error) {
    await fsp.rm(target, { force: true }).catch(() => {});
    if (error instanceof UploadError) throw error;
    throw new StorageError("Couldn't process that image.", error);
  }

  return {
    path: toPublicUrl(target),
    type: "image",
    alt: options.alt ?? "",
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(options.generated ? { generated: true } : {}),
    ...(options.prompt ? { prompt: options.prompt } : {}),
  };
}

/**
 * Delete a stored image by its public path.
 *
 * Resolves the path against the uploads root and refuses anything outside it,
 * so a crafted media record cannot turn a delete into an arbitrary unlink.
 */
export async function deleteImage(publicPath: string): Promise<void> {
  if (!publicPath.startsWith("/uploads/")) {
    throw new UploadError("Not an uploaded file.");
  }

  const relative = publicPath.slice("/uploads/".length);
  const target = safePath("uploads", ...relative.split("/"));

  if (!isInside(UPLOADS_ROOT, target)) {
    throw new UploadError("Not an uploaded file.");
  }

  await remove(target);
}

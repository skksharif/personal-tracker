import path from "node:path";

import { env } from "@/lib/env";

/**
 * Path resolution and containment. Pure functions — no I/O happens here.
 *
 * Ground rule 3 of the build plan: every write is scoped to `data/` or
 * `public/uploads/`. This module is the only place that decides whether a
 * caller-supplied path is allowed, so there is exactly one thing to audit.
 */

export const PROJECT_ROOT = process.cwd();

// The data root is configurable via DATA_DIR, so the bundler cannot statically
// determine it and would otherwise trace the entire project into the server
// output. This app runs locally against its own filesystem and is never
// deployed to a serverless target, so that tracing has nothing to protect.
export const DATA_ROOT = path.resolve(
  /* turbopackIgnore: true */ PROJECT_ROOT,
  env.DATA_DIR,
);

export const UPLOADS_ROOT = path.resolve(PROJECT_ROOT, "public", "uploads");

export const STORAGE_ROOTS = {
  data: DATA_ROOT,
  uploads: UPLOADS_ROOT,
} as const;

export type StorageRoot = keyof typeof STORAGE_ROOTS;

export class UnsafePathError extends Error {
  constructor(reason: string) {
    super(`Unsafe path rejected: ${reason}`);
    this.name = "UnsafePathError";
  }
}

/** Windows reserved device names — unusable as filenames even with an extension. */
const RESERVED_NAMES = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$/i;

/**
 * Resolve `segments` beneath a storage root, rejecting anything that would
 * escape it.
 *
 * @throws {UnsafePathError} on traversal, absolute segments, NUL bytes,
 *   empty segments, or a result outside the root.
 */
export function safePath(
  root: StorageRoot | string,
  ...segments: string[]
): string {
  const rootPath = path.resolve(
    root in STORAGE_ROOTS ? STORAGE_ROOTS[root as StorageRoot] : root,
  );

  if (segments.length === 0) {
    throw new UnsafePathError("no path segments given");
  }

  for (const segment of segments) {
    if (typeof segment !== "string") {
      throw new UnsafePathError("segment is not a string");
    }
    if (segment.includes("\0")) {
      throw new UnsafePathError("segment contains a NUL byte");
    }
    if (segment.trim() === "") {
      throw new UnsafePathError("segment is empty");
    }
    if (path.isAbsolute(segment) || /^[a-z]:/i.test(segment)) {
      throw new UnsafePathError(`segment is absolute: ${segment}`);
    }
    // Catch traversal before resolution so the intent is reported, not just
    // the outcome. Covers both separators regardless of host platform.
    if (segment.split(/[\\/]/).includes("..")) {
      throw new UnsafePathError(`segment traverses upward: ${segment}`);
    }
  }

  const resolved = path.resolve(rootPath, ...segments);

  if (!isInside(rootPath, resolved)) {
    throw new UnsafePathError(`${resolved} is outside ${rootPath}`);
  }

  return resolved;
}

/** True when `target` is the root itself or lives beneath it. */
export function isInside(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (relative === "") return true;
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

/**
 * Reduce arbitrary text to a filename that is safe on every platform.
 * Used for uploaded media, where the name comes from the browser.
 */
export function sanitizeFilename(name: string, fallback = "file"): string {
  const parsed = path.parse(name.replace(/\0/g, ""));

  const extension = parsed.ext
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "")
    .slice(0, 10);

  let base = parsed.name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80)
    .toLowerCase();

  if (base === "" || RESERVED_NAMES.test(base)) {
    base = fallback;
  }

  return `${base}${extension}`;
}

/** Path relative to the project root, using forward slashes. For display and records. */
export function toRelativePath(absolute: string): string {
  return path.relative(PROJECT_ROOT, absolute).split(path.sep).join("/");
}

/**
 * Public URL for a file under `public/uploads/`, as stored in media records
 * (e.g. `/uploads/generated/recursion-001.webp`).
 */
export function toPublicUrl(absolute: string): string {
  if (!isInside(UPLOADS_ROOT, absolute)) {
    throw new UnsafePathError(`${absolute} is not an upload`);
  }
  const relative = path.relative(UPLOADS_ROOT, absolute);
  return `/uploads/${relative.split(path.sep).join("/")}`;
}

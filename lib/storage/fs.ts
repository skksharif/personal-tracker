import "server-only";

import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

import type { z } from "zod";

import { StorageError, ValidationError } from "@/lib/storage/errors";
import {
  parseFrontmatter,
  stringifyFrontmatter,
} from "@/lib/storage/frontmatter";
import { PROJECT_ROOT, safePath, type StorageRoot } from "@/lib/storage/paths";

/**
 * The only module in the application that touches the filesystem.
 *
 * Everything here is built around one promise: a save either lands completely
 * or does not happen at all. Nothing ever observes a half-written entry — the
 * user's diary is the thing being protected.
 */

// Re-exported for convenience; defined in `errors.ts` so Client Components can
// recognise them without pulling this server-only module into the browser.
export { StorageError, ValidationError };

/* -------------------------------------------------------------------------- */
/* Write serialization                                                        */
/* -------------------------------------------------------------------------- */

const locks = new Map<string, Promise<unknown>>();

/** Keys held by the current async call chain, for reentrancy. */
const heldKeys = new AsyncLocalStorage<ReadonlySet<string>>();

/**
 * Serialize operations that share a key, so two concurrent server actions
 * touching the same entry cannot interleave read-modify-write cycles.
 *
 * The lock is **reentrant**: acquiring a key already held by the current call
 * chain runs inline instead of waiting. Read-modify-write is the normal shape
 * of a save — `withLock(file, () => { read; modify; writeJson(file) })` — and
 * `writeJson` locks internally, so without reentrancy that would deadlock
 * against itself.
 *
 * In-process only. That is sufficient here: this is a single-user local app
 * served by one Next.js process.
 */
export async function withLock<T>(
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  const held = heldKeys.getStore();
  if (held?.has(key)) return operation();

  const nested = new Set(held ?? []);
  nested.add(key);
  const run = () => heldKeys.run(nested, operation);

  const previous = locks.get(key) ?? Promise.resolve();

  // Run after the previous holder settles, whether it resolved or rejected.
  const result = previous.then(run, run);

  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  locks.set(key, tail);

  try {
    return await result;
  } finally {
    // Only the last waiter clears the entry, so the map cannot grow unbounded.
    if (locks.get(key) === tail) locks.delete(key);
  }
}

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

export async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

export async function exists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

const RETRYABLE = new Set(["EPERM", "EACCES", "EBUSY", "ENOTEMPTY"]);

/**
 * Windows briefly locks files behind antivirus and search indexing, which
 * surfaces as a transient EPERM on rename. Retry rather than lose a save.
 */
async function renameWithRetry(from: string, to: string): Promise<void> {
  const delays = [10, 25, 50, 100, 200];

  for (let attempt = 0; ; attempt++) {
    try {
      await fsp.rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? "";
      const delay = delays[attempt];
      if (!RETRYABLE.has(code) || delay === undefined) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Under Vitest, refuse to write anywhere inside the project.
 *
 * Not hypothetical: a seeding script whose `DATA_DIR` was unset fell back to
 * the default and wrote eight fixture entries straight into the real `data/`.
 * Every test points `DATA_DIR` at a temp directory, so a write landing inside
 * the project during a test run can only mean the stubbing was missed — and
 * the thing at risk is the one copy of someone's journal.
 *
 * Checked at the write, not at import: reading the project is harmless, and
 * `lib/storage/paths.test.ts` legitimately exercises the real roots.
 */
function assertNotTheRealJournal(filePath: string): void {
  if (!process.env.VITEST) return;

  const relative = path.relative(PROJECT_ROOT, path.resolve(filePath));
  if (relative.startsWith("..") || path.isAbsolute(relative)) return;

  throw new StorageError(
    `Refusing to write inside the project during a test run (${relative}). ` +
      `Stub DATA_DIR with a temp directory before importing the storage layer.`,
  );
}

/**
 * Write `contents` to `filePath` atomically: full write to a sibling temp file,
 * flushed to disk, then renamed over the target. A crash mid-write leaves the
 * previous version intact and orphans a temp file, never a truncated entry.
 */
export async function atomicWrite(
  filePath: string,
  contents: string,
): Promise<void> {
  assertNotTheRealJournal(filePath);

  const dir = path.dirname(filePath);
  await ensureDir(dir);

  const tempPath = path.join(
    dir,
    `.${path.basename(filePath)}.${randomUUID()}.tmp`,
  );

  try {
    const handle = await fsp.open(tempPath, "wx");
    try {
      await handle.writeFile(contents, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }

    await renameWithRetry(tempPath, filePath);
  } catch (error) {
    await fsp.rm(tempPath, { force: true }).catch(() => {});
    throw new StorageError(`Couldn't write ${filePath}`, error);
  }
}

/* -------------------------------------------------------------------------- */
/* JSON                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Read and parse a JSON file. Returns `null` if it does not exist — a missing
 * entry is an ordinary state, not an error.
 *
 * Passing a schema validates the contents; data on disk is not trusted just
 * because we wrote it, since it is also hand-editable by design.
 */
export async function readJson<T>(
  filePath: string,
  schema?: z.ZodType<T>,
): Promise<T | null> {
  let raw: string;
  try {
    raw = await fsp.readFile(filePath, "utf8");
  } catch (error) {
    if (isMissing(error)) return null;
    throw new StorageError(`Couldn't read ${filePath}`, error);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new StorageError(`${filePath} is not valid JSON`, error);
  }

  if (!schema) return parsed as T;

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ValidationError(
      `${filePath} does not match its schema`,
      z_prettify(result.error),
    );
  }
  return result.data;
}

/** Validate, then write atomically. Validation failures never reach the disk. */
export async function writeJson<T>(
  filePath: string,
  data: T,
  schema?: z.ZodType<T>,
): Promise<T> {
  const value = schema ? parseOrThrow(schema, data, filePath) : data;
  await withLock(filePath, () =>
    atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`),
  );
  return value;
}

/* -------------------------------------------------------------------------- */
/* Markdown + front matter                                                    */
/* -------------------------------------------------------------------------- */

export interface MarkdownFile<T> {
  frontmatter: T;
  body: string;
}

/**
 * Read a Markdown file with YAML front matter. Diary entries, reflections, and
 * notes live in this format so they stay readable without the app.
 */
export async function readMarkdown<T>(
  filePath: string,
  schema?: z.ZodType<T>,
): Promise<MarkdownFile<T> | null> {
  let raw: string;
  try {
    raw = await fsp.readFile(filePath, "utf8");
  } catch (error) {
    if (isMissing(error)) return null;
    throw new StorageError(`Couldn't read ${filePath}`, error);
  }

  let parsed: ReturnType<typeof parseFrontmatter>;
  try {
    parsed = parseFrontmatter(raw);
  } catch (error) {
    throw new StorageError(`${filePath} has malformed front matter`, error);
  }

  if (!schema) {
    return { frontmatter: parsed.data as T, body: parsed.body };
  }

  const result = schema.safeParse(parsed.data);
  if (!result.success) {
    throw new ValidationError(
      `${filePath} front matter does not match its schema`,
      z_prettify(result.error),
    );
  }

  return { frontmatter: result.data, body: parsed.body };
}

export async function writeMarkdown<T extends object>(
  filePath: string,
  frontmatter: T,
  body: string,
  schema?: z.ZodType<T>,
): Promise<MarkdownFile<T>> {
  const value = schema
    ? parseOrThrow(schema, frontmatter, filePath)
    : frontmatter;

  const serialized = stringifyFrontmatter(
    value as Record<string, unknown>,
    body,
  );

  await withLock(filePath, () => atomicWrite(filePath, serialized));
  return { frontmatter: value, body: body.trim() };
}

/* -------------------------------------------------------------------------- */
/* Directories                                                                */
/* -------------------------------------------------------------------------- */

/**
 * List filenames directly inside `dir`, sorted. Temp files and dotfiles are
 * skipped so an interrupted write is never mistaken for an entry.
 */
export async function listFiles(
  dir: string,
  extension?: string,
): Promise<string[]> {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return [];
    throw new StorageError(`Couldn't list ${dir}`, error);
  }

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith("."))
    .filter((name) => (extension ? name.endsWith(extension) : true))
    .sort();
}

export async function remove(filePath: string): Promise<void> {
  try {
    await fsp.rm(filePath, { force: true });
  } catch (error) {
    throw new StorageError(`Couldn't delete ${filePath}`, error);
  }
}

/** Clear temp files left behind by an interrupted write. Safe to call on boot. */
export async function sweepTempFiles(dir: string): Promise<number> {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return 0;
    throw new StorageError(`Couldn't sweep ${dir}`, error);
  }

  let removed = 0;
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removed += await sweepTempFiles(full);
    } else if (entry.name.startsWith(".") && entry.name.endsWith(".tmp")) {
      await fsp.rm(full, { force: true });
      removed++;
    }
  }
  return removed;
}

/* -------------------------------------------------------------------------- */
/* Convenience                                                                */
/* -------------------------------------------------------------------------- */

/** `safePath` re-exported so storage modules have a single import. */
export function resolve(
  root: StorageRoot | string,
  ...segments: string[]
): string {
  return safePath(root, ...segments);
}

function parseOrThrow<T>(
  schema: z.ZodType<T>,
  data: unknown,
  filePath: string,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      `Refusing to write ${filePath}: invalid data`,
      z_prettify(result.error),
    );
  }
  return result.data;
}

function z_prettify(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

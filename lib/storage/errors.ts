/**
 * Storage error types.
 *
 * Kept apart from `fs.ts` deliberately: these are needed on both sides of the
 * server boundary — a Client Component rendering a form has to recognise a
 * validation failure — while `fs.ts` is `server-only` and must never reach the
 * browser. Splitting the types out is what lets both be true.
 */

export class StorageError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly issues: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

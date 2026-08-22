/**
 * Partial updates that only touch what the caller actually sent.
 *
 * Zod's `.partial()` does not remove a field's default — parsing `{status}`
 * against a schema whose `topics` defaults to `[]` returns `topics: []` as
 * well. Spreading that over the stored record then *erases* the real topics.
 *
 * That is not theoretical: recording an attempt on a problem sent only
 * `{attempts, status}`, and silently wiped the problem's topics and tags with
 * every save. Nothing errored, and the DSA counts quietly emptied.
 *
 * So a patch is validated by the schema as usual, and then narrowed back down
 * to the keys the caller genuinely supplied.
 */
export function providedKeysOnly<T extends object>(
  input: object,
  parsed: T,
): Partial<T> {
  const patch: Partial<T> = {};

  for (const key of Object.keys(input)) {
    // An explicit `undefined` means "not supplied", the same as absent.
    if ((input as Record<string, unknown>)[key] === undefined) continue;
    if (!(key in parsed)) continue;
    patch[key as keyof T] = parsed[key as keyof T];
  }

  return patch;
}

import "server-only";

/**
 * Imports every entity module so their index collectors are registered.
 *
 * Collectors register as an import side effect, which means `rebuildIndex()`
 * only sees the modules that happen to have been loaded already. Anything that
 * rebuilds must import this first, or it will quietly write a partial index —
 * the worst possible failure for a cache that is meant to be authoritative
 * about what exists.
 *
 * Later phases add their modules here.
 */
import "@/lib/storage/milestones";
import "@/lib/storage/entries";
import "@/lib/storage/problems";
import "@/lib/storage/notes";
import "@/lib/storage/sessions";
import "@/lib/storage/interviews";

export {};

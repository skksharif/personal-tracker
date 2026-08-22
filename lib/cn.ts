import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Class name merging, taught about this project's design tokens.
 *
 * tailwind-merge resolves conflicts by class *group*, and it only knows the
 * stock scales. Our type scale is custom (`text-body`, `text-page`, …), so out
 * of the box it files those under `text-color` alongside `text-ink` — then
 * drops one of them as a duplicate. That silently removed the text colour from
 * every primary button and the size from every tag, with no error anywhere.
 *
 * Registering the font-size names separates the two groups again. Colour names
 * need no entry: an unrecognised `text-*` already falls through to `text-color`,
 * which is the correct answer for them.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["meta", "small", "body", "title", "page"] }],
    },
  },
});

/**
 * Merge class names, with later Tailwind utilities beating earlier ones.
 * Lets every primitive accept a `className` that actually overrides its
 * defaults instead of fighting them on specificity.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

import { describe, expect, it } from "vitest";

import { cn } from "./cn";

/**
 * Guards the design system against a failure mode with no visible symptom at
 * build time: tailwind-merge treating a custom font-size utility as a text
 * colour and dropping one of them. Every case below was silently broken before
 * the font-size scale was registered in `cn.ts`.
 */
describe("cn", () => {
  it("keeps a custom font size alongside a text colour", () => {
    const result = cn("text-page", "text-ink");
    expect(result).toContain("text-page");
    expect(result).toContain("text-ink");
  });

  it.each([
    ["text-meta", "text-ink-muted"],
    ["text-small", "text-ink-secondary"],
    ["text-body", "text-ink"],
    ["text-title", "text-accent"],
    ["text-page", "text-ink-inverted"],
  ])("keeps %s with %s", (size, colour) => {
    const result = cn(size, colour);
    expect(result.split(" ")).toEqual(expect.arrayContaining([size, colour]));
  });

  it("preserves the primary button's text colour", () => {
    // Reproduces Button: base + variant + size, in that order.
    const result = cn(
      "inline-flex rounded-md",
      "bg-accent text-accent-ink",
      "h-11 px-4 text-small",
    );
    expect(result).toContain("text-accent-ink");
    expect(result).toContain("text-small");
  });

  it("preserves a tag's size when a tone supplies a colour", () => {
    const result = cn(
      "rounded-full px-2.5 py-1 text-meta",
      "bg-surface-sunken text-ink-secondary",
    );
    expect(result).toContain("text-meta");
    expect(result).toContain("text-ink-secondary");
  });

  it("still collapses genuine conflicts", () => {
    expect(cn("text-body", "text-page")).toBe("text-page");
    expect(cn("text-ink", "text-accent")).toBe("text-accent");
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("lets a caller override a default", () => {
    // The reason cn exists: `className` must win over a primitive's defaults.
    expect(cn("bg-surface text-body", "text-title")).toBe(
      "bg-surface text-title",
    );
  });

  it("handles conditional and falsy inputs", () => {
    expect(cn("a", false, null, undefined, ["b", "c"])).toBe("a b c");
  });
});

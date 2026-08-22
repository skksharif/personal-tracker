import { describe, expect, it } from "vitest";

import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter";

const roundTrip = (data: Record<string, unknown>, body: string) =>
  parseFrontmatter(stringifyFrontmatter(data, body));

describe("stringifyFrontmatter / parseFrontmatter", () => {
  it("round-trips ordinary content", () => {
    const data = { id: "abc", date: "2026-08-16", tags: ["dsa", "recursion"] };
    const body = "Solved two-sum today.\n\nIt finally clicked.";

    const result = roundTrip(data, body);
    expect(result.data).toEqual(data);
    expect(result.body).toBe(body);
  });

  it("keeps date-like values as strings", () => {
    // YAML's timestamp type would turn these into Date objects and break
    // every z.string() date field in the app.
    const result = roundTrip({ date: "2026-08-16", openOn: "2027-01-01" }, "x");
    expect(result.data.date).toBe("2026-08-16");
    expect(typeof result.data.date).toBe("string");
    expect(typeof result.data.openOn).toBe("string");
  });

  it("quotes ambiguous scalars on disk", () => {
    const raw = stringifyFrontmatter({ date: "2026-08-16" }, "x");
    expect(raw).toMatch(/date: ["']2026-08-16["']/);
  });

  // The regression that motivated dropping gray-matter: it re-parsed the body
  // and exploded it into YAML keys, destroying the entry on write.
  it("preserves a body that opens with a horizontal rule", () => {
    const body = "---\nnot front matter\n---";
    const result = roundTrip({ id: "a", date: "2026-08-16" }, body);

    expect(result.data).toEqual({ id: "a", date: "2026-08-16" });
    expect(result.body).toBe(body);
  });

  it("does not leak body text into the front matter", () => {
    const raw = stringifyFrontmatter({ id: "a" }, "---\nsecret body line\n---");
    const frontMatterBlock = raw.slice(0, raw.indexOf("---", 4));
    expect(frontMatterBlock).not.toContain("secret");
  });

  it.each([
    ["a body that is only a rule", "---"],
    ["a body with several rules", "one\n\n---\n\ntwo\n\n---\n\nthree"],
    ["a body with a YAML-looking line", "title: not front matter\n\nbody"],
    ["a body with trailing rules", "text\n\n---"],
    ["a body containing a code fence", "```yaml\nid: fake\n```"],
    ["a body with windows line endings", "line one\r\nline two"],
    ["an empty body", ""],
    ["a unicode body", "今日は再帰を理解した。🌅\n\n—— it clicked"],
  ])("round-trips %s", (_label, body) => {
    const result = roundTrip({ id: "a" }, body);
    expect(result.body).toBe(body.trim());
    expect(result.data).toEqual({ id: "a" });
  });

  it("treats a document without front matter as all body", () => {
    const result = parseFrontmatter("Just a note.\n\nNo metadata.");
    expect(result.data).toEqual({});
    expect(result.body).toBe("Just a note.\n\nNo metadata.");
  });

  it("handles an empty front matter block", () => {
    const result = parseFrontmatter("---\n---\n\nBody here.");
    expect(result.data).toEqual({});
    expect(result.body).toBe("Body here.");
  });

  it("strips a UTF-8 BOM", () => {
    const result = parseFrontmatter("﻿---\nid: a\n---\n\nBody.");
    expect(result.data).toEqual({ id: "a" });
    expect(result.body).toBe("Body.");
  });

  it("reads hand-edited front matter with unquoted dates", () => {
    const result = parseFrontmatter("---\ndate: 2026-08-16\n---\n\nBody.");
    expect(result.data.date).toBe("2026-08-16");
  });

  it("ignores a non-object front matter block", () => {
    const result = parseFrontmatter("---\n- one\n- two\n---\n\nBody.");
    expect(result.data).toEqual({});
    expect(result.body).toBe("Body.");
  });

  it("keeps nested structures intact", () => {
    const data = {
      id: "a",
      media: [{ path: "/uploads/images/a.webp", type: "image", alt: "desk" }],
      ai: { reflection: null, generatedAt: "2026-08-16T20:00:00.000Z" },
    };
    expect(roundTrip(data, "body").data).toEqual(data);
  });
});

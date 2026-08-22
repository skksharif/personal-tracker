import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DATA_ROOT,
  UPLOADS_ROOT,
  UnsafePathError,
  isInside,
  safePath,
  sanitizeFilename,
  toPublicUrl,
} from "./paths";

describe("safePath", () => {
  it("resolves segments beneath the data root", () => {
    expect(safePath("data", "diary", "2026-08-16.md")).toBe(
      path.join(DATA_ROOT, "diary", "2026-08-16.md"),
    );
  });

  it("resolves segments beneath the uploads root", () => {
    expect(safePath("uploads", "images", "desk.webp")).toBe(
      path.join(UPLOADS_ROOT, "images", "desk.webp"),
    );
  });

  it("accepts a nested path in a single segment", () => {
    expect(safePath("data", "problems/two-sum.json")).toBe(
      path.join(DATA_ROOT, "problems", "two-sum.json"),
    );
  });

  const traversals = [
    "../../etc/passwd",
    "..",
    "../journey.json",
    "diary/../../secrets.json",
    "diary/../../../.env.local",
    "..\\..\\windows\\system32",
    "diary\\..\\..\\.env.local",
    "./../../out",
  ];

  it.each(traversals)("rejects traversal: %s", (segment) => {
    expect(() => safePath("data", segment)).toThrow(UnsafePathError);
  });

  it("rejects traversal spread across multiple segments", () => {
    expect(() => safePath("data", "diary", "..", "..", ".env.local")).toThrow(
      UnsafePathError,
    );
  });

  const absolutes = [
    "/etc/passwd",
    "C:\\Windows\\System32\\config",
    "B:/aimforamazon/.env.local",
    "\\\\server\\share\\file",
  ];

  it.each(absolutes)("rejects absolute segment: %s", (segment) => {
    expect(() => safePath("data", segment)).toThrow(UnsafePathError);
  });

  it("rejects NUL bytes", () => {
    expect(() => safePath("data", "diary\0.md")).toThrow(UnsafePathError);
  });

  it("rejects empty and whitespace-only segments", () => {
    expect(() => safePath("data", "")).toThrow(UnsafePathError);
    expect(() => safePath("data", "   ")).toThrow(UnsafePathError);
  });

  it("rejects a call with no segments", () => {
    expect(() => safePath("data")).toThrow(UnsafePathError);
  });

  it("never returns a path outside its root", () => {
    for (const segment of [...traversals, ...absolutes]) {
      let resolved: string | null = null;
      try {
        resolved = safePath("data", segment);
      } catch {
        continue;
      }
      expect(isInside(DATA_ROOT, resolved)).toBe(true);
    }
  });
});

describe("isInside", () => {
  it("treats the root as inside itself", () => {
    expect(isInside(DATA_ROOT, DATA_ROOT)).toBe(true);
  });

  it("recognises nested paths", () => {
    expect(isInside(DATA_ROOT, path.join(DATA_ROOT, "diary", "a.md"))).toBe(
      true,
    );
  });

  it("rejects siblings with a shared prefix", () => {
    expect(isInside(DATA_ROOT, `${DATA_ROOT}-backup`)).toBe(false);
  });

  it("rejects parents", () => {
    expect(isInside(DATA_ROOT, path.dirname(DATA_ROOT))).toBe(false);
  });
});

describe("sanitizeFilename", () => {
  it("lowercases and dashes unsafe characters", () => {
    expect(sanitizeFilename("My Study Desk!.PNG")).toBe("my-study-desk.png");
  });

  it("strips directory components", () => {
    expect(sanitizeFilename("../../evil.png")).toBe("evil.png");
    expect(sanitizeFilename("C:\\Windows\\notes.md")).toBe("notes.md");
  });

  it("replaces Windows reserved names", () => {
    expect(sanitizeFilename("CON.txt")).toBe("file.txt");
    expect(sanitizeFilename("nul")).toBe("file");
  });

  it("falls back when nothing usable remains", () => {
    expect(sanitizeFilename("///", "upload")).toBe("upload");
  });

  it("caps the length", () => {
    const long = `${"a".repeat(300)}.png`;
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(84);
  });
});

describe("toPublicUrl", () => {
  it("maps an upload to its served URL", () => {
    const file = path.join(UPLOADS_ROOT, "generated", "recursion-001.webp");
    expect(toPublicUrl(file)).toBe("/uploads/generated/recursion-001.webp");
  });

  it("refuses paths outside uploads", () => {
    expect(() => toPublicUrl(path.join(DATA_ROOT, "journey.json"))).toThrow(
      UnsafePathError,
    );
  });
});

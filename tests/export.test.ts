import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The export.
 *
 * The promise this route makes is the strongest one in the product: you can
 * walk away with everything, and read it without this app. So the test opens
 * the archive it produces and checks the files are actually in there.
 *
 * Zip local file headers store each entry's name uncompressed, which is what
 * makes the listing readable without a zip library.
 */

let dataDir: string;
let route: typeof import("@/app/api/export/route");
let entries: typeof import("@/lib/storage/entries");

beforeEach(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "journey-export-"));
  vi.stubEnv("DATA_DIR", dataDir);
  vi.resetModules();

  route = await import("@/app/api/export/route");
  entries = await import("@/lib/storage/entries");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fsp.rm(dataDir, { recursive: true, force: true });
});

/** Every filename recorded in the archive's local file headers. */
function namesIn(zip: Buffer): string[] {
  const names: string[] = [];
  const LOCAL_HEADER = 0x04034b50;

  for (let offset = 0; offset + 30 <= zip.length; offset++) {
    if (zip.readUInt32LE(offset) !== LOCAL_HEADER) continue;

    const nameLength = zip.readUInt16LE(offset + 26);
    if (nameLength === 0 || offset + 30 + nameLength > zip.length) continue;

    names.push(zip.subarray(offset + 30, offset + 30 + nameLength).toString());
  }

  return names;
}

async function exportZip(): Promise<{ response: Response; zip: Buffer }> {
  const response = await route.GET();
  const zip = Buffer.from(await response.arrayBuffer());
  return { response, zip };
}

describe("GET /api/export", () => {
  it("streams a zip with a download filename", async () => {
    const { response } = await exportZip();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(response.headers.get("Content-Disposition")).toMatch(
      /attachment; filename="journey-export-\d{4}-\d{2}-\d{2}\.zip"/,
    );
  });

  it("contains the entries, as the files they are on disk", async () => {
    await entries.updateEntry("diary", "2026-08-01", {
      date: "2026-08-01",
      title: "A day",
      body: "What I wrote.",
    });

    const { zip } = await exportZip();
    const names = namesIn(zip);

    expect(names).toContain("journey-export/diary/2026-08-01.md");
    expect(names).toContain("journey-export/journey.json");
  });

  it("includes a README so the archive explains itself", async () => {
    const { zip } = await exportZip();
    expect(namesIn(zip)).toContain("journey-export/README.md");
  });

  it("includes uploaded media", async () => {
    // `public/uploads` is not configurable — it has to stay where Next serves
    // it from — so this test writes into the real directory and cleans up.
    const { UPLOADS_ROOT } = await import("@/lib/storage/paths");
    const marker = path.join(UPLOADS_ROOT, "export-test-marker.webp");

    await fsp.mkdir(UPLOADS_ROOT, { recursive: true });
    await fsp.writeFile(marker, "stand-in for an image");

    try {
      const { zip } = await exportZip();
      expect(namesIn(zip)).toContain(
        "journey-export/uploads/export-test-marker.webp",
      );
    } finally {
      await fsp.rm(marker, { force: true });
    }
  });

  it("works on an empty journal", async () => {
    const { response, zip } = await exportZip();

    expect(response.status).toBe(200);
    expect(namesIn(zip)).toContain("journey-export/README.md");
  });
});

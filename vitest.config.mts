import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` throws on import outside a React Server Component.
      // Tests are server-side by definition, so stub it out.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    /*
     * Most of this suite writes real files: atomic write, fsync, rename, then
     * an index rewrite, many times over per test. On Windows that runs at the
     * mercy of the on-access virus scanner — the same suite has been measured
     * at 2s and at 40s on the same machine, unchanged. The default 5s turns
     * that into flaky red for tests whose assertions all pass.
     */
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

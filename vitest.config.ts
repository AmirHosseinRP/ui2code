import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // Shell-spawning tests are slow on Windows under parallel load.
    testTimeout: 20000,
    include: ["packages/*/src/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts"],
    },
  },
});
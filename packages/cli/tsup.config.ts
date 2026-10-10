import { defineConfig } from "tsup";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const coreSrc = path.resolve(here, "../core/src/index.ts");

// CLI entry. Fully self-contained: every runtime dependency (commander,
// zod, @opencode-ai/plugin, @ui2code/core, ...) is inlined, so the
// published package has zero runtime dependencies and works via
// `npx ui2code` without installing anything into the target project.
export default defineConfig({
  entry: { index: "src/index.ts" },
  outDir: "dist",
  format: ["esm"],
  platform: "node",
  target: "node18",
  clean: true,
  sourcemap: false,
  dts: false,
  splitting: false,
  noExternal: [/.*/],
  banner: {
    js: `#!/usr/bin/env node
import { createRequire as __ui2codeCreateRequire } from "node:module";
const require = __ui2codeCreateRequire(import.meta.url);`,
  },
  esbuildOptions(options) {
    options.alias = { ...options.alias, "@ui2code/core": coreSrc };
  },
});

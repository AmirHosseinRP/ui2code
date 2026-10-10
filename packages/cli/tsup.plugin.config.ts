import { defineConfig } from "tsup";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const coreSrc = path.resolve(here, "../core/src/index.ts");
const pluginSrc = path.resolve(here, "../opencode-plugin/src/index.ts");

// Self-contained OpenCode plugin bundle. `ui2code init` copies this file
// into the target project's `.opencode/plugins/` where OpenCode
// auto-loads it — no npm install or absolute paths required.
// Output is .mjs so it is always parsed as ESM, even in CommonJS projects.
export default defineConfig({
  entry: { plugin: pluginSrc },
  outDir: "dist",
  format: ["esm"],
  platform: "node",
  target: "node18",
  clean: false,
  sourcemap: false,
  dts: false,
  splitting: false,
  noExternal: [/.*/],
  outExtension: () => ({ js: ".mjs" }),
  banner: {
    js: `import { createRequire as __ui2codeCreateRequire } from "node:module";
const require = __ui2codeCreateRequire(import.meta.url);`,
  },
  esbuildOptions(options) {
    options.alias = { ...options.alias, "@ui2code/core": coreSrc };
  },
});

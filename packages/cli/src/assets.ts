import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Asset resolution for the published package layout:
 *
 *   <pkg>/dist/index.js      <- this code (bundled)
 *   <pkg>/dist/plugin.mjs    <- self-contained OpenCode plugin bundle
 *   <pkg>/templates/*.md     <- agent/command templates
 *
 * All paths are derived from import.meta.url — never hardcoded repo paths.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to a shipped template file (e.g. "ui-builder.md"). */
export function templatePath(name: string): string {
  return path.join(HERE, "..", "templates", name);
}

/** Read a shipped template file as UTF-8. */
export function readTemplate(name: string): string {
  const p = templatePath(name);
  if (!fs.existsSync(p)) {
    throw new Error(
      `Template "${name}" not found at ${p}. The ui2code installation looks corrupted — try reinstalling: npm install -g ui2code`
    );
  }
  return fs.readFileSync(p, "utf-8");
}

/**
 * Absolute path to the bundled OpenCode plugin (dist/plugin.mjs).
 * Falls back to ../dist/plugin.mjs when running from source (tests).
 */
export function pluginBundlePath(): string {
  const candidates = [
    path.join(HERE, "plugin.mjs"),
    path.join(HERE, "..", "dist", "plugin.mjs"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

/** Read the bundled OpenCode plugin source. */
export function readPluginBundle(): string {
  const p = pluginBundlePath();
  if (!fs.existsSync(p)) {
    throw new Error(
      `Plugin bundle not found at ${p}. The ui2code installation looks corrupted — try reinstalling: npm install -g ui2code`
    );
  }
  return fs.readFileSync(p, "utf-8");
}

/** The version of the installed ui2code package. */
export function cliVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(HERE, "..", "package.json"), "utf-8"));
    return String(pkg.version ?? "0.0.0");
  } catch {
    return "0.0.0";
  }
}

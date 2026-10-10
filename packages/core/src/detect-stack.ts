import * as fs from "node:fs";
import * as path from "node:path";
import { runDetectors, getDetectors, clearDetectors, type DetectorContext } from "./detectors/registry";
import { registerBuiltinDetectors } from "./detectors";
import type { StackResult } from "./schemas/stack";

export interface DetectStackOptions {
  /** Absolute path to the project root */
  projectRoot: string;
}

/**
 * Detect the technology stack of a project.
 * Inspects package.json, lockfiles, config files, and source patterns.
 */
export async function detectStack(options: DetectStackOptions): Promise<StackResult> {
  const { projectRoot } = options;

  // Register built-in detectors if none are already registered
  if (getDetectors().length === 0) {
    registerBuiltinDetectors();
  }

  // Build context
  const packageJsonPath = path.join(projectRoot, "package.json");
  let packageJson: Record<string, unknown> | null = null;
  try {
    const raw = fs.readFileSync(packageJsonPath, "utf-8");
    packageJson = JSON.parse(raw);
  } catch {
    // no package.json
  }

  const rootFiles: string[] = [];
  try {
    rootFiles.push(...fs.readdirSync(projectRoot));
  } catch {
    // empty
  }

  const ctx: DetectorContext = {
    projectRoot,
    packageJson,
    rootFiles,
    readFile: async (relativePath: string) => {
      try {
        return fs.readFileSync(path.join(projectRoot, relativePath), "utf-8");
      } catch {
        return null;
      }
    },
    fileExists: async (relativePath: string) => {
      try {
        fs.accessSync(path.join(projectRoot, relativePath));
        return true;
      } catch {
        return false;
      }
    },
    glob: async (pattern: string) => {
      const files: string[] = [];

      /** Expand brace patterns: "src/**\/*.{ts,tsx}" → ["src/**\/*.ts", "src/**\/*.tsx"] */
      function expandBraces(p: string): string[] {
        const braceMatch = p.match(/\{([^}]+)\}/);
        if (!braceMatch) return [p];
        const options = braceMatch[1].split(",");
        const prefix = p.slice(0, braceMatch.index);
        const suffix = p.slice((braceMatch.index || 0) + braceMatch[0].length);
        return options.flatMap((opt) => expandBraces(prefix + opt + suffix));
      }

      function walk(dir: string, parts: string[]): void {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const part = parts[0];
        const rest = parts.slice(1);

        if (part === "**") {
          // ** matches zero or more directories.
          // Try matching rest at this level (zero dirs matched).
          walk(dir, rest);
          // Recurse into subdirectories.
          for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith(".")) {
              walk(path.join(dir, entry.name), parts);
            }
          }
        } else if (part && part.includes("*")) {
          // Glob pattern: match entries at this level.
          for (const entry of entries) {
            if (!matchGlob(entry.name, part)) continue;
            const fullPath = path.join(dir, entry.name);
            if (rest.length === 0) {
              if (entry.isFile()) {
                files.push(path.relative(projectRoot, fullPath));
              }
            } else if (entry.isDirectory()) {
              walk(fullPath, rest);
            }
          }
        } else if (part) {
          // Literal directory/file name.
          const next = path.join(dir, part);
          if (rest.length === 0) {
            if (fs.existsSync(next) && fs.statSync(next).isFile()) {
              files.push(path.relative(projectRoot, next));
            }
          } else if (fs.existsSync(next) && fs.statSync(next).isDirectory()) {
            walk(next, rest);
          }
        }
      }

      // Expand braces first, then walk each expanded pattern.
      for (const expanded of expandBraces(pattern)) {
        const parts = expanded.split(/[\\/]/);
        walk(projectRoot, parts);
      }
      return [...new Set(files)];
    },
  };

  return runDetectors(ctx);
}

function matchGlob(name: string, pattern: string): boolean {
  if (!pattern || pattern === "*") return true;
  // Handle {ts,tsx,js,jsx} patterns
  const braceMatch = pattern.match(/\{([^}]+)\}/);
  if (braceMatch) {
    const options = braceMatch[1].split(",");
    const prefix = pattern.slice(0, braceMatch.index);
    const suffix = pattern.slice((braceMatch.index || 0) + braceMatch[0].length);
    return options.some((opt) => matchGlob(name, prefix + opt + suffix));
  }
  // Simple glob: * and **
  const regex = new RegExp(
    "^" +
      pattern
        .replace(/\./g, "\\.")
        .replace(/\*\*/g, "___DOUBLESTAR___")
        .replace(/\*/g, "[^/]*")
        .replace(/___DOUBLESTAR___/g, ".*") +
      "$"
  );
  return regex.test(name);
}
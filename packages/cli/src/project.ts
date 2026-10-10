import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { detectStack, type StackResult, type StackOverrides } from "@ui2code/core";

export interface ProjectSummary {
  packageManager: string;
  framework: string;
  styling: string;
  language: string;
  componentLib: string;
  testSetup: string;
  /** True when detection found little evidence (e.g. an empty directory) */
  sparse: boolean;
}

/**
 * Detect the target project's stack and condense it for display.
 * Never throws — falls back to "unknown" values on errors.
 */
export async function summarizeProject(projectDir: string): Promise<ProjectSummary> {
  let stack: StackResult | undefined;
  try {
    stack = await detectStack({ projectRoot: projectDir });
  } catch {
    stack = undefined;
  }

  const get = (field: { value: string; confidence: number } | undefined): string =>
    field && field.confidence > 0 ? field.value : "unknown";

  const summary: ProjectSummary = {
    packageManager: get(stack?.packageManager),
    framework: get(stack?.framework),
    styling: get(stack?.styling),
    language: get(stack?.language),
    componentLib: get(stack?.componentLib),
    testSetup: get(stack?.testSetup),
    sparse: !fs.existsSync(path.join(projectDir, "package.json")),
  };
  return summary;
}

/** Convert a project summary into ui2code.project overrides for opencode.json. */
export function summaryToOverrides(summary: ProjectSummary): StackOverrides {
  const overrides: StackOverrides = {};
  if (summary.packageManager !== "unknown") overrides.packageManager = summary.packageManager;
  if (summary.language !== "unknown") overrides.language = summary.language;
  if (summary.framework !== "unknown") overrides.framework = summary.framework;
  if (summary.styling !== "unknown") overrides.styling = summary.styling;
  return overrides;
}

export interface OpenCodeStatus {
  installed: boolean;
  version?: string;
}

/** Detect whether the `opencode` CLI is installed. */
export function detectOpenCode(): OpenCodeStatus {
  try {
    const raw = execSync("opencode --version", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    // Version strings vary: "1.18.35" or "opencode v2.0.26"
    const match = raw.match(/(\d+\.\d+\.\d+)/);
    return { installed: true, version: match ? match[1] : raw };
  } catch {
    return { installed: false };
  }
}

/** Package manager most likely used by this project (from lockfiles). */
export function detectPackageManager(projectDir: string): string {
  if (fs.existsSync(path.join(projectDir, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(projectDir, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(projectDir, "bun.lockb")) || fs.existsSync(path.join(projectDir, "bun.lock"))) return "bun";
  return "npm";
}

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

export interface VerifyResult {
  /** Whether all checks passed */
  success: boolean;
  /** Results from each script */
  results: Array<{
    /** Script name (e.g., "typecheck", "lint", "build") */
    name: string;
    /** Script command that was run */
    command: string;
    /** Exit code */
    exitCode: number;
    /** stdout output (truncated) */
    stdout: string;
    /** stderr output (truncated) */
    stderr: string;
    /** Whether this check passed */
    passed: boolean;
    /** Parsed errors if any */
    errors: ScriptError[];
  }>;
  /** Overall summary */
  summary: string;
}

export interface ScriptError {
  /** File path where the error occurred */
  file?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Error message */
  message: string;
  /** Error severity */
  severity: "error" | "warning" | "info";
  /** Source (typescript, eslint, etc.) */
  source?: string;
}

export interface VerifyProjectOptions {
  /** Absolute path to the project root */
  projectRoot: string;
  /** Specific scripts to run (default: auto-detect from package.json) */
  scripts?: string[];
  /** Timeout per script in ms (default: 60000) */
  timeout?: number;
}

const MAX_OUTPUT_LENGTH = 10000;

/** Scripts to try in order, and their common aliases */
const SCRIPT_CANDIDATES = [
  { names: ["typecheck", "type-check", "tsc"], category: "typecheck" },
  { names: ["lint", "eslint"], category: "lint" },
  { names: ["build"], category: "build" },
];

/**
 * Verify a project by running its own typecheck/lint/build scripts.
 * Detects scripts from package.json. Never runs arbitrary commands.
 */
export async function verifyProject(options: VerifyProjectOptions): Promise<VerifyResult> {
  const { projectRoot, timeout = 60000 } = options;

  // Read package.json to find available scripts
  const scripts = detectScripts(projectRoot, options.scripts);

  const result: VerifyResult = {
    success: true,
    results: [],
    summary: "",
  };

  for (const script of scripts) {
    const scriptResult = await runScript(projectRoot, script.name, script.command, timeout);
    result.results.push(scriptResult);
    if (!scriptResult.passed) {
      result.success = false;
    }
  }

  // Build summary
  const passed = result.results.filter((r) => r.passed).length;
  const total = result.results.length;
  if (total === 0) {
    result.summary = "No verification scripts found in package.json.";
  } else if (result.success) {
    result.summary = `All ${total} checks passed: ${result.results.map((r) => r.name).join(", ")}.`;
  } else {
    const failed = result.results.filter((r) => !r.passed).map((r) => r.name);
    result.summary = `${passed}/${total} checks passed. Failed: ${failed.join(", ")}.`;
  }

  return result;
}

function detectScripts(projectRoot: string, requested?: string[]): Array<{ name: string; command: string }> {
  const pkgPath = path.join(projectRoot, "package.json");
  if (!fs.existsSync(pkgPath)) return [];

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  } catch {
    return [];
  }

  const pkgScripts = pkg.scripts as Record<string, string> | undefined;
  if (!pkgScripts) return [];

  if (requested) {
    return requested
      .filter((name) => pkgScripts[name])
      .map((name) => ({ name, command: pkgScripts[name] }));
  }

  // Auto-detect
  const found: Array<{ name: string; command: string }> = [];
  for (const candidate of SCRIPT_CANDIDATES) {
    for (const name of candidate.names) {
      if (pkgScripts[name]) {
        found.push({ name, command: pkgScripts[name] });
        break; // Only one per category
      }
    }
  }

  return found;
}

async function runScript(
  projectRoot: string,
  name: string,
  command: string,
  timeout: number
): Promise<VerifyResult["results"][0]> {
  let exitCode: number;
  let stdout: string;
  let stderr = "";

  try {
    stdout = execSync(command, {
      cwd: projectRoot,
      timeout,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "test" },
    });
    exitCode = 0;
  } catch (err: unknown) {
    const execErr = err as { status?: number; stdout?: string; stderr?: string };
    exitCode = execErr.status ?? 1;
    stdout = execErr.stdout ?? "";
    stderr = execErr.stderr ?? "";
  }

  // Truncate output
  stdout = stdout.slice(-MAX_OUTPUT_LENGTH);
  stderr = stderr.slice(-MAX_OUTPUT_LENGTH);

  const errors = parseErrors(name, stdout, stderr);
  const passed = exitCode === 0;

  return {
    name,
    command,
    exitCode,
    stdout,
    stderr,
    passed,
    errors,
  };
}

/** Parse structured errors from script output */
function parseErrors(scriptName: string, stdout: string, stderr: string): ScriptError[] {
  const errors: ScriptError[] = [];
  const combined = stdout + "\n" + stderr;

  // TypeScript errors: src/file.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
  const tsPattern = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/gm;
  let match;
  while ((match = tsPattern.exec(combined)) !== null) {
    errors.push({
      file: match[1],
      line: parseInt(match[2]),
      column: parseInt(match[3]),
      message: `${match[4]}: ${match[5]}`,
      severity: "error",
      source: "typescript",
    });
  }

  // ESLint errors: /path/file.ts:10:5: error message (rule-name)
  const eslintPattern = /^(.+?):(\d+):(\d+): (error|warning) (.+?) \((.+?)\)$/gm;
  while ((match = eslintPattern.exec(combined)) !== null) {
    errors.push({
      file: match[1],
      line: parseInt(match[2]),
      column: parseInt(match[3]),
      message: match[5],
      severity: match[4] as "error" | "warning",
      source: "eslint",
    });
  }

  // Build errors (Vite, Next.js, etc.)
  if (scriptName === "build" && errors.length === 0 && combined.includes("error")) {
    // Generic error extraction
    const errorLines = combined.split("\n").filter((line) =>
      line.toLowerCase().includes("error") && !line.includes("✓") && !line.includes("success")
    );
    for (const line of errorLines.slice(0, 10)) {
      errors.push({
        message: line.trim(),
        severity: "error",
        source: "build",
      });
    }
  }

  return errors;
}

/**
 * Format a VerifyResult as a human-readable summary.
 */
export function formatVerifyResult(result: VerifyResult): string {
  const lines: string[] = [];

  lines.push(result.summary);
  lines.push("");

  for (const r of result.results) {
    const status = r.passed ? "✓" : "✗";
    lines.push(`${status} ${r.name} (exit code: ${r.exitCode})`);

    if (r.errors.length > 0) {
      for (const err of r.errors.slice(0, 10)) {
        const loc = err.file ? `${err.file}:${err.line || 0}:${err.column || 0}` : "";
        lines.push(`    ${err.severity}: ${loc} ${err.message}`);
      }
      if (r.errors.length > 10) {
        lines.push(`    ... and ${r.errors.length - 10} more errors`);
      }
    }

    if (!r.passed && r.stderr && r.errors.length === 0) {
      // Show raw stderr if no structured errors parsed
      lines.push(`    stderr: ${r.stderr.slice(0, 500)}`);
    }
  }

  return lines.join("\n");
}
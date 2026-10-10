import * as path from "node:path";
import { spawn } from "node:child_process";
import * as readline from "node:readline";
import {
  createClackPrompter,
  createNonInteractivePrompter,
  type Prompter,
} from "../prompter";
import { resolveImageInput } from "../input";
import { detectOpenCode } from "../project";
import { isProjectInitialized, UI2CODE_WORKFLOW_TEXT } from "../install";
import { initCommand } from "./init";

export interface RunOptions {
  /** Path or URL to the screenshot (optional when --clipboard) */
  image?: string;
  /** Capture the screenshot from the clipboard */
  clipboard?: boolean;
  /** Optional text brief describing the UI */
  brief?: string;
  /** Optional output directory for the generated component */
  out?: string;
  /** Framework override when detection is wrong */
  framework?: string;
  /** Project directory (defaults to cwd) */
  dir?: string;
  /** Model override (provider/model format) */
  model?: string;
  /** Accept recommended defaults without asking */
  yes?: boolean;
  /** Show the raw agent output instead of the progress UI */
  verbose?: boolean;
}

/** Tool patterns → workflow step labels, in pipeline order. */
const STEP_MATCHERS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /analyze_screenshot/, label: "Analyzing screenshot" },
  { pattern: /detect_stack/, label: "Detecting stack" },
  { pattern: /scan_conventions/, label: "Scanning conventions" },
  { pattern: /map_to_design_system/, label: "Mapping to design system" },
  {
    pattern: /write_component_files|tools\.write\(|tools\.edit\(|tools\.patch\(|"tool":"(write|edit|patch|multiedit)"/,
    label: "Generating",
  },
  { pattern: /verify_project/, label: "Verifying" },
];

export interface RunStats {
  /** Workflow steps observed, in order */
  steps: string[];
  /** Files touched (detected from tool calls) */
  files: string[];
  /** verify_project results */
  verification: Array<{ name: string; passed: boolean }>;
  /** Assistant text blocks (last one is the agent's summary) */
  textParts: string[];
  cost: number;
  inputTokens: number;
  outputTokens: number;
  /** Raw error lines (stderr / error events) */
  errors: string[];
}

/**
 * Run the ui2code workflow: launches OpenCode with the ui-builder agent and
 * the screenshot attached, shows step progress, and prints a summary.
 */
export async function runCommand(options: RunOptions): Promise<void> {
  const projectDir = path.resolve(options.dir || process.cwd());
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const ui: Prompter =
    !options.verbose && interactive
      ? createClackPrompter()
      : createNonInteractivePrompter(console.log);

  // 1. Resolve and validate the image early
  const image = await resolveImageInput({
    image: options.image,
    clipboard: options.clipboard,
  });
  if (image.warning) ui.warn(image.warning);
  if (image.source !== "file") {
    ui.note(`Using screenshot from ${image.source}: ${image.path}`, "Input");
  }

  // 2. Make sure the project is set up
  if (!isProjectInitialized(projectDir)) {
    if (interactive && !options.yes) {
      const runSetup = await ui.confirm(
        "This project isn't set up for ui2code yet. Run `ui2code init` now?",
        true
      );
      if (!runSetup) {
        throw new Error("Setup is required before running. Run: ui2code init");
      }
      await initCommand({ dir: projectDir });
    } else {
      ui.note("Project not set up yet — running `ui2code init` automatically...");
      await initCommand({ dir: projectDir, yes: true, model: options.model });
    }
    if (!isProjectInitialized(projectDir)) {
      throw new Error(
        "Setup did not complete, so the run was cancelled. Fix the issues reported above and run `ui2code init` again."
      );
    }
  }

  // 3. OpenCode must be installed
  const opencode = detectOpenCode();
  if (!opencode.installed) {
    throw new Error(
      "OpenCode is not installed. Install it with: npm install -g opencode-ai (then re-run this command)"
    );
  }

  // 4. Launch
  const prompt = buildRunPrompt(image.path, options);
  const args = ["run", "--auto", "--agent", "ui-builder"];
  if (!options.verbose) args.splice(1, 0, "--format", "json");
  if (options.model) args.push("--model", options.model);

  ui.intro(`ui2code run — ${path.basename(image.path)}`);
  const spin = ui.spinner();
  spin.start(`Launching OpenCode (v${opencode.version})...`);

  const started = Date.now();
  const stats: RunStats = {
    steps: [],
    files: [],
    verification: [],
    textParts: [],
    cost: 0,
    inputTokens: 0,
    outputTokens: 0,
    errors: [],
  };

  const exitCode = await new Promise<number>((resolve) => {
    const child = spawn("opencode", args, {
      cwd: projectDir,
      stdio: ["pipe", options.verbose ? "inherit" : "pipe", "pipe"],
      shell: true,
    });

    // The message goes over stdin (no shell quoting problems).
    const stdin = child.stdin;
    if (stdin) {
      stdin.write(prompt);
      stdin.end();
    }

    if (child.stdout && !options.verbose) {
      const rl = readline.createInterface({ input: child.stdout });
      rl.on("line", (line) => handleEventLine(line, stats, spin));
    }

    if (child.stderr) {
      const rlErr = readline.createInterface({ input: child.stderr });
      rlErr.on("line", (line) => {
        const cleaned = stripAnsi(line).trim();
        if (cleaned) stats.errors.push(cleaned);
      });
    }

    child.on("error", (err) => {
      stats.errors.push(err.message);
      resolve(1);
    });
    child.on("exit", (code) => resolve(code ?? 0));
  });

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  spin.stop(`Finished in ${seconds}s.`);

  // 5. Summary
  printSummary(stats, exitCode, options);
  process.exit(exitCode);
}

/** Build the prompt for the ui-builder agent. */
export function buildRunPrompt(imagePath: string, options: RunOptions): string {
  const parts: string[] = [
    UI2CODE_WORKFLOW_TEXT.replace("$ARGUMENTS", `\`${imagePath}\``),
  ];
  if (options.brief) parts.push(`User brief: ${options.brief}`);
  if (options.out) parts.push(`Create the component under this directory: ${options.out}`);
  if (options.framework) {
    parts.push(
      `The user states the project uses ${options.framework} — trust this over auto-detection.`
    );
  }
  parts.push(
    "Note: this run cannot ask you questions. Make reasonable assumptions where information is missing and state them clearly in your final summary."
  );
  return parts.join("\n\n");
}

function handleEventLine(
  line: string,
  stats: RunStats,
  spin: { message: (m: string) => void }
): void {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return;

  let event: {
    type?: string;
    part?: Record<string, unknown> & {
      type?: string;
      text?: string;
      tool?: string;
      state?: {
        input?: Record<string, unknown>;
        output?: string;
      };
      metadata?: { metadata?: { toolCalls?: Array<{ tool?: string; status?: string }> } };
      cost?: number;
      tokens?: { input?: number; output?: number };
    };
  };
  try {
    event = JSON.parse(trimmed);
  } catch {
    return;
  }
  const part = event.part;
  if (!part) return;

  if (event.type === "tool_use") {
    const haystack = [
      part.tool ?? "",
      JSON.stringify(part.state?.input ?? {}),
      typeof part.state?.output === "string" ? part.state.output : "",
      ...(part.metadata?.metadata?.toolCalls ?? []).map((t) => t.tool ?? ""),
    ].join("\n");

    for (const { pattern, label } of STEP_MATCHERS) {
      if (pattern.test(haystack) && !stats.steps.includes(label)) {
        stats.steps.push(label);
        spin.message(`${label}...`);
      }
    }

    for (const file of extractFiles(part)) {
      const normalized = file.split("\\").join("/");
      if (!stats.files.includes(normalized)) stats.files.push(normalized);
    }

    const output = typeof part.state?.output === "string" ? part.state.output : "";
    if (/verify_project/.test(haystack)) {
      stats.verification.push(...extractVerification(output));
    }
  } else if (event.type === "text" && typeof part.text === "string") {
    stats.textParts.push(part.text);
  } else if (event.type === "step_finish") {
    stats.cost += part.cost ?? 0;
    stats.inputTokens += part.tokens?.input ?? 0;
    stats.outputTokens += part.tokens?.output ?? 0;
  } else if (event.type && event.type.includes("error")) {
    stats.errors.push(JSON.stringify(part));
  }
}

/** Extract written file paths from a tool call part (best effort). */
export function extractFiles(part: {
  tool?: string;
  state?: { input?: Record<string, unknown>; output?: string };
}): string[] {
  const files: string[] = [];
  const input = part.state?.input ?? {};
  const output = typeof part.state?.output === "string" ? part.state.output : "";
  const push = (value: unknown) => {
    if (typeof value === "string" && value.trim()) files.push(value.trim());
  };

  push(input.filePath);
  push(input.file);
  push(input.path);

  if (typeof input.files === "string") {
    try {
      const parsed = JSON.parse(input.files);
      if (Array.isArray(parsed)) for (const f of parsed) push((f as { filePath?: unknown })?.filePath);
    } catch {
      // not JSON — fall through to regex extraction
    }
  }
  if (Array.isArray(input.files)) {
    for (const f of input.files) push((f as { filePath?: unknown })?.filePath);
  }

  // Code-mode calls and formatted write results
  const texts = [
    typeof input.code === "string" ? input.code : "",
    typeof input.files === "string" ? input.files : "",
    output,
  ];
  for (const text of texts) {
    const jsonish = /filePath\\?["']?\s*:\s*\\?["']([^"'\n\\]+)/g;
    let match: RegExpExecArray | null;
    while ((match = jsonish.exec(text))) files.push(match[1]);
  }
  for (const line of output.split("\n")) {
    const formatted = /^\s*[+~] (\S[^\n]*?)\s*$/.exec(line);
    if (formatted) files.push(formatted[1]);
  }

  return files;
}

/** Extract per-script results from a verify_project output. */
export function extractVerification(
  output: string
): Array<{ name: string; passed: boolean }> {
  const results: Array<{ name: string; passed: boolean }> = [];
  const re = /^([✓✗]) (.+?) \(exit code: (\d+)\)/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(output))) {
    results.push({ name: match[2], passed: match[1] === "✓" });
  }
  return results;
}

function printSummary(stats: RunStats, exitCode: number, options: RunOptions): void {
  console.log("");
  if (options.verbose) {
    console.log(exitCode === 0 ? "✓ ui2code run finished." : `✗ ui2code run failed (exit ${exitCode}).`);
  } else {
    console.log(exitCode === 0 ? "✓ ui2code run complete" : `✗ ui2code run failed (exit ${exitCode})`);
    console.log("");

    if (stats.steps.length > 0) {
      console.log("Steps:");
      for (const step of stats.steps) console.log(`  ✓ ${step}`);
      console.log("");
    }

    if (stats.files.length > 0) {
      console.log(`Files touched (${stats.files.length}, detected from tool calls):`);
      for (const file of stats.files) console.log(`  + ${file}`);
      console.log("");
    }

    if (stats.verification.length > 0) {
      console.log("Verification:");
      for (const v of stats.verification) {
        console.log(`  ${v.passed ? "✓" : "✗"} ${v.name}`);
      }
      console.log("");
    }

    const report = stats.textParts[stats.textParts.length - 1];
    if (report) {
      console.log("Agent notes:");
      console.log(indent(report.trim().slice(0, 2000)));
      console.log("");
    }

    if (stats.cost > 0 || stats.inputTokens > 0) {
      const cost = stats.cost > 0 ? `$${stats.cost.toFixed(4)} · ` : "";
      console.log(`Usage: ${cost}${stats.inputTokens} in / ${stats.outputTokens} out tokens`);
      console.log("");
    }

    if (stats.errors.length > 0 && exitCode !== 0) {
      console.log("Errors:");
      for (const err of stats.errors.slice(0, 5)) console.log(`  ! ${err}`);
      if (stats.errors.length > 5) console.log(`  ... and ${stats.errors.length - 5} more`);
      console.log("");
    }
  }

  console.log("Next steps:");
  console.log("  - Compare the result with your screenshot and adjust the brief if needed");
  console.log("  - Review the generated code before committing");
  if (options.verbose) {
    console.log("  - Tip: run without --verbose for a structured summary");
  }
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n");
}

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}



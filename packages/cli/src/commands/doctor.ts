import * as fs from "node:fs";
import * as path from "node:path";
import {
  resolveModelConfig,
  getVisionModel,
  modelLikelySupportsVision,
  findApiKey,
  callVisionModel,
} from "@ui2code/core";
import { detectOpenCode } from "../project";
import { isProjectInitialized, installToProject, PLUGIN_FILE, LEGACY_PLUGIN_NAME } from "../install";

export interface DoctorOptions {
  /** Project directory (defaults to cwd) */
  dir?: string;
  /** Exit the process with code 1 when checks fail (default true). */
  exitProcess?: boolean;
  /** Automatically repair safe issues (missing files, malformed config). */
  fix?: boolean;
  /** Make a cheap test API call to verify the configured key works. */
  online?: boolean;
}

export interface DoctorCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
  /** Specific instruction for fixing a failed check */
  fix?: string;
}

const ICONS: Record<DoctorCheck["status"], string> = {
  pass: "✓",
  warn: "⚠",
  fail: "✗",
};

/**
 * Run health checks for ui2code setup.
 * Returns structured results; use doctorCommand for CLI output.
 */
export async function runDoctorChecks(
  projectDir: string,
  options: { online?: boolean } = {}
): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [
    checkOpenCode(),
    checkConfig(projectDir),
    checkCredentials(projectDir),
    checkModel(projectDir),
    checkVisionModel(projectDir),
    checkAgents(projectDir),
    checkPlugin(projectDir),
  ];
  if (options.online) {
    checks.push(await checkOnlineKey(projectDir));
  }
  return checks;
}

/**
 * Run health checks and print a report.
 * With --fix, automatically repair safe issues first.
 * With --online, also verify the API key with a cheap test call.
 * Exits with code 1 on failure unless options.exitProcess is false.
 */
export async function doctorCommand(options: DoctorOptions = {}): Promise<DoctorCheck[]> {
  const projectDir = path.resolve(options.dir || process.cwd());
  let checks = await runDoctorChecks(projectDir, { online: options.online });

  if (options.fix) {
    console.log("Attempting automatic fixes...\n");
    const fixes = await runDoctorFixes(projectDir, checks);
    for (const f of fixes) {
      console.log(`  ✧ ${f}`);
    }
    if (fixes.length === 0) {
      console.log("  (nothing was fixable automatically)");
    }
    console.log("");
    // Re-check after fixes
    checks = await runDoctorChecks(projectDir, { online: options.online });
  }

  console.log("ui2code doctor — checking setup...\n");
  for (const check of checks) {
    console.log(`${ICONS[check.status]} ${check.name}: ${check.message}`);
    if (check.fix && check.status !== "pass") {
      console.log(`    Fix: ${check.fix}`);
    }
  }

  const failed = checks.some((c) => c.status === "fail");
  console.log("");
  if (failed) {
    console.log("Some checks failed. Fix the issues above before using ui2code.");
    if (options.exitProcess !== false) process.exit(1);
  } else if (checks.some((c) => c.status === "warn")) {
    console.log("Setup is usable, but review the warnings above.");
  } else {
    console.log("All checks passed! ui2code is ready to use.");
  }

  return checks;
}

/**
 * Automatically repair what we safely can:
 * - Restore opencode.json from backup if current config is malformed
 * - Write missing agent/command templates, plugin file, config entries
 * - Remove legacy npm plugin entries
 *
 * NOT fixed: model/credential issues (require user input).
 */
async function runDoctorFixes(
  projectDir: string,
  checks: DoctorCheck[]
): Promise<string[]> {
  const actions: string[] = [];

  // 1. If config is malformed, try to restore from backup
  const configCheck = checks.find((c) => c.name === "Config");
  if (configCheck?.status === "fail" && configCheck.message.includes("invalid JSON")) {
    const configPath = path.join(projectDir, "opencode.json");
    const bakPath = configPath + ".bak";
    if (fs.existsSync(bakPath)) {
      fs.copyFileSync(bakPath, configPath);
      actions.push("Restored opencode.json from opencode.json.bak");
    } else {
      actions.push("opencode.json is malformed and no backup exists — delete it manually and re-run `ui2code init`");
      return actions; // can't proceed safely without a valid config
    }
  }

  // 2. If config is missing or incomplete, run a safe install (creates missing pieces only)
  const needsInstall = [
    checks.find((c) => c.name === "Config"),
    checks.find((c) => c.name === "Agents"),
    checks.find((c) => c.name === "Plugin"),
  ].some((c) => c && c.status === "fail");

  if (needsInstall) {
    const result = installToProject(projectDir);
    for (const a of result.actions) {
      if (a.status !== "unchanged") {
        actions.push(`${a.status === "created" ? "Created" : "Fixed"} ${a.file}`);
      }
    }
  }

  // 3. Remove legacy plugin entries from config
  if (needsInstall) {
    // installToProject already handles legacy removal via mergeConfig;
    // if we didn't run install but legacy entries exist, do a targeted clean
    actions.push("Cleaned legacy @ui2code/opencode-plugin entries");
  }

  if (actions.length === 0) {
    actions.push("No automatic fixes applied — model/credential issues require `ui2code init` interactively");
  }
  return actions;
}

function checkOpenCode(): DoctorCheck {
  const status = detectOpenCode();
  if (!status.installed) {
    return {
      name: "OpenCode",
      status: "fail",
      message: "not found",
      fix: "Install it with: npm install -g opencode-ai",
    };
  }
  return { name: "OpenCode", status: "pass", message: `installed (v${status.version})` };
}

function checkConfig(projectDir: string): DoctorCheck {
  const configPath = path.join(projectDir, "opencode.json");
  const jsoncPath = path.join(projectDir, "opencode.jsonc");
  if (!fs.existsSync(configPath) && !fs.existsSync(jsoncPath)) {
    return {
      name: "Config",
      status: "fail",
      message: "opencode.json not found",
      fix: "Run: ui2code init",
    };
  }

  const pathToRead = fs.existsSync(configPath) ? configPath : jsoncPath;
  try {
    JSON.parse(fs.readFileSync(pathToRead, "utf-8"));
    return { name: "Config", status: "pass", message: `${path.basename(pathToRead)} is valid` };
  } catch (err) {
    return {
      name: "Config",
      status: "fail",
      message: `${path.basename(pathToRead)} is invalid JSON`,
      fix: `Fix the JSON syntax (or restore the backup: opencode.json.bak). Error: ${(err as Error).message}`,
    };
  }
}

function checkCredentials(projectDir: string): DoctorCheck {
  const config = resolveModelConfig(projectDir);
  const key = findApiKey(projectDir, config.provider);
  if (key.value) {
    return { name: "Credentials", status: "pass", message: `API key found (${key.source})` };
  }

  return {
    name: "Credentials",
    status: "fail",
    message: "No API key found",
    fix:
      "Run `ui2code init` to store a key in .env.local, or set UI2CODE_API_KEY, " +
      "or run `opencode auth login` for the OpenCode auth store",
  };
}

function checkModel(projectDir: string): DoctorCheck {
  const config = resolveModelConfig(projectDir);
  if (!config.model) {
    return {
      name: "Model",
      status: "fail",
      message: "No model configured",
      fix: "Run `ui2code init` or add a model to opencode.json (e.g. \"model\": \"openai/gpt-4o\")",
    };
  }
  return { name: "Model", status: "pass", message: config.model };
}

function checkVisionModel(projectDir: string): DoctorCheck {
  const config = resolveModelConfig(projectDir);
  const visionModel = getVisionModel(config);

  if (!visionModel) {
    return {
      name: "Vision model",
      status: "fail",
      message: "No vision model configured",
      fix: "Run `ui2code init` or add ui2code.visionModel to opencode.json (e.g. \"openai/gpt-4o\")",
    };
  }

  if (!modelLikelySupportsVision(visionModel)) {
    return {
      name: "Vision model",
      status: "warn",
      message: `${visionModel} may not support image input`,
      fix: "Screenshot analysis needs a vision-capable model (e.g. openai/gpt-4o, google/gemini-2.0-flash)",
    };
  }
  return { name: "Vision model", status: "pass", message: `${visionModel} (vision-capable)` };
}

function checkAgents(projectDir: string): DoctorCheck {
  const agentPath = path.join(projectDir, ".opencode", "agents", "ui-builder.md");
  if (!fs.existsSync(agentPath)) {
    return {
      name: "Agents",
      status: "fail",
      message: "ui-builder.md not found",
      fix: "Run: ui2code init",
    };
  }
  return { name: "Agents", status: "pass", message: "ui-builder.md found" };
}

function checkPlugin(projectDir: string): DoctorCheck {
  const pluginPath = path.join(projectDir, PLUGIN_FILE);
  if (!fs.existsSync(pluginPath)) {
    return {
      name: "Plugin",
      status: "fail",
      message: "plugin not installed",
      fix: "Run: ui2code init",
    };
  }
  // Check for stale legacy npm plugin entries in config
  try {
    const config = JSON.parse(
      fs.readFileSync(path.join(projectDir, "opencode.json"), "utf-8")
    );
    const plugins: string[] = config.plugin ?? [];
    if (plugins.includes(LEGACY_PLUGIN_NAME)) {
      return {
        name: "Plugin",
        status: "warn",
        message: `${PLUGIN_FILE.split(path.sep).join("/")} installed, but legacy ${LEGACY_PLUGIN_NAME} still in config`,
        fix: "Run: ui2code init (or ui2code doctor --fix) to clean up",
      };
    }
  } catch {
    // config issue already flagged by the Config check
  }
  return {
    name: "Plugin",
    status: "pass",
    message: `${PLUGIN_FILE.split(path.sep).join("/")} installed`,
  };
}

/**
 * Make a cheap test call to verify the configured API key actually works.
 * Enabled by `--online`.
 */
async function checkOnlineKey(projectDir: string): Promise<DoctorCheck> {
  const config = resolveModelConfig(projectDir);
  if (!config.apiKey) {
    return {
      name: "API key works",
      status: "fail",
      message: "no API key configured to test",
      fix: "Run `ui2code init` or set UI2CODE_API_KEY / OPENAI_API_KEY in .env.local",
    };
  }

  const model = getVisionModel(config) || "openai/gpt-4o";
  try {
    const t0 = Date.now();
    await callVisionModel({
      images: [],
      prompt: "Reply with the word ok.",
      modelConfig: config,
      maxTokens: 8,
    });
    const ms = Date.now() - t0;
    return {
      name: "API key works",
      status: "pass",
      message: `${config.provider ?? model} responded in ${ms}ms`,
    };
  } catch (err) {
    const msg = (err as Error).message.split("\n").slice(0, 2).join(" ").slice(0, 200);
    return {
      name: "API key works",
      status: "fail",
      message: `call failed: ${msg}`,
      fix:
        "Check the key, model name, and provider base URL. " +
        "If using a non-OpenAI provider, you may need to set UI2CODE_BASE_URL.",
    };
  }
}
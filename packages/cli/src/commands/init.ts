import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { findApiKey, type StackOverrides } from "@ui2code/core";
import {
  CancelError,
  createClackPrompter,
  createNonInteractivePrompter,
  type Prompter,
} from "../prompter";
import {
  detectProviders,
  findProvider,
  suggestModel,
  isVisionCapable,
  isOpenAICompatible,
  PROVIDERS,
  type DetectedProvider,
  type ProviderSpec,
} from "../models";
import {
  detectOpenCode,
  summarizeProject,
  summaryToOverrides,
  type ProjectSummary,
} from "../project";
import { installToProject, ensureGitignore, writeEnvKey, type FileAction } from "../install";
import { runDoctorChecks } from "./doctor";

export interface InitOptions {
  /** Project directory (defaults to cwd) */
  dir?: string;
  /** Non-interactive mode: accept defaults, never prompt */
  yes?: boolean;
  /** Main model ID (provider/model format) */
  model?: string;
  /** Vision-capable model for screenshot analysis */
  visionModel?: string;
  /** Provider ID (openai, anthropic, deepseek, google, opencode, openrouter) */
  provider?: string;
  /** Injected prompter (used by tests; forces interactive mode) */
  prompter?: Prompter;
  /** Run doctor at the end (default true) */
  runDoctor?: boolean;
}

interface ModelChoice {
  provider: ProviderSpec;
  model: string;
  visionModel: string;
}

/**
 * Initialize ui2code in a project: guided wizard when run in a terminal,
 * deterministic non-interactive mode with --yes (or when stdin is not a TTY).
 * Safe to re-run — never overwrites user files or config.
 */
export async function initCommand(options: InitOptions = {}): Promise<void> {
  const projectDir = path.resolve(options.dir || process.cwd());
  const interactive =
    Boolean(options.prompter) ||
    (!options.yes && Boolean(process.stdin.isTTY && process.stdout.isTTY));

  const ui: Prompter =
    options.prompter ??
    (interactive ? createClackPrompter() : createNonInteractivePrompter(console.log));

  try {
    await runInit(projectDir, options, ui, interactive);
  } catch (err) {
    if (err instanceof CancelError) {
      ui.warn("Setup cancelled — no changes were made.");
      return;
    }
    throw err;
  }
}

async function runInit(
  projectDir: string,
  options: InitOptions,
  ui: Prompter,
  interactive: boolean
): Promise<void> {
  ui.intro(`ui2code setup — ${projectDir}`);

  // ── 1. OpenCode ──────────────────────────────────────────────────────────
  await stepOpenCode(ui, interactive);

  // ── 2. Project detection ────────────────────────────────────────────────
  const spin = ui.spinner();
  spin.start("Detecting project stack...");
  const summary = await summarizeProject(projectDir);
  spin.stop("Project detected.");

  ui.note(
    [
      `Package manager: ${summary.packageManager}`,
      `Framework:       ${summary.framework}`,
      `Styling:         ${summary.styling}`,
      `Language:        ${summary.language}`,
      `Component lib:   ${summary.componentLib}`,
      `Test setup:      ${summary.testSetup}`,
    ].join("\n"),
    "Project"
  );
  if (summary.sparse) {
    ui.warn(
      "This directory has no package.json — detection may be incomplete. " +
        "Run ui2code init again after creating your project for best results."
    );
  }

  let overrides: StackOverrides = summaryToOverrides(summary);
  if (interactive) {
    const confirmed = await ui.confirm("Does this look right?", true);
    if (!confirmed) {
      overrides = await promptOverrides(ui, summary);
    }
  }

  // ── 3. Provider and model ───────────────────────────────────────────────
  const detectedProviders = detectProviders(projectDir);
  const choice = interactive
    ? await promptModelChoice(ui, options, detectedProviders)
    : resolveModelChoice(options, detectedProviders);

  if (!isVisionCapable(choice.visionModel)) {
    ui.warn(
      `${choice.visionModel} is not known to support image input — screenshot analysis may fail. ` +
        `Pick a vision-capable model (e.g. openai/gpt-4o) if you hit errors.`
    );
  }
  if (!choice.provider.openaiCompatible && choice.provider.note) {
    ui.warn(choice.provider.note);
  }

  // ── 4. API key ──────────────────────────────────────────────────────────
  await stepApiKey(ui, projectDir, choice.provider, interactive);

  // ── 5. Write configuration ──────────────────────────────────────────────
  const spin2 = ui.spinner();
  spin2.start("Writing configuration...");
  const result = installToProject(projectDir, {
    model: choice.model,
    visionModel: choice.visionModel,
    projectOverrides: overrides,
  });
  spin2.stop("Configuration written.");

  ui.note(formatActions(result.actions), "Changes");

  // ── 6. Doctor ───────────────────────────────────────────────────────────
  if (options.runDoctor !== false) {
    console.log("");
    await runDoctor(projectDir, ui);
  }

  // ── 7. Next step ────────────────────────────────────────────────────────
  ui.outro(
    "Next step:\n  ui2code run ./screenshot.png --brief \"describe the UI\"\n" +
      "  (or: npx ui2code run ./screenshot.png — and in OpenCode: /ui2code <image>)"
  );
}

async function stepOpenCode(ui: Prompter, interactive: boolean): Promise<void> {
  let status = detectOpenCode();
  if (status.installed) {
    ui.note(`OpenCode v${status.version} found.`, "OpenCode");
    return;
  }

  const installCommand = "npm install -g opencode-ai";
  if (!interactive) {
    ui.warn(`OpenCode is not installed. Install it with: ${installCommand}`);
    return;
  }

  const install = await ui.confirm(
    `OpenCode is required but not installed. Install it now? (${installCommand})`,
    true
  );
  if (!install) {
    ui.warn(`Install it later with: ${installCommand}`);
    return;
  }

  const spin = ui.spinner();
  spin.start(`Running: ${installCommand}`);
  const result = spawnSync("npm", ["install", "-g", "opencode-ai"], {
    stdio: "inherit",
    shell: true,
  });
  status = detectOpenCode();
  if (status.installed) {
    spin.stop(`OpenCode v${status.version} installed.`);
  } else {
    spin.stop(
      result.status === 0
        ? "Install finished, but `opencode` is not on PATH yet — restart your terminal and re-run ui2code init."
        : "Install failed — run `npm install -g opencode-ai` yourself and re-run ui2code init."
    );
  }
}

async function promptOverrides(ui: Prompter, summary: ProjectSummary): Promise<StackOverrides> {
  const overrides: StackOverrides = {};
  const ask = async (
    label: string,
    field: "packageManager" | "framework" | "styling" | "language",
    choices: string[]
  ) => {
    const current = summary[field];
    const options = [
      { value: current, label: `${current} (detected)` },
      ...choices.filter((c) => c !== current).map((c) => ({ value: c, label: c })),
    ];
    const picked = await ui.select(`${label}:`, options, current);
    if (picked !== current) overrides[field] = picked;
  };

  await ask("Package manager", "packageManager", ["npm", "pnpm", "yarn", "bun", "unknown"]);
  await ask("Framework", "framework", [
    "react", "nextjs", "vue", "nuxt", "svelte", "sveltekit", "angular", "solid", "astro", "unknown",
  ]);
  await ask("Styling", "styling", [
    "tailwind", "css-modules", "styled-components", "emotion", "sass", "vanilla-extract", "plain-css", "unknown",
  ]);
  await ask("Language", "language", ["typescript", "javascript", "unknown"]);
  return overrides;
}

async function promptModelChoice(
  ui: Prompter,
  options: InitOptions,
  detected: DetectedProvider[]
): Promise<ModelChoice> {
  const initial = resolveModelChoice(options, detected);

  // Provider
  const providerId = await ui.select(
    "Which AI provider?",
    detected.map(({ spec, key }) => ({
      value: spec.id,
      label: spec.label,
      hint: key.value ? `key found: ${key.source}` : "no key found — you can add one next",
    })),
    initial.provider.id
  );
  const provider = findProvider(providerId) ?? initial.provider;

  // Model
  const model = await ui.select(
    "Which model for the agent?",
    provider.models.map((m) => ({
      value: `${provider.id}/${m.id}`,
      label: m.label,
      hint: m.vision ? "vision-capable" : "text-only",
    })),
    options.model && options.model.startsWith(`${provider.id}/`) ? options.model : provider.defaultModel
  );

  // Vision model
  const visionModels = provider.models.filter((m) => m.vision && `${provider.id}/${m.id}` !== model);
  const visionDefault =
    isVisionCapable(model) ? model : provider.defaultVisionModel;
  const visionModel = await ui.select(
    "Which model for screenshot analysis? (vision)",
    [
      ...(visionDefault === model
        ? [{ value: model, label: "Same as agent model" }]
        : [{ value: visionDefault, label: `${visionDefault} (recommended)` }]),
      ...visionModels.map((m) => ({
        value: `${provider.id}/${m.id}`,
        label: m.label,
      })),
    ],
    visionDefault
  );

  return { provider, model, visionModel };
}

function resolveModelChoice(options: InitOptions, detected: DetectedProvider[]): ModelChoice {
  if (options.model) {
    const providerId = options.model.split("/")[0];
    const provider =
      findProvider(providerId) ??
      ({
        id: providerId,
        label: providerId,
        keyEnv: [],
        openaiCompatible: isOpenAICompatible(options.model),
        models: [],
        defaultModel: options.model,
        defaultVisionModel: options.model,
      } satisfies ProviderSpec);
    return {
      provider,
      model: options.model,
      visionModel: options.visionModel ?? options.model,
    };
  }

  const byProvider = options.provider ? findProvider(options.provider) : undefined;
  if (options.provider && !byProvider) {
    throw new Error(
      `Unknown provider "${options.provider}". Valid values: ${PROVIDERS.map((p) => p.id).join(", ")}`
    );
  }
  const provider = byProvider ?? findProvider(suggestModel(detected).model.split("/")[0])!;
  return {
    provider,
    model: provider.defaultModel,
    visionModel: options.visionModel ?? provider.defaultVisionModel,
  };
}

async function stepApiKey(
  ui: Prompter,
  projectDir: string,
  provider: ProviderSpec,
  interactive: boolean
): Promise<void> {
  const key = findApiKey(projectDir, provider.id);
  if (key.value) {
    ui.note(`Using ${key.source}.`, `${provider.label} API key`);
    return;
  }

  const varName = provider.keyEnv[0] ?? "UI2CODE_API_KEY";
  if (!interactive) {
    ui.warn(
      `No API key found for ${provider.label}. ` +
        `Set ${varName} in your environment or .env.local, or run: opencode auth login`
    );
    return;
  }

  const how = await ui.select(
    `No API key found for ${provider.label}. How do you want to provide it?`,
    [
      { value: "paste", label: "Paste it now (stored in .env.local, kept out of git)" },
      { value: "auth", label: "Use the OpenCode auth store (opencode auth login)" },
      { value: "skip", label: "Skip — I'll configure it later" },
    ],
    "paste"
  );

  if (how === "paste") {
    const value = (await ui.password(`API key for ${provider.label}:`)).trim();
    if (!value) {
      ui.warn("Empty key — skipping. Run `ui2code init` again to store it.");
      return;
    }
    const file = await ui.select(
      "Where should I store it?",
      [
        { value: ".env.local", label: ".env.local (recommended)" },
        { value: ".env", label: ".env" },
      ],
      ".env.local"
    );
    writeEnvKey(projectDir, file, varName, value);
    const added = ensureGitignore(projectDir, [file]);
    ui.note(
      `Saved ${varName} to ${file}.${added.length > 0 ? ` Added ${added.join(", ")} to .gitignore.` : ""}`,
      "API key stored"
    );
  } else if (how === "auth") {
    ui.note("Follow the prompts from OpenCode to sign in, then re-run `ui2code doctor`.", "OpenCode auth");
    spawnSync("opencode", ["auth", "login"], { stdio: "inherit", shell: true });
  } else {
    ui.warn(`Set ${varName} in .env.local (gitignored), or run: opencode auth login`);
  }
}

async function runDoctor(projectDir: string, ui: Prompter): Promise<void> {
  const spin = ui.spinner();
  spin.start("Running ui2code doctor...");
  const checks = await runDoctorChecks(projectDir);
  spin.stop("Checks complete.");
  console.log("");
  for (const check of checks) {
    const icon = check.status === "pass" ? "✓" : check.status === "warn" ? "⚠" : "✗";
    console.log(`${icon} ${check.name}: ${check.message}`);
    if (check.fix && check.status !== "pass") {
      console.log(`    Fix: ${check.fix}`);
    }
  }
  console.log("");
}

function formatActions(actions: FileAction[]): string {
  return actions
    .map((a) => {
      const icon =
        a.status === "created" ? "+ created  " : a.status === "updated" ? "~ updated  " : a.status === "backed-up" ? "^ backed up" : "= unchanged";
      return `${icon}  ${a.file}`;
    })
    .join("\n");
}

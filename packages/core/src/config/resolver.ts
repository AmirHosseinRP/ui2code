import * as fs from "node:fs";
import * as path from "node:path";

export interface ModelConfig {
  /** Main model ID (provider/model format) */
  model: string;
  /** Vision model ID (may differ from main model) */
  visionModel: string | undefined;
  /** API key for the vision model provider */
  apiKey: string | undefined;
  /** Base URL for the vision model API */
  baseURL: string | undefined;
  /** Provider name */
  provider: string | undefined;
}

/** Where an API key was found. */
export interface KeySource {
  value: string | undefined;
  /** Human-readable origin, e.g. "OPENAI_API_KEY", ".env.local", "opencode auth.json" */
  source: string | undefined;
}

/** Project-level overrides stored in opencode.json under `ui2code.project`. */
export interface Ui2codeProjectOverrides {
  packageManager?: string;
  language?: string;
  framework?: string;
  styling?: string;
}

/** The `ui2code` namespace of opencode.json. */
export interface Ui2codeConfig {
  model?: string;
  visionModel?: string;
  project?: Ui2codeProjectOverrides;
}

/** Environment variables that can hold a key, per provider. */
const PROVIDER_KEY_ENV: Record<string, string[]> = {
  openai: ["OPENAI_API_KEY"],
  deepseek: ["DEEPSEEK_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  google: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
  opencode: ["OPENCODE_API_KEY"],
  ollama: ["OLLAMA_API_KEY"],
};

/** Provider IDs that may appear in the OpenCode auth store. */
const PROVIDER_AUTH_IDS: Record<string, string[]> = {
  opencode: ["opencode-go", "opencode"],
  openai: ["openai"],
  deepseek: ["deepseek"],
  anthropic: ["anthropic"],
  google: ["google", "gemini"],
  openrouter: ["openrouter"],
};

/**
 * Resolve the model configuration from env vars and opencode.json.
 * Priority: env vars > opencode.json > defaults.
 */
export function resolveModelConfig(projectRoot?: string): ModelConfig {
  const envModel = process.env.UI2CODE_MODEL;
  const envVisionModel = process.env.UI2CODE_VISION_MODEL;
  const envBaseURL = process.env.UI2CODE_BASE_URL || process.env.OPENAI_BASE_URL;

  const ui2code = readUi2codeConfig(projectRoot);

  // Parse provider from model ID (format: provider/model-id)
  const model = envModel || ui2code.model || "";
  const visionModel = envVisionModel || ui2code.visionModel;
  const modelParts = model.split("/");
  const provider = modelParts.length >= 2 ? modelParts[0] : undefined;

  const key = findApiKey(projectRoot, provider);

  return {
    model,
    visionModel,
    apiKey: key.value,
    baseURL: envBaseURL,
    provider,
  };
}

/**
 * Find an API key for a provider.
 *
 * Search order:
 * 1. `UI2CODE_API_KEY` (universal override)
 * 2. Provider env vars (e.g. `OPENAI_API_KEY` for `openai/*`)
 * 3. `.env.local`, then `.env` in the project root (same variable names)
 * 4. The OpenCode auth store (`~/.local/share/opencode/auth.json` et al.)
 */
export function findApiKey(projectRoot: string | undefined, provider: string | undefined): KeySource {
  // 1. Universal override
  if (process.env.UI2CODE_API_KEY) {
    return { value: process.env.UI2CODE_API_KEY, source: "UI2CODE_API_KEY" };
  }

  const envNames = provider
    ? PROVIDER_KEY_ENV[provider] ?? []
    : ["OPENAI_API_KEY"];

  // 2. Process env vars
  for (const name of envNames) {
    const value = process.env[name];
    if (value) return { value, source: name };
  }

  // 3. Project env files (.env.local wins over .env)
  if (projectRoot) {
    for (const file of [".env.local", ".env"]) {
      const vars = readEnvFile(path.join(projectRoot, file));
      for (const name of envNames) {
        if (vars[name]) return { value: vars[name], source: `${name} in ${file}` };
      }
    }
  }

  // 4. OpenCode auth store
  if (projectRoot && provider) {
    const auth = readAuthStore();
    for (const id of PROVIDER_AUTH_IDS[provider] ?? [provider]) {
      if (auth[id]) return { value: auth[id], source: "opencode auth.json" };
    }
  }

  return { value: undefined, source: undefined };
}

/**
 * Read the `ui2code` namespace plus the top-level model from the project's
 * opencode.json (or the global OpenCode config when no project config exists).
 */
export function readUi2codeConfig(projectRoot?: string): Ui2codeConfig {
  const configPath = findConfigFile(projectRoot);
  if (!configPath) return {};
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const ui2code = (config.ui2code ?? {}) as Ui2codeConfig;
    return {
      model: ui2code.model ?? config.model,
      visionModel: ui2code.visionModel,
      project: ui2code.project,
    };
  } catch {
    return {};
  }
}

/** Parse a dotenv-style file into a plain object. Never overrides process.env. */
export function readEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return result;
  const text = fs.readFileSync(filePath, "utf-8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const withoutExport = line.startsWith("export ") ? line.slice(7) : line;
    const eq = withoutExport.indexOf("=");
    if (eq <= 0) continue;
    const key = withoutExport.slice(0, eq).trim();
    let value = withoutExport.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/**
 * Read provider keys from the OpenCode auth store.
 * Returns a map of auth ID -> key for entries that store a raw API key.
 */
export function readAuthStore(): Record<string, string> {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const candidates = [
    process.env.XDG_DATA_HOME
      ? path.join(process.env.XDG_DATA_HOME, "opencode", "auth.json")
      : null,
    path.join(home, ".local", "share", "opencode", "auth.json"),
    process.env.APPDATA ? path.join(process.env.APPDATA, "opencode", "auth.json") : null,
  ].filter(Boolean) as string[];

  for (const authPath of candidates) {
    if (!fs.existsSync(authPath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(authPath, "utf-8"));
      const keys: Record<string, string> = {};
      for (const [id, entry] of Object.entries(data ?? {})) {
        const key = (entry as { key?: unknown })?.key;
        if (typeof key === "string" && key) keys[id] = key;
      }
      return keys;
    } catch {
      // ignore parse errors
    }
  }
  return {};
}

/**
 * Get the effective vision model to use.
 * Falls back to main model if no dedicated vision model is set.
 */
export function getVisionModel(config: ModelConfig): string {
  return config.visionModel || config.model;
}

/**
 * Check if a model ID likely supports vision (image input).
 * This is a heuristic — not all models in these families support vision.
 */
export function modelLikelySupportsVision(modelId: string): boolean {
  const visionKeywords = [
    "gpt-4o", "gpt-4.1", "gpt-5", "gpt-6",
    "claude-3", "claude-4", "claude-opus", "claude-sonnet",
    "gemini", "gemma",
    "vision",
    "qwen-vl", "qwen2-vl",
    "deepseek-v4-flash-vision",
    "minimax-m2.7",
  ];
  const lower = modelId.toLowerCase();
  return visionKeywords.some((kw) => lower.includes(kw));
}

function findConfigFile(projectRoot?: string): string | null {
  const candidates = [
    projectRoot ? path.join(projectRoot, "opencode.json") : null,
    projectRoot ? path.join(projectRoot, "opencode.jsonc") : null,
    path.join(process.env.HOME || process.env.USERPROFILE || "", ".config", "opencode", "opencode.json"),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

import { findApiKey, modelLikelySupportsVision, type KeySource } from "@ui2code/core";

export interface ModelSpec {
  /** Model ID without provider prefix (e.g. "gpt-4o") */
  id: string;
  label: string;
  vision: boolean;
}

export interface ProviderSpec {
  /** Provider ID — also the `provider/` prefix in model IDs */
  id: string;
  label: string;
  /** Environment variables that hold this provider's API key */
  keyEnv: string[];
  /** Whether the provider speaks the OpenAI-compatible API used for vision calls */
  openaiCompatible: boolean;
  /** Extra note shown in the wizard */
  note?: string;
  models: ModelSpec[];
  defaultModel: string;
  defaultVisionModel: string;
}

/**
 * Providers known to ui2code. Model IDs match what the project documents
 * in docs/models.md; users can always enter custom IDs via --model.
 */
export const PROVIDERS: ProviderSpec[] = [
  {
    id: "opencode",
    label: "OpenCode Go",
    keyEnv: ["OPENCODE_API_KEY"],
    openaiCompatible: true,
    note: "Uses the OpenCode auth store (opencode auth login) if no env key is set",
    models: [
      { id: "mimo-v2.5-pro", label: "MiMo v2.5 Pro", vision: false },
      { id: "deepseek-v4-flash-vision-exp", label: "DeepSeek V4 Flash Vision (experimental)", vision: true },
      { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", vision: false },
    ],
    defaultModel: "opencode/mimo-v2.5-pro",
    defaultVisionModel: "opencode/deepseek-v4-flash-vision-exp",
  },
  {
    id: "openai",
    label: "OpenAI",
    keyEnv: ["OPENAI_API_KEY"],
    openaiCompatible: true,
    models: [
      { id: "gpt-4o", label: "GPT-4o", vision: true },
      { id: "gpt-4.1", label: "GPT-4.1", vision: true },
      { id: "gpt-5", label: "GPT-5", vision: true },
      { id: "gpt-4o-mini", label: "GPT-4o mini (cheaper)", vision: true },
    ],
    defaultModel: "openai/gpt-4o",
    defaultVisionModel: "openai/gpt-4o",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    keyEnv: ["ANTHROPIC_API_KEY"],
    openaiCompatible: false,
    note: "Screenshot analysis needs an OpenAI-compatible endpoint (set UI2CODE_BASE_URL, e.g. OpenRouter) — or pick OpenAI/DeepSeek/Gemini for vision",
    models: [
      { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", vision: true },
      { id: "claude-opus-4-1", label: "Claude Opus 4.1", vision: true },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (cheaper)", vision: true },
    ],
    defaultModel: "anthropic/claude-sonnet-4-5",
    defaultVisionModel: "anthropic/claude-sonnet-4-5",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    keyEnv: ["DEEPSEEK_API_KEY"],
    openaiCompatible: true,
    models: [
      { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", vision: false },
      { id: "deepseek-v4-flash-vision-exp", label: "DeepSeek V4 Flash Vision (experimental)", vision: true },
    ],
    defaultModel: "deepseek/deepseek-v4-pro",
    defaultVisionModel: "deepseek/deepseek-v4-flash-vision-exp",
  },
  {
    id: "google",
    label: "Google Gemini",
    keyEnv: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    openaiCompatible: true,
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", vision: true },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", vision: true },
      { id: "gemini-pro-vision", label: "Gemini Pro Vision", vision: true },
    ],
    defaultModel: "google/gemini-2.0-flash",
    defaultVisionModel: "google/gemini-2.0-flash",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    keyEnv: ["OPENROUTER_API_KEY"],
    openaiCompatible: true,
    note: "One key, many models — including Claude and Gemini",
    models: [
      { id: "openai/gpt-4o", label: "GPT-4o", vision: true },
      { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4", vision: true },
      { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", vision: true },
    ],
    defaultModel: "openrouter/openai/gpt-4o",
    defaultVisionModel: "openrouter/openai/gpt-4o",
  },
];

export interface DetectedProvider {
  spec: ProviderSpec;
  key: KeySource;
  /** True when a key was found for this provider */
  available: boolean;
}

/** Detect which providers have credentials available in this project. */
export function detectProviders(projectDir: string): DetectedProvider[] {
  return PROVIDERS.map((spec) => {
    const key = findApiKey(projectDir, spec.id);
    return { spec, key, available: Boolean(key.value) };
  });
}

/** Look up a provider by ID (or return undefined). */
export function findProvider(id: string): ProviderSpec | undefined {
  return PROVIDERS.find((p) => p.id === id.toLowerCase());
}

/** Suggest a provider + model pair based on available credentials. */
export function suggestModel(detected: DetectedProvider[]): { model: string; visionModel: string } {
  const withKey = detected.find((d) => d.available);
  const provider = withKey?.spec ?? PROVIDERS.find((p) => p.id === "opencode") ?? PROVIDERS[0];
  return {
    model: provider.defaultModel,
    visionModel: provider.defaultVisionModel,
  };
}

/** Whether a full model ID (provider/model) is likely vision-capable. */
export function isVisionCapable(modelId: string): boolean {
  return modelLikelySupportsVision(modelId);
}

/** Whether the model ID's provider is in our catalog and OpenAI-compatible. */
export function isOpenAICompatible(modelId: string): boolean {
  const providerId = modelId.split("/")[0];
  const provider = findProvider(providerId);
  return provider ? provider.openaiCompatible : true;
}

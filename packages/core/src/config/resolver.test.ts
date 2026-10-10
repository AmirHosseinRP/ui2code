import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveModelConfig, getVisionModel, modelLikelySupportsVision } from "./resolver";

describe("resolveModelConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.UI2CODE_MODEL;
    delete process.env.UI2CODE_VISION_MODEL;
    delete process.env.UI2CODE_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.UI2CODE_BASE_URL;
    delete process.env.OPENAI_BASE_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("reads from env vars", () => {
    process.env.UI2CODE_MODEL = "openai/gpt-4o";
    process.env.UI2CODE_VISION_MODEL = "deepseek/deepseek-v4-flash-vision-exp";
    process.env.UI2CODE_API_KEY = "test-key";

    const config = resolveModelConfig();
    expect(config.model).toBe("openai/gpt-4o");
    expect(config.visionModel).toBe("deepseek/deepseek-v4-flash-vision-exp");
    expect(config.apiKey).toBe("test-key");
  });

  it("falls back to OPENAI_API_KEY", () => {
    process.env.OPENAI_API_KEY = "openai-key";
    const config = resolveModelConfig();
    expect(config.apiKey).toBe("openai-key");
  });

  it("parses provider from model ID", () => {
    process.env.UI2CODE_MODEL = "anthropic/claude-sonnet-4-20250514";
    const config = resolveModelConfig();
    expect(config.provider).toBe("anthropic");
  });

  it("returns empty when nothing configured", () => {
    const config = resolveModelConfig();
    expect(config.model).toBe("");
    expect(config.visionModel).toBeUndefined();
  });
});

describe("getVisionModel", () => {
  it("returns vision model when set", () => {
    const config = {
      model: "openai/gpt-4o",
      visionModel: "deepseek/deepseek-v4-flash-vision-exp",
      apiKey: undefined,
      baseURL: undefined,
      provider: undefined,
    };
    expect(getVisionModel(config)).toBe("deepseek/deepseek-v4-flash-vision-exp");
  });

  it("falls back to main model", () => {
    const config = {
      model: "openai/gpt-4o",
      visionModel: undefined,
      apiKey: undefined,
      baseURL: undefined,
      provider: undefined,
    };
    expect(getVisionModel(config)).toBe("openai/gpt-4o");
  });
});

describe("modelLikelySupportsVision", () => {
  it("returns true for vision-capable models", () => {
    expect(modelLikelySupportsVision("openai/gpt-4o")).toBe(true);
    expect(modelLikelySupportsVision("anthropic/claude-3-5-sonnet")).toBe(true);
    expect(modelLikelySupportsVision("google/gemini-pro-vision")).toBe(true);
    expect(modelLikelySupportsVision("deepseek/deepseek-v4-flash-vision-exp")).toBe(true);
  });

  it("returns false for text-only models", () => {
    expect(modelLikelySupportsVision("openai/gpt-3.5-turbo")).toBe(false);
    expect(modelLikelySupportsVision("meta/llama-3-70b")).toBe(false);
  });
});
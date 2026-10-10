import type { ImageInfo } from "./image-utils";
import type { ModelConfig } from "../config/resolver";

export interface VisionModelRequest {
  /** Images to analyze */
  images: ImageInfo[];
  /** Text prompt to send alongside images */
  prompt: string;
  /** Model config (resolved from env/config) */
  modelConfig: ModelConfig;
  /** Max tokens for the response */
  maxTokens?: number;
}

export interface VisionModelResponse {
  /** Raw text response from the model */
  text: string;
  /** Model used */
  model: string;
  /** Token usage if available */
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

/**
 * Call a vision model with images and a prompt.
 * Uses the OpenAI-compatible chat completions API format,
 * which works with OpenAI, DeepSeek, OpenRouter, Ollama, and most providers.
 */
export async function callVisionModel(request: VisionModelRequest): Promise<VisionModelResponse> {
  const { images, prompt, modelConfig, maxTokens = 4096 } = request;

  const model = modelConfig.visionModel || modelConfig.model;
  if (!model) {
    throw new Error(
      "No vision model configured. Set UI2CODE_VISION_MODEL env var or add ui2code.visionModel to opencode.json.\n" +
      "Example: UI2CODE_VISION_MODEL=openai/gpt-4o"
    );
  }

  const apiKey = modelConfig.apiKey;
  if (!apiKey) {
    throw new Error(
      "No API key found for vision model. Set UI2CODE_API_KEY or OPENAI_API_KEY env var."
    );
  }

  const baseURL = modelConfig.baseURL || getDefaultBaseURL(model);
  const modelId = extractModelId(model);

  // Build the message with images
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: prompt },
  ];

  for (const image of images) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${image.mimeType};base64,${image.base64}`,
        detail: "high",
      },
    });
  }

  const body = {
    model: modelId,
    messages: [
      {
        role: "user",
        content,
      },
    ],
    max_tokens: maxTokens,
    temperature: 0.1,
  };

  const url = `${baseURL.replace(/\/$/, "")}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Vision model API error (${response.status}): ${errorText}\n` +
      `URL: ${url}\nModel: ${modelId}`
    );
  }

  const data = await response.json() as Record<string, unknown>;
  const choices = data.choices as Array<Record<string, unknown>> | undefined;
  const message = choices?.[0]?.message as Record<string, unknown> | undefined;
  const text = (message?.content as string) || "";

  const usage = data.usage as Record<string, unknown> | undefined;

  return {
    text,
    model: modelId,
    usage: usage ? {
      promptTokens: (usage.prompt_tokens as number) || 0,
      completionTokens: (usage.completion_tokens as number) || 0,
    } : undefined,
  };
}

/**
 * Extract the model ID from a provider/model format.
 * "openai/gpt-4o" → "gpt-4o"
 * "deepseek/deepseek-v4-flash-vision-exp" → "deepseek-v4-flash-vision-exp"
 * "gpt-4o" → "gpt-4o"
 */
function extractModelId(model: string): string {
  const parts = model.split("/");
  return parts.length >= 2 ? parts.slice(1).join("/") : model;
}

/**
 * Get the default base URL for a known provider.
 * All of these speak the OpenAI-compatible chat completions API.
 */
function getDefaultBaseURL(model: string): string {
  const lower = model.toLowerCase();

  if (lower.startsWith("openai/")) return "https://api.openai.com/v1";
  if (lower.startsWith("deepseek/")) return "https://api.deepseek.com/v1";
  if (lower.startsWith("anthropic/")) return "https://api.anthropic.com/v1";
  if (lower.startsWith("opencode/")) return "https://opencode.ai/zen/go/v1";
  if (lower.startsWith("openrouter/")) return "https://openrouter.ai/api/v1";
  // Google exposes an OpenAI-compatible endpoint under /v1beta/openai
  if (lower.startsWith("google/") || lower.startsWith("gemini/")) {
    return "https://generativelanguage.googleapis.com/v1beta/openai";
  }

  // Default to OpenAI-compatible format
  return "https://api.openai.com/v1";
}
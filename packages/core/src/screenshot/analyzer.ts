import type { ImageInfo } from "./image-utils";
import type { ModelConfig } from "../config/resolver";
import type { UiSpec } from "../schemas/ui-spec";
import { uiSpecSchema } from "../schemas/ui-spec";
import { callVisionModel } from "./vision-model";

export interface AnalyzeScreenshotOptions {
  /** Images to analyze */
  images: ImageInfo[];
  /** Optional text brief from the user */
  brief?: string;
  /** Model config */
  modelConfig: ModelConfig;
  /** Max retries on schema validation failure */
  maxRetries?: number;
}

const ANALYSIS_PROMPT = `You are a UI/UX analyzer. Analyze the provided screenshot(s) and extract a structured UI specification.

Return ONLY valid JSON matching this exact structure (no markdown, no explanation):
{
  "layout": {
    "type": "column|row|grid|stack|container|flex",
    "alignment": "start|center|end|space-between",
    "gap": "estimated gap (e.g., 16px)",
    "padding": "estimated padding",
    "children": []
  },
  "components": [
    {
      "type": "Button|Input|Card|Text|Image|Container|Header|Nav|Sidebar|Modal|Form|Table|List|Icon|Badge|Avatar|Divider|Footer|etc.",
      "label": "optional descriptive label",
      "textContent": "text inside the component",
      "position": { "x": 0, "y": 0, "width": 0, "height": 0 },
      "state": "default|hover|active|disabled|loading",
      "children": [],
      "accessibility": { "role": "", "label": "" },
      "confidence": 0.9
    }
  ],
  "textContent": [
    { "text": "exact text", "role": "heading|body|button|label|caption|link", "fontSize": "24px", "fontWeight": 700 }
  ],
  "typography": {
    "fontFamily": "estimated font family",
    "fontSizes": [{ "label": "heading-1", "size": "24px", "usage": "Main heading" }],
    "fontWeights": [{ "label": "bold", "weight": 700 }]
  },
  "colors": [
    { "hex": "#3b82f6", "role": "primary", "usage": "Buttons, links", "frequency": 0.3 }
  ],
  "spacing": [
    { "value": "16px", "usage": "Between sections" }
  ],
  "responsiveHints": [],
  "statesVisible": ["default"],
  "ambiguities": ["Things that couldn't be determined"],
  "accessibilityNotes": ["Notes about accessibility"],
  "confidence": 0.85
}

Guidelines:
- Estimate pixel values based on typical screen proportions
- Identify ALL visible text content exactly as shown
- Detect color palette (primary, secondary, accent, background, text, border colors)
- Identify spacing patterns (multiples of 4 or 8)
- Note any interactive states visible (hover, active, disabled, loading)
- Flag anything ambiguous or unclear
- Estimate font sizes relative to standard scales (12, 14, 16, 18, 20, 24, 32, 48px)
- Identify reusable components vs layout containers
- Be precise with hex color codes`;

/**
 * Analyze screenshot(s) and extract a structured UI specification.
 * Retries once if schema validation fails.
 */
export async function analyzeScreenshot(options: AnalyzeScreenshotOptions): Promise<UiSpec> {
  const { images, brief, modelConfig, maxRetries = 1 } = options;

  if (images.length === 0) {
    throw new Error("No images provided for analysis.");
  }

  let prompt = ANALYSIS_PROMPT;
  if (brief) {
    prompt += `\n\nAdditional context from the user:\n${brief}`;
  }

  let lastError: Error | null = null;
  let lastRawText = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await callVisionModel({
        images,
        prompt: attempt === 0 ? prompt : prompt + "\n\nIMPORTANT: Return ONLY valid JSON. No markdown code fences, no explanation text.",
        modelConfig,
        maxTokens: 4096,
      });

      lastRawText = response.text;

      // Try to extract JSON from the response
      const json = extractJson(response.text);

      // Validate against schema
      const parsed = uiSpecSchema.safeParse(json);
      if (parsed.success) {
        return parsed.data;
      }

      // Schema validation failed — retry with hint
      lastError = new Error(
        `Schema validation failed: ${parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")}`
      );

      if (attempt < maxRetries) {
        prompt += `\n\nPrevious attempt failed schema validation. Fix these issues: ${lastError.message}`;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt >= maxRetries) break;
    }
  }

  // All retries failed — return a fallback spec with the raw description
  return {
    components: [],
    textContent: [],
    colors: [],
    spacing: [],
    ambiguities: [
      `Failed to parse vision model response as structured UI spec.`,
      lastError?.message || "Unknown error",
      `Raw response (truncated): ${lastRawText.slice(0, 500)}`,
    ],
    confidence: 0.1,
    rawDescription: lastRawText,
  };
}

/**
 * Extract JSON from a model response that might contain markdown fences or extra text.
 */
function extractJson(text: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // not valid JSON
  }

  // Try extracting from markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // not valid JSON in fence
    }
  }

  // Try finding the first { ... } block
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {
      // not valid JSON
    }
  }

  throw new Error("Could not extract JSON from model response");
}
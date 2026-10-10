import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { uiSpecSchema, type UiSpec } from "../schemas/ui-spec";

const fixturesDir = path.resolve(process.cwd(), "fixtures");

describe("uiSpecSchema", () => {
  it("validates a complete UI spec", () => {
    const spec: UiSpec = {
      layout: {
        type: "column",
        alignment: "start",
        gap: "16px",
        padding: "24px",
      },
      components: [
        {
          type: "Header",
          label: "Page header",
          textContent: "Welcome",
          state: "default",
          confidence: 0.9,
        },
        {
          type: "Button",
          label: "CTA button",
          textContent: "Get Started",
          state: "default",
          confidence: 0.95,
        },
        {
          type: "Input",
          label: "Search input",
          state: "default",
          confidence: 0.85,
        },
      ],
      textContent: [
        { text: "Welcome", role: "heading", fontSize: "32px", fontWeight: 700 },
        { text: "Get Started", role: "button", fontSize: "16px", fontWeight: 500 },
        { text: "Search...", role: "label", fontSize: "14px" },
      ],
      typography: {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSizes: [
          { label: "heading-1", size: "32px", usage: "Main heading" },
          { label: "body", size: "16px", usage: "Body text" },
          { label: "caption", size: "14px", usage: "Input placeholder" },
        ],
        fontWeights: [
          { label: "bold", weight: 700 },
          { label: "medium", weight: 500 },
        ],
      },
      colors: [
        { hex: "#3b82f6", role: "primary", usage: "Buttons, links", frequency: 0.3 },
        { hex: "#ffffff", role: "background", usage: "Page background", frequency: 0.5 },
        { hex: "#1f2937", role: "text", usage: "Body text", frequency: 0.8 },
      ],
      spacing: [
        { value: "8px", usage: "Between inline elements" },
        { value: "16px", usage: "Between components" },
        { value: "24px", usage: "Section padding" },
      ],
      responsiveHints: [
        { breakpoint: "mobile", observation: "Stack becomes single column" },
      ],
      statesVisible: ["default"],
      ambiguities: ["Icon in header — unclear what it represents"],
      accessibilityNotes: ["Button has visible focus ring"],
      confidence: 0.85,
    };

    const result = uiSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });

  it("validates a minimal UI spec", () => {
    const spec = {
      components: [],
      textContent: [],
      colors: [],
      spacing: [],
      confidence: 0.5,
    };

    const result = uiSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });

  it("validates components with children", () => {
    const spec = {
      components: [
        {
          type: "Card",
          children: [
            {
              type: "Text",
              textContent: "Title",
            },
            {
              type: "Button",
              textContent: "Action",
            },
          ],
        },
      ],
      textContent: [],
      colors: [],
      spacing: [],
      confidence: 0.8,
    };

    const result = uiSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });

  it("rejects invalid confidence values", () => {
    const spec = {
      components: [],
      textContent: [],
      colors: [],
      spacing: [],
      confidence: 1.5, // invalid: > 1
    };

    const result = uiSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
  });
});

describe("analyzeScreenshot (integration)", () => {
  it("returns fallback spec when no model configured", async () => {
    // This test verifies the function handles missing config gracefully
    // It will fail to call the model but should return a fallback spec
    const { analyzeScreenshot } = await import("../screenshot/analyzer");
    const { readImage } = await import("../screenshot/image-utils");

    // Create a tiny test image (1x1 PNG)
    const testImagePath = path.join(fixturesDir, "__test_image.png");
    const fs = await import("node:fs");
    // Write a minimal PNG (1x1 transparent pixel)
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    fs.writeFileSync(testImagePath, pngBuffer);

    try {
      const image = await readImage(testImagePath);
      const result = await analyzeScreenshot({
        images: [image],
        modelConfig: { model: "", visionModel: undefined, apiKey: undefined, baseURL: undefined, provider: undefined },
      });

      // Should return a fallback spec (not throw)
      expect(result.confidence).toBeLessThanOrEqual(0.1);
      expect(result.ambiguities?.length).toBeGreaterThan(0);
    } finally {
      fs.unlinkSync(testImagePath);
    }
  });
});
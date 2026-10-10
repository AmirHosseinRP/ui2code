import { describe, it, expect } from "vitest";
import { mapToDesignSystem } from "./mapper";
import type { UiSpec } from "../schemas/ui-spec";
import type { ConventionsResult } from "../schemas/conventions";

function makeUiSpec(components: Array<{ type: string; textContent?: string }>): UiSpec {
  return {
    components: components.map((c) => ({
      type: c.type,
      textContent: c.textContent,
      confidence: 0.9,
    })),
    textContent: [],
    colors: [],
    spacing: [],
    confidence: 0.8,
  };
}

function makeConventions(primitives: Array<{ name: string; filePath: string }>): ConventionsResult {
  return {
    componentLocation: "src/components",
    componentsDir: "src/components",
    fileNaming: "PascalCase",
    folderNaming: "PascalCase",
    exportStyle: "default",
    propsTyping: "interface",
    styleCoLocation: "tailwind-only",
    tokenUsage: "tailwind-config",
    tokens: {
      colors: { primary: "#3b82f6", background: "#ffffff" },
      spacing: { sm: "8px", md: "16px", lg: "24px" },
      source: "tailwind.config",
    },
    primitives: primitives.map((p) => ({
      name: p.name,
      filePath: p.filePath,
      exports: [p.name],
      isFromLib: false,
    })),
    components: [],
    totalComponents: 0,
    confidence: 0.8,
  };
}

describe("mapToDesignSystem", () => {
  it("maps components to existing primitives", () => {
    const uiSpec = makeUiSpec([
      { type: "Button", textContent: "Click me" },
      { type: "Input" },
      { type: "Card" },
    ]);
    const conventions = makeConventions([
      { name: "Button", filePath: "src/components/Button.tsx" },
      { name: "Input", filePath: "src/components/Input.tsx" },
      { name: "Card", filePath: "src/components/Card.tsx" },
    ]);

    const result = mapToDesignSystem({ uiSpec, conventions });

    expect(result.reusable).toHaveLength(3);
    expect(result.toCreate).toHaveLength(0);
    expect(result.reusable[0].matchedPrimitive?.name).toBe("Button");
    expect(result.reusable[1].matchedPrimitive?.name).toBe("Input");
    expect(result.reusable[2].matchedPrimitive?.name).toBe("Card");
  });

  it("marks unmatched components for creation", () => {
    const uiSpec = makeUiSpec([
      { type: "Button", textContent: "Submit" },
      { type: "HeroBanner" },
      { type: "TestimonialCarousel" },
    ]);
    const conventions = makeConventions([
      { name: "Button", filePath: "src/components/Button.tsx" },
    ]);

    const result = mapToDesignSystem({ uiSpec, conventions });

    expect(result.reusable).toHaveLength(1);
    expect(result.toCreate).toHaveLength(2);
    expect(result.toCreate[0].specType).toBe("HeroBanner");
    expect(result.toCreate[0].needsCreation).toBe(true);
    expect(result.toCreate[0].suggestedPath).toBeDefined();
  });

  it("includes design tokens from conventions", () => {
    const uiSpec = makeUiSpec([{ type: "Button" }]);
    const conventions = makeConventions([{ name: "Button", filePath: "src/components/Button.tsx" }]);

    const result = mapToDesignSystem({ uiSpec, conventions });

    expect(result.tokensToUse.colors.primary).toBe("#3b82f6");
    expect(result.tokensToUse.spacing.md).toBe("16px");
  });

  it("reports unmatched primitives", () => {
    const uiSpec = makeUiSpec([{ type: "Button" }]);
    const conventions = makeConventions([
      { name: "Button", filePath: "src/components/Button.tsx" },
      { name: "Sidebar", filePath: "src/components/Sidebar.tsx" },
      { name: "Tooltip", filePath: "src/components/Tooltip.tsx" },
    ]);

    const result = mapToDesignSystem({ uiSpec, conventions });

    expect(result.unmatchedPrimitives.length).toBeGreaterThanOrEqual(2);
    expect(result.unmatchedPrimitives.map((p) => p.name)).toContain("Sidebar");
    expect(result.unmatchedPrimitives.map((p) => p.name)).toContain("Tooltip");
  });

  it("handles semantic matches", () => {
    const uiSpec = makeUiSpec([{ type: "Modal" }]);
    const conventions = makeConventions([
      { name: "Dialog", filePath: "src/components/Dialog.tsx" },
    ]);

    const result = mapToDesignSystem({ uiSpec, conventions });

    expect(result.reusable).toHaveLength(1);
    expect(result.reusable[0].matchedPrimitive?.name).toBe("Dialog");
  });

  it("handles empty UI spec", () => {
    const uiSpec = makeUiSpec([]);
    const conventions = makeConventions([{ name: "Button", filePath: "src/components/Button.tsx" }]);

    const result = mapToDesignSystem({ uiSpec, conventions });

    expect(result.reusable).toHaveLength(0);
    expect(result.toCreate).toHaveLength(0);
    expect(result.unmatchedPrimitives).toHaveLength(1);
  });

  it("suggests paths with correct naming convention", () => {
    const uiSpec = makeUiSpec([{ type: "UserAvatar" }]);
    const conventions = makeConventions([]);
    conventions.fileNaming = "kebab-case";

    const result = mapToDesignSystem({ uiSpec, conventions });

    expect(result.toCreate[0].suggestedPath).toContain("user-avatar");
  });

  it("calculates confidence", () => {
    const uiSpec = makeUiSpec([{ type: "Button" }]);
    const conventions = makeConventions([{ name: "Button", filePath: "src/components/Button.tsx" }]);

    const result = mapToDesignSystem({ uiSpec, conventions });

    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { scanConventions } from "./scanner";

const fixturesDir = path.resolve(process.cwd(), "fixtures");

function fixturePath(name: string): string {
  return path.join(fixturesDir, name);
}

describe("scanConventions", () => {
  it("scans react-vite-tailwind conventions", async () => {
    const result = await scanConventions({
      projectRoot: fixturePath("react-vite-tailwind"),
      framework: "react",
      styling: "tailwind",
    });

    expect(result.totalComponents).toBeGreaterThanOrEqual(1);
    expect(result.fileNaming).toBe("PascalCase");
    expect(result.exportStyle).toBe("default");
    expect(result.components.length).toBeGreaterThanOrEqual(1);
    expect(result.confidence).toBeGreaterThan(0);

    // Check the Button component
    const button = result.components.find((c) => c.fileName === "Button.tsx");
    expect(button).toBeDefined();
    if (button) {
      expect(button.fileNaming).toBe("PascalCase");
      expect(button.usesTypeScript).toBe(true);
      expect(button.styleCoLocation).toBe("tailwind-only");
    }
  });

  it("scans nextjs-app-shadcn conventions", async () => {
    const result = await scanConventions({
      projectRoot: fixturePath("nextjs-app-shadcn"),
      framework: "nextjs",
      styling: "tailwind",
    });

    expect(result.totalComponents).toBeGreaterThanOrEqual(1);
    // shadcn uses lowercase kebab-case filenames
    expect(["kebab-case", "PascalCase"]).toContain(result.fileNaming);

    // Should find shadcn Button
    const button = result.components.find((c) => c.fileName === "button.tsx");
    if (button) {
      expect(button.exportStyle).toBe("named");
      expect(button.usesTypeScript).toBe(true);
    }

    // Should have design tokens from tailwind config
    expect(result.tokens).toBeDefined();
  });

  it("scans vue3-vite conventions", async () => {
    const result = await scanConventions({
      projectRoot: fixturePath("vue3-vite"),
      framework: "vue",
      styling: "sass",
    });

    expect(result.totalComponents).toBeGreaterThanOrEqual(1);
    const button = result.components.find((c) => c.fileName === "Button.vue");
    expect(button).toBeDefined();
    if (button) {
      expect(button.usesTypeScript).toBe(true);
    }
  });

  it("scans sveltekit conventions", async () => {
    const result = await scanConventions({
      projectRoot: fixturePath("sveltekit"),
      framework: "sveltekit",
      styling: "plain-css",
    });

    expect(result.totalComponents).toBeGreaterThanOrEqual(1);
    const button = result.components.find((c) => c.fileName === "Button.svelte");
    expect(button).toBeDefined();
    if (button) {
      expect(button.usesTypeScript).toBe(true);
    }
  });

  it("scans angular conventions", async () => {
    const result = await scanConventions({
      projectRoot: fixturePath("angular"),
      framework: "angular",
    });

    expect(result.totalComponents).toBeGreaterThanOrEqual(1);
    const button = result.components.find((c) => c.fileName === "button.component.ts");
    expect(button).toBeDefined();
    if (button) {
      expect(button.usesTypeScript).toBe(true);
      expect(button.exportStyle).toBe("named");
    }
  });

  it("handles empty project gracefully", async () => {
    const result = await scanConventions({
      projectRoot: fixturePath("__nonexistent__"),
      framework: "react",
    });

    expect(result.totalComponents).toBe(0);
    expect(result.components).toHaveLength(0);
    expect(result.confidence).toBe(0);
  });

  it("respects sampleSize option", async () => {
    const result = await scanConventions({
      projectRoot: fixturePath("react-vite-tailwind"),
      framework: "react",
      sampleSize: 1,
    });

    expect(result.components.length).toBeLessThanOrEqual(1);
  });
});
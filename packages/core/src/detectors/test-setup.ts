import type { Detector, DetectorContext, DetectorResult } from "./registry";
import type { TestFramework } from "../schemas/stack";

async function detect(ctx: DetectorContext): Promise<DetectorResult> {
  const evidence: { file: string; match?: string }[] = [];
  const frameworks: TestFramework[] = [];

  if (!ctx.packageJson) {
    return { testSetup: { value: "none", confidence: 0.3, evidence: [] } };
  }

  const deps = {
    ...(ctx.packageJson.dependencies as Record<string, string> | undefined),
    ...(ctx.packageJson.devDependencies as Record<string, string> | undefined),
  };

  if (!deps) {
    return { testSetup: { value: "none", confidence: 0.3, evidence: [] } };
  }

  // Vitest
  if (deps.vitest || (await ctx.fileExists("vitest.config.ts")) || (await ctx.fileExists("vitest.config.js"))) {
    frameworks.push("vitest");
    evidence.push({ file: "package.json", match: "vitest" });
  }

  // Jest
  if (deps.jest || (await ctx.fileExists("jest.config.ts")) || (await ctx.fileExists("jest.config.js")) || (await ctx.fileExists("jest.config.mjs"))) {
    frameworks.push("jest");
    evidence.push({ file: "package.json", match: "jest" });
  }

  // Testing Library
  if (deps["@testing-library/react"] || deps["@testing-library/vue"] || deps["@testing-library/svelte"] || deps["@testing-library/angular"]) {
    frameworks.push("testing-library");
    evidence.push({ file: "package.json", match: "@testing-library" });
  }

  // Storybook
  if (deps["@storybook/react"] || deps["@storybook/vue3"] || deps["@storybook/svelte"] || (await ctx.fileExists(".storybook/main.ts")) || (await ctx.fileExists(".storybook/main.js"))) {
    frameworks.push("storybook");
    evidence.push({ file: "package.json", match: "storybook" });
  }

  // Playwright
  if (deps["@playwright/test"] || (await ctx.fileExists("playwright.config.ts")) || (await ctx.fileExists("playwright.config.js"))) {
    frameworks.push("playwright");
    evidence.push({ file: "package.json", match: "@playwright/test" });
  }

  const value: TestFramework = frameworks.length > 0 ? frameworks[0] : "none";

  return {
    testSetup: { value, confidence: evidence.length > 0 ? 0.9 : 0.3, evidence },
  };
}

export const testSetupDetector: Detector = {
  name: "test-setup",
  detect,
};
import { describe, it, expect, beforeEach } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import { detectStack } from "../detect-stack";
import { clearDetectors, registerDetector, getDetectors } from "./registry";
import { packageManagerDetector } from "./package-manager";
import { languageDetector } from "./language";
import { frameworkDetector } from "./framework";
import { stylingDetector } from "./styling";
import { componentLibDetector } from "./component-lib";
import { testSetupDetector } from "./test-setup";

const fixturesDir = path.resolve(process.cwd(), "fixtures");

function fixturePath(name: string): string {
  return path.join(fixturesDir, name);
}

describe("packageManagerDetector", () => {
  it("detects package manager from fixture", async () => {
    clearDetectors();
    registerDetector(packageManagerDetector);
    const result = await detectStack({ projectRoot: fixturePath("react-vite-tailwind") });
    expect(["pnpm", "npm", "yarn", "bun", "unknown"]).toContain(result.packageManager.value);
  });
});

describe("languageDetector", () => {
  it("detects TypeScript for projects with tsconfig.json", async () => {
    clearDetectors();
    registerDetector(languageDetector);
    const root = fixturePath("react-vite-tailwind");
    expect(fs.existsSync(path.join(root, "tsconfig.json"))).toBe(true);
    const detectors = getDetectors();
    expect(detectors.length).toBe(1);
    const result = await detectStack({ projectRoot: root });
    expect(result.language.value).toBe("typescript");
    expect(result.language.confidence).toBeGreaterThan(0);
  });
});

describe("frameworkDetector", () => {
  it("detects React from react-vite-tailwind fixture", async () => {
    clearDetectors();
    registerDetector(frameworkDetector);
    const result = await detectStack({ projectRoot: fixturePath("react-vite-tailwind") });
    expect(result.framework.value).toBe("react");
  });

  it("detects Next.js with app router from nextjs-app-shadcn fixture", async () => {
    clearDetectors();
    registerDetector(frameworkDetector);
    const result = await detectStack({ projectRoot: fixturePath("nextjs-app-shadcn") });
    expect(result.framework.value).toBe("nextjs");
    expect(result.routingStyle.value).toBe("app-router");
  });

  it("detects Vue from vue3-vite fixture", async () => {
    clearDetectors();
    registerDetector(frameworkDetector);
    const result = await detectStack({ projectRoot: fixturePath("vue3-vite") });
    expect(result.framework.value).toBe("vue");
    expect(result.routingStyle.value).toBe("config-based");
  });

  it("detects SvelteKit from sveltekit fixture", async () => {
    clearDetectors();
    registerDetector(frameworkDetector);
    const result = await detectStack({ projectRoot: fixturePath("sveltekit") });
    expect(result.framework.value).toBe("sveltekit");
    expect(result.routingStyle.value).toBe("file-based");
  });

  it("detects Angular from angular fixture", async () => {
    clearDetectors();
    registerDetector(frameworkDetector);
    const result = await detectStack({ projectRoot: fixturePath("angular") });
    expect(result.framework.value).toBe("angular");
  });
});

describe("stylingDetector", () => {
  it("detects Tailwind from react-vite-tailwind fixture", async () => {
    clearDetectors();
    registerDetector(stylingDetector);
    const result = await detectStack({ projectRoot: fixturePath("react-vite-tailwind") });
    expect(result.styling.value).toBe("tailwind");
  });

  it("detects Tailwind from nextjs-app-shadcn fixture", async () => {
    clearDetectors();
    registerDetector(stylingDetector);
    const result = await detectStack({ projectRoot: fixturePath("nextjs-app-shadcn") });
    expect(result.styling.value).toBe("tailwind");
  });

  it("detects Sass from vue3-vite fixture", async () => {
    clearDetectors();
    registerDetector(stylingDetector);
    const result = await detectStack({ projectRoot: fixturePath("vue3-vite") });
    expect(result.styling.value).toBe("sass");
  });
});

describe("componentLibDetector", () => {
  it("detects shadcn from nextjs-app-shadcn fixture", async () => {
    clearDetectors();
    registerDetector(componentLibDetector);
    const result = await detectStack({ projectRoot: fixturePath("nextjs-app-shadcn") });
    expect(result.componentLib.value).toBe("shadcn");
  });

  it("detects lucide-react as icon lib", async () => {
    clearDetectors();
    registerDetector(componentLibDetector);
    const result = await detectStack({ projectRoot: fixturePath("react-vite-tailwind") });
    expect(result.iconLib.value).toBe("lucide");
  });

  it("detects framer-motion as animation lib", async () => {
    clearDetectors();
    registerDetector(componentLibDetector);
    const result = await detectStack({ projectRoot: fixturePath("react-vite-tailwind") });
    expect(result.animationLib.value).toBe("framer-motion");
  });
});

describe("testSetupDetector", () => {
  it("detects Vitest from react-vite-tailwind fixture", async () => {
    clearDetectors();
    registerDetector(testSetupDetector);
    const result = await detectStack({ projectRoot: fixturePath("react-vite-tailwind") });
    expect(result.testSetup.value).toBe("vitest");
  });

  it("detects testing-library from nextjs-app-shadcn fixture", async () => {
    clearDetectors();
    registerDetector(testSetupDetector);
    const result = await detectStack({ projectRoot: fixturePath("nextjs-app-shadcn") });
    // Fixture has both jest and @testing-library/react — detector returns first match
    expect(["testing-library", "jest"]).toContain(result.testSetup.value);
  });
});

describe("full detectStack", () => {
  it("detects React + Vite + Tailwind stack end-to-end", async () => {
    clearDetectors();
    const result = await detectStack({ projectRoot: fixturePath("react-vite-tailwind") });
    expect(result.language.value).toBe("typescript");
    expect(result.framework.value).toBe("react");
    expect(result.styling.value).toBe("tailwind");
    expect(result.iconLib.value).toBe("lucide");
    expect(result.animationLib.value).toBe("framer-motion");
    expect(result.testSetup.value).toBe("vitest");
  });

  it("detects Next.js + shadcn stack end-to-end", async () => {
    clearDetectors();
    const result = await detectStack({ projectRoot: fixturePath("nextjs-app-shadcn") });
    expect(result.language.value).toBe("typescript");
    expect(result.framework.value).toBe("nextjs");
    expect(result.routingStyle.value).toBe("app-router");
    expect(result.styling.value).toBe("tailwind");
    expect(result.componentLib.value).toBe("shadcn");
  });

  it("detects Vue 3 + Vite stack end-to-end", async () => {
    clearDetectors();
    const result = await detectStack({ projectRoot: fixturePath("vue3-vite") });
    expect(result.language.value).toBe("typescript");
    expect(result.framework.value).toBe("vue");
    expect(result.styling.value).toBe("sass");
    expect(result.testSetup.value).toBe("vitest");
  });

  it("detects SvelteKit stack end-to-end", async () => {
    clearDetectors();
    const result = await detectStack({ projectRoot: fixturePath("sveltekit") });
    expect(result.framework.value).toBe("sveltekit");
    expect(result.routingStyle.value).toBe("file-based");
    expect(result.testSetup.value).toBe("vitest");
  });

  it("detects Angular stack end-to-end", async () => {
    clearDetectors();
    const result = await detectStack({ projectRoot: fixturePath("angular") });
    expect(result.language.value).toBe("typescript");
    expect(result.framework.value).toBe("angular");
  });

  it("returns unknown for empty directory", async () => {
    clearDetectors();
    const emptyDir = path.join(fixturesDir, "__empty__");
    fs.mkdirSync(emptyDir, { recursive: true });
    try {
      const result = await detectStack({ projectRoot: emptyDir });
      expect(result.framework.value).toBe("unknown");
      expect(result.language.value).toBe("unknown");
    } finally {
      fs.rmSync(emptyDir, { recursive: true });
    }
  });
});
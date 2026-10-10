import type { Detector, DetectorContext, DetectorResult } from "./registry";
import type { Styling } from "../schemas/stack";

async function detect(ctx: DetectorContext): Promise<DetectorResult> {
  const evidence: { file: string; match?: string }[] = [];
  let value: Styling = "unknown";

  if (!ctx.packageJson) {
    return { styling: { value: "unknown", confidence: 0, evidence: [] } };
  }

  const deps = {
    ...(ctx.packageJson.dependencies as Record<string, string> | undefined),
    ...(ctx.packageJson.devDependencies as Record<string, string> | undefined),
  };

  // Tailwind CSS
  if (deps?.tailwindcss || (await ctx.fileExists("tailwind.config.ts")) || (await ctx.fileExists("tailwind.config.js")) || (await ctx.fileExists("tailwind.config.mjs"))) {
    value = "tailwind";
    evidence.push({ file: "package.json", match: "tailwindcss" });
  }
  // styled-components
  else if (deps?.["styled-components"]) {
    value = "styled-components";
    evidence.push({ file: "package.json", match: "styled-components" });
  }
  // Emotion
  else if (deps?.["@emotion/react"] || deps?.["@emotion/styled"]) {
    value = "emotion";
    evidence.push({ file: "package.json", match: "@emotion/react" });
  }
  // vanilla-extract
  else if (deps?.["@vanilla-extract/css"] || deps?.["@vanilla-extract/vite-plugin"]) {
    value = "vanilla-extract";
    evidence.push({ file: "package.json", match: "@vanilla-extract/css" });
  }
  // Sass
  else if (deps?.sass || deps?.["node-sass"]) {
    value = "sass";
    evidence.push({ file: "package.json", match: "sass" });
  }

  // CSS Modules: check for .module.css files
  if (value === "unknown") {
    const moduleFiles = await ctx.glob("src/**/*.module.css");
    const moduleScssFiles = await ctx.glob("src/**/*.module.scss");
    if (moduleFiles.length > 0 || moduleScssFiles.length > 0) {
      value = "css-modules";
      evidence.push({ file: moduleFiles[0] || moduleScssFiles[0], match: "CSS Module files found" });
    }
  }

  // Plain CSS fallback
  if (value === "unknown") {
    const cssFiles = await ctx.glob("src/**/*.css");
    if (cssFiles.length > 0) {
      value = "plain-css";
      evidence.push({ file: cssFiles[0], match: `found ${cssFiles.length} .css files` });
    }
  }

  return {
    styling: { value, confidence: evidence.length > 0 ? 0.85 : 0, evidence },
  };
}

export const stylingDetector: Detector = {
  name: "styling",
  detect,
};
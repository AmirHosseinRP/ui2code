import type { Detector, DetectorContext, DetectorResult } from "./registry";

async function detect(ctx: DetectorContext): Promise<DetectorResult> {
  const evidence: { file: string; match?: string }[] = [];
  let value: "typescript" | "javascript" | "unknown" = "unknown";

  // Check for tsconfig.json
  if (await ctx.fileExists("tsconfig.json")) {
    value = "typescript";
    evidence.push({ file: "tsconfig.json" });
  }

  // Check for .ts/.tsx files in src
  const tsFiles = await ctx.glob("src/**/*.{ts,tsx}");
  if (tsFiles.length > 0) {
    value = "typescript";
    evidence.push({ file: tsFiles[0], match: `found ${tsFiles.length} .ts/.tsx files` });
  }

  // Check package.json for typescript dependency
  if (ctx.packageJson) {
    const allDeps = {
      ...((ctx.packageJson.dependencies as Record<string, string> | undefined) ?? {}),
      ...((ctx.packageJson.devDependencies as Record<string, string> | undefined) ?? {}),
    };
    if ("typescript" in allDeps) {
      value = "typescript";
      evidence.push({ file: "package.json", match: "typescript in dependencies" });
    }
  }

  // Fallback: check for .js/.jsx files
  if (value === "unknown") {
    const jsFiles = await ctx.glob("src/**/*.{js,jsx}");
    if (jsFiles.length > 0) {
      value = "javascript";
      evidence.push({ file: jsFiles[0], match: `found ${jsFiles.length} .js/.jsx files` });
    }
  }

  return {
    language: { value, confidence: evidence.length > 0 ? 0.9 : 0, evidence },
  };
}

export const languageDetector: Detector = {
  name: "language",
  detect,
};
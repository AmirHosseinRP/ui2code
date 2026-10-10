import type { Detector, DetectorContext, DetectorResult } from "./registry";

async function detect(ctx: DetectorContext): Promise<DetectorResult> {
  const evidence: { file: string; match?: string }[] = [];
  let value: "npm" | "yarn" | "pnpm" | "bun" | "unknown" = "unknown";

  if (await ctx.fileExists("pnpm-lock.yaml")) {
    value = "pnpm";
    evidence.push({ file: "pnpm-lock.yaml" });
  } else if (await ctx.fileExists("yarn.lock")) {
    value = "yarn";
    evidence.push({ file: "yarn.lock" });
  } else if (await ctx.fileExists("bun.lockb") || await ctx.fileExists("bun.lock")) {
    value = "bun";
    evidence.push({ file: "bun.lockb" });
  } else if (await ctx.fileExists("package-lock.json")) {
    value = "npm";
    evidence.push({ file: "package-lock.json" });
  }

  // Also check packageManager field in package.json
  if (ctx.packageJson) {
    const pm = ctx.packageJson.packageManager;
    if (typeof pm === "string") {
      const name = pm.split("@")[0];
      if (name === "pnpm" || name === "yarn" || name === "npm" || name === "bun") {
        if (value === "unknown") {
          value = name;
        }
        evidence.push({ file: "package.json", match: `packageManager: ${pm}` });
      }
    }
  }

  return {
    packageManager: { value, confidence: evidence.length > 0 ? 0.95 : 0, evidence },
  };
}

export const packageManagerDetector: Detector = {
  name: "package-manager",
  detect,
};
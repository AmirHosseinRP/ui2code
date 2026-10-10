import type { Detector, DetectorContext, DetectorResult } from "./registry";
import type { Monorepo } from "../schemas/stack";

async function detect(ctx: DetectorContext): Promise<DetectorResult> {
  const evidence: { file: string; match?: string }[] = [];
  let value: Monorepo = "none";
  let frontendPackage: string | undefined;

  // pnpm workspaces
  if (await ctx.fileExists("pnpm-workspace.yaml")) {
    value = "pnpm-workspaces";
    evidence.push({ file: "pnpm-workspace.yaml" });

    // Try to find the frontend package
    const content = await ctx.readFile("pnpm-workspace.yaml");
    if (content) {
      const match = content.match(/packages:\s*\n((?:\s*-\s*"[^"]+"\s*\n?)+)/);
      if (match) {
        const pkgGlobs = match[1]
          .split("\n")
          .map((l) => l.trim().replace(/^-\s*"?/, "").replace(/"?\s*$/, ""))
          .filter(Boolean);

        for (const pattern of pkgGlobs) {
          const dirs = await ctx.glob(pattern.replace("*", "**/package.json"));
          for (const pkgPath of dirs) {
            const pkgContent = await ctx.readFile(pkgPath);
            if (pkgContent) {
              try {
                const pkg = JSON.parse(pkgContent);
                const deps = { ...pkg.dependencies, ...pkg.devDependencies };
                if (deps?.react || deps?.vue || deps?.svelte || deps?.["@angular/core"]) {
                  frontendPackage = pkgPath.replace("/package.json", "").replace("package.json", ".");
                  evidence.push({ file: pkgPath, match: "frontend package in monorepo" });
                  break;
                }
              } catch {
                // skip invalid package.json
              }
            }
          }
          if (frontendPackage) break;
        }
      }
    }
  }
  // Turborepo
  else if (await ctx.fileExists("turbo.json")) {
    value = "turborepo";
    evidence.push({ file: "turbo.json" });
  }
  // Nx
  else if (await ctx.fileExists("nx.json")) {
    value = "nx";
    evidence.push({ file: "nx.json" });
  }
  // Lerna
  else if (await ctx.fileExists("lerna.json")) {
    value = "lerna";
    evidence.push({ file: "lerna.json" });
  }

  return {
    monorepo: { value, confidence: evidence.length > 0 ? 0.9 : 0.7, evidence },
    ...(frontendPackage ? { frontendPackage } : {}),
  };
}

export const monorepoDetector: Detector = {
  name: "monorepo",
  detect,
};
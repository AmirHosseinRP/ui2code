import type { Detector, DetectorContext, DetectorResult } from "./registry";
import type { Framework, RoutingStyle } from "../schemas/stack";

async function detect(ctx: DetectorContext): Promise<DetectorResult> {
  const evidence: { file: string; match?: string }[] = [];
  let framework: Framework = "unknown";
  let routingStyle: RoutingStyle = "unknown";

  if (!ctx.packageJson) {
    return { framework: { value: "unknown", confidence: 0, evidence: [] } };
  }

  const deps = {
    ...(ctx.packageJson.dependencies as Record<string, string> | undefined),
    ...(ctx.packageJson.devDependencies as Record<string, string> | undefined),
  };

  if (!deps) {
    return { framework: { value: "unknown", confidence: 0, evidence: [] } };
  }

  // Next.js (check before React since it includes React)
  if (deps["next"]) {
    framework = "nextjs";
    evidence.push({ file: "package.json", match: "next in dependencies" });

    // Detect routing style
    if (await ctx.fileExists("app/layout.tsx") || await ctx.fileExists("app/layout.jsx") || await ctx.fileExists("app/layout.js")) {
      routingStyle = "app-router";
      evidence.push({ file: "app/layout.tsx" });
    } else if (await ctx.fileExists("pages/_app.tsx") || await ctx.fileExists("pages/_app.jsx") || await ctx.fileExists("pages/_app.js")) {
      routingStyle = "pages-router";
      evidence.push({ file: "pages/_app.tsx" });
    }
  }
  // Nuxt (check before Vue)
  else if (deps["nuxt"] || deps["@nuxt/kit"]) {
    framework = "nuxt";
    evidence.push({ file: "package.json", match: "nuxt in dependencies" });
    routingStyle = "file-based";
  }
  // SvelteKit (check before Svelte)
  else if (deps["@sveltejs/kit"]) {
    framework = "sveltekit";
    evidence.push({ file: "package.json", match: "@sveltejs/kit in dependencies" });
    routingStyle = "file-based";
  }
  // Angular
  else if (deps["@angular/core"]) {
    framework = "angular";
    evidence.push({ file: "package.json", match: "@angular/core in dependencies" });
    routingStyle = "config-based";
  }
  // React
  else if (deps["react"]) {
    framework = "react";
    evidence.push({ file: "package.json", match: "react in dependencies" });

    // Check for React Router
    if (deps["react-router"] || deps["react-router-dom"]) {
      routingStyle = "config-based";
      evidence.push({ file: "package.json", match: "react-router in dependencies" });
    }
  }
  // Vue
  else if (deps["vue"]) {
    framework = "vue";
    evidence.push({ file: "package.json", match: "vue in dependencies" });

    // Check for Vue Router
    if (deps["vue-router"]) {
      routingStyle = "config-based";
      evidence.push({ file: "package.json", match: "vue-router in dependencies" });
    }
  }
  // Svelte
  else if (deps["svelte"]) {
    framework = "svelte";
    evidence.push({ file: "package.json", match: "svelte in dependencies" });
  }
  // Solid
  else if (deps["solid-js"]) {
    framework = "solid";
    evidence.push({ file: "package.json", match: "solid-js in dependencies" });
  }
  // Astro
  else if (deps["astro"]) {
    framework = "astro";
    evidence.push({ file: "package.json", match: "astro in dependencies" });
  }

  // Additional evidence from config files
  if (await ctx.fileExists("next.config.ts") || await ctx.fileExists("next.config.js") || await ctx.fileExists("next.config.mjs")) {
    if (framework === "unknown") {
      framework = "nextjs";
    }
    evidence.push({ file: "next.config.ts" });
  }

  if (await ctx.fileExists("nuxt.config.ts") || await ctx.fileExists("nuxt.config.js")) {
    if (framework === "unknown") {
      framework = "nuxt";
    }
    evidence.push({ file: "nuxt.config.ts" });
  }

  if (await ctx.fileExists("svelte.config.js") || await ctx.fileExists("svelte.config.ts")) {
    if (framework === "unknown") {
      framework = "svelte";
    }
    evidence.push({ file: "svelte.config.js" });
  }

  if (await ctx.fileExists("angular.json")) {
    if (framework === "unknown") {
      framework = "angular";
    }
    evidence.push({ file: "angular.json" });
  }

  if (await ctx.fileExists("astro.config.mjs") || await ctx.fileExists("astro.config.ts")) {
    if (framework === "unknown") {
      framework = "astro";
    }
    evidence.push({ file: "astro.config.mjs" });
  }

  return {
    framework: { value: framework, confidence: evidence.length > 0 ? 0.9 : 0, evidence },
    routingStyle: { value: routingStyle, confidence: routingStyle !== "unknown" ? 0.85 : 0, evidence },
  };
}

export const frameworkDetector: Detector = {
  name: "framework",
  detect,
};
import { z } from "zod";

/** Confidence score between 0 and 1 */
export const confidenceSchema = z.number().min(0).max(1);

/** Evidence used for a detection */
export const evidenceSchema = z.object({
  file: z.string().describe("File path that provided evidence"),
  match: z.string().optional().describe("Specific content or pattern matched"),
});

export type Evidence = z.infer<typeof evidenceSchema>;

/** A detected value with confidence and evidence */
export const detectedFieldSchema = <T extends z.ZodType>(valueSchema: T) =>
  z.object({
    value: valueSchema,
    confidence: confidenceSchema,
    evidence: z.array(evidenceSchema),
  });

export const packageManagerSchema = z.enum([
  "npm",
  "yarn",
  "pnpm",
  "bun",
  "unknown",
]);

export const languageSchema = z.enum([
  "typescript",
  "javascript",
  "unknown",
]);

export const frameworkSchema = z.enum([
  "react",
  "nextjs",
  "vue",
  "nuxt",
  "svelte",
  "sveltekit",
  "angular",
  "solid",
  "astro",
  "unknown",
]);

export const routingStyleSchema = z.enum([
  "app-router",
  "pages-router",
  "file-based",
  "config-based",
  "none",
  "unknown",
]);

export const stylingSchema = z.enum([
  "tailwind",
  "css-modules",
  "styled-components",
  "emotion",
  "sass",
  "vanilla-extract",
  "plain-css",
  "unknown",
]);

export const componentLibSchema = z.enum([
  "shadcn",
  "mui",
  "chakra",
  "ant",
  "mantine",
  "radix",
  "none",
  "unknown",
]);

export const testFrameworkSchema = z.enum([
  "vitest",
  "jest",
  "testing-library",
  "storybook",
  "playwright",
  "none",
  "unknown",
]);

export const monorepoSchema = z.enum([
  "pnpm-workspaces",
  "turborepo",
  "nx",
  "lerna",
  "none",
  "unknown",
]);

/** Full project stack detection result */
export const stackResultSchema = z.object({
  packageManager: detectedFieldSchema(packageManagerSchema),
  language: detectedFieldSchema(languageSchema),
  framework: detectedFieldSchema(frameworkSchema),
  routingStyle: detectedFieldSchema(routingStyleSchema),
  styling: detectedFieldSchema(stylingSchema),
  componentLib: detectedFieldSchema(componentLibSchema),
  iconLib: detectedFieldSchema(z.string()),
  animationLib: detectedFieldSchema(z.string()),
  testSetup: detectedFieldSchema(testFrameworkSchema),
  monorepo: detectedFieldSchema(monorepoSchema),
  frontendPackage: z.string().optional().describe("Path to the frontend package in a monorepo"),
  pathAliases: z
    .object({
      configured: z.boolean(),
      aliases: z.record(z.string()).optional(),
      source: z.string().optional().describe("tsconfig or vite config path"),
    })
    .optional(),
  lintFormat: z
    .object({
      eslint: z.boolean(),
      prettier: z.boolean(),
      biome: z.boolean(),
    })
    .optional(),
});

export type StackResult = z.infer<typeof stackResultSchema>;
export type PackageManager = z.infer<typeof packageManagerSchema>;
export type Language = z.infer<typeof languageSchema>;
export type Framework = z.infer<typeof frameworkSchema>;
export type RoutingStyle = z.infer<typeof routingStyleSchema>;
export type Styling = z.infer<typeof stylingSchema>;
export type ComponentLib = z.infer<typeof componentLibSchema>;
export type TestFramework = z.infer<typeof testFrameworkSchema>;
export type Monorepo = z.infer<typeof monorepoSchema>;
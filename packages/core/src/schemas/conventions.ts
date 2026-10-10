import { z } from "zod";

export const namingConventionSchema = z.enum([
  "PascalCase",
  "kebab-case",
  "camelCase",
  "snake_case",
  "mixed",
  "unknown",
]);

export const exportStyleSchema = z.enum([
  "default",
  "named",
  "mixed",
  "unknown",
]);

export const propsTypingStyleSchema = z.enum([
  "interface",
  "type",
  "inline",
  "none",
  "unknown",
]);

export const componentLocationSchema = z.enum([
  "src/components",
  "app/components",
  "src/lib",
  "components",
  "flat",
  "unknown",
]);

export const styleCoLocationSchema = z.enum([
  "same-file",
  "css-modules",
  "separate-css",
  "tailwind-only",
  "styled-components",
  "emotion",
  "scss-module",
  "unknown",
]);

export const tokenUsageSchema = z.enum([
  "css-variables",
  "tailwind-config",
  "theme-file",
  "inline",
  "unknown",
]);

/** A single component's conventions */
export const componentConventionsSchema = z.object({
  /** File path relative to project root */
  filePath: z.string(),
  /** File name (e.g., "Button.tsx") */
  fileName: z.string(),
  /** Naming convention used for the file */
  fileNaming: namingConventionSchema,
  /** Export style: default or named */
  exportStyle: exportStyleSchema,
  /** Props typing approach */
  propsTyping: propsTypingStyleSchema,
  /** Name of the props type/interface if found */
  propsTypeName: z.string().optional(),
  /** Whether styles are co-located */
  styleCoLocation: styleCoLocationSchema,
  /** Whether the component uses TypeScript */
  usesTypeScript: z.boolean(),
  /** Whether it uses React.forwardRef */
  usesForwardRef: z.boolean(),
  /** Whether it uses hooks */
  usesHooks: z.array(z.string()),
  /** Sub-components or related files found */
  relatedFiles: z.array(z.string()),
  /** Imports from project's own codebase (internal imports) */
  internalImports: z.array(z.string()),
  /** External library imports */
  externalImports: z.array(z.string()),
});

export type ComponentConventions = z.infer<typeof componentConventionsSchema>;

/** Design tokens extracted from the project */
export const designTokensSchema = z.object({
  colors: z.record(z.string()).optional().describe("Color name → value or CSS variable"),
  spacing: z.record(z.string()).optional().describe("Spacing name → value"),
  fonts: z.record(z.string()).optional().describe("Font name → value"),
  borderRadius: z.record(z.string()).optional().describe("Border radius name → value"),
  shadows: z.record(z.string()).optional().describe("Shadow name → value"),
  source: z.string().optional().describe("Where tokens were found (tailwind.config, theme file, etc.)"),
});

export type DesignTokens = z.infer<typeof designTokensSchema>;

/** Reusable primitives found in the project */
export const reusablePrimitiveSchema = z.object({
  name: z.string().describe("Component name (e.g., Button, Input, Card)"),
  filePath: z.string().describe("Relative path to the component file"),
  exports: z.array(z.string()).describe("Named exports from this file"),
  isFromLib: z.boolean().optional().describe("Whether it's from a component library (shadcn, MUI, etc.)"),
});

export type ReusablePrimitive = z.infer<typeof reusablePrimitiveSchema>;

/** Full convention scan result */
export const conventionsResultSchema = z.object({
  /** Where components are stored */
  componentLocation: componentLocationSchema,
  /** Directory containing most components */
  componentsDir: z.string().optional(),
  /** Naming convention for files */
  fileNaming: namingConventionSchema,
  /** Naming convention for folders */
  folderNaming: namingConventionSchema,
  /** Primary export style */
  exportStyle: exportStyleSchema,
  /** Primary props typing approach */
  propsTyping: propsTypingStyleSchema,
  /** How styles are co-located */
  styleCoLocation: styleCoLocationSchema,
  /** How design tokens are used */
  tokenUsage: tokenUsageSchema,
  /** Extracted design tokens */
  tokens: designTokensSchema,
  /** Reusable primitives found */
  primitives: z.array(reusablePrimitiveSchema),
  /** Individual component conventions (sampled) */
  components: z.array(componentConventionsSchema),
  /** Total number of component files found */
  totalComponents: z.number(),
  /** Confidence score for the overall conventions */
  confidence: z.number().min(0).max(1),
});

export type ConventionsResult = z.infer<typeof conventionsResultSchema>;
export type NamingConvention = z.infer<typeof namingConventionSchema>;
export type ExportStyle = z.infer<typeof exportStyleSchema>;
export type PropsTypingStyle = z.infer<typeof propsTypingStyleSchema>;
export type ComponentLocation = z.infer<typeof componentLocationSchema>;
export type StyleCoLocation = z.infer<typeof styleCoLocationSchema>;
export type TokenUsage = z.infer<typeof tokenUsageSchema>;
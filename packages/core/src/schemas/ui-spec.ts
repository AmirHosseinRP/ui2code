import { z } from "zod";

/** A UI component detected in the screenshot */
export const uiComponentSchema: z.ZodType<{
  type: string;
  label?: string;
  textContent?: string;
  position?: { x?: number; y?: number; width?: number; height?: number };
  state?: string;
  children?: unknown[];
  accessibility?: { role?: string; label?: string; hasKeyboardFocus?: boolean };
  confidence?: number;
}> = z.object({
  /** Component type (Button, Input, Card, Text, Image, Container, etc.) */
  type: z.string(),
  /** Optional descriptive label or role */
  label: z.string().optional(),
  /** Text content inside the component */
  textContent: z.string().optional(),
  /** Estimated position: top-left x, y (normalized 0-1 or px) */
  position: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }).optional(),
  /** Visual state if visible (default, hover, active, disabled, loading) */
  state: z.string().optional(),
  /** Children components */
  children: z.array(z.lazy(() => uiComponentSchema)).optional(),
  /** Accessibility notes */
  accessibility: z.object({
    role: z.string().optional(),
    label: z.string().optional(),
    hasKeyboardFocus: z.boolean().optional(),
  }).optional(),
  /** Confidence of this detection */
  confidence: z.number().min(0).max(1).optional(),
});

export type UiComponent = z.infer<typeof uiComponentSchema>;

/** Typography info detected in the screenshot */
export const typographySchema = z.object({
  /** Font family guess (e.g., "sans-serif", "Inter", "system-ui") */
  fontFamily: z.string().optional(),
  /** Font sizes detected (in px or relative) */
  fontSizes: z.array(z.object({
    label: z.string().describe("e.g., heading-1, body, caption"),
    size: z.string().describe("e.g., 24px, 1.5rem"),
    usage: z.string().optional().describe("Where it appears"),
  })).optional(),
  /** Font weights detected */
  fontWeights: z.array(z.object({
    label: z.string(),
    weight: z.number().or(z.string()),
  })).optional(),
  /** Line heights */
  lineHeights: z.array(z.string()).optional(),
});

export type Typography = z.infer<typeof typographySchema>;

/** Color detected in the screenshot */
export const colorSchema = z.object({
  /** Hex value */
  hex: z.string(),
  /** HSL value */
  hsl: z.string().optional(),
  /** Role/purpose (primary, background, text, border, accent, etc.) */
  role: z.string().optional(),
  /** Where it appears */
  usage: z.string().optional(),
  /** Frequency (0-1 relative) */
  frequency: z.number().optional(),
});

export type DetectedColor = z.infer<typeof colorSchema>;

/** Spacing pattern detected */
export const spacingSchema = z.object({
  /** Spacing value (e.g., "8px", "0.5rem") */
  value: z.string(),
  /** Where it appears */
  usage: z.string().optional(),
});

export type Spacing = z.infer<typeof spacingSchema>;

/** Layout structure detected */
export const layoutNodeSchema: z.ZodType<{
  type: "row" | "column" | "grid" | "stack" | "container" | "flex" | "unknown";
  alignment?: string;
  gap?: string;
  padding?: string;
  children?: unknown[];
  components?: string[];
}> = z.object({
  /** Layout type */
  type: z.enum(["row", "column", "grid", "stack", "container", "flex", "unknown"]),
  /** Alignment */
  alignment: z.string().optional().describe("e.g., center, start, space-between"),
  /** Gap between children */
  gap: z.string().optional(),
  /** Padding */
  padding: z.string().optional(),
  /** Children layout nodes */
  children: z.array(z.lazy(() => layoutNodeSchema)).optional(),
  /** Associated components in this layout */
  components: z.array(z.string()).optional().describe("Component types in this layout"),
});

export type LayoutNode = z.infer<typeof layoutNodeSchema>;

/** Full UI specification extracted from a screenshot */
export const uiSpecSchema = z.object({
  /** Overall layout tree */
  layout: layoutNodeSchema.optional(),
  /** Detected components */
  components: z.array(uiComponentSchema),
  /** All text content found */
  textContent: z.array(z.object({
    text: z.string(),
    /** Where the text appears (heading, body, button, label, etc.) */
    role: z.string().optional(),
    /** Estimated font size */
    fontSize: z.string().optional(),
    /** Font weight */
    fontWeight: z.number().or(z.string()).optional(),
  })),
  /** Typography information */
  typography: typographySchema.optional(),
  /** Colors detected */
  colors: z.array(colorSchema),
  /** Spacing patterns */
  spacing: z.array(spacingSchema),
  /** Responsive hints */
  responsiveHints: z.array(z.object({
    breakpoint: z.string().optional().describe("e.g., mobile, tablet, desktop"),
    observation: z.string().describe("What changes across breakpoints"),
  })).optional(),
  /** States visible in the screenshot */
  statesVisible: z.array(z.string()).optional().describe("e.g., default, hover, active, disabled, loading, empty, error"),
  /** Ambiguities or unknowns */
  ambiguities: z.array(z.string()).optional().describe("Things that couldn't be determined from the screenshot"),
  /** Accessibility notes */
  accessibilityNotes: z.array(z.string()).optional(),
  /** Overall confidence */
  confidence: z.number().min(0).max(1),
  /** Raw description from the vision model (fallback) */
  rawDescription: z.string().optional(),
});

export type UiSpec = z.infer<typeof uiSpecSchema>;
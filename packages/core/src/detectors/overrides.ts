import type { StackResult } from "../schemas";

/**
 * User-confirmed project overrides stored in opencode.json under
 * `ui2code.project`. When present, they take precedence over detection.
 */
export interface StackOverrides {
  packageManager?: string;
  language?: string;
  framework?: string;
  styling?: string;
}

const OVERRIDABLE_FIELDS = ["packageManager", "language", "framework", "styling"] as const;

/**
 * Apply user overrides (from `ui2code.project` in opencode.json) on top of a
 * detected stack result. Overridden fields get confidence 1 and evidence
 * pointing at the config source.
 */
export function applyStackOverrides(
  stack: StackResult,
  overrides?: StackOverrides | null
): StackResult {
  if (!overrides) return stack;
  for (const field of OVERRIDABLE_FIELDS) {
    const value = overrides[field];
    if (!value) continue;
    (stack[field] as { value: string; confidence: number; evidence: unknown[] }) = {
      value,
      confidence: 1,
      evidence: [{ file: "opencode.json", match: `ui2code.project.${field}` }],
    };
  }
  return stack;
}

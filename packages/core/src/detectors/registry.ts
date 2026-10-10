import type { StackResult } from "../schemas/stack";
import type { Evidence } from "../schemas/stack";

/** Context passed to every detector */
export interface DetectorContext {
  /** Absolute path to the project root */
  projectRoot: string;
  /** Contents of package.json (parsed), or null if not found */
  packageJson: Record<string, unknown> | null;
  /** List of files in the project root (non-recursive) */
  rootFiles: string[];
  /** Helper: read a file relative to project root, returns null if not found */
  readFile: (relativePath: string) => Promise<string | null>;
  /** Helper: check if a file exists relative to project root */
  fileExists: (relativePath: string) => Promise<boolean>;
  /** Helper: list files matching a glob pattern */
  glob: (pattern: string) => Promise<string[]>;
}

/** A single detector produces a partial result */
export type DetectorResult = Partial<StackResult>;

/** Detector interface — each detector is a small module */
export interface Detector {
  /** Unique name for this detector */
  name: string;
  /** Detect stack info from the project context */
  detect(ctx: DetectorContext): Promise<DetectorResult>;
}

/** Registry of all detectors */
const detectors: Detector[] = [];

/** Register a detector */
export function registerDetector(detector: Detector): void {
  detectors.push(detector);
}

/** Register multiple detectors */
export function registerDetectors(detectors: Detector[]): void {
  for (const d of detectors) {
    registerDetector(d);
  }
}

/** Get all registered detectors */
export function getDetectors(): Detector[] {
  return [...detectors];
}

/** Clear all detectors (for testing) */
export function clearDetectors(): void {
  detectors.length = 0;
}

/** Run all detectors and merge results */
export async function runDetectors(ctx: DetectorContext): Promise<StackResult> {
  const results = await Promise.all(
    detectors.map(async (d) => {
      try {
        return await d.detect(ctx);
      } catch {
        return {};
      }
    })
  );

  return mergeResults(results);
}

/** Merge multiple partial results into a single StackResult */
function mergeResults(results: DetectorResult[]): StackResult {
  const merged: Record<string, unknown> = {};

  for (const result of results) {
    for (const [key, value] of Object.entries(result)) {
      if (value !== undefined) {
        const existing = merged[key] as Record<string, unknown> | undefined;
        // For detected fields (objects with confidence), pick the one with higher confidence
        if (
          existing &&
          typeof existing === "object" &&
          "confidence" in existing &&
          typeof value === "object" &&
          value !== null &&
          "confidence" in value
        ) {
          if ((value as { confidence: number }).confidence > (existing as { confidence: number }).confidence) {
            merged[key] = value;
          }
        } else {
          merged[key] = value;
        }
      }
    }
  }

  // Fill in defaults for missing fields
  const defaults: Record<string, unknown> = {
    packageManager: { value: "unknown", confidence: 0, evidence: [] },
    language: { value: "unknown", confidence: 0, evidence: [] },
    framework: { value: "unknown", confidence: 0, evidence: [] },
    routingStyle: { value: "unknown", confidence: 0, evidence: [] },
    styling: { value: "unknown", confidence: 0, evidence: [] },
    componentLib: { value: "unknown", confidence: 0, evidence: [] },
    iconLib: { value: "unknown", confidence: 0, evidence: [] },
    animationLib: { value: "unknown", confidence: 0, evidence: [] },
    testSetup: { value: "unknown", confidence: 0, evidence: [] },
    monorepo: { value: "unknown", confidence: 0, evidence: [] },
  };

  for (const [key, defaultVal] of Object.entries(defaults)) {
    if (!merged[key]) {
      merged[key] = defaultVal;
    }
  }

  return merged as StackResult;
}
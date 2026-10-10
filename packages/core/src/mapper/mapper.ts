import type { UiSpec, UiComponent } from "../schemas/ui-spec";
import type { ConventionsResult, ReusablePrimitive } from "../schemas/conventions";

export interface MapToDesignSystemOptions {
  /** The UI spec extracted from screenshot analysis */
  uiSpec: UiSpec;
  /** Convention scan results from the project */
  conventions: ConventionsResult;
}

export interface MappedComponent {
  /** Component type from the UI spec */
  specType: string;
  /** Whether it matches an existing primitive */
  matchedPrimitive?: ReusablePrimitive;
  /** Whether it needs to be created */
  needsCreation: boolean;
  /** Suggested file path for new components */
  suggestedPath?: string;
  /** Reason for the mapping decision */
  reason: string;
}

export interface DesignSystemMapping {
  /** Components that can reuse existing primitives */
  reusable: MappedComponent[];
  /** Components that need to be created */
  toCreate: MappedComponent[];
  /** Design tokens to use */
  tokensToUse: {
    colors: Record<string, string>;
    spacing: Record<string, string>;
    borderRadius: Record<string, string>;
    shadows: Record<string, string>;
  };
  /** Primitives that exist but weren't matched (user should consider) */
  unmatchedPrimitives: ReusablePrimitive[];
  /** Confidence in the mapping */
  confidence: number;
}

/**
 * Map UI spec components to existing project primitives and design tokens.
 */
export function mapToDesignSystem(options: MapToDesignSystemOptions): DesignSystemMapping {
  const { uiSpec, conventions } = options;

  const reusable: MappedComponent[] = [];
  const toCreate: MappedComponent[] = [];
  const unmatchedPrimitives = [...conventions.primitives];

  // Build a lookup for existing primitives
  const primitiveMap = new Map<string, ReusablePrimitive>();
  for (const p of conventions.primitives) {
    primitiveMap.set(p.name.toLowerCase(), p);
    // Also register common aliases
    if (p.name === "Button") primitiveMap.set("cta", p);
    if (p.name === "Input") primitiveMap.set("textfield", p);
    if (p.name === "Card") primitiveMap.set("panel", p);
    if (p.name === "Dialog") primitiveMap.set("modal", p);
    if (p.name === "Badge") primitiveMap.set("tag", p);
  }

  // Map each component from the UI spec
  for (const component of uiSpec.components) {
    const mapped = mapComponent(component, primitiveMap, conventions, unmatchedPrimitives);
    if (mapped.matchedPrimitive) {
      reusable.push(mapped);
      // Remove from unmatched
      const idx = unmatchedPrimitives.findIndex((p) => p.name === mapped.matchedPrimitive?.name);
      if (idx >= 0) unmatchedPrimitives.splice(idx, 1);
    } else {
      toCreate.push(mapped);
    }
  }

  // Build token map from conventions
  const tokensToUse = {
    colors: conventions.tokens.colors || {},
    spacing: conventions.tokens.spacing || {},
    borderRadius: conventions.tokens.borderRadius || {},
    shadows: conventions.tokens.shadows || {},
  };

  const confidence = conventions.confidence * (reusable.length > 0 ? 0.9 : 0.7);

  return {
    reusable,
    toCreate,
    tokensToUse,
    unmatchedPrimitives,
    confidence,
  };
}

function mapComponent(
  component: UiComponent,
  primitiveMap: Map<string, ReusablePrimitive>,
  conventions: ConventionsResult,
  unmatchedPrimitives: ReusablePrimitive[]
): MappedComponent {
  const specType = component.type;
  const normalizedName = specType.toLowerCase();

  // Direct match
  const directMatch = primitiveMap.get(normalizedName);
  if (directMatch) {
    return {
      specType,
      matchedPrimitive: directMatch,
      needsCreation: false,
      reason: `Direct match with existing ${directMatch.name} at ${directMatch.filePath}`,
    };
  }

  // Fuzzy match — check if any primitive name is contained in the spec type or vice versa
  for (const [key, primitive] of primitiveMap) {
    if (
      normalizedName.includes(key) ||
      key.includes(normalizedName) ||
      isSemanticMatch(specType, primitive.name)
    ) {
      return {
        specType,
        matchedPrimitive: primitive,
        needsCreation: false,
        reason: `Fuzzy match: "${specType}" → existing ${primitive.name} at ${primitive.filePath}`,
      };
    }
  }

  // No match — needs creation
  const suggestedPath = suggestPath(specType, conventions);

  return {
    specType,
    needsCreation: true,
    suggestedPath,
    reason: `No existing primitive found for "${specType}". Suggested path: ${suggestedPath}`,
  };
}

/** Check if two component names are semantically equivalent */
function isSemanticMatch(specType: string, primitiveName: string): boolean {
  const synonyms: Record<string, string[]> = {
    button: ["btn", "cta", "action-button", "action"],
    input: ["textfield", "text-field", "text-input", "form-input"],
    card: ["panel", "tile", "box"],
    dialog: ["modal", "popup", "overlay"],
    badge: ["tag", "chip", "label"],
    avatar: ["profile-pic", "user-image", "profile-image"],
    select: ["dropdown", "combobox"],
    checkbox: ["check", "tick"],
    radio: ["radio-button", "option"],
    switch: ["toggle"],
    textarea: ["text-area", "multiline-input"],
    tooltip: ["hint", "popover-hint"],
    alert: ["banner", "notification-bar"],
    table: ["data-table", "grid-view"],
    sidebar: ["drawer", "side-panel"],
    header: ["top-bar", "navbar", "app-bar"],
    footer: ["bottom-bar"],
    navigation: ["nav", "menu"],
    container: ["wrapper", "section"],
    divider: ["separator", "hr"],
    icon: ["icon-button"],
    link: ["anchor"],
    skeleton: ["placeholder", "loading-skeleton"],
    spinner: ["loader", "loading-indicator"],
  };

  const specLower = specType.toLowerCase();
  const primLower = primitiveName.toLowerCase();

  for (const [key, alts] of Object.entries(synonyms)) {
    const group = [key, ...alts];
    if (group.includes(specLower) && group.includes(primLower)) return true;
  }

  return false;
}

/** Suggest a file path for a new component */
function suggestPath(specType: string, conventions: ConventionsResult): string {
  const dir = conventions.componentsDir || "src/components";
  const naming = conventions.fileNaming;

  let fileName: string;
  switch (naming) {
    case "kebab-case":
      fileName = toKebabCase(specType);
      break;
    case "camelCase":
      fileName = toCamelCase(specType);
      break;
    case "PascalCase":
    default:
      fileName = toPascalCase(specType);
      break;
  }

  // Add appropriate extension based on detected framework
  const ext = ".tsx"; // default, would be overridden by framework detection
  return `${dir}/${fileName}${ext}`;
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

function toCamelCase(str: string): string {
  return toPascalCase(str).replace(/^(.)/, (_, c) => c.toLowerCase());
}
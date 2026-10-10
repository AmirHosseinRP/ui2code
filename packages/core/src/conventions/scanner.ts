import * as fs from "node:fs";
import * as path from "node:path";
import type {
  ConventionsResult,
  ComponentConventions,
  NamingConvention,
  ExportStyle,
  PropsTypingStyle,
  StyleCoLocation,
  ComponentLocation,
  TokenUsage,
  DesignTokens,
  ReusablePrimitive,
} from "../schemas/conventions";

export interface ScanConventionsOptions {
  /** Absolute path to the project root */
  projectRoot: string;
  /** Maximum number of components to sample (default: 5) */
  sampleSize?: number;
  /** Stack info from detectStack to guide scanning */
  framework?: string;
  /** Styling approach from detectStack */
  styling?: string;
}

/**
 * Scan project conventions by sampling representative components.
 */
export async function scanConventions(options: ScanConventionsOptions): Promise<ConventionsResult> {
  const { projectRoot, sampleSize = 5, framework, styling } = options;

  // 1. Find component files
  const componentFiles = findComponentFiles(projectRoot, framework);
  const totalComponents = componentFiles.length;

  // 2. Sample representative components
  const sampled = sampleComponents(componentFiles, sampleSize);

  // 3. Analyze each sampled component
  const components: ComponentConventions[] = [];
  for (const filePath of sampled) {
    const content = readFile(path.join(projectRoot, filePath));
    if (content) {
      components.push(analyzeComponent(filePath, content, projectRoot));
    }
  }

  // 4. Aggregate conventions from samples
  const fileNaming = aggregateNaming(components.map((c) => c.fileNaming));
  const exportStyle = aggregateEnum(components.map((c) => c.exportStyle)) as ExportStyle;
  const propsTyping = aggregateEnum(components.map((c) => c.propsTyping)) as PropsTypingStyle;
  const styleCoLocation = aggregateEnum(components.map((c) => c.styleCoLocation)) as StyleCoLocation;

  // 5. Detect component location
  const { componentLocation, componentsDir } = detectComponentLocation(componentFiles);

  // 6. Detect folder naming convention
  const folderNaming = detectFolderNaming(projectRoot, componentFiles);

  // 7. Extract design tokens
  const { tokens, tokenUsage } = extractDesignTokens(projectRoot, styling);

  // 8. Find reusable primitives
  const primitives = findReusablePrimitives(projectRoot, componentFiles, components);

  // 9. Calculate confidence
  const confidence = components.length > 0 ? Math.min(0.5 + components.length * 0.1, 0.95) : 0;

  return {
    componentLocation,
    componentsDir,
    fileNaming,
    folderNaming,
    exportStyle,
    propsTyping,
    styleCoLocation,
    tokenUsage,
    tokens,
    primitives,
    components,
    totalComponents,
    confidence,
  };
}

/** Find all component-like files in the project */
function findComponentFiles(projectRoot: string, framework?: string): string[] {
  const extensions = getComponentExtensions(framework);
  const searchDirs = ["src", "app", "lib", "components"];
  const files: string[] = [];

  for (const dir of searchDirs) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      walkDir(fullPath, projectRoot, extensions, files);
    }
  }

  // Also check root-level components dir
  const rootComponents = path.join(projectRoot, "components");
  if (fs.existsSync(rootComponents)) {
    walkDir(rootComponents, projectRoot, extensions, files);
  }

  // Filter to likely component files (not utils, hooks, configs, etc.)
  return files.filter((f) => isComponentFile(f));
}

function walkDir(dir: string, root: string, extensions: string[], files: string[]): void {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist" || entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath, root, extensions, files);
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        files.push(path.relative(root, fullPath));
      }
    }
  } catch {
    // skip inaccessible dirs
  }
}

function getComponentExtensions(framework?: string): string[] {
  switch (framework) {
    case "vue":
    case "nuxt":
      return [".vue"];
    case "svelte":
    case "sveltekit":
      return [".svelte"];
    case "angular":
      return [".component.ts"];
    default:
      return [".tsx", ".jsx"];
  }
}

function isComponentFile(filePath: string): boolean {
  const name = path.basename(filePath);
  // Exclude test files, stories, configs, hooks, utils, types
  const excludePatterns = [
    /\.test\./,
    /\.spec\./,
    /\.stories\./,
    /\.story\./,
    /\.config\./,
    /\.d\.ts$/,
    /use[A-Z]/, // hooks
    /\.util\./,
    /\.utils\./,
    /\.helper\./,
    /\.helpers\./,
    /types\./,
    /index\./,
    /_app\./,
    /_document\./,
    /layout\./,
    /page\./,
    /loading\./,
    /error\./,
    /not-found\./,
    /global\./,
    /globals\./,
  ];
  return !excludePatterns.some((p) => p.test(name));
}

/** Sample components: prefer files in components/ dirs, pick diverse paths */
function sampleComponents(files: string[], count: number): string[] {
  if (files.length <= count) return files;

  // Prefer files in component directories
  const inComponents = files.filter((f) => f.includes("component") || f.includes("ui/") || f.includes("lib/"));
  const others = files.filter((f) => !inComponents.includes(f));

  const sampled: string[] = [];
  for (const f of inComponents) {
    if (sampled.length >= count) break;
    sampled.push(f);
  }
  for (const f of others) {
    if (sampled.length >= count) break;
    if (!sampled.includes(f)) sampled.push(f);
  }

  return sampled.slice(0, count);
}

/** Analyze a single component file */
function analyzeComponent(filePath: string, content: string, projectRoot: string): ComponentConventions {
  const fileName = path.basename(filePath);
  const fileNaming = detectFileNaming(fileName);
  const exportStyle = detectExportStyle(content);
  const propsTyping = detectPropsTyping(content);
  const propsTypeName = detectPropsTypeName(content);
  const styleCoLocation = detectStyleCoLocation(content, filePath, projectRoot);
  const usesTypeScript = filePath.endsWith(".ts") || filePath.endsWith(".tsx") ||
    (filePath.endsWith(".vue") && /<script[^>]*\blang\s*=\s*['"]ts['"]/.test(content)) ||
    (filePath.endsWith(".svelte") && /<script[^>]*\blang\s*=\s*['"]ts['"]/.test(content));
  const usesForwardRef = content.includes("forwardRef");
  const usesHooks = detectHooks(content);
  const relatedFiles = findRelatedFiles(filePath, projectRoot);
  const { internalImports, externalImports } = parseImports(content, projectRoot);

  return {
    filePath,
    fileName,
    fileNaming,
    exportStyle,
    propsTyping,
    propsTypeName,
    styleCoLocation,
    usesTypeScript,
    usesForwardRef,
    usesHooks,
    relatedFiles,
    internalImports,
    externalImports,
  };
}

function detectFileNaming(fileName: string): NamingConvention {
  const name = fileName.replace(/\.[^.]+$/, ""); // strip extension
  if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return "PascalCase";
  if (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) return "kebab-case";
  if (/^[a-z][a-zA-Z0-9]*$/.test(name)) return "camelCase";
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name)) return "snake_case";
  return "mixed";
}

function detectExportStyle(content: string): ExportStyle {
  const hasDefault = /export\s+default\s/.test(content);
  const hasNamed = /export\s+(const|function|class|let|var|enum|interface|type)\s/.test(content) ||
    /export\s*\{/.test(content);

  if (hasDefault && hasNamed) return "mixed";
  if (hasDefault) return "default";
  if (hasNamed) return "named";
  return "unknown";
}

function detectPropsTyping(content: string): PropsTypingStyle {
  if (/interface\s+\w+Props\b/.test(content)) return "interface";
  if (/type\s+\w+Props\b/.test(content)) return "type";
  if (/:\s*(React\.)?(FC|FunctionComponent|VFC)\b/.test(content)) return "type";
  if (/\{[^}]*\}\s*:\s*(React\.)?(HTMLAttributes|ButtonHTMLAttributes)/.test(content)) return "inline";
  if (/props\s*:\s*\{/.test(content)) return "inline";
  if (/\.tsx$/.test(content) || /\.jsx$/.test(content)) return "none";
  return "unknown";
}

function detectPropsTypeName(content: string): string | undefined {
  const interfaceMatch = content.match(/interface\s+(\w+Props)\b/);
  if (interfaceMatch) return interfaceMatch[1];
  const typeMatch = content.match(/type\s+(\w+Props)\b/);
  if (typeMatch) return typeMatch[1];
  return undefined;
}

function detectStyleCoLocation(content: string, filePath: string, projectRoot: string): StyleCoLocation {
  // Tailwind classes in JSX
  if (/className=/.test(content) && (/bg-|text-|p-|m-|flex|grid|rounded/.test(content) || /\bcn\(|\bclsx\(|\btailwind-merge/.test(content))) {
    return "tailwind-only";
  }
  // styled-components
  if (/styled\./.test(content) || /styled\(/.test(content)) return "styled-components";
  // Emotion
  if (/@emotion/.test(content) || /css`/.test(content)) return "emotion";
  // CSS modules (import styles from *.module.css)
  if (/import\s+\w+\s+from\s+['"].*\.module\.css/.test(content)) return "css-modules";
  if (/import\s+\w+\s+from\s+['"].*\.module\.scss/.test(content)) return "scss-module";
  // Inline styles in same file
  if (/<style[\s>]/.test(content) || /styles\s*=\s*\{/.test(content)) return "same-file";
  // Separate CSS import
  if (/import\s+['"].*\.css['"]/.test(content)) return "separate-css";
  return "unknown";
}

function detectHooks(content: string): string[] {
  const hooks: string[] = [];
  const hookPattern = /\b(use[A-Z]\w+)\s*\(/g;
  let match;
  while ((match = hookPattern.exec(content)) !== null) {
    if (!hooks.includes(match[1])) hooks.push(match[1]);
  }
  return hooks;
}

function findRelatedFiles(filePath: string, projectRoot: string): string[] {
  const dir = path.dirname(path.join(projectRoot, filePath));
  const baseName = path.basename(filePath, path.extname(filePath));
  const related: string[] = [];

  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (entry === path.basename(filePath)) continue;
      if (entry.startsWith(baseName) || entry.startsWith(baseName.toLowerCase())) {
        related.push(path.relative(projectRoot, path.join(dir, entry)));
      }
    }
  } catch {
    // skip
  }

  return related;
}

function parseImports(content: string, projectRoot: string): { internalImports: string[]; externalImports: string[] } {
  const internalImports: string[] = [];
  const externalImports: string[] = [];
  const importPattern = /from\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = importPattern.exec(content)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith(".") || importPath.startsWith("@/") || importPath.startsWith("~/")) {
      internalImports.push(importPath);
    } else {
      const pkg = importPath.startsWith("@") ? importPath.split("/").slice(0, 2).join("/") : importPath.split("/")[0];
      if (!externalImports.includes(pkg)) externalImports.push(pkg);
    }
  }

  return { internalImports, externalImports };
}

function detectComponentLocation(files: string[]): { componentLocation: ComponentLocation; componentsDir?: string } {
  const dirCounts: Record<string, number> = {};

  for (const f of files) {
    const parts = f.split(/[/\\]/);
    // Find the directory that contains the most components
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join("/");
      dirCounts[dir] = (dirCounts[dir] || 0) + 1;
    }
  }

  // Find the most common parent directory
  let bestDir = "";
  let bestCount = 0;
  for (const [dir, count] of Object.entries(dirCounts)) {
    if (count > bestCount && !dir.includes("node_modules")) {
      bestDir = dir;
      bestCount = count;
    }
  }

  if (bestDir.includes("src/components") || bestDir.includes("app/components")) {
    return { componentLocation: bestDir.includes("app/") ? "app/components" : "src/components", componentsDir: bestDir };
  }
  if (bestDir.includes("components")) return { componentLocation: "components", componentsDir: bestDir };
  if (bestDir.includes("src/lib") || bestDir.includes("lib/")) return { componentLocation: "src/lib", componentsDir: bestDir };

  return { componentLocation: files.length > 0 ? "unknown" : "unknown", componentsDir: bestDir || undefined };
}

function detectFolderNaming(projectRoot: string, files: string[]): NamingConvention {
  const dirs = new Set<string>();
  for (const f of files) {
    const parts = f.split(/[/\\]/);
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts[i]);
    }
  }

  const names = [...dirs].filter((d) => d !== "src" && d !== "app" && d !== "lib" && d !== "components" && d !== "ui");
  if (names.length === 0) return "unknown";

  let pascal = 0, kebab = 0, camel = 0;
  for (const name of names) {
    if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) pascal++;
    else if (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) kebab++;
    else if (/^[a-z][a-zA-Z0-9]*$/.test(name)) camel++;
  }

  if (pascal > kebab && pascal > camel) return "PascalCase";
  if (kebab > camel) return "kebab-case";
  if (camel > 0) return "camelCase";
  return "unknown";
}

function extractDesignTokens(projectRoot: string, styling?: string): { tokens: DesignTokens; tokenUsage: TokenUsage } {
  const tokens: DesignTokens = {};
  let tokenUsage: TokenUsage = "unknown";

  // Check tailwind config
  const tailwindConfig = readFile(path.join(projectRoot, "tailwind.config.ts")) ||
    readFile(path.join(projectRoot, "tailwind.config.js")) ||
    readFile(path.join(projectRoot, "tailwind.config.mjs"));

  if (tailwindConfig) {
    tokenUsage = "tailwind-config";
    tokens.source = "tailwind.config";
    tokens.colors = extractTailwindColors(tailwindConfig);
    tokens.borderRadius = extractTailwindValues(tailwindConfig, "borderRadius");
    tokens.shadows = extractTailwindValues(tailwindConfig, "boxShadow");
  }

  // Check for CSS variables in global CSS
  const globalCss = readFile(path.join(projectRoot, "src/index.css")) ||
    readFile(path.join(projectRoot, "src/globals.css")) ||
    readFile(path.join(projectRoot, "app/globals.css")) ||
    readFile(path.join(projectRoot, "src/styles/globals.css"));

  if (globalCss) {
    const cssVars = extractCssVariables(globalCss);
    if (Object.keys(cssVars).length > 0) {
      if (tokenUsage === "unknown") tokenUsage = "css-variables";
      tokens.colors = { ...cssVars, ...tokens.colors };
    }
  }

  return { tokens, tokenUsage };
}

function extractTailwindColors(config: string): Record<string, string> {
  const colors: Record<string, string> = {};
  // Match theme.extend.colors or theme.colors
  const colorBlock = config.match(/colors\s*:\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/);
  if (colorBlock) {
    const content = colorBlock[1];
    const colorPattern = /(\w+)\s*:\s*['"]?([^'",\s]+)['"]?/g;
    let match;
    while ((match = colorPattern.exec(content)) !== null) {
      colors[match[1]] = match[2];
    }
  }
  return colors;
}

function extractTailwindValues(config: string, key: string): Record<string, string> {
  const values: Record<string, string> = {};
  const block = new RegExp(`${key}\\s*:\\s*\\{([^}]+)\\}`);
  const match = config.match(block);
  if (match) {
    const pattern = /(\w+)\s*:\s*['"]?([^'",\s]+)['"]?/g;
    let m;
    while ((m = pattern.exec(match[1])) !== null) {
      values[m[1]] = m[2];
    }
  }
  return values;
}

function extractCssVariables(css: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const pattern = /--([\w-]+)\s*:\s*([^;]+)/g;
  let match;
  while ((match = pattern.exec(css)) !== null) {
    vars[match[1]] = match[2].trim();
  }
  return vars;
}

function findReusablePrimitives(
  projectRoot: string,
  componentFiles: string[],
  analyzed: ComponentConventions[]
): ReusablePrimitive[] {
  const primitives: ReusablePrimitive[] = [];
  const primitiveNames = ["Button", "Input", "Card", "Badge", "Avatar", "Dialog", "Modal", "Select", "Checkbox", "Radio", "Switch", "Tabs", "Accordion", "Dropdown", "Tooltip", "Popover", "Sheet", "Table", "Form", "Label", "Textarea", "Slider", "Progress", "Skeleton", "Spinner", "Alert", "Toast", "Breadcrumb", "Pagination", "Navigation", "Sidebar", "Header", "Footer", "Container", "Stack", "Grid", "Flex", "Box", "Text", "Heading", "Link", "Icon", "Separator", "Divider"];

  for (const filePath of componentFiles) {
    const fileName = path.basename(filePath, path.extname(filePath));
    // Check if this is a known primitive
    const isPrimitive = primitiveNames.some((p) => fileName === p || fileName.toLowerCase() === p.toLowerCase());
    if (isPrimitive) {
      const content = readFile(path.join(projectRoot, filePath));
      const exports = content ? extractExportNames(content) : [];
      primitives.push({
        name: fileName,
        filePath,
        exports,
        isFromLib: false,
      });
    }
  }

  return primitives;
}

function extractExportNames(content: string): string[] {
  const names: string[] = [];
  // export const/function/class Name
  const namedExportPattern = /export\s+(?:const|function|class)\s+(\w+)/g;
  let match;
  while ((match = namedExportPattern.exec(content)) !== null) {
    names.push(match[1]);
  }
  // export { Name1, Name2 }
  const reExportPattern = /export\s*\{([^}]+)\}/g;
  while ((match = reExportPattern.exec(content)) !== null) {
    const inner = match[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    names.push(...inner);
  }
  // export default
  if (/export\s+default\s/.test(content)) {
    names.push("default");
  }
  return names;
}

function readFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function aggregateNaming(values: NamingConvention[]): NamingConvention {
  const counts: Record<string, number> = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown") as NamingConvention;
}

function aggregateEnum(values: string[]): string {
  const counts: Record<string, number> = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
}
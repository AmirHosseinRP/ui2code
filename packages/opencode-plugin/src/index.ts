import { z } from "zod";
import {
  detectStack,
  scanConventions,
  readImage,
  analyzeScreenshot,
  mapToDesignSystem,
  writeComponentFiles,
  formatWriteResult,
  verifyProject,
  formatVerifyResult,
  resolveModelConfig,
  readUi2codeConfig,
  applyStackOverrides,
} from "@ui2code/core";
import type { UiSpec } from "@ui2code/core";

/**
 * ui2code OpenCode plugin.
 *
 * Ships as a single self-contained file that `ui2code init` copies into the
 * target project's `.opencode/plugins/` directory (auto-loaded by OpenCode).
 *
 * Supports both plugin generations from one module:
 * - OpenCode v2 (2.x): default export with `id` + `setup(ctx)`, tools are
 *   registered through `ctx.tool.transform(...)` with JSON Schema inputs.
 * - OpenCode v1 (>= 1.18.29): the `server()` entrypoint returns the classic
 *   hooks object with a `tool` map built from zod schemas.
 */

type ToolArgs = Record<string, unknown>;

interface ToolDef {
  description: string;
  /** Zod shape for the v1 tool API. */
  v1Args: () => Record<string, z.ZodTypeAny>;
  /** JSON Schema for the v2 tool API. */
  v2Input: Record<string, unknown>;
  /** Shared implementation. Returns tool output as text (usually JSON). */
  execute: (args: ToolArgs, directory: string) => Promise<string>;
}

const tools: Record<string, ToolDef> = {
  detect_stack: {
    description:
      "Detect the target project's technology stack: package manager, language, framework, routing style, styling approach, component library, icon/animation libraries, test setup, monorepo status, path aliases, and lint/format config.",
    v1Args: () => ({}),
    v2Input: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    async execute(_args, directory) {
      const result = await detectStack({ projectRoot: directory });
      // User-confirmed overrides from ui2code.project in opencode.json win.
      applyStackOverrides(result, readUi2codeConfig(directory).project);
      return JSON.stringify(result, null, 2);
    },
  },

  scan_conventions: {
    description:
      "Sample existing components and extract project conventions: file/folder naming, export style, props typing, styling co-location, design tokens, and reusable primitives.",
    v1Args: () => ({}),
    v2Input: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    async execute(_args, directory) {
      const stack = await detectStack({ projectRoot: directory });
      applyStackOverrides(stack, readUi2codeConfig(directory).project);
      const result = await scanConventions({
        projectRoot: directory,
        framework: stack.framework.value,
        styling: stack.styling.value,
      });
      return JSON.stringify(result, null, 2);
    },
  },

  analyze_screenshot: {
    description:
      "Analyze a UI screenshot and extract a structured specification: layout tree, components, text content, typography, colors, spacing, states, responsive hints, accessibility notes, and ambiguities. Requires a vision-capable model configured via UI2CODE_VISION_MODEL env var or ui2code.visionModel in opencode.json.",
    v1Args: () => ({
      image_path: z.string().describe("Path to the screenshot image file (PNG, JPG, WebP)"),
      brief: z.string().optional().describe("Optional text brief describing what the UI should do"),
    }),
    v2Input: {
      type: "object",
      properties: {
        image_path: {
          type: "string",
          description: "Path to the screenshot image file (PNG, JPG, WebP)",
        },
        brief: {
          type: "string",
          description: "Optional text brief describing what the UI should do",
        },
      },
      required: ["image_path"],
      additionalProperties: false,
    },
    async execute(args, directory) {
      const modelConfig = resolveModelConfig(directory);
      const image = await readImage(String(args.image_path));
      const result = await analyzeScreenshot({
        images: [image],
        brief: args.brief ? String(args.brief) : undefined,
        modelConfig,
      });
      return JSON.stringify(result, null, 2);
    },
  },

  map_to_design_system: {
    description:
      "Map UI spec components to existing project primitives and design tokens. Identifies which components can be reused, which need to be created, and which tokens to use.",
    v1Args: () => ({
      ui_spec: z.string().describe("JSON string of the UI spec from analyze_screenshot"),
      conventions: z.string().describe("JSON string of the conventions from scan_conventions"),
    }),
    v2Input: {
      type: "object",
      properties: {
        ui_spec: {
          type: "string",
          description: "JSON string of the UI spec from analyze_screenshot",
        },
        conventions: {
          type: "string",
          description: "JSON string of the conventions from scan_conventions",
        },
      },
      required: ["ui_spec", "conventions"],
      additionalProperties: false,
    },
    async execute(args) {
      const uiSpec = JSON.parse(String(args.ui_spec)) as UiSpec;
      const conventions = JSON.parse(String(args.conventions));
      const result = mapToDesignSystem({ uiSpec, conventions });
      return JSON.stringify(result, null, 2);
    },
  },

  write_component_files: {
    description:
      "Write component files to the project. Supports dry-run mode. Never overwrites existing files unless explicitly requested. All paths are confined to the project root.",
    v1Args: () => ({
      files: z
        .string()
        .describe('JSON array of files to write: [{"filePath": "src/Foo.tsx", "content": "...", "overwrite": false}]'),
      dry_run: z.boolean().optional().describe("If true, don't write — just report what would happen"),
    }),
    v2Input: {
      type: "object",
      properties: {
        files: {
          type: "string",
          description:
            'JSON array of files to write: [{"filePath": "src/Foo.tsx", "content": "...", "overwrite": false}]',
        },
        dry_run: {
          type: "boolean",
          description: "If true, don't write — just report what would happen",
        },
      },
      required: ["files"],
      additionalProperties: false,
    },
    async execute(args, directory) {
      const files = JSON.parse(String(args.files));
      const result = await writeComponentFiles({
        projectRoot: directory,
        files,
        dryRun: args.dry_run === true,
      });
      return formatWriteResult(result);
    },
  },

  verify_project: {
    description:
      "Run the project's own typecheck, lint, and build scripts (detected from package.json). Returns structured errors. Never runs arbitrary commands outside detected scripts.",
    v1Args: () => ({
      scripts: z
        .string()
        .optional()
        .describe('JSON array of script names to run, e.g. ["typecheck", "lint"]. If omitted, auto-detects.'),
    }),
    v2Input: {
      type: "object",
      properties: {
        scripts: {
          type: "string",
          description:
            'JSON array of script names to run, e.g. ["typecheck", "lint"]. If omitted, auto-detects.',
        },
      },
      additionalProperties: false,
    },
    async execute(args, directory) {
      const scripts = args.scripts ? JSON.parse(String(args.scripts)) : undefined;
      const result = await verifyProject({
        projectRoot: directory,
        scripts,
      });
      return formatVerifyResult(result);
    },
  },
};

// ---------------------------------------------------------------------------
// OpenCode v2 entrypoint (2.x): default export with id + setup(ctx)
// ---------------------------------------------------------------------------

interface V2ToolEditor {
  add(definition: {
    name: string;
    description: string;
    input: Record<string, unknown>;
    execute: (input: ToolArgs) => Promise<{ content: string }>;
  }): void;
}

interface V2SetupContext {
  location?: { directory?: string };
  tool: { transform(callback: (editor: V2ToolEditor) => void): Promise<unknown> };
}

function setup(ctx: V2SetupContext): void {
  const directory = ctx.location?.directory ?? process.cwd();
  void ctx.tool.transform((editor: V2ToolEditor) => {
    for (const [name, def] of Object.entries(tools)) {
      editor.add({
        name,
        description: def.description,
        input: def.v2Input,
        execute: async (input: ToolArgs) => ({
          content: await def.execute(input ?? {}, directory),
        }),
      });
    }
  });
}

// ---------------------------------------------------------------------------
// OpenCode v1 entrypoint (>= 1.18.29): classic hooks object with a tool map
// ---------------------------------------------------------------------------

interface V1ToolContext {
  directory: string;
}

function server(): { tool: Record<string, unknown> } {
  const toolMap: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(tools)) {
    toolMap[name] = {
      description: def.description,
      args: def.v1Args(),
      execute: (args: ToolArgs, context: V1ToolContext) => def.execute(args ?? {}, context.directory),
    };
  }
  return { tool: toolMap };
}

/**
 * Dual-shape default export:
 * - v2 reads `{ id, setup }` (extra keys are ignored),
 * - v1 reads `{ server }` and calls it to get the hooks object.
 */
const plugin = {
  id: "ui2code",
  setup,
  server,
};

export default plugin;

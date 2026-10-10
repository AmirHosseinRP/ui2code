# Extending ui2code

## Adding a New Framework Detector

Create a new file in `packages/core/src/detectors/`:

```typescript
// my-framework.ts
import type { Detector, DetectorContext, DetectorResult } from "./registry";

async function detect(ctx: DetectorContext): Promise<DetectorResult> {
  const evidence: { file: string; match?: string }[] = [];

  if (ctx.packageJson) {
    const deps = {
      ...((ctx.packageJson.dependencies as Record<string, string>) ?? {}),
      ...((ctx.packageJson.devDependencies as Record<string, string>) ?? {}),
    };

    if (deps["my-framework"]) {
      evidence.push({ file: "package.json", match: "my-framework in dependencies" });
      return {
        framework: { value: "my-framework", confidence: 0.9, evidence },
      };
    }
  }

  return {};
}

export const myFrameworkDetector: Detector = {
  name: "my-framework",
  detect,
};
```

Register it in `packages/core/src/detectors/index.ts`:

```typescript
import { myFrameworkDetector } from "./my-framework";

export function registerBuiltinDetectors(): void {
  // ... existing detectors
  registerDetector(myFrameworkDetector);
}
```

Add a fixture project in `fixtures/my-framework/` with the minimal config files.

Add tests in `packages/core/src/detectors/detectors.test.ts`.

## Adding a New Generation Strategy

Create a file in `packages/core/src/generator/`:

```typescript
// my-framework.ts
import type { GenerationStrategy, GenerationContext } from "./strategy";

export const myFrameworkStrategy: GenerationStrategy = {
  name: "my-framework",
  canHandle(framework: string) {
    return framework === "my-framework";
  },
  generate(ctx: GenerationContext) {
    // Generate component code
    return {
      files: [{
        filePath: `${ctx.componentsDir}/${ctx.componentName}.tsx`,
        content: generateComponent(ctx),
      }],
    };
  },
};
```

## Adding a New Design-Source Adapter

Create an interface in `packages/core/src/sources/`:

```typescript
// figma.ts
export interface ScreenshotSource {
  /** Get images from the source */
  getImages(): Promise<ImageInfo[]>;
  /** Get metadata (component name, variants, etc.) */
  getMetadata(): Promise<Record<string, unknown>>;
}

export class FigmaSource implements ScreenshotSource {
  constructor(private fileId: string, private nodeId: string) {}

  async getImages() {
    // Fetch from Figma API
  }

  async getMetadata() {
    // Fetch component metadata
  }
}
```

## Adding a New Tool

Create a file in `packages/core/src/` with your tool logic.

Register it in `packages/opencode-plugin/src/index.ts`:

```typescript
my_tool: tool({
  description: "What my tool does",
  args: {
    input: tool.schema.string().describe("Tool input"),
  },
  async execute(args, context) {
    const result = await myToolFunction({
      projectRoot: context.directory,
      input: args.input,
    });
    return JSON.stringify(result, null, 2);
  },
}),
```

## Testing

Run all tests:
```bash
pnpm test
```

Run a specific test file:
```bash
pnpm vitest run packages/core/src/detectors/detectors.test.ts
```

Add fixture projects in `fixtures/` for each new framework/styling combination.
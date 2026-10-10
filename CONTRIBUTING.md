# Contributing

## Development Setup

```bash
# Clone the repo
git clone https://github.com/your-org/ui2code.git
cd ui2code

# Install dependencies (pnpm required for contributors)
pnpm install

# Build all packages
pnpm build
```

Requires Node >= 18 and pnpm >= 9.

## Development Commands

| Command | Description |
|---|---|
| `pnpm build` | Build all packages (core → plugin → cli) |
| `pnpm test` | Run the test suite (vitest) |
| `pnpm typecheck` | Type-check all packages |
| `pnpm lint` | Lint source files (ESLint 9 flat config) |
| `pnpm test:watch` | Run tests in watch mode |

## Monorepo Layout

```
packages/
├── core/               @ui2code/core
│   └── src/
│       ├── config/         Model config resolution, env file/auth store readers
│       ├── detectors/      Stack detection (package manager, framework, styling, ...)
│       ├── conventions/    Convention scanning (naming, exports, design tokens)
│       ├── screenshot/     Image utils, vision model API caller, screenshot analyzer
│       ├── mapper/         UI-spec-to-design-system mapping
│       ├── writer/         Safe file writer with path confinement
│       ├── verification/   Typecheck/lint/build runner
│       └── schemas/        Zod schemas (StackResult, ConventionsResult, UiSpec)
│
├── opencode-plugin/    @ui2code/opencode-plugin (bundled into the CLI)
│   └── src/
│       └── index.ts        Dual v1/v2 plugin: 6 custom tools for OpenCode
│
└── cli/                ui2code (published to npm)
    ├── src/
    │   ├── commands/       init (wizard), run (progress UI), doctor (checks + fix)
    │   ├── assets.ts       Template and plugin bundle resolution via import.meta.url
    │   ├── install.ts      Config merge, file writing, gitignore, env key storage
    │   ├── models.ts       Provider catalog and credential detection
    │   ├── project.ts      Project detection, OpenCode detection
    │   ├── prompter.ts     @clack/prompts wrapper (injectable for tests)
    │   └── input.ts        Image input resolution (file/URL/clipboard) and validation
    └── templates/          Agent and command markdown files (shipped in the npm package)
```

## Package Relationships

- **core** is the library — framework-agnostic, no CLI dependencies, used by both the plugin and the CLI
- **opencode-plugin** wraps core functions as OpenCode tools — bundled into the CLI's dist at build time (not published separately)
- **cli** is the published package — bundles everything into two self-contained files (`dist/index.js` + `dist/plugin.mjs`) with zero runtime dependencies

The CLI's `tsup` build inlines all dependencies (commander, zod, @ui2code/core, etc.) so end users never need to install anything beyond the `ui2code` package itself.

## Templates

Agent and command markdown files live in `packages/cli/templates/` — this is the single source of truth. They're shipped in the npm package and resolved at runtime via `import.meta.url`.

The root `.opencode/` directory mirrors these templates for the repo's own OpenCode development. Keep them in sync manually when updating templates.

## Adding a New Detector

1. Create a module in `packages/core/src/detectors/` implementing the `Detector` interface
2. Register it in `packages/core/src/detectors/index.ts`
3. Add a fixture project in `fixtures/` and a test in `packages/core/src/detectors/detectors.test.ts`

## Adding a New Provider

1. Add the provider to `PROVIDERS` in `packages/cli/src/models.ts`
2. Add the base URL to `getDefaultBaseURL()` in `packages/core/src/screenshot/vision-model.ts`
3. Add the auth store ID to `PROVIDER_AUTH_IDS` in `packages/core/src/config/resolver.ts`
4. Update `docs/models.md` and the README providers table

## Testing

```bash
pnpm test                    # run all tests
pnpm vitest run packages/cli # run CLI tests only
```

Tests use temp directories (via `os.tmpdir()`) and the fixture projects in `fixtures/`. The test suite runs with a 20s timeout per test (Windows shell spawns are slow).

## Commit Conventions

Use conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`.

## Publishing

The CLI is published to npm as `ui2code` (unscoped). The release workflow is triggered by pushing a `v*` tag:

```bash
# bump version in packages/cli/package.json
npm version patch  # or minor/major
git push --follow-tags
```

The GitHub Actions workflow (`.github/workflows/release.yml`) will:
1. Install dependencies
2. Build the CLI (`pnpm --filter ui2code build`)
3. Publish to npm (`pnpm --filter ui2code publish --access public`)

You can also publish manually:

```bash
cd packages/cli
npm publish   # prepublishOnly runs tsup automatically
```

## Questions?

- [GitHub Issues](https://github.com/your-org/ui2code/issues)
- [OpenCode Discord](https://opencode.ai/discord)
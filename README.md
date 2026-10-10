# ui2code

Turn UI screenshots into frontend components that match your project's stack, conventions, and design system.

ui2code is an [OpenCode](https://opencode.ai)-based agent that takes a UI screenshot (e.g. exported from Figma), detects your project's stack and conventions, and generates a component that fits your existing codebase — same naming, same styling, same patterns.

## Quick Start

```bash
# 1. Install OpenCode (once)
npm install -g opencode-ai

# 2. Set up ui2code in your project (~30 seconds)
npx ui2code init

# 3. Generate a component from a screenshot
npx ui2code run ./screenshot.png
```

That's it. `init` detects your framework, styling, and language automatically, walks you through choosing a model and storing an API key, and writes all config. `run` launches the agent, shows progress, and prints a summary when it's done.

## What It Detects

| Category | What it finds |
|---|---|
| **Package manager** | npm, pnpm, yarn, bun |
| **Language** | TypeScript, JavaScript |
| **Framework** | React, Next.js, Vue, Nuxt, Svelte, SvelteKit, Angular, Solid, Astro |
| **Routing** | App router, pages router, file-based, config-based |
| **Styling** | Tailwind, CSS Modules, styled-components, Emotion, Sass, vanilla-extract |
| **Component lib** | shadcn/ui, MUI, Chakra, Ant, Mantine, Radix |
| **Testing** | Vitest, Jest, Testing Library, Storybook, Playwright |
| **Monorepo** | pnpm workspaces, Turborepo, Nx, Lerna |

## What It Generates

- Components matching your file naming (PascalCase, kebab-case, etc.)
- Same export style (default or named)
- Same props typing (interface or type)
- Same styling approach (Tailwind classes, CSS Modules, styled-components, etc.)
- Reuses existing primitives — never recreates shadcn Button, MUI TextField, etc.
- Uses existing design tokens (CSS variables, tailwind config)
- Respects import aliases (@/, ~/)

## Commands

### `ui2code init`

Set up ui2code in the current project. Guided wizard in a terminal, deterministic with `--yes`.

```bash
npx ui2code init                                    # interactive wizard
npx ui2code init --yes --provider opencode           # non-interactive
npx ui2code init --yes --model openai/gpt-4o         # specify model
```

Options: `--dir`, `--yes`, `--model`, `--vision-model`, `--provider`

### `ui2code run`

Generate a component from a screenshot.

```bash
npx ui2code run ./screenshot.png                                  # file path
npx ui2code run ./screenshot.png --brief "A dashboard header"     # with context
npx ui2code run https://example.com/mockup.png                    # URL
npx ui2code run --clipboard                                       # paste from clipboard
npx ui2code run ./screenshot.png --out src/components              # target directory
npx ui2code run ./screenshot.png --framework nextjs               # override detection
npx ui2code run ./screenshot.png --verbose                        # raw agent output
```

Options: `[image]`, `--clipboard`, `--brief`, `--out`, `--framework`, `--model`, `--yes`, `--verbose`

### `ui2code doctor`

Check setup and fix issues.

```bash
npx ui2code doctor                # check setup
npx ui2code doctor --fix          # auto-repair safe issues
npx ui2code doctor --online       # verify API key with a test call
```

## Requirements

- **Node.js** >= 18
- **npm** (or pnpm/yarn/bun)
- **OpenCode** (`npm install -g opencode-ai` — the `init` wizard offers to install it)
- A vision-capable model for screenshot analysis (GPT-4o, Claude Sonnet, Gemini, DeepSeek Vision)

No clone, no build, no pnpm required for end users.

## Providers

ui2code works with any OpenAI-compatible API. The `init` wizard detects credentials from environment variables and the OpenCode auth store:

| Provider | Env var | Default model |
|---|---|---|
| OpenCode Go | `OPENCODE_API_KEY` (or auth store) | `opencode/mimo-v2.5-pro` |
| OpenAI | `OPENAI_API_KEY` | `openai/gpt-4o` |
| Anthropic | `ANTHROPIC_API_KEY` | `anthropic/claude-sonnet-4-5` |
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek/deepseek-v4-pro` |
| Google Gemini | `GEMINI_API_KEY` | `google/gemini-2.0-flash` |
| OpenRouter | `OPENROUTER_API_KEY` | `openrouter/openai/gpt-4o` |

API keys are stored in `.env.local` (gitignored) or the OpenCode auth store — never exported in your shell.

## How It Works

1. **Analyze** the screenshot to extract a UI specification (layout, components, typography, colors, spacing)
2. **Detect** the project's technology stack (framework, styling, language, component library)
3. **Scan** existing component conventions (naming, exports, props typing, design tokens)
4. **Map** the UI spec to existing primitives and design tokens
5. **Ask** clarifying questions (auto-answered with sensible defaults in `run` mode)
6. **Plan** and present the implementation
7. **Implement** following detected conventions exactly
8. **Verify** with typecheck/lint/build
9. **Summarize** files created, assumptions, and next steps

See [How It Works](./docs/how-it-works.md) for details and a data flow diagram.

## Documentation

- [Getting Started](./docs/getting-started.md) — step-by-step guide
- [How It Works](./docs/how-it-works.md) — workflow and architecture
- [Configuration](./docs/configuration.md) — all config options and env vars
- [Models](./docs/models.md) — provider setup and vision model details
- [Troubleshooting](./docs/troubleshooting.md) — common issues and fixes
- [Writing Good Inputs](./docs/writing-good-inputs.md) — screenshot tips
- [Extending](./docs/extending.md) — adding detectors, generation strategies
- [Security](./docs/security.md) — access model and safety guarantees

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, monorepo layout, and workflow.

## License

MIT
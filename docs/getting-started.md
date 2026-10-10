# Getting Started

Step-by-step guide to set up ui2code and generate your first component.

## Prerequisites

- **Node.js** >= 18 — [download](https://nodejs.org)
- **npm** (comes with Node) — or pnpm, yarn, or bun

That's it. OpenCode and the API key are handled by the `init` wizard.

## Install and Set Up

```bash
# 1. Install OpenCode (once per machine)
npm install -g opencode-ai

# 2. Set up ui2code in your project (~30 seconds)
cd your-project
npx ui2code init
```

The `init` wizard will:
1. Detect your project's framework, styling, language, and package manager
2. Show you what it found and let you correct anything
3. Walk you through choosing an AI provider and model
4. Store your API key safely in `.env.local` (gitignored) — no need to export env vars
5. Write all config files, agent templates, and the plugin
6. Run `ui2code doctor` to verify everything

## Generate a Component

```bash
npx ui2code run ./screenshot.png
```

The agent will analyze the screenshot, detect your project's conventions, and generate a component that matches your existing code. You'll see a progress UI showing each workflow step, and a summary when it's done.

### Common options

```bash
# Add context to guide the generation
npx ui2code run ./screenshot.png --brief "A login form with email and password fields"

# Use a screenshot from the web
npx ui2code run https://example.com/mockup.png

# Paste from clipboard (PrntScrn, Win+Shift+S, etc.)
npx ui2code run --clipboard

# Override the detected framework
npx ui2code run ./screenshot.png --framework nextjs

# See the raw agent output
npx ui2code run ./screenshot.png --verbose
```

### Using OpenCode TUI

You can also use ui2code from the OpenCode interactive terminal:

```bash
opencode
# Then type:
/ui2code ./screenshot.png
```

This gives you the full interactive experience with clarifying questions.

## Configure Your Model

The `init` wizard handles model configuration, but you can change it later:

### Environment variables (stored in `.env.local`, gitignored)

```bash
UI2CODE_MODEL="openai/gpt-4o"
UI2CODE_VISION_MODEL="openai/gpt-4o"
UI2CODE_API_KEY="sk-..."
```

### opencode.json

```json
{
  "model": "openai/gpt-4o",
  "ui2code": {
    "model": "openai/gpt-4o",
    "visionModel": "openai/gpt-4o"
  }
}
```

### OpenCode auth store

```bash
opencode auth login
```

Priority: `UI2CODE_*` env vars > `.env.local` > opencode.json > OpenCode auth store.

See [Models](./models.md) for provider-specific setup and [Configuration](./configuration.md) for all options.

## Verify Setup

```bash
npx ui2code doctor           # check everything
npx ui2code doctor --fix     # auto-repair safe issues
npx ui2code doctor --online  # verify API key with a test call
```

## Troubleshooting

If something goes wrong:

```bash
npx ui2code doctor --fix     # fix missing files, malformed config
npx ui2code run --debug ...  # full stack traces on error
```

See [Troubleshooting](./troubleshooting.md) for the most common issues and fixes.

## What's Next?

- [How It Works](./how-it-works.md) — the 9-step workflow and data flow
- [Models](./models.md) — switching providers, vision model setup
- [Writing Good Inputs](./writing-good-inputs.md) — screenshot tips and brief writing
- [Configuration](./configuration.md) — all config options
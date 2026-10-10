# ui2code

Turn UI screenshots into frontend components that match your project's stack, conventions, and design system.

## Quick Start

```bash
# Install OpenCode (once)
npm install -g opencode-ai

# Set up in your project
npx ui2code init

# Generate from a screenshot
npx ui2code run ./screenshot.png
```

## Commands

| Command | Description |
|---|---|
| `ui2code init` | Guided wizard — detects framework, sets up model, stores API key |
| `ui2code run <image>` | Generate a component from a screenshot (file, URL, or `--clipboard`) |
| `ui2code doctor` | Check setup; `--fix` auto-repairs, `--online` tests the API key |

## Requirements

- Node >= 18
- OpenCode (`npm install -g opencode-ai`)
- A vision-capable model (GPT-4o, Claude Sonnet, Gemini, DeepSeek Vision)

## Documentation

- [Getting Started](https://github.com/your-org/ui2code/blob/main/docs/getting-started.md)
- [Full README](https://github.com/your-org/ui2code/blob/main/README.md)
- [Troubleshooting](https://github.com/your-org/ui2code/blob/main/docs/troubleshooting.md)

## License

MIT
# Configuration

## API Key Storage

The `init` wizard handles API key storage for you. Keys are searched in this order:

1. **`UI2CODE_API_KEY`** — universal override (highest priority)
2. **Provider env vars** — `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `OPENCODE_API_KEY`
3. **Project `.env.local`** then **`.env`** — same variable names, gitignored
4. **OpenCode auth store** — `~/.local/share/opencode/auth.json` (managed by `opencode auth login`)

You never need to export env vars in your shell. The `init` wizard stores keys in `.env.local` and adds it to `.gitignore` automatically.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `UI2CODE_MODEL` | Main model ID (`provider/model` format) | from opencode.json |
| `UI2CODE_VISION_MODEL` | Vision model for screenshot analysis | falls back to main model |
| `UI2CODE_API_KEY` | API key (overrides all provider-specific keys) | — |
| `UI2CODE_BASE_URL` | Base URL for the vision model API | auto-detected from provider |
| `OPENAI_API_KEY` | OpenAI API key | — |
| `ANTHROPIC_API_KEY` | Anthropic API key | — |
| `DEEPSEEK_API_KEY` | DeepSeek API key | — |
| `GEMINI_API_KEY` | Google Gemini API key | — |
| `OPENROUTER_API_KEY` | OpenRouter API key | — |
| `OPENCODE_API_KEY` | OpenCode Go API key | — |

## opencode.json

`ui2code init` merges into your existing `opencode.json` without clobbering your settings. The original is backed up to `opencode.json.bak` before modification.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "openai/gpt-4o",
  "ui2code": {
    "model": "openai/gpt-4o",
    "visionModel": "openai/gpt-4o",
    "project": {
      "packageManager": "pnpm",
      "framework": "nextjs",
      "styling": "tailwind",
      "language": "typescript"
    }
  }
}
```

### `ui2code` namespace

| Field | Description |
|---|---|
| `model` | Pinned model for ui2code analysis (overrides top-level `model` for the plugin tools) |
| `visionModel` | Vision model for screenshot analysis |
| `project` | User-confirmed overrides for stack detection (set by `init` when you correct the detection) |

The plugin is auto-loaded from `.opencode/plugins/ui2code.js` — no npm package entry is needed in the config.

### Project overrides

When `init` detects your project's stack incorrectly, you can override it. The overrides are stored in `ui2code.project` and take precedence over detection at run time:

```json
{
  "ui2code": {
    "project": {
      "framework": "nextjs",
      "styling": "tailwind"
    }
  }
}
```

Overridable fields: `packageManager`, `language`, `framework`, `styling`.

## CLI Flags

### `ui2code init`

| Flag | Short | Description | Default |
|---|---|---|---|
| `--dir` | `-d` | Project directory | cwd |
| `--yes` | `-y` | Non-interactive mode (for CI) | false |
| `--model` | `-m` | Model for the agent (`provider/model`) | auto-detected |
| `--vision-model` | | Vision model for screenshot analysis | same as model |
| `--provider` | | Provider ID (openai, anthropic, deepseek, google, opencode, openrouter) | auto-detected |

### `ui2code run`

| Flag | Short | Description | Default |
|---|---|---|---|
| `[image]` | | Screenshot file path or URL | (required unless --clipboard) |
| `--clipboard` | | Use image from system clipboard | false |
| `--brief` | `-b` | Text brief describing the UI | — |
| `--out` | `-o` | Target directory for the generated component | auto-detected |
| `--framework` | | Override detected framework (e.g. react, nextjs) | auto-detected |
| `--dir` | `-d` | Project directory | cwd |
| `--model` | `-m` | Model override (`provider/model`) | from config |
| `--yes` | `-y` | Accept recommended defaults | false |
| `--verbose` | | Show raw agent output instead of progress UI | false |

### `ui2code doctor`

| Flag | Description | Default |
|---|---|---|
| `--dir` | Project directory | cwd |
| `--fix` | Automatically repair safe issues (missing files, malformed config) | false |
| `--online` | Make a cheap test API call to verify the configured key works | false |

### Global

| Flag | Description |
|---|---|
| `--version` | Show version |
| `--help` | Show help |
| `--debug` | Show full stack traces on error |

## Config Resolution Order

1. CLI flags (`--model`, `--vision-model`)
2. Environment variables (`UI2CODE_MODEL`, `UI2CODE_VISION_MODEL`, `UI2CODE_API_KEY`, `UI2CODE_BASE_URL`)
3. Project `.env.local` then `.env` (same variable names)
4. `opencode.json` `ui2code` section
5. `opencode.json` top-level `model`
6. OpenCode auth store (`~/.local/share/opencode/auth.json`)
7. Global OpenCode config (`~/.config/opencode/opencode.json`)

## Permission Config

The agent's permissions are configured in `.opencode/agents/ui-builder.md`:

```yaml
permission:
  edit: allow     # write files without asking
  bash: ask       # prompt before running shell commands
  question: allow # ask clarifying questions (auto-cancelled in run mode)
```

- `allow` — run without approval
- `ask` — prompt for approval
- `deny` — block the action
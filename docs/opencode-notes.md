# ui2code Verified OpenCode API Notes

> Verified against https://opencode.ai/docs on 2026-10-07.

## Config

- File: `opencode.json` or `opencode.jsonc` in project root.
- Global: `~/.config/opencode/opencode.json`.
- Schema: `https://opencode.ai/config.json`.
- Configs are **merged** (not replaced) across locations. Later sources override earlier ones for conflicting keys.
- Precedence: remote → global → `OPENCODE_CONFIG` env → project `.opencode` → inline `OPENCODE_CONFIG_CONTENT`.

## Agents

- Defined in `opencode.json` under `agent` key, or as markdown files in `.opencode/agents/` or `~/.config/opencode/agents/`.
- Modes: `primary`, `subagent`, `all`.
- Key fields: `description`, `model`, `prompt` (supports `{file:./path}`), `permission`, `temperature`, `steps`, `hidden`, `color`, `top_p`.
- Built-in primary agents: **Build** (all tools), **Plan** (restricted).
- Built-in subagents: **General**, **Explore**, **Scout**.

## Custom Tools

- TypeScript files in `.opencode/tools/` using `tool()` from `@opencode-ai/plugin`.
- Args use zod schemas. Filename = tool name.
- Context provides: `directory`, `worktree`, `agent`, `sessionID`, `messageID`.
- Can also register tools via plugins using the `tool` hook.

## Plugins

- Files in `.opencode/plugins/` or npm packages via `plugin` config.
- Export async function receiving `{project, client, $, directory, worktree}`.
- Hooks: `tool.execute.before`, `tool.execute.after`, `event`, `shell.env`, `experimental.session.compacting`, and many more.

## Commands

- Markdown files in `.opencode/commands/` or `command` in config.
- Support `$ARGUMENTS`, `$1`/`$2` positional, `` !`shell` `` backtick injection, `@file` references.
- Can specify `agent`, `model`, `subtask`.

## Question Tool (built-in)

- **Built-in `question` tool** exists for asking users questions mid-run.
- Each question has: header, question text, options (with labels + descriptions), `multiple` flag.
- Permission key: `question`. Default: `allow`.
- No fallback tool needed — use the native one.

## Image Handling

- Drag-and-drop images into terminal to attach.
- Config: `attachment.image` with `auto_resize`, `max_width` (2000), `max_height` (2000), `max_base64_bytes` (5MB).
- Images are normalized (resized if needed) then sent as base64 to the model.

## CLI

- `opencode run "prompt"` — non-interactive mode.
- Flags: `--model`/`-m`, `--agent`, `--file`/`-f` (attach files), `--auto` (auto-approve), `--dir`, `--format json`.
- `opencode serve` — headless server for SDK access.

## Custom Providers

- Set `npm: "@ai-sdk/openai-compatible"`, `options.baseURL`, `models` map.
- Supports `{env:VAR_NAME}` substitution in config values.
- DeepSeek is a built-in provider (via `/connect`).

## Model Config

- `model: "provider/model-id"` in config. `--model` flag overrides.
- **No native vision model slot** — single `model` field. `small_model` for lightweight tasks only.
- Vision handling: our `analyze_screenshot` tool makes a direct API call to a configurable vision model.

## SDK

- `@opencode-ai/sdk`. `createOpencode()` starts server+client.
- `session.prompt()` sends messages with parts (text, image types).
- Supports structured output: `format: {type: "json_schema", schema: {...}}`.

## Skills

- `SKILL.md` in `.opencode/skills/<name>/`.
- Frontmatter: `name`, `description`. Loaded on-demand via `skill` tool.

## Permissions

- `permission` config: `allow`/`ask`/`deny` per tool.
- Per-agent overrides. `--auto` flag auto-approves non-denied.
- Fine-grained: object syntax with glob patterns for bash commands, file paths, etc.
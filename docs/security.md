# Security

## Principles

1. **No secrets in transit** — `.env` files and secrets are never read or sent to the model
2. **Respect .gitignore** — files matching `.gitignore` patterns are excluded from searches
3. **Confine writes** — all file writes are confined to the project root
4. **Block sensitive files** — `.env`, `.env.local`, credentials, SSH keys are blocked from writing
5. **Permission gating** — file writes and command execution are gated via OpenCode's permission system

## What ui2code Accesses

| Resource | Access | Control |
|---|---|---|
| Project files | Read (detectors, scanners) | Respects `.gitignore` |
| Image files | Read (screenshot analysis) | User-provided paths only |
| API keys | Read from env vars | Never logged or transmitted beyond the model provider |
| File writes | Write (component files) | Confined to project root, blocked for sensitive files |
| Shell commands | Execute (verify_project) | Only detected scripts from package.json |

## Blocked Files

The writer blocks writing to:
- `.env`, `.env.local`, `.env.production`, `.env.development`
- `id_rsa`, `id_ed25519`, `id_dsa`
- `.npmrc`, `.yarnrc`
- Files named `credentials` or `secrets`

## Path Confinement

All file writes check that the resolved path starts with the project root. Paths like `../../../etc/passwd` are rejected.

## Command Execution

The `verify_project` tool only runs scripts detected from `package.json`. It never runs arbitrary commands. The scripts are:
- `typecheck` / `type-check` / `tsc`
- `lint` / `eslint`
- `build`

You can specify a custom list: `verify_project(scripts: ["typecheck", "lint"])`

## Model Communication

Screenshots are sent to the vision model as base64 data URLs. No other project data is sent to the model through the screenshot analysis path.

The agent's conversation (including detected stack info) is handled by OpenCode's normal model communication, which follows OpenCode's privacy model.

## Recommendations

1. **Use environment variables** for API keys, not hardcoded values
2. **Review generated code** before committing
3. **Run `ui2code doctor`** to verify your setup
4. **Use `--dry-run`** to preview file changes before writing
5. **Set permissions** in `opencode.json` to control what the agent can do
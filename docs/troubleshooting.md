# Troubleshooting

## Top 5 Issues

### 1. "No API key found"

**Symptom**: `ui2code doctor` reports `✗ Credentials: No API key found`

**Cause**: No API key in environment variables, `.env.local`, or the OpenCode auth store.

**Fix**:
```bash
# Option A: re-run init (guided, stores key in .env.local)
npx ui2code init

# Option B: use the OpenCode auth store
opencode auth login

# Option C: set a key manually (add to .env.local, not your shell profile)
echo "OPENAI_API_KEY=sk-..." >> .env.local
```

Then verify: `npx ui2code doctor`

---

### 2. "OpenCode is not installed"

**Symptom**: `ui2code run` or `ui2code doctor` fails immediately.

**Fix**:
```bash
npm install -g opencode-ai
```

Then verify: `npx ui2code doctor`

If the command is not found after installing, restart your terminal (npm global bin may not be on PATH yet).

---

### 3. "Vision model may not support image input"

**Symptom**: `ui2code doctor` warns `⚠ Vision model: ... may not support image input`

**Cause**: The configured model is not known to accept images. Screenshot analysis will fail or produce poor results.

**Fix**:
```bash
# Pick a vision-capable model
npx ui2code init  # the wizard recommends vision models

# Or set directly
npx ui2code init --yes --model openai/gpt-4o --vision-model openai/gpt-4o
```

Vision-capable models: GPT-4o, GPT-4.1, GPT-5, Claude Sonnet/Opus, Gemini 2.0+, DeepSeek V4 Flash Vision.

---

### 4. "Plugin not installed" or tools not found during a run

**Symptom**: `ui2code doctor` reports `✗ Plugin: plugin not installed`, or the agent fails with "unknown tool" errors during a run.

**Fix**:
```bash
# Auto-repair missing plugin and agent files
npx ui2code doctor --fix

# Or re-initialize from scratch
npx ui2code init
```

The plugin is a self-contained file at `.opencode/plugins/ui2code.js` — `doctor --fix` recreates it if missing.

---

### 5. Screenshot analysis fails with an API error

**Symptom**: The run fails during the "Analyzing screenshot" step with a 400/401/429/500 error.

**Common causes and fixes**:

| Error | Cause | Fix |
|---|---|---|
| 401 Unauthorized | Bad or missing API key | `npx ui2code doctor --online` to test; re-run `npx ui2code init` to update the key |
| 400 Bad Request | Model doesn't accept images, or image too large | Use a vision-capable model; crop/resize images under 10 MB |
| 429 Rate Limited | Too many requests | Wait a minute, or use a different provider |
| Connection refused | Wrong `UI2CODE_BASE_URL` or provider is down | Check the URL; try `npx ui2code doctor --online` |

For non-OpenAI providers that don't have a `/chat/completions` endpoint, set `UI2CODE_BASE_URL` to an OpenAI-compatible proxy (e.g. OpenRouter: `https://openrouter.ai/api/v1`).

## Other Issues

### "Unsupported image format"

Convert the image to PNG, JPG, or WebP. GIF is not supported.

### Image is very large (> 15 MB)

Vision APIs have size limits. Crop or resize the screenshot before passing it. The CLI warns about large files.

### `npx ui2code` hangs or shows no output

On Windows with npm 11, `npx ./ui2code-x.y.z.tgz <args>` may not forward arguments when using a local tarball path. Use the registry form (`npx ui2code <command>`) or install first (`npm i -D ui2code && npx ui2code <command>`).

### Questions are auto-answered

In `run` mode, the agent cannot ask you interactive questions (the workflow runs headless). The agent makes reasonable assumptions and reports them in the summary. For interactive Q&A, use the OpenCode TUI: `opencode` then `/ui2code ./screenshot.png`.

### Config merge clobbered my settings

`ui2code init` merges into your existing `opencode.json` without overwriting your settings. The original is backed up to `opencode.json.bak` before any modification. If something went wrong:

```bash
cp opencode.json.bak opencode.json   # restore the backup
npx ui2code init                     # re-run with your preferences
```

## Debug Mode

Run any command with `--debug` for full stack traces:

```bash
npx ui2code run --debug ./screenshot.png
npx ui2code init --debug
```

## Still Stuck?

1. Run `npx ui2code doctor --online` to verify the full setup
2. Check [GitHub Issues](https://github.com/your-org/ui2code/issues)
3. Join the [OpenCode Discord](https://opencode.ai/discord)
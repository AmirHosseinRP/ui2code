# Models

## Switching Models

No provider-specific code in ui2code. Everything flows through OpenCode's provider/model config.

### OpenCode Go (default)

OpenCode Go provides access to tested open coding models. Configure via `/connect` in the TUI.

```json
{
  "model": "opencode/mimo-v2.5-pro",
  "ui2code": {
    "visionModel": "opencode/deepseek-v4-flash-vision-exp"
  }
}
```

### DeepSeek (via API)

```json
{
  "provider": {
    "deepseek": {
      "options": {
        "apiKey": "{env:DEEPSEEK_API_KEY}"
      }
    }
  },
  "model": "deepseek/deepseek-v4-pro",
  "ui2code": {
    "visionModel": "deepseek/deepseek-v4-flash-vision-exp"
  }
}
```

Set `DEEPSEEK_API_KEY` in your environment.

### OpenAI-compatible Company Endpoint

```json
{
  "provider": {
    "mycompany": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Company Model",
      "options": {
        "baseURL": "https://api.mycompany.com/v1",
        "apiKey": "{env:COMPANY_API_KEY}"
      },
      "models": {
        "my-model": {
          "name": "My Model",
          "limit": {
            "context": 128000,
            "output": 4096
          }
        }
      }
    }
  },
  "model": "mycompany/my-model",
  "ui2code": {
    "visionModel": "mycompany/my-model"
  }
}
```

### Ollama (local)

```json
{
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama (local)",
      "options": {
        "baseURL": "http://localhost:11434/v1"
      },
      "models": {
        "llama3.2-vision": {
          "name": "Llama 3.2 Vision"
        }
      }
    }
  },
  "model": "ollama/llama3.2-vision",
  "ui2code": {
    "visionModel": "ollama/llama3.2-vision"
  }
}
```

## Vision Model Setup

The vision model is used by `analyze_screenshot` to extract UI specs from images.

### Requirements

- Must support image input (multimodal)
- Must be accessible via OpenAI-compatible chat completions API
- Must accept `image_url` content parts with base64 data URLs

### Known Vision-capable Models

| Provider | Model | Notes |
|---|---|---|
| OpenAI | `gpt-4o`, `gpt-4.1`, `gpt-5` | Best quality |
| Anthropic | `claude-3.5-sonnet`, `claude-4` | Good quality |
| DeepSeek | `deepseek-v4-flash-vision-exp` | Via OpenCode Go |
| Google | `gemini-pro-vision`, `gemini-2.0-flash` | Good quality |
| Ollama | `llama3.2-vision`, `llava` | Local, free |

### Fallback Behavior

If no vision model is set:
1. Falls back to the main model
2. If the main model doesn't support images, returns a low-confidence fallback spec with a clear error message

### Run the Doctor

```bash
ui2code doctor
```

This checks if your vision model is configured and likely supports vision.

## Two Logical Model Slots

| Slot | Env Var | Config Key | Purpose |
|---|---|---|---|
| `model` | `UI2CODE_MODEL` | `model` in opencode.json | Main reasoning/coding |
| `vision_model` | `UI2CODE_VISION_MODEL` | `ui2code.visionModel` | Screenshot analysis |

Both can point to the same model or different ones. The vision model is called directly (not through OpenCode's agent system) because OpenCode has no native vision model slot.

## Troubleshooting

**"No vision model configured"**
Set `UI2CODE_VISION_MODEL` or add `ui2code.visionModel` to `opencode.json`.

**"No API key found"**
Set `UI2CODE_API_KEY` or `OPENAI_API_KEY` in your environment.

**"Vision model API error (401)"**
Check your API key is correct and has access to the model.

**"Schema validation failed"**
The vision model returned malformed JSON. Try a more capable model or increase `maxRetries`.
# Architecture

## Package Layout

```
ui2code/
├── packages/
│   ├── core/                    # @ui2code/core — framework-agnostic logic
│   │   └── src/
│   │       ├── schemas/         # zod schemas (stack, conventions, ui-spec)
│   │       ├── detectors/       # stack detection modules (registry + 7 detectors)
│   │       ├── conventions/     # convention scanner
│   │       ├── screenshot/      # image utils, vision model caller, analyzer
│   │       ├── mapper/          # design system mapping
│   │       ├── writer/          # file writer with safety checks
│   │       ├── verification/    # project verification (typecheck/lint/build)
│   │       └── config/          # model config resolver
│   ├── opencode-plugin/         # @ui2code/opencode-plugin — OpenCode plugin
│   │   └── src/
│   │       └── index.ts         # registers 6 custom tools
│   └── cli/                     # @ui2code/cli — CLI entry point
│       └── src/
│           ├── index.ts         # commander CLI
│           └── commands/        # run, init, doctor
├── .opencode/
│   ├── agents/                  # agent definitions (ui-builder, ui-analyzer)
│   └── commands/                # slash commands (/ui2code)
├── fixtures/                    # test fixture projects
└── docs/                        # documentation
```

## Data Flow

```
Screenshot + Brief
       │
       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ analyze_screenshot│     │   detect_stack   │     │ scan_conventions │
│  (vision model)  │     │  (7 detectors)   │     │  (5 samples)     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         ▼                       ▼                       ▼
    UiSpec JSON            StackResult            ConventionsResult
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   map_to_design_system   │
                    │  (match vs create)       │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   question (ask user)    │
                    │  (clarifying questions)  │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   write_component_files  │
                    │  (safe file writer)      │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │    verify_project        │
                    │  (typecheck/lint/build)  │
                    └─────────────────────────┘
```

## Tools

| Tool | Description | Input | Output |
|---|---|---|---|
| `detect_stack` | Detect project stack | (none) | `StackResult` |
| `scan_conventions` | Scan component conventions | (none) | `ConventionsResult` |
| `analyze_screenshot` | Analyze UI screenshot | image_path, brief | `UiSpec` |
| `map_to_design_system` | Map to existing primitives | ui_spec, conventions | `DesignSystemMapping` |
| `write_component_files` | Write files safely | files, dry_run | Write summary |
| `verify_project` | Run typecheck/lint/build | scripts | `VerifyResult` |

## Schemas

All schemas are defined with zod and exported from `@ui2code/core`:

- **`StackResult`** — package manager, language, framework, routing, styling, component lib, test setup, monorepo
- **`ConventionsResult`** — file naming, export style, props typing, style co-location, tokens, primitives
- **`UiSpec`** — layout tree, components, text content, typography, colors, spacing, states, ambiguities
- **`DesignSystemMapping`** — reusable components, to-create list, tokens to use
- **`VerifyResult`** — per-script results with parsed errors

## Security Model

- All file writes confined to project root
- Sensitive files (.env, credentials) blocked
- `.gitignore` respected
- No secrets sent to the model
- Permissions gated via OpenCode's permission system
- Dry-run mode available for all write operations
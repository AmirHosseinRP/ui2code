# How It Works

ui2code follows a 9-step workflow to generate components that match your project.

## Workflow Diagram

```mermaid
flowchart TD
    A[User provides screenshot + optional brief] --> B[Step 1: Analyze Screenshot]
    B --> C[Step 2: Detect Stack]
    C --> D[Step 3: Scan Conventions]
    D --> E[Step 4: Map to Design System]
    E --> F[Step 5: Ask Clarifying Questions]
    F --> G[Step 6: Present Implementation Plan]
    G --> H[Step 7: Implement Component]
    H --> I[Step 8: Verify (typecheck/lint/build)]
    I -->|errors| J[Fix Errors]
    J -->|retry| I
    I -->|pass| K[Step 9: Summarize]
    J -->|max 3 retries| K

    B -.-> |vision model| B1[UI Spec JSON]
    C -.-> |detectors| C1[Stack Result]
    D -.-> |scanner| D1[Conventions Result]
    E -.-> |mapper| E1[Design System Mapping]
```

## Step-by-Step

### Step 1: Analyze Screenshot

The `analyze_screenshot` tool sends the image to a vision model (configurable) and extracts a structured UI specification:

- **Layout tree** — rows, columns, grids, nesting
- **Components** — Button, Input, Card, etc. with positions and states
- **Text content** — all visible text with typography info
- **Colors** — hex values, roles (primary, background, text)
- **Spacing** — detected patterns (multiples of 4/8)
- **States** — default, hover, active, loading, error
- **Ambiguities** — things that couldn't be determined

### Step 2: Detect Stack

The `detect_stack` tool runs 7 independent detectors:

| Detector | What it finds |
|---|---|
| Package manager | pnpm, yarn, npm, bun (from lockfiles) |
| Language | TypeScript, JavaScript (from tsconfig, deps) |
| Framework | React, Next.js, Vue, Nuxt, Svelte, SvelteKit, Angular, Solid, Astro |
| Styling | Tailwind, CSS Modules, styled-components, Emotion, Sass, vanilla-extract |
| Component lib | shadcn/ui, MUI, Chakra, Ant, Mantine, Radix |
| Test setup | Vitest, Jest, Testing Library, Storybook, Playwright |
| Monorepo | pnpm workspaces, Turborepo, Nx, Lerna |

Each detector returns a value with confidence score and evidence (file paths).

### Step 3: Scan Conventions

The `scan_conventions` tool samples 3–5 representative components and extracts:

- **File naming** — PascalCase, kebab-case, camelCase
- **Export style** — default vs named
- **Props typing** — interface vs type vs inline
- **Style co-location** — tailwind-only, CSS modules, styled-components, etc.
- **Design tokens** — colors, spacing, fonts from tailwind config or CSS variables
- **Reusable primitives** — Button, Input, Card, etc. that already exist

### Step 4: Map to Design System

The `map_to_design_system` tool matches UI spec components to existing primitives:

- **Direct match** — "Button" → existing `Button.tsx`
- **Fuzzy match** — "CTA" → existing `Button.tsx`
- **Semantic match** — "Modal" → existing `Dialog.tsx` (30+ synonym groups)
- **Needs creation** — "HeroBanner" → no match, create new

### Step 5: Ask Questions

The agent uses the built-in `question` tool to ask targeted clarifying questions:

- Component name and target path
- Sub-component split
- Props data shape
- Responsive breakpoints
- Interactions and states
- Accessibility requirements
- Icon/image sourcing
- Test/story generation

Rules: max 5 questions at once, each with a recommended default.

### Step 6: Present Plan

Before coding, the agent shows:
- Files to create (with paths)
- Libraries and primitives being reused
- Any new dependencies needed
- Key assumptions

### Step 7: Implement

The agent writes code following detected conventions exactly:
- Same file naming (PascalCase, kebab-case)
- Same export style (default, named)
- Same props typing (interface, type)
- Same styling approach (Tailwind, CSS Modules, etc.)
- Same import aliases (@/, ~/)
- Reuses existing primitives
- Uses existing design tokens

### Step 8: Verify

The `verify_project` tool runs the project's own scripts:
- `typecheck` / `type-check` / `tsc`
- `lint` / `eslint`
- `build`

If errors are found, the agent fixes them (max 3 iterations).

### Step 9: Summarize

The agent reports:
- Files created
- Assumptions made
- Things to check visually
- Suggested follow-ups
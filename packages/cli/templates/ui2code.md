---
description: Generate a frontend component from a UI screenshot. Detects the project stack, scans conventions, analyzes the screenshot, asks clarifying questions, and generates code matching existing patterns.
agent: ui-builder
---

Generate a frontend component from the screenshot at `$ARGUMENTS`.

Follow the full workflow:
1. Analyze the screenshot to extract a UI specification
2. Detect the project's technology stack
3. Scan existing component conventions
4. Map the UI spec to the existing design system
5. Ask clarifying questions before coding
6. Present an implementation plan
7. Implement the component following detected conventions exactly
8. Verify with typecheck/lint/build
9. Summarize what was created
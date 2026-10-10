# Writing Good Inputs

## Screenshot Tips

### Export from Figma

1. Select the frame/component you want to implement
2. Export as **PNG** (2x resolution for better detail)
3. Include the full component, not just a cropped section
4. If the design has multiple states (hover, active, loading), export each as a separate screenshot

### Screenshot Quality

- **Resolution**: At least 1000px wide for desktop, 375px for mobile
- **Format**: PNG preferred (lossless), JPG acceptable, WebP supported
- **Size**: Under 5MB (larger images are auto-resized)
- **Content**: Show the component as it should appear, not the design tool UI

### Multiple Screenshots

For responsive designs, provide multiple screenshots:
- Desktop view (1440px+)
- Tablet view (768px)
- Mobile view (375px)

The agent will analyze all screenshots and extract responsive hints.

### What to Include

- The component you want to generate (centered, clear)
- Surrounding context if it affects layout
- Text content as it should appear
- Any interactive states visible (hover, active, disabled)

### What to Exclude

- Design tool chrome (Figma panels, rulers, etc.)
- Other unrelated components
- Cursor or selection indicators
- Debug overlays

## Writing a Brief

The optional `--brief` text helps the agent understand intent:

### Good Briefs

```
A login form with email and password fields, a "Remember me" checkbox,
and a "Sign in" button. Should be centered on the page with a card layout.
```

```
A pricing table with 3 tiers (Basic, Pro, Enterprise). Each tier shows
price, features list, and a CTA button. Pro tier should be highlighted.
```

```
A dashboard header with a search bar, notification bell icon, and
user avatar dropdown. Responsive — collapses to hamburger on mobile.
```

### What to Include in the Brief

- **Purpose**: What the component does
- **Data**: What data it displays (static vs dynamic)
- **Interactions**: Click handlers, form submission, navigation
- **States**: Loading, empty, error states
- **Responsive**: How it should adapt to different screens
- **Accessibility**: Any specific ARIA requirements

### What NOT to Include

- Implementation details (the agent figures this out from your project)
- Specific CSS values (the agent uses your design tokens)
- Library choices (the agent uses what's already in your project)

## Naming Tips

When the agent asks for a component name:
- Use PascalCase: `LoginForm`, `PricingTable`, `DashboardHeader`
- Be descriptive: `UserProfileCard` not `Card1`
- Match your project's naming conventions (the agent detects these)

## Multi-viewport

If your design has desktop and mobile views:
1. Export both screenshots
2. Pass them as separate arguments: `ui2code run desktop.png mobile.png`
3. Or analyze them in sequence in the TUI
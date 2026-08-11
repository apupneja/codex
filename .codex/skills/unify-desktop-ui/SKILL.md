---
name: unify-desktop-ui
description: Audit, design, and implement UI changes in desktop-app with its shared visual language. Use for new or modified desktop screens, menus, dropdowns, controls, typography, themes, layouts, accessibility, or styling; for UI cleanup and design reviews; and whenever a desktop change could introduce visual inconsistency.
---

# Unify Desktop UI

Keep the desktop app coherent by reusing its tokens and primitives, checking the rendered interface, and rejecting new one-off controls or visual constants.

## Workflow

1. Read `references/design-system.md` before changing renderer UI.
2. Inspect the affected screen and its neighboring states in the running desktop app. Include open menus, focus, hover, disabled, narrow, dark, light, empty, loading, and error states when applicable.
3. Run `node .codex/skills/unify-desktop-ui/scripts/audit-ui.mjs` from the repository root. Treat every error as blocking. Review warnings in the files being touched and reduce them when practical.
4. Extend the existing semantic tokens or design-system primitives before adding feature-local styling. Avoid abstractions used only once.
5. Keep feature orchestration, reusable controls, and styles in separate focused files. Do not grow an implementation file beyond 800 lines; extract a coherent component first when touching an existing oversized file.
6. Add interaction tests for shared controls and snapshot or visual coverage for visible changes when the repository supports it.
7. Run `pnpm run lint`, `pnpm test`, and `pnpm run build:renderer` from `desktop-app`. Re-run the audit and visually verify the production result.

## Implementation Rules

- Import shared UI from `src/renderer/design-system`; do not create another select, menu surface, dismissible layer, focus ring, control height, font stack, or shadow locally.
- Use semantic CSS variables. Raw palette values, font stacks, and font sizes belong in `design-system/tokens.css`; global behavior belongs in `foundation.css`; reusable control visuals belong in `components.css`.
- Use `Select` for app-styled dropdowns and `MenuSurface` plus `MenuItem` for action menus. Preserve keyboard navigation, Escape and outside dismissal, focus visibility, roles, labels, and disabled states.
- Use the UI font for application chrome and the mono font only for code, terminal, diffs, file paths, or other genuinely monospaced data.
- Prefer semantic class names and variants over selectors tied to DOM position. Avoid `!important`, hardcoded white, magic z-index additions, and duplicate hover/focus rules.
- Keep new color, spacing, type, shape, and elevation decisions theme-safe. Validate both light and dark themes; do not rely on color alone to communicate state.
- Keep compact controls legible and targetable. Use an existing control-size token and do not introduce text smaller than `--font-size-caption`.
- Render large or virtualized content with its owning library, but supply runtime styles through `runtimeTokens.ts` rather than duplicating theme constants.

## Completion Standard

The UI is complete only when it uses the shared system, works with pointer and keyboard, remains readable at supported font sizes, has no audit errors, passes repository checks, and has been inspected in the running app at the relevant dimensions and themes.

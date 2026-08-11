# Desktop Design System Contract

## Source of truth

| Concern                                                                 | Owner                                                           |
| ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| Palette, typography, spacing, control size, radius, shadow, motion      | `desktop-app/src/renderer/design-system/tokens.css`             |
| Reset, inheritance, focus visibility, disabled behavior, reduced motion | `desktop-app/src/renderer/design-system/foundation.css`         |
| Shared select, menu, control, surface, and scrollbar visuals            | `desktop-app/src/renderer/design-system/components.css`         |
| Select behavior and accessibility                                       | `desktop-app/src/renderer/design-system/Select.tsx`             |
| Menu structure and semantics                                            | `desktop-app/src/renderer/design-system/Menu.tsx`               |
| Outside-click and Escape dismissal                                      | `desktop-app/src/renderer/design-system/useDismissibleLayer.ts` |
| Monaco and xterm runtime values                                         | `desktop-app/src/renderer/design-system/runtimeTokens.ts`       |
| Feature-specific layout                                                 | `desktop-app/src/renderer/styles/*.css`                         |

Import the design-system styles once from `src/renderer/main.tsx` in this order: tokens, foundation, feature styles, then shared component normalization. This keeps semantic defaults stable while allowing the shared components to normalize legacy feature selectors during migration.

## Typography

- UI: the system stack in `--font-ui` for navigation, settings, labels, buttons, menus, and prose.
- Mono: `--font-mono` for code, terminals, diffs, file paths, command output, and fixed-width data.
- Sizes are semantic: `caption`, `meta`, `control`, `body`, `label`, `title`, `prose`, `heading`, `display`, `content-heading`, `hero`, and `content-display`. Never place raw `px` font sizes in feature CSS.
- Use `--font-size-prose` and `--line-height-prose` for conversation reading surfaces, `--font-size-body` for ordinary application copy, `--font-size-label` for primary navigation, `--font-size-control` for secondary controls, and `--font-size-meta` or `--font-size-caption` only for genuinely supplemental information.
- The document default is `--font-size-body`. A component may opt into a smaller role only when its information hierarchy remains legible beside neighboring controls.
- The user's UI font-size preference scales every type token. The editor preference remains independent.
- Use `--font-weight-ui` for ordinary controls, `--font-weight-medium` for emphasis, and `--font-weight-semibold` only for strong hierarchy.
- Use `--text` for ordinary readable content, `--text-dim` for secondary labels, and `--muted` only for supplemental metadata. Do not render primary navigation, task titles, form labels, or prose with `--muted`.

## Controls and overlays

- Selects: use `Select`. Supply a visible label or `aria-label`, stable values, and disabled behavior. Do not use native `<select>` in application chrome.
- Action menus: use `MenuSurface`, `MenuItem`, `MenuLabel`, and `MenuSeparator`. Menu items must remain buttons unless they are true links.
- Dismissible overlays: use `useDismissibleLayer`; keep trigger `aria-expanded` and `aria-controls` relationships accurate.
- Buttons: use the shared primary, secondary, or icon-control dimensions. Add a named variant instead of a one-off radius or height.
- Focus: never remove the foundation `:focus-visible` ring without providing an equal or stronger replacement.
- Motion: use `--transition-control`; reduced-motion behavior is global.

## Workspace dock

- Keep the workspace tab strip aligned with neighboring top-level headers through `--workbench-header-height`; use the small control height and supplemental UI type role inside that shared bar.
- Size tool tabs from their icon and label. Do not add a feature-specific minimum width that makes short labels such as Terminal or Files look padded.
- Use the same tab anatomy for files and tools, with medium weight reserved for the active tool and close affordances included only when the tab can close.
- Xterm must use `terminalFontSize` from `runtimeTokens.ts` so its larger cell metrics remain optically aligned with Monaco. Do not pass the editor preference directly or introduce a second terminal-only constant.

## Layout and organization

- On macOS, use the hidden title bar with the native overlay; do not manually offset traffic lights. The sidebar top bar reserves `--titlebar-native-controls-width`, uses 24px icon controls, and aligns every control within `--workbench-header-height`.
- Keep the new-task surface, conversation content, and follow-up composer on the shared `--chat-column-width`. Do not introduce separate width caps that make the input narrower than the content it controls.
- Let the chat column shrink to its parent at compact widths; preserve its horizontal gutter instead of switching to a second fixed width.
- Keep top-level view files responsible for state and orchestration. Move reusable or internally complex UI into a sibling component file.
- Keep CSS grouped by feature under `styles/`; shared visuals belong in `design-system/components.css`.
- Target files below 500 lines and prevent new implementation files from crossing 800 lines. Existing oversized files are migration targets: extract a coherent unit whenever one is modified.
- Use spacing and radius tokens for new work. A feature-specific measurement is acceptable only when it expresses real layout geometry rather than visual preference.
- Sidebar rows share `SidebarRow`, `--sidebar-gutter`, `--sidebar-icon-column`, and `--sidebar-row-height`. Navigation, repository, task, and empty-state labels must resolve to the same text axis.
- Hover uses `--surface-hover`; persistent selection uses `--surface-selected`; selected hover uses `--surface-selected-hover`. Never use one surface token for both transient hover and current selection.

## Stateful interaction patterns

- Disclosure state belongs to the individual item with a stable identity. Reasoning traces start expanded, while other activity starts collapsed; never use one parent boolean or a whole-turn collapse flag for a list of traces, cards, or tool calls.
- Treat the selected model and reasoning effort as one composer configuration and expose one selector. When compact composer text wraps onto multiple lines, move its controls to a dedicated toolbar row beneath the text.
- Workspace tabs are an ordered collection plus one active tab. Opening a tool appends or focuses its existing tab; it must not replace unrelated open tabs.
- Large pasted sources are context, not ordinary textarea prose. Collapse long pastes into `ComposerContextCard`, submit them as UTF-8 `text_elements` ranges, and render them with `SubmittedContextBlock` so the request stays scannable before and after submission.
- Make user-message surfaces span the shared chat column. The last user-message group in every turn stays sticky within that turn: it remains in normal flow while visible, pins only when it reaches the top edge, and releases before the next turn takes over.
- Collapse user-message text only when it exceeds three rendered prose lines. Keep exactly three lines visible, fade the third line into the message surface without an ellipsis, and let pointer and keyboard users expand or collapse the complete text. Never truncate the underlying prompt or hide its attachment and context controls.
- Parse legacy user-message envelopes at the renderer boundary and present their files/context as structured controls. Never display transport headings or temporary paths as raw conversation prose.
- Treat the conversation as a reading surface, not application chrome. User and assistant prose use the 15px prose role at approximately 22px line height and the primary foreground. The user message spans the column with a 14px radius, an 8% border, and 8px by 12px padding; assistant prose uses a 10px horizontal inset. Activity summaries use the same readable size but the muted foreground; completion timestamps stay on the smaller body or metadata scale.
- During generation, keep the submitted user turn and composer stable. Before response content appears, show one quiet `Planning next moves` status; remove it as soon as reasoning, a tool, or response text becomes visible. Replace Send with an accessible Stop control and lock model configuration until the turn ends. Do not fade or shimmer the response, animate the composer border, or add a second spinner beside visible streamed content.
- Submitting while a regular turn is active appends a complete `PromptSubmission` to that task's FIFO queue; it must not steer implicitly. Show queued prompts above the composer with explicit Steer, remove, and overflow actions. Steer is the only queue action that injects into the active turn. When the turn completes, start exactly one queued prompt as the next turn and continue draining in order. Editing from the overflow menu restores the queued text, attachments, and context blocks to an empty composer before removing the queue item; never overwrite an unrelated draft.

## Theme and accessibility review

For every visible change, inspect dark and light themes, compact and wide layouts, keyboard focus, hover, active, disabled, empty, loading, and failure states that the feature owns. Check that text contrast, hit targets, clipping, scroll behavior, and overlay stacking remain usable. State must have a text, icon, or structural signal in addition to color.

## Allowed exceptions

- Terminal ANSI colors and brand artwork may use literal colors when they are intrinsic palettes, not application chrome.
- Monaco and xterm require JavaScript configuration; read semantic CSS variables with `runtimeTokens.ts` and retain fallbacks there.
- A raw z-index or fixed measurement may be appropriate for an integration boundary. Document why near the declaration and avoid adding a second competing scale.

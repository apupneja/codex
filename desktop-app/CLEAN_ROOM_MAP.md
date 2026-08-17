# Clean-room artifact inventory

This is the working file-by-file map for the authorized macOS build at
`/Applications/ChatGPT.app` (bundle `com.openai.codex`, version
`26.803.61601`, Electron `42.3.0`). The package was unpacked into a temporary
inspection directory. Compiled JavaScript and source-map comments are reference
inputs only: none of those files are imported, copied, or shipped here.

The extracted webview contains 4,710 assets. Most are third-party runtime,
syntax, locale, and icon chunks. The tables below enumerate the host files and
the product-owned route/feature chunks that define observable desktop behavior.
`Implemented` means an original local module owns that responsibility;
`Partial` is recorded explicitly so an absent surface is never mistaken for a
finished clone.

## Electron host inventory

| Extracted file                                              | Observed responsibility                 | Original placement                                                 | Status                                        |
| ----------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| `.vite/build/early-bootstrap.js`                            | Earliest process entry                  | `src/main/index.ts`                                                | Implemented                                   |
| `.vite/build/bootstrap-BVQqPyZ7.js`                         | App lifecycle and renderer boot         | `src/main/index.ts`, `src/main/window.ts`                          | Implemented                                   |
| `.vite/build/main-D-bfL1Mp.js`                              | Primary host services and window wiring | `src/main/app-host.ts`, `src/main/native-actions.ts`               | Partial                                       |
| `.vite/build/core-CShdJPiO.js`                              | Shared host service plumbing            | `src/main/app-host.ts`, `src/shared/bridge.ts`                     | Implemented for current routes                |
| `.vite/build/service-CJETEjOt.js`                           | Long-lived desktop services             | `src/main/app-host.ts`                                             | Partial                                       |
| `.vite/build/preload.js`                                    | Sandboxed renderer bridge               | `src/preload/index.ts`, `src/shared/bridge.ts`                     | Implemented                                   |
| `.vite/build/desktop-open-path-queue-BtqbTQxD.js`           | Folder/deep-link handoff                | `src/main/native-actions.ts`                                       | Folder handoff implemented                    |
| `.vite/build/file-based-logger-BxPXYlxI.js`                 | File diagnostics                        | `src/main/diagnostics.ts`                                          | Implemented                                   |
| `.vite/build/desktop-log-archive-Dc66awLh.js`               | Log archive/export                      | `src/main/diagnostics.ts`                                          | Partial; local log only                       |
| `.vite/build/crash-reporter-env-D80b9sE5.js`                | Fatal-process diagnostics               | `src/main/index.ts`, `src/main/diagnostics.ts`                     | Implemented without telemetry upload          |
| `.vite/build/window-all-closed-9IR0zY5D.js`                 | Platform-specific window lifetime       | `src/main/index.ts`                                                | Implemented                                   |
| `.vite/build/electron-resources-path-BDLw2lp0.js`           | Packaged resource resolution            | `src/main/app-server/client.ts`, builder config                    | Implemented                                   |
| `.vite/build/windows-file-copy-DNg5Avk-.js`                 | Windows file handoff                    | `src/main/native-actions.ts`                                       | Deferred                                      |
| `.vite/build/upload-SyG2DA4J.js`                            | Attachment upload                       | `src/main/native-actions.ts`, `src/renderer/features/composer/`    | Local image/audio inputs implemented          |
| `.vite/build/browser-page-preload.js`                       | Isolated browser surface                | `src/main/window.ts`, `src/renderer/features/panels/SidePanel.tsx` | Implemented with a sandboxed Electron webview |
| `.vite/build/sandbox-preload.js`                            | Isolated sandbox surface                | `src/preload/sandbox.ts`                                           | Deferred                                      |
| `.vite/build/avatar-overlay-composition-surface-preload.js` | Voice/avatar overlay                    | `src/preload/avatar-overlay.ts`                                    | Deferred                                      |
| `.vite/build/worker.js`                                     | Background host work                    | App-server process boundary                                        | No renderer clone required                    |
| `.vite/build/child-process-snapshot-worker.js`              | Child-process snapshots                 | App-server process boundary                                        | No renderer clone required                    |

The large `src-Cz_uUmVl.js` and `src-KMpTO78a.js` chunks are dependency bundles,
not separate product screens. Their required behavior stays behind the narrow
host bridge rather than being mirrored in the renderer.

## Renderer boot and shell inventory

| Extracted file                                 | Observed responsibility                 | Original placement                                        | Status                                                                               |
| ---------------------------------------------- | --------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `index-Dm-UyKUO.js`                            | React mount                             | `src/renderer/main.tsx`                                   | Implemented                                                                          |
| `app-ChsATU3V.js`                              | Top-level route entry                   | `src/renderer/app/App.tsx`                                | Implemented                                                                          |
| `app-main-CgrBInFQ.js`                         | Application providers and desktop shell | `src/renderer/app/AppProvider.tsx`, `src/renderer/state/` | Product modes and mapped routes implemented                                          |
| `rpc-C6HYRV0L.js`                              | Renderer-to-host calls                  | `src/preload/index.ts`, `src/shared/bridge.ts`            | Implemented                                                                          |
| `app-initial-BYOVlUBL.js`                      | Shared application state and controls   | `src/renderer/state/session.tsx`, `src/renderer/ui/`      | Implemented for mapped routes                                                        |
| `app-initial-AYgnwUwc.css`, `app-DuLjgNkx.css` | Theme and utility geometry              | `src/renderer/design-system/`, co-located feature CSS     | Implemented                                                                          |
| `thread-app-shell-chrome-RkwjwWl7.js`          | Sidebar/main/side-panel chrome          | `src/renderer/shell/AppShell.tsx`, `Titlebar.tsx`         | Implemented                                                                          |
| `thread-panel-toggle-button-Ba7yV_W5.js`       | Side-panel visibility                   | `src/renderer/shell/Titlebar.tsx`                         | Implemented                                                                          |
| `sidebar-CVOwfery-BmMnGFXu.js`                 | Sidebar icon chunk                      | `src/renderer/shell/Sidebar.tsx`                          | Implemented                                                                          |
| `local-conversation-side-chat-B3ra91Nu.js`     | Side chat tab                           | `src/renderer/features/panels/SideChatPanel.tsx`          | Implemented with ephemeral forks, streaming turns, approvals, and close confirmation |
| `thread-side-panel-tabs-wXn-7A-V.js`           | Side work surfaces                      | `src/renderer/features/panels/SidePanel.tsx`              | Implemented for files, side chat, browser, terminal, tab lifecycle, and expansion    |
| `thread-browser-panel-tabs-acZtsDs1.js`        | Browser tabs                            | `src/renderer/features/panels/SidePanel.tsx`              | Implemented with navigation, reload, address editing, and external-browser handoff   |

The measured shell constants come from the build and a locally booted copy of
the extracted renderer, not the removed UI: default window `1280 × 820`,
minimum `480 × 600`, titlebar `46px`, sidebar `275px`, Work-home composer
`640px` outer width (`632px` content width), and Codex/conversation composer
`768px` (`max-w-3xl`). Captured live states were used for the Work home,
Chat/Work switch, temporary-chat control, Work/Codex menu, attachment menu,
account menu, migration dialog, Codex access splash, and every settings route.

## New chat and composer inventory

| Extracted file                                      | Observed responsibility                          | Original placement                                                  | Status                                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| live Work route composition                         | Centered “Ready when you are.” and compact input | `src/renderer/features/home/NewTaskPage.tsx`, `src/renderer/shell/` | Implemented with the measured 640px composer, Chat/Work switch, temporary-chat control, navigation, and loading skeletons |
| `new-thread-panel-page-B2dCIdq8.js`                 | Empty Codex canvas and bottom composer           | `src/renderer/features/home/NewTaskPage.tsx`                        | Implemented                                                                                                               |
| `codex-home-announcements-C2bePaNF.js`              | Banners above the Codex composer                 | `src/renderer/features/home/NewTaskPage.tsx`                        | Error/offline banners implemented                                                                                         |
| `composer-utility-bar-C8-7NC5R.js`                  | Attachment/project/environment/access controls   | `src/renderer/features/composer/ComposerUtilityBar.tsx`             | Local attachments and mapped controls implemented                                                                         |
| `composer-project-selector-Ch6vwtSj.js`             | Project chooser                                  | `src/renderer/features/composer/ProjectSelector.tsx`                | Implemented                                                                                                               |
| `permissions-mode-dropdown-B9o4EmeO.js`             | Access mode                                      | `src/renderer/features/composer/PermissionsMenu.tsx`                | Implemented locally                                                                                                       |
| `worktree-environment-dropdown-DeUKEcFV.js`         | Local/worktree environment                       | `src/renderer/features/composer/EnvironmentMenu.tsx`                | Local mode implemented                                                                                                    |
| `local-remote-dropdown-B3TuM1eb.js`                 | Remote environment                               | `src/renderer/features/composer/EnvironmentMenu.tsx`                | Deferred                                                                                                                  |
| `queued-message-list-n2_yUiVS.js`                   | Follow-up queue/edit/delete/steer                | `src/renderer/components/PromptQueue.tsx`                           | Implemented                                                                                                               |
| shared composer export in `app-initial-BYOVlUBL.js` | Text, model, effort, send/stop                   | `src/renderer/components/Composer.tsx`                              | Implemented                                                                                                               |

The unpacked `new-thread-panel-page` remains the Codex workspace: its main
content is intentionally empty above the bottom composer. The Work surface is a
different route and was verified by booting the extracted renderer; it centers
“Ready when you are.” over a single-row composer, includes the centered
Chat/Work switch and temporary-chat control, and does not show suggestion pills
or a disclaimer. Its open attachment popover contains the four observed rows:
photos/files, project chat, image creation, and web search.

## Conversation inventory

| Extracted file                                             | Observed responsibility                 | Original placement                                        | Status                                                                                |
| ---------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `local-conversation-page-DqT4vVtA.js`                      | Conversation route orchestration        | `src/renderer/features/thread/ThreadPage.tsx`             | Implemented                                                                           |
| `local-conversation-thread--qSgzOkZ.js`                    | Thread history/composer composition     | `ThreadTimeline.tsx`, `ThreadPage.tsx`                    | Partial                                                                               |
| `local-conversation-turn-DQZrCwOw.js`                      | User, assistant, reasoning, tool items  | `TurnView.tsx`, `src/renderer/components/UserMessage.tsx` | Implemented core items                                                                |
| `split-items-into-render-groups-DMKs_K-8.js`               | Stable turn grouping                    | `src/renderer/state/thread-store.ts`                      | Partial                                                                               |
| `thread-scroll-layout-BenRN5fA.js`                         | Bottom anchoring and scroll layout      | `src/renderer/features/thread/useThreadScroll.ts`         | Implemented                                                                           |
| `thread-scroll-controller-context-value-YzRx9Ej3.js`       | Shared scroll controller                | `useThreadScroll.ts`                                      | Implemented locally                                                                   |
| `thread-virtualizer-D5BSbZuA.js`                           | Long-thread virtualization              | `ThreadTimeline.tsx`                                      | Deferred                                                                              |
| `thread-overflow-menu-B-VGw6kp.js`                         | Reveal/archive/pin actions              | `ThreadMenu.tsx`                                          | Implemented, including rename, side chat, copy, continue, and scheduled-task branches |
| `thread-pin-shortcut-bridge-KZMzYurs.js`                   | Pin shortcut                            | `ThreadMenu.tsx`                                          | Implemented                                                                           |
| `thread-usage-breakdown-BgsUka7j.js`                       | Credits/model/reasoning/speed breakdown | `UsagePopover.tsx`                                        | Implemented with live usage data and settings handoff                                 |
| `reasoning-item-heading-Dq9I8GTq.js`                       | Reasoning disclosure heading            | `TurnView.tsx`                                            | Implemented                                                                           |
| `tool-activity-disclosure-DkkLM_qM.js`                     | Command/tool disclosure                 | `TurnView.tsx`                                            | Implemented for commands                                                              |
| `diff-summary-BzvYfLke.js`                                 | File-change summary                     | `src/renderer/features/thread/TurnView.tsx`               | Implemented summary and patch rows                                                    |
| `review-tab-route-Bi-PhYOH.js`                             | Review panel route                      | `src/renderer/features/panels/SidePanel.tsx`              | Implemented                                                                           |
| `terminal-panel-1KKoVRG7.js`, `terminal-panel-BAD0tJFF.js` | Integrated terminal                     | `src/renderer/features/terminal/TerminalPanel.tsx`        | Interactive PTY, resize, shortcuts, links, and lifecycle implemented                  |

## Secondary route inventory

| Extracted file                                                                   | Original placement                                      | Status                                                                                                            |
| -------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `automations-page-DFgS-Lv_.js`, `automation-C5nNVvgu.js`                         | `src/renderer/features/automations/AutomationsPage.tsx` | Observed error, search, suggestions, and controls implemented; host scheduling deferred                           |
| `plugins-page-CdG8erOB.js`, `skills-page-Br7gIe4I.js`, `skills-page-Cal3rnOS.js` | `src/renderer/features/skills/SkillsPage.tsx`           | Directory, Skills tab, add menu, exact marketplace dialog, Plugin Creator handoff, and MCP management implemented |
| `skills-settings-DVlEUC5-.js`                                                    | `SkillsPage.tsx`, settings route                        | Partial                                                                                                           |
| `settings-page-o5HqiPJn.js`, `settings-route-state-BKJEqDa4.js`                  | `src/renderer/features/settings/SettingsPage.tsx`       | Shell, search, navigation, and every visible route implemented                                                    |
| `local-environments-settings-page-8A_EBDel.js`                                   | `SettingsRoutes.tsx`, `EnvironmentSettings.tsx`         | Observed empty state and actions implemented                                                                      |
| `worktrees-settings-page-IGqgfi-_.js`                                            | `SettingsRoutes.tsx`, `WorktreeSettings.tsx`            | Observed controls and loading state implemented                                                                   |
| `remote-connections-page-QatQ1DuN.js`, `remote-connections-settings-BO0-N91c.js` | `RemoteConnections.tsx`                                 | Static empty state implemented                                                                                    |
| `projects-index-page-BMz1vrow.js`                                                | `src/renderer/features/projects/ProjectsPage.tsx`       | Local project selection implemented                                                                               |
| `onboarding-page-QCkPZzha.js`, `onboarding-page-3LCOx5Jc.css`                    | `src/renderer/features/onboarding/AccessPage.tsx`       | Sign-in and API-key entry flows implemented                                                                       |
| `access-splash-ToB-v7dT.js`, `codex-local-access-splash-DSi_Qx0l.js`             | `src/renderer/features/onboarding/AccessPage.tsx`       | Implemented and routed from signed-out app-server state                                                           |
| live first-run migration dialog                                                  | `src/renderer/features/onboarding/MigrationModal.tsx`   | Implemented with measured media, copy, feature rows, controls, artwork, and backdrop                              |

## Settings route inventory

The settings renderer was checked route-by-route, including content below the
initial viewport. The complete 106-row keyboard command catalog and the lower
Appearance, Browser, Git, and Worktrees sections are included rather than
stopping at the first screenshot.

| Extracted file(s)                                                      | Original placement                                       | Status                                                          |
| ---------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| `general-settings-Dz0zP8tf.js`, `appearance-settings-CBDrTA7A.js`      | `SettingsPage.tsx`, `SettingsRoutes.tsx`, `settings.css` | General, Theme, both theme editors, and Preferences implemented |
| `agent-settings-CxOlQsfe.js`                                           | `SettingsRoutes.tsx`                                     | Configuration defaults implemented                              |
| `personalization-settings-Cy597z0R.js`                                 | `SettingsRoutes.tsx`                                     | Instructions, save state, warning, and personality implemented  |
| `pets-settings-Br997X72.js`                                            | `SettingsRoutes.tsx`, `pet-assets.css`                   | All nine observed pets and selection behavior implemented       |
| `keyboard-shortcuts-settings-GKZcDLT6.js`                              | `shortcut-data.ts`, `SettingsRoutes.tsx`                 | All 106 observed commands, bindings, and filtering implemented  |
| `usage-settings-CN0ljJcP.js`, `usage-billing-queries-BzwiibiO.js`      | `SettingsRoutes.tsx`                                     | Observed plan, credits, and cancellation states implemented     |
| `plugins-settings-C3u1_j1p.js`, `mcp-settings-zS2DwYOC.js`             | `SettingsRoutes.tsx`                                     | Observed zero-server state and controls implemented             |
| `browser-use-settings-DV41nuqQ.js`, `browser-use-settings-tc86pSbU.js` | `SettingsRoutes.tsx`                                     | General, autofill, downloads, and permissions implemented       |
| `computer-use-settings-BtdRkcIE.js`                                    | `SettingsRoutes.tsx`                                     | Observed unavailable Chrome integration state implemented       |
| `hooks-settings-RK31PezM.js`, `hooks-settings-route-Du4i6bG9.js`       | `SettingsRoutes.tsx`                                     | Empty state and reload control implemented                      |
| `git-settings-D3OtHmBn.js`                                             | `SettingsRoutes.tsx`                                     | Branch, push, review, commit, and PR controls implemented       |
| `local-environments-settings-page-8A_EBDel.js`                         | `SettingsRoutes.tsx`                                     | Project-less empty state implemented                            |
| `worktrees-settings-page-IGqgfi-_.js`                                  | `SettingsRoutes.tsx`                                     | Root, pruning, limit, and loading state implemented             |

## Shared ownership

| Concern                                                | Placement                                                                                                         |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| App-server wire models                                 | `src/shared/protocol.ts`                                                                                          |
| Safe Electron bridge contract                          | `src/shared/bridge.ts`                                                                                            |
| Route and selected-panel state                         | `src/renderer/state/navigation.ts`                                                                                |
| Threads, turns, requests, approvals, and runtime state | `src/renderer/state/session.tsx`                                                                                  |
| Reusable controls and dismissible layers               | `src/renderer/ui/`, `src/renderer/design-system/`                                                                 |
| Screen-specific styling                                | Co-located `*.css` beside each owning feature, plus `src/renderer/app/app.css` and `src/renderer/shell/shell.css` |

## Observed-state verification

The reference and reimplementation were rendered at the same `1280 × 820` CSS
viewport and compared as full-window captures. These figures are audit aids,
not runtime dependencies.

| State                         | Pixel similarity |
| ----------------------------- | ---------------- |
| Work home                     | `0.99547`        |
| Work attachment menu          | `0.99551`        |
| Codex home                    | `0.99288`        |
| Conversation                  | `0.99116`        |
| Work/Codex mode menu          | `0.99279`        |
| Account menu                  | `0.99174`        |
| Pull requests                 | `0.99554`        |
| Scheduled tasks               | `0.98955`        |
| Plugins                       | `0.99682`        |
| First-run migration           | `0.99111`        |
| Appearance settings           | `0.99167`        |
| Git settings                  | `0.99380`        |
| Usage & billing settings      | `0.99362`        |
| Archived-settings error state | `0.99951`        |

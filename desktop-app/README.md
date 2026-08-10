# Codex Desktop

Codex Desktop is a native workbench for the Codex CLI. It pairs a focused agent conversation with a repository explorer, Monaco editor, diff viewer, and PTY terminal, while keeping the Codex app-server as the source of truth for tasks and execution.

## Product surfaces

- Task history grouped by recency, search, archive, and deep links
- Streaming turns, reasoning, plans, command activity, file changes, MCP calls, and token usage
- Rich prompt composer with model/effort controls, file, image, and audio attachments, steering, interrupt, and dictation
- Repository explorer, multi-file Monaco editor, save flow, unified diff, xterm terminal, and a sandboxed loopback-only web preview
- Command/file/permission/MCP/user-input approval dialogs with request replay after a renderer reload
- Automations, plugins, skills, connected apps, account, appearance, sandbox, and approval settings
- Dark/light/system themes, reduced-motion support, responsive panels, keyboard navigation, and native menus

## Architecture

The Electron main process owns one long-lived `codex app-server` child over JSONL stdio. A sandboxed preload exposes a narrow, allow-listed API; the renderer has no Node.js access. App-server requests are correlated, timed out, size capped, replayed across renderer reloads, and rejected if the runtime exits. The packaged application includes the canonical `codex-app-server` distribution and its helper binaries as an external resource.

## Development

From the repository root:

```sh
pnpm install
pnpm desktop:dev
```

Development resolves the runtime in this order: `CODEX_DESKTOP_APP_SERVER_COMMAND` (JSON argv array), `CODEX_DESKTOP_BINARY`, a staged package, a local debug build, the ChatGPT app runtime on macOS, then `codex` on `PATH`.

## Validation

```sh
pnpm desktop:test
pnpm --dir desktop-app lint
pnpm --dir desktop-app build
pnpm --dir desktop-app smoke
pnpm --dir desktop-app package:dir
pnpm desktop:smoke:packaged
```

The first smoke test launches Electron against a deterministic mock app-server. The packaged smoke test uses an isolated `CODEX_HOME` and the real bundled CLI runtime. Both capture and validate a rendered frame under `desktop-app/artifacts/`.

Blocking repository CI runs the desktop formatter, type-checker, unit tests, renderer/main build, and deterministic Electron smoke capture under Xvfb. The post-merge desktop package matrix then builds the bundled native runtime and launches the unpacked application on Linux x64, macOS arm64, and Windows x64.

## Packaging

```sh
pnpm desktop:package
```

This builds a release-profile canonical app-server package, bundles the desktop UI, and emits the host platform's installer under `desktop-app/release/`. Signing and notarization credentials are supplied through the standard electron-builder environment variables in release CI.

Release packaging fails closed when platform trust credentials are unavailable. It also verifies that the packaged runtime target matches the Electron architecture and validates the resulting artifacts:

- macOS requires `CSC_LINK` or an OpenAI `CSC_NAME` (or an installed OpenAI Developer ID Application identity), plus one complete electron-builder notarization set: App Store Connect API key, Apple ID, or notary keychain credentials. Signing is pinned to OpenAI Apple team `2DC432GLL2`; any supplied `CODEX_DESKTOP_MAC_TEAM_ID` or `APPLE_TEAM_ID` must match it. The release must pass strict `codesign`, exact team/authority verification, stapler, and Gatekeeper checks.
- Windows requires `WIN_CSC_LINK` or `CSC_LINK` and `CODEX_DESKTOP_WINDOWS_PUBLISHER_SUBJECT`, set to the exact canonical X.509 subject emitted by the approved OpenAI signing certificate. Every installer, Electron executable, and bundled runtime executable must have a valid Authenticode signature from that exact publisher. `CODEX_DESKTOP_WINDOWS_CERTIFICATE_SHA256` may additionally pin a specific certificate using its 64-hex-character SHA-256 fingerprint (colons are accepted).
- Linux requires a secret GPG key selected by `CODEX_DESKTOP_LINUX_GPG_KEY_ID`. The AppImage and Debian package receive verified detached `.asc` signatures.

The runtime target defaults to the current host architecture. Set `CODEX_DESKTOP_TARGET` to build another architecture on the same native operating system; the packaging driver passes the corresponding `--x64` or `--arm64` flag to electron-builder. Supported values are:

```text
aarch64-apple-darwin
x86_64-apple-darwin
aarch64-unknown-linux-musl
x86_64-unknown-linux-musl
aarch64-pc-windows-msvc
x86_64-pc-windows-msvc
```

Cross-operating-system installer builds are rejected because platform signing and trust verification must run natively. Cross-architecture builds require the corresponding Rust target and native linker. In particular, Linux packaging uses MUSL: install the selected target with `rustup target add <target>` and provide the matching MUSL compiler/linker before running the package command. Set `CODEX_DESKTOP_PYTHON` if the Python 3 executable is not named `python3` (`python` is used by default on Windows).

Useful local packaging command:

```sh
pnpm --dir desktop-app package:dir
```

Directory builds do not require release credentials. On macOS they receive an entitlement-preserving ad-hoc signature and are then signature-verified; these local artifacts are intentionally not Gatekeeper-distributable. Release packaging uses the configured Developer ID certificate and notarization credentials and refuses to finish without verified platform trust.

Treat the Windows publisher subject (and optional certificate fingerprint) as protected, reviewed release-environment configuration. Copy the subject exactly from the approved certificate; do not use a friendly display name or a substring. Certificate rotation must update this trust pin in the protected release environment before packaging.

## Shortcuts

- `Cmd/Ctrl+N`: new task
- `Cmd/Ctrl+O`: open repository
- `Cmd/Ctrl+K`: search tasks, files, and actions
- `Cmd/Ctrl+B`: toggle sidebar
- `Cmd/Ctrl+,`: settings
- `Cmd/Ctrl+S`: save the active editor file

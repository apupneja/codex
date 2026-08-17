# ChatGPT desktop reimplementation

This directory contains an original Electron client for the public Codex app-server protocol. It was implemented from protocol schemas and observable behavior in the authorized ChatGPT desktop build. It does not import compiled code from that package or reuse the removed desktop implementation.

[`CLEAN_ROOM_MAP.md`](CLEAN_ROOM_MAP.md) records the extracted host and product-route files one by one, their observed responsibility, the module that owns the new implementation, and any deliberately unfinished surface. The current geometry is taken from build `26.803.61601` and verified in a locally booted copy of its renderer: Electron `42.3.0`, a `1280 × 820` default window, `46px` chrome, a `275px` sidebar, a `640px` Work composer (`632px` content width), and a `768px` Codex/conversation column. The Work shell includes the observed Chat/Work switch, temporary-chat control, navigation/loading state, and four-row attachment menu.

The renderer is sandboxed and communicates through a narrow preload bridge. The main process starts `codex app-server`, speaks JSON-RPC over stdio, and forwards notifications and approval requests to the active window.

```sh
pnpm install
pnpm --dir desktop-app dev
pnpm --dir desktop-app test
pnpm --dir desktop-app build
```

Set `CODEX_DESKTOP_APP_SERVER_COMMAND` to a JSON array when a nonstandard runtime is required. The fallback order is `CODEX_DESKTOP_BINARY`, the Codex runtime bundled with `/Applications/ChatGPT.app`, then `codex` on `PATH`.

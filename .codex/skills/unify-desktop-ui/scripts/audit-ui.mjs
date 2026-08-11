#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import process from "node:process";

const root = resolve(process.argv[2] ?? process.cwd());
const renderer = join(root, "desktop-app", "src", "renderer");
const allowedExtensions = new Set([".css", ".ts", ".tsx"]);
const files = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(path);
    } else if (allowedExtensions.has(extname(entry.name))) {
      files.push(path);
    }
  }
}

await collect(renderer);

const errors = [];
const warnings = [];
const tokenFile = join(renderer, "design-system", "tokens.css");
const runtimeTokenFile = join(renderer, "design-system", "runtimeTokens.ts");
const headerStyleFile = join(renderer, "styles", "headers.css");
const sidebarStyleFile = join(renderer, "styles", "sidebar.css");
const conversationStyleFile = join(renderer, "styles", "conversation.css");
const composerFile = join(renderer, "components", "Composer.tsx");
const promptQueueFile = join(renderer, "components", "PromptQueue.tsx");
const userMessageFile = join(renderer, "components", "UserMessage.tsx");
const controllerFile = join(renderer, "state", "useCodexController.ts");
const workspaceStyleFile = join(renderer, "styles", "workspace.css");
const mainWindowFile = join(root, "desktop-app", "src", "main", "index.ts");
const typographyTokens = [
  "caption",
  "meta",
  "control",
  "body",
  "label",
  "title",
  "prose",
  "heading",
  "display",
  "content-heading",
  "hero",
  "content-display",
];
const legacyTypographyToken =
  /--font-size-(?:3xs|2xs|xs|sm|md|base|lg|xl|2xl|3xl|4xl)\b/g;

function report(bucket, path, line, message) {
  bucket.push(`${relative(root, path)}:${line}: ${message}`);
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

const tokenSource = await readFile(tokenFile, "utf8");
if (!/--workbench-header-height:\s*[\d.]+px;/.test(tokenSource)) {
  report(
    errors,
    tokenFile,
    1,
    "missing shared --workbench-header-height geometry token",
  );
}
if (!/--titlebar-native-controls-width:\s*[\d.]+px;/.test(tokenSource)) {
  report(
    errors,
    tokenFile,
    1,
    "missing shared --titlebar-native-controls-width geometry token",
  );
}
if (!/--icon-control-size:\s*24px;/.test(tokenSource)) {
  report(
    errors,
    tokenFile,
    1,
    "keep shared icon controls at the 24px titlebar contract",
  );
}

for (const styleFile of [headerStyleFile, workspaceStyleFile]) {
  const source = await readFile(styleFile, "utf8");
  if (!source.includes("var(--workbench-header-height)")) {
    report(
      errors,
      styleFile,
      1,
      "align top-level panes with --workbench-header-height",
    );
  }
}

const sidebarStyleSource = await readFile(sidebarStyleFile, "utf8");
if (!sidebarStyleSource.includes("var(--titlebar-native-controls-width)")) {
  report(
    errors,
    sidebarStyleFile,
    1,
    "reserve native window controls with --titlebar-native-controls-width",
  );
}

const conversationStyleSource = await readFile(conversationStyleFile, "utf8");
const composerSource = await readFile(composerFile, "utf8");
const promptQueueSource = await readFile(promptQueueFile, "utf8");
const userMessageSource = await readFile(userMessageFile, "utf8");
const controllerSource = await readFile(controllerFile, "utf8");
if (
  !conversationStyleSource.includes(
    ".turn > .user-message-group:not(:has(~ .user-message-group))",
  )
) {
  report(
    errors,
    conversationStyleFile,
    1,
    "keep the last user message in every turn pinned to its owning turn",
  );
}
for (const [source, path, required, message] of [
  [
    composerSource,
    composerFile,
    'aria-label="Queue prompt"',
    "keep an explicit queue action available while generation is active",
  ],
  [
    promptQueueSource,
    promptQueueFile,
    "useDismissibleLayer",
    "queued-prompt overflow menus must use the shared dismissal behavior",
  ],
  [
    promptQueueSource,
    promptQueueFile,
    "Edit prompt",
    "queued prompts must remain editable from their overflow menu",
  ],
  [
    controllerSource,
    controllerFile,
    "steerQueuedPrompt",
    "keep steering separate from ordinary queued submission",
  ],
  [
    userMessageSource,
    userMessageFile,
    "ResizeObserver",
    "detect user-message overflow from rendered prose instead of source length",
  ],
]) {
  if (!source.includes(required)) report(errors, path, 1, message);
}
if (
  !conversationStyleSource.includes("max-height: 3lh;") ||
  !conversationStyleSource.includes(
    ".user-message-text.is-collapsed.is-overflowing",
  )
) {
  report(
    errors,
    conversationStyleFile,
    1,
    "keep long user messages at a fading three-line preview",
  );
}
for (const selector of [".user-message-group", ".user-message"]) {
  const block = conversationStyleSource.match(
    new RegExp(`(?:^|\\n)${selector.replaceAll(".", "\\.")}\\s*\\{([^}]*)\\}`),
  )?.[1];
  if (!block?.includes("width: 100%;")) {
    report(
      errors,
      conversationStyleFile,
      1,
      `${selector} must span the shared chat column`,
    );
  }
}
for (const selector of [".user-message", ".agent-message"]) {
  const block = conversationStyleSource.match(
    new RegExp(`(?:^|\\n)${selector.replaceAll(".", "\\.")}\\s*\\{([^}]*)\\}`),
  )?.[1];
  if (
    !block?.includes("font-size: var(--font-size-prose);") ||
    !block.includes("line-height: var(--line-height-prose);")
  ) {
    report(
      errors,
      conversationStyleFile,
      1,
      `${selector} must use the shared conversation prose typography`,
    );
  }
}
if (
  /\.composer\.is-active::before/.test(
    await readFile(join(renderer, "styles", "composer.css"), "utf8"),
  )
) {
  report(
    errors,
    join(renderer, "styles", "composer.css"),
    1,
    "keep the composer surface stable during streaming; the Stop control communicates active state",
  );
}
for (const declaration of [
  "height: var(--icon-control-size);",
  "width: var(--icon-control-size);",
]) {
  if (!sidebarStyleSource.includes(declaration)) {
    report(
      errors,
      sidebarStyleFile,
      1,
      `missing titlebar control geometry: ${declaration}`,
    );
  }
}

const mainWindowSource = await readFile(mainWindowFile, "utf8");
if (!/titleBarStyle:\s*isMac\s*\?\s*"hidden"/.test(mainWindowSource)) {
  report(
    errors,
    mainWindowFile,
    1,
    'use the macOS "hidden" title bar so native controls share the app header axis',
  );
}
if (!/titleBarOverlay:\s*true/.test(mainWindowSource)) {
  report(errors, mainWindowFile, 1, "use the native macOS title bar overlay");
}
if (/trafficLightPosition/.test(mainWindowSource)) {
  report(
    errors,
    mainWindowFile,
    1,
    "do not manually offset the native macOS traffic lights",
  );
}

let previousTypographySize = 0;
for (const token of typographyTokens) {
  const match = tokenSource.match(
    new RegExp(`--font-size-${token}:\\s*([\\d.]+)px;`),
  );
  if (!match) {
    report(errors, tokenFile, 1, `missing --font-size-${token} token`);
    continue;
  }
  const size = Number(match[1]);
  const index = match.index ?? 0;
  if (size < 10) {
    report(
      errors,
      tokenFile,
      lineNumber(tokenSource, index),
      `--font-size-${token} must remain at least 10px`,
    );
  }
  if (size < previousTypographySize) {
    report(
      errors,
      tokenFile,
      lineNumber(tokenSource, index),
      `--font-size-${token} breaks the ascending typography scale`,
    );
  }
  previousTypographySize = size;
}

for (const file of files) {
  const source = await readFile(file, "utf8");
  const extension = extname(file);

  for (const match of source.matchAll(legacyTypographyToken)) {
    report(
      errors,
      file,
      lineNumber(source, match.index),
      "use a semantic typography role instead of a legacy size token",
    );
  }

  if (extension === ".tsx") {
    for (const match of source.matchAll(/<select\b/g)) {
      report(
        errors,
        file,
        lineNumber(source, match.index),
        "use design-system/Select instead of a native select",
      );
    }
  }

  if (file !== runtimeTokenFile && /fontFamily\s*:\s*["'`]/.test(source)) {
    for (const match of source.matchAll(/fontFamily\s*:\s*["'`]/g)) {
      report(
        warnings,
        file,
        lineNumber(source, match.index),
        "route runtime font configuration through runtimeTokens.ts",
      );
    }
  }

  if (extension === ".css" && file !== tokenFile) {
    for (const match of source.matchAll(/#[\da-f]{3,8}\b|rgba?\([^)]*\)/gi)) {
      report(
        errors,
        file,
        lineNumber(source, match.index),
        "move literal colors into semantic design-system tokens",
      );
    }

    for (const match of source.matchAll(/font-size\s*:\s*([^;]+);/gi)) {
      const value = match[1].trim();
      if (value === "inherit" || value.startsWith("var(--font-size-")) {
        continue;
      }
      report(
        errors,
        file,
        lineNumber(source, match.index),
        "use a typography token instead of a literal font size",
      );
    }

    for (const match of source.matchAll(/font-family\s*:\s*([^;]+);/gi)) {
      const value = match[1].trim();
      if (value !== "inherit" && !value.startsWith("var(")) {
        report(
          errors,
          file,
          lineNumber(source, match.index),
          "define font stacks in design-system/tokens.css",
        );
      }
    }

    for (const match of source.matchAll(/font-weight\s*:\s*\d+/gi)) {
      report(
        errors,
        file,
        lineNumber(source, match.index),
        "use a design-system font-weight token",
      );
    }

    for (const match of source.matchAll(/border-radius\s*:[^;]*\d+px/gi)) {
      report(
        errors,
        file,
        lineNumber(source, match.index),
        "use a design-system radius token",
      );
    }
  }

  if (
    file.endsWith("styles/sidebar.css") &&
    /transform\s*:\s*(?:scale|translateY)/.test(source)
  ) {
    const index = source.search(/transform\s*:\s*(?:scale|translateY)/);
    report(
      errors,
      file,
      lineNumber(source, index),
      "use the shared sidebar icon geometry instead of an optical transform",
    );
  }

  if (/DropdownSelect/.test(source)) {
    report(
      errors,
      file,
      lineNumber(source, source.indexOf("DropdownSelect")),
      "the legacy dropdown is forbidden; use design-system/Select",
    );
  }

  const lines = source.split("\n").length;
  if (extension === ".tsx" && lines > 800 && !file.endsWith(".test.tsx")) {
    report(
      warnings,
      file,
      1,
      `${lines} lines; extract a coherent module before extending this file`,
    );
  }

  if (
    extension !== ".css" &&
    !file.endsWith("CodexMark.tsx") &&
    !file.endsWith("TerminalPanel.tsx") &&
    /#[\da-f]{3,8}\b|rgba?\(/i.test(source)
  ) {
    report(
      warnings,
      file,
      1,
      "contains literal runtime colors; use semantic tokens unless this is an intrinsic palette",
    );
  }
}

console.log(`Desktop UI audit: ${files.length} source files`);
for (const warning of warnings) console.log(`warning: ${warning}`);
for (const error of errors) console.error(`error: ${error}`);
console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);

if (errors.length > 0) process.exitCode = 1;

import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, sep } from "node:path";

import type { JsonObject, JsonValue } from "../shared/types";
import { validateModelContextRequest } from "./model-context-policy";

const MAX_PATH_LENGTH = 32_768;
const MAX_OWNER_CAPABILITIES = 256;
const MAX_TERMINAL_DIMENSION = 1_000;
const MAX_TERMINAL_INPUT_BASE64_BYTES = 8 * 1024 * 1024;
const MAX_READ_FILE_BYTES = 6 * 1024 * 1024;

type OwnerCapabilities = {
  attachments: Set<string>;
  marketplaces: Set<string>;
  skills: Set<string>;
  workspaceRoots: Set<string>;
};

function isPlainObject(value: JsonValue | undefined): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredObject(
  params: JsonObject | undefined,
  method: string,
): JsonObject {
  if (!params) {
    throw new TypeError(`${method} requires params`);
  }
  return params;
}

function requiredString(
  params: JsonObject,
  key: string,
  maximumLength = MAX_PATH_LENGTH,
): string {
  const value = params[key];
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength ||
    value.includes("\0")
  ) {
    throw new TypeError(`${key} must be a non-empty string`);
  }
  return value;
}

function optionalString(params: JsonObject, key: string): string | null {
  const value = params[key];
  if (value === undefined || value === null) return null;
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_PATH_LENGTH ||
    value.includes("\0")
  ) {
    throw new TypeError(`${key} must be a non-empty string when provided`);
  }
  return value;
}

function assertOnlyKeys(params: JsonObject, allowed: Set<string>): void {
  const unexpected = Object.keys(params).find((key) => !allowed.has(key));
  if (unexpected) {
    throw new Error(`Unexpected privileged request field: ${unexpected}`);
  }
}

function assertTerminalSize(value: JsonValue | undefined): void {
  if (!isPlainObject(value)) {
    throw new TypeError("size must be an object");
  }
  assertOnlyKeys(value, new Set(["cols", "rows"]));
  for (const key of ["cols", "rows"] as const) {
    const dimension = value[key];
    if (
      typeof dimension !== "number" ||
      !Number.isInteger(dimension) ||
      dimension < 1 ||
      dimension > MAX_TERMINAL_DIMENSION
    ) {
      throw new RangeError(
        `${key} must be an integer between 1 and ${MAX_TERMINAL_DIMENSION}`,
      );
    }
  }
}

function isPathWithin(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot === "" ||
    (pathFromRoot !== ".." &&
      !pathFromRoot.startsWith(`..${sep}`) &&
      !isAbsolute(pathFromRoot))
  );
}

async function canonicalExistingPath(rawPath: string): Promise<string> {
  if (
    !isAbsolute(rawPath) ||
    rawPath.length === 0 ||
    rawPath.length > MAX_PATH_LENGTH ||
    rawPath.includes("\0")
  ) {
    throw new TypeError("Path must be an absolute local path");
  }
  return realpath(rawPath);
}

function remember(paths: Set<string>, path: string): void {
  paths.delete(path);
  paths.add(path);
  while (paths.size > MAX_OWNER_CAPABILITIES) {
    const oldest = paths.values().next().value;
    if (typeof oldest !== "string") break;
    paths.delete(oldest);
  }
}

function expectedTerminalCommands(): string[][] {
  return [
    ["/bin/bash", "-l"],
    ["/bin/zsh", "-l"],
    ["powershell.exe", "-NoLogo"],
  ];
}

function commandsEqual(left: JsonValue[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((part, index) => part === right[index])
  );
}

/**
 * Tracks local paths that the main process has explicitly disclosed to a
 * renderer and confines privileged app-server requests to those capabilities.
 */
export class RendererRequestPolicy {
  readonly #owners = new Map<number, OwnerCapabilities>();

  clearOwner(ownerId: number): void {
    this.#owners.delete(ownerId);
  }

  async grantWorkspace(ownerId: number, rawPath: string): Promise<string> {
    const canonicalPath = await canonicalExistingPath(rawPath);
    if (!(await stat(canonicalPath)).isDirectory()) {
      throw new TypeError("Workspace must be a directory");
    }
    remember(this.#capabilitiesFor(ownerId).workspaceRoots, canonicalPath);
    return canonicalPath;
  }

  async grantPersistedWorkspaces(
    ownerId: number,
    paths: Array<string | null>,
  ): Promise<void> {
    await Promise.allSettled(
      paths
        .filter((path): path is string => typeof path === "string")
        .map((path) => this.grantWorkspace(ownerId, path)),
    );
  }

  async grantAttachments(ownerId: number, paths: string[]): Promise<void> {
    const capabilities = this.#capabilitiesFor(ownerId);
    for (const path of paths) {
      const canonicalPath = await canonicalExistingPath(path);
      if (!(await stat(canonicalPath)).isFile()) {
        throw new TypeError("Attachment must be a file");
      }
      remember(capabilities.attachments, canonicalPath);
    }
  }

  async assertWorkspacePath(ownerId: number, rawPath: string): Promise<void> {
    const canonicalPath = await canonicalExistingPath(rawPath);
    const roots = this.#owners.get(ownerId)?.workspaceRoots;
    if (
      !roots ||
      ![...roots].some((root) => isPathWithin(root, canonicalPath))
    ) {
      throw new Error("Path is outside the renderer's authorized workspaces");
    }
  }

  async assertWorkspaceDirectory(
    ownerId: number,
    rawPath: string,
  ): Promise<string> {
    const canonicalPath = await canonicalExistingPath(rawPath);
    const roots = this.#owners.get(ownerId)?.workspaceRoots;
    if (
      !roots ||
      ![...roots].some((root) => isPathWithin(root, canonicalPath))
    ) {
      throw new Error("Path is outside the renderer's authorized workspaces");
    }
    if (!(await stat(canonicalPath)).isDirectory()) {
      throw new TypeError("Workspace preference must be a directory");
    }
    return canonicalPath;
  }

  async assertDisclosedPath(ownerId: number, rawPath: string): Promise<void> {
    await this.#canonicalDisclosedPath(ownerId, rawPath);
  }

  async authorizeRequest(
    ownerId: number,
    method: string,
    params: JsonObject | undefined,
  ): Promise<void> {
    switch (method) {
      case "fs/readDirectory":
      case "fs/writeFile": {
        const request = requiredObject(params, method);
        await this.assertWorkspacePath(
          ownerId,
          requiredString(request, "path"),
        );
        break;
      }
      case "fs/readFile": {
        const request = requiredObject(params, method);
        assertOnlyKeys(request, new Set(["path"]));
        const canonicalPath = await this.#canonicalDisclosedPath(
          ownerId,
          requiredString(request, "path"),
        );
        const metadata = await stat(canonicalPath);
        if (!metadata.isFile()) {
          throw new TypeError("fs/readFile requires a regular file");
        }
        if (metadata.size > MAX_READ_FILE_BYTES) {
          throw new RangeError("fs/readFile is limited to 6 MiB files");
        }
        request.path = canonicalPath;
        break;
      }
      case "fs/watch": {
        const request = requiredObject(params, method);
        await this.assertWorkspacePath(
          ownerId,
          requiredString(request, "path"),
        );
        break;
      }
      case "fuzzyFileSearch": {
        const request = requiredObject(params, method);
        const roots = request.roots;
        if (!Array.isArray(roots) || roots.length === 0 || roots.length > 32) {
          throw new TypeError("roots must be a non-empty path array");
        }
        for (const root of roots) {
          if (typeof root !== "string") {
            throw new TypeError("roots must contain only paths");
          }
          await this.assertWorkspacePath(ownerId, root);
        }
        break;
      }
      case "config/read": {
        const request = requiredObject(params, method);
        const cwd = optionalString(request, "cwd");
        if (cwd) await this.assertWorkspacePath(ownerId, cwd);
        break;
      }
      case "plugin/installed":
      case "plugin/list":
      case "skills/list": {
        await this.#assertWorkspaceArray(ownerId, params, "cwds", method);
        break;
      }
      case "plugin/install": {
        const request = requiredObject(params, method);
        const marketplacePath = optionalString(request, "marketplacePath");
        if (marketplacePath) {
          await this.#assertExactCapability(
            ownerId,
            marketplacePath,
            "marketplaces",
          );
        }
        break;
      }
      case "skills/config/write": {
        const request = requiredObject(params, method);
        const skillPath = optionalString(request, "path");
        if (skillPath) {
          await this.#assertExactCapability(ownerId, skillPath, "skills");
        }
        break;
      }
      case "thread/resume":
      case "thread/start":
      case "turn/start":
      case "turn/steer":
      case "review/start": {
        const request = requiredObject(params, method);
        const references = validateModelContextRequest(method, request);
        if (method === "thread/start") {
          await this.assertWorkspacePath(
            ownerId,
            requiredString(request, "cwd"),
          );
        }
        for (const reference of references) {
          reference.entry.path = await this.#canonicalAttachmentPath(
            ownerId,
            reference.path,
          );
        }
        break;
      }
      case "command/exec": {
        await this.#assertTerminalStart(ownerId, params);
        break;
      }
      case "command/exec/write": {
        this.#assertTerminalWrite(params);
        break;
      }
      case "command/exec/resize": {
        this.#assertTerminalResize(params);
        break;
      }
      case "command/exec/terminate": {
        const request = requiredObject(params, method);
        assertOnlyKeys(request, new Set(["processId"]));
        requiredString(request, "processId", 128);
        break;
      }
    }
  }

  async grantResponseCapabilities(
    ownerId: number,
    method: string,
    result: JsonValue,
  ): Promise<void> {
    if (!isPlainObject(result)) return;

    if (
      method === "thread/read" ||
      method === "thread/resume" ||
      method === "thread/start"
    ) {
      const thread = result.thread;
      if (isPlainObject(thread) && typeof thread.cwd === "string") {
        await this.grantWorkspace(ownerId, thread.cwd).catch(() => undefined);
        await this.#grantThreadInputCapabilities(ownerId, thread);
      }
      return;
    }

    if (method === "plugin/list" && Array.isArray(result.marketplaces)) {
      for (const marketplace of result.marketplaces) {
        if (
          isPlainObject(marketplace) &&
          typeof marketplace.path === "string"
        ) {
          await this.#grantExistingCapability(
            ownerId,
            marketplace.path,
            "marketplaces",
          );
        }
      }
      return;
    }

    if (method === "skills/list" && Array.isArray(result.data)) {
      for (const entry of result.data) {
        if (!isPlainObject(entry) || !Array.isArray(entry.skills)) continue;
        for (const skill of entry.skills) {
          if (isPlainObject(skill) && typeof skill.path === "string") {
            await this.#grantExistingCapability(ownerId, skill.path, "skills");
          }
        }
      }
    }
  }

  #capabilitiesFor(ownerId: number): OwnerCapabilities {
    const current = this.#owners.get(ownerId);
    if (current) return current;
    const created: OwnerCapabilities = {
      attachments: new Set(),
      marketplaces: new Set(),
      skills: new Set(),
      workspaceRoots: new Set(),
    };
    this.#owners.set(ownerId, created);
    return created;
  }

  async #assertWorkspaceArray(
    ownerId: number,
    params: JsonObject | undefined,
    key: string,
    method: string,
  ): Promise<void> {
    const request = requiredObject(params, method);
    const paths = request[key];
    if (paths === undefined || paths === null) return;
    if (!Array.isArray(paths) || paths.length > 32) {
      throw new TypeError(`${key} must be a path array`);
    }
    for (const path of paths) {
      if (typeof path !== "string") {
        throw new TypeError(`${key} must contain only paths`);
      }
      await this.assertWorkspacePath(ownerId, path);
    }
  }

  async #assertExactCapability(
    ownerId: number,
    rawPath: string,
    key: "marketplaces" | "skills",
  ): Promise<void> {
    const canonicalPath = await canonicalExistingPath(rawPath);
    if (!this.#owners.get(ownerId)?.[key].has(canonicalPath)) {
      throw new Error("Renderer has not been granted this local resource");
    }
  }

  async #grantExistingCapability(
    ownerId: number,
    rawPath: string,
    key: "marketplaces" | "skills",
  ): Promise<void> {
    try {
      const canonicalPath = await canonicalExistingPath(rawPath);
      remember(this.#capabilitiesFor(ownerId)[key], canonicalPath);
    } catch {
      // A stale catalog item is still safe to display, but cannot be mutated.
    }
  }

  async #grantThreadInputCapabilities(
    ownerId: number,
    thread: JsonObject,
  ): Promise<void> {
    if (!Array.isArray(thread.turns)) return;
    for (const turn of thread.turns) {
      if (!isPlainObject(turn) || !Array.isArray(turn.items)) continue;
      for (const item of turn.items) {
        if (
          !isPlainObject(item) ||
          item.type !== "userMessage" ||
          !Array.isArray(item.content)
        ) {
          continue;
        }
        for (const content of item.content) {
          if (!isPlainObject(content) || typeof content.path !== "string") {
            continue;
          }
          if (content.type === "skill") {
            await this.#grantExistingCapability(
              ownerId,
              content.path,
              "skills",
            );
          } else if (
            content.type === "localAudio" ||
            content.type === "localImage" ||
            content.type === "mention"
          ) {
            try {
              const canonicalPath = await canonicalExistingPath(content.path);
              if ((await stat(canonicalPath)).isFile()) {
                remember(
                  this.#capabilitiesFor(ownerId).attachments,
                  canonicalPath,
                );
              }
            } catch {
              // Missing historical attachments remain visible but cannot be read.
            }
          }
        }
      }
    }
  }

  async #canonicalDisclosedPath(
    ownerId: number,
    rawPath: string,
  ): Promise<string> {
    const canonicalPath = await canonicalExistingPath(rawPath);
    const capabilities = this.#owners.get(ownerId);
    if (
      capabilities &&
      ([...capabilities.workspaceRoots].some((root) =>
        isPathWithin(root, canonicalPath),
      ) ||
        capabilities.attachments.has(canonicalPath) ||
        capabilities.marketplaces.has(canonicalPath) ||
        capabilities.skills.has(canonicalPath))
    ) {
      return canonicalPath;
    }
    throw new Error("Path has not been disclosed to this renderer");
  }

  async #canonicalAttachmentPath(
    ownerId: number,
    rawPath: string,
  ): Promise<string> {
    const canonicalPath = await canonicalExistingPath(rawPath);
    const capabilities = this.#owners.get(ownerId);
    if (
      !capabilities ||
      (![...capabilities.workspaceRoots].some((root) =>
        isPathWithin(root, canonicalPath),
      ) &&
        !capabilities.attachments.has(canonicalPath))
    ) {
      throw new Error("Attachment was not selected by the user");
    }
    if (!(await stat(canonicalPath)).isFile()) {
      throw new TypeError("Attachment must be a regular file");
    }
    return canonicalPath;
  }

  async #assertTerminalStart(
    ownerId: number,
    params: JsonObject | undefined,
  ): Promise<void> {
    const request = requiredObject(params, "command/exec");
    assertOnlyKeys(
      request,
      new Set([
        "command",
        "cwd",
        "disableOutputCap",
        "disableTimeout",
        "processId",
        "size",
        "streamStdin",
        "streamStdoutStderr",
        "tty",
      ]),
    );
    const command = request.command;
    if (
      !Array.isArray(command) ||
      !expectedTerminalCommands().some((expected) =>
        commandsEqual(command, expected),
      )
    ) {
      throw new Error("Renderer may only start the workspace terminal shell");
    }
    for (const key of [
      "disableOutputCap",
      "disableTimeout",
      "streamStdin",
      "streamStdoutStderr",
      "tty",
    ]) {
      if (request[key] !== true) {
        throw new Error(`${key} must be true for a workspace terminal`);
      }
    }
    requiredString(request, "processId", 128);
    assertTerminalSize(request.size);
    await this.assertWorkspacePath(ownerId, requiredString(request, "cwd"));
  }

  #assertTerminalWrite(params: JsonObject | undefined): void {
    const request = requiredObject(params, "command/exec/write");
    assertOnlyKeys(
      request,
      new Set(["closeStdin", "deltaBase64", "processId"]),
    );
    requiredString(request, "processId", 128);
    const encoded = request.deltaBase64;
    const closeStdin = request.closeStdin;
    if (closeStdin !== undefined && typeof closeStdin !== "boolean") {
      throw new TypeError("closeStdin must be a boolean");
    }
    if (encoded === undefined || encoded === null) {
      if (closeStdin !== true) {
        throw new Error("Terminal write must include input or close stdin");
      }
      return;
    }
    if (
      typeof encoded !== "string" ||
      encoded.length > MAX_TERMINAL_INPUT_BASE64_BYTES ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        encoded,
      )
    ) {
      throw new TypeError("deltaBase64 must be bounded, valid base64");
    }
  }

  #assertTerminalResize(params: JsonObject | undefined): void {
    const request = requiredObject(params, "command/exec/resize");
    assertOnlyKeys(request, new Set(["processId", "size"]));
    requiredString(request, "processId", 128);
    assertTerminalSize(request.size);
  }
}

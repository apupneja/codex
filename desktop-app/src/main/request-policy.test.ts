import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  truncate,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { RendererRequestPolicy } from "./request-policy";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "codex-desktop-policy-"));
  temporaryDirectories.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) =>
      rm(path, {
        force: true,
        recursive: true,
      }),
    ),
  );
});

describe("RendererRequestPolicy", () => {
  it("confines filesystem requests to an explicitly granted workspace", async () => {
    const root = await temporaryDirectory();
    const workspace = join(root, "workspace");
    const sibling = join(root, "private.txt");
    const source = join(workspace, "src", "main.ts");
    await mkdir(join(workspace, "src"), { recursive: true });
    await writeFile(source, "export {};", "utf8");
    await writeFile(sibling, "secret", "utf8");
    const policy = new RendererRequestPolicy();

    await policy.grantWorkspace(7, workspace);

    await expect(
      policy.authorizeRequest(7, "fs/readFile", { path: source }),
    ).resolves.toBeUndefined();
    await expect(
      policy.authorizeRequest(7, "fs/readFile", { path: sibling }),
    ).rejects.toThrow("not been disclosed");
  });

  it.runIf(process.platform !== "win32")(
    "rejects a symlink that escapes an authorized workspace",
    async () => {
      const root = await temporaryDirectory();
      const workspace = join(root, "workspace");
      const outside = join(root, "outside");
      await mkdir(workspace);
      await mkdir(outside);
      await writeFile(join(outside, "secret.txt"), "secret", "utf8");
      await symlink(outside, join(workspace, "linked"), "dir");
      const policy = new RendererRequestPolicy();
      await policy.grantWorkspace(9, workspace);

      await expect(
        policy.authorizeRequest(9, "fs/readFile", {
          path: join(workspace, "linked", "secret.txt"),
        }),
      ).rejects.toThrow("not been disclosed");
    },
  );

  it("permits only the workspace terminal request shape", async () => {
    const workspace = await temporaryDirectory();
    const policy = new RendererRequestPolicy();
    await policy.grantWorkspace(11, workspace);
    const request = {
      command: ["/bin/zsh", "-l"],
      cwd: workspace,
      disableOutputCap: true,
      disableTimeout: true,
      processId: "terminal-1",
      size: { cols: 120, rows: 30 },
      streamStdin: true,
      streamStdoutStderr: true,
      tty: true,
    };

    await expect(
      policy.authorizeRequest(11, "command/exec", request),
    ).resolves.toBeUndefined();
    await expect(
      policy.authorizeRequest(11, "command/exec", {
        ...request,
        command: ["rm", "-rf", workspace],
      }),
    ).rejects.toThrow("workspace terminal shell");
    await expect(
      policy.authorizeRequest(11, "command/exec", {
        ...request,
        env: { PATH: "/tmp" },
      }),
    ).rejects.toThrow("Unexpected privileged request field");
  });

  it("allows only user-selected files as external attachments", async () => {
    const root = await temporaryDirectory();
    const workspace = join(root, "workspace");
    const selected = join(root, "selected.png");
    const unselected = join(root, "unselected.png");
    await mkdir(workspace);
    await writeFile(selected, "selected", "utf8");
    await writeFile(unselected, "unselected", "utf8");
    const policy = new RendererRequestPolicy();
    await policy.grantWorkspace(13, workspace);
    await policy.grantAttachments(13, [selected]);

    await expect(
      policy.authorizeRequest(13, "turn/start", {
        effort: "high",
        input: [
          { text: "Inspect this", text_elements: [], type: "text" },
          { path: selected, type: "localImage" },
        ],
        model: null,
        threadId: "thread-1",
      }),
    ).resolves.toBeUndefined();
    await expect(
      policy.authorizeRequest(13, "turn/start", {
        effort: "high",
        input: [
          { text: "Inspect this", text_elements: [], type: "text" },
          { path: unselected, type: "localImage" },
        ],
        model: null,
        threadId: "thread-1",
      }),
    ).rejects.toThrow("Attachment was not selected by the user");
  });

  it("canonicalizes disclosed reads and rejects files over 6 MiB", async () => {
    const workspace = await temporaryDirectory();
    const source = join(workspace, "source.txt");
    const alias = join(workspace, "alias.txt");
    const large = join(workspace, "large.bin");
    await writeFile(source, "safe", "utf8");
    await writeFile(large, "", "utf8");
    await truncate(large, 6 * 1024 * 1024 + 1);
    const policy = new RendererRequestPolicy();
    await policy.grantWorkspace(15, workspace);

    if (process.platform !== "win32") {
      await symlink(source, alias);
      const request = { path: alias };
      await policy.authorizeRequest(15, "fs/readFile", request);
      expect(request.path).toBe(await realpath(source));
    }
    await expect(
      policy.authorizeRequest(15, "fs/readFile", { path: large }),
    ).rejects.toThrow("limited to 6 MiB");
  });

  it("grants a workspace returned by a trusted thread response", async () => {
    const workspace = await temporaryDirectory();
    const source = join(workspace, "main.rs");
    await writeFile(source, "fn main() {}", "utf8");
    const policy = new RendererRequestPolicy();

    await policy.grantResponseCapabilities(17, "thread/read", {
      thread: { cwd: workspace, turns: [] },
    });

    await expect(
      policy.authorizeRequest(17, "fs/readFile", { path: source }),
    ).resolves.toBeUndefined();
  });

  it("drops capabilities when the renderer reloads", async () => {
    const workspace = await temporaryDirectory();
    const policy = new RendererRequestPolicy();
    await policy.grantWorkspace(19, workspace);

    policy.clearOwner(19);

    await expect(
      policy.authorizeRequest(19, "fs/readDirectory", { path: workspace }),
    ).rejects.toThrow("outside the renderer's authorized workspaces");
  });

  it("returns only existing persisted workspaces", async () => {
    const workspace = await temporaryDirectory();
    const missing = join(workspace, "missing");
    const policy = new RendererRequestPolicy();

    const persisted = await policy.grantPersistedWorkspaces(21, [
      workspace,
      missing,
    ]);

    expect(persisted).toEqual(
      new Map([[workspace, await realpath(workspace)]]),
    );
  });
});

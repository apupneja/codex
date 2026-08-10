import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveLaunchCommand } from "./runtime";

describe("resolveLaunchCommand", () => {
  it("fails closed when a packaged app has no bundled runtime", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-desktop-runtime-"));
    expect(() =>
      resolveLaunchCommand({
        appPath: root,
        isPackaged: true,
        resourcesPath: root,
      }),
    ).toThrow("Codex runtime not found");
  });

  it("uses the executable bundled with a packaged app", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-desktop-runtime-"));
    const executable =
      process.platform === "win32"
        ? "codex-app-server.exe"
        : "codex-app-server";
    const binary = join(root, "codex-package", "bin", executable);
    await mkdir(join(root, "codex-package", "bin"), { recursive: true });
    await writeFile(binary, "runtime", "utf8");
    if (process.platform !== "win32") await chmod(binary, 0o755);

    const launch = resolveLaunchCommand({
      appPath: "/ignored",
      isPackaged: true,
      resourcesPath: root,
    });
    expect(launch.command).toBe(binary);
    expect(launch.args).toEqual(["--listen", "stdio://"]);
  });
});

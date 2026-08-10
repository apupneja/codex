import { accessSync, constants, existsSync } from "node:fs";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { homedir } from "node:os";

import type { LaunchCommand } from "./rpc-client";

function isExecutable(path: string): boolean {
  try {
    accessSync(
      path,
      process.platform === "win32" ? constants.F_OK : constants.X_OK,
    );
    return true;
  } catch {
    return false;
  }
}

function findOnPath(name: string, env: NodeJS.ProcessEnv): string | null {
  const extensions =
    process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const directory of (env.PATH ?? env.Path ?? "").split(delimiter)) {
    if (!directory) {
      continue;
    }
    for (const extension of extensions) {
      const candidate = join(directory, `${name}${extension}`);
      if (isExecutable(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

function appServerArgs(binary: string): string[] {
  return /codex-app-server(?:\.exe)?$/i.test(binary)
    ? ["--listen", "stdio://"]
    : ["app-server", "--listen", "stdio://"];
}

export function resolveLaunchCommand(options: {
  appPath: string;
  isPackaged: boolean;
  resourcesPath: string;
}): LaunchCommand {
  const env = { ...process.env };
  const cwd = homedir();

  if (!options.isPackaged && env.CODEX_DESKTOP_APP_SERVER_COMMAND) {
    const parsed = JSON.parse(env.CODEX_DESKTOP_APP_SERVER_COMMAND) as unknown;
    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      !parsed.every((part) => typeof part === "string")
    ) {
      throw new Error(
        "CODEX_DESKTOP_APP_SERVER_COMMAND must be a JSON array of strings",
      );
    }
    const [command, ...args] = parsed;
    if (!command) {
      throw new Error("CODEX_DESKTOP_APP_SERVER_COMMAND cannot be empty");
    }
    return { command, args, cwd, env };
  }

  const executable =
    process.platform === "win32" ? "codex-app-server.exe" : "codex-app-server";
  const packageRoot = join(options.resourcesPath, "codex-package");
  const stagedPackageRoot = join(options.appPath, "resources", "codex-package");
  const candidates = (
    options.isPackaged
      ? [join(packageRoot, "bin", executable)]
      : [
          env.CODEX_DESKTOP_BINARY,
          join(packageRoot, "bin", executable),
          join(stagedPackageRoot, "bin", executable),
          join(
            options.appPath,
            "..",
            "codex-rs",
            "target",
            "debug",
            executable,
          ),
          process.platform === "darwin"
            ? "/Applications/ChatGPT.app/Contents/Resources/codex"
            : undefined,
          findOnPath("codex", env),
        ]
  ).filter((candidate): candidate is string => Boolean(candidate));

  const binary = candidates.find((candidate) => {
    const absolute = isAbsolute(candidate) ? candidate : resolve(candidate);
    return existsSync(absolute) && isExecutable(absolute);
  });
  if (!binary) {
    throw new Error(
      "Codex runtime not found. Stage a canonical codex-app-server package or set CODEX_DESKTOP_BINARY.",
    );
  }

  const command = isAbsolute(binary) ? binary : resolve(binary);
  const binaryPackageRoot = dirname(dirname(command));
  const packagedPath = join(binaryPackageRoot, "codex-path");
  if (existsSync(packagedPath)) {
    const pathKey = process.platform === "win32" ? "Path" : "PATH";
    env[pathKey] = [packagedPath, env[pathKey] ?? env.PATH ?? ""]
      .filter(Boolean)
      .join(delimiter);
  }
  return {
    command,
    args: appServerArgs(command),
    cwd,
    env,
  };
}

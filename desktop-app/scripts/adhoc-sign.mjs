import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform === "darwin") {
  const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const entitlementsPath = join(appRoot, "resources", "entitlements.mac.plist");
  const releaseRoot = join(appRoot, "release");
  const appPaths = existsSync(releaseRoot)
    ? readdirSync(releaseRoot)
        .filter((entry) => entry.startsWith("mac"))
        .map((entry) => join(releaseRoot, entry, "Codex Desktop.app"))
        .filter(existsSync)
    : [];

  if (appPaths.length === 0) {
    throw new Error("No unpacked macOS application was found to verify");
  }

  for (const appPath of appPaths) {
    console.log(`Applying an ad-hoc signature for local testing: ${appPath}`);
    execFileSync(
      "/usr/bin/codesign",
      [
        "--force",
        "--deep",
        "--sign",
        "-",
        "--entitlements",
        entitlementsPath,
        appPath,
      ],
      { stdio: "inherit" },
    );
    execFileSync(
      "/usr/bin/codesign",
      ["--verify", "--deep", "--strict", "--verbose=2", appPath],
      { stdio: "inherit" },
    );
  }
}

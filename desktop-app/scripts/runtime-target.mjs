const TARGETS = new Map([
  [
    "aarch64-apple-darwin",
    { arch: "arm64", platform: "darwin", rustTarget: "aarch64-apple-darwin" },
  ],
  [
    "x86_64-apple-darwin",
    { arch: "x64", platform: "darwin", rustTarget: "x86_64-apple-darwin" },
  ],
  [
    "aarch64-unknown-linux-musl",
    {
      arch: "arm64",
      platform: "linux",
      rustTarget: "aarch64-unknown-linux-musl",
    },
  ],
  [
    "x86_64-unknown-linux-musl",
    {
      arch: "x64",
      platform: "linux",
      rustTarget: "x86_64-unknown-linux-musl",
    },
  ],
  [
    "aarch64-pc-windows-msvc",
    {
      arch: "arm64",
      platform: "win32",
      rustTarget: "aarch64-pc-windows-msvc",
    },
  ],
  [
    "x86_64-pc-windows-msvc",
    {
      arch: "x64",
      platform: "win32",
      rustTarget: "x86_64-pc-windows-msvc",
    },
  ],
]);

function hostTarget(platform, arch) {
  for (const target of TARGETS.values()) {
    if (target.platform === platform && target.arch === arch) {
      return target;
    }
  }
  throw new Error(
    `Unsupported desktop packaging host ${platform}/${arch}. Set CODEX_DESKTOP_TARGET to one of: ${[
      ...TARGETS.keys(),
    ].join(", ")}`,
  );
}

export function resolveRuntimeTarget({
  arch = process.arch,
  env = process.env,
  platform = process.platform,
  target,
} = {}) {
  const requested = target ?? env.CODEX_DESKTOP_TARGET?.trim();
  if (!requested) {
    return hostTarget(platform, arch);
  }
  const resolved = TARGETS.get(requested);
  if (!resolved) {
    throw new Error(
      `Unsupported CODEX_DESKTOP_TARGET ${requested}. Supported targets: ${[
        ...TARGETS.keys(),
      ].join(", ")}`,
    );
  }
  return resolved;
}

export function assertNativePlatform(target) {
  if (target.platform !== process.platform) {
    throw new Error(
      `Desktop installers must be built and trusted on their native platform. ` +
        `${target.rustTarget} requires ${target.platform}, but this host is ${process.platform}.`,
    );
  }
}

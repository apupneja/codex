type PermissionPath = {
  label: string;
  value: string;
};

export type PermissionDetail =
  | { kind: "network" }
  | {
      access: "read" | "readWrite" | "write";
      kind: "fileSystem";
      paths: PermissionPath[];
    };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pathLabel(value: string): string {
  if (value === "/") return "/";
  if (value === ":minimal") return "minimal files";
  if (value === ":project_roots") return "project roots";
  if (value.startsWith(":project_roots/")) {
    return value.slice(":project_roots/".length);
  }
  if (value === ":tmpdir") return "temporary directory";
  const trimmed = value.replace(/\/+$/, "");
  return trimmed.split("/").at(-1) || value;
}

function permissionPath(value: unknown): PermissionPath | null {
  const path = asRecord(value);
  if (path == null) return null;
  let resolved: string | null = null;
  if (path.type === "path" && typeof path.path === "string") {
    resolved = path.path;
  } else if (path.type === "glob_pattern" && typeof path.pattern === "string") {
    resolved = path.pattern;
  } else if (path.type === "special") {
    const special = asRecord(path.value);
    if (special?.kind === "root") resolved = "/";
    else if (special?.kind === "minimal") resolved = ":minimal";
    else if (special?.kind === "project_roots") {
      resolved =
        typeof special.subpath === "string"
          ? `:project_roots/${special.subpath}`
          : ":project_roots";
    } else if (special?.kind === "tmpdir") resolved = ":tmpdir";
    else if (special?.kind === "slash_tmp") resolved = "/tmp";
    else if (special?.kind === "unknown" && typeof special.path === "string") {
      resolved =
        typeof special.subpath === "string"
          ? `${special.path}/${special.subpath}`
          : special.path;
    }
  }
  return resolved == null
    ? null
    : { label: pathLabel(resolved), value: resolved };
}

export function permissionDetails(permissions: unknown): PermissionDetail[] {
  const profile = asRecord(permissions);
  if (profile == null) return [];
  const details: PermissionDetail[] = [];
  if (profile.network != null) details.push({ kind: "network" });

  const fileSystem = asRecord(profile.fileSystem);
  const entries = Array.isArray(fileSystem?.entries) ? fileSystem.entries : [];
  const reads = new Map<string, PermissionPath>();
  const writes = new Map<string, PermissionPath>();
  for (const value of entries) {
    const entry = asRecord(value);
    const path = permissionPath(entry?.path);
    if (path == null) continue;
    if (entry?.access === "read") reads.set(path.value, path);
    else if (entry?.access === "write") writes.set(path.value, path);
  }

  const shared = [...reads].filter(([value]) => writes.has(value));
  const readOnly = [...reads].filter(([value]) => !writes.has(value));
  const writeOnly = [...writes].filter(([value]) => !reads.has(value));
  if (shared.length) {
    details.push({
      access: "readWrite",
      kind: "fileSystem",
      paths: shared.map(([, path]) => path),
    });
  }
  if (readOnly.length) {
    details.push({
      access: "read",
      kind: "fileSystem",
      paths: readOnly.map(([, path]) => path),
    });
  }
  if (writeOnly.length) {
    details.push({
      access: "write",
      kind: "fileSystem",
      paths: writeOnly.map(([, path]) => path),
    });
  }
  return details;
}

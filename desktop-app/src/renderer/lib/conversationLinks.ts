export function localPathFromHref(
  href: string,
  cwd: string | null,
): string | null {
  if (/^[A-Za-z]:[\\/]/.test(href)) {
    return decodeURIComponent(href.split(/[?#]/, 1)[0] ?? href);
  }
  try {
    const url = new URL(href);
    if (url.protocol !== "file:") return null;
    const path = decodeURIComponent(url.pathname);
    return /^\/[A-Za-z]:\//.test(path) ? path.slice(1) : path;
  } catch {
    if (!href || href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(href)) {
      return null;
    }
    const path = decodeURIComponent(href.split(/[?#]/, 1)[0] ?? "");
    return path && cwd ? path : null;
  }
}

export function localPathFromCode(
  value: string,
  cwd: string | null,
): string | null {
  const reference = value.trim();
  if (!reference || /\s/.test(reference)) return null;
  const path = reference
    .replace(/#L\d+(?:C\d+)?$/i, "")
    .replace(/:\d+(?::\d+)?$/, "");
  const absolute = /^(?:[A-Za-z]:[\\/]|[\\/]{2}|\/)/.test(path);
  if (!path || (!absolute && /^[a-z][a-z0-9+.-]*:/i.test(path))) return null;
  const fileName = path.split(/[/\\]/).pop() ?? "";
  const looksLikeFile =
    /^[^/\\]+\.[a-z0-9][a-z0-9._-]*$/i.test(fileName) ||
    /^(?:build|dockerfile|justfile|license|makefile|readme|workspace)$/i.test(
      fileName,
    );
  if (!looksLikeFile) return null;
  return absolute || cwd ? path : null;
}

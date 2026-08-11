const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);
const SEARCH_URL = "https://www.google.com/search";

export type BrowserUrlValidation =
  | { ok: true; url: string }
  | { ok: false; reason: string };

function hasExplicitScheme(input: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(input);
}

function looksLikeHost(input: string): boolean {
  const host = input.split(/[/?#]/, 1)[0]?.split(":", 1)[0] ?? "";
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    input.startsWith("[::1]") ||
    host.includes(".")
  );
}

export function validateBrowserUrl(input: string): BrowserUrlValidation {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "Enter a valid URL or search." };
  }

  const loopback = LOOPBACK_HOSTS.has(url.hostname.toLowerCase());
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    return {
      ok: false,
      reason: "Browser URLs must use HTTPS, except for localhost previews.",
    };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "Browser URLs cannot include credentials." };
  }
  return { ok: true, url: url.toString() };
}

export function resolveBrowserInput(input: string): BrowserUrlValidation {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, reason: "Enter a URL or search." };
  }

  if (looksLikeHost(trimmed)) {
    const loopback = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(
      trimmed,
    );
    return validateBrowserUrl(`${loopback ? "http" : "https"}://${trimmed}`);
  }
  if (hasExplicitScheme(trimmed)) {
    return validateBrowserUrl(trimmed);
  }

  const search = new URL(SEARCH_URL);
  search.searchParams.set("q", trimmed);
  return { ok: true, url: search.toString() };
}

export function isAllowedBrowserNavigation(input: string): boolean {
  return validateBrowserUrl(input).ok;
}

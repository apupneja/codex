const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);

export type PreviewUrlValidation =
  | { ok: true; url: string }
  | { ok: false; reason: string };

function withDefaultScheme(input: string): string {
  if (/^(?:localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(input)) {
    return `http://${input}`;
  }
  return input;
}

/**
 * Canonicalizes a local preview URL while excluding every non-loopback origin.
 * `blockedOrigin` prevents a development renderer from embedding itself with both
 * `allow-scripts` and `allow-same-origin`, which would let it escape its sandbox.
 */
export function validatePreviewUrl(
  input: string,
  blockedOrigin?: string,
): PreviewUrlValidation {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, reason: "Enter a local preview URL." };
  }

  let url: URL;
  try {
    url = new URL(withDefaultScheme(trimmed));
  } catch {
    return { ok: false, reason: "Enter a valid URL." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Preview URLs must use HTTP or HTTPS." };
  }
  if (!LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) {
    return {
      ok: false,
      reason: "Preview is limited to localhost and loopback addresses.",
    };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "Preview URLs cannot include credentials." };
  }

  if (blockedOrigin) {
    try {
      if (url.origin === new URL(blockedOrigin).origin) {
        return {
          ok: false,
          reason: "Preview cannot use the desktop renderer's own origin.",
        };
      }
    } catch {
      // An invalid blocked origin cannot match a valid preview URL.
    }
  }

  return { ok: true, url: url.toString() };
}

export function isAllowedPreviewUrl(
  input: string,
  blockedOrigin?: string,
): boolean {
  return validatePreviewUrl(input, blockedOrigin).ok;
}

import { describe, expect, it } from "vitest";

import { isAllowedPreviewUrl, validatePreviewUrl } from "./preview-url";

describe("validatePreviewUrl", () => {
  it.each([
    ["localhost:5173", "http://localhost:5173/"],
    ["http://127.0.0.1:3000/app?q=1", "http://127.0.0.1:3000/app?q=1"],
    ["https://[::1]:8443/", "https://[::1]:8443/"],
  ])("accepts and canonicalizes loopback URL %s", (input, expected) => {
    expect(validatePreviewUrl(input)).toEqual({ ok: true, url: expected });
  });

  it.each([
    "https://example.com",
    "http://localhost.example.com:5173",
    "http://127.0.0.1.example.com",
    "file:///tmp/index.html",
    "javascript:alert(1)",
    "http://user:password@localhost:5173",
    "",
  ])("rejects unsafe preview URL %s", (input) => {
    expect(isAllowedPreviewUrl(input)).toBe(false);
  });

  it("rejects the renderer origin in development", () => {
    expect(
      validatePreviewUrl(
        "http://127.0.0.1:5178/preview",
        "http://127.0.0.1:5178",
      ),
    ).toEqual({
      ok: false,
      reason: "Preview cannot use the desktop renderer's own origin.",
    });
    expect(
      isAllowedPreviewUrl("http://127.0.0.1:5173", "http://127.0.0.1:5178"),
    ).toBe(true);
  });
});

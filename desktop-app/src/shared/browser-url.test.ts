import { describe, expect, it } from "vitest";

import {
  isAllowedBrowserNavigation,
  resolveBrowserInput,
  validateBrowserUrl,
} from "./browser-url";

describe("resolveBrowserInput", () => {
  it.each([
    ["example.com/docs", "https://example.com/docs"],
    ["localhost:5173", "http://localhost:5173/"],
    ["127.0.0.1:3000/app", "http://127.0.0.1:3000/app"],
  ])("opens host input %s as a URL", (input, expected) => {
    expect(resolveBrowserInput(input)).toEqual({ ok: true, url: expected });
  });

  it("turns plain text into a web search", () => {
    const result = resolveBrowserInput("electron webcontentsview security");
    expect(result.ok && new URL(result.url).searchParams.get("q")).toBe(
      "electron webcontentsview security",
    );
  });

  it.each([
    "http://example.com",
    "file:///tmp/index.html",
    "javascript:alert(1)",
    "https://user:password@example.com",
  ])("rejects unsafe browser URL %s", (input) => {
    expect(resolveBrowserInput(input).ok).toBe(false);
  });
});

describe("validateBrowserUrl", () => {
  it("allows secure public navigation and loopback HTTP", () => {
    expect(isAllowedBrowserNavigation("https://example.com/")).toBe(true);
    expect(isAllowedBrowserNavigation("http://localhost:5173/")).toBe(true);
  });

  it("does not interpret a navigation target as a search", () => {
    expect(validateBrowserUrl("not a url").ok).toBe(false);
  });
});

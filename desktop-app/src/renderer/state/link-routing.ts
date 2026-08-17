export const openInAppBrowserEvent = "chatgpt:open-in-app-browser";

function isLocalDevelopmentUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

export function openLink(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    void window.chatgptDesktop.openExternal(parsed.toString());
    return;
  }
  const preference = localStorage.getItem(
    isLocalDevelopmentUrl(parsed)
      ? "open-local-url-in-target-preference"
      : "open-link-in-target-preference",
  );
  if (preference === "in-app-browser") {
    window.dispatchEvent(
      new CustomEvent(openInAppBrowserEvent, { detail: parsed.toString() }),
    );
    return;
  }
  void window.chatgptDesktop.openExternal(parsed.toString());
}

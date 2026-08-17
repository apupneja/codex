const pinEvent = "chatgpt:thread-pins-changed";

function pinKey(threadId: string) {
  return `chatgpt.thread-pinned.${threadId}`;
}

export function isThreadPinned(threadId: string): boolean {
  return localStorage.getItem(pinKey(threadId)) === "true";
}

export function setThreadPinned(threadId: string, pinned: boolean): void {
  localStorage.setItem(pinKey(threadId), String(pinned));
  window.dispatchEvent(new CustomEvent(pinEvent, { detail: { threadId } }));
}

export function subscribeToThreadPins(onChange: () => void): () => void {
  window.addEventListener(pinEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(pinEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

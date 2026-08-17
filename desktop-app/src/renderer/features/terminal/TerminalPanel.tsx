import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal, type ITheme } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";

import "@xterm/xterm/css/xterm.css";

import type { HostEvent, Thread } from "../../../shared/protocol";

const terminalFontFamily =
  'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

const terminalTheme: ITheme = {
  background: "#181818",
  cursor: "#ffffff",
  cursorAccent: "#181818",
  foreground: "#ffffff",
  selectionBackground: "rgba(255, 255, 255, 0.2)",
};

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function terminalShortcut(event: KeyboardEvent): string | null {
  if (!event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
    return null;
  }
  switch (event.key) {
    case "ArrowLeft":
    case "ArrowUp":
      return "\x01";
    case "ArrowRight":
    case "ArrowDown":
      return "\x05";
    case "Backspace":
      return "\x15";
    case "Delete":
      return "\x0b";
    default:
      return null;
  }
}

export function TerminalPanel({ thread }: { thread: Thread | null }) {
  const processId = useRef(
    `desktop-terminal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const projectName =
    thread?.cwd.split(/[\\/]/).filter(Boolean).pop() || "project";

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const id = processId.current;
    let disposed = false;
    let resizeFrame: number | null = null;
    let started = false;
    const terminal = new Terminal({
      allowProposedApi: true,
      allowTransparency: true,
      cursorBlink: true,
      cursorStyle: "bar",
      fontFamily: terminalFontFamily,
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 1.2,
      theme: terminalTheme,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.attachCustomKeyEventHandler((event) => {
      const isCopy =
        terminal.hasSelection() &&
        ((event.metaKey && event.key.toLowerCase() === "c") ||
          (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "c"));
      if (isCopy) {
        event.preventDefault();
        void navigator.clipboard.writeText(terminal.getSelection());
        return false;
      }
      const shortcut = terminalShortcut(event);
      if (shortcut == null) return true;
      event.preventDefault();
      void window.chatgptDesktop.request("command/exec/write", {
        deltaBase64: encodeBase64(shortcut),
        processId: id,
      });
      return false;
    });
    terminal.open(host);
    fitAddon.fit();

    const receive = (event: HostEvent) => {
      if (
        event.kind !== "notification" ||
        event.method !== "command/exec/outputDelta" ||
        event.params.processId !== id
      ) {
        return;
      }
      terminal.write(decodeBase64(String(event.params.deltaBase64 ?? "")));
    };
    const unsubscribe = window.chatgptDesktop.subscribe(receive);
    const dataSubscription = terminal.onData((value) => {
      void window.chatgptDesktop.request("command/exec/write", {
        deltaBase64: encodeBase64(value),
        processId: id,
      });
    });
    const shell = navigator.platform.startsWith("Win")
      ? ["powershell.exe", "-NoLogo"]
      : navigator.platform.startsWith("Mac")
        ? ["/bin/zsh", "-l"]
        : ["/bin/bash", "-l"];

    void window.chatgptDesktop
      .request("command/exec", {
        command: shell,
        cwd: thread?.cwd,
        disableOutputCap: true,
        disableTimeout: true,
        processId: id,
        size: { cols: terminal.cols, rows: terminal.rows },
        tty: true,
      })
      .then(() => {
        started = true;
      })
      .catch((reason) => {
        if (!disposed) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });

    const resize = () => {
      if (resizeFrame != null) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        if (disposed) return;
        fitAddon.fit();
        if (!started) return;
        void window.chatgptDesktop
          .request("command/exec/resize", {
            processId: id,
            size: { cols: terminal.cols, rows: terminal.rows },
          })
          .catch(() => undefined);
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    return () => {
      disposed = true;
      if (resizeFrame != null) cancelAnimationFrame(resizeFrame);
      observer.disconnect();
      dataSubscription.dispose();
      unsubscribe();
      terminal.dispose();
      void window.chatgptDesktop
        .request("command/exec/terminate", { processId: id })
        .catch(() => undefined);
    };
  }, [retry, thread?.cwd]);

  if (error) {
    return (
      <div
        aria-label={projectName}
        className="terminal-panel terminal-panel--error"
        role="tabpanel"
      >
        <div className="terminal-panel__error-copy">
          <strong>The terminal encountered an error</strong>
          <span>Try reloading the terminal to continue</span>
        </div>
        <button
          onClick={() => {
            setError(null);
            setRetry((value) => value + 1);
          }}
          type="button"
        >
          Reload
        </button>
      </div>
    );
  }

  return (
    <div
      aria-label={projectName}
      className="terminal-panel"
      data-codex-terminal="true"
      data-codex-xterm="true"
      role="tabpanel"
    >
      <div className="terminal-panel__viewport">
        <div className="terminal-panel__host" ref={hostRef} />
      </div>
    </div>
  );
}

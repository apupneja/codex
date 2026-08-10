import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";

import type { RuntimeStatus } from "../../shared/types";
import { decodeBase64, encodeBase64 } from "../lib/encoding";

const MAX_PENDING_INPUT_BYTES = 1024 * 1024;
const MAX_PENDING_INPUT_CHUNKS = 4_096;
const INPUT_BATCH_BYTES = 32 * 1024;
const INPUT_FLUSH_DELAY_MS = 4;

type QueuedInput = {
  bytes: Uint8Array;
  offset: number;
};

type TerminalPanelProps = {
  cwd: string | null;
  runtime: RuntimeStatus;
};

export function TerminalPanel({ cwd, runtime }: TerminalPanelProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = container.current;
    if (!host || !cwd || runtime.phase !== "ready") {
      return;
    }
    const processId = crypto.randomUUID();
    const outputDecoder = new TextDecoder();
    const inputEncoder = new TextEncoder();
    const inputQueue: QueuedInput[] = [];
    let inputFlushTimer: ReturnType<typeof setTimeout> | null = null;
    let inputInFlight = false;
    let inputOverflowWarningShown = false;
    let pendingInputBytes = 0;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingSize = { cols: 0, rows: 0 };
    let closed = false;
    const terminal = new Terminal({
      allowProposedApi: false,
      cursorBlink: true,
      cursorStyle: "bar",
      fontFamily: '"SFMono-Regular", "Cascadia Code", Consolas, monospace',
      fontSize: 12,
      lineHeight: 1.35,
      scrollback: 5_000,
      theme: {
        background: "#0d0e0f",
        foreground: "#d5d5d1",
        cursor: "#f2f0e9",
        black: "#1a1b1d",
        red: "#e16a72",
        green: "#7bb47f",
        yellow: "#d6ac63",
        blue: "#79a7d8",
        magenta: "#b18ad4",
        cyan: "#6eb4b0",
        white: "#d8d8d4",
      },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.loadAddon(
      new WebLinksAddon((_event, uri) => {
        void window.codexDesktop.openExternal(uri);
      }),
    );
    terminal.open(host);
    fit.fit();
    terminal.writeln("\x1b[2mCodex workspace terminal\x1b[0m");

    const platform = runtime.initialized?.platformOs;
    const command =
      platform === "windows"
        ? ["powershell.exe", "-NoLogo"]
        : platform === "macos"
          ? ["/bin/zsh", "-l"]
          : ["/bin/bash", "-l"];

    const unsubscribe = window.codexDesktop.onTerminalOutput((batch) => {
      if (batch.processId !== processId) return;
      let text = "";
      try {
        for (const chunk of batch.chunks) {
          text += outputDecoder.decode(decodeBase64(chunk.deltaBase64), {
            stream: true,
          });
          if (chunk.capReached) {
            text += "\r\n\x1b[33mOutput was truncated by Codex\x1b[0m\r\n";
          }
        }
      } catch {
        text += "\r\n\x1b[31mThe terminal received invalid output.\x1b[0m\r\n";
      }
      if (batch.failure) {
        text += `\r\n\x1b[31m${batch.failure}\x1b[0m\r\n`;
      }
      const acknowledge = () => {
        if (batch.sequence > 0) {
          window.codexDesktop.acknowledgeTerminalOutput(
            processId,
            batch.sequence,
          );
        }
      };
      if (closed || text.length === 0) {
        acknowledge();
      } else {
        terminal.write(text, acknowledge);
      }
    });

    const takeInputBatch = (): Uint8Array => {
      const batch = new Uint8Array(
        Math.min(pendingInputBytes, INPUT_BATCH_BYTES),
      );
      let written = 0;
      while (written < batch.length) {
        const queued = inputQueue[0];
        if (!queued) break;
        const available = queued.bytes.length - queued.offset;
        const length = Math.min(available, batch.length - written);
        batch.set(
          queued.bytes.subarray(queued.offset, queued.offset + length),
          written,
        );
        written += length;
        queued.offset += length;
        pendingInputBytes -= length;
        if (queued.offset === queued.bytes.length) inputQueue.shift();
      }
      return batch;
    };

    const flushInput = () => {
      inputFlushTimer = null;
      if (closed || inputInFlight || pendingInputBytes === 0) return;
      inputInFlight = true;
      const bytes = takeInputBatch();
      void window.codexDesktop
        .request("command/exec/write", {
          deltaBase64: encodeBase64(bytes),
          processId,
        })
        .catch((error: unknown) => {
          inputQueue.splice(0);
          pendingInputBytes = 0;
          if (!closed) {
            terminal.writeln(
              `\r\n\x1b[31m${error instanceof Error ? error.message : String(error)}\x1b[0m`,
            );
          }
        })
        .finally(() => {
          inputInFlight = false;
          if (pendingInputBytes < MAX_PENDING_INPUT_BYTES / 2) {
            inputOverflowWarningShown = false;
          }
          if (!closed && pendingInputBytes > 0 && !inputFlushTimer) {
            inputFlushTimer = setTimeout(flushInput, /*delay*/ 0);
          }
        });
    };

    const input = terminal.onData((data) => {
      const bytes = inputEncoder.encode(data);
      if (
        pendingInputBytes + bytes.length > MAX_PENDING_INPUT_BYTES ||
        inputQueue.length >= MAX_PENDING_INPUT_CHUNKS
      ) {
        if (!inputOverflowWarningShown) {
          inputOverflowWarningShown = true;
          terminal.writeln(
            "\r\n\x1b[33mTerminal input was too large to queue. Try pasting a smaller section.\x1b[0m",
          );
        }
        return;
      }
      inputQueue.push({ bytes, offset: 0 });
      pendingInputBytes += bytes.length;
      if (!inputFlushTimer && !inputInFlight) {
        inputFlushTimer = setTimeout(flushInput, INPUT_FLUSH_DELAY_MS);
      }
    });
    const resize = terminal.onResize(({ cols, rows }) => {
      pendingSize = { cols, rows };
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        void window.codexDesktop
          .request("command/exec/resize", {
            processId,
            size: pendingSize,
          })
          .catch(() => undefined);
      }, 50);
    });
    const observer = new ResizeObserver(() => fit.fit());
    observer.observe(host);

    void window.codexDesktop
      .request<{ exitCode: number }>("command/exec", {
        command,
        cwd,
        disableOutputCap: true,
        disableTimeout: true,
        processId,
        size: { cols: terminal.cols, rows: terminal.rows },
        streamStdin: true,
        streamStdoutStderr: true,
        tty: true,
      })
      .then((result) => {
        if (!closed) {
          terminal.write(outputDecoder.decode());
          terminal.writeln(
            `\r\n\x1b[2mProcess exited with ${result.exitCode}\x1b[0m`,
          );
        }
      })
      .catch((error: unknown) => {
        if (!closed) {
          terminal.writeln(
            `\r\n\x1b[31m${error instanceof Error ? error.message : String(error)}\x1b[0m`,
          );
        }
      });

    return () => {
      closed = true;
      if (inputFlushTimer) clearTimeout(inputFlushTimer);
      if (resizeTimer) clearTimeout(resizeTimer);
      inputQueue.splice(0);
      pendingInputBytes = 0;
      observer.disconnect();
      resize.dispose();
      input.dispose();
      unsubscribe();
      void window.codexDesktop
        .request("command/exec/terminate", { processId })
        .catch(() => undefined);
      terminal.dispose();
    };
  }, [cwd, runtime]);

  if (!cwd) {
    return (
      <div className="panel-empty">Open a repository to start a terminal.</div>
    );
  }
  return <div className="terminal-container" ref={container} />;
}

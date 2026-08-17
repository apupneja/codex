import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";

import type { HostEvent, JsonValue } from "../../shared/protocol";
import { recordDiagnostic } from "../diagnostics";

type PendingRequest = {
  reject(error: Error): void;
  resolve(value: unknown): void;
  timeout: NodeJS.Timeout;
};

function resolveRuntime(): { command: string; args: string[] } {
  const explicitCommand = process.env.CODEX_DESKTOP_APP_SERVER_COMMAND;
  if (explicitCommand) {
    const [command, ...args] = JSON.parse(explicitCommand) as string[];
    if (!command) throw new Error("The configured app-server command is empty");
    return { command, args };
  }
  if (process.env.CODEX_DESKTOP_BINARY) {
    return { command: process.env.CODEX_DESKTOP_BINARY, args: ["app-server"] };
  }
  const installedRuntime = "/Applications/ChatGPT.app/Contents/Resources/codex";
  return {
    command: existsSync(installedRuntime) ? installedRuntime : "codex",
    args: ["app-server"],
  };
}

export class AppServerConnection extends EventEmitter {
  private process: ChildProcessWithoutNullStreams | null = null;
  private startPromise: Promise<void> | null = null;
  private nextId = 0;
  private readonly pending = new Map<number, PendingRequest>();

  async request<T>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    await this.ensureStarted();
    return (await this.sendRequest(method, params)) as T;
  }

  answer(id: string | number, result: JsonValue): void {
    this.write({ id, jsonrpc: "2.0", result });
  }

  close(): void {
    const child = this.process;
    if (!child) return;
    this.disconnect("closed");
    child.kill();
  }

  private ensureStarted(): Promise<void> {
    if (this.startPromise) return this.startPromise;
    if (this.process) return Promise.resolve();
    this.startPromise ??= this.start().finally(
      () => (this.startPromise = null),
    );
    return this.startPromise;
  }

  private async start(): Promise<void> {
    const runtime = resolveRuntime();
    const child = spawn(runtime.command, runtime.args, {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.process = child;
    createInterface({ input: child.stdout }).on("line", (line) =>
      this.receive(line),
    );
    child.stderr.on("data", (chunk) =>
      recordDiagnostic("app-server", String(chunk)),
    );
    child.once("error", (error) => this.disconnect(error.message));
    child.once("exit", (code, signal) =>
      this.disconnect(`exited (${code ?? signal ?? "unknown"})`),
    );
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    await this.sendRequest("initialize", {
      capabilities: { experimentalApi: true },
      clientInfo: {
        name: "codex_desktop_clean_room",
        title: "ChatGPT",
        version: "0.3.0",
      },
    });
    this.write({ jsonrpc: "2.0", method: "initialized", params: {} });
    this.emitEvent({ kind: "runtime", status: "online" });
  }

  private sendRequest(
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, 30_000);
      this.pending.set(id, { reject, resolve, timeout });
      try {
        this.write({ id, jsonrpc: "2.0", method, params });
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private write(message: unknown): void {
    if (!this.process?.stdin.writable) {
      throw new Error("The Codex app-server is unavailable");
    }
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private receive(line: string): void {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }
    if (typeof message.method === "string") {
      const params = (message.params ?? {}) as Record<string, unknown>;
      this.emitEvent(
        typeof message.id === "string" || typeof message.id === "number"
          ? { kind: "request", id: message.id, method: message.method, params }
          : { kind: "notification", method: message.method, params },
      );
      return;
    }
    if (typeof message.id !== "number") return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(message.id);
    if (message.error) {
      const error = message.error as { message?: string };
      pending.reject(new Error(error.message ?? "App-server request failed"));
    } else {
      pending.resolve(message.result);
    }
  }

  private disconnect(reason: string): void {
    if (!this.process) return;
    this.process = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`Codex app-server ${reason}`));
    }
    this.pending.clear();
    this.emitEvent({ kind: "runtime", status: "offline", message: reason });
  }

  private emitEvent(event: HostEvent): void {
    this.emit("event", event);
  }
}

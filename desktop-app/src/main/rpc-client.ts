import { EventEmitter } from "node:events";
import type {
  ChildProcessWithoutNullStreams,
  SpawnOptionsWithoutStdio,
} from "node:child_process";
import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { randomUUID } from "node:crypto";

import type {
  JsonObject,
  JsonValue,
  RpcNotification,
  RpcId,
  RpcRequest,
  RpcResponse,
} from "../shared/types";

const DEFAULT_TIMEOUT_MS = 60_000;
const INITIALIZE_TIMEOUT_MS = 30_000;
const MAX_INBOUND_LINE_BYTES = 64 * 1024 * 1024;
const MAX_OUTBOUND_LINE_BYTES = 10 * 1024 * 1024;

type PendingRequest = {
  method: string;
  reject: (error: Error) => void;
  resolve: (value: JsonValue) => void;
  timeout: NodeJS.Timeout | null;
};

export type LaunchCommand = {
  args: string[];
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
};

export class RpcError extends Error {
  readonly code: number;
  readonly data?: JsonValue;

  constructor(code: number, message: string, data?: JsonValue) {
    super(message);
    this.name = "RpcError";
    this.code = code;
    this.data = data;
  }
}

export class TransportClosedError extends Error {
  constructor(message = "The Codex app-server connection closed.") {
    super(message);
    this.name = "TransportClosedError";
  }
}

export class JsonLineDecoder {
  #buffer = "";
  #decoder = new StringDecoder("utf8");

  push(chunk: Buffer): string[] {
    this.#buffer += this.#decoder.write(chunk);
    if (Buffer.byteLength(this.#buffer, "utf8") > MAX_INBOUND_LINE_BYTES) {
      this.#buffer = "";
      throw new Error(
        `app-server emitted a line larger than ${MAX_INBOUND_LINE_BYTES} bytes`,
      );
    }

    const lines: string[] = [];
    let newline = this.#buffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.#buffer.slice(0, newline).replace(/\r$/, "");
      this.#buffer = this.#buffer.slice(newline + 1);
      if (line.trim()) {
        lines.push(line);
      }
      newline = this.#buffer.indexOf("\n");
    }
    return lines;
  }

  finish(): string[] {
    this.#buffer += this.#decoder.end();
    const remaining = this.#buffer.trim();
    this.#buffer = "";
    return remaining ? [remaining] : [];
  }
}

export class AppServerRpcClient extends EventEmitter {
  #child: ChildProcessWithoutNullStreams | null = null;
  #closing = false;
  #decoder = new JsonLineDecoder();
  #pending = new Map<string, PendingRequest>();
  #respondingServerRequestIds = new Set<string>();
  #serverRequestIds = new Set<string>();
  #writeChain = Promise.resolve();

  get running(): boolean {
    return this.#child !== null && this.#child.exitCode === null;
  }

  async start(
    launch: LaunchCommand,
    client: { name: string; title: string; version: string },
  ): Promise<JsonValue> {
    if (this.running) {
      throw new Error("Codex app-server is already running");
    }

    this.#closing = false;
    this.#decoder = new JsonLineDecoder();
    const options: SpawnOptionsWithoutStdio = {
      cwd: launch.cwd,
      env: launch.env,
      windowsHide: true,
    };
    const child = spawn(launch.command, launch.args, {
      ...options,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.#child = child;

    child.stdout.on("data", (chunk: Buffer) => {
      try {
        for (const line of this.#decoder.push(chunk)) {
          this.#routeLine(line);
        }
      } catch (error) {
        this.emit("transport-error", error);
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child.exitCode === null) {
            child.kill("SIGKILL");
          }
        }, 2_000).unref();
      }
    });
    child.stdout.on("end", () => {
      for (const line of this.#decoder.finish()) {
        this.#routeLine(line);
      }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => this.emit("stderr", chunk));
    child.once("error", (error) => {
      this.emit("transport-error", error);
      this.#failAll(error);
    });
    child.once("exit", (code, signal) => {
      this.#child = null;
      const detail = `Codex app-server exited (${signal ?? code ?? "unknown"})`;
      this.#failAll(new TransportClosedError(detail));
      this.emit("exit", { closing: this.#closing, code, signal });
    });

    const initialized = await this.request(
      "initialize",
      {
        clientInfo: client,
        capabilities: {
          experimentalApi: true,
        },
      },
      INITIALIZE_TIMEOUT_MS,
    );
    await this.notify("initialized");
    return initialized;
  }

  async request<T extends JsonValue = JsonValue>(
    method: string,
    params?: JsonObject,
    timeoutMs: number | null = DEFAULT_TIMEOUT_MS,
  ): Promise<T> {
    if (!this.running) {
      throw new TransportClosedError();
    }

    const id = randomUUID();
    return new Promise<T>((resolve, reject) => {
      const timeout =
        timeoutMs === null
          ? null
          : setTimeout(() => {
              this.#pending.delete(id);
              reject(new Error(`${method} timed out after ${timeoutMs} ms`));
            }, timeoutMs);
      this.#pending.set(id, {
        method,
        reject,
        resolve: (value) => resolve(value as T),
        timeout,
      });

      const message: RpcRequest = { id, method };
      if (params !== undefined) {
        message.params = params;
      }
      this.#send(message).catch((error: unknown) => {
        const pending = this.#pending.get(id);
        if (pending) {
          if (pending.timeout) {
            clearTimeout(pending.timeout);
          }
          this.#pending.delete(id);
          pending.reject(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      });
    });
  }

  async notify(method: string, params?: JsonObject): Promise<void> {
    const message: RpcNotification = { method };
    if (params !== undefined) {
      message.params = params;
    }
    await this.#send(message);
  }

  async respond(id: RpcId, result: JsonValue): Promise<void> {
    const key = requestKey(id);
    if (!this.#serverRequestIds.has(key)) {
      throw new Error(`No pending app-server request with id ${id}`);
    }
    if (this.#respondingServerRequestIds.has(key)) {
      throw new Error(`A response for app-server request ${id} is in flight`);
    }
    this.#respondingServerRequestIds.add(key);
    try {
      await this.#send({ id, result } satisfies RpcResponse);
      this.#serverRequestIds.delete(key);
    } finally {
      this.#respondingServerRequestIds.delete(key);
    }
  }

  async stop(): Promise<void> {
    this.#closing = true;
    const child = this.#child;
    this.#child = null;
    if (!child) {
      return;
    }

    child.stdin.end();
    if (child.exitCode !== null) {
      return;
    }

    if (await waitForExit(child, 1_500)) {
      return;
    }
    child.kill("SIGTERM");
    if (await waitForExit(child, 1_500)) {
      return;
    }
    if (child.exitCode === null) {
      child.kill("SIGKILL");
      await waitForExit(child, 500);
    }
  }

  #routeLine(line: string): void {
    let message: RpcResponse | RpcRequest | RpcNotification;
    try {
      message = JSON.parse(line) as RpcResponse | RpcRequest | RpcNotification;
    } catch {
      this.emit(
        "protocol-warning",
        `Ignored malformed app-server JSON: ${line.slice(0, 300)}`,
      );
      return;
    }

    if ("id" in message && ("result" in message || "error" in message)) {
      const pending = this.#pending.get(String(message.id));
      if (!pending) {
        this.emit(
          "protocol-warning",
          `Received a response for unknown id ${message.id}`,
        );
        return;
      }
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      this.#pending.delete(String(message.id));
      if (message.error) {
        pending.reject(
          new RpcError(
            message.error.code,
            message.error.message,
            message.error.data,
          ),
        );
      } else {
        pending.resolve(message.result ?? null);
      }
      return;
    }

    if ("id" in message && "method" in message) {
      this.#serverRequestIds.add(requestKey(message.id));
      this.emit("server-request", message);
      return;
    }
    if ("method" in message) {
      if (
        message.method === "serverRequest/resolved" &&
        message.params &&
        (typeof message.params.requestId === "string" ||
          typeof message.params.requestId === "number")
      ) {
        this.#serverRequestIds.delete(requestKey(message.params.requestId));
      }
      this.emit("notification", message);
    }
  }

  async #send(
    message: RpcRequest | RpcResponse | RpcNotification,
  ): Promise<void> {
    const encoded = `${JSON.stringify(message)}\n`;
    if (Buffer.byteLength(encoded, "utf8") > MAX_OUTBOUND_LINE_BYTES) {
      throw new Error(
        "Refusing to send an app-server message larger than 10 MiB",
      );
    }

    this.#writeChain = this.#writeChain.then(
      () =>
        new Promise<void>((resolve, reject) => {
          const child = this.#child;
          if (!child || child.exitCode !== null || child.stdin.destroyed) {
            reject(new TransportClosedError());
            return;
          }
          child.stdin.write(encoded, "utf8", (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        }),
    );
    return this.#writeChain;
  }

  #failAll(error: Error): void {
    for (const pending of this.#pending.values()) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.reject(error);
    }
    this.#pending.clear();
    this.#respondingServerRequestIds.clear();
    this.#serverRequestIds.clear();
  }
}

function requestKey(id: RpcId): string {
  return `${typeof id}:${id}`;
}

function waitForExit(
  child: ChildProcessWithoutNullStreams,
  timeoutMs: number,
): Promise<boolean> {
  if (child.exitCode !== null) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      child.removeListener("exit", onExit);
      resolve(false);
    }, timeoutMs);
    child.once("exit", onExit);
  });
}

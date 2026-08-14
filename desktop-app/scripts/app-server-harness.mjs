import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const RELEASE_PATH = "/__codex_harness/release";

function waitForCondition(check, description, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = () => {
      const value = check();
      if (value) {
        resolve(value);
      } else if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for ${description}`));
      } else {
        setTimeout(poll, 10);
      }
    };
    poll();
  });
}

export class SseGate {
  #ready = false;
  #released = false;
  #releasePromise;
  #resolveRelease;

  constructor() {
    this.#releasePromise = new Promise((resolve) => {
      this.#resolveRelease = resolve;
    });
  }

  get ready() {
    return this.#ready;
  }

  get released() {
    return this.#released;
  }

  markReady() {
    this.#ready = true;
  }

  release() {
    if (this.#released) return;
    this.#released = true;
    this.#resolveRelease();
  }

  waitForRelease() {
    return this.#releasePromise;
  }

  waitUntilReady(timeoutMs = 5_000) {
    return waitForCondition(
      () => this.ready,
      "the SSE response to reach its gate",
      timeoutMs,
    );
  }
}

export class CapturedResponsesRequest {
  constructor({ body, headers, method, path }) {
    this.body = body;
    this.headers = headers;
    this.method = method;
    this.path = path;
  }

  bodyJson() {
    return JSON.parse(this.body.toString("utf8"));
  }

  messageInputTexts(role) {
    const input = this.bodyJson().input;
    if (!Array.isArray(input)) return [];
    return input.flatMap((item) => {
      if (item?.type !== "message" || item.role !== role) return [];
      if (typeof item.content === "string") return [item.content];
      if (!Array.isArray(item.content)) return [];
      return item.content.flatMap((part) =>
        part?.type === "input_text" && typeof part.text === "string"
          ? [part.text]
          : [],
      );
    });
  }
}

export class AppServerHarness {
  #activeGates = new Set();
  #queuedResponses = [];
  #requests = [];
  #server;

  constructor() {
    this.#server = createServer((request, response) => {
      void this.#handleRequest(request, response).catch((error) => {
        if (!response.headersSent) {
          response.writeHead(500, {
            "Content-Type": "text/plain; charset=utf-8",
          });
        }
        if (!response.destroyed) response.end(String(error));
      });
    });
  }

  get releaseUrl() {
    return `${this.url}${RELEASE_PATH}`;
  }

  get url() {
    const address = this.#server.address();
    if (!address || typeof address === "string") {
      throw new Error("The app-server harness is not listening");
    }
    return `http://127.0.0.1:${address.port}`;
  }

  async listen() {
    await new Promise((resolve, reject) => {
      this.#server.once("error", reject);
      this.#server.listen(0, "127.0.0.1", () => {
        this.#server.removeListener("error", reject);
        resolve();
      });
    });
  }

  enqueueSse(events, { delayBetweenEventsMs = 0, gateAfterEvents } = {}) {
    const gate = gateAfterEvents ? new SseGate() : null;
    this.#queuedResponses.push({
      delayBetweenEventsMs,
      events,
      gate,
      gateAfterEvents,
    });
    return gate;
  }

  requests() {
    return [...this.#requests];
  }

  singleRequest() {
    if (this.#requests.length !== 1) {
      throw new Error(
        `Expected 1 Responses request, got ${this.#requests.length}`,
      );
    }
    return this.#requests[0];
  }

  waitForRequests(count, timeoutMs = 5_000) {
    return waitForCondition(
      () => (this.#requests.length >= count ? this.requests() : null),
      `${count} Responses API request${count === 1 ? "" : "s"}`,
      timeoutMs,
    );
  }

  async writeCodexConfig(codexHome) {
    await mkdir(codexHome, { recursive: true });
    await writeFile(
      join(codexHome, "config.toml"),
      `model = "mock-model"
approval_policy = "never"
sandbox_mode = "read-only"
model_provider = "mock_provider"

[model_providers.mock_provider]
name = "Mock provider for desktop app tests"
base_url = "${this.url}/v1"
wire_api = "responses"
request_max_retries = 0
stream_max_retries = 0
`,
      { encoding: "utf8", mode: 0o600 },
    );
  }

  async close() {
    for (const response of this.#queuedResponses) response.gate?.release();
    for (const gate of this.#activeGates) gate.release();
    await new Promise((resolve) => this.#server.close(resolve));
  }

  async #handleRequest(request, response) {
    const requestUrl = new URL(request.url ?? "/", this.url);
    if (request.method === "POST" && requestUrl.pathname === RELEASE_PATH) {
      for (const gate of this.#activeGates) gate.release();
      response.writeHead(204).end();
      return;
    }
    if (
      request.method === "GET" &&
      (requestUrl.pathname.endsWith("/v1/models") ||
        requestUrl.pathname.endsWith("/models"))
    ) {
      const body = JSON.stringify({
        data: [
          {
            created: 0,
            id: "mock-model",
            object: "model",
            owned_by: "openai",
          },
        ],
        object: "list",
      });
      response.writeHead(200, {
        "Content-Length": Buffer.byteLength(body),
        "Content-Type": "application/json",
      });
      response.end(body);
      return;
    }
    if (
      request.method !== "POST" ||
      !(
        requestUrl.pathname.endsWith("/v1/responses") ||
        requestUrl.pathname.endsWith("/responses")
      )
    ) {
      response.writeHead(404).end();
      return;
    }

    const body = await readRequestBody(request);
    this.#requests.push(
      new CapturedResponsesRequest({
        body,
        headers: Object.fromEntries(
          Object.entries(request.headers).map(([key, value]) => [
            key.toLowerCase(),
            Array.isArray(value) ? value.join(", ") : (value ?? ""),
          ]),
        ),
        method: request.method,
        path: requestUrl.pathname,
      }),
    );
    const queued = this.#queuedResponses.shift();
    if (!queued) {
      response.writeHead(500).end("No SSE response was queued");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Connection": "close",
      "Content-Type": "text/event-stream",
    });
    response.flushHeaders();
    if (queued.gate) this.#activeGates.add(queued.gate);
    try {
      for (const [index, event] of queued.events.entries()) {
        if (response.destroyed) return;
        response.write(
          `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
        );
        if (
          queued.gate &&
          queued.gateAfterEvents === index + 1 &&
          !queued.gate.released
        ) {
          queued.gate.markReady();
          await queued.gate.waitForRelease();
        }
        if (queued.delayBetweenEventsMs > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, queued.delayBetweenEventsMs),
          );
        }
      }
      response.end();
    } finally {
      if (queued.gate) this.#activeGates.delete(queued.gate);
    }
  }
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.once("end", () => resolve(Buffer.concat(chunks)));
    request.once("error", reject);
  });
}

export function streamingResponse(responseId, itemId, parts) {
  return [
    { type: "response.created", response: { id: responseId } },
    {
      type: "response.output_item.added",
      item: {
        content: [{ text: "", type: "output_text" }],
        id: itemId,
        role: "assistant",
        type: "message",
      },
    },
    ...parts.map((delta) => ({ delta, type: "response.output_text.delta" })),
    {
      type: "response.output_item.done",
      item: {
        content: [{ text: parts.join(""), type: "output_text" }],
        id: itemId,
        role: "assistant",
        type: "message",
      },
    },
    {
      type: "response.completed",
      response: {
        id: responseId,
        usage: {
          input_tokens: 1,
          input_tokens_details: null,
          output_tokens: 1,
          output_tokens_details: null,
          total_tokens: 2,
        },
      },
    },
  ];
}

export function planUpdateResponse(responseId, callId, plan) {
  return [
    { type: "response.created", response: { id: responseId } },
    {
      type: "response.output_item.done",
      item: {
        arguments: JSON.stringify({ plan }),
        call_id: callId,
        name: "update_plan",
        type: "function_call",
      },
    },
    {
      type: "response.completed",
      response: {
        id: responseId,
        usage: {
          input_tokens: 0,
          input_tokens_details: null,
          output_tokens: 0,
          output_tokens_details: null,
          total_tokens: 0,
        },
      },
    },
  ];
}

export function applyPatchResponse(responseId, callId, patch) {
  return [
    { type: "response.created", response: { id: responseId } },
    {
      type: "response.output_item.done",
      item: {
        call_id: callId,
        input: patch,
        name: "apply_patch",
        type: "custom_tool_call",
      },
    },
    {
      type: "response.completed",
      response: {
        id: responseId,
        usage: {
          input_tokens: 0,
          input_tokens_details: null,
          output_tokens: 0,
          output_tokens_details: null,
          total_tokens: 0,
        },
      },
    },
  ];
}

export function shellCommandResponse(responseId, callId, command) {
  return [
    { type: "response.created", response: { id: responseId } },
    {
      type: "response.output_item.done",
      item: {
        arguments: JSON.stringify({
          command,
          timeout_ms: 10_000,
          workdir: null,
        }),
        call_id: callId,
        name: "shell_command",
        type: "function_call",
      },
    },
    {
      type: "response.completed",
      response: {
        id: responseId,
        usage: {
          input_tokens: 0,
          input_tokens_details: null,
          output_tokens: 0,
          output_tokens_details: null,
          total_tokens: 0,
        },
      },
    },
  ];
}

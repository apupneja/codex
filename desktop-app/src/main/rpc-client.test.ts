import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import type { JsonObject, RpcRequest } from "../shared/types";
import { AppServerRpcClient, JsonLineDecoder } from "./rpc-client";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mockServer = join(appRoot, "scripts", "mock-app-server.mjs");
const clients: AppServerRpcClient[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.stop()));
});

describe("JsonLineDecoder", () => {
  it("reassembles fragmented unicode and multiple JSONL messages", () => {
    const decoder = new JsonLineDecoder();
    const encoded = Buffer.from('{"text":"hello 🌎"}\r\n{"ok":true}\n', "utf8");
    expect(decoder.push(encoded.subarray(0, 10))).toEqual([]);
    expect(decoder.push(encoded.subarray(10, 20))).toEqual([]);
    expect(decoder.push(encoded.subarray(20))).toEqual([
      '{"text":"hello 🌎"}',
      '{"ok":true}',
    ]);
    expect(decoder.finish()).toEqual([]);
  });

  it("returns a final unterminated message", () => {
    const decoder = new JsonLineDecoder();
    expect(decoder.push(Buffer.from('{"ready":'))).toEqual([]);
    expect(decoder.push(Buffer.from("true}"))).toEqual([]);
    expect(decoder.finish()).toEqual(['{"ready":true}']);
  });
});

describe("AppServerRpcClient", () => {
  it("initializes, correlates requests, and preserves numeric server request ids", async () => {
    const client = new AppServerRpcClient();
    clients.push(client);
    const initialized = await client.start(
      {
        args: [mockServer],
        command: process.execPath,
        cwd: appRoot,
        env: { ...process.env },
      },
      { name: "desktop_test", title: "Desktop test", version: "0.0.0" },
    );
    expect(initialized).toMatchObject({ platformFamily: expect.any(String) });

    const serverRequest = new Promise<RpcRequest>((resolveRequest) => {
      client.once("server-request", resolveRequest);
    });
    const exchange = client.request<JsonObject>("desktop/test/serverRequest");
    const request = await serverRequest;
    expect(request.id).toBe(73);
    await client.respond(request.id, { decision: "accept" });
    await expect(exchange).resolves.toEqual({
      received: { decision: "accept" },
    });
  });

  it("clears numeric server requests resolved by the runtime", async () => {
    const client = new AppServerRpcClient();
    clients.push(client);
    await client.start(
      {
        args: [mockServer],
        command: process.execPath,
        cwd: appRoot,
        env: { ...process.env },
      },
      { name: "desktop_test", title: "Desktop test", version: "0.0.0" },
    );

    const serverRequest = new Promise<RpcRequest>((resolveRequest) => {
      client.once("server-request", resolveRequest);
    });
    const resolved = new Promise<void>((resolveNotification) => {
      client.on("notification", (notification) => {
        if (notification.method === "serverRequest/resolved") {
          resolveNotification();
        }
      });
    });
    await client.request("desktop/test/resolvedServerRequest");
    expect((await serverRequest).id).toBe(91);
    await resolved;
    await expect(client.respond(91, { decision: "accept" })).rejects.toThrow(
      "No pending app-server request",
    );
  });

  it("supports requests whose lifecycle is controlled by the runtime", async () => {
    const client = new AppServerRpcClient();
    clients.push(client);
    await client.start(
      {
        args: [mockServer],
        command: process.execPath,
        cwd: appRoot,
        env: { ...process.env },
      },
      { name: "desktop_test", title: "Desktop test", version: "0.0.0" },
    );

    await expect(
      client.request("desktop/test/delayed", { delayMs: 20 }, 1),
    ).rejects.toThrow("timed out");
    await expect(
      client.request<JsonObject>("desktop/test/delayed", { delayMs: 20 }, null),
    ).resolves.toEqual({ delayed: true });
  });
});

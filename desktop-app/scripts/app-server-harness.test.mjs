import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AppServerHarness, streamingResponse } from "./app-server-harness.mjs";

test("records model input and gates an in-flight SSE response", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "desktop-harness-test-"));
  const harness = new AppServerHarness();
  await harness.listen();
  try {
    await harness.writeCodexConfig(join(temporaryRoot, "codex-home"));
    const gate = harness.enqueueSse(
      streamingResponse("response-1", "message-1", ["partial", " final"]),
      { gateAfterEvents: 3 },
    );
    assert.ok(gate);

    const response = await fetch(`${harness.url}/v1/responses`, {
      body: JSON.stringify({
        input: [
          {
            content: [{ text: "desktop prompt", type: "input_text" }],
            role: "user",
            type: "message",
          },
        ],
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const bodyPromise = response.text();
    await gate.waitUntilReady();
    assert.equal(gate.released, false);
    gate.release();

    const body = await bodyPromise;
    assert.match(body, /partial/);
    assert.match(body, / final/);
    assert.deepEqual(harness.singleRequest().messageInputTexts("user"), [
      "desktop prompt",
    ]);
    assert.match(
      await readFile(join(temporaryRoot, "codex-home", "config.toml"), "utf8"),
      new RegExp(`${harness.url.replaceAll(".", "\\.")}/v1`),
    );
  } finally {
    await harness.close();
    await rm(temporaryRoot, { force: true, recursive: true });
  }
});

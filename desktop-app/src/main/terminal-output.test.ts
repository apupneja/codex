import { afterEach, describe, expect, it, vi } from "vitest";

import type { TerminalOutputBatch } from "../shared/types";
import {
  TerminalOutputBroker,
  type TerminalOutputFailure,
} from "./terminal-output";

afterEach(() => {
  vi.useRealTimers();
});

describe("TerminalOutputBroker", () => {
  it("keeps only one bounded batch in flight until xterm acknowledges it", async () => {
    vi.useFakeTimers();
    const delivered: TerminalOutputBatch[] = [];
    const broker = new TerminalOutputBroker({
      deliver: (_ownerId, batch) => {
        delivered.push(batch);
        return true;
      },
      flushDelayMs: 5,
      maxBatchBytes: 140,
      maxBufferedBytes: 560,
      onFailure: vi.fn(),
    });
    broker.register(7, "process-1");

    expect(
      broker.enqueue("process-1", {
        capReached: false,
        deltaBase64: "aaaaaa",
      }),
    ).toBe(true);
    await vi.advanceTimersByTimeAsync(5);
    expect(delivered).toEqual([
      {
        chunks: [{ capReached: false, deltaBase64: "aaaaaa" }],
        processId: "process-1",
        sequence: 1,
      },
    ]);

    broker.enqueue("process-1", {
      capReached: false,
      deltaBase64: "bbbbbb",
    });
    await vi.advanceTimersByTimeAsync(20);
    expect(delivered).toHaveLength(1);

    expect(broker.acknowledge(7, "process-1", 1)).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(delivered[1]).toEqual({
      chunks: [{ capReached: false, deltaBase64: "bbbbbb" }],
      processId: "process-1",
      sequence: 2,
    });
    expect(broker.acknowledge(8, "process-1", 2)).toBe(false);
  });

  it("terminates an output producer instead of growing beyond its budget", async () => {
    vi.useFakeTimers();
    const failures: TerminalOutputFailure[] = [];
    const broker = new TerminalOutputBroker({
      deliver: () => true,
      flushDelayMs: 0,
      maxBatchBytes: 136,
      maxBufferedBytes: 272,
      onFailure: (failure) => failures.push(failure),
    });
    broker.register(9, "noisy-process");
    broker.enqueue("noisy-process", {
      capReached: false,
      deltaBase64: "12345678",
    });
    await vi.advanceTimersByTimeAsync(0);

    broker.enqueue("noisy-process", {
      capReached: false,
      deltaBase64: "abcdefgh",
    });
    expect(
      broker.enqueue("noisy-process", {
        capReached: false,
        deltaBase64: "x",
      }),
    ).toBe(true);
    expect(failures).toEqual([
      {
        message:
          "Terminal output exceeded the safe processing buffer. The process was stopped to keep the app responsive.",
        ownerId: 9,
        processId: "noisy-process",
        terminateProcess: true,
      },
    ]);
    expect(
      broker.enqueue("noisy-process", {
        capReached: false,
        deltaBase64: "ignored",
      }),
    ).toBe(false);
  });

  it("does not resolve a completed command until its final output is rendered", async () => {
    vi.useFakeTimers();
    const delivered: TerminalOutputBatch[] = [];
    const broker = new TerminalOutputBroker({
      deliver: (_ownerId, batch) => {
        delivered.push(batch);
        return true;
      },
      flushDelayMs: 0,
      maxBatchBytes: 140,
      maxBufferedBytes: 280,
      onFailure: vi.fn(),
    });
    broker.register(4, "process-final");
    broker.enqueue("process-final", {
      capReached: false,
      deltaBase64: "tail",
    });
    await vi.advanceTimersByTimeAsync(0);

    let completed = false;
    const completion = broker.complete("process-final").then(() => {
      completed = true;
    });
    await Promise.resolve();
    expect(completed).toBe(false);
    expect(broker.acknowledge(4, "process-final", 1)).toBe(true);
    await completion;
    expect(completed).toBe(true);
    expect(delivered).toHaveLength(1);
  });

  it("fails closed if a completed terminal never acknowledges its final batch", async () => {
    vi.useFakeTimers();
    const failures: TerminalOutputFailure[] = [];
    const broker = new TerminalOutputBroker({
      completionTimeoutMs: 20,
      deliver: () => true,
      flushDelayMs: 0,
      maxBatchBytes: 140,
      maxBufferedBytes: 280,
      onFailure: (failure) => failures.push(failure),
    });
    broker.register(5, "process-stalled");
    broker.enqueue("process-stalled", {
      capReached: false,
      deltaBase64: "tail",
    });
    await vi.advanceTimersByTimeAsync(0);

    const completion = broker.complete("process-stalled");
    await vi.advanceTimersByTimeAsync(20);
    await completion;
    expect(failures).toEqual([
      {
        message:
          "Terminal output did not finish rendering in time. Remaining output was discarded.",
        ownerId: 5,
        processId: "process-stalled",
        terminateProcess: false,
      },
    ]);
  });
});

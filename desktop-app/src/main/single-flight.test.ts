import { describe, expect, it, vi } from "vitest";

import { SingleFlight } from "./single-flight";

describe("SingleFlight", () => {
  it("shares one in-flight operation between concurrent callers", async () => {
    const gate = new SingleFlight<number>();
    let resolveOperation: ((value: number) => void) | undefined;
    const operation = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveOperation = resolve;
        }),
    );

    const first = gate.run(operation);
    const second = gate.run(operation);
    await Promise.resolve();
    resolveOperation?.(42);

    await expect(Promise.all([first, second])).resolves.toEqual([42, 42]);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("allows another operation after completion or rejection", async () => {
    const gate = new SingleFlight<number>();

    await expect(gate.run(async () => 1)).resolves.toBe(1);
    await expect(
      gate.run(async () => {
        throw new Error("failed");
      }),
    ).rejects.toThrow("failed");
    await expect(gate.run(async () => 2)).resolves.toBe(2);
  });
});

import type { TerminalOutputBatch, TerminalOutputChunk } from "../shared/types";

const DEFAULT_MAX_BUFFERED_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_BATCH_BYTES = 128 * 1024;
const DEFAULT_FLUSH_DELAY_MS = 8;
const DEFAULT_COMPLETION_TIMEOUT_MS = 30_000;
const QUEUED_CHUNK_OVERHEAD_BYTES = 128;

type QueuedChunk = TerminalOutputChunk & {
  encodedBytes: number;
};

type TerminalOutputSession = {
  completed: boolean;
  completion: Promise<void>;
  completionTimer: NodeJS.Timeout | null;
  flushTimer: NodeJS.Timeout | null;
  inFlight: { bytes: number; sequence: number } | null;
  nextSequence: number;
  ownerId: number;
  processId: string;
  queue: QueuedChunk[];
  queuedBytes: number;
  resolveCompletion: () => void;
};

export type TerminalOutputFailure = {
  message: string;
  ownerId: number;
  processId: string;
  terminateProcess: boolean;
};

type TerminalOutputBrokerOptions = {
  completionTimeoutMs?: number;
  deliver: (ownerId: number, batch: TerminalOutputBatch) => boolean;
  flushDelayMs?: number;
  maxBatchBytes?: number;
  maxBufferedBytes?: number;
  onFailure: (failure: TerminalOutputFailure) => void;
};

/**
 * Bounds terminal output between the app-server transport and Chromium.
 *
 * At most one batch is sent to a renderer at a time. The renderer acknowledges
 * that batch only after xterm has parsed it, which prevents Electron IPC from
 * becoming an unbounded second output buffer. If a producer outruns the
 * renderer past the fixed memory budget, the owning process is terminated.
 */
export class TerminalOutputBroker {
  readonly #completionTimeoutMs: number;
  readonly #deliver: TerminalOutputBrokerOptions["deliver"];
  readonly #flushDelayMs: number;
  readonly #maxBatchBytes: number;
  readonly #maxBufferedBytes: number;
  readonly #onFailure: TerminalOutputBrokerOptions["onFailure"];
  readonly #sessions = new Map<string, TerminalOutputSession>();

  constructor(options: TerminalOutputBrokerOptions) {
    this.#completionTimeoutMs =
      options.completionTimeoutMs ?? DEFAULT_COMPLETION_TIMEOUT_MS;
    this.#deliver = options.deliver;
    this.#flushDelayMs = options.flushDelayMs ?? DEFAULT_FLUSH_DELAY_MS;
    this.#maxBatchBytes = options.maxBatchBytes ?? DEFAULT_MAX_BATCH_BYTES;
    this.#maxBufferedBytes =
      options.maxBufferedBytes ?? DEFAULT_MAX_BUFFERED_BYTES;
    this.#onFailure = options.onFailure;
    if (
      this.#completionTimeoutMs <= 0 ||
      this.#flushDelayMs < 0 ||
      this.#maxBatchBytes <= 0 ||
      this.#maxBufferedBytes < this.#maxBatchBytes
    ) {
      throw new RangeError("Invalid terminal output broker limits");
    }
  }

  register(ownerId: number, processId: string): void {
    if (this.#sessions.has(processId)) {
      throw new Error("Terminal process id is already in use");
    }
    let resolveCompletion: () => void = () => {};
    const completion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });
    this.#sessions.set(processId, {
      completed: false,
      completion,
      completionTimer: null,
      flushTimer: null,
      inFlight: null,
      nextSequence: 1,
      ownerId,
      processId,
      queue: [],
      queuedBytes: 0,
      resolveCompletion,
    });
  }

  enqueue(processId: string, chunk: TerminalOutputChunk): boolean {
    const session = this.#sessions.get(processId);
    if (!session) return false;

    const encodedBytes =
      Buffer.byteLength(chunk.deltaBase64, "utf8") +
      QUEUED_CHUNK_OVERHEAD_BYTES;
    const bufferedBytes =
      session.queuedBytes + (session.inFlight?.bytes ?? 0) + encodedBytes;
    if (bufferedBytes > this.#maxBufferedBytes) {
      this.#fail(
        session,
        "Terminal output exceeded the safe processing buffer. The process was stopped to keep the app responsive.",
      );
      return true;
    }

    session.queue.push({ ...chunk, encodedBytes });
    session.queuedBytes += encodedBytes;
    this.#scheduleFlush(session, this.#flushDelayMs);
    return true;
  }

  acknowledge(ownerId: number, processId: string, sequence: number): boolean {
    const session = this.#sessions.get(processId);
    if (
      !session ||
      session.ownerId !== ownerId ||
      session.inFlight?.sequence !== sequence
    ) {
      return false;
    }
    session.inFlight = null;
    if (this.#finishIfDrained(session)) return true;
    this.#scheduleFlush(session, /*delayMs*/ 0);
    return true;
  }

  async complete(processId: string): Promise<void> {
    const session = this.#sessions.get(processId);
    if (!session) return;
    session.completed = true;
    if (!this.#finishIfDrained(session)) {
      session.completionTimer ??= setTimeout(() => {
        this.#fail(
          session,
          "Terminal output did not finish rendering in time. Remaining output was discarded.",
          /*terminateProcess*/ false,
        );
      }, this.#completionTimeoutMs);
      await session.completion;
    }
  }

  close(processId: string): void {
    const session = this.#sessions.get(processId);
    if (!session) return;
    this.#delete(session);
  }

  closeOwner(ownerId: number): void {
    for (const session of this.#sessions.values()) {
      if (session.ownerId === ownerId) this.#delete(session);
    }
  }

  clear(): void {
    for (const session of this.#sessions.values()) this.#delete(session);
  }

  #delete(session: TerminalOutputSession): void {
    if (session.completionTimer) clearTimeout(session.completionTimer);
    if (session.flushTimer) clearTimeout(session.flushTimer);
    this.#sessions.delete(session.processId);
    session.queue = [];
    session.queuedBytes = 0;
    session.inFlight = null;
    session.resolveCompletion();
  }

  #fail(
    session: TerminalOutputSession,
    message: string,
    terminateProcess = true,
  ): void {
    const failure = {
      message,
      ownerId: session.ownerId,
      processId: session.processId,
      terminateProcess,
    };
    this.#delete(session);
    this.#onFailure(failure);
  }

  #finishIfDrained(session: TerminalOutputSession): boolean {
    if (
      session.completed &&
      session.queue.length === 0 &&
      session.inFlight === null
    ) {
      this.#delete(session);
      return true;
    }
    return false;
  }

  #flush(session: TerminalOutputSession): void {
    session.flushTimer = null;
    if (
      this.#sessions.get(session.processId) !== session ||
      session.inFlight ||
      session.queue.length === 0
    ) {
      this.#finishIfDrained(session);
      return;
    }

    const chunks: TerminalOutputChunk[] = [];
    let batchBytes = 0;
    while (session.queue.length > 0) {
      const next = session.queue[0];
      if (!next) break;
      if (
        chunks.length > 0 &&
        batchBytes + next.encodedBytes > this.#maxBatchBytes
      ) {
        break;
      }
      session.queue.shift();
      session.queuedBytes -= next.encodedBytes;
      batchBytes += next.encodedBytes;
      chunks.push({
        capReached: next.capReached,
        deltaBase64: next.deltaBase64,
      });
      if (batchBytes >= this.#maxBatchBytes) break;
    }

    const sequence = session.nextSequence;
    session.nextSequence += 1;
    session.inFlight = { bytes: batchBytes, sequence };
    let delivered = false;
    try {
      delivered = this.#deliver(session.ownerId, {
        chunks,
        processId: session.processId,
        sequence,
      });
    } catch {
      delivered = false;
    }
    if (!delivered) {
      this.#fail(
        session,
        "The terminal view became unavailable, so its process was stopped.",
      );
    }
  }

  #scheduleFlush(session: TerminalOutputSession, delayMs: number): void {
    if (session.flushTimer || session.inFlight || session.queue.length === 0) {
      return;
    }
    session.flushTimer = setTimeout(() => this.#flush(session), delayMs);
  }
}

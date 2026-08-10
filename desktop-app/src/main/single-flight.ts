/** Serializes an operation and shares its result with concurrent callers. */
export class SingleFlight<T> {
  #inFlight: Promise<T> | null = null;

  run(operation: () => Promise<T>): Promise<T> {
    if (this.#inFlight) return this.#inFlight;

    const result = Promise.resolve().then(operation);
    const tracked = result.finally(() => {
      if (this.#inFlight === tracked) {
        this.#inFlight = null;
      }
    });
    this.#inFlight = tracked;
    return tracked;
  }
}

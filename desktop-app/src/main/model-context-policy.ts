import type { JsonObject, JsonValue } from "../shared/types";

const MAX_IDENTIFIER_BYTES = 1_024;
const MAX_INPUT_ITEMS = 21;
const MAX_INPUT_JSON_BYTES = 64 * 1_024;
const MAX_MODEL_OPTION_BYTES = 512;
const MAX_TEXT_ELEMENTS = 20;
const MAX_TEXT_ELEMENT_PLACEHOLDER_BYTES = 1_024;
export const MAX_USER_TEXT_BYTES = 32 * 1_024;

export type LocalInputReference = {
  entry: JsonObject;
  path: string;
};

function isPlainObject(value: JsonValue | undefined): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertOnlyKeys(params: JsonObject, allowed: Set<string>): void {
  const unexpected = Object.keys(params).find((key) => !allowed.has(key));
  if (unexpected) {
    throw new Error(`Unexpected model-context request field: ${unexpected}`);
  }
}

function boundedString(
  value: JsonValue | undefined,
  label: string,
  maximumBytes: number,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0") ||
    Buffer.byteLength(value, "utf8") > maximumBytes
  ) {
    throw new TypeError(`${label} must be a bounded, non-empty string`);
  }
  return value;
}

function nullableModel(value: JsonValue | undefined): void {
  if (value === null) return;
  boundedString(value, "model", MAX_MODEL_OPTION_BYTES);
}

function isUtf8Boundary(text: string, offset: number): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.from(text, "utf8").subarray(0, offset),
    );
    return true;
  } catch {
    return false;
  }
}

function assertTextElements(text: string, value: JsonValue | undefined): void {
  if (!Array.isArray(value) || value.length > MAX_TEXT_ELEMENTS) {
    throw new TypeError(
      `text_elements must contain at most ${MAX_TEXT_ELEMENTS} items`,
    );
  }
  const textBytes = Buffer.byteLength(text, "utf8");
  let previousEnd = 0;
  for (const element of value) {
    if (!isPlainObject(element)) {
      throw new TypeError("text_elements entries must be objects");
    }
    assertOnlyKeys(element, new Set(["byteRange", "placeholder"]));
    if (!isPlainObject(element.byteRange)) {
      throw new TypeError("text element byteRange must be an object");
    }
    assertOnlyKeys(element.byteRange, new Set(["end", "start"]));
    const { end, start } = element.byteRange;
    if (
      typeof start !== "number" ||
      typeof end !== "number" ||
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < previousEnd ||
      start < 0 ||
      end <= start ||
      end > textBytes ||
      !isUtf8Boundary(text, start) ||
      !isUtf8Boundary(text, end)
    ) {
      throw new RangeError(
        "text element byte ranges must be ordered, non-overlapping UTF-8 spans",
      );
    }
    if (element.placeholder !== null) {
      boundedString(
        element.placeholder,
        "text element placeholder",
        MAX_TEXT_ELEMENT_PLACEHOLDER_BYTES,
      );
    }
    previousEnd = end;
  }
}

function assertInput(input: JsonValue | undefined): LocalInputReference[] {
  if (
    !Array.isArray(input) ||
    input.length === 0 ||
    input.length > MAX_INPUT_ITEMS
  ) {
    throw new TypeError(
      `input must contain between 1 and ${MAX_INPUT_ITEMS} items`,
    );
  }
  if (Buffer.byteLength(JSON.stringify(input), "utf8") > MAX_INPUT_JSON_BYTES) {
    throw new RangeError("input exceeds the model-context size limit");
  }

  const references: LocalInputReference[] = [];
  let textItems = 0;
  for (const [index, entry] of input.entries()) {
    if (!isPlainObject(entry) || typeof entry.type !== "string") {
      throw new TypeError("input entries must be typed objects");
    }
    if (entry.type === "text") {
      textItems += 1;
      if (index !== 0 || textItems !== 1) {
        throw new Error("input must begin with exactly one text item");
      }
      assertOnlyKeys(entry, new Set(["text", "text_elements", "type"]));
      const text = boundedString(entry.text, "input text", MAX_USER_TEXT_BYTES);
      assertTextElements(text, entry.text_elements);
      continue;
    }

    if (
      entry.type !== "localAudio" &&
      entry.type !== "localImage" &&
      entry.type !== "mention"
    ) {
      throw new Error(`Unsupported renderer input type: ${entry.type}`);
    }
    const allowedKeys =
      entry.type === "mention"
        ? new Set(["name", "path", "type"])
        : new Set(["path", "type"]);
    assertOnlyKeys(entry, allowedKeys);
    const path = boundedString(entry.path, "attachment path", 32_768);
    if (entry.type === "mention") {
      const name = boundedString(entry.name, "attachment name", 1_024);
      const expectedName = path.split(/[\\/]/).at(-1) ?? path;
      if (name !== expectedName) {
        throw new Error("Attachment name must match its local path");
      }
    }
    references.push({ entry, path });
  }
  if (textItems !== 1) {
    throw new Error("input must begin with exactly one text item");
  }
  return references;
}

/**
 * Restricts renderer-originated app-server calls that can alter model-visible
 * context to the exact request shapes emitted by the desktop UI.
 */
export function validateModelContextRequest(
  method: string,
  params: JsonObject,
): LocalInputReference[] {
  switch (method) {
    case "thread/start": {
      assertOnlyKeys(
        params,
        new Set(["approvalPolicy", "cwd", "model", "sandbox"]),
      );
      boundedString(params.cwd, "cwd", 32_768);
      nullableModel(params.model);
      if (
        params.approvalPolicy !== "untrusted" &&
        params.approvalPolicy !== "on-request" &&
        params.approvalPolicy !== "never"
      ) {
        throw new TypeError(
          "approvalPolicy is not supported by the desktop UI",
        );
      }
      if (
        params.sandbox !== "read-only" &&
        params.sandbox !== "workspace-write" &&
        params.sandbox !== "danger-full-access"
      ) {
        throw new TypeError("sandbox is not supported by the desktop UI");
      }
      return [];
    }
    case "thread/resume": {
      assertOnlyKeys(
        params,
        new Set(["excludeTurns", "initialTurnsPage", "threadId"]),
      );
      boundedString(params.threadId, "threadId", MAX_IDENTIFIER_BYTES);
      if (
        params.excludeTurns !== true ||
        !isPlainObject(params.initialTurnsPage)
      ) {
        throw new TypeError("thread/resume requires the desktop paging shape");
      }
      assertOnlyKeys(
        params.initialTurnsPage,
        new Set(["itemsView", "limit", "sortDirection"]),
      );
      if (
        params.initialTurnsPage.itemsView !== "full" ||
        params.initialTurnsPage.limit !== 30 ||
        params.initialTurnsPage.sortDirection !== "desc"
      ) {
        throw new TypeError("thread/resume paging options are not supported");
      }
      return [];
    }
    case "turn/start": {
      assertOnlyKeys(params, new Set(["effort", "input", "model", "threadId"]));
      boundedString(params.threadId, "threadId", MAX_IDENTIFIER_BYTES);
      boundedString(params.effort, "effort", MAX_MODEL_OPTION_BYTES);
      nullableModel(params.model);
      return assertInput(params.input);
    }
    case "turn/steer": {
      assertOnlyKeys(params, new Set(["expectedTurnId", "input", "threadId"]));
      boundedString(params.threadId, "threadId", MAX_IDENTIFIER_BYTES);
      boundedString(
        params.expectedTurnId,
        "expectedTurnId",
        MAX_IDENTIFIER_BYTES,
      );
      return assertInput(params.input);
    }
    case "review/start": {
      assertOnlyKeys(params, new Set(["delivery", "target", "threadId"]));
      boundedString(params.threadId, "threadId", MAX_IDENTIFIER_BYTES);
      if (params.delivery !== "inline" || !isPlainObject(params.target)) {
        throw new TypeError("review/start requires the inline desktop shape");
      }
      assertOnlyKeys(params.target, new Set(["type"]));
      if (params.target.type !== "uncommittedChanges") {
        throw new Error("Only an uncommitted-changes review is supported");
      }
      return [];
    }
    default:
      return [];
  }
}

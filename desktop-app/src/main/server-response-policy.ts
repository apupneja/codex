import type {
  JsonObject,
  JsonValue,
  RpcId,
  RpcRequest,
  ServerRequest,
} from "../shared/types";

const MAX_ANSWER_BYTES = 4 * 1_024;
const MAX_RESPONSE_BYTES = 64 * 1_024;
const MAX_JSON_DEPTH = 24;
const MAX_JSON_ITEMS = 256;

type UnknownObject = Record<string, unknown>;

function isObject(value: unknown): value is UnknownObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertOnlyKeys(value: UnknownObject, allowed: Set<string>): void {
  const unexpected = Object.keys(value).find((key) => !allowed.has(key));
  if (unexpected) {
    throw new Error(`Unexpected server-response field: ${unexpected}`);
  }
}

function boundedString(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    value.includes("\0") ||
    Buffer.byteLength(value, "utf8") > MAX_ANSWER_BYTES
  ) {
    throw new TypeError(`${label} must be a bounded string`);
  }
  return value;
}

function assertBoundedJson(
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0,
): void {
  if (depth > MAX_JSON_DEPTH) {
    throw new RangeError("Server response is nested too deeply");
  }
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return;
  }
  if (typeof value === "string") {
    boundedString(value, "Server response text");
    return;
  }
  if (typeof value !== "object" || value === undefined) {
    throw new TypeError("Server response must contain only JSON values");
  }
  if (seen.has(value)) {
    throw new TypeError("Server response cannot contain cycles");
  }
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > MAX_JSON_ITEMS) {
      throw new RangeError("Server response contains too many items");
    }
    for (const item of value) assertBoundedJson(item, seen, depth + 1);
  } else {
    const entries = Object.entries(value);
    if (entries.length > MAX_JSON_ITEMS) {
      throw new RangeError("Server response contains too many fields");
    }
    for (const [key, item] of entries) {
      boundedString(key, "Server response field name");
      assertBoundedJson(item, seen, depth + 1);
    }
  }
  seen.delete(value);
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => deepEqual(value, right[index]))
    );
  }
  if (!isObject(left) || !isObject(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && deepEqual(left[key], right[key]),
    )
  );
}

function responseObject(result: unknown): UnknownObject {
  if (!isObject(result)) {
    throw new TypeError("Server response must be an object");
  }
  return result;
}

function assertDecision(
  result: unknown,
  allowed: Set<string>,
  availableDecisions?: unknown,
): void {
  const response = responseObject(result);
  assertOnlyKeys(response, new Set(["decision"]));
  if (
    typeof response.decision !== "string" ||
    !allowed.has(response.decision)
  ) {
    throw new Error("Server response contains an unsupported decision");
  }
  if (
    Array.isArray(availableDecisions) &&
    (response.decision === "accept" ||
      response.decision === "acceptForSession") &&
    !availableDecisions.includes(response.decision)
  ) {
    throw new Error("Server response decision was not offered by the request");
  }
}

function assertV1Decision(result: unknown): void {
  const response = responseObject(result);
  assertOnlyKeys(response, new Set(["decision"]));
  if (
    response.decision === "approved" ||
    response.decision === "approved_for_session" ||
    response.decision === "abort"
  ) {
    return;
  }
  if (!isObject(response.decision)) {
    throw new Error("Server response contains an unsupported decision");
  }
  assertOnlyKeys(response.decision, new Set(["denied"]));
  if (!isObject(response.decision.denied)) {
    throw new Error("Server response contains an unsupported decision");
  }
  assertOnlyKeys(response.decision.denied, new Set(["rejection"]));
  if (response.decision.denied.rejection !== "Declined by user") {
    throw new Error("Server response contains an unsupported rejection");
  }
}

function assertPermissionsResponse(
  params: UnknownObject,
  result: unknown,
): void {
  const response = responseObject(result);
  assertOnlyKeys(response, new Set(["permissions", "scope"]));
  if (response.scope !== "turn" && response.scope !== "session") {
    throw new Error("Permission grant scope is not supported");
  }
  if (!isObject(response.permissions) || !isObject(params.permissions)) {
    throw new TypeError("Permission response must contain a permission object");
  }
  assertOnlyKeys(response.permissions, new Set(["fileSystem", "network"]));
  for (const key of ["fileSystem", "network"] as const) {
    if (
      response.permissions[key] !== undefined &&
      !deepEqual(response.permissions[key], params.permissions[key])
    ) {
      throw new Error("Renderer may grant only the permissions requested");
    }
  }
}

function assertUserInputResponse(params: UnknownObject, result: unknown): void {
  const response = responseObject(result);
  assertOnlyKeys(response, new Set(["answers"]));
  if (!isObject(response.answers) || !Array.isArray(params.questions)) {
    throw new TypeError("User-input response must contain an answers object");
  }
  if (params.questions.length > 32) {
    throw new RangeError("User-input request contains too many questions");
  }

  const questions = new Map<string, UnknownObject>();
  for (const question of params.questions) {
    if (!isObject(question)) {
      throw new TypeError("User-input request contains an invalid question");
    }
    const id = boundedString(question.id, "Question id");
    if (!id || questions.has(id)) {
      throw new Error("User-input question ids must be unique and non-empty");
    }
    questions.set(id, question);
  }

  const answerEntries = Object.entries(response.answers);
  if (answerEntries.length !== 0 && answerEntries.length !== questions.size) {
    throw new Error(
      "User-input response must answer every question or decline",
    );
  }
  for (const [id, rawAnswer] of answerEntries) {
    const question = questions.get(id);
    if (!question || !isObject(rawAnswer)) {
      throw new Error("User-input response contains an unknown question id");
    }
    assertOnlyKeys(rawAnswer, new Set(["answers"]));
    if (!Array.isArray(rawAnswer.answers) || rawAnswer.answers.length !== 1) {
      throw new TypeError("Each question must contain exactly one answer");
    }
    const answer = boundedString(rawAnswer.answers[0], "User answer");
    if (
      Array.isArray(question.options) &&
      question.options.length > 0 &&
      question.isOther !== true
    ) {
      const labels = question.options.flatMap((option) =>
        isObject(option) && typeof option.label === "string"
          ? [option.label]
          : [],
      );
      if (!labels.includes(answer)) {
        throw new Error("User-input response must use an advertised option");
      }
    }
  }
}

function schemaChoices(field: UnknownObject): string[] {
  if (Array.isArray(field.enum)) {
    return field.enum.filter(
      (value): value is string => typeof value === "string",
    );
  }
  const items = isObject(field.items) ? field.items : null;
  if (items && Array.isArray(items.enum)) {
    return items.enum.filter(
      (value): value is string => typeof value === "string",
    );
  }
  const options = items
    ? Array.isArray(items.anyOf)
      ? items.anyOf
      : Array.isArray(items.oneOf)
        ? items.oneOf
        : []
    : Array.isArray(field.oneOf)
      ? field.oneOf
      : [];
  return options.flatMap((option) =>
    isObject(option) && typeof option.const === "string" ? [option.const] : [],
  );
}

function assertSchemaValue(field: UnknownObject, value: unknown): void {
  if (typeof field.pattern === "string" && field.pattern.length > 0) {
    throw new Error("Pattern-constrained MCP fields are not supported");
  }
  if (field.type === "boolean") {
    if (typeof value !== "boolean") throw new TypeError("Expected a boolean");
    return;
  }
  if (field.type === "number" || field.type === "integer") {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      (field.type === "integer" && !Number.isInteger(value))
    ) {
      throw new TypeError("Expected a finite number");
    }
    for (const [key, invalid] of [
      ["minimum", (limit: number) => value < limit],
      ["maximum", (limit: number) => value > limit],
      ["exclusiveMinimum", (limit: number) => value <= limit],
      ["exclusiveMaximum", (limit: number) => value >= limit],
    ] as const) {
      const limit = field[key];
      if (typeof limit === "number" && invalid(limit)) {
        throw new RangeError(`MCP value violates ${key}`);
      }
    }
    return;
  }
  if (field.type === "array") {
    if (
      !Array.isArray(value) ||
      !value.every((item) => typeof item === "string")
    ) {
      throw new TypeError("Expected a string selection array");
    }
    const choices = schemaChoices(field);
    if (choices.length === 0 || value.some((item) => !choices.includes(item))) {
      throw new Error("MCP response contains an unsupported selection");
    }
    if (typeof field.minItems === "number" && value.length < field.minItems) {
      throw new RangeError("MCP response contains too few selections");
    }
    if (typeof field.maxItems === "number" && value.length > field.maxItems) {
      throw new RangeError("MCP response contains too many selections");
    }
    return;
  }
  if (field.type !== "string") {
    throw new Error("MCP response uses an unsupported field type");
  }
  const text = boundedString(value, "MCP response text");
  if (typeof field.minLength === "number" && text.length < field.minLength) {
    throw new RangeError("MCP response text is too short");
  }
  if (typeof field.maxLength === "number" && text.length > field.maxLength) {
    throw new RangeError("MCP response text is too long");
  }
  const choices = schemaChoices(field);
  if (choices.length > 0 && !choices.includes(text)) {
    throw new Error("MCP response contains an unsupported selection");
  }
}

function assertMcpResponse(params: UnknownObject, result: unknown): void {
  const response = responseObject(result);
  assertOnlyKeys(response, new Set(["_meta", "action", "content"]));
  if (!deepEqual(response._meta, params._meta ?? null)) {
    throw new Error("MCP response metadata does not match the request");
  }
  if (response.action === "decline" || response.action === "cancel") {
    if (response.content !== null) {
      throw new Error("Declined MCP responses cannot contain content");
    }
    return;
  }
  if (response.action !== "accept" || params.mode !== "form") {
    throw new Error("MCP response action is not supported");
  }
  if (!isObject(response.content) || !isObject(params.requestedSchema)) {
    throw new TypeError("Accepted MCP response must match a form schema");
  }
  const schema = params.requestedSchema;
  if (schema.type !== "object" || !isObject(schema.properties)) {
    throw new Error("MCP form schema is not supported");
  }
  const properties = schema.properties;
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((key): key is string => typeof key === "string")
      : [],
  );
  for (const key of Object.keys(response.content)) {
    const field = properties[key];
    if (!isObject(field)) {
      throw new Error("MCP response contains an unknown form field");
    }
    assertSchemaValue(field, response.content[key]);
  }
  for (const key of required) {
    if (!(key in response.content)) {
      throw new Error("MCP response omits a required form field");
    }
  }
}

/** Validates a renderer response against the exact pending server request. */
export function validateServerResponse(
  request: ServerRequest | RpcRequest,
  result: unknown,
): JsonValue {
  assertBoundedJson(result);
  const serialized = JSON.stringify(result);
  if (Buffer.byteLength(serialized, "utf8") > MAX_RESPONSE_BYTES) {
    throw new RangeError("Server response exceeds 64 KiB");
  }
  const params: UnknownObject = isObject(request.params)
    ? (request.params as UnknownObject)
    : {};

  switch (request.method) {
    case "item/commandExecution/requestApproval": {
      assertDecision(
        result,
        new Set(["accept", "acceptForSession", "cancel", "decline"]),
        params.availableDecisions,
      );
      return result as JsonValue;
    }
    case "item/fileChange/requestApproval":
      assertDecision(
        result,
        new Set(["accept", "acceptForSession", "cancel", "decline"]),
      );
      return result as JsonValue;
    case "item/permissions/requestApproval":
      assertPermissionsResponse(params, result);
      return result as JsonValue;
    case "item/tool/requestUserInput":
      assertUserInputResponse(params, result);
      return result as JsonValue;
    case "mcpServer/elicitation/request":
      assertMcpResponse(params, result);
      return result as JsonValue;
    case "item/tool/call": {
      const response = responseObject(result);
      assertOnlyKeys(response, new Set(["contentItems", "success"]));
      if (
        response.success !== false ||
        !Array.isArray(response.contentItems) ||
        response.contentItems.length !== 0
      ) {
        throw new Error("Desktop renderer may only decline dynamic tool calls");
      }
      return result as JsonValue;
    }
    case "applyPatchApproval":
    case "execCommandApproval":
      assertV1Decision(result);
      return result as JsonValue;
    default:
      throw new Error(`Desktop renderer cannot answer ${request.method}`);
  }
}

export function serverRequestKey(id: RpcId): string {
  return `${typeof id}:${id}`;
}

export function validatePendingServerResponse(
  pendingRequests: ReadonlyMap<string, ServerRequest | RpcRequest>,
  id: RpcId,
  result: unknown,
): { key: string; result: JsonValue } {
  const key = serverRequestKey(id);
  const request = pendingRequests.get(key);
  if (!request) {
    throw new Error(`No pending server request with id ${String(id)}`);
  }
  return { key, result: validateServerResponse(request, result) };
}

import {
  AlertTriangle,
  Check,
  FileDiff,
  Globe2,
  KeyRound,
  Shield,
  TerminalSquare,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { JsonObject, JsonValue, ServerRequest } from "../../shared/types";
import { Select } from "../design-system";

type ApprovalDialogProps = {
  fileChanges?: JsonValue;
  fileChangesLoading?: boolean;
  onRespond(request: ServerRequest, result: JsonValue): void;
  request: ServerRequest;
};

type McpChoice = { label: string; value: string };

const MCP_FIELD_TYPES = new Set([
  "array",
  "boolean",
  "integer",
  "number",
  "string",
]);

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numberConstraint(field: JsonObject, key: string): number | null {
  const value = field[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mcpChoices(field: JsonObject): McpChoice[] {
  const enumValues = Array.isArray(field.enum)
    ? field.enum.filter((value): value is string => typeof value === "string")
    : [];
  const enumNames = Array.isArray(field.enumNames)
    ? field.enumNames.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  if (enumValues.length > 0) {
    return enumValues.map((value, index) => ({
      label: enumNames[index] ?? value,
      value,
    }));
  }

  const directOptions = Array.isArray(field.oneOf) ? field.oneOf : [];
  const items = isJsonObject(field.items) ? field.items : null;
  const itemValues = items && Array.isArray(items.enum) ? items.enum : [];
  if (itemValues.every((value) => typeof value === "string")) {
    if (itemValues.length > 0) {
      return itemValues.map((value) => ({ label: value, value }));
    }
  }
  const titledOptions =
    items && Array.isArray(items.anyOf)
      ? items.anyOf
      : items && Array.isArray(items.oneOf)
        ? items.oneOf
        : directOptions;
  return titledOptions.flatMap((option) => {
    if (!isJsonObject(option) || typeof option.const !== "string") return [];
    return [
      {
        label: typeof option.title === "string" ? option.title : option.const,
        value: option.const,
      },
    ];
  });
}

function validatesStringFormat(
  value: string,
  format: JsonValue | undefined,
): boolean {
  if (format === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (format === "uri") {
    try {
      return Boolean(new URL(value).protocol);
    } catch {
      return false;
    }
  }
  if (format === "date") {
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
    );
  }
  if (format === "date-time") return !Number.isNaN(Date.parse(value));
  return true;
}

function mcpFieldError(
  field: JsonObject,
  raw: string,
  selected: string[],
  required: boolean,
): string | null {
  const type = typeof field.type === "string" ? field.type : "string";
  if (!MCP_FIELD_TYPES.has(type)) return `Unsupported field type: ${type}`;
  const choices = mcpChoices(field);
  if (type === "array") {
    if (!isJsonObject(field.items) || choices.length === 0) {
      return "This multi-select field cannot be rendered safely";
    }
    const minimum = numberConstraint(field, "minItems") ?? 0;
    const maximum = numberConstraint(field, "maxItems");
    if (selected.length < minimum) return `Choose at least ${minimum}`;
    if (maximum !== null && selected.length > maximum) {
      return `Choose at most ${maximum}`;
    }
    if (
      selected.some(
        (value) => !choices.some((choice) => choice.value === value),
      )
    ) {
      return "Choose only from the available options";
    }
    return null;
  }
  if (raw === "") return required ? "Required" : null;

  if (type === "number" || type === "integer") {
    const value = Number(raw);
    if (!Number.isFinite(value)) return "Enter a valid number";
    if (type === "integer" && !Number.isInteger(value)) {
      return "Enter a whole number";
    }
    const minimum = numberConstraint(field, "minimum");
    const maximum = numberConstraint(field, "maximum");
    const exclusiveMinimum = numberConstraint(field, "exclusiveMinimum");
    const exclusiveMaximum = numberConstraint(field, "exclusiveMaximum");
    if (minimum !== null && value < minimum)
      return `Must be at least ${minimum}`;
    if (maximum !== null && value > maximum)
      return `Must be at most ${maximum}`;
    if (exclusiveMinimum !== null && value <= exclusiveMinimum) {
      return `Must be greater than ${exclusiveMinimum}`;
    }
    if (exclusiveMaximum !== null && value >= exclusiveMaximum) {
      return `Must be less than ${exclusiveMaximum}`;
    }
  }

  if (type === "string") {
    const minimum = numberConstraint(field, "minLength");
    const maximum = numberConstraint(field, "maxLength");
    if (minimum !== null && raw.length < minimum) {
      return `Use at least ${minimum} characters`;
    }
    if (maximum !== null && raw.length > maximum) {
      return `Use at most ${maximum} characters`;
    }
    if (typeof field.pattern === "string" && field.pattern.length > 0) {
      return "Pattern-constrained fields are not supported safely";
    }
    if (!validatesStringFormat(raw, field.format)) {
      return `Enter a valid ${String(field.format)}`;
    }
  }

  if (choices.length > 0 && !choices.some((option) => option.value === raw)) {
    return "Choose one of the available options";
  }
  return null;
}

function requestTitle(method: string): { icon: typeof Shield; title: string } {
  if (method.includes("commandExecution") || method === "execCommandApproval")
    return { icon: TerminalSquare, title: "Run this command?" };
  if (method.includes("fileChange") || method === "applyPatchApproval")
    return { icon: FileDiff, title: "Apply these file changes?" };
  if (method.includes("permissions"))
    return { icon: KeyRound, title: "Grant additional permissions?" };
  if (method.includes("requestUserInput"))
    return { icon: Shield, title: "Codex needs your input" };
  if (method.includes("elicitation"))
    return { icon: Shield, title: "A connected tool needs input" };
  return { icon: AlertTriangle, title: "Codex needs a decision" };
}

export function ApprovalDialog({
  fileChanges,
  fileChangesLoading = false,
  onRespond,
  request,
}: ApprovalDialogProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(
    Object.create(null),
  );
  const [multiAnswers, setMultiAnswers] = useState<Record<string, string[]>>(
    Object.create(null),
  );
  const method = request.method;
  const params = request.params as unknown as JsonObject;
  const dialog = useRef<HTMLElement>(null);
  const presentation = requestTitle(method);
  const Icon = presentation.icon;
  const questions = useMemo(() => {
    const value = params.questions;
    return Array.isArray(value)
      ? value.filter(
          (entry): entry is JsonObject =>
            Boolean(entry) &&
            typeof entry === "object" &&
            !Array.isArray(entry),
        )
      : [];
  }, [params.questions]);
  const mcpFields = useMemo(() => {
    if (method !== "mcpServer/elicitation/request") return [];
    const schema = params.requestedSchema;
    if (!schema || typeof schema !== "object" || Array.isArray(schema))
      return [];
    const properties = schema.properties;
    if (
      !properties ||
      typeof properties !== "object" ||
      Array.isArray(properties)
    )
      return [];
    return Object.entries(properties).filter(
      (entry): entry is [string, JsonObject] =>
        Boolean(entry[1]) &&
        typeof entry[1] === "object" &&
        !Array.isArray(entry[1]),
    );
  }, [method, params.requestedSchema]);
  const mcpRequired = useMemo(() => {
    if (method !== "mcpServer/elicitation/request") return new Set<string>();
    const schema = params.requestedSchema;
    if (!isJsonObject(schema) || !Array.isArray(schema.required)) {
      return new Set<string>();
    }
    return new Set(
      schema.required.filter(
        (field): field is string => typeof field === "string",
      ),
    );
  }, [method, params.requestedSchema]);
  const mcpSchemaSupported = useMemo(() => {
    if (method !== "mcpServer/elicitation/request") return true;
    if (params.mode === "url") return true;
    if (params.mode === "openai/form") return false;
    const schema = params.requestedSchema;
    return (
      isJsonObject(schema) &&
      schema.type === "object" &&
      isJsonObject(schema.properties)
    );
  }, [method, params.mode, params.requestedSchema]);
  const mcpErrors = useMemo(
    () =>
      new Map(
        mcpFields
          .map(
            ([key, field]) =>
              [
                key,
                mcpFieldError(
                  field,
                  answers[key] ?? "",
                  multiAnswers[key] ?? [],
                  mcpRequired.has(key),
                ),
              ] as const,
          )
          .filter((entry): entry is readonly [string, string] =>
            Boolean(entry[1]),
          ),
      ),
    [answers, mcpFields, mcpRequired, multiAnswers],
  );
  const mcpCanSubmit =
    method !== "mcpServer/elicitation/request" ||
    (mcpSchemaSupported && mcpErrors.size === 0);
  const availableDecisions = Array.isArray(params.availableDecisions)
    ? params.availableDecisions
    : null;
  const availableDecisionNames = new Set(
    availableDecisions?.filter(
      (decision): decision is string => typeof decision === "string",
    ) ?? [],
  );
  const commandApproval = method === "item/commandExecution/requestApproval";
  const canAccept =
    !commandApproval ||
    !availableDecisions ||
    availableDecisionNames.has("accept");
  const canAcceptForSession =
    !commandApproval ||
    !availableDecisions ||
    availableDecisionNames.has("acceptForSession");
  const amendmentDecisions =
    availableDecisions?.filter(
      (decision): decision is JsonObject =>
        Boolean(decision) &&
        typeof decision === "object" &&
        !Array.isArray(decision),
    ) ?? [];

  useEffect(() => {
    const first = dialog.current?.querySelector<HTMLElement>(
      "button, input, select, textarea",
    );
    first?.focus();
  }, []);

  useEffect(() => {
    if (method !== "mcpServer/elicitation/request") return;
    const defaults: Record<string, string> = Object.create(null);
    const multiDefaults: Record<string, string[]> = Object.create(null);
    for (const [key, field] of mcpFields) {
      if (
        field.type === "array" &&
        Array.isArray(field.default) &&
        field.default.every((value) => typeof value === "string")
      ) {
        multiDefaults[key] = field.default;
        continue;
      }
      if (
        typeof field.default === "string" ||
        typeof field.default === "number" ||
        typeof field.default === "boolean"
      ) {
        defaults[key] = String(field.default);
      }
    }
    setAnswers(defaults);
    setMultiAnswers(multiDefaults);
  }, [mcpFields, method]);

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      decline(true);
      return;
    }
    if (event.key !== "Tab" || !dialog.current) return;
    const focusable = [
      ...dialog.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function approve(remember = false): void {
    if (method === "item/commandExecution/requestApproval") {
      onRespond(request, {
        decision: remember ? "acceptForSession" : "accept",
      });
      return;
    }
    if (method === "item/fileChange/requestApproval") {
      onRespond(request, {
        decision: remember ? "acceptForSession" : "accept",
      });
      return;
    }
    if (method === "item/permissions/requestApproval") {
      const requested = (params.permissions ?? {}) as JsonObject;
      onRespond(request, {
        permissions: {
          ...(requested.fileSystem ? { fileSystem: requested.fileSystem } : {}),
          ...(requested.network ? { network: requested.network } : {}),
        },
        scope: remember ? "session" : "turn",
      });
      return;
    }
    if (method === "item/tool/requestUserInput") {
      const response: JsonObject = {};
      for (const question of questions) {
        const id = typeof question.id === "string" ? question.id : "question";
        response[id] = { answers: [answers[id] ?? ""] };
      }
      onRespond(request, { answers: response });
      return;
    }
    if (method === "mcpServer/elicitation/request") {
      if (!mcpCanSubmit) return;
      const content: JsonObject = {};
      for (const [key, field] of mcpFields) {
        if (field.type === "array") {
          const selected = multiAnswers[key] ?? [];
          if (selected.length > 0 || mcpRequired.has(key))
            content[key] = selected;
          continue;
        }
        const raw = answers[key] ?? "";
        if (raw === "" && !mcpRequired.has(key)) continue;
        content[key] =
          field.type === "boolean"
            ? raw === "true"
            : field.type === "number" || field.type === "integer"
              ? Number(raw)
              : raw;
      }
      onRespond(request, {
        _meta: params._meta ?? null,
        action: "accept",
        content: mcpFields.length ? content : null,
      });
      return;
    }
    if (method === "execCommandApproval" || method === "applyPatchApproval") {
      onRespond(request, {
        decision: remember ? "approved_for_session" : "approved",
      });
      return;
    }
    onRespond(request, { contentItems: [], success: false });
  }

  function decline(cancel = false): void {
    if (
      method === "item/commandExecution/requestApproval" ||
      method === "item/fileChange/requestApproval"
    ) {
      onRespond(request, { decision: cancel ? "cancel" : "decline" });
    } else if (method === "item/permissions/requestApproval") {
      onRespond(request, { permissions: {}, scope: "turn" });
    } else if (method === "item/tool/requestUserInput") {
      onRespond(request, { answers: {} });
    } else if (method === "mcpServer/elicitation/request") {
      onRespond(request, {
        _meta: params._meta ?? null,
        action: cancel ? "cancel" : "decline",
        content: null,
      });
    } else if (
      method === "execCommandApproval" ||
      method === "applyPatchApproval"
    ) {
      onRespond(request, {
        decision: cancel
          ? "abort"
          : { denied: { rejection: "Declined by user" } },
      });
    } else {
      onRespond(request, { contentItems: [], success: false });
    }
  }

  const command =
    typeof params.command === "string"
      ? params.command
      : Array.isArray(params.command) &&
          params.command.every((part) => typeof part === "string")
        ? params.command.join(" ")
        : null;
  const cwd = typeof params.cwd === "string" ? params.cwd : null;
  const reason = typeof params.reason === "string" ? params.reason : null;
  const message = typeof params.message === "string" ? params.message : null;
  const url = typeof params.url === "string" ? params.url : null;
  const networkContext =
    params.networkApprovalContext &&
    typeof params.networkApprovalContext === "object" &&
    !Array.isArray(params.networkApprovalContext)
      ? params.networkApprovalContext
      : null;

  return (
    <div aria-modal="true" className="modal-backdrop" role="dialog">
      <section
        aria-labelledby="approval-title"
        className="approval-dialog"
        onKeyDown={handleDialogKeyDown}
        ref={dialog}
      >
        <header>
          <span className="approval-icon">
            <Icon size={18} />
          </span>
          <div>
            <h2 id="approval-title">{presentation.title}</h2>
            <p>
              {reason ||
                message ||
                "Review the request before Codex continues."}
            </p>
          </div>
        </header>
        {command ? (
          <div className="approval-command">
            {cwd ? <span>{cwd}</span> : null}
            <code>{command}</code>
          </div>
        ) : null}
        {networkContext ? (
          <div className="approval-note approval-network">
            <Globe2 size={15} />
            Network access: {String(networkContext.protocol ?? "network")}://
            {String(networkContext.host ?? "unknown host")}
          </div>
        ) : null}
        {params.additionalPermissions ? (
          <>
            <div className="approval-note">
              <KeyRound size={15} /> Additional access requested
            </div>
            <pre className="approval-permissions">
              {JSON.stringify(params.additionalPermissions, null, 2)}
            </pre>
          </>
        ) : null}
        {params.proposedExecpolicyAmendment ||
        params.proposedNetworkPolicyAmendments ? (
          <>
            <div className="approval-note">
              <Shield size={15} /> Proposed policy change
            </div>
            <pre className="approval-permissions">
              {JSON.stringify(
                {
                  execPolicy: params.proposedExecpolicyAmendment ?? null,
                  networkPolicy: params.proposedNetworkPolicyAmendments ?? null,
                },
                null,
                2,
              )}
            </pre>
          </>
        ) : null}
        {method.includes("fileChange") || method === "applyPatchApproval" ? (
          <>
            <div className="approval-note">
              <FileDiff size={15} /> Proposed file changes
            </div>
            {params.fileChanges ? (
              <pre className="approval-permissions">
                {JSON.stringify(params.fileChanges, null, 2)}
              </pre>
            ) : fileChanges ? (
              <pre className="approval-permissions approval-diff">
                {JSON.stringify(fileChanges, null, 2)}
              </pre>
            ) : fileChangesLoading ? (
              <div className="approval-warning">
                Loading the matching patch…
              </div>
            ) : method.includes("fileChange") ? (
              <div className="approval-warning">
                The matching patch is not available. Decline this request and
                retry from the task before allowing changes.
              </div>
            ) : null}
          </>
        ) : null}
        {method.includes("permissions") ? (
          <pre className="approval-permissions">
            {JSON.stringify(params.permissions, null, 2)}
          </pre>
        ) : null}
        {questions.map((question) => {
          const id = typeof question.id === "string" ? question.id : "question";
          const options = Array.isArray(question.options)
            ? question.options.filter(
                (entry): entry is JsonObject =>
                  Boolean(entry) &&
                  typeof entry === "object" &&
                  !Array.isArray(entry),
              )
            : [];
          return (
            <fieldset className="approval-question" key={id}>
              <legend>
                {typeof question.question === "string"
                  ? question.question
                  : "Choose an option"}
              </legend>
              {options.map((option) => {
                const label =
                  typeof option.label === "string" ? option.label : "Option";
                return (
                  <label key={label}>
                    <input
                      checked={answers[id] === label}
                      name={id}
                      onChange={() =>
                        setAnswers((current) => ({ ...current, [id]: label }))
                      }
                      type="radio"
                    />
                    <span>
                      <strong>{label}</strong>
                      <small>
                        {typeof option.description === "string"
                          ? option.description
                          : ""}
                      </small>
                    </span>
                  </label>
                );
              })}
              {options.length === 0 || question.isOther === true ? (
                <input
                  maxLength={4_096}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [id]: event.target.value,
                    }))
                  }
                  placeholder="Type your answer"
                  type={question.isSecret === true ? "password" : "text"}
                  value={answers[id] ?? ""}
                />
              ) : null}
            </fieldset>
          );
        })}
        {mcpFields.map(([key, field]) => {
          const label = typeof field.title === "string" ? field.title : key;
          const description =
            typeof field.description === "string" ? field.description : null;
          const options = mcpChoices(field);
          const error = mcpErrors.get(key);
          const required = mcpRequired.has(key);
          return (
            <div className="elicitation-field" key={key}>
              <span>
                <strong>
                  {label}
                  {required ? " *" : ""}
                </strong>
                {description ? <small>{description}</small> : null}
              </span>
              {field.type === "array" ? (
                <fieldset
                  aria-invalid={Boolean(error)}
                  aria-label={label}
                  className="elicitation-multiselect"
                >
                  {options.map((option) => {
                    const selected =
                      multiAnswers[key]?.includes(option.value) ?? false;
                    return (
                      <label key={option.value}>
                        <input
                          checked={selected}
                          onChange={(event) =>
                            setMultiAnswers((current) => ({
                              ...current,
                              [key]: event.target.checked
                                ? [...(current[key] ?? []), option.value]
                                : (current[key] ?? []).filter(
                                    (value) => value !== option.value,
                                  ),
                            }))
                          }
                          type="checkbox"
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </fieldset>
              ) : options.length ? (
                <Select
                  aria-invalid={Boolean(error)}
                  aria-label={label}
                  onChange={(value) =>
                    setAnswers((current) => ({
                      ...current,
                      [key]: value,
                    }))
                  }
                  options={[
                    { label: "Choose…", value: "" },
                    ...options.map((option) => ({
                      label: option.label,
                      value: option.value,
                    })),
                  ]}
                  value={answers[key] ?? ""}
                />
              ) : field.type === "boolean" ? (
                <Select
                  aria-invalid={Boolean(error)}
                  aria-label={label}
                  onChange={(value) =>
                    setAnswers((current) => ({
                      ...current,
                      [key]: value,
                    }))
                  }
                  options={[
                    { label: "Choose…", value: "" },
                    { label: "Yes", value: "true" },
                    { label: "No", value: "false" },
                  ]}
                  value={answers[key] ?? ""}
                />
              ) : (
                <input
                  aria-invalid={Boolean(error)}
                  aria-label={label}
                  max={numberConstraint(field, "maximum") ?? undefined}
                  maxLength={Math.max(
                    0,
                    Math.min(
                      numberConstraint(field, "maxLength") ?? 4_096,
                      4_096,
                    ),
                  )}
                  min={numberConstraint(field, "minimum") ?? undefined}
                  minLength={numberConstraint(field, "minLength") ?? undefined}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  type={
                    field.type === "number" || field.type === "integer"
                      ? "number"
                      : field.format === "email"
                        ? "email"
                        : field.format === "uri"
                          ? "url"
                          : field.format === "date"
                            ? "date"
                            : "text"
                  }
                  value={answers[key] ?? ""}
                />
              )}
              {error ? <small className="field-error">{error}</small> : null}
            </div>
          );
        })}
        {method === "mcpServer/elicitation/request" && !mcpSchemaSupported ? (
          <div className="approval-warning">
            This connected tool requested a form that Codex Desktop cannot
            safely validate. Decline the request to continue.
          </div>
        ) : null}
        {url ? (
          <button
            className="elicitation-url"
            onClick={() => void window.codexDesktop.openExternal(url)}
          >
            Open secure page
          </button>
        ) : null}
        <footer>
          <button className="button-secondary" onClick={() => decline()}>
            <X size={14} /> Decline
          </button>
          <span />
          {method.includes("commandExecution") ||
          method.includes("fileChange") ||
          method.includes("permissions") ||
          method === "execCommandApproval" ||
          method === "applyPatchApproval" ? (
            canAcceptForSession ? (
              <button
                className="button-secondary"
                onClick={() => approve(true)}
              >
                Allow for session
              </button>
            ) : null
          ) : null}
          {amendmentDecisions.map((decision, index) => (
            <button
              className="button-secondary"
              key={`amendment-${index}`}
              onClick={() => onRespond(request, { decision })}
            >
              Apply proposed policy
            </button>
          ))}
          {canAccept ? (
            <button
              className="button-primary"
              disabled={
                !mcpCanSubmit ||
                (method === "item/fileChange/requestApproval" && !fileChanges)
              }
              onClick={() => approve()}
              title={
                !mcpCanSubmit
                  ? "Complete the required fields before continuing"
                  : method === "item/fileChange/requestApproval" && !fileChanges
                    ? fileChangesLoading
                      ? "Wait for the matching patch to load"
                      : "The matching patch is unavailable"
                    : undefined
              }
            >
              <Check size={14} /> Continue
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type Approval, useSession } from "../../state/session";

export type FormValue = boolean | number | string | string[] | undefined;
export type FormValues = Record<string, FormValue>;
export type FormSchema = Record<string, unknown>;
export type FormFieldDefinition = {
  name: string;
  required: boolean;
  schema: FormSchema;
};
type Choice = { label: string; value: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function titleCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

export function fieldsForSchema(schemaValue: unknown): FormFieldDefinition[] {
  const requestedSchema = asRecord(schemaValue);
  const properties = asRecord(requestedSchema?.properties);
  const required = Array.isArray(requestedSchema?.required)
    ? requestedSchema.required.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  if (!properties) return [];
  return Object.entries(properties).flatMap(([name, value]) => {
    const schema = asRecord(value);
    return schema == null
      ? []
      : [{ name, required: required.includes(name), schema }];
  });
}

function formFields(request: Approval): FormFieldDefinition[] {
  return fieldsForSchema(request.params.requestedSchema);
}

function choicesFor(schema: FormSchema): Choice[] {
  if (Array.isArray(schema.oneOf)) {
    return schema.oneOf.flatMap((value) => {
      const option = asRecord(value);
      return typeof option?.const === "string"
        ? [
            {
              label:
                typeof option.title === "string" ? option.title : option.const,
              value: option.const,
            },
          ]
        : [];
    });
  }
  if (Array.isArray(schema.enum)) {
    const names = Array.isArray(schema.enumNames) ? schema.enumNames : [];
    return schema.enum.flatMap((value, index) =>
      typeof value === "string"
        ? [
            {
              label: typeof names[index] === "string" ? names[index] : value,
              value,
            },
          ]
        : [],
    );
  }
  const items = asRecord(schema.items);
  if (Array.isArray(items?.anyOf)) {
    return items.anyOf.flatMap((value) => {
      const option = asRecord(value);
      return typeof option?.const === "string"
        ? [
            {
              label:
                typeof option.title === "string" ? option.title : option.const,
              value: option.const,
            },
          ]
        : [];
    });
  }
  return Array.isArray(items?.enum)
    ? items.enum.flatMap((value) =>
        typeof value === "string" ? [{ label: value, value }] : [],
      )
    : [];
}

export function initialFormValues(fields: FormFieldDefinition[]): FormValues {
  return Object.fromEntries(
    fields.map((field) => {
      const { schema } = field;
      if (schema.type === "array") {
        return [
          field.name,
          Array.isArray(schema.default) ? schema.default : [],
        ];
      }
      if (schema.type === "boolean") {
        return [
          field.name,
          typeof schema.default === "boolean" ? schema.default : undefined,
        ];
      }
      return [
        field.name,
        typeof schema.default === "string" || typeof schema.default === "number"
          ? schema.default
          : "",
      ];
    }),
  );
}

function matchesFormat(format: unknown, value: string): boolean {
  if (format === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (format === "uri") {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }
  if (format === "date") return /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (format === "date-time") return !Number.isNaN(Date.parse(value));
  return true;
}

export function validateFormValues(
  fields: FormFieldDefinition[],
  values: FormValues,
): {
  content: Record<string, boolean | number | string | string[]> | null;
  invalid: string[];
} {
  const content: Record<string, boolean | number | string | string[]> = {};
  const invalid: string[] = [];
  for (const field of fields) {
    const { schema } = field;
    const value = values[field.name];
    if (schema.type === "string") {
      const text = typeof value === "string" ? value : "";
      const present = field.required || text.length > 0;
      const choices = choicesFor(schema);
      let valid = !present || text.length > 0;
      if (present && choices.length > 0) {
        valid = choices.some((option) => option.value === text);
      } else if (present) {
        valid =
          valid &&
          (typeof schema.minLength !== "number" ||
            text.length >= schema.minLength) &&
          (typeof schema.maxLength !== "number" ||
            text.length <= schema.maxLength) &&
          matchesFormat(schema.format, text);
        if (valid && typeof schema.pattern === "string") {
          try {
            valid = new RegExp(schema.pattern).test(text);
          } catch {
            valid = false;
          }
        }
      }
      if (!valid) invalid.push(field.name);
      if (present) content[field.name] = text;
      continue;
    }
    if (schema.type === "array") {
      const selected = Array.isArray(value) ? value : [];
      const present = field.required || selected.length > 0;
      const choices = choicesFor(schema);
      const valid =
        !present ||
        ((typeof schema.minItems !== "number" ||
          selected.length >= schema.minItems) &&
          (typeof schema.maxItems !== "number" ||
            selected.length <= schema.maxItems) &&
          selected.every((item) =>
            choices.some((choice) => choice.value === item),
          ));
      if (!valid) invalid.push(field.name);
      if (present) content[field.name] = selected;
      continue;
    }
    if (schema.type === "boolean") {
      if (typeof value !== "boolean") {
        if (field.required) invalid.push(field.name);
      } else {
        content[field.name] = value;
      }
      continue;
    }
    if (schema.type === "integer" || schema.type === "number") {
      if (value === "" || value == null) {
        if (field.required) invalid.push(field.name);
        continue;
      }
      const number = typeof value === "number" ? value : Number(value);
      const valid =
        Number.isFinite(number) &&
        (schema.type !== "integer" || Number.isInteger(number)) &&
        (typeof schema.minimum !== "number" || number >= schema.minimum) &&
        (typeof schema.maximum !== "number" || number <= schema.maximum);
      if (!valid) invalid.push(field.name);
      else content[field.name] = number;
    }
  }
  return { content: invalid.length === 0 ? content : null, invalid };
}

function McpServerIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
      <path
        d="M5.15 4.05a4.9 4.9 0 0 1 7.42 6.3 3.1 3.1 0 0 1-4.66.55"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.25"
      />
      <path
        d="M10.85 11.95a4.9 4.9 0 0 1-7.42-6.3 3.1 3.1 0 0 1 4.66-.55"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.25"
      />
      <path
        d="m4.3 2.85.85 1.2-1.3.65M11.7 13.15l-.85-1.2 1.3-.65"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.25"
      />
    </svg>
  );
}

function DismissIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 21 21">
      <path
        d="M14.6549 5.57307C14.9283 5.2997 15.3718 5.2997 15.6451 5.57307C15.9185 5.84643 15.9185 6.28993 15.6451 6.5633L11.3903 10.8182L15.6451 15.0731L15.735 15.1834C15.9141 15.4551 15.8842 15.8242 15.6451 16.0633C15.4061 16.3024 15.0369 16.3322 14.7653 16.1531L14.6549 16.0633L10.4 11.8084L6.14515 16.0633C5.87178 16.3367 5.42828 16.3367 5.15492 16.0633C4.88155 15.7899 4.88155 15.3464 5.15492 15.0731L9.4098 10.8182L5.15492 6.5633L5.06507 6.45295C4.88597 6.18128 4.91584 5.81214 5.15492 5.57307C5.39399 5.33399 5.76313 5.30413 6.0348 5.48322L6.14515 5.57307L10.4 9.82795L14.6549 5.57307Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SelectionIndicator({
  selected,
  variant,
}: {
  selected: boolean;
  variant: "checkbox" | "radio";
}) {
  return (
    <span
      aria-hidden="true"
      className={`mcp-form-card__indicator mcp-form-card__indicator--${variant}${selected ? " is-selected" : ""}`}
    />
  );
}

function InvalidMessage({ visible }: { visible: boolean }) {
  return visible ? (
    <div className="mcp-form-card__invalid">
      Complete this field to continue
    </div>
  ) : null;
}

export function McpFormField({
  autoFocus,
  field,
  hideLabel,
  invalid,
  onChange,
  onSubmit,
  value,
}: {
  autoFocus: boolean;
  field: FormFieldDefinition;
  hideLabel: boolean;
  invalid: boolean;
  onChange(value: FormValue): void;
  onSubmit(): void;
  value: FormValue;
}) {
  const label =
    typeof field.schema.title === "string"
      ? field.schema.title
      : titleCase(field.name);
  const description =
    typeof field.schema.description === "string"
      ? field.schema.description
      : null;
  const choices = choicesFor(field.schema);
  const onChoiceKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSubmit();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const sibling =
      event.key === "ArrowDown"
        ? event.currentTarget.nextElementSibling
        : event.currentTarget.previousElementSibling;
    if (sibling instanceof HTMLButtonElement) sibling.focus();
  };

  if (field.schema.type === "string" && choices.length > 0) {
    return (
      <fieldset
        aria-label={hideLabel ? label : undefined}
        className="mcp-form-card__choice-field"
      >
        {!hideLabel && <legend>{label}</legend>}
        {description && (
          <div className="mcp-form-card__description">{description}</div>
        )}
        {choices.map((choice, index) => {
          const selected = value === choice.value;
          return (
            <button
              aria-checked={selected}
              autoFocus={autoFocus && index === 0}
              key={choice.value}
              onClick={() => onChange(choice.value)}
              onKeyDown={onChoiceKeyDown}
              role="radio"
              type="button"
            >
              <SelectionIndicator selected={selected} variant="radio" />
              <span>{choice.label}</span>
            </button>
          );
        })}
        <InvalidMessage visible={invalid} />
      </fieldset>
    );
  }

  if (field.schema.type === "array") {
    const selectedValues = Array.isArray(value) ? value : [];
    return (
      <fieldset
        aria-label={hideLabel ? label : undefined}
        className="mcp-form-card__choice-field"
      >
        {!hideLabel && <legend>{label}</legend>}
        {description && (
          <div className="mcp-form-card__description">{description}</div>
        )}
        {choices.map((choice, index) => {
          const selected = selectedValues.includes(choice.value);
          return (
            <button
              aria-checked={selected}
              autoFocus={autoFocus && index === 0}
              key={choice.value}
              onClick={() =>
                onChange(
                  selected
                    ? selectedValues.filter((item) => item !== choice.value)
                    : [...selectedValues, choice.value],
                )
              }
              onKeyDown={onChoiceKeyDown}
              role="checkbox"
              type="button"
            >
              <SelectionIndicator selected={selected} variant="checkbox" />
              <span>{choice.label}</span>
            </button>
          );
        })}
        <InvalidMessage visible={invalid} />
      </fieldset>
    );
  }

  if (field.schema.type === "boolean") {
    const selected = value === true;
    return (
      <div className="mcp-form-card__boolean-field">
        <button
          aria-checked={selected}
          autoFocus={autoFocus}
          onClick={() => onChange(!selected)}
          role="checkbox"
          type="button"
        >
          <SelectionIndicator selected={selected} variant="checkbox" />
          <span>{label}</span>
        </button>
        {description && (
          <div className="mcp-form-card__description">{description}</div>
        )}
        <InvalidMessage visible={invalid} />
      </div>
    );
  }

  const isNumeric =
    field.schema.type === "integer" || field.schema.type === "number";
  const format = field.schema.format;
  const inputType = isNumeric
    ? "number"
    : format === "date"
      ? "date"
      : format === "email"
        ? "email"
        : format === "uri"
          ? "url"
          : "text";
  const maxLength =
    typeof field.schema.maxLength === "number"
      ? field.schema.maxLength
      : undefined;
  const useTextarea = !isNumeric && format == null && (maxLength ?? 0) >= 160;
  const common = {
    "aria-invalid": invalid || undefined,
    "aria-label": typeof field.schema.title === "string" ? undefined : label,
    autoFocus,
    maxLength,
    "minLength":
      typeof field.schema.minLength === "number"
        ? field.schema.minLength
        : undefined,
    "onChange": (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(event.currentTarget.value),
    "value":
      typeof value === "number" || typeof value === "string" ? value : "",
  };
  return (
    <label className="mcp-form-card__input-field">
      {typeof field.schema.title === "string" && (
        <div className="mcp-form-card__label">{label}</div>
      )}
      {description && (
        <div className="mcp-form-card__description mcp-form-card__description--flush">
          {description}
        </div>
      )}
      {useTextarea ? (
        <textarea {...common} rows={3} />
      ) : (
        <input
          {...common}
          max={
            isNumeric && typeof field.schema.maximum === "number"
              ? field.schema.maximum
              : undefined
          }
          min={
            isNumeric && typeof field.schema.minimum === "number"
              ? field.schema.minimum
              : undefined
          }
          step={field.schema.type === "integer" ? 1 : "any"}
          type={inputType}
        />
      )}
      <InvalidMessage visible={invalid} />
    </label>
  );
}

export function McpFormElicitationCard({ request }: { request: Approval }) {
  const { resolveMcpElicitation } = useSession();
  const cardRef = useRef<HTMLElement>(null);
  const fields = useMemo(() => formFields(request), [request]);
  const [values, setValues] = useState<FormValues>(() =>
    initialFormValues(fields),
  );
  const [invalid, setInvalid] = useState<string[]>([]);
  const message = String(request.params.message ?? "");

  const resolve = useCallback(
    (action: "cancel" | "decline") =>
      resolveMcpElicitation(request, action, null),
    [request, resolveMcpElicitation],
  );
  const submit = useCallback(() => {
    const result = validateFormValues(fields, values);
    setInvalid(result.invalid);
    if (result.content) {
      resolveMcpElicitation(request, "accept", result.content);
    }
  }, [fields, request, resolveMcpElicitation, values]);

  useEffect(() => {
    cardRef.current
      ?.querySelector<HTMLElement>(
        ".mcp-form-card__fields button, .mcp-form-card__fields input, .mcp-form-card__fields textarea, .mcp-form-card__continue",
      )
      ?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      resolve("cancel");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resolve]);

  return (
    <div className="approval-request-region">
      <section
        className="mcp-elicitation-form-card"
        data-codex-approval-surface="true"
        ref={cardRef}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <header className="mcp-form-card__header">
            <div>
              <McpServerIcon />
              <h2>{message}</h2>
            </div>
            <button
              aria-label="Cancel"
              onClick={() => resolve("cancel")}
              type="button"
            >
              <DismissIcon />
            </button>
          </header>
          <div className="mcp-form-card__fields">
            {fields.map((field, index) => (
              <McpFormField
                autoFocus={false}
                field={field}
                hideLabel={fields.length === 1}
                invalid={invalid.includes(field.name)}
                key={field.name}
                onChange={(value) => {
                  setValues((current) => ({ ...current, [field.name]: value }));
                  setInvalid((current) =>
                    current.filter((name) => name !== field.name),
                  );
                }}
                onSubmit={submit}
                value={values[field.name]}
              />
            ))}
          </div>
          <footer className="mcp-form-card__footer">
            <button
              className="mcp-form-card__skip"
              onClick={() => resolve("decline")}
              type="button"
            >
              <span>Skip</span>
            </button>
            <button className="mcp-form-card__continue" type="submit">
              <span>Continue</span>
              <kbd aria-hidden="true">⏎</kbd>
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function McpUrlActionCard({ request }: { request: Approval }) {
  const { resolveMcpElicitation } = useSession();
  const [opened, setOpened] = useState(false);
  const message = String(request.params.message ?? "");
  const url = String(request.params.url ?? "");

  const decline = useCallback(
    () => resolveMcpElicitation(request, "decline", null),
    [request, resolveMcpElicitation],
  );
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      decline();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [decline]);

  return (
    <div className="approval-request-region">
      <section className="mcp-url-card" data-codex-approval-surface="true">
        <div className="mcp-url-card__body">
          <div className="mcp-url-card__title">
            <McpServerIcon />
            <span>Action required</span>
          </div>
          <div className="mcp-url-card__description">
            <div>{message}</div>
            <div>
              <span>URL</span>
              <span>{url}</span>
            </div>
          </div>
        </div>
        <form
          className="mcp-url-card__footer"
          onSubmit={(event) => {
            event.preventDefault();
            if (opened) {
              resolveMcpElicitation(request, "accept", {});
            } else {
              setOpened(true);
              void window.chatgptDesktop.openExternal(url);
            }
          }}
        >
          <button
            className="mcp-url-card__decline"
            onClick={decline}
            type="button"
          >
            <span>Not now</span>
            <kbd>Escape</kbd>
          </button>
          <button className="mcp-url-card__submit" type="submit">
            <span>{opened ? "Continue" : "Open link"}</span>
            <kbd>⏎</kbd>
          </button>
        </form>
      </section>
    </div>
  );
}

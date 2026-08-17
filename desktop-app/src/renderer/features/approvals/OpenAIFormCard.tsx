import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type Approval, useSession } from "../../state/session";
import {
  fieldsForSchema,
  initialFormValues,
  McpFormField,
  type FormFieldDefinition,
  type FormSchema,
  type FormValue,
  type FormValues,
  validateFormValues,
} from "./McpElicitationCard";

type ImagePickerItem = {
  id: string;
  image: string;
  title: string;
};

type ImagePickerField = FormFieldDefinition & {
  schema: FormSchema & {
    items: ImagePickerItem[];
    type: "openai/imagePicker";
  };
};

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

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && /\S/.test(value);
}

function isImagePickerField(
  field: FormFieldDefinition,
): field is ImagePickerField {
  if (field.schema.type !== "openai/imagePicker") return false;
  if (field.schema.title != null && typeof field.schema.title !== "string") {
    return false;
  }
  if (
    field.schema.description != null &&
    typeof field.schema.description !== "string"
  ) {
    return false;
  }
  if (!Array.isArray(field.schema.items) || field.schema.items.length === 0) {
    return false;
  }
  const ids = new Set<string>();
  for (const value of field.schema.items) {
    const item = asRecord(value);
    if (
      !isNonBlankString(item?.id) ||
      !isNonBlankString(item.title) ||
      typeof item.image !== "string" ||
      !/^data:image\/[a-zA-Z0-9.+-]+;base64,[a-zA-Z0-9+/]+={0,2}$/.test(
        item.image,
      ) ||
      ids.has(item.id)
    ) {
      return false;
    }
    ids.add(item.id);
  }
  return true;
}

function isScalarField(field: FormFieldDefinition): boolean {
  return ["array", "boolean", "integer", "number", "string"].includes(
    String(field.schema.type),
  );
}

function parsedFields(request: Approval): FormFieldDefinition[] | null {
  const schema = asRecord(request.params.requestedSchema);
  const properties = asRecord(schema?.properties);
  if (schema?.type !== "object" || properties == null) return null;
  if (
    schema.required != null &&
    (!Array.isArray(schema.required) ||
      !schema.required.every((value) => typeof value === "string"))
  ) {
    return null;
  }
  const fields = fieldsForSchema(schema);
  if (fields.length !== Object.keys(properties).length) return null;
  return fields.every(
    (field) => isScalarField(field) || isImagePickerField(field),
  )
    ? fields
    : null;
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 21 21">
      <path
        d="M14.6549 5.57307C14.9283 5.2997 15.3718 5.2997 15.6451 5.57307C15.9185 5.84643 15.9185 6.28993 15.6451 6.5633L11.3903 10.8182L15.6451 15.0731L15.735 15.1834C15.9141 15.4551 15.8842 15.8242 15.6451 16.0633C15.4061 16.3024 15.0369 16.3322 14.7653 16.1531L14.6549 16.0633L10.4 11.8084L6.14515 16.0633C5.87178 16.3367 5.42828 16.3367 5.15492 16.0633C4.88155 15.7899 4.88155 15.3464 5.15492 15.0731L9.4098 10.8182L5.15492 6.5633L5.06507 6.45295C4.88597 6.18128 4.91584 5.81214 5.15492 5.57307C5.39399 5.33399 5.76313 5.30413 6.0348 5.48322L6.14515 5.57307L10.4 9.82795L14.6549 5.57307Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ArrowIcon({ reverse = false }: { reverse?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={reverse ? "is-reversed" : undefined}
      fill="none"
      viewBox="0 0 20 20"
    >
      <path
        d="M7.529 3.779a.667.667 0 0 1 .941 0l5.75 5.75a.667.667 0 0 1 0 .942l-5.75 5.75a.667.667 0 0 1-.941-.942L12.808 10 7.529 4.721a.667.667 0 0 1 0-.942Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ImagePicker({
  autoFocus,
  field,
  invalid,
  onChange,
  value,
}: {
  autoFocus: boolean;
  field: ImagePickerField;
  invalid: boolean;
  onChange(value: string): void;
  value: FormValue;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canBack, setCanBack] = useState(false);
  const [canForward, setCanForward] = useState(false);
  const label =
    typeof field.schema.title === "string"
      ? field.schema.title
      : titleCase(field.name);
  const updateScrollState = useCallback(() => {
    const element = scrollerRef.current;
    if (!element) return;
    setCanBack(element.scrollLeft > 1);
    setCanForward(
      element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
    );
  }, []);
  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, [updateScrollState]);
  const scroll = (direction: -1 | 1) => {
    scrollerRef.current?.scrollBy({
      behavior: "smooth",
      left: direction * 176,
    });
  };

  return (
    <div className="openai-image-picker">
      <div className="openai-image-picker__content">
        <div className="openai-image-picker__header">
          <div>{label}</div>
          <button
            aria-label="Show previous templates"
            disabled={!canBack}
            onClick={() => scroll(-1)}
            title="Show previous templates"
            type="button"
          >
            <ArrowIcon reverse />
          </button>
          <button
            aria-label="Show more templates"
            disabled={!canForward}
            onClick={() => scroll(1)}
            title="Show more templates"
            type="button"
          >
            <ArrowIcon />
          </button>
        </div>
        <div
          aria-label={label}
          className="openai-image-picker__options"
          onScroll={updateScrollState}
          ref={scrollerRef}
          role="radiogroup"
        >
          {field.schema.items.map((item, index) => {
            const selected = value === item.id;
            return (
              <label
                className={selected ? "is-selected" : undefined}
                key={item.id}
              >
                <input
                  aria-invalid={invalid || undefined}
                  autoFocus={autoFocus && index === 0}
                  checked={selected}
                  name={field.name}
                  onChange={() => onChange(item.id)}
                  type="radio"
                  value={item.id}
                />
                <div className="openai-image-picker__image">
                  <img
                    alt=""
                    decoding="async"
                    draggable={false}
                    loading="lazy"
                    src={item.image}
                  />
                </div>
                <div className="openai-image-picker__item-title">
                  {item.title}
                </div>
              </label>
            );
          })}
        </div>
      </div>
      {invalid && (
        <div className="openai-image-picker__invalid">
          Complete this field to continue
        </div>
      )}
    </div>
  );
}

function UnsupportedOpenAIForm({ request }: { request: Approval }) {
  const { resolveMcpElicitation } = useSession();
  const answer = useCallback(
    (action: "cancel" | "decline") =>
      resolveMcpElicitation(request, action, null),
    [request, resolveMcpElicitation],
  );
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      answer("cancel");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [answer]);
  const serverName = String(request.params.serverName ?? "Server");
  return (
    <div className="approval-request-region">
      <section
        className="openai-form-unsupported"
        data-codex-approval-surface="true"
      >
        <div className="openai-form-unsupported__body">
          <div>This version of ChatGPT can’t show this request yet</div>
          <div>
            {serverName} requested this form. You can skip it and keep going, or
            dismiss the request
          </div>
        </div>
        <div className="openai-form-unsupported__footer">
          <button onClick={() => answer("cancel")} type="button">
            Dismiss
          </button>
          <button autoFocus onClick={() => answer("decline")} type="button">
            Skip
          </button>
        </div>
      </section>
    </div>
  );
}

export function OpenAIFormCard({ request }: { request: Approval }) {
  const fields = useMemo(() => parsedFields(request), [request]);
  if (fields == null) return <UnsupportedOpenAIForm request={request} />;
  return <SupportedOpenAIForm fields={fields} request={request} />;
}

function SupportedOpenAIForm({
  fields,
  request,
}: {
  fields: FormFieldDefinition[];
  request: Approval;
}) {
  const { resolveMcpElicitation } = useSession();
  const cardRef = useRef<HTMLElement>(null);
  const scalarFields = useMemo(
    () => fields.filter((field) => !isImagePickerField(field)),
    [fields],
  );
  const [values, setValues] = useState<FormValues>(() =>
    initialFormValues(scalarFields),
  );
  const [invalid, setInvalid] = useState<string[]>([]);
  const onlyImagePicker = fields.length === 1 && isImagePickerField(fields[0]);
  const imageRequiredMissing = fields.some(
    (field) =>
      isImagePickerField(field) &&
      field.required &&
      !field.schema.items.some((item) => item.id === values[field.name]),
  );
  const answer = useCallback(
    (action: "cancel" | "decline") =>
      resolveMcpElicitation(request, action, null),
    [request, resolveMcpElicitation],
  );
  const submit = useCallback(() => {
    const result = validateFormValues(scalarFields, values);
    const invalidNames = [...result.invalid];
    const content = result.content == null ? null : { ...result.content };
    if (content != null) {
      for (const field of fields) {
        if (!isImagePickerField(field)) continue;
        const value = values[field.name];
        if (value == null || value === "") {
          if (field.required) invalidNames.push(field.name);
          continue;
        }
        if (
          typeof value !== "string" ||
          !field.schema.items.some((item) => item.id === value)
        ) {
          invalidNames.push(field.name);
          continue;
        }
        content[field.name] = value;
      }
    }
    setInvalid(invalidNames);
    if (content != null && invalidNames.length === 0) {
      resolveMcpElicitation(request, "accept", content);
    }
  }, [fields, request, resolveMcpElicitation, scalarFields, values]);
  useEffect(() => {
    cardRef.current
      ?.querySelector<HTMLElement>(
        ".openai-form-card__fields input, .openai-form-card__fields textarea, .openai-form-card__fields button, .openai-form-card__continue",
      )
      ?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      answer("cancel");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [answer]);
  const updateValue = (name: string, value: FormValue) => {
    setValues((current) => ({ ...current, [name]: value }));
    setInvalid((current) => current.filter((item) => item !== name));
  };

  return (
    <div className="approval-request-region">
      <section
        className={`openai-form-card${onlyImagePicker ? " openai-form-card--image-only" : ""}`}
        data-codex-approval-surface="true"
        ref={cardRef}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {!onlyImagePicker && (
            <header className="openai-form-card__header">
              <div>
                <div>{String(request.params.message ?? "")}</div>
                <div>
                  {String(request.params.serverName ?? "Server")} requests
                  information
                </div>
              </div>
              <button
                aria-label="Cancel"
                onClick={() => answer("cancel")}
                type="button"
              >
                <CloseIcon />
              </button>
            </header>
          )}
          <div className="openai-form-card__fields">
            {fields.map((field, index) =>
              isImagePickerField(field) ? (
                <ImagePicker
                  autoFocus={false}
                  field={field}
                  invalid={invalid.includes(field.name)}
                  key={field.name}
                  onChange={(value) => updateValue(field.name, value)}
                  value={values[field.name]}
                />
              ) : (
                <McpFormField
                  autoFocus={false}
                  field={field}
                  hideLabel={fields.length === 1}
                  invalid={invalid.includes(field.name)}
                  key={field.name}
                  onChange={(value) => updateValue(field.name, value)}
                  onSubmit={submit}
                  value={values[field.name]}
                />
              ),
            )}
          </div>
          <footer className="openai-form-card__footer">
            {onlyImagePicker ? (
              <button
                className="openai-form-card__dismiss"
                onClick={() => answer("decline")}
                type="button"
              >
                <span>Dismiss</span>
                <kbd aria-hidden="true">ESC</kbd>
              </button>
            ) : (
              <button
                className="openai-form-card__skip"
                onClick={() => answer("decline")}
                type="button"
              >
                Skip
              </button>
            )}
            <button
              className="openai-form-card__continue"
              disabled={imageRequiredMissing}
              type="submit"
            >
              Continue
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

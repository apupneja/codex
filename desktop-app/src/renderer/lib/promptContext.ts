import type {
  ComposerContextBlock,
  PromptSubmission,
} from "../../shared/types";

export const LONG_CONTEXT_MIN_CHARACTERS = 800;
export const LONG_CONTEXT_MIN_LINES = 8;

type TextElement = {
  byteRange: { end: number; start: number };
  placeholder: string | null;
};

type MentionedFile = {
  path: string;
  title: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function contextTitle(text: string): string {
  const firstLine =
    text
      .split(/\r?\n/)
      .map((line) => line.replace(/^#{1,6}\s+/, "").trim())
      .find(Boolean) ?? "Pasted context";
  const normalized = firstLine.replace(/\s+/g, " ");
  return normalized.length > 42
    ? `${normalized.slice(0, 39).trimEnd()}…`
    : normalized;
}

export function isLongContext(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.length >= LONG_CONTEXT_MIN_CHARACTERS ||
    trimmed.split(/\r?\n/).length >= LONG_CONTEXT_MIN_LINES
  );
}

export function composePromptText(submission: PromptSubmission): {
  text: string;
  textElements: TextElement[];
} {
  const contexts = submission.contexts
    .map((context) => ({ ...context, text: context.text.trim() }))
    .filter((context) => context.text.length > 0);
  const request = submission.text.trim();
  let text = "";
  const textElements: TextElement[] = [];

  for (const context of contexts) {
    if (text) text += "\n\n";
    const start = encoder.encode(text).byteLength;
    text += context.text;
    const end = encoder.encode(text).byteLength;
    textElements.push({
      byteRange: { end, start },
      placeholder: context.title || contextTitle(context.text),
    });
  }

  if (request) {
    if (text) text += "\n\n";
    text += request;
  }

  return { text, textElements };
}

export function extractPromptContext(
  text: string,
  elements: TextElement[],
): { contexts: ComposerContextBlock[]; text: string } {
  if (elements.length === 0) return { contexts: [], text };
  const bytes = encoder.encode(text);
  const sorted = [...elements].sort(
    (left, right) => left.byteRange.start - right.byteRange.start,
  );
  const contexts: ComposerContextBlock[] = [];
  const visible: Uint8Array[] = [];
  let cursor = 0;

  for (const element of sorted) {
    const { start, end } = element.byteRange;
    if (start < cursor || end <= start || end > bytes.byteLength) continue;
    visible.push(bytes.slice(cursor, start));
    const contextText = decoder.decode(bytes.slice(start, end));
    contexts.push({
      text: contextText,
      title: element.placeholder?.trim() || contextTitle(contextText),
    });
    cursor = end;
  }
  visible.push(bytes.slice(cursor));

  return {
    contexts,
    text: visible
      .map((part) => decoder.decode(part))
      .join("")
      .trim(),
  };
}

export function parseMentionedFilesEnvelope(text: string): {
  files: MentionedFile[];
  text: string;
} {
  const match = text
    .trim()
    .match(
      /^# Files mentioned by the user:\s*\n([\s\S]*?)^## My request(?: for Codex)?:\s*\n?([\s\S]*)$/m,
    );
  if (!match) return { files: [], text };

  const files: MentionedFile[] = [];
  const entries = match[1] ?? "";
  for (const entry of entries.matchAll(
    /^##\s+(.+?):\s*\n([^\n]+)(?=\n(?:\n|##)|$)/gm,
  )) {
    const title = entry[1]?.trim();
    const path = entry[2]?.trim();
    if (title && path) files.push({ path, title });
  }

  return { files, text: (match[2] ?? "").trim() };
}

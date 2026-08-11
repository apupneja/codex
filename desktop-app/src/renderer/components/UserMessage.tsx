import { FileCode2, Link } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import type { ThreadItem } from "../../shared/types";
import {
  extractPromptContext,
  parseMentionedFilesEnvelope,
} from "../lib/promptContext";
import { SubmittedContextBlock } from "./ContextBlock";

function CollapsibleMessageText({ text }: { text: string }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element || expanded) return;
    const measure = () => {
      setOverflowing(element.scrollHeight > element.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, text]);

  const toggle = () => setExpanded((current) => !current);
  return (
    <div
      ref={elementRef}
      aria-expanded={overflowing ? expanded : undefined}
      aria-label={
        overflowing
          ? expanded
            ? "Collapse prompt"
            : "Show full prompt"
          : undefined
      }
      className={`user-message-text ${expanded ? "is-expanded" : "is-collapsed"} ${overflowing ? "is-overflowing" : ""}`}
      onClick={() => {
        const selection = window.getSelection();
        if (!overflowing || (selection && !selection.isCollapsed)) return;
        toggle();
      }}
      onKeyDown={(event) => {
        if (!overflowing || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }
        event.preventDefault();
        toggle();
      }}
      role={overflowing ? "button" : undefined}
      tabIndex={overflowing ? 0 : undefined}
      title={
        overflowing
          ? expanded
            ? "Collapse prompt"
            : "Show full prompt"
          : undefined
      }
    >
      {text}
    </div>
  );
}

export function UserMessage({
  item,
  onOpenFile,
}: {
  item: Extract<ThreadItem, { type: "userMessage" }>;
  onOpenFile(path: string): void;
}) {
  const extractedText = item.content
    .filter((entry) => entry.type === "text")
    .map((entry) =>
      entry.type === "text"
        ? extractPromptContext(entry.text, entry.text_elements)
        : { contexts: [], text: "" },
    );
  const envelope = parseMentionedFilesEnvelope(
    extractedText.map((entry) => entry.text).join("\n"),
  );
  const contexts = extractedText.flatMap((entry) => entry.contexts);
  const attachments = item.content.filter((entry) => entry.type !== "text");

  return (
    <div className="user-message-group">
      {contexts.length ? (
        <div className="submitted-context-list">
          {contexts.map((context, index) => (
            <SubmittedContextBlock
              context={context}
              key={`${context.title}-${index}`}
            />
          ))}
        </div>
      ) : null}
      <div className="user-message">
        {envelope.text ? <CollapsibleMessageText text={envelope.text} /> : null}
        {attachments.length || envelope.files.length ? (
          <div className="message-attachments">
            {attachments.map((entry, index) => {
              const path =
                entry.type === "localImage" ||
                entry.type === "localAudio" ||
                entry.type === "skill" ||
                entry.type === "mention"
                  ? entry.path
                  : null;
              const label =
                entry.type === "skill" || entry.type === "mention"
                  ? entry.name
                  : (path?.split(/[\\/]/).pop() ?? entry.type);
              return path ? (
                <button
                  key={`${entry.type}-${path}-${index}`}
                  onClick={() => onOpenFile(path)}
                  type="button"
                >
                  <FileCode2 size={12} /> {label}
                </button>
              ) : (
                <span key={`${entry.type}-${index}`}>
                  <Link size={12} /> {label}
                </span>
              );
            })}
            {envelope.files.map((file) => (
              <button
                key={file.path}
                onClick={() => onOpenFile(file.path)}
                type="button"
              >
                <FileCode2 size={12} /> {file.title}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

import { Check, ChevronDown, Copy, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { openLink } from "../state/link-routing";

export function UserMessage({
  onEdit,
  text,
}: {
  onEdit?(text: string): Promise<void> | void;
  text: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(text);
  const [sendingEdit, setSendingEdit] = useState(false);

  const submitEdit = async () => {
    const nextText = editDraft.trim();
    if (!nextText || sendingEdit) return;
    setSendingEdit(true);
    try {
      await onEdit?.(nextText);
      setEditing(false);
    } finally {
      setSendingEdit(false);
    }
  };

  useEffect(() => {
    const element = ref.current;
    const textElement = textRef.current;
    if (!element || !textElement) return;
    const measure = () => {
      const lineHeight = Number.parseFloat(
        getComputedStyle(textElement).lineHeight,
      );
      setOverflowing(textElement.scrollHeight > lineHeight * 3 + 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(textElement);
    measure();
    return () => observer.disconnect();
  }, [text]);

  return (
    <div
      className={`user-message-group${editing ? " is-editing" : ""}`}
      ref={ref}
    >
      {editing ? (
        <form
          className="user-message-editor"
          onSubmit={(event) => {
            event.preventDefault();
            void submitEdit();
          }}
        >
          <textarea
            aria-label="Edit message"
            autoFocus
            onChange={(event) => setEditDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setEditing(false);
            }}
            placeholder="Edit message"
            rows={2}
            value={editDraft}
          />
          <div className="user-message-editor__actions">
            <button
              disabled={sendingEdit}
              onClick={() => setEditing(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="is-primary"
              disabled={!editDraft.trim() || sendingEdit}
              type="submit"
            >
              {sendingEdit ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="user-message">
            <div
              className="user-message__bubble"
              onDoubleClick={() => {
                if (onEdit) setEditing(true);
              }}
              tabIndex={0}
            >
              <div className="user-message-content">
                <div
                  className={`user-message-text${
                    overflowing ? " is-overflowing" : ""
                  }${!expanded ? " is-collapsed" : ""}`}
                  ref={textRef}
                >
                  <Markdown
                    components={{
                      a: ({ children, href }) => (
                        <a
                          href={href}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (href) openLink(href);
                          }}
                        >
                          {children}
                        </a>
                      ),
                    }}
                    remarkPlugins={[remarkGfm]}
                  >
                    {text}
                  </Markdown>
                </div>
                {overflowing && !expanded && (
                  <span aria-hidden="true" className="user-message-ellipsis">
                    …
                  </span>
                )}
              </div>
              {overflowing && (
                <button
                  aria-expanded={expanded}
                  aria-label={expanded ? "Show less" : "Show more"}
                  className="message-expand"
                  onClick={() => setExpanded((value) => !value)}
                  type="button"
                >
                  <span>{expanded ? "Show less" : "Show more"}</span>
                  <ChevronDown aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          <div className="user-message-actions">
            <button
              aria-label="Copy message"
              className="message-copy"
              onClick={() => {
                void navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
              type="button"
            >
              {copied ? (
                <Check aria-hidden="true" />
              ) : (
                <Copy aria-hidden="true" />
              )}
            </button>
            {onEdit && (
              <button
                aria-label="Edit message"
                className="message-copy"
                onClick={() => setEditing(true)}
                type="button"
              >
                <Pencil aria-hidden="true" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

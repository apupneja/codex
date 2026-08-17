import { Check, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { useDismissibleLayer } from "../../ui/useDismissibleLayer";
import { CopyIcon, ExpandPlanIcon } from "../../ui/AppIcons";

export function MarkdownTable({
  children,
  source,
}: {
  children: ReactNode;
  source: string;
}) {
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const previewSurfaceRef = useRef<HTMLDivElement>(null);
  const previewWasOpen = useRef(false);
  const closePreview = useCallback(() => setPreviewOpen(false), []);

  useDismissibleLayer(previewSurfaceRef, closePreview, previewOpen);
  useEffect(() => {
    if (previewOpen) {
      previewWasOpen.current = true;
      closeButtonRef.current?.focus();
    } else if (previewWasOpen.current) {
      previewWasOpen.current = false;
      expandButtonRef.current?.focus();
    }
  }, [previewOpen]);

  return (
    <div
      className="markdown-table-container"
      data-markdown-table
      data-wide-block=""
      tabIndex={-1}
    >
      <div className="markdown-table-scroller horizontal-scroll-fade-mask">
        <div className="markdown-table-wrapper">
          <table className="markdown-table" dir="auto">
            {children}
          </table>
        </div>
      </div>
      <div className="markdown-table-actions" data-markdown-copy="exclude">
        <div>
          <button
            aria-expanded={previewOpen}
            aria-haspopup="dialog"
            aria-label="Expand table"
            onClick={() => setPreviewOpen(true)}
            ref={expandButtonRef}
            title="Expand table"
            type="button"
          >
            <ExpandPlanIcon aria-hidden="true" />
          </button>
          <button
            aria-label="Copy table"
            onClick={(event) => {
              const table = event.currentTarget
                .closest("[data-markdown-table]")
                ?.querySelector("table");
              if (navigator.clipboard?.write && table) {
                void navigator.clipboard.write([
                  new ClipboardItem({
                    "text/html": new Blob([table.outerHTML], {
                      type: "text/html",
                    }),
                    "text/plain": new Blob([source], { type: "text/plain" }),
                  }),
                ]);
              } else {
                void navigator.clipboard?.writeText(source);
              }
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            title="Copy table"
            type="button"
          >
            {copied ? (
              <Check aria-hidden="true" />
            ) : (
              <CopyIcon aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      {previewOpen &&
        createPortal(
          <div
            aria-label="Table preview"
            aria-modal="true"
            className="markdown-table-preview"
            role="dialog"
          >
            <button
              aria-label="Close table preview"
              className="markdown-table-preview__close"
              onClick={closePreview}
              ref={closeButtonRef}
              type="button"
            >
              <X aria-hidden="true" />
            </button>
            <div
              className="markdown-table-preview__surface"
              ref={previewSurfaceRef}
            >
              <table className="markdown-table" dir="auto">
                {children}
              </table>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

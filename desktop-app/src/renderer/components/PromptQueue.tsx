import { MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import type { PromptDraft } from "../state/session";
import { IconButton } from "../ui/IconButton";
import { useDismissibleLayer } from "../ui/useDismissibleLayer";

export function PromptQueue({
  prompts,
  onEdit,
  onRemove,
  onSteer,
}: {
  prompts: PromptDraft[];
  onEdit(index: number): void;
  onRemove(index: number): void;
  onSteer(index: number): void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useDismissibleLayer(menuRef, () => setOpenIndex(null));
  if (!prompts.length) return null;
  return (
    <div className="prompt-queue" aria-label="Queued messages">
      {prompts.map((prompt, index) => (
        <div
          className="prompt-queue__item"
          key={`${prompt.text}-${prompt.attachments?.map((item) => item.path).join("-")}-${index}`}
        >
          <span>
            {prompt.text ||
              prompt.attachments?.map((item) => item.name).join(", ")}
          </span>
          <div className="prompt-queue__actions">
            <IconButton
              icon={Send}
              label="Steer"
              onClick={() => onSteer(index)}
              size="sm"
            />
            <IconButton
              icon={MoreHorizontal}
              label="Queued message actions"
              onClick={() => setOpenIndex(index)}
              size="sm"
            />
            {openIndex === index && (
              <div className="prompt-queue__menu" ref={menuRef} role="menu">
                <button
                  onClick={() => onEdit(index)}
                  role="menuitem"
                  type="button"
                >
                  <Pencil aria-hidden="true" /> Edit prompt
                </button>
                <button
                  onClick={() => onRemove(index)}
                  role="menuitem"
                  type="button"
                >
                  <Trash2 aria-hidden="true" /> Delete queued message
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

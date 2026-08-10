import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

import type { Toast } from "../state/useCodexController";

export function Toasts({
  onDismiss,
  toasts,
}: {
  onDismiss(id: string): void;
  toasts: Toast[];
}) {
  return (
    <div aria-live="polite" className="toast-stack">
      {toasts.map((toast) => {
        const Icon =
          toast.tone === "danger"
            ? AlertCircle
            : toast.tone === "success"
              ? CheckCircle2
              : Info;
        return (
          <div className={`toast toast-${toast.tone}`} key={toast.id}>
            <Icon size={15} />
            <span>{toast.message}</span>
            <button
              aria-label="Dismiss notification"
              className="toast-dismiss"
              onClick={() => onDismiss(toast.id)}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

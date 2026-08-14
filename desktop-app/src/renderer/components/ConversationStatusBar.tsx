import { ChevronDown, GitBranch, Laptop, LoaderCircle } from "lucide-react";

type ConversationStatusBarProps = {
  active: boolean;
  branchLabel: string;
  deviceLabel: string;
  tokenPercent: number;
};

export function ConversationStatusBar({
  active,
  branchLabel,
  deviceLabel,
  tokenPercent,
}: ConversationStatusBarProps) {
  return (
    <div className="conversation-statusbar">
      <button aria-label={`Branch ${branchLabel}`} type="button">
        <GitBranch aria-hidden="true" size={13} />
        <span>{branchLabel}</span>
        <ChevronDown aria-hidden="true" size={12} />
      </button>
      <button aria-label={`${deviceLabel} environment`} type="button">
        <Laptop aria-hidden="true" size={13} />
        <span>{deviceLabel}</span>
        <ChevronDown aria-hidden="true" size={12} />
      </button>
      <span
        aria-label={
          active
            ? `Agent working. Context ${tokenPercent}%`
            : `Context ${tokenPercent}%`
        }
        className={`context-ring ${active ? "is-active" : ""}`}
        style={
          active
            ? undefined
            : {
                background: `conic-gradient(var(--addition) ${tokenPercent}%, var(--border-strong) 0)`,
              }
        }
        title={
          active
            ? `Agent working · Context ${tokenPercent}%`
            : `Context ${tokenPercent}%`
        }
      >
        {active ? (
          <LoaderCircle
            aria-hidden="true"
            className="context-ring-spinner"
            size={14}
          />
        ) : (
          <i />
        )}
      </span>
    </div>
  );
}

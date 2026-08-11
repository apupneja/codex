import { ChevronDown, GitBranch, Laptop } from "lucide-react";

type ConversationStatusBarProps = {
  branchLabel: string;
  deviceLabel: string;
  tokenPercent: number;
};

export function ConversationStatusBar({
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
        aria-label={`Context ${tokenPercent}%`}
        className="context-ring"
        style={{
          background: `conic-gradient(var(--addition) ${tokenPercent}%, var(--border-strong) 0)`,
        }}
        title={`Context ${tokenPercent}%`}
      >
        <i />
      </span>
    </div>
  );
}

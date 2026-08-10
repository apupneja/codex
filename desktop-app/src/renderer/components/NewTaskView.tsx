import {
  ChevronDown,
  Code2,
  FolderOpen,
  GitBranch,
  Laptop,
  PanelRightOpen,
  Zap,
} from "lucide-react";

import type { CodexController } from "../state/useCodexController";
import { CodexMark } from "./CodexMark";
import { Composer } from "./Composer";

type NewTaskViewProps = {
  controller: CodexController;
  onToggleWorkspace(): void;
};

function basename(path: string | null): string {
  return path?.split(/[\\/]/).filter(Boolean).pop() ?? "Choose repository";
}

export function NewTaskView({
  controller,
  onToggleWorkspace,
}: NewTaskViewProps) {
  const workspace = controller.preferences.lastWorkspace;
  return (
    <main className="new-task-view">
      <header className="workbench-header new-task-header">
        <div className="window-drag-fill" />
        <button className="header-button" onClick={onToggleWorkspace}>
          <PanelRightOpen size={14} />
          Workspace
        </button>
      </header>
      <div className="new-task-center">
        <div className="hero-mark">
          <CodexMark size={34} />
        </div>
        <div className="new-task-context">
          <button
            onClick={() => void controller.chooseWorkspace()}
            title={workspace ?? undefined}
          >
            <FolderOpen size={14} />
            {basename(workspace)}
            <ChevronDown size={12} />
          </button>
          <span title="Tasks run on the repository's current Git branch">
            <GitBranch size={14} />
            Current branch
          </span>
          <span title="Tasks run through the local Codex app-server">
            <Laptop size={14} />
            This computer
          </span>
        </div>
        <Composer
          active={false}
          disabled={controller.runtime.phase !== "ready"}
          models={controller.models}
          onInterrupt={controller.interrupt}
          onSubmit={controller.submitPrompt}
          onToast={(message) => controller.addToast(message)}
          preferences={controller.preferences}
          updatePreferences={controller.updatePreferences}
        />
        <div className="prompt-suggestions">
          <button
            onClick={() =>
              void controller.submitPrompt(
                "Review this repository and identify the highest-impact improvement.",
              )
            }
          >
            <Zap size={13} /> Review repository
          </button>
          <button
            onClick={() =>
              void controller.submitPrompt(
                "Explain the architecture of this repository and its main execution flow.",
              )
            }
          >
            <Code2 size={13} /> Explain architecture
          </button>
        </div>
      </div>
      <div className="new-task-tip">
        <span>Tip</span> Use <kbd>@</kbd> to reference files and <kbd>/</kbd> to
        invoke skills
      </div>
    </main>
  );
}

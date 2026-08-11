import {
  Code2,
  File,
  Globe2,
  GitPullRequest,
  Maximize2,
  Paintbrush,
  PanelRightClose,
  Plus,
  TerminalSquare,
  X,
} from "lucide-react";

import type { OpenDocument } from "../../shared/types";
import {
  WorkspaceOpenMenu,
  type WorkspaceOpenTarget,
} from "./WorkspaceOpenMenu";

export type WorkspaceTab = WorkspaceOpenTarget | "changes" | "editor";

const toolLabels: Record<WorkspaceTab, string> = {
  browser: "Browser",
  canvas: "Canvas",
  changes: "Changes",
  editor: "Code",
  files: "Files",
  terminal: "Terminal",
};

function ToolIcon({ tab }: { tab: WorkspaceTab }) {
  if (tab === "browser") return <Globe2 size={14} />;
  if (tab === "canvas") return <Paintbrush size={14} />;
  if (tab === "changes") return <GitPullRequest size={14} />;
  if (tab === "files") return <File size={14} />;
  if (tab === "terminal") return <TerminalSquare size={14} />;
  return <Code2 size={14} />;
}

type WorkspaceTabsProps = {
  activePath: string | null;
  activeTab: WorkspaceTab;
  documents: OpenDocument[];
  focused: boolean;
  menuOpen: boolean;
  openTabs: WorkspaceTab[];
  onActivateDocument(path: string): void;
  onActivateTab(tab: WorkspaceTab): void;
  onClose(): void;
  onCloseDocument(document: OpenDocument): void;
  onCloseTab(tab: WorkspaceTab): void;
  onMenuOpenChange(open: boolean): void;
  onOpenTarget(target: WorkspaceOpenTarget, input?: string): void;
  onToggleFocused(): void;
};

export function WorkspaceTabs({
  activePath,
  activeTab,
  documents,
  focused,
  menuOpen,
  onActivateDocument,
  onActivateTab,
  onClose,
  onCloseDocument,
  onCloseTab,
  onMenuOpenChange,
  onOpenTarget,
  onToggleFocused,
  openTabs,
}: WorkspaceTabsProps) {
  return (
    <div className="workspace-tabs">
      {openTabs.map((openTab) =>
        openTab === "editor" && documents.length ? (
          documents.map((document) => (
            <button
              aria-label={document.path.split(/[\\/]/).pop()}
              className={
                activeTab === "editor" && activePath === document.path
                  ? "active"
                  : ""
              }
              key={document.path}
              onClick={() => onActivateDocument(document.path)}
              title={document.path}
              type="button"
            >
              <Code2 size={13} />
              {document.path.split(/[\\/]/).pop()}
              {document.dirty ? <span className="dirty-dot" /> : null}
              <X
                aria-label={`Close ${document.path}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseDocument(document);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  event.stopPropagation();
                  onCloseDocument(document);
                }}
                role="button"
                size={11}
                tabIndex={0}
              />
            </button>
          ))
        ) : (
          <button
            aria-label={toolLabels[openTab]}
            className={`${activeTab === openTab ? "active" : ""} workspace-tool-tab`}
            key={openTab}
            onClick={() => onActivateTab(openTab)}
            type="button"
          >
            <ToolIcon tab={openTab} />
            {toolLabels[openTab]}
            {openTabs.length > 1 ? (
              <X
                aria-label={`Close ${toolLabels[openTab]} tab`}
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseTab(openTab);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  event.stopPropagation();
                  onCloseTab(openTab);
                }}
                role="button"
                size={11}
                tabIndex={0}
              />
            ) : null}
          </button>
        ),
      )}
      <div className="workspace-tab-launcher">
        <button
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          aria-label="Open workspace tool"
          className="workspace-add-tab"
          onClick={() => onMenuOpenChange(!menuOpen)}
          onMouseDown={(event) => event.stopPropagation()}
          title="Open file, terminal, browser, or canvas"
          type="button"
        >
          <Plus size={14} />
        </button>
        {menuOpen ? (
          <WorkspaceOpenMenu
            onClose={() => onMenuOpenChange(false)}
            onOpen={onOpenTarget}
          />
        ) : null}
      </div>
      <span className="workspace-tab-spacer" />
      <div className="workspace-tab-actions">
        <button
          aria-label={focused ? "Restore panel" : "Maximize panel"}
          onClick={onToggleFocused}
          type="button"
        >
          <Maximize2 size={16} />
        </button>
        <button
          aria-label="Hide workspace panel"
          onClick={onClose}
          type="button"
        >
          <PanelRightClose size={16} />
        </button>
      </div>
    </div>
  );
}

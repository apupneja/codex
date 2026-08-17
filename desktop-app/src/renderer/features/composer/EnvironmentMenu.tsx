import { ChevronDown, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { useSession } from "../../state/session";
import {
  ModeCheckIcon,
  WorkCloudIcon,
  WorkRunIcon,
  WorktreeIcon,
} from "../../ui/AppIcons";
import { Menu, MenuItem } from "../../ui/Menu";

type ComposerMode = "cloud" | "local" | "worktree";

function pathLabel(path: string): string {
  const parts = path.split(/[\\/]+/).filter(Boolean);
  return parts.at(-1) ?? path;
}

export function EnvironmentMenu({
  placement = "utility",
}: {
  placement?: "home" | "thread" | "utility";
}) {
  const { account, current, localProjects, project, selectedProjectId } =
    useSession();
  const [environmentPickerOpen, setEnvironmentPickerOpen] = useState(false);
  const [gitRoot, setGitRoot] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<ComposerMode>("local");
  const cwd = current?.cwd ?? project;
  const selectedProject =
    localProjects.find((item) => item.id === selectedProjectId) ?? null;

  useEffect(() => {
    let active = true;
    setGitRoot(null);
    if (!cwd)
      return () => {
        active = false;
      };
    void window.chatgptDesktop
      .getGitRoot(cwd)
      .then((root) => {
        if (active) setGitRoot(root);
      })
      .catch(() => {
        if (active) setGitRoot(null);
      });
    return () => {
      active = false;
    };
  }, [cwd]);

  if (!gitRoot) return null;

  const additionalFolderCount = Math.max(
    (selectedProject?.rootPaths.length ?? 1) - 1,
    0,
  );
  const multipleRoots = additionalFolderCount > 0;
  const repositoryName = pathLabel(gitRoot);
  const triggerLabel =
    mode === "cloud"
      ? multipleRoots
        ? `Cloud for ${repositoryName}`
        : "Cloud"
      : mode === "worktree"
        ? multipleRoots
          ? `New worktree · ${repositoryName}`
          : "New worktree"
        : placement === "home"
          ? "Local"
          : "Work locally";
  const TriggerIcon =
    mode === "cloud"
      ? WorkCloudIcon
      : mode === "worktree"
        ? WorktreeIcon
        : WorkRunIcon;

  const selectMode = (nextMode: ComposerMode) => {
    setMode(nextMode);
    if (nextMode === "cloud") {
      setEnvironmentPickerOpen(true);
      return;
    }
    setEnvironmentPickerOpen(false);
    setMenuOpen(false);
  };

  return (
    <span className="composer-control composer-environment-control">
      <button
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        data-composer-navigation-target="run-location"
        onClick={() => {
          setEnvironmentPickerOpen(false);
          setMenuOpen((value) => !value);
        }}
        title="Select where to run the chat"
        type="button"
      >
        <TriggerIcon aria-hidden="true" />
        <span>{triggerLabel}</span>
        <ChevronDown aria-hidden="true" className="composer-control-chevron" />
      </button>
      {menuOpen && (
        <Menu
          label={environmentPickerOpen ? "Select environment" : "Work in"}
          onDismiss={() => {
            setEnvironmentPickerOpen(false);
            setMenuOpen(false);
          }}
        >
          {environmentPickerOpen ? (
            <>
              <div className="composer-environment-menu__title">
                Select environment
              </div>
              <MenuItem
                onSelect={() => {
                  setMenuOpen(false);
                  void window.chatgptDesktop.openExternal(
                    "https://chatgpt.com/codex/cloud/settings/environments",
                  );
                }}
              >
                <span className="composer-environment-menu__setup">
                  Set up an environment via Codex web
                </span>
                <ExternalLink aria-hidden="true" />
              </MenuItem>
            </>
          ) : (
            <>
              <div className="composer-environment-menu__title">Work in</div>
              <MenuItem onSelect={() => selectMode("local")}>
                <WorkRunIcon aria-hidden="true" />
                <span className="composer-environment-menu__label">Local</span>
                {mode === "local" && <ModeCheckIcon aria-hidden="true" />}
              </MenuItem>
              <MenuItem onSelect={() => selectMode("worktree")}>
                <WorktreeIcon aria-hidden="true" />
                <span className="composer-environment-menu__copy">
                  <span>
                    {multipleRoots
                      ? `New worktree · ${repositoryName}`
                      : "New worktree"}
                  </span>
                  {multipleRoots && (
                    <small>
                      Work locally in {additionalFolderCount} other{" "}
                      {additionalFolderCount === 1 ? "folder" : "folders"}
                    </small>
                  )}
                </span>
                {mode === "worktree" && <ModeCheckIcon aria-hidden="true" />}
              </MenuItem>
              {account?.type === "chatgpt" && (
                <MenuItem onSelect={() => selectMode("cloud")}>
                  <WorkCloudIcon aria-hidden="true" />
                  <span className="composer-environment-menu__copy">
                    <span>
                      {multipleRoots ? `Cloud · ${repositoryName}` : "Cloud"}
                    </span>
                    {multipleRoots && (
                      <small>
                        No access to {additionalFolderCount} other{" "}
                        {additionalFolderCount === 1 ? "folder" : "folders"}
                      </small>
                    )}
                  </span>
                  {mode === "cloud" && <ModeCheckIcon aria-hidden="true" />}
                </MenuItem>
              )}
            </>
          )}
        </Menu>
      )}
    </span>
  );
}

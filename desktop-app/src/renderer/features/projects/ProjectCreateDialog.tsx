import { Folder, X } from "lucide-react";
import { useState } from "react";

import { type LocalProject, useSession } from "../../state/session";
import { FolderPlusIcon } from "../../ui/AppIcons";
import {
  DEFAULT_PROJECT_APPEARANCE,
  ProjectMarkerPicker,
} from "./ProjectMarker";

function folderName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

export function ProjectCreateDialog({
  onClose,
  onCreated,
  onRemove,
  project,
}: {
  onClose(): void;
  onCreated?(): void;
  onRemove?(): void;
  project?: LocalProject;
}) {
  const { createProject, pickProjectFolder, updateProject } = useSession();
  const [projectName, setProjectName] = useState(project?.name ?? "");
  const [sources, setSources] = useState<string[]>(project?.rootPaths ?? []);
  const [appearance, setAppearance] = useState(
    project?.appearance ?? DEFAULT_PROJECT_APPEARANCE,
  );

  const addSource = async () => {
    const source = await pickProjectFolder();
    if (source) {
      setSources((items) =>
        items.includes(source) ? items : [...items, source],
      );
    }
  };

  return (
    <div
      className="project-create-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        aria-labelledby="project-create-title"
        className="project-create-dialog"
        role="dialog"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (project) {
              updateProject(project.id, projectName, sources, appearance);
            } else {
              createProject(projectName, sources, appearance);
            }
            onClose();
            onCreated?.();
          }}
        >
          <div className="project-create-dialog__heading">
            <h2 id="project-create-title">
              {project ? "Edit project" : "Create project"}
            </h2>
          </div>
          <div className="project-create-dialog__field">
            <label htmlFor="project-name">Name</label>
            <div className="project-create-dialog__name">
              <ProjectMarkerPicker
                appearance={appearance}
                onChange={setAppearance}
                projectName={projectName}
              />
              <input
                aria-label="Project name"
                autoFocus
                id="project-name"
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Project name"
                value={projectName}
              />
            </div>
          </div>
          <div className="project-create-dialog__source">
            <span>Source folders</span>
            {sources.length === 0 ? (
              <button
                aria-label="Choose source folders"
                className="project-create-dialog__folder-picker"
                onClick={() => void addSource()}
                type="button"
              >
                <FolderPlusIcon aria-hidden="true" />
                <span>Add folders Codex can read and edit</span>
              </button>
            ) : (
              <div className="project-create-dialog__folder-list">
                {sources.map((source, index) => (
                  <div className="project-create-dialog__folder" key={source}>
                    <Folder aria-hidden="true" />
                    <span title={source}>{folderName(source)}</span>
                    {sources.length > 1 && index === 0 && (
                      <small>Primary</small>
                    )}
                    <button
                      aria-label={`Remove ${folderName(source)}`}
                      onClick={() =>
                        setSources((items) =>
                          items.filter((item) => item !== source),
                        )
                      }
                      type="button"
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <button
                  className="project-create-dialog__add-folder"
                  onClick={() => void addSource()}
                  type="button"
                >
                  <FolderPlusIcon aria-hidden="true" />
                  <span>Add folder</span>
                </button>
              </div>
            )}
          </div>
          <div
            className={`project-create-dialog__footer${project ? " is-editing" : ""}`}
          >
            {project ? (
              <>
                <span>
                  {onRemove && (
                    <button
                      className="project-create-dialog__remove"
                      onClick={onRemove}
                      type="button"
                    >
                      Remove project
                    </button>
                  )}
                </span>
                <span>
                  <button
                    className="project-create-dialog__cancel"
                    onClick={onClose}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="project-create-dialog__create"
                    type="submit"
                  >
                    Save
                  </button>
                </span>
              </>
            ) : (
              <>
                <button
                  className="project-create-dialog__cancel"
                  onClick={onClose}
                  type="button"
                >
                  Cancel
                </button>
                <button className="project-create-dialog__create" type="submit">
                  Create project
                </button>
              </>
            )}
          </div>
        </form>
        <button
          aria-label="Close"
          className="project-create-dialog__close"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

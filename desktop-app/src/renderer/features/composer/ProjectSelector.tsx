import { ChevronDown, Folder } from "lucide-react";
import { useState } from "react";

import { useSession } from "../../state/session";
import { FolderPlusIcon } from "../../ui/AppIcons";
import { Menu, MenuItem } from "../../ui/Menu";

function displayFolder(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

export function ProjectSelector() {
  const { chooseProject, project } = useSession();
  const [open, setOpen] = useState(false);
  return (
    <div className="composer-control composer-control--project">
      <button onClick={() => setOpen((value) => !value)} type="button">
        <Folder aria-hidden="true" />
        <span>{project ? displayFolder(project) : "Add project"}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open && (
        <Menu label="Project" onDismiss={() => setOpen(false)}>
          <MenuItem
            onSelect={() => {
              setOpen(false);
              void chooseProject();
            }}
          >
            <FolderPlusIcon aria-hidden="true" />
            Open folder…
          </MenuItem>
        </Menu>
      )}
    </div>
  );
}

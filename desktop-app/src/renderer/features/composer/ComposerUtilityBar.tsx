import { ImagePlus, Plus } from "lucide-react";
import { useState } from "react";

import type { LocalAttachment } from "../../../shared/bridge";
import { IconButton } from "../../ui/IconButton";
import { Menu, MenuItem } from "../../ui/Menu";
import { EnvironmentMenu } from "./EnvironmentMenu";
import { PermissionsMenu } from "./PermissionsMenu";
import { ProjectSelector } from "./ProjectSelector";

export function ComposerUtilityBar({
  onAttach,
}: {
  onAttach(attachments: LocalAttachment[]): void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="composer-utility-bar">
      <span className="composer-add-menu">
        <IconButton
          icon={Plus}
          label="Add files and more"
          onClick={() => setOpen((value) => !value)}
          size="sm"
        />
        {open && (
          <Menu label="Add files and more" onDismiss={() => setOpen(false)}>
            <MenuItem
              onSelect={() => {
                setOpen(false);
                void window.chatgptDesktop.selectFiles().then(onAttach);
              }}
            >
              <ImagePlus aria-hidden="true" /> Add files
            </MenuItem>
          </Menu>
        )}
      </span>
      <ProjectSelector />
      <EnvironmentMenu />
      <PermissionsMenu />
    </div>
  );
}

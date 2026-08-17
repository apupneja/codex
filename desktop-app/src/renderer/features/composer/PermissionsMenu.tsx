import { ChevronDown, Shield, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { type PermissionMode, useSession } from "../../state/session";
import { Menu, MenuItem } from "../../ui/Menu";

const labels: Record<PermissionMode, string> = {
  ask: "Ask permission",
  full: "Full access",
  read: "Read only",
};

export function PermissionsMenu() {
  const { permissionMode, setPermissionMode } = useSession();
  const [open, setOpen] = useState(false);
  return (
    <div className="composer-control">
      <button onClick={() => setOpen((value) => !value)} type="button">
        <ShieldCheck aria-hidden="true" />
        <span>{labels[permissionMode]}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open && (
        <Menu label="Permissions" onDismiss={() => setOpen(false)}>
          {(["full", "ask", "read"] as PermissionMode[]).map((value) => (
            <MenuItem
              key={value}
              onSelect={() => {
                setPermissionMode(value);
                setOpen(false);
              }}
            >
              {value === "full" ? (
                <ShieldCheck aria-hidden="true" />
              ) : (
                <Shield aria-hidden="true" />
              )}
              {labels[value]}
            </MenuItem>
          ))}
        </Menu>
      )}
    </div>
  );
}

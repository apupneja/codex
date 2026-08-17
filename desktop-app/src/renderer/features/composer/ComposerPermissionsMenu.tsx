import { useRef, type KeyboardEvent } from "react";

import type { PermissionMode } from "../../state/session";
import {
  ApprovalWarningIcon,
  HandIcon,
  ModeCheckIcon,
} from "../../ui/AppIcons";
import { useDismissibleLayer } from "../../ui/useDismissibleLayer";

const PERMISSIONS_DOCUMENTATION_URL =
  "https://developers.openai.com/codex/security/";

export function ComposerPermissionsMenu({
  className,
  id,
  onDismiss,
  onSelect,
  permissionMode,
  showFullAccess = true,
}: {
  className?: string;
  id: string;
  onDismiss(): void;
  onSelect(mode: PermissionMode): void;
  permissionMode: PermissionMode;
  showFullAccess?: boolean;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useDismissibleLayer(menuRef, onDismiss);

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemradio"]:not(:disabled)',
      ),
    );
    if (!items.length) return;
    event.preventDefault();
    const currentIndex = items.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : currentIndex === -1
            ? event.key === "ArrowUp"
              ? items.length - 1
              : 0
            : event.key === "ArrowDown"
              ? (currentIndex + 1 + items.length) % items.length
              : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  return (
    <div
      aria-label="Permissions"
      className={`codex-permissions-menu${className ? ` ${className}` : ""}`}
      id={id}
      onKeyDown={moveFocus}
      ref={menuRef}
      role="menu"
    >
      <div className="codex-permissions-menu__heading">
        <span>How should ChatGPT actions be approved?</span>
        <button
          onClick={() =>
            void window.chatgptDesktop.openExternal(
              PERMISSIONS_DOCUMENTATION_URL,
            )
          }
          type="button"
        >
          Learn more
        </button>
      </div>
      <PermissionOption
        checked={permissionMode === "ask"}
        description="Always ask to edit external files and use the internet"
        icon={HandIcon}
        label="Ask for approval"
        onSelect={() => onSelect("ask")}
      />
      {showFullAccess && (
        <PermissionOption
          checked={permissionMode === "full"}
          description="Unrestricted access to the internet and any file on your computer"
          fullAccess
          icon={ApprovalWarningIcon}
          label="Full access"
          onSelect={() => onSelect("full")}
        />
      )}
    </div>
  );
}

function PermissionOption({
  checked,
  description,
  fullAccess = false,
  icon: Icon,
  label,
  onSelect,
}: {
  checked: boolean;
  description: string;
  fullAccess?: boolean;
  icon: typeof HandIcon;
  label: string;
  onSelect(): void;
}) {
  return (
    <button
      aria-checked={checked}
      className={`codex-permissions-menu__option${fullAccess ? " is-full-access" : ""}`}
      onClick={onSelect}
      role="menuitemradio"
      type="button"
    >
      <Icon aria-hidden="true" />
      <span className="codex-permissions-menu__copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      {checked && (
        <ModeCheckIcon
          aria-hidden="true"
          className="codex-permissions-menu__check"
        />
      )}
    </button>
  );
}

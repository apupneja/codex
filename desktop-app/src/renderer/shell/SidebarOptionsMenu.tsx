import { Ellipsis } from "lucide-react";
import { useRef, useState } from "react";

import { IconButton } from "../ui/IconButton";
import { ModeCheckIcon } from "../ui/AppIcons";
import { useDismissibleLayer } from "../ui/useDismissibleLayer";

type SidebarLayout = "list" | "project";
type SidebarSort = "manual" | "priority" | "updated_at";

function readSetting<T extends string>(key: string, fallback: T): T {
  const value = localStorage.getItem(key);
  return (value as T | null) ?? fallback;
}

export function SidebarOptionsMenu({ kind }: { kind: "chats" | "projects" }) {
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<SidebarLayout>(() =>
    readSetting("chatgpt.sidebar.layout", "project"),
  );
  const [sort, setSort] = useState<SidebarSort>(() =>
    readSetting(`chatgpt.sidebar.${kind}.sort`, "priority"),
  );
  const ref = useRef<HTMLSpanElement>(null);
  useDismissibleLayer(ref, () => setOpen(false), open);

  const selectLayout = (value: SidebarLayout) => {
    setLayout(value);
    localStorage.setItem("chatgpt.sidebar.layout", value);
    setOpen(false);
  };
  const selectSort = (value: SidebarSort) => {
    setSort(value);
    localStorage.setItem(`chatgpt.sidebar.${kind}.sort`, value);
    setOpen(false);
  };

  return (
    <span className="sidebar-options-anchor" ref={ref}>
      <IconButton
        aria-expanded={open}
        aria-haspopup="menu"
        icon={Ellipsis}
        label={
          kind === "projects"
            ? "Project sidebar options"
            : "Chat sidebar options"
        }
        onClick={() => setOpen((value) => !value)}
        size="sm"
      />
      {open && (
        <div className="sidebar-options-menu" role="menu">
          <span className="sidebar-options-menu__label">Organize sidebar</span>
          <SidebarRadio
            checked={layout === "project"}
            label="By project"
            onSelect={() => selectLayout("project")}
          />
          <SidebarRadio
            checked={layout === "list"}
            label="In one list"
            onSelect={() => selectLayout("list")}
          />
          <span className="sidebar-options-menu__label">Sort chats by</span>
          <SidebarRadio
            checked={sort === "priority"}
            label="Priority"
            onSelect={() => selectSort("priority")}
          />
          <SidebarRadio
            checked={sort === "updated_at"}
            label="Last updated"
            onSelect={() => selectSort("updated_at")}
          />
          <SidebarRadio
            checked={sort === "manual"}
            label="Manual order"
            onSelect={() => selectSort("manual")}
          />
        </div>
      )}
    </span>
  );
}

function SidebarRadio({
  checked,
  label,
  onSelect,
}: {
  checked: boolean;
  label: string;
  onSelect(): void;
}) {
  return (
    <button
      aria-checked={checked}
      className="sidebar-options-menu__item"
      onClick={onSelect}
      role="menuitemradio"
      type="button"
    >
      <span className="sidebar-options-menu__check">
        {checked && <ModeCheckIcon aria-hidden="true" />}
      </span>
      <span>{label}</span>
    </button>
  );
}

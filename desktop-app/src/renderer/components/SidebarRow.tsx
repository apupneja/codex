import type { ButtonHTMLAttributes, ReactNode } from "react";

type SidebarRowProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  icon?: ReactNode;
  label: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  variant: "navigation" | "repository" | "thread";
};

export function SidebarRow({
  className = "",
  icon,
  label,
  meta,
  trailing,
  type = "button",
  variant,
  ...props
}: SidebarRowProps) {
  return (
    <button
      className={`sidebar-row sidebar-row-${variant} ${className}`.trim()}
      type={type}
      {...props}
    >
      <span aria-hidden="true" className="sidebar-row-icon">
        {icon}
      </span>
      <span className="sidebar-row-label">{label}</span>
      {meta ? <span className="sidebar-row-meta">{meta}</span> : null}
      {trailing ? (
        <span aria-hidden="true" className="sidebar-row-trailing">
          {trailing}
        </span>
      ) : null}
    </button>
  );
}

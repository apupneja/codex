import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";

type MenuSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export const MenuSurface = forwardRef<HTMLDivElement, MenuSurfaceProps>(
  function MenuSurface({ children, className = "", ...props }, ref) {
    return (
      <div className={`ui-menu ${className}`.trim()} ref={ref} {...props}>
        {children}
      </div>
    );
  },
);

type MenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  destructive?: boolean;
};

export function MenuItem({
  children,
  className = "",
  destructive = false,
  type = "button",
  ...props
}: MenuItemProps) {
  return (
    <button
      className={`ui-menu-item ${destructive ? "destructive" : ""} ${className}`.trim()}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <span className="ui-menu-label">{children}</span>;
}

export function MenuSeparator() {
  return (
    <div aria-hidden="true" className="ui-menu-separator" role="separator" />
  );
}

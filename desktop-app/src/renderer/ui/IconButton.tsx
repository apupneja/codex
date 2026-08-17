import type { ButtonHTMLAttributes, ComponentType, SVGProps } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  shortcut?: string;
  size?: "sm" | "md";
};

export function IconButton({
  icon: Icon,
  label,
  shortcut,
  size = "md",
  className = "",
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`icon-button icon-button--${size} ${className}`}
      title={label}
      type="button"
      {...props}
    >
      <Icon aria-hidden="true" strokeWidth={1.8} />
      <span className="icon-button__tooltip" role="tooltip">
        <span>{label}</span>
        {shortcut && <kbd>{shortcut}</kbd>}
      </span>
    </button>
  );
}

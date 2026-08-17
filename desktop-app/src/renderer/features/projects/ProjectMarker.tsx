import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type {
  ProjectAppearance,
  ProjectColor,
  ProjectMarkerName,
} from "../../state/session";
import { ProjectMarkerGlyph } from "./ProjectMarkerGlyph";

export const DEFAULT_PROJECT_APPEARANCE: ProjectAppearance = {
  color: "black",
  marker: "folder",
};

const COLOR_OPTIONS: Array<{
  color: ProjectColor;
  label: string;
  swatch: string;
}> = [
  { color: "black", label: "Default", swatch: "#f4f4f4" },
  { color: "red", label: "Red", swatch: "#ff5b62" },
  { color: "orange", label: "Orange", swatch: "#ff824c" },
  { color: "yellow", label: "Yellow", swatch: "#ffc83d" },
  { color: "green", label: "Green", swatch: "#45c882" },
  { color: "blue", label: "Blue", swatch: "#379af3" },
  { color: "purple", label: "Purple", swatch: "#9867ed" },
  { color: "pink", label: "Pink", swatch: "#f579b4" },
];

const ICON_OPTIONS: Array<{
  label: string;
  marker: ProjectMarkerName;
}> = [
  { label: "Folder", marker: "folder" },
  { label: "Currency dollar", marker: "currency-dollar" },
  { label: "Book", marker: "book" },
  { label: "Graduation cap", marker: "graduation-cap" },
  { label: "Pencil", marker: "edit" },
  { label: "Writing", marker: "writing" },
  { label: "Code brackets", marker: "function" },
  { label: "Terminal", marker: "terminal" },
  { label: "Music", marker: "music" },
  { label: "Popcorn", marker: "popcorn" },
  { label: "Customize", marker: "customize" },
  { label: "Palette", marker: "palette" },
  { label: "Stethoscope", marker: "stethoscope" },
  { label: "Health", marker: "health" },
  { label: "Lotus", marker: "lotus" },
  { label: "Suitcase", marker: "suitcase" },
  { label: "Bar chart", marker: "bar-chart" },
  { label: "Kettlebell", marker: "kettlebell" },
  { label: "Dumbbell", marker: "dumbbell" },
  { label: "Notebook", marker: "logs" },
  { label: "Balancing scale", marker: "scale" },
  { label: "Globe Spin", marker: "desk-globe" },
  { label: "Plane", marker: "plane" },
  { label: "Globe", marker: "globe" },
  { label: "Wrench", marker: "wrench" },
  { label: "Paw", marker: "paw" },
  { label: "Flask", marker: "flask" },
  { label: "Brain", marker: "brain" },
  { label: "Heart", marker: "heart" },
  { label: "Plant", marker: "plant" },
];

function colorFor(color: ProjectColor): string {
  return (
    COLOR_OPTIONS.find((option) => option.color === color)?.swatch ?? "#f4f4f4"
  );
}

export function ProjectMarkerIcon({
  appearance = DEFAULT_PROJECT_APPEARANCE,
}: {
  appearance?: ProjectAppearance;
}) {
  return (
    <ProjectMarkerGlyph
      color={colorFor(appearance.color)}
      marker={appearance.marker}
    />
  );
}

export function ProjectMarkerPicker({
  appearance,
  onChange,
  projectName,
}: {
  appearance: ProjectAppearance;
  onChange(appearance: ProjectAppearance): void;
  projectName: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const openPicker = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const left = Math.min(
        window.innerWidth - 268,
        Math.max(8, rect.left + rect.width / 2 - 130),
      );
      setPosition({ left, top: rect.bottom + 6 });
    }
    setOpen((value) => !value);
  };

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Change marker for ${projectName}`}
        onClick={openPicker}
        ref={triggerRef}
        type="button"
      >
        <ProjectMarkerIcon appearance={appearance} />
      </button>
      {open &&
        createPortal(
          <div
            aria-label="Project marker"
            className="project-marker-popover"
            ref={popoverRef}
            role="dialog"
            style={position}
          >
            <div
              aria-label="Project color"
              className="project-marker-colors"
              role="group"
            >
              {COLOR_OPTIONS.map((option) => {
                const selected = appearance.color === option.color;
                return (
                  <button
                    aria-label={`Use ${option.label}`}
                    aria-pressed={selected}
                    key={option.color}
                    onClick={() =>
                      onChange({ ...appearance, color: option.color })
                    }
                    type="button"
                  >
                    <span className={selected ? "is-selected" : undefined}>
                      <span style={{ background: option.swatch }} />
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="project-marker-divider" />
            <div
              aria-label="Project icon"
              className="project-marker-icons"
              role="group"
            >
              {ICON_OPTIONS.map((option) => {
                return (
                  <button
                    aria-label={`Use ${option.label}`}
                    aria-pressed={appearance.marker === option.marker}
                    className={
                      appearance.marker === option.marker
                        ? "is-selected"
                        : undefined
                    }
                    key={option.marker}
                    onClick={() =>
                      onChange({ ...appearance, marker: option.marker })
                    }
                    style={{ color: colorFor(appearance.color) }}
                    type="button"
                  >
                    <ProjectMarkerGlyph marker={option.marker} />
                  </button>
                );
              })}
            </div>
            <div className="project-marker-footer">
              <button onClick={() => setOpen(false)} type="button">
                Done
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

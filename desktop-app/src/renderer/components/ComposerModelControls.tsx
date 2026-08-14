import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { useRef, useState } from "react";

import type { DesktopPreferences, Model } from "../../shared/types";
import {
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuSurface,
  usePopoverPlacement,
  useDismissibleLayer,
} from "../design-system";

type ComposerModelControlsProps = {
  compact?: boolean;
  disabled?: boolean;
  models: Model[];
  onOpenChange(open: boolean): void;
  open: boolean;
  preferences: DesktopPreferences;
  updatePreferences(
    patch: Partial<DesktopPreferences>,
  ): Promise<DesktopPreferences>;
};

function effortLabel(effort: string): string {
  const labels: Record<string, string> = {
    none: "None",
    minimal: "Minimal",
    low: "Fast",
    medium: "Balanced",
    high: "High",
    xhigh: "Extra High",
    max: "Maximum",
    ultra: "Ultra",
  };
  return (
    labels[effort] ??
    effort.replace(/[-_]/g, " ").replace(/^./, (value) => value.toUpperCase())
  );
}

function supportedEfforts(model: Model | undefined) {
  return model?.supportedReasoningEfforts?.length
    ? model.supportedReasoningEfforts
    : [
        { reasoningEffort: "low", description: "Fast" },
        { reasoningEffort: "medium", description: "Balanced" },
        { reasoningEffort: "high", description: "Deep reasoning" },
      ];
}

type ModelSubmenu = "model" | "effort" | null;

function effortDisplayLabel(effort: string): string {
  return effortLabel(effort);
}

export function ComposerModelControls({
  compact = false,
  disabled = false,
  models,
  onOpenChange,
  open,
  preferences,
  updatePreferences,
}: ComposerModelControlsProps) {
  const selectedModel =
    models.find((model) => model.id === preferences.selectedModel) ??
    models.find((model) => model.isDefault) ??
    models[0];
  const effortOptions = supportedEfforts(selectedModel);
  const effectiveEffort = effortOptions.some(
    (option) => option.reasoningEffort === preferences.selectedEffort,
  )
    ? preferences.selectedEffort
    : (selectedModel?.defaultReasoningEffort ??
      effortOptions[0]?.reasoningEffort ??
      "medium");
  const [submenu, setSubmenu] = useState<ModelSubmenu>(null);
  const root = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const placement = usePopoverPlacement({
    open,
    popoverRef: menuRef,
    triggerRef: root,
  });

  useDismissibleLayer({
    active: open,
    layerRef: root,
    onDismiss: () => {
      onOpenChange(false);
      setSubmenu(null);
    },
  });

  function closeMenu(): void {
    onOpenChange(false);
    setSubmenu(null);
  }

  function chooseModel(model: Model): void {
    const modelEfforts = supportedEfforts(model);
    const nextEffort = modelEfforts.some(
      (option) => option.reasoningEffort === effectiveEffort,
    )
      ? effectiveEffort
      : (model.defaultReasoningEffort ??
        modelEfforts[0]?.reasoningEffort ??
        "medium");
    void updatePreferences({
      selectedEffort: nextEffort,
      selectedModel: model.id,
    });
    closeMenu();
  }

  function chooseEffort(effort: string): void {
    if (!selectedModel) return;
    void updatePreferences({
      selectedEffort: effort,
      selectedModel: selectedModel.id,
    });
    closeMenu();
  }

  function resetToDefault(): void {
    const defaultModel = models.find((model) => model.isDefault) ?? models[0];
    if (!defaultModel) return;
    const defaultEfforts = supportedEfforts(defaultModel);
    void updatePreferences({
      selectedEffort:
        defaultModel.defaultReasoningEffort ??
        defaultEfforts[0]?.reasoningEffort ??
        "medium",
      selectedModel: defaultModel.id,
    });
    closeMenu();
  }

  const selectedModelLabel = selectedModel?.displayName ?? "Choose model";
  const selectedEffortLabel = selectedModel
    ? effortDisplayLabel(effectiveEffort)
    : "Balanced";

  return (
    <div
      className={`composer-model-controls ${compact ? "compact" : ""}`}
      ref={root}
    >
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Model"
        className="composer-model-trigger"
        disabled={disabled || models.length === 0}
        onClick={() => {
          onOpenChange(!open);
          setSubmenu(null);
        }}
        type="button"
      >
        <span className="composer-model-trigger-name">
          {selectedModelLabel}
        </span>
        <span className="composer-model-trigger-effort">
          {selectedEffortLabel}
        </span>
        <ChevronDown aria-hidden="true" size={12} />
      </button>
      {open ? (
        <MenuSurface
          aria-label="Model configuration"
          className="composer-model-menu"
          data-placement={placement}
          role="menu"
          ref={menuRef}
        >
          {submenu === "model" ? (
            <>
              <MenuItem
                aria-label="Back to model configuration"
                className="composer-model-menu-back"
                onClick={() => setSubmenu(null)}
                role="menuitem"
              >
                <ChevronLeft aria-hidden="true" size={14} />
                <MenuLabel>Model</MenuLabel>
              </MenuItem>
              {models.map((model) => (
                <MenuItem
                  aria-checked={model.id === selectedModel?.id}
                  className="composer-model-option"
                  key={model.id}
                  onClick={() => chooseModel(model)}
                  role="menuitemradio"
                >
                  <span>{model.displayName}</span>
                  <Check
                    aria-hidden="true"
                    className={model.id === selectedModel?.id ? "selected" : ""}
                    size={13}
                  />
                </MenuItem>
              ))}
            </>
          ) : submenu === "effort" ? (
            <>
              <MenuItem
                aria-label="Back to model configuration"
                className="composer-model-menu-back"
                onClick={() => setSubmenu(null)}
                role="menuitem"
              >
                <ChevronLeft aria-hidden="true" size={14} />
                <MenuLabel>Effort</MenuLabel>
              </MenuItem>
              {effortOptions.map((option) => (
                <MenuItem
                  aria-checked={option.reasoningEffort === effectiveEffort}
                  className="composer-model-option"
                  key={option.reasoningEffort}
                  onClick={() => chooseEffort(option.reasoningEffort)}
                  role="menuitemradio"
                >
                  <span>
                    {option.description || effortLabel(option.reasoningEffort)}
                  </span>
                  <Check
                    aria-hidden="true"
                    className={
                      option.reasoningEffort === effectiveEffort
                        ? "selected"
                        : ""
                    }
                    size={13}
                  />
                </MenuItem>
              ))}
            </>
          ) : (
            <>
              <MenuItem
                aria-haspopup="menu"
                aria-expanded={submenu === "model"}
                className="composer-model-menu-row"
                onClick={() => setSubmenu("model")}
                role="menuitem"
              >
                <span>Model</span>
                <strong>{selectedModelLabel}</strong>
                <ChevronRight aria-hidden="true" size={14} />
              </MenuItem>
              <MenuItem
                aria-haspopup="menu"
                aria-expanded={submenu === "effort"}
                className="composer-model-menu-row"
                onClick={() => setSubmenu("effort")}
                role="menuitem"
              >
                <span>Effort</span>
                <strong>{selectedEffortLabel}</strong>
                <ChevronRight aria-hidden="true" size={14} />
              </MenuItem>
              <MenuItem
                aria-disabled="true"
                className="composer-model-menu-row is-disabled"
                disabled
                role="menuitem"
              >
                <span>Speed</span>
                <strong>Standard</strong>
                <ChevronRight aria-hidden="true" size={14} />
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                className="composer-model-reset"
                onClick={resetToDefault}
                role="menuitem"
              >
                <span>Reset to default</span>
                <RotateCcw aria-hidden="true" size={14} />
              </MenuItem>
            </>
          )}
        </MenuSurface>
      ) : null}
    </div>
  );
}

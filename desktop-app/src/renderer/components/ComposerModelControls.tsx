import type { DesktopPreferences, Model } from "../../shared/types";
import { Select } from "../design-system";

type ComposerModelControlsProps = {
  compact?: boolean;
  models: Model[];
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
    high: "Deep",
    xhigh: "Max",
    max: "Maximum",
    ultra: "Ultra",
  };
  return (
    labels[effort] ??
    effort.replace(/[-_]/g, " ").replace(/^./, (value) => value.toUpperCase())
  );
}

export function ComposerModelControls({
  compact = false,
  models,
  preferences,
  updatePreferences,
}: ComposerModelControlsProps) {
  const selectedModel =
    models.find((model) => model.id === preferences.selectedModel) ??
    models.find((model) => model.isDefault) ??
    models[0];
  const effortOptions = selectedModel?.supportedReasoningEfforts?.length
    ? selectedModel.supportedReasoningEfforts
    : [
        { reasoningEffort: "low", description: "Fast" },
        { reasoningEffort: "medium", description: "Balanced" },
        { reasoningEffort: "high", description: "Deep reasoning" },
      ];
  const effectiveEffort = effortOptions.some(
    (option) => option.reasoningEffort === preferences.selectedEffort,
  )
    ? preferences.selectedEffort
    : (selectedModel?.defaultReasoningEffort ??
      effortOptions[0]?.reasoningEffort ??
      "medium");

  return (
    <div
      className={`composer-model-controls ${compact ? "compact" : ""}`}
    >
      <Select
        aria-label="Model"
        className="composer-model-select"
        onChange={(selectedModelId) => {
          const nextModel = models.find(
            (model) => model.id === selectedModelId,
          );
          const supportsCurrent =
            nextModel?.supportedReasoningEfforts.some(
              (option) =>
                option.reasoningEffort === preferences.selectedEffort,
            ) ?? true;
          void updatePreferences({
            selectedModel: selectedModelId,
            ...(!supportsCurrent && nextModel
              ? { selectedEffort: nextModel.defaultReasoningEffort }
              : {}),
          });
        }}
        options={models.map((model) => ({
          label: model.displayName,
          value: model.id,
        }))}
        value={selectedModel?.id ?? ""}
      />
      <Select
        aria-label="Reasoning effort"
        className="composer-effort-select"
        onChange={(selectedEffort) =>
          void updatePreferences({ selectedEffort })
        }
        options={effortOptions.map((option) => ({
          label: effortLabel(option.reasoningEffort),
          value: option.reasoningEffort,
        }))}
        value={effectiveEffort}
      />
    </div>
  );
}

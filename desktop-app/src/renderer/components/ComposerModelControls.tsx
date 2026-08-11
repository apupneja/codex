import type { DesktopPreferences, Model } from "../../shared/types";
import { Select } from "../design-system";

type ComposerModelControlsProps = {
  compact?: boolean;
  disabled?: boolean;
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

function supportedEfforts(model: Model | undefined) {
  return model?.supportedReasoningEfforts?.length
    ? model.supportedReasoningEfforts
    : [
        { reasoningEffort: "low", description: "Fast" },
        { reasoningEffort: "medium", description: "Balanced" },
        { reasoningEffort: "high", description: "Deep reasoning" },
      ];
}

const MODEL_CONFIGURATION_SEPARATOR = "\0";

export function ComposerModelControls({
  compact = false,
  disabled = false,
  models,
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

  const options = models.flatMap((model) =>
    supportedEfforts(model).map((option) => ({
      description: option.description,
      label: `${model.displayName} ${effortLabel(option.reasoningEffort)}`,
      value: `${model.id}${MODEL_CONFIGURATION_SEPARATOR}${option.reasoningEffort}`,
    })),
  );
  const selectedValue = selectedModel
    ? `${selectedModel.id}${MODEL_CONFIGURATION_SEPARATOR}${effectiveEffort}`
    : "";

  return (
    <div className={`composer-model-controls ${compact ? "compact" : ""}`}>
      <Select
        aria-label="Model"
        className="composer-model-select"
        disabled={disabled}
        onChange={(configuration) => {
          const [selectedModel, selectedEffort] = configuration.split(
            MODEL_CONFIGURATION_SEPARATOR,
          );
          if (!selectedModel || !selectedEffort) return;
          void updatePreferences({ selectedEffort, selectedModel });
        }}
        options={options}
        value={selectedValue}
      />
    </div>
  );
}

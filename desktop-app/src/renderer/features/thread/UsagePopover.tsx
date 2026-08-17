import { Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ThreadUsageIcon } from "../../ui/AppIcons";

import { useSession } from "../../state/session";

type UsageDimension = "model" | "reasoning_effort" | "speed";

type ThreadUsageGroup = {
  cachedInputTokens?: number | null;
  creditsMicros: number;
  model?: string | null;
  netNewInputTokens?: number | null;
  outputTokens?: number | null;
  reasoning_effort?: string | null;
  speed?: string | null;
};

type ThreadUsage = {
  costUsd: number | null;
  creditsUsed: number;
  groups: ThreadUsageGroup[];
};

type UsageEntry = {
  creditsMicros: number;
  value: string | null;
};

const eligiblePlans = new Set([
  "pro",
  "chatgpt_pro",
  "business",
  "enterprise_cbp_usage_based",
  "enterprise_cbp_automation",
]);

const reasoningOrder = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
];
const speedOrder = ["fast", "ultrafast", "standard"];

function isUsageEligible(planType: string | undefined) {
  if (!planType) return false;
  const normalized = planType.toLocaleLowerCase().replace(/[ -]+/g, "_");
  return eligiblePlans.has(normalized) || normalized.endsWith("_business");
}

function readUsage(threadId: string): ThreadUsage | null {
  try {
    const value = localStorage.getItem(`chatgpt.thread-usage.${threadId}`);
    if (!value) return null;
    const usage = JSON.parse(value) as Partial<ThreadUsage>;
    if (typeof usage.creditsUsed !== "number" || !Array.isArray(usage.groups)) {
      return null;
    }
    return {
      costUsd: typeof usage.costUsd === "number" ? usage.costUsd : null,
      creditsUsed: usage.creditsUsed,
      groups: usage.groups.filter(
        (group): group is ThreadUsageGroup =>
          typeof group === "object" &&
          group !== null &&
          typeof group.creditsMicros === "number",
      ),
    };
  } catch {
    return null;
  }
}

function entriesFor(usage: ThreadUsage, dimension: UsageDimension) {
  const entries = new Map<string | null, UsageEntry>();
  for (const group of usage.groups) {
    if (group.creditsMicros <= 0) continue;
    const value = group[dimension] ?? null;
    const entry = entries.get(value);
    if (entry) entry.creditsMicros += group.creditsMicros;
    else entries.set(value, { creditsMicros: group.creditsMicros, value });
  }
  const order =
    dimension === "reasoning_effort"
      ? reasoningOrder
      : dimension === "speed"
        ? speedOrder
        : null;
  return [...entries.values()].sort((left, right) => {
    if (!order) return right.creditsMicros - left.creditsMicros;
    const leftIndex = order.indexOf(left.value ?? "");
    const rightIndex = order.indexOf(right.value ?? "");
    return (
      (leftIndex < 0 ? order.length : leftIndex) -
      (rightIndex < 0 ? order.length : rightIndex)
    );
  });
}

function modelLabel(value: string) {
  return value
    .split("-")
    .map((part) => {
      if (part.toLocaleLowerCase() === "gpt") return "GPT";
      if (part.toLocaleLowerCase() === "codex") return "Codex";
      return part;
    })
    .join("-")
    .replace(/-(Codex)$/, " $1");
}

function usageLabel(dimension: UsageDimension, value: string | null) {
  if (value == null) return "Other";
  if (dimension === "model") return modelLabel(value);
  if (dimension === "speed") {
    if (value === "fast") return "Fast mode";
    if (value === "ultrafast") return "Ultrafast";
    if (value === "standard") return "Standard";
  }
  const reasoningLabels: Record<string, string> = {
    high: "High",
    low: "Light",
    max: "Max",
    medium: "Medium",
    minimal: "Minimal",
    none: "None",
    ultra: "Ultra",
    xhigh: "Extra High",
  };
  return reasoningLabels[value] ?? value;
}

function Breakdown({
  dimension,
  usage,
}: {
  dimension: UsageDimension;
  usage: ThreadUsage;
}) {
  const entries = entriesFor(usage, dimension);
  const total = entries.reduce((sum, entry) => sum + entry.creditsMicros, 0);
  const label =
    dimension === "model"
      ? "Model"
      : dimension === "reasoning_effort"
        ? "Reasoning"
        : "Speed";

  if (!total) {
    return (
      <div className="thread-usage-breakdown__row">
        <span>{label}</span>
        <span>Not available</span>
      </div>
    );
  }

  return (
    <div className="thread-usage-breakdown__group">
      {entries.map((entry, index) => (
        <div
          className="thread-usage-breakdown__row"
          key={entry.value ?? "other"}
        >
          <span>{index === 0 ? label : ""}</span>
          <span>{usageLabel(dimension, entry.value)}</span>
          <strong>
            {new Intl.NumberFormat("en-US", {
              maximumSignificantDigits: 2,
              style: "percent",
            }).format(entry.creditsMicros / total)}
          </strong>
        </div>
      ))}
    </div>
  );
}

export function UsagePopover({
  onOpenSettings,
  threadId,
}: {
  onOpenSettings(): void;
  threadId: string;
}) {
  const { account } = useSession();
  const [open, setOpen] = useState(false);
  const usage = useMemo(() => readUsage(threadId), [threadId, open]);
  const eligible = isUsageEligible(account?.planType);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest(".thread-usage")) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", dismiss);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", dismiss);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!eligible) return null;

  const total = usage
    ? usage.costUsd == null
      ? `${usage.creditsUsed.toLocaleString("en-US")} credits`
      : `${usage.creditsUsed.toLocaleString("en-US")} credits used · Est. ${usage.costUsd.toLocaleString(
          "en-US",
          {
            currency: "USD",
            maximumFractionDigits: usage.costUsd < 0.01 ? 4 : 2,
            style: "currency",
          },
        )}`
    : "Not available";

  return (
    <div className="thread-usage">
      <button
        aria-expanded={open}
        aria-label="View chat usage"
        className="thread-usage__trigger"
        onClick={() => setOpen((value) => !value)}
        title="View chat usage"
        type="button"
      >
        <ThreadUsageIcon aria-hidden="true" />
      </button>
      {open && (
        <div className="thread-usage__menu" role="menu">
          <div className="thread-usage__summary">
            <strong>Usage</strong>
            <span>{total}</span>
          </div>
          {usage && (
            <>
              <div className="thread-usage__separator" role="separator" />
              <div className="thread-usage-breakdown">
                <Breakdown dimension="model" usage={usage} />
                <Breakdown dimension="reasoning_effort" usage={usage} />
                <Breakdown dimension="speed" usage={usage} />
              </div>
            </>
          )}
          <div className="thread-usage__separator" role="separator" />
          <button
            className="thread-usage__settings"
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
            role="menuitem"
            type="button"
          >
            <Settings aria-hidden="true" />
            <span>Usage settings</span>
          </button>
        </div>
      )}
    </div>
  );
}

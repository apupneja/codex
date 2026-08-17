const fontSizes = {
  "--font-size-body": 13,
  "--font-size-caption": 10,
  "--font-size-content-display": 28,
  "--font-size-content-heading": 20,
  "--font-size-control": 12,
  "--font-size-display": 18,
  "--font-size-heading": 17,
  "--font-size-hero": 24,
  "--font-size-label": 14,
  "--font-size-meta": 11,
  "--font-size-prose": 16,
  "--font-size-title": 15,
} as const;

function numberPreference(
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number.parseFloat(localStorage.getItem(key) ?? "");
  return Number.isNaN(parsed)
    ? fallback
    : Math.min(maximum, Math.max(minimum, parsed));
}

export function applyUiFontSize(value: number): void {
  const root = document.documentElement;
  const scale = value / 14;
  root.style.setProperty("--vscode-font-size", `${value}px`);
  for (const [property, base] of Object.entries(fontSizes)) {
    root.style.setProperty(property, `${Math.round(base * scale)}px`);
  }
}

export function applyCodeFontSize(value: number): void {
  document.documentElement.style.setProperty("--code-font-size", `${value}px`);
}

export function applyFontSmoothing(enabled: boolean): void {
  document.documentElement.style.setProperty(
    "--font-smoothing",
    enabled ? "antialiased" : "auto",
  );
}

export function applyPointerCursorPreference(enabled: boolean): void {
  document.documentElement.classList.toggle("use-pointer-cursors", enabled);
}

export function applyReducedMotionPreference(value: string): void {
  document.documentElement.classList.toggle("reduce-motion", value === "On");
  document.documentElement.classList.toggle("allow-motion", value === "Off");
}

export function applyStoredAppearancePreferences(): void {
  applyUiFontSize(numberPreference("appearance-ui-font-size", 14, 11, 16));
  applyCodeFontSize(numberPreference("appearance-code-font-size", 12, 8, 24));
  applyFontSmoothing(
    localStorage.getItem("appearance-font-smoothing") !== "false",
  );
  applyPointerCursorPreference(
    localStorage.getItem("appearance-use-pointer-cursors") === "true",
  );
  applyReducedMotionPreference(
    localStorage.getItem("appearance-reduce-motion") ?? "System",
  );
}

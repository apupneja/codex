const MONO_FALLBACK =
  'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace';

export function cssToken(name: `--${string}`, fallback: string): string {
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name);
  return value.trim() || fallback;
}

export function monospaceFontFamily(): string {
  return cssToken("--font-mono", MONO_FALLBACK);
}

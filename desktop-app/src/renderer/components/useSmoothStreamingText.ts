import { useEffect, useRef, useState } from "react";

const STREAM_FRAME_MS = 24;

type StreamState = {
  key: string;
  text: string;
};

function nextStreamingText(current: string, target: string): string {
  if (!target.startsWith(current)) return target;
  const remaining = target.length - current.length;
  if (remaining <= 0) return current;
  const chunkSize =
    remaining > 240
      ? Math.ceil(remaining / 8)
      : remaining > 80
        ? 12
        : remaining > 24
          ? 6
          : 2;
  let end = Math.min(target.length, current.length + chunkSize);
  const lastCodeUnit = target.charCodeAt(end - 1);
  if (lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) end += 1;
  return target.slice(0, end);
}

export function useSmoothStreamingText(target: string, key: string) {
  const targetRef = useRef({ key, text: target });
  targetRef.current = { key, text: target };
  const [state, setState] = useState<StreamState>({ key, text: target });
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const displayedText = state.key === key ? state.text : target;
  const settled = displayedText === target;

  useEffect(() => {
    if (reducedMotion) {
      setState({ key, text: target });
      return;
    }
    setState((current) =>
      current.key === key && target.startsWith(current.text)
        ? current
        : { key, text: target },
    );
  }, [key, reducedMotion, target]);

  useEffect(() => {
    if (reducedMotion || settled) return;
    const timer = window.setInterval(() => {
      setState((current) => {
        const nextTarget = targetRef.current;
        if (current.key !== nextTarget.key) return nextTarget;
        const text = nextStreamingText(current.text, nextTarget.text);
        return text === current.text ? current : { ...current, text };
      });
    }, STREAM_FRAME_MS);
    return () => window.clearInterval(timer);
  }, [key, reducedMotion, settled]);

  return {
    displayedText,
    settled,
  };
}

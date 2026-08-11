import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { EmbeddedBrowserState } from "../../shared/types";

const EMPTY_BROWSER_STATE: EmbeddedBrowserState = {
  canGoBack: false,
  canGoForward: false,
  error: null,
  loading: false,
  title: "Browser",
  url: "",
};

type EmbeddedBrowserProps = {
  initialUrl: string | null;
  onReady(): void;
  onStateChange?(state: EmbeddedBrowserState): void;
  visible: boolean;
};

export function EmbeddedBrowser({
  initialUrl,
  onReady,
  onStateChange,
  visible,
}: EmbeddedBrowserProps) {
  const [state, setState] = useState(EMPTY_BROWSER_STATE);
  const [draft, setDraft] = useState(initialUrl ?? "https://www.google.com");
  const [initializing, setInitializing] = useState(false);
  const addressFocused = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = (next: EmbeddedBrowserState) => {
      setState(next);
      onStateChange?.(next);
      if (!addressFocused.current && next.url) setDraft(next.url);
    };
    return window.codexDesktop.onEmbeddedBrowserState(update);
  }, [onStateChange]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setInitializing(true);
    void window.codexDesktop
      .ensureEmbeddedBrowser(initialUrl ?? undefined)
      .then((next) => {
        if (cancelled) return;
        setState(next);
        onStateChange?.(next);
        if (!addressFocused.current && next.url) setDraft(next.url);
      })
      .catch((error) => {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          error: error instanceof Error ? error.message : String(error),
        }));
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialUrl, onStateChange, visible]);

  useEffect(() => {
    if (visible && state.url && !state.loading && !state.error) onReady();
  }, [onReady, state.error, state.loading, state.url, visible]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!visible || !viewport) {
      void window.codexDesktop
        .setEmbeddedBrowserBounds(null)
        .catch(() => undefined);
      return;
    }

    let frame = 0;
    const updateBounds = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const bounds = viewport.getBoundingClientRect();
        void window.codexDesktop
          .setEmbeddedBrowserBounds({
            height: bounds.height,
            width: bounds.width,
            x: bounds.x,
            y: bounds.y,
          })
          .catch(() => undefined);
      });
    };
    const observer = new ResizeObserver(updateBounds);
    observer.observe(viewport);
    window.addEventListener("resize", updateBounds);
    updateBounds();
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", updateBounds);
      void window.codexDesktop
        .setEmbeddedBrowserBounds(null)
        .catch(() => undefined);
    };
  }, [visible]);

  async function navigate(): Promise<void> {
    setInitializing(true);
    try {
      const next = await window.codexDesktop.navigateEmbeddedBrowser(draft);
      setState(next);
      onStateChange?.(next);
      if (next.url) setDraft(next.url);
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setInitializing(false);
    }
  }

  async function performAction(
    action: "back" | "forward" | "reload" | "stop",
  ): Promise<void> {
    try {
      const next =
        await window.codexDesktop.performEmbeddedBrowserAction(action);
      setState(next);
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  return (
    <div className="embedded-browser">
      <div className="embedded-browser-toolbar">
        <button
          aria-label="Go back"
          disabled={!state.canGoBack}
          onClick={() => void performAction("back")}
          title="Back"
        >
          <ArrowLeft size={15} />
        </button>
        <button
          aria-label="Go forward"
          disabled={!state.canGoForward}
          onClick={() => void performAction("forward")}
          title="Forward"
        >
          <ArrowRight size={15} />
        </button>
        <button
          aria-label={state.loading ? "Stop loading" : "Reload"}
          onClick={() => void performAction(state.loading ? "stop" : "reload")}
          title={state.loading ? "Stop" : "Reload"}
        >
          {state.loading ? <X size={14} /> : <RefreshCw size={14} />}
        </button>
        <form
          className="embedded-browser-address"
          onSubmit={(event) => {
            event.preventDefault();
            void navigate();
          }}
        >
          <input
            aria-label="Browser address or search"
            autoCapitalize="none"
            autoCorrect="off"
            onBlur={() => {
              addressFocused.current = false;
              if (state.url) setDraft(state.url);
            }}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={() => {
              addressFocused.current = true;
            }}
            placeholder="Search or enter URL"
            spellCheck={false}
            value={draft}
          />
        </form>
        {state.loading || initializing ? (
          <LoaderCircle className="spin embedded-browser-progress" size={14} />
        ) : null}
        <button
          aria-label="Open in default browser"
          disabled={!state.url}
          onClick={() => {
            if (state.url) {
              void window.codexDesktop.openExternal(state.url).catch((error) =>
                setState((current) => ({
                  ...current,
                  error: error instanceof Error ? error.message : String(error),
                })),
              );
            }
          }}
          title="Open in default browser"
        >
          <ExternalLink size={14} />
        </button>
      </div>
      {state.error ? (
        <div className="embedded-browser-error" role="alert">
          {state.error}
        </div>
      ) : null}
      <div
        className="embedded-browser-viewport"
        data-ready={
          state.url && !state.loading && !state.error ? "true" : "false"
        }
        ref={viewportRef}
      >
        {!state.url && (initializing || state.loading) ? (
          <div className="panel-empty">
            <LoaderCircle className="spin" size={18} /> Opening browser…
          </div>
        ) : null}
      </div>
    </div>
  );
}

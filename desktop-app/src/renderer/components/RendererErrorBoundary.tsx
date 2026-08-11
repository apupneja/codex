import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

type RendererErrorBoundaryProps = {
  children: ReactNode;
};

type RendererErrorBoundaryState = {
  error: Error | null;
};

export class RendererErrorBoundary extends Component<
  RendererErrorBoundaryProps,
  RendererErrorBoundaryState
> {
  state: RendererErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): RendererErrorBoundaryState {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Codex renderer crashed", error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="renderer-error" role="alert">
        <AlertTriangle aria-hidden="true" size={24} />
        <strong>Codex hit a rendering error</strong>
        <p>
          Your task may still be running. Reload the window to reconnect to it.
        </p>
        <details>
          <summary>Error details</summary>
          <code>{error.message}</code>
        </details>
        <button
          className="button-primary"
          onClick={() => window.location.reload()}
        >
          <RotateCcw aria-hidden="true" size={14} /> Reload window
        </button>
      </main>
    );
  }
}

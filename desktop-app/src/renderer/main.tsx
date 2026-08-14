import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { RendererErrorBoundary } from "./components/RendererErrorBoundary";
import "./design-system/tokens.css";
import "./design-system/foundation.css";
import "./styles/shell-base.css";
import "./styles/sidebar.css";
import "./styles/headers.css";
import "./styles/new-task.css";
import "./styles/composer.css";
import "./styles/conversation.css";
import "./styles/environment-panel.css";
import "./styles/workspace.css";
import "./styles/editor.css";
import "./styles/utility.css";
import "./styles/overlays.css";
import "./styles/customize.css";
import "./styles/settings-shell.css";
import "./styles/settings-content.css";
import "./design-system/components.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <StrictMode>
    <RendererErrorBoundary>
      <App />
    </RendererErrorBoundary>
  </StrictMode>,
);
document.getElementById("bootstrap-fallback")?.remove();

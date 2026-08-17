import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./app/App";
import "./design-system/tokens.css";
import "./design-system/foundation.css";
import "./design-system/components.css";
import "./ui/ui.css";
import "./shell/shell.css";
import "./features/composer/composer.css";
import "./features/home/home.css";
import "./features/thread/thread.css";
import "./features/panels/panels.css";
import "./features/pages/pages.css";
import "./features/settings/settings.css";
import "./features/settings/pet-assets.css";
import "./app/app.css";

const root = document.getElementById("root");
if (!root) throw new Error("Renderer root not found");

const search = new URLSearchParams(window.location.search);
const petSurface = search.get("surface") === "pet";
const pet = /^[a-z0-9-]+$/.test(search.get("pet") ?? "")
  ? search.get("pet")!
  : "codex";

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {petSurface ? (
      <div aria-label={`${pet} pet`} className="pet-overlay-surface">
        <span className={`pet-overlay-surface__pet pet-avatar--${pet}`} />
      </div>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);

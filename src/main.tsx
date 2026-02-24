import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { loadEmbedConfig } from "./embed-config";
import { initPortalTheme } from "./portal-theme";

if (typeof window !== "undefined") {
  loadEmbedConfig();
  initPortalTheme();
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
// Base styles first, so component styles (imported by App) can override them.
import "./styles/base.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

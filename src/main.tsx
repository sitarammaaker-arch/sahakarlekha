import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { reportWebVitals, installErrorTracking } from "./lib/vitals";

createRoot(document.getElementById("root")!).render(<App />);

// GOS-21: Core Web Vitals + runtime errors → GA4 (fire-and-forget; no-op if gtag absent).
installErrorTracking();
reportWebVitals();

// G1 (OPS-01): define missing built-ins for older browsers BEFORE anything else evaluates.
import "./polyfills";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { reportWebVitals, installErrorTracking } from "./lib/vitals";
import { initConnectivityListeners } from "./lib/connectivity/writeBlock";

// F1: browser online/offline → read-only banner + entry guard (online-only policy).
initConnectivityListeners();

createRoot(document.getElementById("root")!).render(<App />);

// GOS-21: Core Web Vitals + runtime errors → GA4 (fire-and-forget; no-op if gtag absent).
installErrorTracking();
reportWebVitals();

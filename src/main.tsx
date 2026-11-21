// G1 (OPS-01): define missing built-ins for older browsers BEFORE anything else evaluates.
import "./polyfills";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { reportWebVitals, installErrorTracking } from "./lib/vitals";
import { initConnectivityListeners } from "./lib/connectivity/writeBlock";
import { captureStaticSnapshot } from "./lib/staticSnapshot";
import { setExportFailureNotifier } from "./lib/exportUtils";
import { toast } from "./hooks/use-toast";

// F1: browser online/offline → read-only banner + entry guard (online-only policy).
initConnectivityListeners();

// PERF-02: Excel export loads SheetJS on demand — a failed load or build must be said out loud, not lost in the console.
setExportFailureNotifier((detail) => {
  const hi = !document.documentElement.lang.startsWith("en");
  toast({
    title: hi ? "Excel फ़ाइल नहीं बनी" : "Could not make the Excel file",
    description: detail === "load"
      ? (hi ? "Excel बनाने वाला हिस्सा लोड नहीं हुआ — internet देखें और पेज refresh (F5) करके फिर से कोशिश करें।" : "The Excel part of the app did not load — check the internet, refresh the page (F5) and try again.")
      : (hi ? "फ़ाइल बनाते समय गड़बड़ी हुई — दोबारा कोशिश करें। बार-बार हो तो Feedback से बताएँ।" : "Something went wrong while making the file — please try again. If it keeps happening, tell us via Feedback."),
    variant: "destructive",
    duration: 10000,
  });
});

// Keep the prerendered body for this URL so loading states can show it instead of a blank spinner.
const rootEl = document.getElementById("root")!;
captureStaticSnapshot(rootEl);
createRoot(rootEl).render(<App />);

// GOS-21: Core Web Vitals + runtime errors → GA4 (fire-and-forget; no-op if gtag absent).
installErrorTracking();
reportWebVitals();

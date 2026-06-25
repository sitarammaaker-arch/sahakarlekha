/**
 * Google Analytics (GA4) for the SPA. The gtag.js loader lives in index.html and
 * is configured with `send_page_view: false`, so this hook is the single source
 * of page_view events — it fires one on first load AND on every client-side
 * route change (React Router), which a plain gtag install would otherwise miss.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const GA_MEASUREMENT_ID = 'G-PB8FG0M5ET';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Fire a GA4 custom event. Fire-and-forget; no-op if gtag hasn't loaded.
 * Only pass non-PII params (counts, verdicts, page paths, types) — never names/emails.
 */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', name, params || {});
  }
}

export function usePageTracking() {
  const location = useLocation();
  useEffect(() => {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [location.pathname, location.search]);
}

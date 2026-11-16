/**
 * Google Analytics (GA4) for the SPA. The gtag.js loader lives in index.html and
 * is configured with `send_page_view: false`, so this hook is the single source
 * of page_view events — it fires one on first load AND on every client-side
 * route change (React Router), which a plain gtag install would otherwise miss.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { needsAppData } from './appDataPaths';
import { analyticsPath, analyticsQuery } from './analyticsPath';

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
 * scripts/test-funnel-analytics.mjs scans every call site for forbidden parameter names.
 */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', name, params || {});
  }
}

/** The <title> in index.html. If that title changes, update this too (the fallback below just stops applying). */
const SHELL_TITLE = 'SahakarLekha — Cooperative Society Accounting Software India';

export function usePageTracking() {
  const location = useLocation();
  useEffect(() => {
    if (typeof window.gtag !== 'function') return;
    // /login and the screens inside the app never set a title of their own, so they all reported the home
    // page's title and GA's "page title" report lumped 84% of views into one row. Name them by their path.
    const untitled = document.title === SHELL_TITLE && location.pathname !== '/' && location.pathname !== '/en';
    // GA never gets the address as the browser has it (lib/analyticsPath): record ids in the path become
    // `:id`, and the query keeps only the few keys that name a view — so no token (/verify-email?token=…),
    // member / society id, name, or the assistant's question (/ask?q=…) reaches it. `set` makes every later
    // event on this page (they attach the address by themselves) use the cleaned one too.
    const path = analyticsPath(location.pathname, needsAppData);
    const search = analyticsQuery(location.pathname, location.search, needsAppData);
    const pageLocation = window.location.origin + path + search;
    window.gtag('set', { page_location: pageLocation });
    window.gtag('event', 'page_view', {
      page_path: path + search,
      page_location: pageLocation,
      page_title: untitled ? `SahakarLekha — ${path}` : document.title,
    });
  }, [location.pathname, location.search]);
}

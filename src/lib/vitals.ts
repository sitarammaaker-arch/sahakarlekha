/**
 * vitals — Core Web Vitals + runtime-error reporting to GA4 (GOS-21).
 * Metrics land as `web_vitals` events (metric/value/rating/page_path) so LCP/CLS/
 * INP regressions show up in GA4 without any extra tooling. Errors land as
 * `app_error` (message truncated — no PII, no stack dumps).
 */
import { onLCP, onCLS, onINP, onTTFB, type Metric } from 'web-vitals';
import { trackEvent } from '@/lib/analytics';

export function reportWebVitals() {
  const send = (m: Metric) =>
    trackEvent('web_vitals', {
      metric: m.name,
      // CLS is a unitless score (~0–1) — scale so GA4's integer metrics keep precision.
      value: Math.round(m.name === 'CLS' ? m.value * 1000 : m.value),
      rating: m.rating,
      page_path: window.location.pathname,
    });
  onLCP(send);
  onCLS(send);
  onINP(send);
  onTTFB(send);
}

export function installErrorTracking() {
  window.addEventListener('error', (e) => {
    trackEvent('app_error', {
      message: String(e.message || '').slice(0, 150),
      source: (e.filename || '').split('/').pop(),
      page_path: window.location.pathname,
    });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason as { message?: string } | string | undefined;
    trackEvent('app_error', {
      message: String((typeof reason === 'object' && reason?.message) || reason || '').slice(0, 150),
      type: 'unhandledrejection',
      page_path: window.location.pathname,
    });
  });
}

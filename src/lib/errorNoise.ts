/**
 * G8 — browser notices that are not app faults and must not reach the error log. Pure, so it is
 * testable without the analytics / Supabase imports of the handlers that use it.
 * "ResizeObserver loop …" means layout settled a frame late; it was 24 of the 30-day window.error
 * rows (2026-09) and only buried real errors.
 */
export function isBenignBrowserNoise(message: unknown): boolean {
  return /^ResizeObserver loop (completed with undelivered notifications|limit exceeded)/.test(String(message ?? ''));
}

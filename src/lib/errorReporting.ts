/**
 * reportError — the one seam for surfacing runtime failures OFF-DEVICE (production-audit P0:
 * operators were blind to failing saves; errors died in the browser console). Errors are
 * shaped and inserted (fire-and-forget) into the `error_log` table, with full message + stack,
 * so they can be queried instead of lost. GA4 still gets a truncated `app_error` event
 * separately (lib/vitals) — this is the durable, full-detail sink.
 *
 * IT NEVER THROWS AND NEVER LOOPS. A failure of the error-log insert is swallowed silently —
 * an error reporter that can itself error (or re-enter its own handlers) is worse than useless.
 * A later slice can plug Sentry into this same seam and/or add an in-app viewer.
 */
import { supabase } from '@/lib/supabase';
import { getAuthSession } from '@/lib/storage';

export interface ErrorRecord {
  id: string;
  source: string;
  message: string;
  stack: string | null;
  context: Record<string, unknown> | null;
  url: string | null;
  created_at: string;
}

const clip = (v: unknown, max: number): string => String(v ?? '').slice(0, max);

/**
 * PURE — shape any thrown value into a loggable record. `now` / `url` are injected so this is
 * deterministic and testable. Truncates message/stack so one huge error can't bloat the row.
 */
export function buildErrorRecord(
  source: string,
  error: unknown,
  context?: Record<string, unknown> | null,
  now?: string,
  url?: string | null,
): ErrorRecord {
  const err = error && typeof error === 'object' ? (error as { message?: unknown; stack?: unknown }) : null;
  const message = clip(err?.message ?? error ?? 'Unknown error', 2000) || 'Unknown error';
  const createdAt = now ?? new Date().toISOString();
  const id = globalThis.crypto?.randomUUID?.() ?? `err-${createdAt}-${message.length}`;
  return {
    id,
    source: clip(source || 'unknown', 100),
    message,
    stack: err?.stack ? clip(err.stack, 8000) : null,
    context: context ?? null,
    url: url ?? null,
    created_at: createdAt,
  };
}

/** Fire-and-forget: log an error to `error_log`. Never throws, never loops. */
export function reportError(source: string, error: unknown, context?: Record<string, unknown>): void {
  try {
    const url = typeof window !== 'undefined' ? window.location?.href ?? null : null;
    // G8: the user agent tells a real visitor from a crawler re-rendering a stale cached page
    // (the stale-chunk rows of 2026-09 recurred at fixed daily times on public pages only).
    const ua = typeof navigator !== 'undefined' ? clip(navigator.userAgent, 300) : undefined;
    const rec = buildErrorRecord(source, error, ua ? { ...(context ?? {}), ua } : context, undefined, url);
    // G8: which society hit it — every 30-day row was society-less, so a failed save could not be
    // traced to its books (the Rania duplicate-number refusal had to be found by timestamp).
    let societyId: string | null = null;
    try { societyId = getAuthSession()?.societyId || null; } catch { /* no storage → leave null */ }
    supabase.from('error_log').insert(societyId ? { ...rec, society_id: societyId } : rec).then(
      () => { /* logged */ },
      () => { /* swallow — a failed error-log must never surface or re-enter a handler */ },
    );
  } catch {
    /* the reporter itself must never throw */
  }
}

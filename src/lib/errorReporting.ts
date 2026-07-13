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
    const rec = buildErrorRecord(source, error, context, undefined, url);
    supabase.from('error_log').insert(rec).then(
      () => { /* logged */ },
      () => { /* swallow — a failed error-log must never surface or re-enter a handler */ },
    );
  } catch {
    /* the reporter itself must never throw */
  }
}

/**
 * Anti-corruption adapter ring (T-26 / API Constitution INT-1, INT-5; 2040-Vision INV-7).
 *
 * PURE. Every external protocol (government, banking, commerce) lives at the EDGE as an adapter;
 * the core speaks only canonical and knows nothing about any partner (API-P2/INV-7). Every
 * dependency points inward — when 2040's protocols are unrecognizable, the core is untouched.
 * This module is the SSOT for the two ring guarantees the framework must give:
 *
 *   INT-1  the boundary: an INBOUND adapter translates external → canonical, VALIDATING the
 *          untrusted input first (API-P7 — external input is data, never truth); an OUTBOUND
 *          adapter translates canonical → external. The core never sees a partner's shape.
 *   INT-5  fail CLOSED and ISOLATED: a down or misbehaving partner degrades THAT integration only,
 *          never core accounting. An adapter error is CONTAINED as a Result and never thrown into
 *          the core; a circuit breaker sheds load from a failing partner.
 *
 * The cool-down timing of the breaker (when open → half-open) is the wire layer's job (a clock);
 * the state transitions are fixed here. No I/O; deterministic; never throws.
 */

/** Inbound: external → canonical, validating untrusted input (INT-1/API-P7). `validate` returns the
 *  problems ([] = valid); `toCanonical` runs only on valid input. The core receives only canonical. */
export interface InboundAdapter<Ext, Canon> {
  name: string;
  validate: (ext: Ext) => string[];
  toCanonical: (ext: Ext) => Canon;
}

/** Outbound: canonical → external. The only place a partner's shape is constructed (INT-1). */
export interface OutboundAdapter<Canon, Ext> {
  name: string;
  toExternal: (canon: Canon) => Ext;
}

/** An isolated adapter outcome — a failure is a value, never an exception into the core (INT-5). */
export type AdapterResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * PURE — run an inbound adapter with fail-closed isolation. The untrusted external input is
 * validated (API-P7); it is translated to canonical ONLY if valid; and ANY error the adapter throws
 * is contained as a Result. Never throws — a partner can never crash the core (INT-5).
 */
export function runInbound<Ext, Canon>(adapter: InboundAdapter<Ext, Canon>, ext: Ext): AdapterResult<Canon> {
  try {
    const problems = adapter.validate(ext);
    if (problems.length > 0) {
      return { ok: false, error: `${adapter.name}: rejected untrusted input — ${problems.join('; ')}` };
    }
    return { ok: true, value: adapter.toCanonical(ext) };
  } catch (e) {
    return { ok: false, error: `${adapter.name}: adapter failure — ${errText(e)}` };
  }
}

/** PURE — run an outbound adapter with the same isolation. Never throws. */
export function runOutbound<Canon, Ext>(adapter: OutboundAdapter<Canon, Ext>, canon: Canon): AdapterResult<Ext> {
  try {
    return { ok: true, value: adapter.toExternal(canon) };
  } catch (e) {
    return { ok: false, error: `${adapter.name}: adapter failure — ${errText(e)}` };
  }
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ── Circuit breaker (INT-5) ─────────────────────────────────────────────────

export type BreakerStatus = 'closed' | 'open' | 'half_open';

export interface CircuitBreaker {
  status: BreakerStatus;
  /** Consecutive failures while closed. */
  failures: number;
  /** Trip threshold — open after this many consecutive failures. */
  threshold: number;
}

/** PURE — a fresh, closed breaker. */
export function newBreaker(threshold: number): CircuitBreaker {
  return { status: 'closed', failures: 0, threshold: Math.max(1, threshold) };
}

/** PURE — may a call be attempted? False while OPEN — the framework fails closed and does not touch
 *  the partner (or the core) until a probe (INT-5). */
export function canAttempt(b: CircuitBreaker): boolean {
  return b.status !== 'open';
}

/**
 * PURE — fold a call outcome into the breaker. Closed: a success resets failures, a failure
 * increments and TRIPS to open at the threshold. Half-open: a success closes it, a failure re-opens
 * it. (Open records are ignored — canAttempt gates them out.)
 */
export function recordOutcome(b: CircuitBreaker, ok: boolean): CircuitBreaker {
  if (b.status === 'open') return b;
  if (b.status === 'half_open') {
    return ok ? { ...b, status: 'closed', failures: 0 } : { ...b, status: 'open' };
  }
  // closed
  if (ok) return { ...b, failures: 0 };
  const failures = b.failures + 1;
  return failures >= b.threshold ? { ...b, status: 'open', failures } : { ...b, failures };
}

/** PURE — after its cool-down (a clock the wire layer owns), an OPEN breaker is probed: it becomes
 *  half-open, allowing a single trial call whose outcome (recordOutcome) closes or re-opens it. */
export function probe(b: CircuitBreaker): CircuitBreaker {
  return b.status === 'open' ? { ...b, status: 'half_open' } : b;
}

/**
 * Projections — reports derived from the event log (T-07 / ADR-0001; Canonical CL-4, CL-1).
 *
 * PURE. The event journal is the system of record; every report is a PROJECTION computed by
 * folding the events — never a stored, independently-writable figure. A projection can be
 * dropped and rebuilt from the log, and reconstructed AS-OF any date (replay only the events
 * that had occurred by then). This is the ONE canonical trial-balance / ledger formula
 * (RULE 2), so the state field, the per-page report and the aggregator can no longer disagree.
 *
 * A voucher event's payload carries balanced `lines` (the T-05 typed shape: accountId + Dr/Cr
 * side + exact integer paise). A reversing event carries the same lines with the side flipped,
 * so it nets its original out in the projection without the original ever leaving the log (CL-2).
 * Amounts are exact minor units (T-02) — no float decides whether the books balance.
 */
import type { LedgerEvent } from './event';
import { isValidMinor } from '../money';

interface Leg {
  accountId: string;
  drCr: 'Dr' | 'Cr';
  amountMinor: number;
}

/** PURE — the valid posting legs carried by an event payload (`{ lines: Leg[] }`). Malformed
 *  legs are skipped, never coerced. */
function legsOf(payload: unknown): Leg[] {
  if (!payload || typeof payload !== 'object') return [];
  const arr = (payload as { lines?: unknown }).lines;
  if (!Array.isArray(arr)) return [];
  const out: Leg[] = [];
  for (const l of arr) {
    if (l && typeof l === 'object'
      && typeof (l as Leg).accountId === 'string'
      && ((l as Leg).drCr === 'Dr' || (l as Leg).drCr === 'Cr')
      && isValidMinor((l as Leg).amountMinor)) {
      out.push({ accountId: (l as Leg).accountId, drCr: (l as Leg).drCr, amountMinor: (l as Leg).amountMinor });
    }
  }
  return out;
}

function asOfMillis(asOf?: string): number | null {
  return asOf ? Date.parse(asOf) : null;
}

/** True if the event had occurred by `asOfMs` (null = no cutoff). An unparseable time is
 *  excluded rather than mis-dated. */
function occurredBy(event: LedgerEvent, asOfMs: number | null): boolean {
  if (asOfMs === null) return true;
  const t = Date.parse(event.occurredAt);
  return Number.isNaN(t) ? false : t <= asOfMs;
}

export interface TrialBalanceLine {
  accountId: string;
  drMinor: number;
  crMinor: number;
  /** Dr − Cr, in minor units. */
  netMinor: number;
}

export interface TrialBalance {
  asOf: string | null;
  /** Sorted by accountId, so the projection serialises canonically. */
  lines: TrialBalanceLine[];
  totalDrMinor: number;
  totalCrMinor: number;
  /** The double-entry invariant (CL-1): Σ Dr === Σ Cr, exact in minor units. */
  balanced: boolean;
  eventCount: number;
}

/**
 * PURE — the trial balance projected from the event log, AS-OF a date (inclusive). Deterministic
 * and order-independent: the sums are commutative, and the account list is sorted, so the same
 * events always yield the same projection (and it can be rebuilt at will — CL-4).
 */
export function projectTrialBalance(events: readonly LedgerEvent[], asOf?: string): TrialBalance {
  const cutoff = asOfMillis(asOf);
  const dr: Record<string, number> = {};
  const cr: Record<string, number> = {};
  let totalDr = 0;
  let totalCr = 0;
  let count = 0;

  for (const e of events) {
    if (!occurredBy(e, cutoff)) continue;
    count++;
    for (const l of legsOf(e.payload)) {
      if (l.drCr === 'Dr') { dr[l.accountId] = (dr[l.accountId] ?? 0) + l.amountMinor; totalDr += l.amountMinor; }
      else { cr[l.accountId] = (cr[l.accountId] ?? 0) + l.amountMinor; totalCr += l.amountMinor; }
    }
  }

  const accounts = [...new Set([...Object.keys(dr), ...Object.keys(cr)])].sort();
  const lines = accounts.map((a) => ({
    accountId: a,
    drMinor: dr[a] ?? 0,
    crMinor: cr[a] ?? 0,
    netMinor: (dr[a] ?? 0) - (cr[a] ?? 0),
  }));

  return { asOf: asOf ?? null, lines, totalDrMinor: totalDr, totalCrMinor: totalCr, balanced: totalDr === totalCr, eventCount: count };
}

export interface SplitTrialBalanceLine {
  accountId: string;
  openingDrMinor: number;
  openingCrMinor: number;
  txnDrMinor: number;
  txnCrMinor: number;
  totalDrMinor: number;
  totalCrMinor: number;
  /** total Dr − total Cr, in minor units. */
  netMinor: number;
}

export interface SplitTrialBalance {
  asOf: string | null;
  lines: SplitTrialBalanceLine[];
  totalDrMinor: number;
  totalCrMinor: number;
  balanced: boolean;
  eventCount: number;
}

/**
 * PURE (T-09) — the trial balance projected from the log WITH the opening/transaction split that
 * getTrialBalance shows: `account.opening` events feed the OPENING columns, every other event feeds
 * the TRANSACTION columns. This is the ledger-native equivalent of the app's getTrialBalance compute
 * (opening balances + voucher postings), per account, in exact paise (T-02). The T-09 read cut maps
 * these lines onto the AccountBalance shape (join account metadata + toRupees); the split logic lives
 * here so it is unit-testable in isolation, before it is wired into the read path.
 */
export function projectSplitTrialBalance(events: readonly LedgerEvent[], asOf?: string): SplitTrialBalance {
  const cutoff = asOfMillis(asOf);
  const acc = new Map<string, { oDr: number; oCr: number; tDr: number; tCr: number }>();
  let count = 0;
  for (const e of events) {
    if (!occurredBy(e, cutoff)) continue;
    count++;
    const isOpening = e.eventType === 'account.opening';
    for (const l of legsOf(e.payload)) {
      let b = acc.get(l.accountId);
      if (!b) { b = { oDr: 0, oCr: 0, tDr: 0, tCr: 0 }; acc.set(l.accountId, b); }
      if (isOpening) { if (l.drCr === 'Dr') b.oDr += l.amountMinor; else b.oCr += l.amountMinor; }
      else { if (l.drCr === 'Dr') b.tDr += l.amountMinor; else b.tCr += l.amountMinor; }
    }
  }
  const lines = [...acc.keys()].sort().map((accountId) => {
    const b = acc.get(accountId)!;
    const totalDrMinor = b.oDr + b.tDr;
    const totalCrMinor = b.oCr + b.tCr;
    return { accountId, openingDrMinor: b.oDr, openingCrMinor: b.oCr, txnDrMinor: b.tDr, txnCrMinor: b.tCr, totalDrMinor, totalCrMinor, netMinor: totalDrMinor - totalCrMinor };
  });
  const totalDrMinor = lines.reduce((s, l) => s + l.totalDrMinor, 0);
  const totalCrMinor = lines.reduce((s, l) => s + l.totalCrMinor, 0);
  return { asOf: asOf ?? null, lines, totalDrMinor, totalCrMinor, balanced: totalDrMinor === totalCrMinor, eventCount: count };
}

export interface LedgerEntry {
  eventId: string;
  occurredAt: string;
  drMinor: number;
  crMinor: number;
  /** Running balance after this entry (Dr positive), in minor units. */
  runningMinor: number;
}

export interface AccountLedger {
  accountId: string;
  asOf: string | null;
  entries: LedgerEntry[];
  closingMinor: number;
}

/**
 * PURE — one account's running ledger (khata) AS-OF a date. Here order MATTERS, so entries are
 * sorted by event time (then eventId, for a stable tie-break) and the running balance is folded
 * through them. Closing balance = the final running balance.
 */
export function projectAccountLedger(events: readonly LedgerEvent[], accountId: string, asOf?: string): AccountLedger {
  const cutoff = asOfMillis(asOf);
  const rows: LedgerEntry[] = [];

  for (const e of events) {
    if (!occurredBy(e, cutoff)) continue;
    for (const l of legsOf(e.payload)) {
      if (l.accountId !== accountId) continue;
      rows.push({
        eventId: e.eventId,
        occurredAt: e.occurredAt,
        drMinor: l.drCr === 'Dr' ? l.amountMinor : 0,
        crMinor: l.drCr === 'Cr' ? l.amountMinor : 0,
        runningMinor: 0,
      });
    }
  }

  rows.sort((a, b) => (Date.parse(a.occurredAt) - Date.parse(b.occurredAt)) || a.eventId.localeCompare(b.eventId));
  let running = 0;
  const entries = rows.map((r) => { running += r.drMinor - r.crMinor; return { ...r, runningMinor: running }; });

  return { accountId, asOf: asOf ?? null, entries, closingMinor: running };
}

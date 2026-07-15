/**
 * Typed money columns (T-05 — promote money-material JSONB → typed, constrained columns).
 *
 * A `{ amount, currency }` money object stored in a JSONB column becomes a pair of typed
 * columns: `<field>AmountMinor` (integer paise, CL-3) + `<field>Currency`. These helpers build
 * that column bucket from the in-memory Money objects, so a save can DUAL-WRITE the typed
 * columns alongside the existing JSONB (the JSONB stays the read source until a later
 * dual-read slice). PURE — no DB. Amounts are rupees in memory; toMinor converts to exact paise.
 */
import { toMinor } from '@/lib/money';

interface MoneyLike { amount?: number; currency?: string }

/** One JSONB money object → its typed column pair, e.g. field 'gross' →
 *  { grossAmountMinor, grossCurrency }. Missing/invalid amount → 0; missing currency → 'INR'. */
export function moneyColumns(field: string, m: MoneyLike | null | undefined): Record<string, number | string> {
  return {
    [`${field}AmountMinor`]: toMinor(Number(m?.amount) || 0),
    [`${field}Currency`]: m?.currency || 'INR',
  };
}

/** The typed money columns for a farmer / procurement settlement (T-05, slice 1):
 *  gross, netPayable and amountPaid. */
export function settlementTypedColumns(
  stl: { gross?: MoneyLike | null; netPayable?: MoneyLike | null; amountPaid?: MoneyLike | null },
): Record<string, number | string> {
  return {
    ...moneyColumns('gross', stl.gross),
    ...moneyColumns('netPayable', stl.netPayable),
    ...moneyColumns('amountPaid', stl.amountPaid),
  };
}

// ── Dual-read (T-05, slice 2): prefer the typed columns; fall back to the JSONB ──────

export interface Money { amount: number; currency: string }

/** Reconstruct a Money object, PREFERRING the typed column pair (integer paise → rupees) and
 *  falling back to the retained JSONB object when the typed value is absent (e.g. a row that
 *  predates the backfill). Behaviour-preserving: a backfilled/dual-written row yields the same
 *  value, now sourced from the typed column. */
export function moneyFromTyped(
  amountMinor: number | null | undefined,
  currency: string | null | undefined,
  jsonbFallback: MoneyLike | null | undefined,
): Money {
  if (amountMinor !== null && amountMinor !== undefined) {
    return { amount: (Number(amountMinor) || 0) / 100, currency: currency || 'INR' };
  }
  return { amount: Number(jsonbFallback?.amount) || 0, currency: jsonbFallback?.currency || 'INR' };
}

/** Hydrate a raw procurement_settlements DB row: gross / netPayable / amountPaid read from the
 *  typed columns, JSONB as fallback. Returns the row with those three fields as Money objects. */
export function hydrateSettlement<T extends Record<string, unknown>>(row: T): T {
  const r = row as Record<string, unknown>;
  return {
    ...row,
    gross: moneyFromTyped(r.grossAmountMinor as number, r.grossCurrency as string, r.gross as MoneyLike),
    netPayable: moneyFromTyped(r.netPayableAmountMinor as number, r.netPayableCurrency as string, r.netPayable as MoneyLike),
    amountPaid: moneyFromTyped(r.amountPaidAmountMinor as number, r.amountPaidCurrency as string, r.amountPaid as MoneyLike),
  } as T;
}

/** Hydrate a raw procurement_jforms DB row: gross / deductions / net read from the typed
 *  columns, JSONB as fallback (T-05 J-Form slice). Unlike settlements, the typed columns are
 *  written SERVER-SIDE by procurement_commit_transaction (migration 042) — the J-Form insert
 *  is atomic/RPC-only, so the client only ever dual-READS. */
export function hydrateJForm<T extends Record<string, unknown>>(row: T): T {
  const r = row as Record<string, unknown>;
  return {
    ...row,
    gross: moneyFromTyped(r.grossAmountMinor as number, r.grossCurrency as string, r.gross as MoneyLike),
    deductions: moneyFromTyped(r.deductionsAmountMinor as number, r.deductionsCurrency as string, r.deductions as MoneyLike),
    net: moneyFromTyped(r.netAmountMinor as number, r.netCurrency as string, r.net as MoneyLike),
  } as T;
}

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

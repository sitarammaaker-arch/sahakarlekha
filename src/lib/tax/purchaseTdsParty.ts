/**
 * RPT-13 (audit 2026-11-17) — who a purchase's TDS was deducted from, and under which section, from the SUPPLIER record.
 *
 * The TDS Register hard-coded every purchase TDS as section 194Q, deductee type "firm", nature "Purchase of Goods", PAN
 * from the legacy `gstNo` only, and a 0.1% rate when the bill had none. A job-work contractor (194C, individual) went
 * into 26Q as 94Q / purchase of goods; a supplier with only `gstin` or only `pan` got PAN '' and blocked the export.
 * PURE.
 */
import type { SupplierType, TdsDeducteeType, TdsSection } from '@/types';

const COMPANY: ReadonlySet<string> = new Set(['pvtLtd', 'publicLtd']);
const FIRM: ReadonlySet<string> = new Set(['partnership', 'llp']);
const INDIVIDUAL: ReadonlySet<string> = new Set(['individual', 'proprietorship', 'huf']);

/** The 26Q deductee category for a supplier type (unknown → 'other', never guessed as a firm). */
export function deducteeTypeOf(t?: SupplierType | string): TdsDeducteeType {
  if (!t) return 'other';
  if (COMPANY.has(t)) return 'company';
  if (FIRM.has(t)) return 'firm';
  if (INDIVIDUAL.has(t)) return 'individual';
  if (t === 'society') return 'cooperative';
  return 'other';
}

const NATURE: Partial<Record<TdsSection, string>> = {
  '194Q': 'Purchase of Goods',
  '194C': 'Payment to Contractor',
  '194J': 'Professional / Technical Fees',
  '194H': 'Commission / Brokerage',
  '194I': 'Rent',
  '194A': 'Interest',
};

/** PAN: the supplier's own PAN, else the PAN inside its GSTIN (characters 3–12), current field before the legacy one. */
export function supplierPan(s?: { pan?: string; gstin?: string; gstNo?: string }): string {
  const own = (s?.pan || '').trim().toUpperCase();
  if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(own)) return own;
  const g = (s?.gstin || s?.gstNo || '').trim().toUpperCase();
  const fromG = g.length >= 12 ? g.slice(2, 12) : '';
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(fromG) ? fromG : '';
}

/**
 * The section / deductee / nature of a purchase's TDS. The supplier's own `tdsSection` wins; a supplier without one
 * keeps the old 194Q (purchase of goods — the reason a purchase carries TDS) and says so with `sectionAssumed`.
 */
export function purchaseTdsParty(supplier?: { supplierType?: SupplierType | string; tdsSection?: TdsSection; pan?: string; gstin?: string; gstNo?: string }): {
  section: TdsSection; deducteeType: TdsDeducteeType; natureOfPayment: string; deducteePan: string; sectionAssumed: boolean;
} {
  const section: TdsSection = supplier?.tdsSection || '194Q';
  return {
    section,
    deducteeType: deducteeTypeOf(supplier?.supplierType),
    natureOfPayment: NATURE[section] ?? 'Purchase of Goods',
    deducteePan: supplierPan(supplier),
    sectionAssumed: !supplier?.tdsSection,
  };
}

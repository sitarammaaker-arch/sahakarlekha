/**
 * Subscription tax invoice (migration 130) — the row shape and what the list / PDF print from it.
 * PURE (no Supabase client): pdf.ts imports this, so it must not pull the app's DB client into
 * report bundles. Money is integer paise in the row; invoiceView turns it into rupees.
 */
import { GST_STATE_CODES } from '@/lib/gstStates';

export interface SubscriptionInvoice {
  id: string;
  invoice_no: string;
  invoice_date: string; // YYYY-MM-DD (IST)
  order_id: string;
  payment_id: string | null;
  plan: string;
  kind: string;
  seller_name: string;
  seller_gstin: string;
  seller_address: string;
  seller_state_code: string;
  buyer_name: string;
  buyer_address: string | null;
  buyer_state_code: string;
  buyer_gstin: string | null;
  place_of_supply: string;
  sac: string;
  gst_rate_pct: number | string;
  taxable_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_paise: number;
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** "06 - Haryana" for a GST state code; the bare code when unknown. */
export function stateLabel(code: string): string {
  const name = Object.keys(GST_STATE_CODES).find((k) => GST_STATE_CODES[k] === code);
  return name ? `${code} - ${titleCase(name)}` : code;
}

const PLAN_NAMES: Record<string, string> = { starter: 'Starter', plus: 'Plus', pro: 'Pro' };
const KIND_TEXT: Record<string, string> = {
  new: '1 year',
  renew: '1 year renewal',
  upgrade: 'upgrade for the remaining period (prorated)',
};

export interface InvoiceView {
  intra: boolean;
  rate: number;
  halfRate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  total: number;
  planName: string;
  description: string;
  posLabel: string;
  fileName: string;
}

/** Everything the list and the PDF print, derived from the row alone. Rupees are paise / 100. */
export function invoiceView(inv: SubscriptionInvoice): InvoiceView {
  const r = (p: number) => Number(p) / 100;
  const rate = Number(inv.gst_rate_pct);
  const planName = PLAN_NAMES[inv.plan] ?? inv.plan;
  return {
    intra: inv.place_of_supply === inv.seller_state_code,
    rate,
    halfRate: rate / 2,
    taxable: r(inv.taxable_paise),
    cgst: r(inv.cgst_paise),
    sgst: r(inv.sgst_paise),
    igst: r(inv.igst_paise),
    tax: r(Number(inv.cgst_paise) + Number(inv.sgst_paise) + Number(inv.igst_paise)),
    total: r(inv.total_paise),
    planName,
    description: `SahakarLekha subscription - ${planName} plan, ${KIND_TEXT[inv.kind] ?? inv.kind}`,
    posLabel: stateLabel(inv.place_of_supply),
    fileName: `Invoice_${inv.invoice_no.replace(/[^A-Za-z0-9-]+/g, '_')}.pdf`,
  };
}

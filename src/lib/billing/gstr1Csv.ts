/**
 * SahakarLekha's OWN outward-supply sheet for GSTR-1, from the issued subscription invoices (migration 130).
 * PURE — unit-tested by scripts/test-gstr1-csv.mjs.
 *
 * This is a WORKING SHEET for the CA, not the GSTN offline-tool upload template (that template's exact
 * columns are not in this repo, so nothing here imitates it). One row per invoice, in invoice-number
 * order, with a Section column: B2B when the buyer gave a GSTIN, otherwise B2C. A rate-wise B2C summary
 * (by place of supply + supply type) follows, then the period totals — so the CA can enter B2B
 * invoice-wise and B2C in summary. Figures are rupees to the paisa, summed in paise (no float drift).
 */
import type { SubscriptionInvoice } from '@/lib/billing/invoiceView';
import { stateLabel } from '@/lib/billing/invoiceView';
import type { Cell } from '@/lib/exportUtils';

export const GSTR1_HEADERS = [
  'Section', 'Invoice No.', 'Invoice Date', 'Buyer', 'Buyer GSTIN', 'Place of Supply', 'Supply Type',
  'SAC', 'Rate %', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Invoice Value',
];

const rs = (paise: number) => (paise / 100).toFixed(2);

interface Sums { taxable: number; igst: number; cgst: number; sgst: number; total: number; count: number }
const zero = (): Sums => ({ taxable: 0, igst: 0, cgst: 0, sgst: 0, total: 0, count: 0 });
const addTo = (s: Sums, i: SubscriptionInvoice) => {
  s.taxable += Number(i.taxable_paise); s.igst += Number(i.igst_paise); s.cgst += Number(i.cgst_paise);
  s.sgst += Number(i.sgst_paise); s.total += Number(i.total_paise); s.count += 1;
};
const sumCells = (s: Sums): Cell[] => [rs(s.taxable), rs(s.igst), rs(s.cgst), rs(s.sgst), rs(s.total)];

/** The sheet's rows (headers are GSTR1_HEADERS). `invoices` may arrive in any order. */
export function buildGstr1Rows(invoices: SubscriptionInvoice[]): Cell[][] {
  const sorted = [...invoices].sort((a, b) =>
    a.invoice_date.localeCompare(b.invoice_date) || a.invoice_no.localeCompare(b.invoice_no, 'en', { numeric: true }));
  const rows: Cell[][] = [];
  const b2c = new Map<string, { pos: string; type: string; rate: number; sac: string; s: Sums }>();
  const all = zero();

  for (const i of sorted) {
    const intra = i.place_of_supply === i.seller_state_code;
    const type = intra ? 'Intra-State' : 'Inter-State';
    const rate = Number(i.gst_rate_pct);
    const b2b = !!i.buyer_gstin;
    rows.push([
      b2b ? 'B2B' : 'B2C', i.invoice_no, i.invoice_date, i.buyer_name, i.buyer_gstin ?? '',
      stateLabel(i.place_of_supply), type, i.sac, rate,
      rs(Number(i.taxable_paise)), rs(Number(i.igst_paise)), rs(Number(i.cgst_paise)), rs(Number(i.sgst_paise)), rs(Number(i.total_paise)),
    ]);
    addTo(all, i);
    if (!b2b) {
      const key = `${i.place_of_supply}|${type}|${rate}|${i.sac}`;
      const g = b2c.get(key) ?? { pos: i.place_of_supply, type, rate, sac: i.sac, s: zero() };
      addTo(g.s, i);
      b2c.set(key, g);
    }
  }

  if (b2c.size > 0) {
    rows.push([]);
    for (const g of [...b2c.values()].sort((a, b) => a.pos.localeCompare(b.pos) || a.type.localeCompare(b.type) || a.rate - b.rate)) {
      rows.push(['B2C Summary', `${g.s.count} invoice(s)`, '', '', '', stateLabel(g.pos), g.type, g.sac, g.rate, ...sumCells(g.s)]);
    }
  }
  rows.push([]);
  rows.push(['TOTAL', `${all.count} invoice(s)`, '', '', '', '', '', '', '', ...sumCells(all)]);
  return rows;
}

/** e.g. "SahakarLekha_GSTR1_Sheet_2026-10-01_to_2026-10-31" (downloadCSV adds the extension). */
export function gstr1FileStem(from: string, to: string): string {
  return `SahakarLekha_GSTR1_Sheet_${from}_to_${to}`;
}

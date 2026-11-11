/**
 * Reverse Charge Mechanism (RCM) auto-compute (ECR-22 slice B).
 *
 * For inward supplies liable to RCM — the categories notified under CGST Act s.9(3) (e.g. a goods transport
 * agency, an advocate: Notification 13/2017-CT(R); cashew, tendu leaves, tobacco leaves, raw cotton bought
 * from an agriculturist: 4/2017-CT(R)) and, since 01.02.2019, only the NOTIFIED classes under s.9(4), not
 * every purchase from an unregistered dealer — the RECIPIENT self-assesses the GST — it is both an
 * output liability (paid in cash) and, if eligible, claimable as ITC. This sums
 * the self-assessed GST over RCM-flagged purchases: it uses the recorded GST
 * amounts, or — when the supplier charged none (typical on RCM invoices) —
 * derives it from taxable × rate. Pure & tested by scripts/test-rcm.mjs.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;
const paise = (n: number | undefined) => Math.round((Number(n) || 0) * 100);

/**
 * How a reverse-charge purchase is PAID and POSTED — read from the text, not from practice notes:
 *  - the recipient, not the supplier, is liable for the tax (CGST Act s.9(3), s.9(4), s.2(98)) → the supplier
 *    is owed the value only, never the GST;
 *  - that tax is not "output tax" (s.2(82)) and is paid through the electronic CASH ledger (Rule 85(4);
 *    s.49(4) lets credit be used for output tax only) → it gets its own payable head, never 2201 / Output heads;
 *  - it is "input tax" of the recipient (s.2(62)(b)) → Dr the Input CGST / SGST / IGST ledgers;
 *  - the accounts must show tax payable under s.9(3)/(4) (Rule 56(4)) and the reverse-charge supplies (Rule 56(1)).
 * Texts: taxinformation.cbic.gov.in — CGST Act chapter1/section2, chapter3/section9, chapter10/section49;
 * CGST Rules chapter7/rule56, chapter9/rule85.
 *
 * NOT decided here (the text leaves it to the taxpayer / needs facts the app does not hold): whether a supply
 * IS under reverse charge (the user ticks it), whether the credit is blocked (s.17(5)), and the tax period
 * (s.12(3) / s.13(3)). Credit is posted on the bill date; s.16(2)(c) allows it once the tax is actually paid.
 */
export interface RcmPurchaseTermsInput {
  rcmApplicable?: boolean;
  netAmount: number;
  taxAmount?: number;
  grandTotal?: number;
  tdsAmount?: number;
  tcsAmount?: number;
  cashDiscount?: number;
  roundOff?: number;
}

export interface RcmPurchaseTerms {
  /** Reverse charge with a tax to self-assess. */
  rcm: boolean;
  /** What the supplier (or cash / bank) is credited — under reverse charge, without the GST. */
  grandTotal: number;
  /** The GST that is part of `grandTotal` (0 under reverse charge) — what splitNetByAccount must take back out. */
  taxInPayable: number;
  /** The self-assessed tax owed to the government (Cr reverse-charge payable); 0 when not reverse charge. */
  rcmTax: number;
}

/**
 * PURE. A bill that still carries the GST in its total (entered before this rule, an import, another caller)
 * is brought to the reverse-charge shape: total = net + TCS − TDS − cash discount + round off.
 */
export function rcmPurchaseTerms(p: RcmPurchaseTermsInput): RcmPurchaseTerms {
  const tax = paise(p.taxAmount);
  const given = paise(p.grandTotal ?? p.netAmount);
  if (!p.rcmApplicable || !(tax > 0)) return { rcm: false, grandTotal: given / 100, taxInPayable: Math.max(0, tax) / 100, rcmTax: 0 };
  const withoutTax = paise(p.netAmount) + paise(p.tcsAmount) - paise(p.tdsAmount) - paise(p.cashDiscount) + paise(p.roundOff);
  const total = given === withoutTax + tax ? withoutTax : given;
  return { rcm: true, grandTotal: total / 100, taxInPayable: 0, rcmTax: tax / 100 };
}

export interface RcmPurchase {
  date: string;
  netAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cgstPct?: number;
  sgstPct?: number;
  igstPct?: number;
  rcmApplicable?: boolean;
  isDeleted?: boolean;
}

export interface RcmSummary {
  count: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number; // = the RCM tax payable in cash, and equally the ITC claimable
}

/**
 * True when a saved purchase is in the reverse-charge shape: flagged, with a tax, and that tax is NOT part of
 * its total. A purchase flagged before this rule still has the GST inside its total (and was posted to the
 * supplier); it is left as it was until someone edits it.
 */
export function rcmTaxOutsideTotal(p: RcmPurchaseTermsInput): boolean {
  const tax = paise(p.taxAmount);
  if (!p.rcmApplicable || !(tax > 0)) return false;
  const withoutTax = paise(p.netAmount) + paise(p.tcsAmount) - paise(p.tdsAmount) - paise(p.cashDiscount) + paise(p.roundOff);
  return paise(p.grandTotal ?? p.netAmount) !== withoutTax + tax;
}

/** Sum the self-assessed RCM GST over RCM-flagged purchases in [from, to]. */
export function computeRCM(purchases: RcmPurchase[], from: string, to: string): RcmSummary {
  const s: RcmSummary = { count: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
  for (const p of purchases) {
    if (!p.rcmApplicable || p.isDeleted || !p.date || p.date < from || p.date > to) continue;
    s.count++;
    const taxable = p.netAmount || 0;
    let cgst = p.cgstAmount || 0, sgst = p.sgstAmount || 0, igst = p.igstAmount || 0;
    if (cgst === 0 && sgst === 0 && igst === 0) {
      // Supplier charged no GST → self-assess from the applicable rate.
      const inter = p.igstPct || 0;
      if (inter > 0) {
        igst = r2((taxable * inter) / 100);
      } else {
        cgst = r2((taxable * (p.cgstPct || 0)) / 100);
        sgst = r2((taxable * (p.sgstPct || 0)) / 100);
      }
    }
    s.taxableValue = r2(s.taxableValue + taxable);
    s.cgst = r2(s.cgst + cgst);
    s.sgst = r2(s.sgst + sgst);
    s.igst = r2(s.igst + igst);
  }
  s.total = r2(s.cgst + s.sgst + s.igst);
  return s;
}

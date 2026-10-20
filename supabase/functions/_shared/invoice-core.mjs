/**
 * Subscription invoice calculator (PURE — no I/O, no Deno). Shared by razorpay-webhook and
 * scripts/test-invoice-core.mjs, so the GST split is unit-tested in CI before a single invoice
 * is issued. issue_invoice() (migration 130) re-checks every figure this returns.
 *
 * Rules (founder 2026-10-20):
 *   • Prices are GST-INCLUSIVE: the invoice total is exactly the order amount; the taxable value
 *     is backed out of it.
 *   • Place of supply = the buyer's state — GSTIN prefix first, else the state name. Unknown →
 *     NO invoice ('buyer_state_unknown'), never a guessed state.
 *   • Same state as the seller → CGST + SGST, always equal halves; otherwise IGST.
 *   • All money is integer paise; taxable + taxes = total, to the paisa.
 * The SAC and the rate come from the billing_seller row — nothing statutory is hard-coded here.
 */

// MIRRORS src/lib/gstStates.ts GST_STATE_CODES — scripts/test-invoice-core.mjs asserts they match.
export const GST_STATE_CODES = {
  'jammu and kashmir': '01', 'himachal pradesh': '02', 'punjab': '03',
  'chandigarh': '04', 'uttarakhand': '05', 'haryana': '06', 'delhi': '07',
  'rajasthan': '08', 'uttar pradesh': '09', 'bihar': '10', 'sikkim': '11',
  'arunachal pradesh': '12', 'nagaland': '13', 'manipur': '14', 'mizoram': '15',
  'tripura': '16', 'meghalaya': '17', 'assam': '18', 'west bengal': '19',
  'jharkhand': '20', 'odisha': '21', 'orissa': '21', 'chhattisgarh': '22',
  'madhya pradesh': '23', 'gujarat': '24', 'daman and diu': '26',
  'dadra and nagar haveli and daman and diu': '26', 'maharashtra': '27',
  'karnataka': '29', 'goa': '30', 'lakshadweep': '31', 'kerala': '32',
  'tamil nadu': '33', 'puducherry': '34', 'pondicherry': '34',
  'andaman and nicobar islands': '35', 'telangana': '36', 'andhra pradesh': '37',
  'ladakh': '38',
};

const GSTIN_RE = /^[0-3][0-9][A-Z0-9]{13}$/;

/** The GSTIN upper-cased if it is plausibly one, else ''. */
export function cleanGstin(gstin) {
  const g = String(gstin ?? '').trim().toUpperCase();
  return GSTIN_RE.test(g) ? g : '';
}

/** Buyer state code: GSTIN prefix, else the state name, else ''. */
export function buyerStateCode(gstin, stateName) {
  const g = cleanGstin(gstin);
  if (g) return g.slice(0, 2);
  return GST_STATE_CODES[String(stateName ?? '').trim().toLowerCase()] || '';
}

/**
 * Split a GST-inclusive total. Rate is in percent (18, 12.5 …); worked in basis points so no float
 * ever reaches a paisa. Intra-state: one rounded half-tax, charged twice (CGST = SGST), taxable is the
 * remainder. Inter-state: IGST = total − taxable.
 * @returns {{ taxable: number, cgst: number, sgst: number, igst: number }}
 */
export function splitInclusive(totalPaise, ratePct, intra) {
  if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0) throw new Error(`total must be positive paise (${totalPaise})`);
  const bp = Math.round(Number(ratePct) * 100);
  if (!Number.isFinite(bp) || bp < 0) throw new Error(`bad GST rate (${ratePct})`);
  const taxable0 = Math.round((totalPaise * 10000) / (10000 + bp));
  if (intra) {
    const half = Math.round((taxable0 * bp) / 20000);
    return { taxable: totalPaise - 2 * half, cgst: half, sgst: half, igst: 0 };
  }
  return { taxable: taxable0, cgst: 0, sgst: 0, igst: totalPaise - taxable0 };
}

/**
 * Everything issue_invoice() needs, or the reason no invoice can be issued yet.
 * @param {{ amountRupees: number,
 *           seller: { state_code?: string|null, gst_rate_pct?: number|string|null } | null,
 *           buyer: { name?: string, address?: string, state?: string, gstin?: string } | null }} input
 */
export function buildInvoiceCalc({ amountRupees, seller, buyer }) {
  if (!seller || !/^[0-3][0-9]$/.test(String(seller.state_code ?? '')) || seller.gst_rate_pct == null || seller.gst_rate_pct === '') {
    return { status: 'seller_incomplete' };
  }
  const gstin = cleanGstin(buyer?.gstin);
  const pos = buyerStateCode(gstin, buyer?.state);
  if (!pos) return { status: 'buyer_state_unknown' };

  const rate = Number(seller.gst_rate_pct);
  const total = Math.round(Number(amountRupees) * 100);
  const s = splitInclusive(total, rate, pos === seller.state_code);
  const addr = [buyer?.address, buyer?.state].map((x) => String(x ?? '').trim()).filter(Boolean).join(', ');
  return {
    status: 'ok',
    calc: {
      buyer_name: String(buyer?.name ?? '').trim(),
      buyer_address: addr,
      buyer_state_code: pos,
      buyer_gstin: gstin,
      place_of_supply: pos,
      gst_rate_pct: rate,
      taxable_paise: s.taxable,
      cgst_paise: s.cgst,
      sgst_paise: s.sgst,
      igst_paise: s.igst,
      total_paise: total,
    },
  };
}

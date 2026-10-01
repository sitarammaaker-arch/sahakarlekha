/**
 * Year-close helpers for the client (Phase-2 C; server: close_financial_year, migration 091). Pure.
 * Unit-tested by scripts/test-fy-close-client.mjs.
 */

/** 31 March closing a financial-year label 'YYYY-YY' (undefined for anything else). */
export function fyEndOf(label: string): string | undefined {
  const m = /^(\d{4})-\d{2}$/.exec(label || '');
  return m ? `${Number(m[1]) + 1}-03-31` : undefined;
}

/**
 * The closing stock the server should book (paise), from THE closing-stock rule's result
 * (getTradingAccount → totalClosingStock). null when the society has no trading / no stock at all —
 * the server then posts no stock journal.
 */
export function closingStockMinorFor(trading: { totalClosingStock?: number } | null | undefined): number | null {
  const total = Number(trading?.totalClosingStock);
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.round(total * 100);
}

/** The server's Hindi reason (text after "close_fy:<code> — "), else the raw message. */
export function closeFyMessage(raw: string): string {
  const m = /close_fy:[a-z_]+ — ([^\n]+)/.exec(raw || '');
  if (m) return m[1];
  const pv = /post_voucher:([a-z_]+)/.exec(raw || '');
  if (pv) return `वाउचर पोस्ट नहीं हुआ (${pv[1]}) — support से संपर्क करें।`;
  return raw || 'अज्ञात त्रुटि';
}

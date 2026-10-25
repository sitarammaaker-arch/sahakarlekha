/**
 * Marketing E1 — fertiliser dealer licences and the general scheme-claim register. PURE.
 *
 * Source: Fertiliser (Control) Order, 1985 (G.S.R. 758(E), as amended; text as published by the
 * Odisha agriculture licensing portal, odishaagrilicense.nic.in/actsRules/Fertiliser_Control_Order_1985.pdf):
 *  • cl. 8  — a wholesale / retail dealer files a Memorandum of Intimation (Form A1) with a certificate of
 *             source in Form O — one Form O for EACH source the fertiliser is obtained from; the
 *             acknowledgement in Form A2 is the authorisation letter.
 *  • cl. 10 — the authorisation letter is valid for three years from its issue, unless renewed,
 *             suspended or cancelled.
 *  • cl. 11 — renew BEFORE expiry; a renewal made within one month after expiry is accepted with an
 *             additional fee (11(3)); after that the letter is deemed to have lapsed on the expiry date
 *             and any business since is in contravention of cl. 7 (11(5)).
 * Under DBT the fertiliser subsidy is released to the manufacturer on PoS sales, not to the dealer —
 * so the claim register here is a GENERAL scheme register (founder 2026-10-25): the scheme, rate and
 * ledgers are the society's own entries; nothing is hard-coded. Tested by scripts/test-marketing.mjs.
 */
import { toMinor, toRupees, addMinor, subMinor } from '@/lib/money';

export const SCHEME_CLAIM_REF_TYPE = 'scheme.claim';
export const SCHEME_RECEIPT_REF_TYPE = 'scheme.claim.receipt';

export interface DealerLicence {
  id: string;
  kind: 'authorisation' | 'sourceCertificate';   // Form A2 authorisation letter | Form O certificate of source
  productGroup?: string;                         // fertiliser / seed / pesticide …
  licenceNo?: string;
  authority?: string;
  issuedOn?: string;                             // YYYY-MM-DD
  validUpto?: string;                            // YYYY-MM-DD
  supplierId?: string;
  sourceName?: string;                           // Form O: the source (manufacturer / pool agency / wholesaler)
  note?: string;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SchemeClaim {
  id: string;
  claimNo: string;
  date: string;
  schemeName: string;
  authority?: string;
  period?: string;
  amount: number;
  creditAccountId: string;
  receivableAccountId: string;
  voucherId?: string;
  note?: string;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const parse = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)); };
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const isDate = (s?: string): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** cl. 10 — suggested validity: three years from issue (the last valid day is the day before the anniversary). */
export function suggestedValidUpto(issuedOn?: string): string | undefined {
  if (!isDate(issuedOn)) return undefined;
  const d = parse(issuedOn);
  d.setUTCFullYear(d.getUTCFullYear() + 3);
  d.setUTCDate(d.getUTCDate() - 1);
  return fmt(d);
}

/** One calendar month after a date (cl. 11(3) / (5) grace window). */
export function oneMonthAfter(date: string): string {
  const d = parse(date);
  const day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return fmt(d);
}

export type LicenceStatus = 'valid' | 'expiring' | 'grace' | 'lapsed' | 'unknown';
/**
 * 'expiring' = within `warnDays` of the last valid day (renew now — cl. 11(1) says BEFORE expiry);
 * 'grace'    = expired, but within one month: renewal still possible with the additional fee (cl. 11(3));
 * 'lapsed'   = more than one month after expiry: deemed lapsed, selling is a contravention (cl. 11(5)).
 */
export function licenceStatus(validUpto: string | undefined, today: string, warnDays = 30): LicenceStatus {
  if (!isDate(validUpto) || !isDate(today)) return 'unknown';
  if (today <= validUpto) {
    const days = Math.round((parse(validUpto).getTime() - parse(today).getTime()) / 86400000);
    return days <= warnDays ? 'expiring' : 'valid';
  }
  return today <= oneMonthAfter(validUpto) ? 'grace' : 'lapsed';
}

export const LICENCE_STATUS_TEXT: Record<LicenceStatus, { hi: string; en: string }> = {
  valid: { hi: 'वैध', en: 'Valid' },
  expiring: { hi: 'जल्द समाप्त — अभी नवीनीकरण करें', en: 'Expiring — renew now' },
  grace: { hi: 'समाप्त — 1 माह के भीतर अतिरिक्त शुल्क के साथ नवीनीकरण संभव (cl. 11(3))', en: 'Expired — renewable within one month with additional fee (cl. 11(3))' },
  lapsed: { hi: 'व्यपगत (lapsed) — बिक्री FCO cl. 7 का उल्लंघन (cl. 11(5))', en: 'Lapsed — selling contravenes FCO cl. 7 (cl. 11(5))' },
  unknown: { hi: 'वैधता तारीख नहीं', en: 'No validity date' },
};

/** Licences that need attention (expiring / grace / lapsed), most urgent first. */
export function licenceAlerts(licences: ReadonlyArray<DealerLicence>, today: string, warnDays = 30): Array<{ licence: DealerLicence; status: LicenceStatus }> {
  const rank: Record<LicenceStatus, number> = { lapsed: 0, grace: 1, expiring: 2, valid: 9, unknown: 9 };
  return licences.filter(l => !l.isDeleted)
    .map(l => ({ licence: l, status: licenceStatus(l.validUpto, today, warnDays) }))
    .filter(x => rank[x.status] < 9)
    .sort((a, b) => rank[a.status] - rank[b.status] || (a.licence.validUpto || '').localeCompare(b.licence.validUpto || ''));
}

/** Scheme claim: received = Σ live receipt vouchers for the claim; outstanding = amount − received. */
export function schemeClaimBalance(claim: Pick<SchemeClaim, 'id' | 'amount'>, receipts: ReadonlyArray<{ refId?: string; amount: number }>): { received: number; outstanding: number } {
  const rec = receipts.filter(r => r.refId === claim.id).reduce((m, r) => addMinor(m, toMinor(Number(r.amount) || 0)), 0);
  return { received: toRupees(rec), outstanding: toRupees(subMinor(toMinor(claim.amount), rec)) };
}

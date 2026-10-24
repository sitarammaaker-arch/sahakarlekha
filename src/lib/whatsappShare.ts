/**
 * WhatsApp share — batch 1 (receipt voucher, sale bill, member account). PURE: builds the Hindi-first
 * message a staff member sends from their own WhatsApp via a wa.me link. No API, nothing is sent
 * automatically — the user reviews the text and presses Send.
 *
 * The wa.me link carries its text IN THE URL (browser history, wa.me logs), so these messages hold only
 * what the recipient already owns: names, numbers, amounts. Never a PIN, Aadhaar, PAN, bank account
 * number or the free-text narration (it can hold anything). Same rule as the portal hand-out (H-6).
 *
 * Tested by scripts/test-whatsapp-share.mjs.
 */
import { whatsappLink } from './memberPortalHandout.ts';

export { whatsappLink };

/** ₹1,23,456.50 — Indian grouping, always two decimals. */
export function rupees(n: number): string {
  const v = Number(n) || 0;
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const greet = (name?: string) => (name?.trim() ? `नमस्ते ${name.trim()} जी,` : 'नमस्ते,');
const signOff = (societyName?: string) => (societyName?.trim() ? [``, `— ${societyName.trim()}`] : []);

/** Only a real, posted receipt is worth telling anyone about: not cancelled, not pending/rejected approval. */
export function canShareReceipt(v: { type?: string; isDeleted?: boolean; approvalStatus?: string }): boolean {
  return v.type === 'receipt' && !v.isDeleted && v.approvalStatus !== 'pending' && v.approvalStatus !== 'rejected';
}

export function receiptMessage(p: {
  partyName?: string; societyName?: string; voucherNo: string; date: string; amount: number;
  /** What the money was for — the credit account name(s) (e.g. "शेयर पूँजी"). Optional. */
  head?: string;
  /** Bill numbers this receipt settles (bill-wise receipt / cash sale). */
  againstBills?: string[];
}): string {
  const bills = (p.againstBills ?? []).map(b => b.trim()).filter(Boolean);
  return [
    greet(p.partyName),
    `आपके ${rupees(p.amount)} समिति में जमा हो गए हैं।`,
    ``,
    `रसीद नं.: ${p.voucherNo}`,
    `तारीख: ${p.date}`,
    ...(bills.length ? [`बिल: ${bills.join(', ')}`] : []),
    ...(p.head?.trim() ? [`मद: ${p.head.trim()}`] : []),
    ``,
    `धन्यवाद।`,
    ...signOff(p.societyName),
  ].join('\n');
}

const MODE_HI: Record<string, string> = { cash: 'नकद', bank: 'बैंक', credit: 'उधार' };

export function saleBillMessage(p: {
  customerName?: string; societyName?: string; saleNo: string; date: string; grandTotal: number;
  paymentMode?: string; itemCount?: number;
  /** Credit bill: what is still unpaid today (bill-wise receipts applied). Absent ⇒ not known (e.g. member store credit). */
  balance?: number;
}): string {
  const credit = p.paymentMode === 'credit';
  const known = credit && typeof p.balance === 'number';
  const bal = known ? Math.max(0, Number(p.balance) || 0) : 0;
  const dueLines = !credit ? [``, `धन्यवाद।`]
    : !known ? [``, `यह उधार बिल है — कृपया समय पर भुगतान करें।`]
    : bal < 0.005 ? [``, `इस बिल का पूरा भुगतान हो चुका है। धन्यवाद।`]
    : bal < p.grandTotal - 0.005 ? [`जमा हो चुका: ${rupees(p.grandTotal - bal)}`, `अभी बाकी: ${rupees(bal)}`, ``, `कृपया बाकी राशि समय पर जमा करें।`]
    : [`अभी बाकी: ${rupees(bal)}`, ``, `कृपया समय पर भुगतान करें।`];
  return [
    greet(p.customerName),
    `आपकी खरीद का बिल:`,
    ``,
    `बिल नं.: ${p.saleNo}`,
    `तारीख: ${p.date}`,
    ...(p.itemCount ? [`सामान: ${p.itemCount} आइटम`] : []),
    `कुल राशि: ${rupees(p.grandTotal)}`,
    ...(p.paymentMode && MODE_HI[p.paymentMode] ? [`भुगतान: ${MODE_HI[p.paymentMode]}`] : []),
    ...dueLines,
    ...signOff(p.societyName),
  ].join('\n');
}

export interface MemberAccountFigures {
  shareBalance?: number;
  depositTotal?: number;
  loanOutstanding?: number;
  kccOutstanding?: number;
  interestDue?: number;
  consumerOutstanding?: number;
  housingOutstanding?: number;
  dividendDue?: number;
  milkDue?: number;
}

/** The distinct credit heads of a receipt, joined — "ऋण, ब्याज" for a principal + interest receipt; at most 3. */
export function receiptHead(names: (string | undefined)[]): string | undefined {
  const uniq = [...new Set(names.map(n => n?.trim()).filter((n): n is string => !!n))];
  if (!uniq.length) return undefined;
  return uniq.length > 3 ? `${uniq.slice(0, 3).join(', ')} आदि` : uniq.join(', ');
}

/** Lines in a fixed order; a zero (or absent) figure is left out so the message stays short. */
// Same labels and order as the summary cards on Member-360 / the portal (MemberAccountView), so the
// member can match the message line for line with what they see.
const FIGURE_LINES: [keyof MemberAccountFigures, string][] = [
  ['shareBalance', 'शेयर पूँजी'],
  ['loanOutstanding', 'ऋण बकाया'],
  ['depositTotal', 'कुल जमा'],
  ['kccOutstanding', 'KCC बकाया'],
  ['interestDue', 'ऋण पर प्राप्य ब्याज'],
  ['milkDue', 'दूध भुगतान बाकी (आपको मिलना है)'],
  ['housingOutstanding', 'रखरखाव बकाया'],
  ['consumerOutstanding', 'दुकान उधार'],
  ['dividendDue', 'लाभांश बाकी (आपको मिलना है)'],
];

export function memberAccountMessage(p: {
  memberName: string; memberNo: string; societyName?: string; asOf: string;
  figures: MemberAccountFigures;
  /** Member-portal link — only when the member actually has an active portal login. */
  portalUrl?: string;
}): string {
  const lines = FIGURE_LINES
    .filter(([k]) => Math.abs(Number(p.figures[k]) || 0) >= 0.005)
    .map(([k, label]) => `${label}: ${rupees(Number(p.figures[k]))}`);
  return [
    greet(p.memberName),
    `${p.asOf} तक आपके खाते का हिसाब:`,
    `सदस्य संख्या: ${p.memberNo}`,
    ``,
    ...(lines.length ? lines : ['कोई बकाया या जमा नहीं।']),
    ...(p.portalUrl ? [``, `पूरा हिसाब सदस्य portal पर देखें:`, `🔗 ${p.portalUrl}`] : []),
    ``,
    `कोई अंतर लगे तो समिति कार्यालय से संपर्क करें।`,
    ...signOff(p.societyName),
  ].join('\n');
}

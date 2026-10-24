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
  /** What the money was for — the credit account's name (e.g. "शेयर पूंजी"). Optional. */
  head?: string;
}): string {
  return [
    greet(p.partyName),
    `आपके ${rupees(p.amount)} समिति में जमा हो गए हैं।`,
    ``,
    `रसीद नं.: ${p.voucherNo}`,
    `तारीख: ${p.date}`,
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
}): string {
  const credit = p.paymentMode === 'credit';
  return [
    greet(p.customerName),
    `आपकी खरीद का बिल:`,
    ``,
    `बिल नं.: ${p.saleNo}`,
    `तारीख: ${p.date}`,
    ...(p.itemCount ? [`सामान: ${p.itemCount} आइटम`] : []),
    `कुल राशि: ${rupees(p.grandTotal)}`,
    ...(p.paymentMode && MODE_HI[p.paymentMode] ? [`भुगतान: ${MODE_HI[p.paymentMode]}`] : []),
    ...(credit ? [``, `यह राशि आपके खाते में बकाया है — कृपया समय पर जमा करें।`] : [``, `धन्यवाद।`]),
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
}

/** Lines in a fixed order; a zero (or absent) figure is left out so the message stays short. */
const FIGURE_LINES: [keyof MemberAccountFigures, string][] = [
  ['shareBalance', 'शेयर पूंजी'],
  ['depositTotal', 'कुल जमा'],
  ['loanOutstanding', 'ऋण बकाया'],
  ['kccOutstanding', 'KCC बकाया'],
  ['interestDue', 'ब्याज देय'],
  ['consumerOutstanding', 'उधार ख़रीद बकाया'],
  ['housingOutstanding', 'रखरखाव बकाया'],
  ['dividendDue', 'लाभांश देय (आपको मिलना है)'],
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

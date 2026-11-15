/**
 * Ledger-head resolvers for ids whose MEANING differs between society charts. PURE.
 *
 * The posting code addresses a few heads by a fixed id. Two of those ids are not the same head everywhere
 * (read-only production check 2026-10-03):
 *   2108  Fixed Deposits from Members (PACS)   ≠   Advance Maintenance Collected (housing, 3 societies)
 *   2207  Professional Tax Payable (CMS …)     ≠   Property Tax Payable (housing, 3 societies)
 * and 25 of 30 societies have no 2108 at all. Posting an FD or a salary's professional tax by bare id therefore
 * either lands in an unrelated liability or fails the posting service's account foreign key.
 *
 * Rule (same shape as lib/loans/accounts.ts): the exact id wins ONLY when that account really is the head —
 * a liability LEAF whose name says so. Otherwise a liability leaf whose name says so, by id order. Otherwise null,
 * and the caller must refuse and tell the user which account to add (never post to a guess).
 */
import type { LedgerAccount } from '@/types';
import { tr } from '../uiLang.ts';

export type HeadAccount = Pick<LedgerAccount, 'id' | 'name' | 'nameHi' | 'type' | 'isGroup'>;

export const FD_ACCOUNT_ID = '2108';
export const PT_ACCOUNT_ID = '2207';
export const TDS_PAYABLE_ACCOUNT_ID = '2202';
export const PENALTY_ACCOUNT_ID = '5605';
export const SHARE_REFUND_PAYABLE_ACCOUNT_ID = '2111';

const text = (a: HeadAccount) => `${a.name} ${a.nameHi ?? ''}`.toLowerCase();

/** "Fixed Deposits from Members" / FDR / term deposit / सावधि जमा — but not an advance, maintenance or security head. */
const FD_NAME = /fixed deposit|\bfdr?\b|term deposit|सावधि/;
const FD_EXCLUDE = /maintenance|रखरखाव|security|सुरक्षा|advance|अग्रिम/;
/** Professional Tax / व्यावसायिक कर — but not property / municipal tax. */
const PT_NAME = /professional tax|profession tax|व्यावसायिक कर|व्यवसाय कर/;
const PT_EXCLUDE = /property|municipal|संपत्ति|नगरपालिका/;

/** TDS Payable (the liability the society owes the tax department) — not the TDS/TCS *receivable* asset. */
const TDS_NAME = /\btds\b|tax deducted|टीडीएस|स्रोत पर कर/;
const TDS_EXCLUDE = /receivable|प्राप्य|\btcs\b/;
/** Penalty / fine / late-charge expense — where interest and fees on a late tax deposit are booked. */
const PENALTY_NAME = /penalt|\bfine\b|late fee|दंड|जुर्माना/;
/** Share Refund Payable / शेयर वापसी देय — a liability, not the share capital itself. */
const SHARE_REFUND_NAME = /share refund|refund of share|शेयर वापसी|शेयर पूँजी वापसी|शेयर पूंजी वापसी/;
const NO_EXCLUDE = /(?!)/;

type Leaf = 'liability' | 'expense';
const isLeaf = (a: HeadAccount, type: Leaf) => !a.isGroup && a.type === type;

function resolve(accounts: ReadonlyArray<HeadAccount>, id: string, include: RegExp, exclude: RegExp, type: Leaf = 'liability'): string | null {
  const meets = (a: HeadAccount) => isLeaf(a, type) && include.test(text(a)) && !exclude.test(text(a));
  const exact = accounts.find((a) => a.id === id);
  if (exact && meets(exact)) return exact.id;
  const byName = accounts.filter(meets).sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))[0];
  return byName?.id ?? null;
}

/** Liability head for fixed deposits taken from members, or null when the chart has none. */
export function fixedDepositAccountId(accounts: ReadonlyArray<HeadAccount>): string | null {
  return resolve(accounts, FD_ACCOUNT_ID, FD_NAME, FD_EXCLUDE);
}

/** Liability head for professional tax withheld from salaries, or null when the chart has none. */
export function professionalTaxAccountId(accounts: ReadonlyArray<HeadAccount>): string | null {
  return resolve(accounts, PT_ACCOUNT_ID, PT_NAME, PT_EXCLUDE);
}

/** Liability head for tax deducted at source that is owed to the tax department, or null when the chart has none. */
export function tdsPayableAccountId(accounts: ReadonlyArray<HeadAccount>): string | null {
  return resolve(accounts, TDS_PAYABLE_ACCOUNT_ID, TDS_NAME, TDS_EXCLUDE);
}

/** Expense head for penalties / fines / late charges (interest and fees on a late TDS deposit), or null. */
export function penaltyAccountId(accounts: ReadonlyArray<HeadAccount>): string | null {
  return resolve(accounts, PENALTY_ACCOUNT_ID, PENALTY_NAME, NO_EXCLUDE, 'expense');
}

/** Liability head for a share refund that is approved but not yet paid (the member has left, the society still owes), or null. */
export function shareRefundPayableAccountId(accounts: ReadonlyArray<HeadAccount>): string | null {
  return resolve(accounts, SHARE_REFUND_PAYABLE_ACCOUNT_ID, SHARE_REFUND_NAME, NO_EXCLUDE);
}

/** A toast whose text follows the reader's language at the moment it is read (spread into toast() at event time). */
const headToast = (titleHi: string, titleEn: string, descHi: string, descEn: string) => ({
  get title() { return tr(titleHi, titleEn); },
  get description() { return tr(descHi, descEn); },
});

/** What the user is told when a head cannot be resolved (Hindi-first, RULE 7). Nothing is posted in that case. */
export const MISSING_HEAD_TOAST = {
  fd: headToast(
    'FD का देयता खाता नहीं मिला',
    'FD liability account not found',
    "इस सोसाइटी के चार्ट में 'Fixed Deposits from Members' (देयता) खाता नहीं है। Ledger Heads में यह खाता जोड़ें, फिर FD दोबारा चलाएँ। कोई वाउचर नहीं बना।",
    "This society's chart has no 'Fixed Deposits from Members' (liability) account. Add it in Ledger Heads, then run the FD again. No voucher was made.",
  ),
  pt: headToast(
    'वेतन सेव नहीं हुआ',
    'Salary not saved',
    "Professional Tax काटा गया है, पर चार्ट में 'Professional Tax Payable' (देयता) खाता नहीं है (2207 यहाँ किसी और अर्थ में है)। Ledger Heads में वह खाता जोड़ें, फिर वेतन दोबारा बनाएँ।",
    "Professional Tax is deducted, but the chart has no 'Professional Tax Payable' (liability) account (2207 means something else here). Add that account in Ledger Heads, then make the salary again.",
  ),
  tds: headToast(
    'देय TDS का खाता नहीं मिला',
    'TDS Payable account not found',
    "इस सोसाइटी के चार्ट में 'TDS Payable' (देयता) खाता नहीं है। Ledger Heads में यह खाता जोड़ें, फिर चालान दोबारा जोड़ें। कोई वाउचर नहीं बना।",
    "This society's chart has no 'TDS Payable' (liability) account. Add it in Ledger Heads, then add the challan again. No voucher was made.",
  ),
  penalty: headToast(
    'दंड / ब्याज का व्यय-खाता नहीं मिला',
    'Penalty / interest expense account not found',
    "चालान में ब्याज या अन्य शुल्क है, पर चार्ट में 'Penalty / Fine' (व्यय) खाता नहीं है। Ledger Heads में वह खाता जोड़ें, या ब्याज/शुल्क शून्य रखें। कोई वाउचर नहीं बना।",
    "The challan has interest or another charge, but the chart has no 'Penalty / Fine' (expense) account. Add that account in Ledger Heads, or keep interest/charges at zero. No voucher was made.",
  ),
  shareRefund: headToast(
    'शेयर वापसी देय का खाता नहीं मिला',
    'Share Refund Payable account not found',
    "इस सोसाइटी के चार्ट में 'Share Refund Payable' (देयता) खाता नहीं है। Ledger Heads में यह खाता जोड़ें, फिर दोबारा चलाएँ। कोई वाउचर नहीं बना।",
    "This society's chart has no 'Share Refund Payable' (liability) account. Add it in Ledger Heads, then run it again. No voucher was made.",
  ),
  deposit: headToast(
    'जमा का देयता खाता नहीं मिला',
    'Deposit liability account not found',
    "इस सोसाइटी के चार्ट में 'Member Deposits' (2107, देयता) खाता नहीं है। Ledger Heads में यह खाता जोड़ें, फिर दोबारा चलाएँ। कोई वाउचर नहीं बना।",
    "This society's chart has no 'Member Deposits' (2107, liability) account. Add it in Ledger Heads, then run it again. No voucher was made.",
  ),
} as const;

/** The refusal toast for a deposit product: FD names the FD head, the rest name the member-deposit head. */
export const missingDepositHeadToast = (type: string) => (type === 'FD' ? MISSING_HEAD_TOAST.fd : MISSING_HEAD_TOAST.deposit);

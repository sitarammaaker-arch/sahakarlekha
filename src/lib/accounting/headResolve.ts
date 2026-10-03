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

export type HeadAccount = Pick<LedgerAccount, 'id' | 'name' | 'nameHi' | 'type' | 'isGroup'>;

export const FD_ACCOUNT_ID = '2108';
export const PT_ACCOUNT_ID = '2207';

const text = (a: HeadAccount) => `${a.name} ${a.nameHi ?? ''}`.toLowerCase();

/** "Fixed Deposits from Members" / FDR / term deposit / सावधि जमा — but not an advance, maintenance or security head. */
const FD_NAME = /fixed deposit|\bfdr?\b|term deposit|सावधि/;
const FD_EXCLUDE = /maintenance|रखरखाव|security|सुरक्षा|advance|अग्रिम/;
/** Professional Tax / व्यावसायिक कर — but not property / municipal tax. */
const PT_NAME = /professional tax|profession tax|व्यावसायिक कर|व्यवसाय कर/;
const PT_EXCLUDE = /property|municipal|संपत्ति|नगरपालिका/;

const isLiabilityLeaf = (a: HeadAccount) => !a.isGroup && a.type === 'liability';

function resolve(accounts: ReadonlyArray<HeadAccount>, id: string, include: RegExp, exclude: RegExp): string | null {
  const meets = (a: HeadAccount) => isLiabilityLeaf(a) && include.test(text(a)) && !exclude.test(text(a));
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

/** What the user is told when a head cannot be resolved (Hindi-first, RULE 7). Nothing is posted in that case. */
export const MISSING_HEAD_TOAST = {
  fd: {
    title: 'FD का देयता खाता नहीं मिला',
    description: "इस सोसाइटी के चार्ट में 'Fixed Deposits from Members' (देयता) खाता नहीं है। Ledger Heads में यह खाता जोड़ें, फिर FD दोबारा चलाएँ। कोई वाउचर नहीं बना।",
  },
  pt: {
    title: 'वेतन सेव नहीं हुआ',
    description: "Professional Tax काटा गया है, पर चार्ट में 'Professional Tax Payable' (देयता) खाता नहीं है (2207 यहाँ किसी और अर्थ में है)। Ledger Heads में वह खाता जोड़ें, फिर वेतन दोबारा बनाएँ।",
  },
  deposit: {
    title: 'जमा का देयता खाता नहीं मिला',
    description: "इस सोसाइटी के चार्ट में 'Member Deposits' (2107, देयता) खाता नहीं है। Ledger Heads में यह खाता जोड़ें, फिर दोबारा चलाएँ। कोई वाउचर नहीं बना।",
  },
} as const;

/** The refusal toast for a deposit product: FD names the FD head, the rest name the member-deposit head. */
export const missingDepositHeadToast = (type: string) => (type === 'FD' ? MISSING_HEAD_TOAST.fd : MISSING_HEAD_TOAST.deposit);

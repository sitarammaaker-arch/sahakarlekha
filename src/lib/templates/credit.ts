/**
 * Thrift & Credit Cooperative Society — the head such a society needs ON TOP of the CMS chart
 * (storage.ts composes: CMS_SOCIETY_ACCOUNTS + these). A Credit Cooperative Society uses the CMS chart as it is.
 *
 * Everything the loan and deposit screens post to already comes from the CMS chart and is NOT repeated here:
 *   2107 Member Deposits (SB / RD / pigmy)   2108 Fixed Deposits from Members
 *   3304 Loans & Advances (member loans)     3313 Member Loan Interest Rec.
 *   4408 Interest on Member Loans            5604 Interest on Borrowings (deposit interest is booked here)
 *
 * The one addition is the compulsory deposit: what makes a "thrift" society is that its bye-laws raise a
 * compulsory deposit from every member (the U.P. Co-operative Societies Rules, 1968 define a "Co-operative
 * Credit and Thrift Society" by exactly that). It is a liability to members, kept apart from voluntary
 * savings so the two can be reported separately. Nothing posts to it automatically — it is used from the
 * voucher screen.
 */
import type { LedgerAccount } from '@/types';

export const THRIFT_CREDIT_EXTRA_ACCOUNTS: LedgerAccount[] = [
  { id: '2112', name: 'Compulsory (Thrift) Deposits from Members', nameHi: 'सदस्यों की अनिवार्य (थ्रिफ्ट) जमा', type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2100', subtype: 'deposit' },
];

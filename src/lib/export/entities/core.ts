/**
 * Export Registry — core accounting entities (T-06).
 *
 * Declares: society_settings, accounts, vouchers, voucher_entries.
 *
 * `voucher_entry` is the one that matters. It is the relational double-entry mirror,
 * DERIVED from `vouchers` by the posting engine. It carries backupPolicy 'replay':
 * exported as a checksum, NEVER restored as rows. Restoring it directly would create
 * two sources for one number — the exact RULE 2 failure. Restore regenerates it and
 * asserts the result equals the exported copy (blueprint §6.5).
 *
 * Column keys mirror the Supabase column names (quoted camelCase in supabase-tables.sql).
 * `society_id` is deliberately NOT declared: it is tenant scoping, not society data.
 *
 * Type-only imports here — scripts/test-export-registry.mjs imports this file directly
 * under Node's type stripping, so a runtime import would break the test.
 */
import type { ColumnDescriptor, EntityDescriptor } from '../registry.types';

/** Terse column builders. Default: visible, non-PII string. */
const c = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  ({ key, header, headerHi, type: 'string', piiClass: 'none', defaultVisible: true, ...over });

const money = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  c(key, header, headerHi, { type: 'currency', ...over });

/** Internal plumbing: exported for fidelity, hidden from the column picker by default. */
const internal = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  c(key, header, headerHi, { defaultVisible: false, ...over });

// ─── society_settings ────────────────────────────────────────────────────────────────
// Singleton row. Carries the approval matrix, period lock, board members, signatories
// and subscription — governance config, not ledger data. Admin-only.
const society: EntityDescriptor = {
  key: 'society',
  table: 'society_settings',
  domain: 'core',
  label: 'Society Settings',
  labelHi: 'समिति सेटिंग्स',
  minRole: 'admin',
  scope: 'society',
  nature: 'master',
  dependsOn: [],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी'),
    c('name', 'Society Name', 'समिति का नाम'),
    c('nameHi', 'Name (Hindi)', 'नाम (हिन्दी)'),
    c('registrationNo', 'Registration No.', 'पंजीकरण संख्या'),
    c('societyType', 'Society Type', 'समिति प्रकार', { type: 'enum' }),
    c('financialYear', 'Financial Year', 'वित्तीय वर्ष'),
    c('financialYearStart', 'FY Start', 'वित्तीय वर्ष प्रारंभ', { type: 'date' }),
    c('previousFinancialYear', 'Previous FY', 'पिछला वित्तीय वर्ष'),
    c('address', 'Address', 'पता', { piiClass: 'contact' }),
    c('district', 'District', 'ज़िला'),
    c('state', 'State', 'राज्य'),
    c('pinCode', 'PIN Code', 'पिन कोड'),
    c('phone', 'Phone', 'फ़ोन', { piiClass: 'contact' }),
    c('email', 'Email', 'ईमेल', { piiClass: 'contact' }),
    internal('previousYearBalances', 'Previous Year Balances', 'पिछले वर्ष के शेष', { type: 'json' }),
    internal('boardType', 'Board Type', 'बोर्ड प्रकार', { type: 'enum' }),
    internal('boardMembers', 'Board Members', 'बोर्ड सदस्य', { type: 'json', piiClass: 'contact' }),
    internal('signatories', 'Signatories', 'हस्ताक्षरकर्ता', { type: 'json', piiClass: 'contact' }),
    internal('approvalRequired', 'Approval Required', 'अनुमोदन आवश्यक', { type: 'boolean' }),
    internal('approvalThresholdAmount', 'Approval Threshold', 'अनुमोदन सीमा', { type: 'currency' }),
    internal('approvalVoucherTypes', 'Approval Voucher Types', 'अनुमोदन वाउचर प्रकार', { type: 'json' }),
    internal('is_locked', 'FY Locked', 'वित्तीय वर्ष लॉक', { type: 'boolean' }),
    internal('periodLockDate', 'Period Lock Date', 'अवधि लॉक तिथि', { type: 'date' }),
    internal('periodLockBy', 'Period Locked By', 'अवधि लॉक द्वारा'),
    internal('fyUnlockRequestedAt', 'FY Unlock Requested At', 'अनलॉक अनुरोध समय', { type: 'date' }),
    internal('fyUnlockRequestedBy', 'FY Unlock Requested By', 'अनलॉक अनुरोध द्वारा'),
    internal('storageLossNormPct', 'Storage Loss Norm %', 'भंडारण हानि मानक %', { type: 'number' }),
    internal('maxSharePremiumPercent', 'Max Share Premium %', 'अधिकतम शेयर प्रीमियम %', { type: 'number' }),
    internal('notificationChannels', 'Notification Channels', 'सूचना चैनल', { type: 'json' }),
    internal('plan', 'Plan', 'योजना', { type: 'enum' }),
    internal('plan_expires_at', 'Plan Expires', 'योजना समाप्ति', { type: 'date' }),
    internal('trial_ends_at', 'Trial Ends', 'ट्रायल समाप्ति', { type: 'date' }),
    internal('subscription_notes', 'Subscription Notes', 'सदस्यता टिप्पणी'),
    internal('created_at', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

// ─── accounts ────────────────────────────────────────────────────────────────────────
// The chart of accounts. No soft delete: deleteAccount hard-deletes, but blocks any
// account referenced by a live voucher (RULE 3 / H10).
const account: EntityDescriptor = {
  key: 'account',
  table: 'accounts',
  domain: 'core',
  label: 'Chart of Accounts',
  labelHi: 'खाता शीर्षक',
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'Account Code', 'खाता कोड'),
    c('name', 'Account Name', 'खाता नाम'),
    c('nameHi', 'Name (Hindi)', 'नाम (हिन्दी)'),
    c('type', 'Type', 'प्रकार', { type: 'enum' }),
    c('subtype', 'Sub-type', 'उप-प्रकार', { type: 'enum' }),
    money('openingBalance', 'Opening Balance', 'ओपनिंग बैलेंस'),
    c('openingBalanceType', 'Dr / Cr', 'नामे / जमा', { type: 'enum' }),
    c('parentId', 'Parent Group', 'मूल समूह'),
    c('isGroup', 'Is Group', 'समूह है', { type: 'boolean' }),
    internal('isSystem', 'System Account', 'सिस्टम खाता', { type: 'boolean' }),
  ],
};

// ─── vouchers ────────────────────────────────────────────────────────────────────────
// The ledger. Soft-deleted (RULE 5) — cancelled vouchers must still export for audit,
// which is why `isDeleted` is a declared column and not a filter baked into the query.
const voucher: EntityDescriptor = {
  key: 'voucher',
  table: 'vouchers',
  domain: 'core',
  label: 'Vouchers',
  labelHi: 'वाउचर',
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'account', 'member'],
  naturalKey: ['voucherNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('voucherNo', 'Voucher No.', 'वाउचर संख्या'),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    c('type', 'Voucher Type', 'वाउचर प्रकार', { type: 'enum' }),
    c('narration', 'Narration', 'विवरण'),
    money('amount', 'Amount', 'राशि'),
    c('debitAccountId', 'Debit Account', 'नामे खाता'),
    c('creditAccountId', 'Credit Account', 'जमा खाता'),
    c('memberId', 'Member', 'सदस्य'),
    internal('lines', 'Voucher Lines', 'वाउचर पंक्तियाँ', { type: 'json' }),
    internal('billAllocations', 'Bill Allocations', 'बिल आवंटन', { type: 'json' }),
    internal('refType', 'Reference Type', 'संदर्भ प्रकार', { type: 'enum' }),
    internal('refId', 'Reference ID', 'संदर्भ आईडी'),
    internal('origin', 'Origin', 'स्रोत', { type: 'enum' }),
    internal('groupId', 'Group ID', 'समूह आईडी'),
    internal('branchId', 'Branch', 'शाखा'),
    internal('workOrderId', 'Work Order', 'कार्य आदेश'),
    internal('costCentreId', 'Cost Centre', 'लागत केंद्र'),
    c('isDeleted', 'Cancelled', 'रद्द', { type: 'boolean', defaultVisible: false }),
    internal('deletedAt', 'Cancelled At', 'रद्द समय', { type: 'date' }),
    internal('deletedBy', 'Cancelled By', 'रद्द द्वारा'),
    internal('deletedReason', 'Cancellation Reason', 'रद्द कारण'),
    internal('reversalOf', 'Reversal Of', 'प्रतिवर्तन का'),
    internal('reversedBy', 'Reversed By', 'प्रतिवर्तित द्वारा'),
    internal('approvalStatus', 'Approval Status', 'अनुमोदन स्थिति', { type: 'enum' }),
    internal('approvedBy', 'Approved By', 'अनुमोदक'),
    internal('approvedAt', 'Approved At', 'अनुमोदन समय', { type: 'date' }),
    internal('approvalRemarks', 'Approval Remarks', 'अनुमोदन टिप्पणी'),
    internal('isCleared', 'Bank Cleared', 'बैंक क्लियर', { type: 'boolean' }),
    internal('clearedDate', 'Cleared Date', 'क्लियर तिथि', { type: 'date' }),
    internal('editHistory', 'Edit History', 'संपादन इतिहास', { type: 'json' }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
    internal('createdBy', 'Created By', 'निर्माता'),
  ],
};

// ─── voucher_entries — DERIVED, REPLAY-ONLY ──────────────────────────────────────────
// One row per Dr/Cr leg, generated by the posting engine from `vouchers`.
// nature: 'derived' ⇒ validateRegistry FORCES backupPolicy 'replay'. It is exported so a
// restore can assert the replayed ledger matches byte-for-byte, and it is never inserted.
const voucherEntry: EntityDescriptor = {
  key: 'voucher_entry',
  table: 'voucher_entries',
  domain: 'core',
  label: 'Voucher Entries (derived)',
  labelHi: 'वाउचर प्रविष्टियाँ (व्युत्पन्न)',
  minRole: 'accountant',
  scope: 'society',
  nature: 'derived',
  dependsOn: ['voucher', 'account'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'replay',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('voucherId', 'Voucher', 'वाउचर'),
    c('accountId', 'Account', 'खाता'),
    money('dr', 'Debit', 'नामे'),
    money('cr', 'Credit', 'जमा'),
    c('narration', 'Narration', 'विवरण'),
    internal('costCentreId', 'Cost Centre', 'लागत केंद्र'),
    internal('workOrderId', 'Work Order', 'कार्य आदेश'),
  ],
};

export const CORE_ENTITIES: EntityDescriptor[] = [society, account, voucher, voucherEntry];

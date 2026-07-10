/**
 * Export Registry — dairy cooperative entities (T-10).
 *
 * Declares: dairy_rate_charts, milk_entries, dairy_settlements, dairy_dispatches,
 * dairy_input_issues, dairy_distributions.
 *
 * All six are gated on `dairy_collection`, matching moduleCatalog.ts exactly.
 *
 * PII. `milk_entries` and `dairy_settlements` denormalise `memberName` alongside
 * `memberId`. The name itself is not classified as PII (it is on the member register
 * too), but the member link is what lets a redacted export stay coherent.
 *
 * CACHE WARNING. `dairy_settlements.amountPaid` and `dairy_distributions.amountPaid`
 * are running totals maintained beside the payment vouchers. Hidden by default for the
 * same reason as stock_items.currentStock and deposit_accounts.balance (RULE 2).
 */
import type { ColumnDescriptor, EntityDescriptor } from '../registry.types';

const c = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  ({ key, header, headerHi, type: 'string', piiClass: 'none', defaultVisible: true, ...over });

const money = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  c(key, header, headerHi, { type: 'currency', ...over });

const num = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  c(key, header, headerHi, { type: 'number', ...over });

const internal = (key: string, header: string, headerHi: string, over: Partial<ColumnDescriptor> = {}): ColumnDescriptor =>
  c(key, header, headerHi, { defaultVisible: false, ...over });

const CAP = 'dairy_collection' as const;

// ─── dairy_rate_charts ───────────────────────────────────────────────────────────────
const rateChart: EntityDescriptor = {
  key: 'dairy_rate_chart',
  table: 'dairy_rate_charts',
  domain: 'dairy',
  label: 'Rate Charts',
  labelHi: 'दर चार्ट',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society'],
  naturalKey: ['id'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('name', 'Chart Name', 'चार्ट नाम'),
    c('basis', 'Basis', 'आधार', { type: 'enum' }),
    c('effectiveFrom', 'Effective From', 'प्रभावी तिथि', { type: 'date' }),
    c('season', 'Season', 'मौसम', { type: 'enum' }),
    internal('fatBands', 'Fat Bands', 'वसा बैंड', { type: 'json' }),
    internal('snfBands', 'SNF Bands', 'एसएनएफ बैंड', { type: 'json' }),
    internal('matrix', 'Rate Matrix', 'दर मैट्रिक्स', { type: 'json' }),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

// ─── milk_entries ────────────────────────────────────────────────────────────────────
const milkEntry: EntityDescriptor = {
  key: 'milk_entry',
  table: 'milk_entries',
  domain: 'dairy',
  label: 'Milk Collection',
  labelHi: 'दूध संग्रह',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'member', 'dairy_rate_chart'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    c('shift', 'Shift', 'पाली', { type: 'enum' }),
    c('memberId', 'Member', 'सदस्य'),
    c('memberName', 'Member Name', 'सदस्य नाम'),
    num('qty', 'Quantity (L)', 'मात्रा (ली.)'),
    num('fat', 'Fat %', 'वसा %'),
    num('snf', 'SNF %', 'एसएनएफ %'),
    internal('clr', 'CLR', 'सीएलआर', { type: 'number' }),
    internal('water', 'Water %', 'पानी %', { type: 'number' }),
    internal('qualityDecision', 'Quality Decision', 'गुणवत्ता निर्णय', { type: 'enum' }),
    money('rate', 'Rate', 'दर'),
    money('amount', 'Amount', 'राशि'),
    internal('rateChartId', 'Rate Chart', 'दर चार्ट'),
    internal('centreId', 'Centre', 'केंद्र'),
    internal('source', 'Source', 'स्रोत', { type: 'enum' }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

// ─── dairy_settlements ───────────────────────────────────────────────────────────────
const settlement: EntityDescriptor = {
  key: 'dairy_settlement',
  table: 'dairy_settlements',
  domain: 'dairy',
  label: 'Farmer Settlements (Dairy)',
  labelHi: 'किसान भुगतान (डेयरी)',
  capability: CAP,
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'member', 'voucher'],
  naturalKey: ['settlementNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('settlementNo', 'Settlement No.', 'भुगतान संख्या'),
    c('memberId', 'Member', 'सदस्य'),
    c('memberName', 'Member Name', 'सदस्य नाम'),
    c('from', 'From', 'से', { type: 'date' }),
    c('to', 'To', 'तक', { type: 'date' }),
    money('gross', 'Gross', 'सकल'),
    internal('deductionLines', 'Deduction Lines', 'कटौती पंक्तियाँ', { type: 'json' }),
    money('netPayable', 'Net Payable', 'शुद्ध देय'),
    internal('amountPaid', 'Amount Paid (cached)', 'भुगतान राशि (कैश्ड)', { type: 'currency' }),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    internal('voucherId', 'Voucher', 'वाउचर'),
    internal('approvedBy', 'Approved By', 'अनुमोदक'),
    internal('approvedAt', 'Approved At', 'अनुमोदन समय', { type: 'date' }),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

// ─── dairy_dispatches ────────────────────────────────────────────────────────────────
const dispatch: EntityDescriptor = {
  key: 'dairy_dispatch',
  table: 'dairy_dispatches',
  domain: 'dairy',
  label: 'Milk Dispatch',
  labelHi: 'दूध प्रेषण',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'voucher'],
  naturalKey: ['id'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    c('shift', 'Shift', 'पाली', { type: 'enum' }),
    c('unionName', 'Union', 'संघ'),
    num('qty', 'Quantity (L)', 'मात्रा (ली.)'),
    num('fat', 'Fat %', 'वसा %'),
    num('snf', 'SNF %', 'एसएनएफ %'),
    money('rate', 'Rate', 'दर'),
    money('amount', 'Amount', 'राशि'),
    num('shortage', 'Shortage', 'कमी'),
    c('vehicleNo', 'Vehicle No.', 'वाहन संख्या'),
    c('remarks', 'Remarks', 'टिप्पणी'),
    internal('amountReceived', 'Amount Received (cached)', 'प्राप्त राशि (कैश्ड)', { type: 'currency' }),
    internal('voucherId', 'Voucher', 'वाउचर'),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

// ─── dairy_input_issues ──────────────────────────────────────────────────────────────
const inputIssue: EntityDescriptor = {
  key: 'dairy_input_issue',
  table: 'dairy_input_issues',
  domain: 'dairy',
  label: 'Dairy Input Issues',
  labelHi: 'डेयरी इनपुट वितरण',
  capability: CAP,
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'member', 'account', 'voucher'],
  naturalKey: ['id'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    c('memberId', 'Member', 'सदस्य'),
    c('memberName', 'Member Name', 'सदस्य नाम'),
    c('inputType', 'Input Type', 'इनपुट प्रकार', { type: 'enum' }),
    c('itemName', 'Item', 'वस्तु'),
    num('qty', 'Quantity', 'मात्रा'),
    money('amount', 'Amount', 'राशि'),
    c('remarks', 'Remarks', 'टिप्पणी'),
    internal('incomeAccountId', 'Income Account', 'आय खाता'),
    internal('voucherId', 'Voucher', 'वाउचर'),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

// ─── dairy_distributions ─────────────────────────────────────────────────────────────
const distribution: EntityDescriptor = {
  key: 'dairy_distribution',
  table: 'dairy_distributions',
  domain: 'dairy',
  label: 'Dairy Distributions',
  labelHi: 'डेयरी वितरण',
  capability: CAP,
  minRole: 'accountant',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'voucher'],
  naturalKey: ['id'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('kind', 'Kind', 'प्रकार', { type: 'enum' }),
    c('from', 'From', 'से', { type: 'date' }),
    c('to', 'To', 'तक', { type: 'date' }),
    c('fyLabel', 'Financial Year', 'वित्तीय वर्ष'),
    c('basis', 'Basis', 'आधार', { type: 'enum' }),
    num('rate', 'Rate', 'दर'),
    c('resolutionNo', 'Resolution No.', 'संकल्प संख्या'),
    c('resolutionDate', 'Resolution Date', 'संकल्प तिथि', { type: 'date' }),
    internal('lines', 'Distribution Lines', 'वितरण पंक्तियाँ', { type: 'json' }),
    money('total', 'Total', 'कुल'),
    internal('amountPaid', 'Amount Paid (cached)', 'भुगतान राशि (कैश्ड)', { type: 'currency' }),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    internal('voucherId', 'Voucher', 'वाउचर'),
    internal('approvedBy', 'Approved By', 'अनुमोदक'),
    internal('approvedAt', 'Approved At', 'अनुमोदन समय', { type: 'date' }),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

export const DAIRY_ENTITIES: EntityDescriptor[] = [
  rateChart, milkEntry, settlement, dispatch, inputIssue, distribution,
];

/**
 * Export Registry — lending & deposit entities (T-08).
 *
 * Declares: loans, kcc_loans, deposit_accounts, deposit_transactions.
 *
 * Deposits live in the `lending` domain because that is how the app entitles them:
 * moduleCatalog gates the Deposits module on the `lending` capability, not a separate
 * one. Mirroring the live entitlement here keeps the Export Center from showing a
 * society an entity it cannot otherwise reach.
 *
 * NOT DECLARED: `recoverables`. The app reads and writes that table (DataContext.tsx),
 * but it has NO DDL anywhere in the repo. Declaring it would force the schema check to
 * accept a table it cannot verify. It is declared in T-12, once its DDL is written from
 * the live column list — not from a guess.
 *
 * CACHE WARNING. `deposit_accounts.balance`, `loans.repaidAmount` and
 * `kcc_loans.outstandingAmount` are running totals maintained alongside the
 * transaction rows. They are hidden by default for the same reason as
 * stock_items.currentStock (RULE 2): a column that can silently disagree with the
 * rows it summarises should never be the default thing a user exports.
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

// ─── loans ───────────────────────────────────────────────────────────────────────────
// Soft-deleted since ECR-02 (the loan register used to be hard-deleted).
const loan: EntityDescriptor = {
  key: 'loan',
  table: 'loans',
  domain: 'lending',
  label: 'Loans',
  labelHi: 'ऋण',
  capability: 'lending',
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'member'],
  naturalKey: ['loanNo'],
  softDeleteField: 'isDeleted',
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('loanNo', 'Loan No.', 'ऋण संख्या'),
    c('memberId', 'Member', 'सदस्य'),
    c('loanType', 'Loan Type', 'ऋण प्रकार', { type: 'enum' }),
    c('purpose', 'Purpose', 'उद्देश्य'),
    money('amount', 'Loan Amount', 'ऋण राशि'),
    num('interestRate', 'Interest Rate %', 'ब्याज दर %'),
    c('disbursementDate', 'Disbursement Date', 'वितरण तिथि', { type: 'date' }),
    c('dueDate', 'Due Date', 'देय तिथि', { type: 'date' }),
    // Running total — reconcile against repayment vouchers, not this column.
    internal('repaidAmount', 'Repaid (cached)', 'चुकाया गया (कैश्ड)', { type: 'currency' }),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    c('security', 'Security', 'प्रतिभूति'),
    c('isDeleted', 'Deleted', 'हटाया गया', { type: 'boolean', defaultVisible: false }),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

// ─── kcc_loans ───────────────────────────────────────────────────────────────────────
const kccLoan: EntityDescriptor = {
  key: 'kcc_loan',
  table: 'kcc_loans',
  domain: 'lending',
  label: 'KCC Loans',
  labelHi: 'केसीसी ऋण',
  capability: 'lending',
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'member', 'voucher'],
  naturalKey: ['loanNo'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('loanNo', 'Loan No.', 'ऋण संख्या'),
    c('memberId', 'Member', 'सदस्य'),
    c('memberName', 'Member Name', 'सदस्य नाम'),
    c('cropName', 'Crop', 'फसल'),
    c('cropSeason', 'Season', 'मौसम', { type: 'enum' }),
    num('landAreaHectares', 'Land Area (Ha)', 'भूमि क्षेत्र (है.)'),
    money('sanctionedAmount', 'Sanctioned', 'स्वीकृत राशि'),
    money('drawnAmount', 'Drawn', 'आहरित राशि'),
    internal('repaidAmount', 'Repaid (cached)', 'चुकाया गया (कैश्ड)', { type: 'currency' }),
    internal('outstandingAmount', 'Outstanding (cached)', 'बकाया (कैश्ड)', { type: 'currency' }),
    num('interestRate', 'Interest Rate %', 'ब्याज दर %'),
    c('disbursementDate', 'Disbursement Date', 'वितरण तिथि', { type: 'date' }),
    c('dueDate', 'Due Date', 'देय तिथि', { type: 'date' }),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    c('narration', 'Narration', 'विवरण'),
    internal('voucherId', 'Voucher', 'वाउचर'),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
    internal('createdBy', 'Created By', 'निर्माता'),
  ],
};

// ─── deposit_accounts ────────────────────────────────────────────────────────────────
const depositAccount: EntityDescriptor = {
  key: 'deposit_account',
  table: 'deposit_accounts',
  domain: 'lending',
  label: 'Deposit Accounts',
  labelHi: 'जमा खाते',
  capability: 'lending',
  minRole: 'viewer',
  scope: 'society',
  nature: 'master',
  dependsOn: ['society', 'member'],
  naturalKey: ['accountNo'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('accountNo', 'Account No.', 'खाता संख्या'),
    c('memberId', 'Member', 'सदस्य'),
    c('depositType', 'Deposit Type', 'जमा प्रकार', { type: 'enum' }),
    c('openDate', 'Open Date', 'खोलने की तिथि', { type: 'date' }),
    // Running total — the canonical balance is the sum of deposit_transactions.
    internal('balance', 'Balance (cached)', 'शेष (कैश्ड)', { type: 'currency' }),
    num('interestRate', 'Interest Rate %', 'ब्याज दर %'),
    c('maturityDate', 'Maturity Date', 'परिपक्वता तिथि', { type: 'date' }),
    money('installmentAmount', 'Installment', 'किस्त राशि'),
    c('status', 'Status', 'स्थिति', { type: 'enum' }),
    internal('agent', 'Agent', 'अभिकर्ता'),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

// ─── deposit_transactions ────────────────────────────────────────────────────────────
const depositTransaction: EntityDescriptor = {
  key: 'deposit_transaction',
  table: 'deposit_transactions',
  domain: 'lending',
  label: 'Deposit Transactions',
  labelHi: 'जमा लेन-देन',
  capability: 'lending',
  minRole: 'viewer',
  scope: 'society',
  nature: 'transaction',
  dependsOn: ['society', 'deposit_account', 'voucher'],
  naturalKey: ['id'],
  formats: ['csv', 'xlsx', 'json'],
  backupPolicy: 'full',
  columns: [
    c('id', 'ID', 'आईडी', { defaultVisible: false }),
    c('depositAccountId', 'Deposit Account', 'जमा खाता'),
    c('date', 'Date', 'दिनांक', { type: 'date' }),
    c('txnType', 'Transaction Type', 'लेन-देन प्रकार', { type: 'enum' }),
    money('amount', 'Amount', 'राशि'),
    c('mode', 'Mode', 'माध्यम', { type: 'enum' }),
    internal('balanceAfter', 'Balance After', 'शेष उपरांत', { type: 'currency' }),
    internal('voucherId', 'Voucher', 'वाउचर'),
    internal('createdAt', 'Created At', 'निर्माण समय', { type: 'date' }),
  ],
};

export const LENDING_ENTITIES: EntityDescriptor[] = [loan, kccLoan, depositAccount, depositTransaction];

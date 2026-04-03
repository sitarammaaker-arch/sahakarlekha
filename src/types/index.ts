export type VoucherType = 'receipt' | 'payment' | 'journal' | 'contra' | 'purchase' | 'sale' | 'debit_note' | 'credit_note';

export interface VoucherLine {
  id: string;
  accountId: string;
  type: 'Dr' | 'Cr';
  amount: number;
  narration?: string;
}
export type UserRole = 'admin' | 'accountant' | 'viewer';
export type AccountType = 'asset' | 'liability' | 'income' | 'expense' | 'equity';
export type MemberStatus = 'active' | 'inactive';

export interface VoucherEditSnapshot {
  editedAt: string;
  editedBy: string;
  before: {
    type?: VoucherType;
    date?: string;
    debitAccountId?: string;
    creditAccountId?: string;
    amount?: number;
    narration?: string;
  };
}

export interface Voucher {
  id: string;
  voucherNo: string;
  type: VoucherType;
  date: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
  narration: string;
  memberId?: string;
  createdAt: string;
  createdBy: string;
  // Soft-delete fields (audit trail)
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
  // Edit audit trail
  editHistory?: VoucherEditSnapshot[];
  // Bank reconciliation
  isCleared?: boolean;
  clearedDate?: string;
  // Compound voucher grouping — multiple rows share same groupId
  groupId?: string;
  // Maker-Checker approval workflow
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvalRemarks?: string;
  approvedBy?: string;
  approvedAt?: string;
  // Multi-line voucher support (Phase 1 — Path B)
  lines?: VoucherLine[];
  refType?: string;   // e.g. 'sale', 'purchase'
  refId?: string;     // reference to parent sale/purchase id
}

export type ObjectionStatus = 'pending' | 'partial' | 'rectified';
export type ObjectionCategory = 'cash' | 'stock' | 'loan' | 'accounts' | 'compliance' | 'other';

export interface AuditObjection {
  id: string;
  objectionNo: string;
  auditYear: string;
  paraNo: string;
  category: ObjectionCategory;
  objection: string;
  amountInvolved: number;
  dueDate: string;
  actionTaken: string;
  rectifiedDate: string;
  status: ObjectionStatus;
  remarks: string;
  createdAt: string;
}

export interface MemberLedgerEntry {
  id: string;
  date: string;
  voucherNo: string;
  particulars: string;
  credit: number;
  debit: number;
  balance: number;
}

export type MemberType = 'member' | 'nominal';

export interface Member {
  id: string;
  memberId: string;
  name: string;
  fatherName: string;
  address: string;
  phone: string;
  shareCapital: number;
  admissionFee: number;
  memberType: MemberType;
  joinDate: string;
  status: MemberStatus;
  // Share Register fields
  shareCertNo?: string;
  shareCount?: number;
  shareFaceValue?: number;
  // Nominee fields
  nomineeName?: string;
  nomineeRelation?: string;
  nomineePhone?: string;
}

export type LoanType = 'short-term' | 'medium-term' | 'long-term';
export type LoanStatus = 'active' | 'cleared' | 'overdue';

export interface Loan {
  id: string;
  loanNo: string;
  memberId: string;
  loanType: LoanType;
  purpose: string;
  amount: number;
  interestRate: number;
  disbursementDate: string;
  dueDate: string;
  repaidAmount: number;
  status: LoanStatus;
  security: string;
  createdAt: string;
}

export type AssetCategory = 'Land' | 'Building' | 'Furniture' | 'Equipment' | 'Vehicle' | 'Computer' | 'Other';
export type AssetStatus = 'active' | 'disposed';

export interface Asset {
  id: string;
  assetNo: string;
  name: string;
  category: AssetCategory;
  purchaseDate: string;
  cost: number;
  depreciationRate: number;
  depreciationMethod?: 'SLM' | 'WDV';
  depreciationPostedFY?: string[]; // FYs where journal entry has been posted
  location: string;
  description: string;
  status: AssetStatus;
}

export type AccountSubtype =
  | 'share_capital' | 'reserve' | 'surplus'
  | 'fixed_asset' | 'accumulated_dep' | 'investment' | 'current_asset' | 'inventory' | 'cash_bank'
  | 'long_term_loan' | 'current_liability' | 'statutory_liability' | 'deposit'
  | 'trading_income' | 'commission_income' | 'scheme_income' | 'other_income'
  | 'direct_expense' | 'employee_expense' | 'admin_expense' | 'operational_expense' | 'depreciation_expense' | 'statutory_expense'
  | 'suspense';

export interface LedgerAccount {
  id: string;
  name: string;
  nameHi: string;
  type: AccountType;
  subtype?: AccountSubtype;
  openingBalance: number;
  openingBalanceType: 'debit' | 'credit';
  isSystem?: boolean;
  parentId?: string;   // parent account code for hierarchy (e.g. '1100' → parent of '1101')
  isGroup?: boolean;   // true = group/header account, cannot be used in vouchers directly
}

// Separate row in voucher_entries table — one row per Dr/Cr leg
export interface VoucherEntry {
  id: string;
  voucherId: string;
  accountId: string;
  dr: number;   // debit amount (0 if credit side)
  cr: number;   // credit amount (0 if debit side)
  narration?: string;
  societyId?: string;
}

export type SocietyType = 'marketing_processing' | 'pacs' | 'consumer' | 'labour' | 'dairy' | 'housing' | 'sugar' | 'other';

export interface SocietySettings {
  name: string;
  nameHi: string;
  shortName?: string;     // Short name for header display (mobile)
  shortNameHi?: string;  // Short name in Hindi
  registrationNo: string;
  address: string;
  district: string;
  state: string;
  pinCode: string;
  phone: string;
  email: string;
  financialYear: string;
  financialYearStart: string;
  societyType?: SocietyType;
  previousFinancialYear?: string;
  previousYearBalances?: Record<string, number>; // accountId → amount (positive = debit, negative = credit)
  previousYearIE?: {            // Saved at FY rollover — I&E comparison column
    incomeItems: Array<{ name: string; nameHi: string; amount: number }>;
    expenseItems: Array<{ name: string; nameHi: string; amount: number }>;
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
  };
  previousYearRP?: {            // Saved at FY rollover — R&P comparison column
    openingCash: number;
    openingBank: number;
    receipts: Array<{ accountName: string; accountNameHi: string; amount: number }>;
    payments: Array<{ accountName: string; accountNameHi: string; amount: number }>;
    closingCash: number;
    closingBank: number;
    totalReceipts: number;
    totalPayments: number;
  };
  reserveFundPct?: number;      // 0-100, default 25 if undefined (Sec 65 Haryana / varies by state)
  tan?: string;                // Tax Deduction Account Number (10 chars)
  entityPan?: string;          // Society PAN (10 chars)
  fyLocked?: boolean;          // true = FY is audit-locked; no new vouchers or edits allowed
  fyLockedAt?: string;         // ISO date when lock was applied
  fyLockedBy?: string;         // Name of user who locked the FY
}

export interface VoucherCounters {
  receipt: number;
  payment: number;
  journal: number;
}

export interface AccountBalance {
  account: LedgerAccount;
  openingDebit: number;
  openingCredit: number;
  transactionDebit: number;
  transactionCredit: number;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
}

export interface CashBookEntry {
  id: string;
  date: string;
  voucherNo: string;
  particulars: string;
  type: 'receipt' | 'payment';
  amount: number;
  runningBalance: number;
}

export interface BankBookEntry {
  id: string;
  date: string;
  voucherNo: string;
  particulars: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  runningBalance: number;
}

export interface ReceiptsPaymentsItem {
  accountId: string;
  accountName: string;
  amount: number;
}

export interface ReceiptsPaymentsData {
  openingCash: number;
  openingBank: number;
  receipts: ReceiptsPaymentsItem[];
  payments: ReceiptsPaymentsItem[];
  closingCash: number;
  closingBank: number;
}

// ── Inventory ────────────────────────────────────────────────────────────────
export interface StockItem {
  id: string;
  itemCode: string;
  name: string;
  nameHi: string;
  unit: string;
  openingStock: number;
  currentStock: number;
  purchaseRate: number;
  saleRate: number;
  isActive: boolean;
  // Tax classification
  hsnCode?: string;       // HSN code for goods
  sacCode?: string;       // SAC code for services
  gstRate?: number;       // default GST rate % (e.g. 5, 12, 18)
  valuationMethod?: 'fifo' | 'weighted_avg'; // inventory valuation
  barcodeValue?: string;  // EAN-13 / QR / Code128 barcode
}

// ── Budget ─────────────────────────────────────────────────────────────────────
export interface BudgetHead {
  accountId: string;
  accountName: string;
  budgetAmount: number;
}

export interface Budget {
  id: string;
  financialYear: string;
  heads: BudgetHead[];
  approvedBy?: string;
  approvedAt?: string;
  remarks?: string;
  createdAt: string;
  createdBy: string;
}

// ── KCC Crop Loan ──────────────────────────────────────────────────────────────
export type CropSeasonType = 'kharif' | 'rabi' | 'zaid';
export type KccLoanStatus = 'active' | 'repaid' | 'overdue';

export interface KccLoan {
  id: string;
  loanNo: string;
  memberId: string;
  memberName: string;
  cropName: string;
  cropSeason: CropSeasonType;
  landAreaHectares: number;
  sanctionedAmount: number;
  drawnAmount: number;
  repaidAmount: number;
  outstandingAmount: number;
  interestRate: number;
  disbursementDate: string;
  dueDate: string;
  status: KccLoanStatus;
  voucherId?: string;
  narration: string;
  createdAt: string;
  createdBy: string;
}

export type StockMovementType = 'purchase' | 'sale' | 'adjustment';

export interface StockMovement {
  id: string;
  date: string;
  itemId: string;
  type: StockMovementType;
  qty: number;
  rate: number;
  amount: number;
  referenceNo: string;
  narration: string;
  createdAt: string;
}

// ── Sale ─────────────────────────────────────────────────────────────────────
export type PaymentMode = 'cash' | 'bank' | 'credit';

export interface SaleItem {
  itemId: string;
  itemName: string;
  unit: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface Sale {
  id: string;
  saleNo: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  items: SaleItem[];
  totalAmount: number;
  discount: number;
  netAmount: number;       // taxable amount (after discount, before GST)
  // GST fields
  cgstPct: number;
  sgstPct: number;
  igstPct: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;       // cgst + sgst + igst
  grandTotal: number;      // netAmount + taxAmount
  paymentMode: PaymentMode;
  customerId?: string; // linked registered customer
  voucherId?: string;
  gstVoucherIds?: string[]; // auto-created GST output journal IDs
  narration: string;
  createdAt: string;
  createdBy: string;
}

// ── Purchase ──────────────────────────────────────────────────────────────────
export interface PurchaseItem {
  itemId: string;
  itemName: string;
  unit: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface Purchase {
  id: string;
  purchaseNo: string;
  date: string;
  supplierName: string;
  supplierPhone?: string;
  items: PurchaseItem[];
  totalAmount: number;
  discount: number;
  netAmount: number;       // taxable amount (after discount, before GST)
  // GST / TDS fields
  cgstPct: number;
  sgstPct: number;
  igstPct: number;
  tdsPct: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  tdsAmount: number;
  taxAmount: number;       // cgst + sgst + igst
  grandTotal: number;      // netAmount + taxAmount - tdsAmount
  paymentMode: PaymentMode;
  supplierId?: string;     // linked registered supplier
  voucherId?: string;
  taxVoucherIds?: string[]; // auto-created GST/TDS journal voucher IDs
  narration: string;
  createdAt: string;
  createdBy: string;
}

// ── Supplier ──────────────────────────────────────────────────────────────────
export interface Supplier {
  id: string;
  supplierCode: string;
  name: string;
  nameHi?: string;
  address?: string;
  gstNo?: string;
  phone?: string;
  accountId: string; // sub-ledger under Sundry Creditors (2101)
  isActive: boolean;
  createdAt: string;
}

// ── Customer ──────────────────────────────────────────────────────────────────
export interface Customer {
  id: string;
  customerCode: string;
  name: string;
  nameHi?: string;
  address?: string;
  phone?: string;
  gstNo?: string;
  accountId: string; // sub-ledger under Sundry Debtors (3303)
  isActive: boolean;
  createdAt: string;
}

// ── Salary ────────────────────────────────────────────────────────────────────
export type EmployeeStatus = 'active' | 'inactive';

export interface Employee {
  id: string;
  empNo: string;
  name: string;
  nameHi: string;
  designation: string;
  joinDate: string;
  basicSalary: number;
  phone: string;
  bankAccount?: string;
  status: EmployeeStatus;
}

export interface SalaryRecord {
  id: string;
  slipNo: string;
  employeeId: string;
  month: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  paymentMode: PaymentMode;
  voucherId?: string;
  isPaid: boolean;
  paidDate?: string;
  createdAt: string;
}

// ── Linked Delete Guard ────────────────────────────────────────────────────────
export interface EntityLink {
  module: string;        // "Vouchers", "Loans", "Sales" etc.
  count: number;
  labelHi: string;       // "18 वाउचर"
  labelEn: string;       // "18 Vouchers"
  instructionHi: string; // "Vouchers page pe in vouchers ko pehle cancel karo"
  instructionEn: string;
  blocking: boolean;     // true = must handle before delete
}

// ── TDS Register ────────────────────────────────────────────────────────────
export type TdsSection = '192' | '194A' | '194C' | '194H' | '194J' | '194Q';
export type TdsDeducteeType = 'individual' | 'company' | 'firm' | 'cooperative' | 'other';
export type TdsStatus = 'pending' | 'deposited' | 'filed';
export type TdsQuarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface TdsEntry {
  id: string;
  date: string;                   // yyyy-mm-dd
  deducteePan: string;            // 10 chars
  deducteeName: string;
  deducteeType: TdsDeducteeType;
  section: TdsSection;
  natureOfPayment: string;
  grossAmount: number;
  tdsRate: number;
  tdsAmount: number;
  challanId?: string;             // link to TdsChallan
  voucherId?: string;             // link to source voucher
  purchaseId?: string;            // link to source purchase
  quarter: TdsQuarter;
  financialYear: string;
  status: TdsStatus;
  createdAt: string;
}

export interface TdsChallan {
  id: string;
  bsrCode: string;                // 7 digit bank BSR code
  challanDate: string;
  challanSerial: string;
  amount: number;
  bankName: string;
  quarter: TdsQuarter;
  financialYear: string;
  status: 'paid' | 'pending';
  createdAt: string;
}

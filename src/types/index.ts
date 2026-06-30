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
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type CasteCategory = 'General' | 'Backward Class' | 'Schedule Caste' | 'Schedule Tribe';

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

/** Who created a voucher: a user (manual) or the Financial Event Engine (system-owned). */
export type VoucherOrigin = 'manual' | 'engine' | 'auto';

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
  refType?: string;   // e.g. 'sale', 'purchase', 'bill-receipt'
  refId?: string;     // reference to parent sale/purchase id
  // Bill-wise settlement: a receipt allocated against specific sale invoices
  billAllocations?: BillAllocation[];
  // Phase-0 immutable engine-voucher boundary: system-owned vouchers are reversal-only.
  origin?: VoucherOrigin;   // undefined / 'manual' = user voucher; 'engine' = system-owned (immutable)
  reversalOf?: string;      // if this voucher is a reversal, the original engine voucher id
  reversedBy?: string;      // if this engine voucher was reversed, the reversal voucher id
  // Optional accounting DIMENSION (additive, never affects Dr/Cr or existing reports).
  // Labour tags vouchers by work order / cost centre for per-work-order cost & profit.
  // Other society types leave these null and adopt later without migration.
  workOrderId?: string;
  costCentreId?: string;
}

/** Tally "Method of Adjustment": settle a specific bill, or hold as advance / on-account. */
export type BillMethod = 'against' | 'advance' | 'on-account';

/**
 * One allocation line of a bill-wise receipt/payment voucher.
 * - method 'against'  → applies `amount` to the bill identified by billId/saleId.
 * - method 'advance' | 'on-account' → unallocated credit held on the party (no bill id).
 *
 * `saleId`/`saleNo` are kept for back-compat with already-saved sales receipts;
 * `billId`/`billNo` are the generic form (a sale OR purchase id). Use the helpers in
 * lib/billUtils (allocBillId / allocMethod) rather than reading these directly.
 */
export interface BillAllocation {
  saleId?: string;
  saleNo?: string;
  billId?: string;
  billNo?: string;
  amount: number;
  method?: BillMethod;
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
  // Application form fields
  approvalStatus?: ApprovalStatus;
  age?: number;
  occupation?: string;
  caste?: CasteCategory;
  tehsil?: string;
  district?: string;
  state?: string;
  pinCode?: string;
  postOffice?: string;
  paymentMode?: 'cash' | 'cheque' | 'online';
  nomineeAge?: number;
  nomineeOccupation?: string;
  nomineeAddress?: string;
  nomineeShares?: number;
  nomineeFatherName?: string;
}

// Housing cooperative — a flat/unit in the society, optionally linked to an owner member.
export interface HousingFlat {
  id: string;
  flatNo: string;
  blockNo?: string;
  floor?: string;             // floor / level (e.g. "Ground", "3")
  unitType?: string;          // 1BHK / 2BHK / 3BHK / Shop / Office / Other
  memberId?: string;          // owner (link to Member); optional for vacant/unsold
  associateMemberId?: string; // associate / joint member (housing-specific)
  ownerType?: 'owner' | 'tenant';   // legacy; kept in sync from `occupancy` (L9 back-compat)
  occupancy?: 'self' | 'rented' | 'vacant';  // physical status; drives non-occupancy charges (H2)
  area?: number;              // sq ft
  monthlyMaintenance: number;
  registrationDate?: string;
  isDeleted?: boolean;
  createdAt: string;
}

// Housing cooperative — a maintenance bill (one per flat per period); posts a receivable voucher.
export interface MaintenanceBill {
  id: string;
  billNo: string;             // descriptive, collision-free, e.g. "2026-07/A-101"
  flatId: string;
  flatNo: string;            // snapshot for display
  memberId?: string;         // owner at billing time
  period: string;            // "YYYY-MM"
  date: string;              // voucher date
  amount: number;
  voucherId?: string;        // the receivable voucher (Dr 3303 / Cr 4101)
  paidAmount: number;        // advanced by Collection (next delivery); 0 at billing
  status: 'unpaid' | 'partial' | 'paid';
  isDeleted?: boolean;
  createdAt: string;
}

// Labour cooperative — a work order / labour contract the society has taken up.
export interface WorkOrder {
  id: string;
  workOrderNo: string;
  clientName: string;          // kept in sync with the linked department's name (display + legacy)
  departmentId?: string;       // links to the Department / Principal-Employer master
  description?: string;
  contractValue: number;
  startDate?: string;
  endDate?: string;
  status: 'open' | 'completed' | 'closed';
  isDeleted?: boolean;
  createdAt: string;
}

// Labour cooperative — a muster-roll entry (one per labourer per work order per period).
// Wage is always derived as quantity × rate (daysWorked × dailyWage); the basis only changes
// what the quantity/rate mean (days, piece/units, or hours).
export type WorkBasis = 'daily' | 'piece' | 'hourly';
export interface MusterEntry {
  id: string;
  workOrderId: string;
  period: string;            // "YYYY-MM"
  memberId: string;          // labourer (worker / member)
  daysWorked: number;        // quantity: days (daily) / units (piece) / hours (hourly)
  dailyWage: number;         // rate per the chosen basis
  workBasis?: WorkBasis;     // default 'daily'
  paid?: boolean;            // fully paid (paidAmount >= wage); locks the row
  paidAmount?: number;       // cumulative amount paid (supports partial / instalment payment)
  paymentVoucherId?: string; // links to the most recent wage-payment voucher
  accrued?: boolean;         // wage liability booked (Dr 5202 / Cr 2109); set by accrueWages
  accrualVoucherId?: string; // links to the accrual journal voucher
  isDeleted?: boolean;
  createdAt: string;
}

// Labour cooperative — a worker (the society's labour pool). A worker may be a society
// member, a non-member, or an external contract worker. Master data only (no accounting).
export type WorkerType = 'member' | 'non_member' | 'contract';
export type WorkerCategory = 'skilled' | 'semi_skilled' | 'unskilled' | 'operator' | 'helper' | 'supervisor';
export interface Worker {
  id: string;
  workerCode: string;
  name: string;
  workerType: WorkerType;
  memberId?: string;          // linked Member id when workerType === 'member'
  category: WorkerCategory;
  phone?: string;
  defaultDailyWage?: number;  // default rate; can be overridden per muster entry
  idProofType?: 'aadhaar' | 'pan' | 'voter' | 'other';
  idProofNo?: string;
  // Statutory identifiers & payout details (CLRA Form XIII / EPF / ESI / NEFT). All optional.
  uan?: string;               // EPF Universal Account Number (12-digit)
  esiIp?: string;             // ESI Insurance / IP number
  pan?: string;               // PAN (TDS on wages, if applicable)
  aadhaar?: string;           // Aadhaar (stored as entered; displayed masked)
  bankAccountNo?: string;     // for NEFT/bank wage payout
  ifsc?: string;
  dateOfBirth?: string;       // "YYYY-MM-DD"
  gender?: 'male' | 'female' | 'other';
  fatherHusbandName?: string; // CLRA Form XIII column
  joiningDate?: string;       // date of employment ("YYYY-MM-DD")
  permanentAddress?: string;
  status: 'active' | 'inactive';
  isDeleted?: boolean;
  createdAt: string;
}

// Labour cooperative — the department / principal employer / client that awards work
// orders. A debtor: the society raises running bills against it (receivable sub-ledger
// auto-created under 3303 Sundry Debtors, reusing the Customer pattern).
export type DepartmentType = 'govt_department' | 'principal_employer' | 'private_client';
export interface Department {
  id: string;
  departmentCode: string;
  name: string;
  departmentType: DepartmentType;
  accountId: string;          // auto-created receivable sub-ledger (parent 3303)
  contactPerson?: string;
  phone?: string;
  address?: string;
  gstin?: string;
  tdsApplicable?: boolean;    // govt/principal employers deduct TDS on our bills (used in billing)
  openingBalance?: number;
  status: 'active' | 'inactive';
  isDeleted?: boolean;
  createdAt: string;
}

// Labour cooperative — a bill raised on a department/employer for work done (income side).
// At creation: Dr department receivable / Cr 4203 Labour Charges (income), tagged workOrderId.
// Collection reduces the receivable (partial allowed).
// Labour cooperative — an advance paid to a worker (asset 3304), recovered over time.
export interface WorkerAdvance {
  id: string;
  advanceNo: string;
  workerId: string;
  date: string;
  amount: number;            // advance given
  recovered: number;         // cumulative recovered
  status: 'open' | 'cleared';
  mode: 'cash' | 'bank';
  voucherId?: string;        // the advance-payment voucher
  narration?: string;
  isDeleted?: boolean;
  createdAt: string;
}

// Labour cooperative — a monthly EPF/ESI processing run (computed from that month's muster wages).
export interface PfEsiRun {
  id: string;
  period: string;            // "YYYY-MM"
  grossWages: number;        // total muster wages for the month (basis)
  epfEmployee: number;
  epfEmployer: number;        // employer EPF 12% (EPF 3.67% + EPS 8.33%)
  epfAdminEdli?: number;      // employer EDLI 0.5% + admin 0.5% (the extra 1%)
  esiEmployee: number;
  esiEmployer: number;
  status: 'posted' | 'deposited';
  voucherId?: string;        // the liability-posting voucher
  depositVoucherId?: string; // the deposit (challan) voucher
  createdAt: string;
  isDeleted?: boolean;
}

export type DeptBillType = 'running' | 'final';
export interface DepartmentBill {
  id: string;
  billNo: string;
  departmentId: string;
  workOrderId?: string;       // dimension — enables per-work-order income/profit
  billType: DeptBillType;
  date: string;
  amount: number;             // gross billed = income recognised
  paidAmount: number;         // collected so far
  status: 'unpaid' | 'partial' | 'paid';
  voucherId?: string;         // the bill (income-recognition) voucher
  narration?: string;
  isDeleted?: boolean;
  createdAt: string;
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

// ── Dairy / Milk society — daily collection register + member payout ──────────
export type MilkShift = 'morning' | 'evening';
export interface MilkEntry {
  id: string;
  date: string;          // YYYY-MM-DD
  shift: MilkShift;
  memberId: string;      // → Member.id
  memberName: string;    // denormalised for the payout sheet
  qty: number;           // litres
  fat: number;           // fat %
  snf: number;           // SNF / CLR (informational)
  rate: number;          // ₹ per litre (society enters; no union rate hardcoded)
  amount: number;        // qty × rate
  createdAt: string;
}

export type AssetCategory = 'Land' | 'Building' | 'Furniture' | 'Equipment' | 'Vehicle' | 'Computer' | 'Other';
export type AssetStatus = 'active' | 'disposed';

// HAFED Proforma 6 asset classification (higher-level grouping than AssetCategory)
export type P6AssetCategory = 'godown' | 'land' | 'shop' | 'truck' | 'other';
export type AssetCondition = 'serviceable' | 'unserviceable';

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
  usefulLife?: number;             // years (ICAI AS-6)
  residualValue?: number;          // scrap value (₹) — depreciable amount = cost - residualValue
  disposalDate?: string;           // ISO date when disposed/sold
  saleProceeds?: number;           // amount received on disposal (₹)
  location: string;
  description: string;
  status: AssetStatus;

  // ── HAFED Proforma 6 fields ──
  p6Category?: P6AssetCategory;     // Godown / Land / Shop / Truck / Other
  capacityMT?: number;              // capacity in metric tonnes (for godowns)
  condition?: AssetCondition;       // Serviceable / Unserviceable
  marketValue?: number;             // Market Value as on reporting date (₹)
}

export type AccountSubtype =
  | 'share_capital' | 'reserve' | 'surplus'
  | 'fixed_asset' | 'accumulated_dep' | 'investment' | 'current_asset' | 'inventory' | 'cash_bank'
  | 'long_term_loan' | 'current_liability' | 'statutory_liability' | 'deposit'
  | 'closing_stock'
  | 'trading_income' | 'commission_income' | 'scheme_income' | 'other_income'
  | 'direct_expense' | 'employee_expense' | 'admin_expense' | 'operational_expense' | 'depreciation_expense' | 'statutory_expense'
  | 'suspense';

// ── Annual Review Report (Haryana Marketing Societies) classification tags ──
export type CropCategory =
  | 'wheat' | 'paddy' | 'sunflower' | 'mustard' | 'gram'
  | 'bajra' | 'maize' | 'moong' | 'other';

export type P1ExpenseBucket =
  | 'admn'           // a) Admn. Exp.
  | 'office'         // b) Office Over Head Exp.
  | 'marketing'      // c) Marketing Trading Exp.
  | 'fertPesticide'  // d) Fertilizer & Pesticides Trading Exp.
  | 'processing'     // e) Processing Exp on Own Units
  | 'other';         // f) Other Exp., if any

export type P1IncomeCategory =
  | 'commission'       // 1. Commission (with cropCategory)
  | 'patronageRebate'  // 2. Patronage Rebate
  | 'inputMargin'      // 4. Margin on distribution of inputs
  | 'consumerSale'     // 5. Consumer products
  | 'processingIncome' // 6. Own processing units
  | 'truckIncome'      // 7. Trucks
  | 'rentalIncome'     // 8. Rental income
  | 'hafedOther'       // 9. Other income from HAFED
  | 'nonHafedIncome';  // 10. Income other than HAFED

export type TurnoverBucket =
  | 'procurement'   // a) Turnover from procurement
  | 'consumer'      // b) Marketing (Consumer Products)
  | 'fertilizer'    // c) Fertilizers
  | 'pesticide'     // d) Pesticides
  | 'cattleFeed'    // e) Cattle Feed Plant
  | 'nonHafed';     // f) Other than Hafed

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

  // ── Annual Review Report tagging (Haryana Marketing Society Proformas) ──
  cropCategory?: CropCategory;         // for Commission income accounts (P1 row 1)
  p1IncomeCategory?: P1IncomeCategory; // P1 income category (rows 1–10)
  p1ExpenseBucket?: P1ExpenseBucket;   // P1 expense bucket (row 12 a–f)
  turnoverBucket?: TurnoverBucket;     // P1 rows 17/18 turnover split
}

// ── Recoverables (HAFED Proforma 2 — Recoverable Position) ─────────────────
// Each row = one recoverable case (party-specific outstanding) tracked across FYs.
// P2 aggregates: opening + additions − recoveries = closing balance,
// then splits the closing balance by legalStage for Section D.
export type RecoverableCategory =
  | 'fertPesticide'  // 1. Fertilizer & Pesticide Outstanding
  | 'advance'         // 2. Advances
  | 'embezzlement'    // 3. Embezzlements (If Any)
  | 'other';          // 4. Others

export type RecoverableLegalStage =
  | 'none'          // not escalated
  | 'police'        // Cases with police
  | 'arbitration'   // Cases in arbitration
  | 'execution'     // Cases under execution
  | 'award'         // Award taken but not sent to execution
  | 'confirmed'     // Others — Confirmed
  | 'unconfirmed';  // Others — Un-confirmed

export interface Recoverable {
  id: string;
  partyName: string;
  category: RecoverableCategory;
  legalStage: RecoverableLegalStage;
  openingBalance: number;   // amount outstanding as at fyStartDate
  additions: number;        // added during the FY
  recoveries: number;       // recovered during the FY
  fyStartDate: string;      // ISO yyyy-mm-dd (e.g. 2025-04-01) — which FY this row is for
  narration?: string;
  createdAt: string;
  isDeleted?: boolean;
  societyId?: string;
}

// ── Kachi Aarat (HAFED Proforma 8) ─────────────────────────────────────────
// Each row = a transaction or yearly summary where society acted as
// Kachi Aarat (commission agent) for a farmer in the mandi.
// P8 sums businessValue + damiEarned per FY.
// P9 needs dami split by crop (Mustard Seed, Gram, Barley).
export type KachiAaratCrop =
  | 'mustardSeed'  // M/Seed
  | 'gram'         // Gram
  | 'barley'       // Barley
  | 'wheat'
  | 'paddy'
  | 'other';

export interface KachiAaratEntry {
  id: string;
  date: string;              // ISO yyyy-mm-dd
  fyStartDate: string;       // which FY this row is for (e.g. 2024-04-01)
  crop: KachiAaratCrop;
  partyName?: string;        // farmer name (optional)
  businessValue: number;     // total ₹ value of business done
  damiEarned: number;        // ₹ commission earned (before farmer rebate)
  narration?: string;
  createdAt: string;
  isDeleted?: boolean;
  societyId?: string;
}

// ── P7 Entry (HAFED Proforma 7) ────────────────────────────────────────────
// Single row per FY capturing:
//   1. Godown rent paid (count + capacity + amount)
//   2. Transportation (truck count + charges paid)
//   3. Consumer products sold (Sugar/Cattle Feed/Mustard Cake  +  Rice/Oil)
export interface P7Entry {
  id: string;
  fyStartDate: string;          // yyyy-mm-dd — identifies the FY (e.g. 2024-04-01)
  // 1. Rented Godowns
  rentedGodownCount: number;
  rentedCapacityMT: number;
  godownRentPaid: number;
  // 2. Transportation
  truckCount: number;           // number of trucks operated by society
  transportChargesPaid: number; // total during FY
  // 3. Consumer products sold
  sugarCattleFeedSales: number; // Sugar / Cattle Feed / Mustard Cake value
  consumerProductSales: number; // Rice / Mustard Oil / Refined Oil value
  narration?: string;
  createdAt: string;
  societyId?: string;
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
  // Optional accounting dimension, denormalized from the parent voucher (additive).
  workOrderId?: string;
  costCentreId?: string;
}

export type SocietyType = 'marketing_processing' | 'pacs' | 'consumer' | 'labour' | 'dairy' | 'housing' | 'sugar' | 'other';

// Board of Directors / Board of Administration
export type BoardType = 'bod' | 'boa';
export type BoardDesignation = 'president' | 'vice_president' | 'secretary' | 'joint_secretary' | 'treasurer' | 'director' | 'administrator' | 'other';

export interface BoardMember {
  id: string;
  memberId: string;
  memberName: string;
  memberIdNo: string;
  designation: BoardDesignation;
  designationLabel: string;
  designationLabelHi: string;
  termFrom: string;
  termTo: string;
  resolutionNo: string;
  isSigningAuthority: boolean;
  status: 'active' | 'resigned' | 'expired';
}

export interface SignatoryConfig {
  name: string;
  source: 'board' | 'employee';
}

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
  sanctionedStrength?: number;   // HAFED Proforma 5 — sanctioned staff strength
  hafedDistrictOffice?: string;   // HAFED Proforma 5/7 — district office name
  // HAFED Proforma 3 — Financial Result / District Summary
  businessType?: 'wholesale' | 'retail' | 'both';
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
  gstin?: string;              // GSTIN (15 chars — state code + PAN + entity code + check digit)
  tan?: string;                // Tax Deduction Account Number (10 chars)
  entityPan?: string;          // Society PAN (10 chars)
  fyLocked?: boolean;          // true = FY is audit-locked; no new vouchers or edits allowed
  fyLockedAt?: string;         // ISO date when lock was applied
  fyLockedBy?: string;         // Name of user who locked the FY
  // Board & Signing Authority
  boardType?: BoardType;       // 'bod' (elected) or 'boa' (appointed by Registrar)
  boardMembers?: BoardMember[];
  signatories?: {
    accountant?: SignatoryConfig;
    secretary?: SignatoryConfig;
    president?: SignatoryConfig;
  };
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
  accountNameHi?: string;
  amount: number;
  // Audit C-12: every R&P line is classified Capital vs Revenue.
  nature: 'capital' | 'revenue';
  // Audit C-11: GL-head ledger type (asset / liability / income / expense / equity).
  glType?: string;
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
  stockGroup?: string;    // category group (e.g., "Consumer Products", "Fertilizer A/c", "Animal Feed")
  // Per-item ledger account routing — controls which income/expense account the sale or
  // purchase posts to. If unset, falls back to '4101' (Sales) / '5101' (Purchases). This
  // lets multi-product societies see separate Sales/Purchase lines in Trial Balance,
  // Trading A/c and I&E for each category (Fertilizer, Sugar, Consumer Goods, etc.).
  salesAccountId?: string;     // credit account on sale (under parent 4100 ideally)
  purchaseAccountId?: string;  // debit account on purchase (under parent 5100 ideally)

  // ── HAFED Proforma 4 (Patronage Rebate) classification ──
  // Tag a stock item so its qty is summed for the right P4 column.
  p4Category?: P4StockCategory;
}

// Stock categories for HAFED Proforma 4 (Patronage Rebate)
export type P4StockCategory =
  | 'dap'            // DAP sold
  | 'urea'           // Urea sold
  | 'wheatProc'      // Wheat procured
  | 'barleyProc'     // Barley procured
  | 'gramProc'       // Gram procured
  | 'paddyProc'      // Paddy procured (bonus — commonly needed)
  | 'mustardProc'    // Mustard procured
  | 'sunflowerProc'  // Sunflower procured
  | 'otherFert'      // Other fertilizer sold (not DAP/Urea)
  | 'otherProc';     // Other procurement

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
  bankAccountId?: string;  // when paymentMode = 'bank', which bank account to credit
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
  bankAccountId?: string;  // when paymentMode = 'bank', which bank account to credit
  supplierId?: string;     // linked registered supplier
  voucherId?: string;
  taxVoucherIds?: string[]; // auto-created GST/TDS journal voucher IDs
  narration: string;
  createdAt: string;
  createdBy: string;
}

// ── Supplier ──────────────────────────────────────────────────────────────────
export type SupplierType =
  | 'individual'
  | 'proprietorship'
  | 'partnership'
  | 'llp'
  | 'pvtLtd'
  | 'publicLtd'
  | 'society'
  | 'trust'
  | 'huf'
  | 'government'
  | 'manufacturer'
  | 'distributor'
  | 'wholesaler'
  | 'retailer'
  | 'serviceProvider';

export interface Supplier {
  id: string;
  supplierCode: string;
  // ── Basic (legacy `name` retained for backward compat) ──
  name: string;
  nameHi?: string;
  legalName?: string;
  tradeName?: string;
  mailingName?: string;
  supplierType?: SupplierType;

  // ── Address ──
  address?: string;       // legacy single-line
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;

  // ── Contact ──
  phone?: string;         // legacy
  mobile?: string;
  landline?: string;
  email?: string;
  website?: string;
  contactPerson?: string;
  contactDesignation?: string;
  salesRep?: string;      // Supplier-side rep we deal with

  // ── Tax / GST ──
  gstNo?: string;         // legacy alias
  gstin?: string;
  pan?: string;
  registrationType?: GstRegistrationType;
  placeOfSupply?: string;
  tdsApplicable?: boolean;
  tdsSection?: TdsSection;
  tcsApplicable?: boolean;

  // ── Banking ──
  bankName?: string;
  accountNo?: string;
  ifsc?: string;
  branch?: string;
  upiId?: string;
  beneficiaryName?: string; // when A/c name differs from supplier name

  // ── Credit Terms ──
  creditDays?: number;
  creditLimit?: number;
  discountPercent?: number;
  openingBalance?: number;
  openingBalanceType?: 'debit' | 'credit';

  // ── Misc ──
  notes?: string;

  // ── System ──
  accountId: string; // sub-ledger under Sundry Creditors (2101)
  isActive: boolean;
  createdAt: string;
}

// ── Customer ──────────────────────────────────────────────────────────────────
export type CustomerType =
  | 'individual'
  | 'proprietorship'
  | 'partnership'
  | 'llp'
  | 'pvtLtd'
  | 'publicLtd'
  | 'society'
  | 'trust'
  | 'huf'
  | 'government';

export type GstRegistrationType =
  | 'regular'
  | 'composition'
  | 'consumer'        // B2C unregistered consumer
  | 'unregistered'    // unregistered business
  | 'sez'             // Special Economic Zone
  | 'overseas';       // export

export interface Customer {
  id: string;
  customerCode: string;
  // ── Basic (legacy `name` retained for backward compat — used as legalName fallback) ──
  name: string;
  nameHi?: string;
  legalName?: string;     // matches GSTIN if business; defaults to `name`
  tradeName?: string;     // shop / brand name if different from legal
  mailingName?: string;   // name to print on invoices; defaults to legalName
  customerType?: CustomerType;

  // ── Address ──
  address?: string;       // legacy single-line — kept for backward compat
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;         // mandatory for GST (intra/inter-state)
  pincode?: string;
  country?: string;       // default 'India'

  // ── Contact ──
  phone?: string;         // legacy — kept; maps to mobile
  mobile?: string;
  landline?: string;
  email?: string;
  website?: string;
  contactPerson?: string;
  contactDesignation?: string;

  // ── Tax / GST ──
  gstNo?: string;         // legacy alias for gstin — kept
  gstin?: string;         // 15-digit GSTIN
  pan?: string;           // 10-digit PAN (often auto-derived from GSTIN positions 3-12)
  registrationType?: GstRegistrationType;
  placeOfSupply?: string; // state name; auto from GSTIN first 2 digits
  tdsApplicable?: boolean;
  tcsApplicable?: boolean;

  // ── Banking ──
  bankName?: string;
  accountNo?: string;
  ifsc?: string;
  branch?: string;
  upiId?: string;

  // ── Credit Terms ──
  creditDays?: number;
  creditLimit?: number;
  discountPercent?: number;
  openingBalance?: number;        // Dr/Cr handled separately
  openingBalanceType?: 'debit' | 'credit';

  // ── Misc ──
  notes?: string;

  // ── System ──
  accountId: string; // sub-ledger under Sundry Debtors (3303)
  isActive: boolean;
  createdAt: string;
}

// ── Salary ────────────────────────────────────────────────────────────────────
export type EmployeeStatus = 'active' | 'inactive';

// ── HAFED Proforma 5 (Staff & Salary) classification ──
export type EmployeeCategory = 'A' | 'B' | 'C' | 'D';

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

  // ── HAFED Proforma 5 fields ──
  category?: EmployeeCategory;        // A / B / C / D
  payScale?: string;                   // e.g. "5200-20200 + 2400 GP"
  isHafedDeputed?: boolean;            // Whether on Deputation from HAFED
  isOutsourced?: boolean;              // true = outsourced, false = society own employee
  hafedSalaryPaid?: number;            // Amount of salary paid by HAFED (₹)
  hafedSalaryPercent?: number;         // % of salary paid by HAFED (0-100)
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
// Used by both the TDS Register page and the Supplier master (TDS section per supplier).
export type TdsSection = '192' | '194A' | '194C' | '194H' | '194I' | '194J' | '194Q' | '195';
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

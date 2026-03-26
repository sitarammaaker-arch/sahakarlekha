import type { Voucher, Member, LedgerAccount, SocietySettings, VoucherCounters, Loan, Asset, AuditObjection, StockItem, StockMovement, Sale, Purchase, Employee, SalaryRecord } from '@/types';

const KEYS = {
  vouchers: 'sahayata_vouchers',
  members: 'sahayata_members',
  accounts: 'sahayata_accounts',
  society: 'sahayata_society',
  counters: 'sahayata_counters',
  auth: 'sahayata_auth',
  loans: 'sahayata_loans',
  assets: 'sahayata_assets',
  loanCounter: 'sahayata_loan_counter',
  assetCounter: 'sahayata_asset_counter',
  auditObjections: 'sahayata_audit_objections',
  objectionCounter: 'sahayata_objection_counter',
  stockItems: 'sahayata_stock_items',
  stockMovements: 'sahayata_stock_movements',
  itemCounter: 'sahayata_item_counter',
  sales: 'sahayata_sales',
  saleCounter: 'sahayata_sale_counter',
  purchases: 'sahayata_purchases',
  purchaseCounter: 'sahayata_purchase_counter',
  employees: 'sahayata_employees',
  empCounter: 'sahayata_emp_counter',
  salaryRecords: 'sahayata_salary_records',
  salaryCounter: 'sahayata_salary_counter',
};

export const DEFAULT_ACCOUNTS: LedgerAccount[] = [
  { id: 'CASH', name: 'Cash in Hand', nameHi: 'हाथ में नकद', type: 'asset', openingBalance: 50000, openingBalanceType: 'debit', isSystem: true },
  { id: 'BANK', name: 'Bank - SBI', nameHi: 'बैंक - एसबीआई', type: 'asset', openingBalance: 350000, openingBalanceType: 'debit', isSystem: true },
  { id: 'DEBTORS', name: 'Sundry Debtors', nameHi: 'देनदार', type: 'asset', openingBalance: 0, openingBalanceType: 'debit', isSystem: false },
  { id: 'CREDITORS', name: 'Sundry Creditors', nameHi: 'लेनदार', type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false },
  { id: 'SHARE_CAP', name: 'Share Capital', nameHi: 'अंश पूंजी', type: 'liability', openingBalance: 200000, openingBalanceType: 'credit', isSystem: true },
  { id: 'RES_FUND', name: 'Reserve Fund', nameHi: 'आरक्षित निधि', type: 'liability', openingBalance: 75000, openingBalanceType: 'credit', isSystem: false },
  { id: 'MEM_DEP', name: 'Member Deposits', nameHi: 'सदस्य जमा', type: 'liability', openingBalance: 180000, openingBalanceType: 'credit', isSystem: false },
  { id: 'COMM_INC', name: 'Commission Income', nameHi: 'कमीशन आय', type: 'income', openingBalance: 0, openingBalanceType: 'credit', isSystem: false },
  { id: 'INT_INC', name: 'Interest Income', nameHi: 'ब्याज आय', type: 'income', openingBalance: 0, openingBalanceType: 'credit', isSystem: false },
  { id: 'SAL_EXP', name: 'Salary Expense', nameHi: 'वेतन व्यय', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false },
  { id: 'RENT_EXP', name: 'Rent Expense', nameHi: 'किराया व्यय', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false },
  { id: 'OFF_EXP', name: 'Office Expenses', nameHi: 'कार्यालय व्यय', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false },
  { id: 'ELEC_EXP', name: 'Electricity Expense', nameHi: 'बिजली व्यय', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false },
  { id: 'STOCK', name: 'Stock in Trade', nameHi: 'व्यापारिक स्टॉक', type: 'asset', openingBalance: 125000, openingBalanceType: 'debit', isSystem: false },
  { id: 'SURPLUS_BF', name: 'Surplus Brought Forward', nameHi: 'अग्रनीत अधिशेष', type: 'liability', openingBalance: 70000, openingBalanceType: 'credit', isSystem: false },
];

export const DEFAULT_SOCIETY: SocietySettings = {
  name: 'Gram Seva Cooperative Marketing Society',
  nameHi: 'ग्राम सेवा सहकारी विपणन समिति',
  registrationNo: 'COOP/2024/12345',
  address: 'ग्राम पंचायत भवन, मुख्य बाज़ार, तहसील - सदर',
  district: 'XYZ',
  state: 'mp',
  pinCode: '123456',
  phone: '0755-1234567',
  email: 'gramseva@example.com',
  financialYear: '2024-25',
  financialYearStart: '2024-04-01',
};

function get<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function set<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const getVouchers = (): Voucher[] => get(KEYS.vouchers, []);
export const setVouchers = (v: Voucher[]): void => set(KEYS.vouchers, v);

export const getMembers = (): Member[] => get(KEYS.members, []);
export const setMembers = (m: Member[]): void => set(KEYS.members, m);

export const getAccounts = (): LedgerAccount[] => {
  const stored = get<LedgerAccount[] | null>(KEYS.accounts, null);
  if (!stored) { set(KEYS.accounts, DEFAULT_ACCOUNTS); return DEFAULT_ACCOUNTS; }
  return stored;
};
export const setAccounts = (a: LedgerAccount[]): void => set(KEYS.accounts, a);

export const getSociety = (): SocietySettings => {
  const stored = get<SocietySettings | null>(KEYS.society, null);
  if (!stored) { set(KEYS.society, DEFAULT_SOCIETY); return DEFAULT_SOCIETY; }
  return stored;
};
export const setSociety = (s: SocietySettings): void => set(KEYS.society, s);

export const getCounters = (): VoucherCounters => get(KEYS.counters, { receipt: 0, payment: 0, journal: 0 });
export const setCounters = (c: VoucherCounters): void => set(KEYS.counters, c);

export const getNextVoucherNo = (type: 'receipt' | 'payment' | 'journal', financialYear: string): string => {
  const counters = getCounters();
  const prefix = type === 'receipt' ? 'RV' : type === 'payment' ? 'PV' : 'JV';
  const yr = financialYear.replace('-', '/');
  const nextNo = counters[type] + 1;
  setCounters({ ...counters, [type]: nextNo });
  return `${prefix}/${yr}/${String(nextNo).padStart(3, '0')}`;
};

export const getLoans = (): Loan[] => get(KEYS.loans, []);
export const setLoans = (l: Loan[]): void => set(KEYS.loans, l);

export const getAssets = (): Asset[] => get(KEYS.assets, []);
export const setAssets = (a: Asset[]): void => set(KEYS.assets, a);

export const getNextLoanNo = (financialYear: string): string => {
  const current = get<number>(KEYS.loanCounter, 0) + 1;
  set(KEYS.loanCounter, current);
  return `L/${financialYear}/${String(current).padStart(3, '0')}`;
};

export const getNextAssetNo = (): string => {
  const current = get<number>(KEYS.assetCounter, 0) + 1;
  set(KEYS.assetCounter, current);
  return `AST/${String(current).padStart(4, '0')}`;
};

export const getAuditObjections = (): AuditObjection[] => get(KEYS.auditObjections, []);
export const setAuditObjections = (a: AuditObjection[]): void => set(KEYS.auditObjections, a);

export const getNextObjectionNo = (auditYear: string): string => {
  const current = get<number>(KEYS.objectionCounter, 0) + 1;
  set(KEYS.objectionCounter, current);
  return `AUD/${auditYear}/${String(current).padStart(3, '0')}`;
};

export const getAuthSession = () =>
  get<{ email: string; name: string; role: string; societyId: string } | null>(KEYS.auth, null);

export const setAuthSession = (session: { email: string; name: string; role: string; societyId: string } | null): void => {
  if (session) set(KEYS.auth, session);
  else localStorage.removeItem(KEYS.auth);
};

// ── Inventory ────────────────────────────────────────────────────────────────
export const getStockItems = (): StockItem[] => get(KEYS.stockItems, []);
export const setStockItems = (items: StockItem[]): void => set(KEYS.stockItems, items);
export const getStockMovements = (): StockMovement[] => get(KEYS.stockMovements, []);
export const setStockMovements = (m: StockMovement[]): void => set(KEYS.stockMovements, m);
export const getNextItemCode = (): string => {
  const current = get<number>(KEYS.itemCounter, 0) + 1;
  set(KEYS.itemCounter, current);
  return `ITM/${String(current).padStart(3, '0')}`;
};

// ── Sale ─────────────────────────────────────────────────────────────────────
export const getSales = (): Sale[] => get(KEYS.sales, []);
export const setSales = (s: Sale[]): void => set(KEYS.sales, s);
export const getNextSaleNo = (financialYear: string): string => {
  const current = get<number>(KEYS.saleCounter, 0) + 1;
  set(KEYS.saleCounter, current);
  return `SL/${financialYear}/${String(current).padStart(3, '0')}`;
};

// ── Purchase ──────────────────────────────────────────────────────────────────
export const getPurchases = (): Purchase[] => get(KEYS.purchases, []);
export const setPurchases = (p: Purchase[]): void => set(KEYS.purchases, p);
export const getNextPurchaseNo = (financialYear: string): string => {
  const current = get<number>(KEYS.purchaseCounter, 0) + 1;
  set(KEYS.purchaseCounter, current);
  return `PUR/${financialYear}/${String(current).padStart(3, '0')}`;
};

// ── Salary ────────────────────────────────────────────────────────────────────
export const getEmployees = (): Employee[] => get(KEYS.employees, []);
export const setEmployees = (e: Employee[]): void => set(KEYS.employees, e);
export const getSalaryRecords = (): SalaryRecord[] => get(KEYS.salaryRecords, []);
export const setSalaryRecords = (s: SalaryRecord[]): void => set(KEYS.salaryRecords, s);
export const getNextEmpNo = (): string => {
  const current = get<number>(KEYS.empCounter, 0) + 1;
  set(KEYS.empCounter, current);
  return `EMP/${String(current).padStart(3, '0')}`;
};
export const getNextSalarySlipNo = (financialYear: string): string => {
  const current = get<number>(KEYS.salaryCounter, 0) + 1;
  set(KEYS.salaryCounter, current);
  return `SAL/${financialYear}/${String(current).padStart(3, '0')}`;
};

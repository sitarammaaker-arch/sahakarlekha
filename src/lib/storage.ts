import type { Voucher, Member, LedgerAccount, SocietySettings, VoucherCounters, Loan, Asset, AuditObjection, StockItem, StockMovement, Sale, Purchase, Employee, SalaryRecord, VoucherType, Supplier, Customer } from '@/types';

// ── Voucher Template ──────────────────────────────────────────────────────────
export interface VoucherTemplate {
  id: string;
  label: string;       // English
  labelHi: string;     // Hindi
  icon: string;        // emoji
  type: VoucherType;
  debitAccountId: string;
  creditAccountId: string;
  category: 'receipt' | 'payment' | 'contra';
}

// 15 common cooperative society transactions
export const VOUCHER_TEMPLATES: VoucherTemplate[] = [
  // ── Receipt (Paisa Aaya) ──────────────────────────────────────────────────
  { id: 'share_cap',   label: 'Member Share Capital',  labelHi: 'सदस्य शेयर पूंजी',    icon: '👤', type: 'receipt', debitAccountId: '3301', creditAccountId: '1102', category: 'receipt' },
  { id: 'adm_fee',     label: 'Admission Fee',         labelHi: 'प्रवेश शुल्क',         icon: '🎟️', type: 'receipt', debitAccountId: '3301', creditAccountId: '4407', category: 'receipt' },
  { id: 'fert_sale',   label: 'Fertilizer/Seed Sale',  labelHi: 'उर्वरक/बीज बिक्री',   icon: '🌾', type: 'receipt', debitAccountId: '3301', creditAccountId: '4101', category: 'receipt' },
  { id: 'commission',  label: 'Commission Received',   labelHi: 'कमीशन/दामी आई',        icon: '💰', type: 'receipt', debitAccountId: '3301', creditAccountId: '4201', category: 'receipt' },
  { id: 'rent_in',     label: 'Rent Received',         labelHi: 'किराया मिला',           icon: '🏠', type: 'receipt', debitAccountId: '3301', creditAccountId: '4401', category: 'receipt' },
  { id: 'interest_in', label: 'Interest Received',     labelHi: 'ब्याज मिला',            icon: '📈', type: 'receipt', debitAccountId: '3301', creditAccountId: '4403', category: 'receipt' },
  { id: 'bank_wd',     label: 'Cash from Bank',        labelHi: 'बैंक से नकद निकाला',   icon: '🏦', type: 'receipt', debitAccountId: '3301', creditAccountId: '3302', category: 'receipt' },
  // ── Payment (Paisa Gaya) ──────────────────────────────────────────────────
  { id: 'salary',      label: 'Salary Paid',           labelHi: 'वेतन दिया',             icon: '👨‍💼', type: 'payment', debitAccountId: '5201', creditAccountId: '3301', category: 'payment' },
  { id: 'wages',       label: 'Wages Paid',            labelHi: 'मजदूरी दी',             icon: '🔨', type: 'payment', debitAccountId: '5202', creditAccountId: '3301', category: 'payment' },
  { id: 'electricity', label: 'Electricity Bill',      labelHi: 'बिजली का बिल',          icon: '⚡', type: 'payment', debitAccountId: '5302', creditAccountId: '3301', category: 'payment' },
  { id: 'telephone',   label: 'Telephone Bill',        labelHi: 'फोन का बिल',            icon: '📞', type: 'payment', debitAccountId: '5304', creditAccountId: '3301', category: 'payment' },
  { id: 'repair',      label: 'Repair Expense',        labelHi: 'मरम्मत खर्च',           icon: '🔧', type: 'payment', debitAccountId: '5402', creditAccountId: '3301', category: 'payment' },
  { id: 'purchase',    label: 'Cash Purchase',         labelHi: 'नकद खरीदी',             icon: '🛒', type: 'payment', debitAccountId: '5101', creditAccountId: '3301', category: 'payment' },
  { id: 'bank_dep',    label: 'Cash to Bank',          labelHi: 'बैंक में नकद जमा',      icon: '🏦', type: 'payment', debitAccountId: '3302', creditAccountId: '3301', category: 'payment' },
  { id: 'audit_fee',   label: 'Audit Fee',             labelHi: 'लेखा परीक्षण शुल्क',    icon: '📋', type: 'payment', debitAccountId: '5306', creditAccountId: '3301', category: 'payment' },
];

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
  suppliers: 'sahayata_suppliers',
  supplierCounter: 'sahayata_supplier_counter',
  customers: 'sahayata_customers',
  customerCounter: 'sahayata_customer_counter',
};

// ── Central account ID constants ─────────────────────────────────────────────
// Use these everywhere instead of hardcoded strings so a template change
// only needs updating here.
export const ACCOUNT_IDS = {
  CASH:      '3301',  // Cash in Hand
  BANK:      '3302',  // Bank Accounts
  SHARE_CAP: '1102',  // Individual Share Capital (member share capital)
  ADM_FEE:   '4407',  // Admission Fee (Capital Receipt — Balance Sheet)
} as const;

// ── CMSSociety (Marketing cum Processing Society) Chart of Accounts ──────────
// 136 accounts — verified against ICAI NCE GN 2023 + Haryana Cooperative Societies Act 1984
// isGroup = true  → header/parent account, no direct transactions
// isSystem = true → critical account, cannot be deleted
export const CMS_SOCIETY_ACCOUNTS: LedgerAccount[] = [
  // ── Capital & Funds (Equity) ────────────────────────────────────────────
  { id: '1000', name: 'Capital & Funds',            nameHi: 'पूंजी एवं निधियाँ',        type: 'equity',    openingBalance: 0, openingBalanceType: 'credit', isSystem: true,  isGroup: true  },
  { id: '1100', name: 'Share Capital',              nameHi: 'शेयर पूंजी',               type: 'equity',    openingBalance: 0, openingBalanceType: 'credit', isSystem: true,  isGroup: true,  parentId: '1000' },
  { id: '1101', name: 'Govt Share Capital',         nameHi: 'सरकारी शेयर पूंजी',        type: 'equity',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '1100' },
  { id: '1102', name: 'Individual Share Capital',   nameHi: 'व्यक्तिगत शेयर पूंजी',     type: 'equity',    openingBalance: 0, openingBalanceType: 'credit', isSystem: true,  isGroup: false, parentId: '1100' },
  { id: '1103', name: 'PACS Share Capital',         nameHi: 'पैक्स शेयर पूंजी',         type: 'equity',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '1100' },
  { id: '1200', name: 'Reserves & Surplus',         nameHi: 'संचय एवं अधिशेष',          type: 'equity',    openingBalance: 0, openingBalanceType: 'credit', isSystem: true,  isGroup: true,  parentId: '1000' },
  { id: '1201', name: 'Statutory Reserve Fund',      nameHi: 'वैधानिक संचय निधि',        type: 'equity',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '1200' },
  { id: '1202', name: 'Building Fund',              nameHi: 'भवन निधि',                 type: 'equity',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '1200' },
  { id: '1203', name: 'Education Fund',             nameHi: 'शिक्षा निधि',               type: 'equity',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '1200' },
  { id: '1204', name: 'Risk Fund',                  nameHi: 'जोखिम निधि',               type: 'equity',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '1200' },
  { id: '1205', name: 'Bad Debt Fund',              nameHi: 'अशोध्य ऋण निधि',           type: 'equity',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '1200' },
  { id: '1206', name: 'Depreciation Fund',          nameHi: 'ह्रास निधि',               type: 'equity',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '1200' },
  { id: '1207', name: 'Welfare Fund',               nameHi: 'कल्याण निधि',              type: 'equity',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '1200' },
  { id: '1208', name: 'Net Surplus / (Deficit)',     nameHi: 'शुद्ध अधिशेष / (घाटा)',    type: 'equity',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '1200' },

  // ── Liabilities ──────────────────────────────────────────────────────────
  { id: '2000', name: 'Liabilities',                nameHi: 'दायित्व',                  type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: true,  isGroup: true  },
  { id: '2100', name: 'Current Liabilities',        nameHi: 'चालू दायित्व',             type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: true,  parentId: '2000' },
  { id: '2101', name: 'Sundry Creditors',           nameHi: 'विविध लेनदार',             type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2100' },
  { id: '2102', name: 'Expenses Payable',           nameHi: 'देय व्यय',                 type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2100' },
  { id: '2103', name: 'Salary Payable',             nameHi: 'देय वेतन',                 type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2100' },
  { id: '2104', name: 'Dividend Payable',           nameHi: 'देय लाभांश',               type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2100' },
  { id: '2105', name: 'MSP Payable to Farmers',     nameHi: 'किसानों को देय MSP',        type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2100' },
  { id: '2106', name: 'Member Payable',             nameHi: 'सदस्य देय',                type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2100' },
  { id: '2107', name: 'Member Deposits',            nameHi: 'सदस्य जमाराशि',            type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2100' },
  { id: '2200', name: 'Statutory Liabilities',      nameHi: 'वैधानिक दायित्व',          type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: true,  parentId: '2000' },
  { id: '2201', name: 'GST Payable',                nameHi: 'देय GST',                  type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2200' },
  { id: '2202', name: 'TDS Payable',                nameHi: 'देय TDS',                  type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2200' },
  { id: '2203', name: 'EPF Payable',                nameHi: 'देय EPF',                  type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2200' },
  { id: '2204', name: 'ESI Payable',                nameHi: 'देय ESI',                  type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2200' },
  { id: '2205', name: 'HRDF Payable',               nameHi: 'देय HRDF',                 type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2200' },
  { id: '2300', name: 'Loans',                      nameHi: 'ऋण',                       type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: true,  parentId: '2000' },
  { id: '2301', name: 'Bank OD',                    nameHi: 'बैंक अधिविकर्ष',           type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2300' },
  { id: '2302', name: 'Secured Loan',               nameHi: 'सुरक्षित ऋण',              type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2300' },
  { id: '2303', name: 'Unsecured Loan',             nameHi: 'असुरक्षित ऋण',             type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2300' },

  // ── Assets ───────────────────────────────────────────────────────────────
  { id: '3000', name: 'Assets',                     nameHi: 'संपत्तियाँ',               type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: true,  isGroup: true  },
  { id: '3100', name: 'Fixed Assets',               nameHi: 'स्थायी संपत्तियाँ',         type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: true,  parentId: '3000' },
  { id: '3101', name: 'Land',                       nameHi: 'भूमि',                     type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3100' },
  { id: '3102', name: 'Building',                   nameHi: 'भवन',                      type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3100' },
  { id: '3103', name: 'Furniture',                  nameHi: 'फर्नीचर',                   type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3100' },
  { id: '3104', name: 'Vehicle',                    nameHi: 'वाहन',                     type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3100' },
  { id: '3105', name: 'Plant & Machinery',          nameHi: 'संयंत्र एवं मशीनरी',       type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3100' },
  { id: '3106', name: 'Office Equipment',           nameHi: 'कार्यालय उपकरण',           type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3100' },
  { id: '3108', name: 'Accum. Dep. - Building',     nameHi: 'संचित ह्रास - भवन',         type: 'asset',     openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '3100' },
  { id: '3109', name: 'Accum. Dep. - Furniture',    nameHi: 'संचित ह्रास - फर्नीचर',     type: 'asset',     openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '3100' },
  { id: '3110', name: 'Accum. Dep. - Vehicle',      nameHi: 'संचित ह्रास - वाहन',        type: 'asset',     openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '3100' },
  { id: '3111', name: 'Accum. Dep. - Plant',        nameHi: 'संचित ह्रास - संयंत्र',     type: 'asset',     openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '3100' },
  { id: '3112', name: 'Accum. Dep. - Office Equip', nameHi: 'संचित ह्रास - उपकरण',       type: 'asset',     openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '3100' },
  { id: '3200', name: 'Investments',                nameHi: 'निवेश',                    type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: true,  parentId: '3000' },
  { id: '3201', name: 'Hafed Share',                nameHi: 'हैफेड शेयर',               type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3200' },
  { id: '3202', name: 'IFFCO Share',                nameHi: 'इफको शेयर',                type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3200' },
  { id: '3203', name: 'KRIBHCO Share',              nameHi: 'कृभको शेयर',               type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3200' },
  { id: '3204', name: 'NCEL/NCOL Shares',           nameHi: 'NCEL/NCOL शेयर',           type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3200' },
  { id: '3205', name: 'FDR',                        nameHi: 'सावधि जमा (FDR)',           type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3200' },
  { id: '3206', name: 'Security Deposits',          nameHi: 'सुरक्षा जमा',              type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3200' },
  { id: '3300', name: 'Current Assets',             nameHi: 'चालू संपत्तियाँ',           type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: true,  isGroup: true,  parentId: '3000' },
  { id: '3301', name: 'Cash in Hand',               nameHi: 'हाथ में नकद',              type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: true,  isGroup: false, parentId: '3300' },
  { id: '3302', name: 'Bank Accounts',              nameHi: 'बैंक खाते',                type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: true,  isGroup: false, parentId: '3300' },
  { id: '3303', name: 'Sundry Debtors',             nameHi: 'विविध देनदार',             type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3300' },
  { id: '3304', name: 'Loans & Advances',           nameHi: 'ऋण एवं अग्रिम',            type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3300' },
  { id: '3305', name: 'Subsidy Receivable',         nameHi: 'प्राप्य अनुदान',            type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3300' },
  { id: '3306', name: 'Rent Receivable',            nameHi: 'प्राप्य किराया',            type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3300' },
  { id: '3307', name: 'TDS Receivable',             nameHi: 'प्राप्य TDS',               type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3300' },
  { id: '3308', name: 'MSP Receivable',             nameHi: 'प्राप्य MSP',               type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3300' },
  { id: '3309', name: 'Member Receivable',          nameHi: 'सदस्य प्राप्य',             type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3300' },
  { id: '3310', name: 'GST Input Credit (ITC)',     nameHi: 'GST इनपुट क्रेडिट (ITC)',   type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3300' },
  { id: '3311', name: 'Prepaid Expenses',           nameHi: 'अग्रिम व्यय',               type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3300' },
  { id: '3400', name: 'Inventory',                  nameHi: 'माल-सूची',                 type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: true,  parentId: '3000' },
  { id: '3401', name: 'Raw Material',               nameHi: 'कच्चा माल',                type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3400' },
  { id: '3402', name: 'Finished Goods',             nameHi: 'तैयार माल',                type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3400' },
  { id: '3403', name: 'Trading Goods',              nameHi: 'व्यापारिक माल',            type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3400' },
  { id: '3404', name: 'Consumables',                nameHi: 'उपभोग्य सामग्री',           type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3400' },
  { id: '3405', name: 'Work in Progress',           nameHi: 'निर्माणाधीन कार्य',         type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3400' },

  // ── Income ───────────────────────────────────────────────────────────────
  { id: '4000', name: 'Income',                     nameHi: 'आय',                       type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: true,  isGroup: true  },
  { id: '4100', name: 'Trading Income',             nameHi: 'व्यापारिक आय',             type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: true,  parentId: '4000' },
  { id: '4101', name: 'Fertilizer Sales',           nameHi: 'उर्वरक बिक्री',            type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4100' },
  { id: '4102', name: 'Seed Sales',                 nameHi: 'बीज बिक्री',               type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4100' },
  { id: '4103', name: 'Consumer Goods Sales',       nameHi: 'उपभोक्ता वस्तु बिक्री',    type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4100' },
  { id: '4200', name: 'Commission Income',          nameHi: 'कमीशन आय',                type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: true,  parentId: '4000' },
  { id: '4201', name: 'Dami Income',                nameHi: 'दामी आय',                  type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4200' },
  { id: '4202', name: 'Market Fee',                 nameHi: 'मंडी शुल्क आय',            type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4200' },
  { id: '4203', name: 'Labor Charges',              nameHi: 'श्रम प्रभार आय',           type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4200' },
  { id: '4204', name: 'HRDF',                       nameHi: 'HRDF आय',                  type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4200' },
  { id: '4205', name: 'Society Commission',         nameHi: 'समिति कमीशन',              type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4200' },
  { id: '4206', name: 'Procurement Commission',     nameHi: 'खरीद कमीशन',              type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4200' },
  { id: '4300', name: 'Scheme Income',              nameHi: 'योजना आय',                 type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: true,  parentId: '4000' },
  { id: '4301', name: 'Anganwadi',                  nameHi: 'आंगनवाड़ी आय',             type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4300' },
  { id: '4302', name: 'MDM',                        nameHi: 'मध्याह्न भोजन आय',         type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4300' },
  { id: '4303', name: 'Govt Subsidy',               nameHi: 'सरकारी अनुदान',            type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4300' },
  { id: '4400', name: 'Other Income',               nameHi: 'अन्य आय',                  type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: true,  parentId: '4000' },
  { id: '4401', name: 'Rent',                       nameHi: 'किराया आय',                type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4400' },
  { id: '4402', name: 'Transport',                  nameHi: 'परिवहन आय',                type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4400' },
  { id: '4403', name: 'Interest',                   nameHi: 'ब्याज आय',                 type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4400' },
  { id: '4404', name: 'Dividend',                   nameHi: 'लाभांश आय',                type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4400' },
  { id: '4405', name: 'Misc',                       nameHi: 'विविध आय',                 type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4400' },
  { id: '4406', name: 'Patronage Rebate',           nameHi: 'संरक्षण छूट',              type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5400' },
  { id: '4407', name: 'Admission Fee',              nameHi: 'प्रवेश शुल्क (पूंजी)',     type: 'equity',    openingBalance: 0, openingBalanceType: 'credit', isSystem: true,  isGroup: false, parentId: '1200' },

  // ── Expenses ─────────────────────────────────────────────────────────────
  { id: '5000', name: 'Expenses',                   nameHi: 'व्यय',                     type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: true,  isGroup: true  },
  { id: '5100', name: 'Direct Expenses',            nameHi: 'प्रत्यक्ष व्यय',           type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: true,  parentId: '5000' },
  { id: '5101', name: 'Purchase',                   nameHi: 'क्रय',                     type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5100' },
  { id: '5102', name: 'Labor',                      nameHi: 'श्रम व्यय',                type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5100' },
  { id: '5103', name: 'Transport',                  nameHi: 'परिवहन व्यय',              type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5100' },
  { id: '5104', name: 'Market Charges',             nameHi: 'मंडी शुल्क व्यय',          type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5100' },
  { id: '5105', name: 'Trading Expense',            nameHi: 'व्यापारिक व्यय',           type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5100' },
  { id: '5106', name: 'Processing Expense',         nameHi: 'प्रसंस्करण व्यय',          type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5100' },
  { id: '5107', name: 'Packing',                    nameHi: 'पैकिंग व्यय',              type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5100' },
  { id: '5108', name: 'Wastage',                    nameHi: 'बर्बादी व्यय',              type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5100' },
  { id: '5200', name: 'Employee Expenses',          nameHi: 'कर्मचारी व्यय',            type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: true,  parentId: '5000' },
  { id: '5201', name: 'Salary',                     nameHi: 'वेतन',                     type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5200' },
  { id: '5202', name: 'Wages',                      nameHi: 'मजदूरी',                   type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5200' },
  { id: '5203', name: 'PF',                         nameHi: 'भविष्य निधि (PF)',          type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5200' },
  { id: '5204', name: 'ESI',                        nameHi: 'कर्मचारी बीमा (ESI)',       type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5200' },
  { id: '5205', name: 'Staff Welfare',              nameHi: 'कर्मचारी कल्याण',           type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5200' },
  { id: '5300', name: 'Admin Expenses',             nameHi: 'प्रशासनिक व्यय',           type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: true,  parentId: '5000' },
  { id: '5301', name: 'Office',                     nameHi: 'कार्यालय व्यय',            type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5300' },
  { id: '5302', name: 'Electricity',                nameHi: 'बिजली व्यय',               type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5300' },
  { id: '5303', name: 'Printing',                   nameHi: 'मुद्रण व्यय',               type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5300' },
  { id: '5304', name: 'Telephone',                  nameHi: 'दूरभाष व्यय',              type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5300' },
  { id: '5305', name: 'Legal',                      nameHi: 'कानूनी व्यय',              type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5300' },
  { id: '5306', name: 'Audit',                      nameHi: 'लेखा परीक्षण व्यय',         type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5300' },
  { id: '5307', name: 'Software',                   nameHi: 'सॉफ्टवेयर व्यय',           type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5300' },
  { id: '5308', name: 'Rent',                       nameHi: 'किराया व्यय',               type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5300' },
  { id: '5309', name: 'Travelling Expenses',        nameHi: 'यात्रा व्यय',               type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5300' },
  { id: '5310', name: 'Meeting / AGM Expenses',     nameHi: 'बैठक / AGM व्यय',           type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5300' },
  { id: '5311', name: 'Education Fund Contribution',nameHi: 'शिक्षा निधि अंशदान',         type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5300' },
  { id: '5400', name: 'Operational Expenses',       nameHi: 'परिचालन व्यय',             type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: true,  parentId: '5000' },
  { id: '5401', name: 'Vehicle',                    nameHi: 'वाहन व्यय',                type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5400' },
  { id: '5402', name: 'Repair',                     nameHi: 'मरम्मत व्यय',              type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5400' },
  { id: '5403', name: 'Insurance',                  nameHi: 'बीमा व्यय',                type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5400' },
  { id: '5500', name: 'Depreciation',               nameHi: 'ह्रास',                    type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: true,  parentId: '5000' },
  { id: '5501', name: 'Building',                   nameHi: 'भवन ह्रास',                type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5500' },
  { id: '5502', name: 'Furniture',                  nameHi: 'फर्नीचर ह्रास',             type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5500' },
  { id: '5503', name: 'Vehicle',                    nameHi: 'वाहन ह्रास',               type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5500' },
  { id: '5504', name: 'Plant',                      nameHi: 'संयंत्र ह्रास',             type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5500' },
  { id: '5505', name: 'Computer / Office Equip',    nameHi: 'कंप्यूटर / उपकरण ह्रास',   type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5500' },
  { id: '5600', name: 'Statutory Expenses',         nameHi: 'वैधानिक व्यय',             type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: true,  parentId: '5000' },
  { id: '5601', name: 'GST',                        nameHi: 'GST व्यय',                 type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5600' },
  { id: '5602', name: 'Professional Tax / Local Levies', nameHi: 'व्यावसायिक कर / स्थानीय शुल्क', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '5600' },

  // ── Suspense ─────────────────────────────────────────────────────────────
  { id: '9999', name: 'Suspense Account',           nameHi: 'संदिग्ध खाता',             type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false },
];

// Template map: societyType → accounts array
export const SOCIETY_TEMPLATES: Record<string, LedgerAccount[]> = {
  marketing_processing: CMS_SOCIETY_ACCOUNTS,
  // Future: pacs: PACS_ACCOUNTS, consumer: CONSUMER_ACCOUNTS ...
};

// Fallback for societies that have no template (use CMS as default)
export const DEFAULT_ACCOUNTS = CMS_SOCIETY_ACCOUNTS;

// ── Account Migration (v2 → v3) ───────────────────────────────────────────────
// Applies to existing societies: renames, reclassifies, and adds missing accounts
// Idempotent — safe to run on every app load
const ACCOUNT_PATCHES: Record<string, Partial<LedgerAccount>> = {
  '1201': { name: 'Statutory Reserve Fund',         nameHi: 'वैधानिक संचय निधि' },
  '1208': { name: 'Net Surplus / (Deficit)',          nameHi: 'शुद्ध अधिशेष / (घाटा)' },
  '4406': { type: 'expense', openingBalanceType: 'debit',  parentId: '5400' },
  '4407': { type: 'equity',  openingBalanceType: 'credit', parentId: '1200', nameHi: 'प्रवेश शुल्क (पूंजी)' },
  '5602': { name: 'Professional Tax / Local Levies', nameHi: 'व्यावसायिक कर / स्थानीय शुल्क' },
};

const ACCOUNTS_TO_ADD: LedgerAccount[] = [
  { id: '2107', name: 'Member Deposits',            nameHi: 'सदस्य जमाराशि',            type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2100' },
  { id: '2205', name: 'HRDF Payable',               nameHi: 'देय HRDF',                 type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2200' },
  { id: '3108', name: 'Accum. Dep. - Building',     nameHi: 'संचित ह्रास - भवन',         type: 'asset',     openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '3100' },
  { id: '3109', name: 'Accum. Dep. - Furniture',    nameHi: 'संचित ह्रास - फर्नीचर',     type: 'asset',     openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '3100' },
  { id: '3110', name: 'Accum. Dep. - Vehicle',      nameHi: 'संचित ह्रास - वाहन',        type: 'asset',     openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '3100' },
  { id: '3111', name: 'Accum. Dep. - Plant',        nameHi: 'संचित ह्रास - संयंत्र',     type: 'asset',     openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '3100' },
  { id: '3112', name: 'Accum. Dep. - Office Equip', nameHi: 'संचित ह्रास - उपकरण',       type: 'asset',     openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '3100' },
  { id: '3310', name: 'GST Input Credit (ITC)',     nameHi: 'GST इनपुट क्रेडिट (ITC)',   type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3300' },
  { id: '3311', name: 'Prepaid Expenses',           nameHi: 'अग्रिम व्यय',               type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '3300' },
  { id: '5308', name: 'Rent',                       nameHi: 'किराया व्यय',               type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5300' },
  { id: '5309', name: 'Travelling Expenses',        nameHi: 'यात्रा व्यय',               type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5300' },
  { id: '5310', name: 'Meeting / AGM Expenses',     nameHi: 'बैठक / AGM व्यय',           type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5300' },
  { id: '5311', name: 'Education Fund Contribution',nameHi: 'शिक्षा निधि अंशदान',         type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5300' },
  { id: '5505', name: 'Computer / Office Equip',    nameHi: 'कंप्यूटर / उपकरण ह्रास',   type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false, isGroup: false, parentId: '5500' },
];

export function migrateAccounts(existing: LedgerAccount[]): { accounts: LedgerAccount[]; changed: boolean } {
  let changed = false;

  // Step 1: Apply patches to existing accounts
  const patched = existing.map(acc => {
    const patch = ACCOUNT_PATCHES[acc.id];
    if (!patch) return acc;
    changed = true;
    return { ...acc, ...patch } as LedgerAccount;
  });

  // Step 2: Add missing accounts (skip if already present)
  const existingIds = new Set(patched.map(a => a.id));
  for (const newAcc of ACCOUNTS_TO_ADD) {
    if (!existingIds.has(newAcc.id)) {
      patched.push(newAcc);
      changed = true;
    }
  }

  return { accounts: patched, changed };
}

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
  societyType: 'marketing_processing',
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

export const getNextVoucherNo = (
  type: 'receipt' | 'payment' | 'journal' | 'contra',
  financialYear: string,
  existingVouchers: { voucherNo?: string }[] = []
): string => {
  const prefix = type === 'receipt' ? 'RV' : type === 'payment' ? 'PV' : type === 'contra' ? 'CV' : 'JV';
  const yr = financialYear.replace('-', '/');
  const escapedYr = yr.replace('/', '\\/');
  const pattern = new RegExp(`^${prefix}\\/${escapedYr}\\/(\\d+)$`);
  const nums = existingVouchers
    .map(v => { const m = v.voucherNo?.match(pattern); return m ? parseInt(m[1], 10) : 0; })
    .filter(n => n > 0);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}/${yr}/${String(next).padStart(3, '0')}`;
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

// ── Suppliers ─────────────────────────────────────────────────────────────────
export const getSuppliers = (): Supplier[] => get(KEYS.suppliers, []);
export const setSuppliers = (s: Supplier[]): void => set(KEYS.suppliers, s);
export const getNextSupplierCode = (): string => {
  const current = get<number>(KEYS.supplierCounter, 0) + 1;
  set(KEYS.supplierCounter, current);
  return `SUP/${String(current).padStart(3, '0')}`;
};

// ── Customers ─────────────────────────────────────────────────────────────────
export const getCustomers = (): Customer[] => get(KEYS.customers, []);
export const setCustomers = (c: Customer[]): void => set(KEYS.customers, c);
export const getNextCustomerCode = (): string => {
  const current = get<number>(KEYS.customerCounter, 0) + 1;
  set(KEYS.customerCounter, current);
  return `CUS/${String(current).padStart(3, '0')}`;
};

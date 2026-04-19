import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'hi' | 'en';

interface Translations {
  [key: string]: {
    hi: string;
    en: string;
  };
}

// Core translations for the application
export const translations: Translations = {
  // Navigation
  dashboard: { hi: 'डैशबोर्ड', en: 'Dashboard' },
  cashBook: { hi: 'नकद बही', en: 'Cash Book' },
  bankBook: { hi: 'बैंक बही', en: 'Bank Book' },
  dayBook: { hi: 'रोजनामचा', en: 'Day Book' },
  vouchers: { hi: 'वाउचर', en: 'Vouchers' },
  ledger: { hi: 'खाता बही', en: 'Ledger' },
  members: { hi: 'सदस्य', en: 'Members' },
  memberApplication: { hi: 'सदस्यता आवेदन', en: 'Member Application' },
  trialBalance: { hi: 'तलपट', en: 'Trial Balance' },
  tradingAccount: { hi: 'व्यापार खाता', en: 'Trading Account' },
  profitLoss: { hi: 'आय-व्यय', en: 'Income & Expenditure' },
  receiptsPayments: { hi: 'प्राप्ति-भुगतान', en: 'Receipts & Payments' },
  balanceSheet: { hi: 'तुलन पत्र', en: 'Balance Sheet' },
  reports: { hi: 'रिपोर्ट', en: 'Reports' },
  settings: { hi: 'सेटिंग्स', en: 'Settings' },
  societySetup: { hi: 'समिति सेटअप', en: 'Society Setup' },
  registers: { hi: 'रजिस्टर', en: 'Registers' },
  shareRegister: { hi: 'अंश रजिस्टर', en: 'Share Register' },
  loanRegister: { hi: 'ऋण रजिस्टर', en: 'Loan Register' },
  assetRegister: { hi: 'संपत्ति रजिस्टर', en: 'Asset Register' },
  depreciationSchedule: { hi: 'ह्रास अनुसूची', en: 'Depreciation Schedule' },
  auditRegister: { hi: 'ऑडिट रजिस्टर', en: 'Audit Register' },
  deletedVouchers: { hi: 'रद्द वाउचर', en: 'Deleted Vouchers' },
  bankReconciliation: { hi: 'बैंक समाधान (BRS)', en: 'Bank Reconciliation' },
  reserveFund: { hi: 'संचय निधि आवंटन', en: 'Reserve Fund' },
  profitDistribution: { hi: 'लाभ वितरण', en: 'Profit Distribution' },
  loanInterest: { hi: 'ऋण ब्याज गणना', en: 'Loan Interest' },
  compoundVoucher: { hi: 'संयुक्त वाउचर', en: 'Compound Voucher' },
  voucherApproval: { hi: 'वाउचर अनुमोदन', en: 'Voucher Approval' },
  meetingRegister: { hi: 'AGM / बैठक रजिस्टर', en: 'Meeting Register' },
  nominationRegister: { hi: 'नामांकन रजिस्टर', en: 'Nomination Register' },
  form1MemberList: { hi: 'प्रपत्र 1 — सदस्य सूची', en: 'Form 1 — Member List' },
  auditCertificate: { hi: 'ऑडिट प्रमाणपत्र', en: 'Audit Certificate' },
  auditSchedules: { hi: 'ऑडिट अनुसूचियां', en: 'Audit Schedules' },
  backupRestore: { hi: 'बैकअप / रीस्टोर', en: 'Backup & Restore' },
  multiSocietyConsolidation: { hi: 'बहु-समिति समेकन', en: 'Multi-Society Consolidation' },
  universalImporter: { hi: 'डेटा Import (Universal)', en: 'Universal Importer' },
  gstSummary: { hi: 'GST सारांश', en: 'GST Summary' },
  agingAnalysis: { hi: 'AR/AP बकाया विश्लेषण', en: 'Aging Analysis' },
  saleRegister: { hi: 'बिक्री रजिस्टर', en: 'Sale Register' },
  purchaseRegister: { hi: 'क्रय रजिस्टर', en: 'Purchase Register' },
  stockValuation: { hi: 'स्टॉक मूल्यांकन', en: 'Stock Valuation' },
  closingStockReport: { hi: 'समापन माल रिपोर्ट', en: 'Closing Stock Report' },
  budgetModule: { hi: 'बजट मॉड्यूल', en: 'Budget Module' },
  tdsForm16A: { hi: 'TDS Form 16A', en: 'TDS Form 16A' },
  tdsRegister: { hi: 'TDS रजिस्टर / 26Q', en: 'TDS Register / 26Q' },
  userManagement: { hi: 'उपयोगकर्ता प्रबंधन', en: 'User Management' },
  eWayBill: { hi: 'e-Way Bill', en: 'e-Way Bill' },
  hsnMaster: { hi: 'HSN/SAC मास्टर', en: 'HSN/SAC Master' },
  kccLoan: { hi: 'KCC / फसल ऋण', en: 'KCC / Crop Loan' },
  electionModule: { hi: 'सहकारी चुनाव', en: 'Election Module' },
  boardOfDirectors: { hi: 'निदेशक मंडल', en: 'Board of Directors' },
  openingBalances: { hi: 'प्रारंभिक शेष / CF', en: 'Opening Balances / CF' },
  nabardReport: { hi: 'NABARD क्रेडिट रिपोर्ट', en: 'NABARD Credit Report' },
  federationReport: { hi: 'सहकारी वार्षिक विवरणी', en: 'Federation Annual Return' },
  annualReview: { hi: 'वार्षिक समीक्षा (HAFED)', en: 'Annual Review (HAFED)' },
  recoverables: { hi: 'वसूली योग्य रजिस्टर', en: 'Recoverables Register' },
  kachiAarat: { hi: 'कच्ची आढ़त रजिस्टर', en: 'Kachi Aarat Register' },
  operations: { hi: 'संचालन', en: 'Operations' },
  ledgerHeads: { hi: 'खाता शीर्ष', en: 'Ledger Heads' },
  inventory: { hi: 'माल भंडार', en: 'Inventory' },
  sales: { hi: 'बिक्री', en: 'Sales' },
  purchases: { hi: 'खरीद', en: 'Purchases' },
  salary: { hi: 'वेतन', en: 'Salary' },
  suppliers: { hi: 'आपूर्तिकर्ता', en: 'Suppliers' },
  customers: { hi: 'ग्राहक', en: 'Customers' },
  
  // Common actions
  save: { hi: 'सहेजें', en: 'Save' },
  cancel: { hi: 'रद्द करें', en: 'Cancel' },
  edit: { hi: 'संपादित करें', en: 'Edit' },
  delete: { hi: 'हटाएं', en: 'Delete' },
  add: { hi: 'जोड़ें', en: 'Add' },
  search: { hi: 'खोजें', en: 'Search' },
  print: { hi: 'प्रिंट', en: 'Print' },
  export: { hi: 'निर्यात', en: 'Export' },
  view: { hi: 'देखें', en: 'View' },
  submit: { hi: 'जमा करें', en: 'Submit' },
  
  // Financial terms
  receipt: { hi: 'रसीद', en: 'Receipt' },
  payment: { hi: 'भुगतान', en: 'Payment' },
  balance: { hi: 'शेष', en: 'Balance' },
  debit: { hi: 'नाम (डेबिट)', en: 'Debit' },
  credit: { hi: 'जमा (क्रेडिट)', en: 'Credit' },
  amount: { hi: 'राशि', en: 'Amount' },
  total: { hi: 'कुल', en: 'Total' },
  date: { hi: 'तिथि', en: 'Date' },
  particulars: { hi: 'विवरण', en: 'Particulars' },
  voucherNo: { hi: 'वाउचर नं.', en: 'Voucher No.' },
  narration: { hi: 'विवरण', en: 'Narration' },
  openingBalance: { hi: 'प्रारंभिक शेष', en: 'Opening Balance' },
  closingBalance: { hi: 'अंतिम शेष', en: 'Closing Balance' },
  
  // Dashboard
  totalCash: { hi: 'कुल नकद', en: 'Total Cash' },
  totalBank: { hi: 'कुल बैंक', en: 'Total Bank' },
  totalMembers: { hi: 'कुल सदस्य', en: 'Total Members' },
  netProfit: { hi: 'शुद्ध लाभ', en: 'Net Profit' },
  todayTransactions: { hi: 'आज के लेनदेन', en: "Today's Transactions" },
  recentVouchers: { hi: 'हाल के वाउचर', en: 'Recent Vouchers' },
  quickActions: { hi: 'त्वरित कार्य', en: 'Quick Actions' },
  
  // Members
  memberId: { hi: 'सदस्य आईडी', en: 'Member ID' },
  memberName: { hi: 'सदस्य का नाम', en: 'Member Name' },
  shareCapital: { hi: 'अंश पूंजी', en: 'Share Capital' },
  address: { hi: 'पता', en: 'Address' },
  phone: { hi: 'फोन', en: 'Phone' },
  
  // Voucher types
  receiptVoucher: { hi: 'रसीद वाउचर', en: 'Receipt Voucher' },
  paymentVoucher: { hi: 'भुगतान वाउचर', en: 'Payment Voucher' },
  journalVoucher: { hi: 'जर्नल वाउचर', en: 'Journal Voucher' },
  
  // Society
  societyName: { hi: 'समिति का नाम', en: 'Society Name' },
  registrationNo: { hi: 'पंजीकरण संख्या', en: 'Registration No.' },
  financialYear: { hi: 'वित्तीय वर्ष', en: 'Financial Year' },
  
  // Auth
  login: { hi: 'लॉगिन', en: 'Login' },
  logout: { hi: 'लॉगआउट', en: 'Logout' },
  email: { hi: 'ईमेल', en: 'Email' },
  password: { hi: 'पासवर्ड', en: 'Password' },
  welcomeBack: { hi: 'पुनः स्वागत है', en: 'Welcome Back' },
  
  // Roles
  admin: { hi: 'व्यवस्थापक', en: 'Admin' },
  accountant: { hi: 'लेखाकार', en: 'Accountant' },
  viewer: { hi: 'दर्शक', en: 'Viewer' },
  auditor: { hi: 'CA / लेखा परीक्षक', en: 'CA / Auditor' },
  
  // Messages
  successSaved: { hi: 'सफलतापूर्वक सहेजा गया', en: 'Saved successfully' },
  errorOccurred: { hi: 'कोई त्रुटि हुई', en: 'An error occurred' },
  confirmDelete: { hi: 'क्या आप वाकई हटाना चाहते हैं?', en: 'Are you sure you want to delete?' },
  noData: { hi: 'कोई डेटा नहीं', en: 'No data available' },
  
  // Reports
  fromDate: { hi: 'तिथि से', en: 'From Date' },
  toDate: { hi: 'तिथि तक', en: 'To Date' },
  generateReport: { hi: 'रिपोर्ट बनाएं', en: 'Generate Report' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try { return (localStorage.getItem('sahayata_language') as Language) || 'hi'; } catch { return 'hi'; }
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try { localStorage.setItem('sahayata_language', lang); } catch {}
  };

  const t = (key: string): string => {
    if (translations[key]) {
      return translations[key][language];
    }
    console.warn(`Translation missing for key: ${key}`);
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

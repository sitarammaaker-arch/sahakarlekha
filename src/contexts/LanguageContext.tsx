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
  cashBook: { hi: 'कैश बुक', en: 'Cash Book' },
  bankBook: { hi: 'बैंक बुक', en: 'Bank Book' },
  dayBook: { hi: 'डे बुक', en: 'Day Book' },
  vouchers: { hi: 'वाउचर', en: 'Vouchers' },
  ledger: { hi: 'लेजर', en: 'Ledger' },
  members: { hi: 'सदस्य', en: 'Members' },
  memberApplication: { hi: 'सदस्यता आवेदन', en: 'Member Application' },
  trialBalance: { hi: 'ट्रायल बैलेंस', en: 'Trial Balance' },
  tradingAccount: { hi: 'व्यापार खाता', en: 'Trading Account' },
  profitLoss: { hi: 'आमदनी-खर्च', en: 'Income & Expenditure' },
  receiptsPayments: { hi: 'रसीद-भुगतान', en: 'Receipts & Payments' },
  balanceSheet: { hi: 'बैलेंस शीट', en: 'Balance Sheet' },
  reports: { hi: 'रिपोर्ट', en: 'Reports' },
  settings: { hi: 'सेटिंग्स', en: 'Settings' },
  societySetup: { hi: 'समिति सेटअप', en: 'Society Setup' },
  registers: { hi: 'रजिस्टर', en: 'Registers' },
  shareRegister: { hi: 'शेयर रजिस्टर', en: 'Share Register' },
  loanRegister: { hi: 'ऋण रजिस्टर', en: 'Loan Register' },
  milkCollection: { hi: 'दूध संकलन', en: 'Milk Collection' },
  assetRegister: { hi: 'संपत्ति रजिस्टर', en: 'Asset Register' },
  depreciationSchedule: { hi: 'डेप्रिसिएशन शेड्यूल', en: 'Depreciation Schedule' },
  auditRegister: { hi: 'ऑडिट रजिस्टर', en: 'Audit Register' },
  deletedVouchers: { hi: 'रद्द वाउचर', en: 'Deleted Vouchers' },
  bankReconciliation: { hi: 'बैंक समाधान (BRS)', en: 'Bank Reconciliation' },
  reserveFund: { hi: 'रिज़र्व फंड आवंटन', en: 'Reserve Fund' },
  profitDistribution: { hi: 'लाभ का बँटवारा', en: 'Profit Distribution' },
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
  purchaseRegister: { hi: 'खरीद रजिस्टर', en: 'Purchase Register' },
  billsOutstanding: { hi: 'बकाया बिल (बिल-वार)', en: 'Bills Outstanding' },
  stockValuation: { hi: 'स्टॉक वैल्यूएशन', en: 'Stock Valuation' },
  closingStockReport: { hi: 'क्लोज़िंग स्टॉक रिपोर्ट', en: 'Closing Stock Report' },
  budgetModule: { hi: 'बजट मॉड्यूल', en: 'Budget Module' },
  tdsForm16A: { hi: 'TDS Form 16A', en: 'TDS Form 16A' },
  tdsRegister: { hi: 'TDS रजिस्टर / 26Q', en: 'TDS Register / 26Q' },
  userManagement: { hi: 'उपयोगकर्ता प्रबंधन', en: 'User Management' },
  features: { hi: 'सुविधाएँ', en: 'Features' },
  eWayBill: { hi: 'e-Way Bill', en: 'e-Way Bill' },
  hsnMaster: { hi: 'HSN/SAC मास्टर', en: 'HSN/SAC Master' },
  kccLoan: { hi: 'KCC / फसल ऋण', en: 'KCC / Crop Loan' },
  electionModule: { hi: 'सहकारी चुनाव', en: 'Election Module' },
  boardOfDirectors: { hi: 'निदेशक मंडल', en: 'Board of Directors' },
  openingBalances: { hi: 'ओपनिंग बैलेंस / CF', en: 'Opening Balances / CF' },
  nabardReport: { hi: 'NABARD क्रेडिट रिपोर्ट', en: 'NABARD Credit Report' },
  federationReport: { hi: 'सहकारी सालाना रिटर्न', en: 'Federation Annual Return' },
  recoverables: { hi: 'वसूली योग्य रजिस्टर', en: 'Recoverables Register' },
  kachiAarat: { hi: 'कच्ची आढ़त रजिस्टर', en: 'Kachi Aarat Register' },
  procurementLots: { hi: 'खरीद लॉट', en: 'Procurement Lots' },
  flatsRegister: { hi: 'फ्लैट/यूनिट रजिस्टर', en: 'Flats / Units Register' },
  maintenanceBilling: { hi: 'रखरखाव बिलिंग', en: 'Maintenance Billing' },
  chargeHeads: { hi: 'शुल्क मदें', en: 'Charge Heads' },
  memberStatement: { hi: 'सदस्य विवरण', en: 'Member Statement' },
  fundStatement: { hi: 'निधि विवरण', en: 'Fund Statement' },
  outstandingRegister: { hi: 'बकाया रजिस्टर', en: 'Outstanding Register' },
  complaints: { hi: 'शिकायत रजिस्टर', en: 'Complaints' },
  parking: { hi: 'पार्किंग रजिस्टर', en: 'Parking' },
  transferRegister: { hi: 'हस्तांतरण रजिस्टर', en: 'Transfer Register' },
  shareNominationRegister: { hi: 'शेयर एवं नामांकन', en: 'Share & Nomination' },
  insurance: { hi: 'बीमा रजिस्टर', en: 'Insurance' },
  amc: { hi: 'AMC / अनुबंध', en: 'AMC / Contracts' },
  legalDocuments: { hi: 'कानूनी / दस्तावेज़', en: 'Legal / Documents' },
  buildings: { hi: 'भवन / विंग', en: 'Buildings / Wings' },
  navConsumer: { hi: 'उपभोक्ता भंडार', en: 'Consumer Store' },
  retailCounter: { hi: 'रिटेल काउंटर (POS)', en: 'Retail Counter (POS)' },
  priceLists: { hi: 'मूल्य सूची', en: 'Price Lists' },
  memberCredit: { hi: 'सदस्य उधार', en: 'Member Credit' },
  expiryDamage: { hi: 'समाप्ति एवं क्षति', en: 'Expiry & Damage' },
  purchaseOrders: { hi: 'खरीद ऑर्डर (PO)', en: 'Purchase Orders' },
  patronage: { hi: 'संरक्षण रिबेट', en: 'Patronage Rebate' },
  consumerDividend: { hi: 'लाभांश', en: 'Dividend' },
  consumerRegisters: { hi: 'उपभोक्ता रजिस्टर', en: 'Consumer Registers' },
  navMarketing: { hi: 'विपणन प्रबंधन', en: 'Marketing' },
  procurementMasters: { hi: 'प्रोक्योरमेंट मास्टर', en: 'Procurement Masters' },
  agencyReceipts: { hi: 'एजेंसी रसीद', en: 'Agency Receipt' },
  procurementRegisters: { hi: 'प्रोक्योरमेंट रजिस्टर', en: 'Procurement Registers' },
  transport: { hi: 'परिवहन', en: 'Transport' },
  navDairy: { hi: 'दुग्ध प्रबंधन', en: 'Dairy' },
  dairyRateCharts: { hi: 'दुग्ध रेट चार्ट', en: 'Milk Rate Charts' },
  farmerSettlement: { hi: 'दुग्ध सेटलमेंट', en: 'Farmer Settlement' },
  milkDispatch: { hi: 'दुग्ध डिस्पैच', en: 'Milk Dispatch' },
  dairyInputs: { hi: 'सदस्य आदान', en: 'Member Inputs' },
  dairyDistribution: { hi: 'बोनस / लाभांश', en: 'Bonus / Dividend' },
  dairyRegisters: { hi: 'दुग्ध रजिस्टर', en: 'Dairy Registers' },
  navLabour: { hi: 'श्रमिक प्रबंधन', en: 'Labour' },
  navHousing: { hi: 'आवास प्रबंधन', en: 'Housing' },
  workerMaster: { hi: 'श्रमिक मास्टर', en: 'Worker Master' },
  departmentMaster: { hi: 'विभाग / नियोक्ता', en: 'Department / Employer' },
  workerAdvances: { hi: 'श्रमिक अग्रिम', en: 'Worker Advances' },
  departmentBills: { hi: 'विभाग बिल', en: 'Department Bills' },
  workOrderProfit: { hi: 'कार्य आदेश लाभ', en: 'Work Order Profit' },
  wageRegister: { hi: 'मज़दूरी रजिस्टर', en: 'Wage Register' },
  workerLedger: { hi: 'श्रमिक लेजर', en: 'Worker Ledger' },
  advanceRegister: { hi: 'अग्रिम रजिस्टर', en: 'Advance Register' },
  pfEsi: { hi: 'EPF / ESI', en: 'EPF / ESI' },
  wageSlip: { hi: 'मज़दूरी पर्ची', en: 'Wage Slip' },
  workOrders: { hi: 'कार्य आदेश / श्रम ठेका', en: 'Work Orders' },
  musterRoll: { hi: 'मस्टर रोल / हाज़िरी', en: 'Muster Roll' },
  operations: { hi: 'संचालन', en: 'Operations' },
  ledgerHeads: { hi: 'लेजर हेड', en: 'Ledger Heads' },
  inventory: { hi: 'इन्वेंटरी', en: 'Inventory' },
  sales: { hi: 'बिक्री', en: 'Sales' },
  receivePayment: { hi: 'भुगतान रसीद', en: 'Receive Payment' },
  purchases: { hi: 'खरीद', en: 'Purchases' },
  makePayment: { hi: 'भुगतान करें', en: 'Make Payment' },
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
  export: { hi: 'एक्सपोर्ट', en: 'Export' },
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
  openingBalance: { hi: 'ओपनिंग बैलेंस', en: 'Opening Balance' },
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
  shareCapital: { hi: 'शेयर कैपिटल', en: 'Share Capital' },
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

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type {
  Voucher, VoucherEditSnapshot, VoucherLine, VoucherType, Member, LedgerAccount, SocietySettings, BillAllocation,
  AccountBalance, CashBookEntry, BankBookEntry, MemberLedgerEntry, ReceiptsPaymentsData,
  Loan, Asset, AuditObjection, Recoverable, KachiAaratEntry, P7Entry,
  StockItem, StockMovement,
  Sale, Purchase,
  Employee, SalaryRecord, PaymentMode,
  Supplier, Customer,
  KccLoan,
  VoucherEntry,
  EntityLink,
  HousingFlat,
  MaintenanceBill,
} from '@/types';
import { getVoucherLines } from '@/lib/voucherUtils';
import { computeStock, computeStockValue, computeStockCostRate } from '@/lib/stockUtils';
import * as storage from '@/lib/storage';
import { ACCOUNT_IDS, CMS_SOCIETY_ACCOUNTS, getBankAccountIds, isBankAccount } from '@/lib/storage';
import { voucherLinesBalance } from '@/lib/validation';
import { supabase } from '@/lib/supabase';
import type { SocietyCapabilityRow, Capability } from '@/lib/navigation';
import { resolveCapabilities } from '@/lib/navigation';
import { isEngineVoucher, ENGINE_VOUCHER_BLOCK } from '@/lib/accounting/voucherImmutability';
import type { Farmer, ProcurementLot, ProcurementEvent, QualityTest, MoistureRecord, JForm, FinancialIntentRecord, PostingRequest, PostingRuleResult, AccountingProfile, Quantity, Money, FarmerSettlement, SettlementDeductionLine } from '@/lib/procurement';
import { resolvePostingLegs, PROCUREMENT_POSTING_BINDING, buildEngineVoucherLines } from '@/lib/procurement';
import { calcDepForFY, DEP_ACCOUNTS, parseFY, wdvAccumulatedBefore } from '@/lib/depreciation';

interface DataContextType {
  vouchers: Voucher[];
  members: Member[];
  accounts: LedgerAccount[];
  society: SocietySettings;
  societyCapabilities: SocietyCapabilityRow[];   // C3: capability grant/revoke rows
  setCapabilityHidden: (capability: Capability, hidden: boolean, meta?: { reason?: string; by?: string }) => void;  // C6
  procurementFarmers: Farmer[];
  procurementLots: ProcurementLot[];
  procurementEvents: ProcurementEvent[];
  addFarmer: (data: { farmerName: string; fatherName?: string; mobile?: string }) => Farmer;
  addProcurementLot: (data: { farmerId: string; cropId: string; varietyId?: string; quantity: Quantity; mspRate: Money }) => ProcurementLot;
  procurementQualityTests: QualityTest[];
  procurementMoistureRecords: MoistureRecord[];
  recordQualityInspection: (data: { lotId: string; result: string; moisture: number; inspectedBy?: string }) => QualityTest;
  procurementJForms: JForm[];
  generateJForm: (data: { lotId: string }) => JForm;
  procurementFinancialIntents: FinancialIntentRecord[];
  generateFinancialIntent: (data: { jformId: string }) => FinancialIntentRecord;
  procurementPostingRequests: PostingRequest[];
  generatePostingRequest: (data: { financialIntentId: string }) => PostingRequest;
  procurementPostingRuleResults: PostingRuleResult[];
  generatePostingRuleResult: (data: { postingRequestId: string }) => PostingRuleResult;
  generateEngineVoucher: (data: { postingRuleResultId: string }) => Voucher;
  // Farmer Settlement — the authoritative business document. Deductions live ONLY here (draft lines);
  // approval is the single accounting trigger; payments settle the approved settlement's Net Payable.
  procurementSettlements: FarmerSettlement[];
  createFarmerSettlement: (data: { engineVoucherId: string }) => FarmerSettlement;
  addSettlementDeductionLine: (data: { settlementId: string; deductionType: string; accountId: string; amount: number; reference?: string; remarks?: string }) => void;
  removeSettlementDeductionLine: (data: { settlementId: string; lineId: string }) => void;
  approveFarmerSettlement: (data: { settlementId: string }) => FarmerSettlement;
  recordFarmerPayment: (data: { engineVoucherId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; paymentDate: string; reference?: string; remarks?: string }) => Voucher;
  loans: Loan[];
  assets: Asset[];

  addVoucher: (data: Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'> & { voucherNo?: string }) => Voucher;
  updateVoucher: (id: string, data: Partial<Pick<Voucher, 'type' | 'date' | 'debitAccountId' | 'creditAccountId' | 'amount' | 'narration' | 'memberId' | 'lines'>>) => void;
  cancelVoucher: (id: string, reason: string, deletedBy: string) => boolean;
  restoreVoucher: (id: string) => void;
  clearVoucher: (id: string, clearedDate?: string) => void;
  unclearVoucher: (id: string) => void;
  approveVoucher: (id: string, approvedBy: string) => void;
  rejectVoucher: (id: string, rejectedBy: string, reason: string) => void;
  auditObjections: AuditObjection[];
  addAuditObjection: (data: Omit<AuditObjection, 'id' | 'objectionNo' | 'createdAt'>) => AuditObjection;
  updateAuditObjection: (id: string, data: Partial<AuditObjection>) => void;
  deleteAuditObjection: (id: string) => void;

  // Recoverables (HAFED Proforma 2)
  recoverables: Recoverable[];
  addRecoverable: (data: Omit<Recoverable, 'id' | 'createdAt'>) => Recoverable;
  updateRecoverable: (id: string, data: Partial<Recoverable>) => void;
  deleteRecoverable: (id: string) => void;

  // Kachi Aarat (HAFED Proforma 8)
  kachiAaratEntries: KachiAaratEntry[];
  addKachiAaratEntry: (data: Omit<KachiAaratEntry, 'id' | 'createdAt'>) => KachiAaratEntry;
  updateKachiAaratEntry: (id: string, data: Partial<KachiAaratEntry>) => void;
  deleteKachiAaratEntry: (id: string) => void;

  // P7 Entries (HAFED Proforma 7 — Rent/Transport/Consumer)
  p7Entries: P7Entry[];
  upsertP7Entry: (data: Omit<P7Entry, 'id' | 'createdAt'> & { id?: string }) => P7Entry;
  deleteP7Entry: (id: string) => void;

  addMember: (data: Omit<Member, 'id'>) => Member;
  updateMember: (id: string, data: Partial<Member>) => void;
  deleteMember: (id: string) => void;

  housingFlats: HousingFlat[];
  addHousingFlat: (data: Omit<HousingFlat, 'id' | 'createdAt'>) => HousingFlat;
  updateHousingFlat: (id: string, data: Partial<HousingFlat>) => void;
  deleteHousingFlat: (id: string) => void;

  maintenanceBills: MaintenanceBill[];
  generateMaintenanceBills: (data: { period: string; date?: string; flatIds?: string[] }) => MaintenanceBill[];
  deleteMaintenanceBill: (id: string) => void;
  approveMember: (id: string) => void;
  rejectMember: (id: string) => void;

  addAccount: (data: Omit<LedgerAccount, 'id'>) => LedgerAccount;
  updateAccount: (id: string, data: Partial<LedgerAccount>) => void;
  deleteAccount: (id: string) => void;
  mergeAccounts: (keepId: string, removeId: string) => number;
  resetAccounts: (templateAccounts: LedgerAccount[]) => void;
  updateSociety: (data: Partial<SocietySettings>) => void;

  addLoan: (data: Omit<Loan, 'id' | 'loanNo' | 'createdAt'>) => Loan;
  updateLoan: (id: string, data: Partial<Loan>) => void;
  deleteLoan: (id: string) => void;

  addAsset: (data: Omit<Asset, 'id' | 'assetNo'>) => Asset;
  updateAsset: (id: string, data: Partial<Asset>) => void;
  deleteAsset: (id: string) => void;
  postDepreciation: (fy?: string) => { posted: number; skipped: number };

  // Inventory
  stockItems: StockItem[];
  stockMovements: StockMovement[];
  addStockItem: (data: Omit<StockItem, 'id' | 'itemCode'>) => StockItem;
  updateStockItem: (id: string, data: Partial<StockItem>) => void;
  deleteStockItem: (id: string) => void;
  addStockMovement: (data: Omit<StockMovement, 'id' | 'createdAt'>) => void;

  // Sales
  sales: Sale[];
  addSale: (data: Omit<Sale, 'id' | 'saleNo' | 'createdAt'>) => Sale;
  updateSale: (id: string, data: Omit<Sale, 'id' | 'saleNo' | 'createdAt'>) => Sale | null;
  deleteSale: (id: string) => void;
  addBillReceipt: (data: { customerId: string; date: string; paymentMode: 'cash' | 'bank'; bankAccountId?: string; allocations: { saleId: string; amount: number }[]; advance?: number; onAccount?: number; narration?: string }) => Voucher | null;
  addBillPayment: (data: { supplierId: string; date: string; paymentMode: 'cash' | 'bank'; bankAccountId?: string; allocations: { purchaseId: string; amount: number }[]; advance?: number; onAccount?: number; narration?: string }) => Voucher | null;

  // Purchases
  purchases: Purchase[];
  addPurchase: (data: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt'>) => Purchase;
  updatePurchase: (id: string, data: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt'>) => Purchase | null;
  deletePurchase: (id: string) => void;

  // Suppliers
  suppliers: Supplier[];
  addSupplier: (data: Omit<Supplier, 'id' | 'supplierCode' | 'accountId' | 'createdAt'>) => Supplier;
  updateSupplier: (id: string, data: Partial<Omit<Supplier, 'id' | 'supplierCode' | 'accountId' | 'createdAt'>>) => void;
  deleteSupplier: (id: string) => void;

  // Customers
  customers: Customer[];
  addCustomer: (data: Omit<Customer, 'id' | 'customerCode' | 'accountId' | 'createdAt'>) => Customer;
  updateCustomer: (id: string, data: Partial<Omit<Customer, 'id' | 'customerCode' | 'accountId' | 'createdAt'>>) => void;
  deleteCustomer: (id: string) => void;

  // Employees & Salary
  employees: Employee[];
  addEmployee: (data: Omit<Employee, 'id' | 'empNo'>) => Employee;
  updateEmployee: (id: string, data: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  salaryRecords: SalaryRecord[];
  addSalaryRecord: (data: Omit<SalaryRecord, 'id' | 'slipNo' | 'createdAt'>) => SalaryRecord;
  updateSalaryRecord: (id: string, data: Partial<SalaryRecord>) => void;
  deleteSalaryRecord: (id: string) => void;

  kccLoans: KccLoan[];

  getAccountBalance: (accountId: string) => number;
  getCashBookEntries: (fromDate?: string, toDate?: string) => CashBookEntry[];
  getBankBookEntries: (fromDate?: string, toDate?: string, bankAccountId?: string) => BankBookEntry[];
  getTrialBalance: (asOnDate?: string) => AccountBalance[];
  // M15: All point-in-time aggregators accept asOnDate so Day Book / Balance Sheet
  // historical lookups don't silently show current-day numbers.
  getMemberLedger: (memberId: string) => MemberLedgerEntry[];
  getProfitLoss: (asOnDate?: string) => {
    incomeItems: { name: string; nameHi: string; amount: number }[];
    expenseItems: { name: string; nameHi: string; amount: number }[];
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
  };
  getReceiptsPayments: (asOnDate?: string) => ReceiptsPaymentsData;
  getTradingAccount: (asOnDate?: string) => {
    salesItems:        { name: string; nameHi: string; amount: number }[];
    closingStockItems: { name: string; nameHi: string; amount: number }[];
    openingStockItems: { name: string; nameHi: string; amount: number }[];
    purchaseItems:     { name: string; nameHi: string; amount: number }[];
    directExpItems:    { name: string; nameHi: string; amount: number }[];
    totalSales: number; totalClosingStock: number;
    totalOpeningStock: number; totalPurchases: number; totalDirectExp: number;
    grossProfit: number;
    physicalClosingStock: number;    // computed from stockItems, used when no ledger closing stock
    closingStockPosted: boolean;     // true if a closing stock journal exists for current FY
    activities: { key: string; keyHi: string; salesId: string; purchaseId: string; sales: number; purchases: number; hasRoutedPurchase: boolean; grossMargin: number }[];
    unallocated: { purchases: number; directExp: number; otherSales: number };
  };
  postClosingStock: (fy?: string) => { posted: boolean; amount: number; alreadyPosted: boolean };
  getEntityLinks: (entityType: 'member' | 'customer' | 'supplier' | 'stockItem' | 'employee' | 'account' | 'loan' | 'asset', id: string) => EntityLink[];
  isLoading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);
  const societyIdRef = useRef(user?.societyId || 'SOC001');
  // Keep ref updated when user changes
  useEffect(() => { societyIdRef.current = user?.societyId || 'SOC001'; }, [user?.societyId]);
  // Helper: adds society_id to any Supabase record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withSoc = (d: Record<string, any>) => ({ ...d, society_id: societyIdRef.current });

  const [vouchers, setVouchersState] = useState<Voucher[]>([]);
  const vouchersRef = useRef<Voucher[]>(vouchers);
  useEffect(() => { vouchersRef.current = vouchers; }, [vouchers]);
  const [members, setMembersState] = useState<Member[]>([]);
  const membersRef = useRef<Member[]>(members);
  useEffect(() => { membersRef.current = members; }, [members]);
  const [accounts, setAccountsState] = useState<LedgerAccount[]>([]);
  const [society, setSocietyState] = useState<SocietySettings>(() => storage.getSociety());
  const societyRef = useRef(society);
  useEffect(() => { societyRef.current = society; }, [society]);
  // FY-lock guard — reads the LATEST society via ref, so it is never stale even
  // inside useCallbacks declared with empty deps. Returns true (and toasts) when locked.
  const guardFYLocked = useCallback((): boolean => {
    if (societyRef.current?.fyLocked) {
      toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while the Financial Year is audit-locked. (वित्तीय वर्ष लॉक है)', variant: 'destructive' });
      return true;
    }
    return false;
  }, []);
  const [loans, setLoansState] = useState<Loan[]>([]);
  const [societyCapabilities, setSocietyCapabilitiesState] = useState<SocietyCapabilityRow[]>([]);
  const [procurementFarmers, setProcurementFarmersState] = useState<Farmer[]>(() => storage.getProcurementFarmers());
  const [procurementLots, setProcurementLotsState] = useState<ProcurementLot[]>(() => storage.getProcurementLots());
  const [procurementEvents, setProcurementEventsState] = useState<ProcurementEvent[]>(() => storage.getProcurementEvents());
  const [procurementQualityTests, setProcurementQualityTestsState] = useState<QualityTest[]>(() => storage.getProcurementQualityTests());
  const [procurementMoistureRecords, setProcurementMoistureRecordsState] = useState<MoistureRecord[]>(() => storage.getProcurementMoistureRecords());
  const [procurementJForms, setProcurementJFormsState] = useState<JForm[]>(() => storage.getProcurementJForms());
  const [procurementFinancialIntents, setProcurementFinancialIntentsState] = useState<FinancialIntentRecord[]>(() => storage.getProcurementFinancialIntents());
  const [procurementPostingRequests, setProcurementPostingRequestsState] = useState<PostingRequest[]>(() => storage.getProcurementPostingRequests());
  const [procurementPostingRuleResults, setProcurementPostingRuleResultsState] = useState<PostingRuleResult[]>(() => storage.getProcurementPostingRuleResults());
  const [procurementSettlements, setProcurementSettlementsState] = useState<FarmerSettlement[]>(() => storage.getProcurementSettlements());
  const [housingFlats, setHousingFlatsState] = useState<HousingFlat[]>(() => storage.getHousingFlats());
  const [maintenanceBills, setMaintenanceBillsState] = useState<MaintenanceBill[]>(() => storage.getMaintenanceBills());
  const procurementFarmersRef = useRef<Farmer[]>(procurementFarmers);
  useEffect(() => { procurementFarmersRef.current = procurementFarmers; }, [procurementFarmers]);
  const loansRef = useRef<Loan[]>(loans);
  useEffect(() => { loansRef.current = loans; }, [loans]);
  const [assets, setAssetsState] = useState<Asset[]>([]);
  const assetsRef = useRef<Asset[]>(assets);
  useEffect(() => { assetsRef.current = assets; }, [assets]);
  const [auditObjections, setAuditObjectionsState] = useState<AuditObjection[]>([]);
  const auditObjectionsRef = useRef<AuditObjection[]>(auditObjections);
  useEffect(() => { auditObjectionsRef.current = auditObjections; }, [auditObjections]);
  const [recoverables, setRecoverablesState] = useState<Recoverable[]>([]);
  const recoverablesRef = useRef<Recoverable[]>(recoverables);
  useEffect(() => { recoverablesRef.current = recoverables; }, [recoverables]);
  const [kachiAaratEntries, setKachiAaratEntriesState] = useState<KachiAaratEntry[]>([]);
  const kachiAaratEntriesRef = useRef<KachiAaratEntry[]>(kachiAaratEntries);
  useEffect(() => { kachiAaratEntriesRef.current = kachiAaratEntries; }, [kachiAaratEntries]);
  const [p7Entries, setP7EntriesState] = useState<P7Entry[]>([]);
  const p7EntriesRef = useRef<P7Entry[]>(p7Entries);
  useEffect(() => { p7EntriesRef.current = p7Entries; }, [p7Entries]);
  const [stockItems, setStockItemsState] = useState<StockItem[]>([]);
  const [stockMovements, setStockMovementsState] = useState<StockMovement[]>([]);
  const stockMovementsRef = useRef<StockMovement[]>(stockMovements);
  useEffect(() => { stockMovementsRef.current = stockMovements; }, [stockMovements]);
  const [sales, setSalesState] = useState<Sale[]>([]);
  const salesRef = useRef<Sale[]>(sales);
  useEffect(() => { salesRef.current = sales; }, [sales]);
  const [purchases, setPurchasesState] = useState<Purchase[]>([]);
  const purchasesRef = useRef<Purchase[]>(purchases);
  useEffect(() => { purchasesRef.current = purchases; }, [purchases]);
  const [employees, setEmployeesState] = useState<Employee[]>([]);
  const employeesRef = useRef<Employee[]>(employees);
  useEffect(() => { employeesRef.current = employees; }, [employees]);
  const [salaryRecords, setSalaryRecordsState] = useState<SalaryRecord[]>([]);
  const salaryRecordsRef = useRef<SalaryRecord[]>(salaryRecords);
  useEffect(() => { salaryRecordsRef.current = salaryRecords; }, [salaryRecords]);
  const [suppliers, setSuppliersState] = useState<Supplier[]>([]);
  const suppliersRef = useRef<Supplier[]>(suppliers);
  useEffect(() => { suppliersRef.current = suppliers; }, [suppliers]);
  const [customers, setCustomersState] = useState<Customer[]>([]);
  const customersRef = useRef<Customer[]>(customers);
  useEffect(() => { customersRef.current = customers; }, [customers]);
  const [kccLoans, setKccLoansState] = useState<KccLoan[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const sid = user?.societyId || 'SOC001';
    societyIdRef.current = sid;
    setIsLoading(true);

    // Reset all state to empty before loading new society's data
    setVouchersState([]); setMembersState([]); setLoansState([]); setSocietyCapabilitiesState([]);
    setProcurementFarmersState([]); setProcurementLotsState([]); setProcurementEventsState([]);
    setProcurementQualityTestsState([]); setProcurementMoistureRecordsState([]); setProcurementJFormsState([]); setProcurementFinancialIntentsState([]); setProcurementPostingRequestsState([]); setProcurementPostingRuleResultsState([]); setProcurementSettlementsState([]); setHousingFlatsState([]); setMaintenanceBillsState([]);
    setAssetsState([]); setAuditObjectionsState([]); setStockItemsState([]);
    setStockMovementsState([]); setSalesState([]); setPurchasesState([]);
    setEmployeesState([]); setSalaryRecordsState([]);
    setSuppliersState([]); setCustomersState([]);
    setRecoverablesState([]); setKachiAaratEntriesState([]); setP7EntriesState([]);

    // Paginated fetch — bypasses PostgREST max-rows server cap (typically 1000).
    // We loop .range() in 1000-row pages until a partial page comes back. Guarantees
    // ALL rows are loaded regardless of server-side cap; otherwise the user's newest
    // entries silently vanish on F5 once total rows exceed the cap.
    const fetchAllPaged = async <T,>(table: string, orderCol?: string): Promise<{ data: T[]; error: { message: string } | null }> => {
      const PAGE = 1000;
      const out: T[] = [];
      let from = 0;
      // Safety cap: 200 pages = 200,000 rows. Tweak if any single table ever exceeds this.
      for (let i = 0; i < 200; i++) {
        let q = supabase.from(table).select('*').eq('society_id', sid).range(from, from + PAGE - 1);
        if (orderCol) q = q.order(orderCol);
        const { data, error } = await q;
        if (error) return { data: out, error };
        if (!data || data.length === 0) break;
        out.push(...(data as T[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return { data: out, error: null };
    };

    const loadFromSupabase = async () => {
      try {
        const [
          { data: vData, error: vErr }, { data: mData }, { data: aData },
          { data: lData }, { data: asData }, { data: aoData },
          { data: siData }, { data: smData }, { data: slData },
          { data: puData }, { data: emData }, { data: srData },
          { data: socData }, { data: supData }, { data: cusData },
          { data: kccData }, { data: recData }, { data: kaData }, { data: p7Data },
        ] = await Promise.all([
          fetchAllPaged<Voucher>('vouchers', 'createdAt'),
          fetchAllPaged<Member>('members'),
          fetchAllPaged<LedgerAccount>('accounts'),
          fetchAllPaged<Loan>('loans'),
          fetchAllPaged<Asset>('assets'),
          fetchAllPaged<AuditObjection>('audit_objections'),
          fetchAllPaged<StockItem>('stock_items'),
          fetchAllPaged<StockMovement>('stock_movements', 'createdAt'),
          fetchAllPaged<Sale>('sales', 'createdAt'),
          fetchAllPaged<Purchase>('purchases', 'createdAt'),
          fetchAllPaged<Employee>('employees'),
          fetchAllPaged<SalaryRecord>('salary_records', 'createdAt'),
          supabase.from('society_settings').select('*').eq('society_id', sid).limit(1),
          fetchAllPaged<Supplier>('suppliers'),
          fetchAllPaged<Customer>('customers'),
          fetchAllPaged<KccLoan>('kcc_loans'),
          fetchAllPaged<Recoverable>('recoverables', 'createdAt'),
          fetchAllPaged<KachiAaratEntry>('kachi_aarat_entries', 'createdAt'),
          fetchAllPaged<P7Entry>('p7_entries', 'createdAt'),
        ]);

        if (vErr) console.warn('Vouchers query error:', vErr.message);
        // Load vouchers — safe first, auto-migration separate
        if (vData && vData.length > 0) { setVouchersState(vData); storage.setVouchers(vData); }
        else if (!vErr) setVouchersState([]);
        if (mData && mData.length > 0) { setMembersState(mData); storage.setMembers(mData); }
        else setMembersState([]);

        // Load accounts from Supabase; fall back to CMS template if none exist
        const rawAccts: LedgerAccount[] = aData && aData.length > 0 ? [...aData] : [...CMS_SOCIETY_ACCOUNTS];
        const { accounts: baseAccts, changed: acctsMigrated, newlyAdded } = storage.migrateAccounts(rawAccts);
        setAccountsState(baseAccts);
        storage.setAccounts(baseAccts);
        // Only INSERT truly new accounts (don't delete+reinsert — preserves user customizations)
        if (acctsMigrated && newlyAdded.length > 0) {
          const rows = newlyAdded.map(a => ({ ...a, society_id: sid }));
          supabase.from('accounts').upsert(rows).then(({ error }) => {
            if (error) console.warn('Account migration sync error:', error.message);
          });
        }

        // Auto-create missing member vouchers — wrapped in try-catch so it never breaks main data load
        try {
          const existingVouchers: Voucher[] = vData || [];
          const fyStr: string = (socData && socData.length > 0 ? socData[0] : society).financialYear || '2024-25';
          const autoVouchers: Voucher[] = [];
          for (const member of (mData || [])) {
            const mv = existingVouchers.filter(v => v.memberId === member.id && !v.isDeleted);
            if (!mv.some(v => v.creditAccountId === ACCOUNT_IDS.SHARE_CAP) && (member.shareCapital || 0) > 0) {
              const allSoFar = [...existingVouchers, ...autoVouchers];
              autoVouchers.push({ id: crypto.randomUUID(), voucherNo: storage.getNextVoucherNo('receipt', fyStr, allSoFar), type: 'receipt', date: member.joinDate || new Date().toISOString().split('T')[0], debitAccountId: ACCOUNT_IDS.CASH, creditAccountId: ACCOUNT_IDS.SHARE_CAP, amount: Number(member.shareCapital), narration: `Share Capital received from ${member.name}`, memberId: member.id, createdAt: new Date().toISOString(), createdBy: 'System' });
            }
            if (!mv.some(v => v.creditAccountId === ACCOUNT_IDS.ADM_FEE) && (member.admissionFee || 0) > 0) {
              const allSoFar = [...existingVouchers, ...autoVouchers];
              autoVouchers.push({ id: crypto.randomUUID(), voucherNo: storage.getNextVoucherNo('receipt', fyStr, allSoFar), type: 'receipt', date: member.joinDate || new Date().toISOString().split('T')[0], debitAccountId: ACCOUNT_IDS.CASH, creditAccountId: ACCOUNT_IDS.ADM_FEE, amount: Number(member.admissionFee), narration: `Admission Fee received from ${member.name}`, memberId: member.id, createdAt: new Date().toISOString(), createdBy: 'System' });
            }
          }
          if (autoVouchers.length > 0) {
            const allVouchers = [...existingVouchers, ...autoVouchers];
            setVouchersState(allVouchers);
            storage.setVouchers(allVouchers);
            for (const v of autoVouchers) {
              supabase.from('vouchers').upsert({ ...v, society_id: sid }).then(({ error }) => { if (error) console.error('Auto member voucher sync error:', error.message); });
            }
          }
        } catch (migErr) {
          console.warn('Auto member voucher migration error (non-fatal):', migErr);
        }
        setLoansState(lData || []);
        setAssetsState(asData || []);
        setAuditObjectionsState(aoData || []);
        setStockItemsState(siData || []);
        setStockMovementsState(smData || []);

        // C3: load capability rows independently (NOT in the Promise.all) so a missing
        // table (pre-migration) NEVER breaks the main data load. snake → camel mapped.
        supabase.from('society_capabilities').select('*').eq('society_id', sid).then(
          ({ data: capData, error: capErr }) => {
            if (capErr || !capData) { setSocietyCapabilitiesState([]); return; }
            setSocietyCapabilitiesState(capData.map((r: Record<string, unknown>) => ({
              capability: r.capability as SocietyCapabilityRow['capability'],
              mode: r.mode as SocietyCapabilityRow['mode'],
              source: r.source as SocietyCapabilityRow['source'],
              expiresAt: (r.expires_at as string | null) ?? null,
              grantedBy: (r.granted_by as string | null) ?? null,
              createdAt: (r.created_at as string | null) ?? null,
            })));
          },
          () => setSocietyCapabilitiesState([]),
        );

        // Procurement Phase 1.0 — error-tolerant load (Supabase → localStorage fallback). Independent
        // queries: a missing table NEVER breaks the main data load; the demo persists via localStorage.
        supabase.from('procurement_farmers').select('*').eq('society_id', sid).then(
          ({ data, error }) => setProcurementFarmersState(error || !data ? storage.getProcurementFarmers() : (data as unknown as Farmer[])),
          () => setProcurementFarmersState(storage.getProcurementFarmers()),
        );
        supabase.from('procurement_lots').select('*').eq('society_id', sid).then(
          ({ data, error }) => setProcurementLotsState(error || !data ? storage.getProcurementLots() : (data as unknown as ProcurementLot[])),
          () => setProcurementLotsState(storage.getProcurementLots()),
        );
        supabase.from('procurement_events').select('*').eq('society_id', sid).then(
          ({ data, error }) => setProcurementEventsState(error || !data ? storage.getProcurementEvents() : (data as unknown as ProcurementEvent[])),
          () => setProcurementEventsState(storage.getProcurementEvents()),
        );
        supabase.from('procurement_quality_tests').select('*').eq('society_id', sid).then(
          ({ data, error }) => setProcurementQualityTestsState(error || !data ? storage.getProcurementQualityTests() : (data as unknown as QualityTest[])),
          () => setProcurementQualityTestsState(storage.getProcurementQualityTests()),
        );
        supabase.from('procurement_moisture_records').select('*').eq('society_id', sid).then(
          ({ data, error }) => setProcurementMoistureRecordsState(error || !data ? storage.getProcurementMoistureRecords() : (data as unknown as MoistureRecord[])),
          () => setProcurementMoistureRecordsState(storage.getProcurementMoistureRecords()),
        );
        supabase.from('procurement_jforms').select('*').eq('society_id', sid).then(
          ({ data, error }) => setProcurementJFormsState(error || !data ? storage.getProcurementJForms() : (data as unknown as JForm[])),
          () => setProcurementJFormsState(storage.getProcurementJForms()),
        );
        supabase.from('procurement_financial_intents').select('*').eq('society_id', sid).then(
          ({ data, error }) => setProcurementFinancialIntentsState(error || !data ? storage.getProcurementFinancialIntents() : (data as unknown as FinancialIntentRecord[])),
          () => setProcurementFinancialIntentsState(storage.getProcurementFinancialIntents()),
        );
        supabase.from('procurement_posting_requests').select('*').eq('society_id', sid).then(
          ({ data, error }) => setProcurementPostingRequestsState(error || !data ? storage.getProcurementPostingRequests() : (data as unknown as PostingRequest[])),
          () => setProcurementPostingRequestsState(storage.getProcurementPostingRequests()),
        );
        supabase.from('procurement_posting_rule_results').select('*').eq('society_id', sid).then(
          ({ data, error }) => setProcurementPostingRuleResultsState(error || !data ? storage.getProcurementPostingRuleResults() : (data as unknown as PostingRuleResult[])),
          () => setProcurementPostingRuleResultsState(storage.getProcurementPostingRuleResults()),
        );
        supabase.from('procurement_settlements').select('*').eq('society_id', sid).then(
          ({ data, error }) => setProcurementSettlementsState(error || !data ? storage.getProcurementSettlements() : (data as unknown as FarmerSettlement[])),
          () => setProcurementSettlementsState(storage.getProcurementSettlements()),
        );
        supabase.from('housing_flats').select('*').eq('society_id', sid).then(
          ({ data, error }) => setHousingFlatsState(error || !data ? storage.getHousingFlats() : (data as unknown as HousingFlat[])),
          () => setHousingFlatsState(storage.getHousingFlats()),
        );
        supabase.from('maintenance_bills').select('*').eq('society_id', sid).then(
          ({ data, error }) => setMaintenanceBillsState(error || !data ? storage.getMaintenanceBills() : (data as unknown as MaintenanceBill[])),
          () => setMaintenanceBillsState(storage.getMaintenanceBills()),
        );

        // ── Auto-repair orphan Sale / Purchase vouchers ─────────────────────
        // Two cases handled:
        // (a) Sale / purchase has NO matching voucher (orphan): create one.
        // (b) Sale / purchase HAS a previous auto-repair voucher that posted to
        //     the hardcoded 4101 / 5101, but the items map to a different
        //     salesAccountId / purchaseAccountId (e.g. Sugar → 4103 Consumer
        //     Goods Sales). Re-route the voucher in-place with proper per-item
        //     account splitting via the multi-line `lines` field.
        try {
          const vList = ((vData || []) as Voucher[]);
          const voucherById = new Map<string, Voucher>(vList.map(v => [v.id, v]));
          // Index repair vouchers by their refId so we can REUSE an existing repair
          // (instead of creating a new one every F5) when the sale.voucherId patch
          // earlier didn't make it to Supabase. This prevents the vouchers table from
          // ballooning past the row-limit and silently dropping the user's newest
          // entries (like a fresh Contra) on F5.
          const repairByRefId = new Map<string, Voucher>();
          const duplicateRepairs: Voucher[] = []; // to soft-delete
          // AGGRESSIVE DEDUP: For each (refType, refId) combination, keep ONLY the
          // latest non-deleted voucher. Older duplicates get soft-deleted. This catches
          // both [auto-repair] tagged duplicates AND any other duplicate sale/purchase
          // vouchers (e.g. from an accidental double-save or pre-tag-era repair runs).
          // refType + refId uniquely identifies a parent sale or purchase, so only one
          // voucher should ever reference it.
          for (const v of vList) {
            if (v.isDeleted) continue;
            if (!v.refId) continue;
            if (v.refType !== 'sale' && v.refType !== 'purchase') continue;
            const key = `${v.refType}:${v.refId}`;
            const existing = repairByRefId.get(key);
            if (!existing) {
              repairByRefId.set(key, v);
            } else {
              // Pick the one with later createdAt as "primary"; mark the older as duplicate
              const keep = (v.createdAt || '') > (existing.createdAt || '') ? v : existing;
              const drop = keep === v ? existing : v;
              repairByRefId.set(key, keep);
              if (!drop.isDeleted) duplicateRepairs.push(drop);
            }
          }
          const fyStr2: string = (socData && socData.length > 0 ? socData[0] : society).financialYear || '2024-25';
          const newRepairVouchers: Voucher[] = [];
          const updatedVouchers = new Map<string, Voucher>(); // id → updated voucher
          const patchedSales: Sale[] = [];
          const patchedPurchases: Purchase[] = [];
          const allVouchersSoFar: Voucher[] = [...vList];
          const stockMap = new Map<string, StockItem>(((siData || []) as StockItem[]).map(i => [i.id, i]));

          const computeSaleAccBuckets = (sale: Sale) => {
            const totalItemAmount = sale.items.reduce((s, it) => s + it.amount, 0) || 1;
            const netAmt = sale.netAmount || (sale.grandTotal - (sale.taxAmount || 0));
            const buckets = new Map<string, number>();
            sale.items.forEach(it => {
              const stock = stockMap.get(it.itemId);
              const acc = stock?.salesAccountId || '4101';
              const portion = (it.amount / totalItemAmount) * netAmt;
              buckets.set(acc, (buckets.get(acc) || 0) + portion);
            });
            return buckets;
          };
          const computePurchaseAccBuckets = (p: Purchase) => {
            const totalItemAmount = p.items.reduce((s, it) => s + it.amount, 0) || 1;
            const netAmt = p.netAmount || (p.grandTotal - (p.taxAmount || 0) + (p.tdsAmount || 0));
            const buckets = new Map<string, number>();
            p.items.forEach(it => {
              const stock = stockMap.get(it.itemId);
              const acc = stock?.purchaseAccountId || '5101';
              const portion = (it.amount / totalItemAmount) * netAmt;
              buckets.set(acc, (buckets.get(acc) || 0) + portion);
            });
            return buckets;
          };
          const dominantAcc = (buckets: Map<string, number>, fallback: string) => {
            let best = fallback, max = 0;
            buckets.forEach((amt, acc) => { if (amt > max) { max = amt; best = acc; } });
            return best;
          };

          // SALES
          for (const sale of ((slData || []) as Sale[])) {
            // First try sale.voucherId; if missing, look up by refId from existing repair vouchers
            // (handles the case where the sale.voucherId Supabase patch failed previously —
            //  prevents creating a brand-new duplicate every F5).
            let existing = sale.voucherId ? voucherById.get(sale.voucherId) : undefined;
            if (!existing || existing.isDeleted) existing = repairByRefId.get(`sale:${sale.id}`);
            // Re-point sale.voucherId at the kept-latest voucher BEFORE the skip check,
            // so user-made vouchers also benefit from the patch when their voucherId
            // pointed to a now-deduped older duplicate.
            if (existing && !existing.isDeleted && sale.voucherId !== existing.id) {
              patchedSales.push({ ...sale, voucherId: existing.id });
            }
            const isAutoRepair = !!existing?.narration?.includes('[auto-repair]');
            // Don't touch user-made vouchers — only rebuild if missing OR an old auto-repair
            if (existing && !existing.isDeleted && !isAutoRepair) continue;

            const customerAcc = sale.customerId ? ((cusData || []) as Customer[]).find(c => c.id === sale.customerId)?.accountId : undefined;
            const debitAccId = sale.paymentMode === 'cash' ? ACCOUNT_IDS.CASH
              : sale.paymentMode === 'bank' ? (sale.bankAccountId || getBankAccountIds((aData || []) as LedgerAccount[])[0] || ACCOUNT_IDS.BANK)
              : (customerAcc || '3303');
            const vType: VoucherType = sale.paymentMode === 'credit' ? 'sale' : 'receipt';
            const grandTotal = sale.grandTotal ?? sale.netAmount;
            if (grandTotal <= 0) continue;
            const buckets = computeSaleAccBuckets(sale);
            const lines: VoucherLine[] = [];
            const lid = () => crypto.randomUUID();
            lines.push({ id: lid(), accountId: debitAccId, type: 'Dr', amount: grandTotal });
            buckets.forEach((amt, accId) => {
              const rounded = Math.round(amt * 100) / 100;
              if (rounded > 0) lines.push({ id: lid(), accountId: accId, type: 'Cr', amount: rounded });
            });
            if ((sale.taxAmount ?? 0) > 0) {
              lines.push({ id: lid(), accountId: '2201', type: 'Cr', amount: sale.taxAmount!, narration: `GST: CGST ₹${sale.cgstAmount||0} + SGST ₹${sale.sgstAmount||0} + IGST ₹${sale.igstAmount||0}` });
            }
            const dominantCr = dominantAcc(buckets, '4101');

            if (existing && isAutoRepair) {
              // Re-route in place — preserve id/voucherNo/createdAt
              const updated: Voucher = {
                ...existing,
                type: vType,
                date: sale.date,
                debitAccountId: debitAccId,
                creditAccountId: dominantCr,
                amount: grandTotal,
                narration: `Sale: ${sale.customerName} — ${sale.saleNo} [auto-repair v2]`,
                lines,
                refType: 'sale',
                refId: sale.id,
              };
              updatedVouchers.set(existing.id, updated);
              // Also reflect in allVouchersSoFar for voucherNo uniqueness
              const idx = allVouchersSoFar.findIndex(v => v.id === existing.id);
              if (idx >= 0) allVouchersSoFar[idx] = updated;
            } else {
              const newId = crypto.randomUUID();
              const voucherNo = storage.getNextVoucherNo(vType as 'receipt' | 'payment' | 'journal' | 'contra', fyStr2, allVouchersSoFar);
              const v: Voucher = {
                id: newId,
                voucherNo,
                type: vType,
                date: sale.date,
                debitAccountId: debitAccId,
                creditAccountId: dominantCr,
                amount: grandTotal,
                narration: `Sale: ${sale.customerName} — ${sale.saleNo} [auto-repair v2]`,
                createdAt: new Date().toISOString(),
                createdBy: sale.createdBy || 'System (repair)',
                refType: 'sale',
                refId: sale.id,
                lines,
              };
              newRepairVouchers.push(v);
              allVouchersSoFar.push(v);
              patchedSales.push({ ...sale, voucherId: newId });
            }
          }

          // PURCHASES
          for (const purchase of ((puData || []) as Purchase[])) {
            let existing = purchase.voucherId ? voucherById.get(purchase.voucherId) : undefined;
            if (!existing || existing.isDeleted) existing = repairByRefId.get(`purchase:${purchase.id}`);
            if (existing && !existing.isDeleted && purchase.voucherId !== existing.id) {
              patchedPurchases.push({ ...purchase, voucherId: existing.id });
            }
            const isAutoRepair = !!existing?.narration?.includes('[auto-repair]');
            if (existing && !existing.isDeleted && !isAutoRepair) continue;

            const supplierAcc = purchase.supplierId ? ((supData || []) as Supplier[]).find(s => s.id === purchase.supplierId)?.accountId : undefined;
            const creditAccId = purchase.paymentMode === 'cash' ? ACCOUNT_IDS.CASH
              : purchase.paymentMode === 'bank' ? (purchase.bankAccountId || getBankAccountIds((aData || []) as LedgerAccount[])[0] || ACCOUNT_IDS.BANK)
              : (supplierAcc || '2101');
            const vType: VoucherType = purchase.paymentMode === 'credit' ? 'purchase' : 'payment';
            const grandTotal = purchase.grandTotal ?? purchase.netAmount;
            if (grandTotal <= 0) continue;
            const buckets = computePurchaseAccBuckets(purchase);
            const lines: VoucherLine[] = [];
            const lid = () => crypto.randomUUID();
            buckets.forEach((amt, accId) => {
              const rounded = Math.round(amt * 100) / 100;
              if (rounded > 0) lines.push({ id: lid(), accountId: accId, type: 'Dr', amount: rounded });
            });
            if ((purchase.taxAmount ?? 0) > 0) {
              lines.push({ id: lid(), accountId: '3310', type: 'Dr', amount: purchase.taxAmount!, narration: `GST ITC: CGST ₹${purchase.cgstAmount||0} + SGST ₹${purchase.sgstAmount||0} + IGST ₹${purchase.igstAmount||0}` });
            }
            // grandTotal ALREADY nets TDS (= netAmount + tax − tds). The supplier/cash payable
            // IS grandTotal; the TDS is the separate Cr to 2202 below. Subtracting tds again here
            // double-counted it and left the voucher short on the Cr side by the TDS amount.
            const netPayable = grandTotal;
            if (netPayable > 0) {
              lines.push({ id: lid(), accountId: creditAccId, type: 'Cr', amount: netPayable });
            }
            if ((purchase.tdsAmount ?? 0) > 0) {
              lines.push({ id: lid(), accountId: '2202', type: 'Cr', amount: purchase.tdsAmount!, narration: `TDS ${purchase.tdsPct||0}%` });
            }
            const dominantDr = dominantAcc(buckets, '5101');

            if (existing && isAutoRepair) {
              const updated: Voucher = {
                ...existing,
                type: vType,
                date: purchase.date,
                debitAccountId: dominantDr,
                creditAccountId: creditAccId,
                amount: grandTotal,
                narration: `Purchase: ${purchase.supplierName} — ${purchase.purchaseNo} [auto-repair v2]`,
                lines,
                refType: 'purchase',
                refId: purchase.id,
              };
              updatedVouchers.set(existing.id, updated);
              const idx = allVouchersSoFar.findIndex(v => v.id === existing.id);
              if (idx >= 0) allVouchersSoFar[idx] = updated;
            } else {
              const newId = crypto.randomUUID();
              const voucherNo = storage.getNextVoucherNo(vType as 'receipt' | 'payment' | 'journal' | 'contra', fyStr2, allVouchersSoFar);
              const v: Voucher = {
                id: newId,
                voucherNo,
                type: vType,
                date: purchase.date,
                debitAccountId: dominantDr,
                creditAccountId: creditAccId,
                amount: grandTotal,
                narration: `Purchase: ${purchase.supplierName} — ${purchase.purchaseNo} [auto-repair v2]`,
                createdAt: new Date().toISOString(),
                createdBy: purchase.createdBy || 'System (repair)',
                refType: 'purchase',
                refId: purchase.id,
                lines,
              };
              newRepairVouchers.push(v);
              allVouchersSoFar.push(v);
              patchedPurchases.push({ ...purchase, voucherId: newId });
            }
          }

          // Soft-delete duplicate repair vouchers (caused by previous F5s creating new
          // vouchers when sale.voucherId patch silently failed). Mark them isDeleted in
          // state + Supabase so they don't pollute Trial Balance and don't keep growing
          // past the PostgREST row-limit.
          if (duplicateRepairs.length > 0) {
            const dropIds = new Set(duplicateRepairs.map(v => v.id));
            const now = new Date().toISOString();
            for (let i = 0; i < allVouchersSoFar.length; i++) {
              if (dropIds.has(allVouchersSoFar[i].id)) {
                allVouchersSoFar[i] = {
                  ...allVouchersSoFar[i],
                  isDeleted: true,
                  deletedAt: now,
                  deletedBy: 'System (repair cleanup)',
                  deletedReason: 'Duplicate auto-repair voucher cleaned up',
                };
              }
            }
            duplicateRepairs.forEach(v => {
              supabase.from('vouchers').update({
                isDeleted: true,
                deletedAt: now,
                deletedBy: 'System (repair cleanup)',
                deletedReason: 'Duplicate auto-repair voucher cleaned up',
              }).eq('id', v.id).then(({ error }) => { if (error) console.warn('Duplicate repair cleanup:', error.message); });
            });
            console.log(`[REPAIR v2] Cleaned ${duplicateRepairs.length} duplicate auto-repair voucher(s).`);
          }

          const totalAffected = newRepairVouchers.length + updatedVouchers.size + duplicateRepairs.length;
          if (totalAffected > 0) {
            setVouchersState(allVouchersSoFar);
            storage.setVouchers(allVouchersSoFar);
            const patchedSalesIds = new Set(patchedSales.map(s => s.id));
            const finalSales = ((slData || []) as Sale[]).map(s => patchedSalesIds.has(s.id)
              ? patchedSales.find(ps => ps.id === s.id)! : s);
            const patchedPurchaseIds = new Set(patchedPurchases.map(p => p.id));
            const finalPurchases = ((puData || []) as Purchase[]).map(p => patchedPurchaseIds.has(p.id)
              ? patchedPurchases.find(pp => pp.id === p.id)! : p);
            setSalesState(finalSales);
            setPurchasesState(finalPurchases);

            // Persist NEW repair vouchers
            for (const v of newRepairVouchers) {
              const { lines: vlines, refType, refId, ...base } = v;
              supabase.from('vouchers').upsert({ ...base, society_id: sid }).then(({ error }) => {
                if (error) { console.error('Repair voucher save error:', error.message); return; }
                supabase.from('vouchers').update({ lines: vlines, refType, refId }).eq('id', v.id)
                  .then(({ error: e2 }) => { if (e2) console.warn('Repair lines patch:', e2.message); });
              });
            }
            // Persist UPDATED auto-repair vouchers (in-place re-route)
            updatedVouchers.forEach((v) => {
              const { lines: vlines, refType, refId, ...base } = v;
              supabase.from('vouchers').upsert({ ...base, society_id: sid }).then(({ error }) => {
                if (error) { console.error('Repair voucher update error:', error.message); return; }
                supabase.from('vouchers').update({ lines: vlines, refType, refId }).eq('id', v.id)
                  .then(({ error: e2 }) => { if (e2) console.warn('Re-route lines patch:', e2.message); });
              });
            });
            for (const s of patchedSales) {
              supabase.from('sales').update({ voucherId: s.voucherId }).eq('id', s.id)
                .then(({ error }) => { if (error) console.warn('Sale voucherId patch:', error.message); });
            }
            for (const p of patchedPurchases) {
              supabase.from('purchases').update({ voucherId: p.voucherId }).eq('id', p.id)
                .then(({ error }) => { if (error) console.warn('Purchase voucherId patch:', error.message); });
            }
            console.log(`[REPAIR v2] New: ${newRepairVouchers.length}, Re-routed: ${updatedVouchers.size}, Cleaned duplicates: ${duplicateRepairs.length}.`);
            toastRef.current({
              title: `${totalAffected} voucher(s) auto-repaired`,
              description: `${newRepairVouchers.length} created, ${updatedVouchers.size} re-routed, ${duplicateRepairs.length} duplicate(s) cleaned.`,
              variant: 'default',
              duration: 8000,
            });
          } else {
            setSalesState(slData || []);
            setPurchasesState(puData || []);
          }
        } catch (repairErr) {
          console.warn('Sale/Purchase voucher auto-repair non-fatal error:', repairErr);
          setSalesState(slData || []);
          setPurchasesState(puData || []);
        }

        setEmployeesState(emData || []);
        setSalaryRecordsState(srData || []);
        setSuppliersState(supData || []);
        setCustomersState(cusData || []);
        setKccLoansState(kccData || []);
        setRecoverablesState(recData || []);
        setKachiAaratEntriesState(kaData || []);
        setP7EntriesState(p7Data || []);

        // ── One-time voucher_entries migration ──────────────────────────────
        // For any existing voucher that has no entries in voucher_entries yet,
        // build and upsert rows so the relational table is always in sync.
        try {
          const { data: existingEntries } = await supabase
            .from('voucher_entries').select('voucherId').eq('society_id', sid);
          const migratedIds = new Set((existingEntries || []).map((e: { voucherId: string }) => e.voucherId));
          const allVouchers: Voucher[] = vData || [];
          const toMigrate = allVouchers.filter(v => !v.isDeleted && !migratedIds.has(v.id));
          if (toMigrate.length > 0) {
            const rows = toMigrate.flatMap(v =>
              getVoucherLines(v).map(l => ({
                id: `${v.id}-${l.id}`,
                voucherId: v.id,
                accountId: l.accountId,
                dr: l.type === 'Dr' ? l.amount : 0,
                cr: l.type === 'Cr' ? l.amount : 0,
                narration: l.narration,
                society_id: sid,
              }))
            );
            // Batch upsert in chunks of 500 to avoid payload limits
            for (let i = 0; i < rows.length; i += 500) {
              const chunk = rows.slice(i, i + 500);
              supabase.from('voucher_entries').upsert(chunk).then(({ error }) => {
                if (error) console.warn('voucher_entries migration error:', error.message);
              });
            }
            console.log(`voucher_entries: migrated ${toMigrate.length} vouchers (${rows.length} entries)`);
          }
        } catch (migErr) {
          console.warn('voucher_entries migration non-fatal error:', migErr);
        }

        if (socData && socData.length > 0) {
          // Supabase is the single source of truth for society settings.
          // All devices always load from Supabase — save once, sync everywhere.
          // localStorage is only used as offline fallback (when Supabase is unreachable).
          setSocietyState(socData[0]);
          storage.setSociety(socData[0]);
        }
      } catch (err) {
        console.warn('Supabase load failed, falling back to localStorage:', err);
        // Properly restore from localStorage when Supabase is unavailable
        const lsVouchers = storage.getVouchers();
        const lsMembers = storage.getMembers();
        const lsAccounts = storage.getAccounts();
        if (lsVouchers.length > 0) setVouchersState(lsVouchers);
        if (lsMembers.length > 0) setMembersState(lsMembers);
        if (lsAccounts.length > 0) {
          const { accounts: migratedAccts } = storage.migrateAccounts(lsAccounts);
          setAccountsState(migratedAccts);
          storage.setAccounts(migratedAccts);
        }
        setSocietyState(storage.getSociety());
        setLoansState(storage.getLoans());
        setSocietyCapabilitiesState([]);   // C3: offline fallback → empty (all modules visible, as today)
        setProcurementFarmersState(storage.getProcurementFarmers());
        setProcurementLotsState(storage.getProcurementLots());
        setProcurementEventsState(storage.getProcurementEvents());
        setProcurementQualityTestsState(storage.getProcurementQualityTests());
        setProcurementMoistureRecordsState(storage.getProcurementMoistureRecords());
        setProcurementJFormsState(storage.getProcurementJForms());
        setProcurementFinancialIntentsState(storage.getProcurementFinancialIntents());
        setProcurementPostingRequestsState(storage.getProcurementPostingRequests());
        setProcurementPostingRuleResultsState(storage.getProcurementPostingRuleResults());
        setProcurementSettlementsState(storage.getProcurementSettlements());
        setHousingFlatsState(storage.getHousingFlats());
        setMaintenanceBillsState(storage.getMaintenanceBills());
        setAssetsState(storage.getAssets());
      } finally {
        setIsLoading(false);
      }
    };
    loadFromSupabase();
  }, [user?.societyId]);

  // ── voucher_entries helpers ───────────────────────────────────────────────
  // Build VoucherEntry rows from a Voucher (one row per Dr/Cr leg).
  const buildEntries = (v: Voucher, sid: string): VoucherEntry[] =>
    getVoucherLines(v).map(l => ({
      id: `${v.id}-${l.id}`,
      voucherId: v.id,
      accountId: l.accountId,
      dr: l.type === 'Dr' ? l.amount : 0,
      cr: l.type === 'Cr' ? l.amount : 0,
      narration: l.narration,
      societyId: sid,
    }));

  // Write (upsert) entries for a voucher — fire-and-forget, non-blocking.
  const syncEntries = (v: Voucher) => {
    const sid = societyIdRef.current;
    const rows = buildEntries(v, sid).map(e => ({ ...e, society_id: sid }));
    if (rows.length === 0) return;
    supabase.from('voucher_entries').upsert(rows).then(({ error }) => {
      if (error) console.warn('voucher_entries sync error:', error.message);
    });
  };

  // Delete entries for a voucher (on cancel).
  const deleteEntries = (voucherId: string) => {
    supabase.from('voucher_entries').delete().eq('voucherId', voucherId).then(({ error }) => {
      if (error) console.warn('voucher_entries delete error:', error.message);
    });
  };

  // ── Voucher persistence helper (two-step + rollback) ──────────────────────
  // RULE: Every Supabase write MUST either (a) succeed silently or (b) roll back
  // local state AND show a loud destructive toast. Never let local state diverge
  // from Supabase silently — F5 will wipe local-only data and the user loses work.
  //
  // The base table only has core columns. Late-added columns (lines, refType,
  // refId, isCleared, clearedDate, editHistory, groupId, approvalStatus, ...)
  // sit in PostgREST's schema cache only AFTER you ALTER TABLE. If the cache is
  // stale they cause "Could not find column X" errors that nuke the whole upsert.
  // Solution: upsert ONLY base columns (always succeeds), then patch extras in a
  // second .update() call — that one is allowed to fail without losing the row.
  const persistVoucher = (v: Voucher, opts: { onBaseFail: () => void; isUpdate?: boolean }) => {
    // Strip out everything that may live in late-added columns
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { lines, refType, refId, billAllocations, isCleared, clearedDate, editHistory, groupId,
            approvalStatus, approvalRemarks, approvedBy, approvedAt, ...baseCols } = v;

    const handleBaseFailure = (msg: string) => {
      console.error(`Voucher ${opts.isUpdate ? 'update' : 'save'} failed (base):`, msg);
      opts.onBaseFail();
      toastRef.current({
        title: '❌ Voucher cloud par save NAHI hua',
        description: `${msg}. Local state se entry hata di gayi — refresh karne par data lose nahi hoga.`,
        variant: 'destructive',
        duration: 15000,
      });
    };

    supabase.from('vouchers').upsert(withSoc(baseCols)).then(({ error }) => {
      if (error) {
        handleBaseFailure(error.message);
        return;
      }
      // VERIFY: confirm the row actually persisted (catches RLS / cache-miss
      // edge cases where upsert returns no error but no row was written).
      supabase.from('vouchers').select('id').eq('id', v.id).limit(1).then(({ data: verifyData, error: verifyErr }) => {
        if (verifyErr || !verifyData || verifyData.length === 0) {
          handleBaseFailure(verifyErr?.message || 'Verification failed — row not found after upsert');
          return;
        }
      // Step 2: best-effort patch of extras (lines, refType, etc.)
      const extras: Record<string, unknown> = {};
      if (lines !== undefined) extras.lines = lines;
      if (refType !== undefined) extras.refType = refType;
      if (refId !== undefined) extras.refId = refId;
      if (isCleared !== undefined) extras.isCleared = isCleared;
      if (clearedDate !== undefined) extras.clearedDate = clearedDate;
      if (groupId !== undefined) extras.groupId = groupId;
      if (approvalStatus !== undefined) extras.approvalStatus = approvalStatus;
      if (approvalRemarks !== undefined) extras.approvalRemarks = approvalRemarks;
      if (approvedBy !== undefined) extras.approvedBy = approvedBy;
      if (approvedAt !== undefined) extras.approvedAt = approvedAt;
      if (editHistory !== undefined) extras.editHistory = editHistory;
      if (billAllocations !== undefined) extras.billAllocations = billAllocations;
      if (Object.keys(extras).length === 0) {
        if (!opts.isUpdate) syncEntries(v);
        return;
      }
      supabase.from('vouchers').update(extras).eq('id', v.id).then(({ error: e2 }) => {
        if (e2) {
          console.warn('Voucher extras patch warning (run latest supabase-tables.sql migration):', e2.message);
          toastRef.current({
            title: '⚠️ Voucher saved partially',
            description: `Base voucher saved to cloud, but extras (lines/refs/approval) failed: ${e2.message}. Run latest supabase-tables.sql migration.`,
            variant: 'default',
            duration: 8000,
          });
        }
        // Sync voucher_entries regardless — they use base columns we just confirmed
        if (!opts.isUpdate) syncEntries(v);
      });
      }); // close verify .then
    }, (rejection: unknown) => {
      // Promise rejection (network error, fetch abort) — supabase-js usually resolves
      // with { error } rather than rejecting, but cover the rare case.
      const msg = rejection instanceof Error ? rejection.message : String(rejection);
      handleBaseFailure(`Network/promise rejection: ${msg}`);
    });
  };

  const addVoucher = useCallback((data: Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'> & { voucherNo?: string }): Voucher => {
    // P2-1: Block new vouchers when the FY is audit-locked
    if (society.fyLocked) {
      toastRef.current({
        title: 'FY is Audit-Locked',
        description: `Financial Year ${society.financialYear} has been locked by ${society.fyLockedBy || 'admin'}. No new entries are allowed. Contact the administrator to unlock.`,
        variant: 'destructive',
      });
      // Return a dummy voucher object to satisfy the return type — caller must handle gracefully
      return { id: '', voucherNo: '', type: data.type, date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    }

    // P2-3: Warn if voucher date is outside the active FY range
    const fyEnd = `20${society.financialYear.split('-')[1]}-03-31`;
    const fyStart = society.financialYearStart;
    if (data.date && fyStart && (data.date < fyStart || data.date > fyEnd)) {
      toastRef.current({
        title: 'Date Outside Financial Year',
        description: `Voucher date ${data.date} is outside the active FY ${society.financialYear} (${fyStart} to ${fyEnd}). Entry saved but please verify.`,
        variant: 'default',
      });
    }

    const lid = () => crypto.randomUUID();
    // Build lines if not provided (legacy single Dr/Cr mode)
    let lines: VoucherLine[] | undefined = data.lines;
    if (!lines || lines.length === 0) {
      if (data.debitAccountId && data.creditAccountId && (data.amount || 0) > 0) {
        lines = [
          { id: lid(), accountId: data.debitAccountId, type: 'Dr', amount: data.amount! },
          { id: lid(), accountId: data.creditAccountId, type: 'Cr', amount: data.amount! },
        ];
      }
    }

    // ── Double-entry balance guard (Audit C-1/C-2, NCDC double-entry rule) ────
    // Every Dr MUST have an equal Cr. Two-tier handling:
    //  • Sub-rupee residual (< ₹1) = rounding from pro-rated GST/TDS splits →
    //    snap it into the largest line on the deficient side so the voucher
    //    tallies EXACTLY (standard accounting rounding adjustment).
    //  • Material imbalance (≥ ₹1) = a real error → BLOCK the save with a loud
    //    toast and return a dummy voucher (caller handles id==='' gracefully).
    if (lines && lines.length > 0) {
      let bal = voucherLinesBalance(lines);
      if (!bal.balanced && bal.diff < 1) {
        const residual = +(bal.drTotal - bal.crTotal).toFixed(2); // >0 ⇒ Dr-heavy
        const side: 'Dr' | 'Cr' = residual > 0 ? 'Cr' : 'Dr';     // add to deficient side
        let idx = -1, max = -Infinity;
        lines.forEach((l, i) => { if (l.type === side && l.amount > max) { max = l.amount; idx = i; } });
        if (idx >= 0) {
          lines = lines.map((l, i) => i === idx ? { ...l, amount: +(l.amount + Math.abs(residual)).toFixed(2) } : l);
          bal = voucherLinesBalance(lines);
        }
      }
      if (!bal.balanced) {
        toastRef.current({
          title: '❌ वाउचर असंतुलित / Voucher not balanced',
          description: `डेबिट ₹${bal.drTotal.toFixed(2)} ≠ क्रेडिट ₹${bal.crTotal.toFixed(2)} (अंतर ₹${bal.diff.toFixed(2)})। हर Dr का बराबर Cr होना चाहिए — ठीक करके दोबारा save करें।`,
          variant: 'destructive',
          duration: 12000,
        });
        return { id: '', voucherNo: '', type: data.type, date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
      }
    }

    // Compute legacy fields from lines (for backward compat with existing reports)
    const drLines = (lines || []).filter(l => l.type === 'Dr');
    const crLines = (lines || []).filter(l => l.type === 'Cr');
    const debitAccountId = data.debitAccountId || drLines[0]?.accountId || '';
    const creditAccountId = data.creditAccountId || crLines[0]?.accountId || '';
    const amount = data.amount || drLines.reduce((s, l) => s + l.amount, 0);

    const voucherNo = data.voucherNo?.trim() || storage.getNextVoucherNo(data.type, society.financialYear, vouchersRef.current);
    const newVoucher: Voucher = {
      ...data,
      id: lid(),
      voucherNo,
      lines,
      debitAccountId,
      creditAccountId,
      amount,
      createdAt: new Date().toISOString(),
    };
    // Update ref immediately so the next addVoucher call in the same tick sees this voucher
    vouchersRef.current = [...vouchersRef.current, newVoucher];
    setVouchersState(prev => [...prev, newVoucher]);

    // Persist with two-step + rollback. If base save fails, REMOVE the voucher
    // from local state so the UI reflects what's actually in Supabase — F5 won't
    // silently delete the user's work because the work was never optimistically
    // shown as "saved" once the failure was confirmed.
    persistVoucher(newVoucher, {
      isUpdate: false,
      onBaseFail: () => {
        vouchersRef.current = vouchersRef.current.filter(v => v.id !== newVoucher.id);
        setVouchersState(prev => prev.filter(v => v.id !== newVoucher.id));
      },
    });
    return newVoucher;
  }, [society.financialYear, society.fyLocked, society.fyLockedBy, society.financialYearStart]);

  // ── Bill-wise receipt (Tally "Against Reference"): a customer payment applied to
  //    one or more open credit bills. Builds a Dr Cash/Bank, Cr Customer receipt
  //    voucher and tags it with billAllocations; bill balances are DERIVED from
  //    these allocations (lib/billUtils), so deleting the receipt auto-reverses it.
  const addBillReceipt = useCallback((data: {
    customerId: string;
    date: string;
    paymentMode: 'cash' | 'bank';
    bankAccountId?: string;
    allocations: { saleId: string; amount: number }[];
    advance?: number;       // money received before/without a specific bill
    onAccount?: number;     // received in excess of the bills, kept unallocated
    narration?: string;
  }): Voucher | null => {
    if (guardFYLocked()) return null;
    const cust = customers.find(c => c.id === data.customerId);
    const custAcc = cust?.accountId || '3303';   // Sundry Debtors fallback
    const allocs = data.allocations.filter(a => a.amount > 0);
    const adv = Math.max(0, +(data.advance || 0));
    const onAcc = Math.max(0, +(data.onAccount || 0));
    const total = +(allocs.reduce((s, a) => s + a.amount, 0) + adv + onAcc).toFixed(2);
    if (total <= 0) {
      toastRef.current({ title: 'राशि डालें', description: 'कम से कम एक बिल के विरुद्ध (या अग्रिम) राशि भरें।', variant: 'destructive' });
      return null;
    }
    const debitAcc = data.paymentMode === 'cash'
      ? ACCOUNT_IDS.CASH
      : (data.bankAccountId || getBankAccountIds(accounts)[0] || ACCOUNT_IDS.BANK);
    const billAllocations: BillAllocation[] = [
      ...allocs.map(a => {
        const sale = salesRef.current.find(s => s.id === a.saleId);
        return { billId: a.saleId, billNo: sale?.saleNo || '', saleId: a.saleId, saleNo: sale?.saleNo || '', amount: +a.amount.toFixed(2), method: 'against' as const };
      }),
      ...(adv > 0 ? [{ amount: +adv.toFixed(2), method: 'advance' as const }] : []),
      ...(onAcc > 0 ? [{ amount: +onAcc.toFixed(2), method: 'on-account' as const }] : []),
    ];
    const billList = billAllocations.filter(b => b.method === 'against').map(b => b.billNo).filter(Boolean).join(', ');
    const tag = billList ? `बिल ${billList} के विरुद्ध` : (adv > 0 ? 'अग्रिम राशि' : 'On Account');
    const narration = `${cust?.name || 'ग्राहक'} से प्राप्त — ${tag}${data.narration?.trim() ? ' · ' + data.narration.trim() : ''}`;
    const lid = () => crypto.randomUUID();
    const v = addVoucher({
      type: 'receipt',
      date: data.date,
      debitAccountId: debitAcc,
      creditAccountId: custAcc,
      amount: total,
      narration,
      refType: 'bill-receipt',
      refId: data.customerId,
      billAllocations,
      lines: [
        { id: lid(), accountId: debitAcc, type: 'Dr', amount: total },
        { id: lid(), accountId: custAcc, type: 'Cr', amount: total },
      ],
      createdBy: user?.name ?? 'System',
    });
    return v && v.id ? v : null;
  }, [customers, accounts, addVoucher, user?.name]);

  // ── Bill-wise payment (supplier side): a payment applied to one or more open credit
  //    purchase bills (and/or advance/on-account). Builds Dr Supplier, Cr Cash/Bank and
  //    tags billAllocations; balances are DERIVED (lib/billUtils), mirror of addBillReceipt.
  const addBillPayment = useCallback((data: {
    supplierId: string;
    date: string;
    paymentMode: 'cash' | 'bank';
    bankAccountId?: string;
    allocations: { purchaseId: string; amount: number }[];
    advance?: number;
    onAccount?: number;
    narration?: string;
  }): Voucher | null => {
    if (guardFYLocked()) return null;
    const sup = suppliers.find(s => s.id === data.supplierId);
    const supAcc = sup?.accountId || '2101';   // Sundry Creditors fallback
    const allocs = data.allocations.filter(a => a.amount > 0);
    const adv = Math.max(0, +(data.advance || 0));
    const onAcc = Math.max(0, +(data.onAccount || 0));
    const total = +(allocs.reduce((s, a) => s + a.amount, 0) + adv + onAcc).toFixed(2);
    if (total <= 0) {
      toastRef.current({ title: 'राशि डालें', description: 'कम से कम एक बिल के विरुद्ध (या अग्रिम) राशि भरें।', variant: 'destructive' });
      return null;
    }
    const creditAcc = data.paymentMode === 'cash'
      ? ACCOUNT_IDS.CASH
      : (data.bankAccountId || getBankAccountIds(accounts)[0] || ACCOUNT_IDS.BANK);
    const billAllocations: BillAllocation[] = [
      ...allocs.map(a => {
        const p = purchasesRef.current.find(x => x.id === a.purchaseId);
        return { billId: a.purchaseId, billNo: p?.purchaseNo || '', amount: +a.amount.toFixed(2), method: 'against' as const };
      }),
      ...(adv > 0 ? [{ amount: +adv.toFixed(2), method: 'advance' as const }] : []),
      ...(onAcc > 0 ? [{ amount: +onAcc.toFixed(2), method: 'on-account' as const }] : []),
    ];
    const billList = billAllocations.filter(b => b.method === 'against').map(b => b.billNo).filter(Boolean).join(', ');
    const tag = billList ? `बिल ${billList} के विरुद्ध` : (adv > 0 ? 'अग्रिम भुगतान' : 'On Account');
    const narration = `${sup?.name || 'आपूर्तिकर्ता'} को भुगतान — ${tag}${data.narration?.trim() ? ' · ' + data.narration.trim() : ''}`;
    const lid = () => crypto.randomUUID();
    const v = addVoucher({
      type: 'payment',
      date: data.date,
      debitAccountId: supAcc,
      creditAccountId: creditAcc,
      amount: total,
      narration,
      refType: 'bill-payment',
      refId: data.supplierId,
      billAllocations,
      lines: [
        { id: lid(), accountId: supAcc, type: 'Dr', amount: total },
        { id: lid(), accountId: creditAcc, type: 'Cr', amount: total },
      ],
      createdBy: user?.name ?? 'System',
    });
    return v && v.id ? v : null;
  }, [suppliers, accounts, addVoucher, user?.name]);

  const updateVoucher = useCallback((id: string, data: Partial<Pick<Voucher, 'type' | 'date' | 'debitAccountId' | 'creditAccountId' | 'amount' | 'narration' | 'memberId' | 'lines'>>) => {
    if (guardFYLocked()) return;
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    if (isEngineVoucher(current)) { toastRef.current({ ...ENGINE_VOUCHER_BLOCK, variant: 'destructive', duration: 10000 }); return; }
    // Capture edit audit snapshot — only track the fields that actually changed
    const changedFields = (Object.keys(data) as (keyof typeof data)[]).filter(
      k => data[k] !== current[k]
    );
    const snapshot: VoucherEditSnapshot | undefined = changedFields.length > 0 ? {
      editedAt: new Date().toISOString(),
      editedBy: current.createdBy,
      before: Object.fromEntries(changedFields.map(k => [k, current[k]])) as VoucherEditSnapshot['before'],
    } : undefined;
    const updatedVoucher = {
      ...current,
      ...data,
      editHistory: snapshot
        ? [...(current.editHistory ?? []), snapshot]
        : current.editHistory,
    };

    // If a SIMPLE (≤2-line) voucher's Dr/Cr account or amount was edited via the
    // single-entry edit form — which sends debitAccountId/creditAccountId/amount but
    // NOT `lines` — rebuild the two lines so the edit actually reaches REPORTS, which
    // read `lines` (getVoucherLines), not the legacy fields. Without this, editing the
    // debit/credit account updated only the legacy fields while the stale `lines` kept
    // the OLD direction, so the List/Trial Balance/Ledger silently ignored the change —
    // and the row could even show Dr/Cr reversed vs the edit dialog. Compound vouchers
    // (>2 lines) are left untouched: the single-entry form can't represent them.
    const wasSimple = !current.lines || current.lines.length <= 2;
    const touchedDrCr = data.debitAccountId !== undefined || data.creditAccountId !== undefined || data.amount !== undefined;
    if (wasSimple && data.lines === undefined && touchedDrCr) {
      const dr = updatedVoucher.debitAccountId, cr = updatedVoucher.creditAccountId, amt = updatedVoucher.amount;
      if (dr && cr && amt > 0) {
        updatedVoucher.lines = [
          { id: crypto.randomUUID(), accountId: dr, type: 'Dr', amount: amt },
          { id: crypto.randomUUID(), accountId: cr, type: 'Cr', amount: amt },
        ];
      }
    }

    // ── Double-entry balance guard on edit (Audit C-1/C-2) ───────────────────
    // Block an edit that would leave a multi-line voucher materially unbalanced.
    if (updatedVoucher.lines && updatedVoucher.lines.length > 0) {
      const bal = voucherLinesBalance(updatedVoucher.lines);
      if (!bal.balanced && bal.diff >= 1) {
        toastRef.current({
          title: '❌ वाउचर असंतुलित / Voucher not balanced',
          description: `डेबिट ₹${bal.drTotal.toFixed(2)} ≠ क्रेडिट ₹${bal.crTotal.toFixed(2)} (अंतर ₹${bal.diff.toFixed(2)})। बदलाव save नहीं हुआ — Dr=Cr करें।`,
          variant: 'destructive',
          duration: 12000,
        });
        return;
      }
    }

    vouchersRef.current = vouchersRef.current.map(v => v.id === id ? updatedVoucher : v);
    setVouchersState(prev => prev.map(v => v.id === id ? updatedVoucher : v));

    // Two-step persist + rollback. Same pattern as addVoucher.
    persistVoucher(updatedVoucher, {
      isUpdate: true,
      onBaseFail: () => {
        // Revert local state so UI matches what's actually in Supabase
        vouchersRef.current = vouchersRef.current.map(v => v.id === id ? current : v);
        setVouchersState(prev => prev.map(v => v.id === id ? current : v));
      },
    });
    // syncEntries (which uses base columns only) is fired by persistVoucher only on add,
    // so we trigger it explicitly here for updates to keep voucher_entries in sync.
    // Fire it AFTER the upsert resolves to avoid syncing entries that didn't save.
    // Note: persistVoucher already handles the timing — entries land on a slight delay,
    // which is acceptable for SQL-side reports.
    syncEntries(updatedVoucher);
  }, []);

  // Returns true if the voucher was actually cancelled, false if blocked (a guard fired
  // and showed its own toast). Callers should only show a success message when true.
  const cancelVoucher = useCallback((id: string, reason: string, deletedBy: string): boolean => {
    if (guardFYLocked()) return false;
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return false;
    if (isEngineVoucher(current)) { toastRef.current({ ...ENGINE_VOUCHER_BLOCK, variant: 'destructive', duration: 10000 }); return false; }

    // 🔒 Block deletion of vouchers ACTIVELY linked to a Purchase / Sale parent.
    // If the parent purchase/sale no longer points to THIS voucher (i.e., it's an
    // orphan or duplicate left over from auto-repair), allow cancellation so the
    // user can clean up. Without this, duplicate cleanup is impossible.
    if (current.refType === 'purchase') {
      const parent = purchasesRef.current.find(p => p.id === current.refId);
      const isActive = parent && parent.voucherId === current.id;
      if (isActive) {
        toastRef.current({
          title: 'यहाँ रद्द नहीं होगा',
          description: 'यह वाउचर Purchase Management से बना है। इसे Purchase Management → Purchase List से delete करें — तभी stock भी सही रहेगा।',
          variant: 'destructive',
        });
        return false;
      }
      // else: orphan/duplicate — allow cancellation
    }
    if (current.refType === 'sale') {
      const parent = salesRef.current.find(s => s.id === current.refId);
      const isActive = parent && parent.voucherId === current.id;
      if (isActive) {
        toastRef.current({
          title: 'यहाँ रद्द नहीं होगा',
          description: 'यह वाउचर Sale Management से बना है। इसे Sale Management → Sale List से delete करें — तभी stock भी वापस आएगी।',
          variant: 'destructive',
        });
        return false;
      }
      // else: orphan/duplicate — allow cancellation
    }

    // H12: Block cancelling auto-generated vouchers — parent record would dangle
    const linkedSalary = salaryRecordsRef.current.find(r => r.voucherId === id);
    if (linkedSalary) {
      toastRef.current({
        title: 'Voucher delete nahi ho sakta',
        description: `Ye Salary slip ${linkedSalary.slipNo} ka payment voucher hai. Salary Management → Slip ko unpaid mark karo / delete karo, voucher apne aap reverse ho jayega.`,
        variant: 'destructive',
      });
      return false;
    }
    if (current.memberId && (current.creditAccountId === ACCOUNT_IDS.SHARE_CAP || current.creditAccountId === ACCOUNT_IDS.ADM_FEE)) {
      const kind = current.creditAccountId === ACCOUNT_IDS.SHARE_CAP ? 'Share Capital' : 'Admission Fee';
      toastRef.current({
        title: 'Voucher delete nahi ho sakta',
        description: `Ye Member ka auto-generated ${kind} voucher hai. Members page se member ko edit / delete karo.`,
        variant: 'destructive',
      });
      return false;
    }
    // Detect depreciation vouchers by narration pattern + asset link
    if (current.narration && /depreciation/i.test(current.narration)) {
      const linkedAsset = assetsRef.current.find(a => current.narration.includes(a.assetNo));
      if (linkedAsset) {
        toastRef.current({
          title: 'Voucher delete nahi ho sakta',
          description: `Ye Asset ${linkedAsset.assetNo} ki depreciation entry hai. Assets page → Reverse Depreciation use karo.`,
          variant: 'destructive',
        });
        return false;
      }
    }

    const cancelledVoucher = { ...current, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy, deletedReason: reason };
    setVouchersState(prev => {
      const updated = prev.map(v => v.id === id ? cancelledVoucher : v);
      return updated;
    });
    // Soft-delete via a TARGETED update of only the delete columns. Upserting the
    // whole voucher object fails with a schema-cache error when it carries any
    // late-added column the table lacks (RULE 1) — which silently left cancelled
    // vouchers un-synced (the "Save failed" on delete).
    supabase.from('vouchers').update({ isDeleted: true, deletedAt: cancelledVoucher.deletedAt, deletedBy, deletedReason: reason }).eq('id', id).then(({ error }) => {
      if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); }
      else deleteEntries(id); // remove from voucher_entries so cancelled voucher has no SQL-visible impact
    });
    return true;
  }, []);

  const restoreVoucher = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    if (isEngineVoucher(current)) { toastRef.current({ ...ENGINE_VOUCHER_BLOCK, variant: 'destructive', duration: 10000 }); return; }
    // H6: If parent record (purchase / sale) has already been hard-deleted, blocking restore prevents
    // creating a "ghost" voucher with no item rows and inconsistent stock.
    if (current.refType === 'purchase' && current.refId) {
      const parentExists = purchasesRef.current.some(p => p.id === current.refId);
      if (!parentExists) {
        toastRef.current({
          title: 'Cannot restore',
          description: 'Linked Purchase has been deleted. Create a new purchase from Purchase Management instead.',
          variant: 'destructive',
        });
        return;
      }
    }
    if (current.refType === 'sale' && current.refId) {
      const parentExists = salesRef.current.some(s => s.id === current.refId);
      if (!parentExists) {
        toastRef.current({
          title: 'Cannot restore',
          description: 'Linked Sale has been deleted. Create a new sale from Sale Management instead.',
          variant: 'destructive',
        });
        return;
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { deletedAt: _da, deletedBy: _db, deletedReason: _dr, ...rest } = current as Voucher & { deletedAt?: string; deletedBy?: string; deletedReason?: string };
    const restoredVoucher = { ...rest, isDeleted: false };
    setVouchersState(prev => {
      const updated = prev.map(v => v.id === id ? restoredVoucher : v);
      return updated;
    });
    supabase.from('vouchers').upsert(withSoc(restoredVoucher)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        setVouchersState(prev => prev.map(v => v.id === id ? current : v));   // RULE 1: roll back to deleted state
        toastRef.current({ title: 'रिस्टोर सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
      else syncEntries(restoredVoucher); // re-populate voucher_entries so SQL reports see it again
    });
  }, []);

  const clearVoucher = useCallback((id: string, clearedDate?: string) => {
    if (guardFYLocked()) return;
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    const cleared = { ...current, isCleared: true, clearedDate: clearedDate ?? new Date().toISOString().split('T')[0] };
    setVouchersState(prev => { const updated = prev.map(v => v.id === id ? cleared : v); return updated; });
    supabase.from('vouchers').upsert(withSoc(cleared)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        setVouchersState(prev => prev.map(v => v.id === id ? current : v));   // RULE 1: roll back
        toastRef.current({ title: 'क्लियर सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, []);

  const unclearVoucher = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    const uncleared = { ...current, isCleared: false, clearedDate: undefined };
    setVouchersState(prev => { const updated = prev.map(v => v.id === id ? uncleared : v); return updated; });
    supabase.from('vouchers').upsert(withSoc(uncleared)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        setVouchersState(prev => prev.map(v => v.id === id ? current : v));   // RULE 1: roll back
        toastRef.current({ title: 'अनक्लियर सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, []);

  const approveVoucher = useCallback((id: string, approvedBy: string) => {
    if (guardFYLocked()) return;
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    if (isEngineVoucher(current)) { toastRef.current({ ...ENGINE_VOUCHER_BLOCK, variant: 'destructive', duration: 10000 }); return; }
    const updated = { ...current, approvalStatus: 'approved' as const, approvedBy, approvedAt: new Date().toISOString() };
    setVouchersState(prev => { const u = prev.map(v => v.id === id ? updated : v); return u; });
    supabase.from('vouchers').upsert(withSoc(updated)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        setVouchersState(prev => prev.map(v => v.id === id ? current : v));   // RULE 1: roll back
        toastRef.current({ title: 'अप्रूवल सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
      else syncEntries(updated); // mirror to voucher_entries so SQL reports see the approved entries
    });
  }, [society.fyLocked]);

  const rejectVoucher = useCallback((id: string, rejectedBy: string, reason: string) => {
    if (guardFYLocked()) return;
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    if (isEngineVoucher(current)) { toastRef.current({ ...ENGINE_VOUCHER_BLOCK, variant: 'destructive', duration: 10000 }); return; }
    const updated = { ...current, approvalStatus: 'rejected' as const, approvalRemarks: reason, approvedBy: rejectedBy, approvedAt: new Date().toISOString() };
    setVouchersState(prev => { const u = prev.map(v => v.id === id ? updated : v); return u; });
    supabase.from('vouchers').upsert(withSoc(updated)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        setVouchersState(prev => prev.map(v => v.id === id ? current : v));   // RULE 1: roll back
        toastRef.current({ title: 'रिजेक्ट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
      else deleteEntries(id); // rejected vouchers shouldn't impact SQL reports
    });
  }, [society.fyLocked]);

  const addAuditObjection = useCallback((data: Omit<AuditObjection, 'id' | 'objectionNo' | 'createdAt'>): AuditObjection => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as AuditObjection;
    const maxNum = auditObjectionsRef.current.filter(o => o.objectionNo?.includes(data.auditYear)).reduce((max, o) => {
      const m = o.objectionNo?.match(/\/(\d+)$/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const objectionNo = `AUD/${data.auditYear}/${String(maxNum + 1).padStart(3, '0')}`;
    const newObj: AuditObjection = { ...data, id: crypto.randomUUID(), objectionNo, createdAt: new Date().toISOString() };
    auditObjectionsRef.current = [...auditObjectionsRef.current, newObj];
    setAuditObjectionsState(prev => { const updated = [...prev, newObj]; return updated; });
    supabase.from('audit_objections').upsert(withSoc(newObj)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        auditObjectionsRef.current = auditObjectionsRef.current.filter(o => o.id !== newObj.id);
        setAuditObjectionsState(prev => prev.filter(o => o.id !== newObj.id));   // RULE 1: roll back
        toastRef.current({ title: 'सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 });
      }
    });
    return newObj;
  }, []);

  const updateAuditObjection = useCallback((id: string, data: Partial<AuditObjection>) => {
    if (guardFYLocked()) return;
    const before = auditObjectionsRef.current.find(o => o.id === id);
    if (!before) return;
    const updated = { ...before, ...data };
    setAuditObjectionsState(prev => prev.map(o => o.id === id ? updated : o));
    supabase.from('audit_objections').upsert(withSoc(updated)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        setAuditObjectionsState(prev => prev.map(o => o.id === id ? before : o));   // RULE 1: roll back to prior state
        toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, []);

  const deleteAuditObjection = useCallback((id: string) => {
    if (guardFYLocked()) return;
    setAuditObjectionsState(prev => { const updated = prev.filter(o => o.id !== id); return updated; });
    supabase.from('audit_objections').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    console.info(`[AUDIT-DELETE] AuditObjection id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, []);

  // ── Recoverables (HAFED Proforma 2) ────────────────────────────────────────
  const addRecoverable = useCallback((data: Omit<Recoverable, 'id' | 'createdAt'>): Recoverable => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as Recoverable;
    const newRec: Recoverable = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    recoverablesRef.current = [...recoverablesRef.current, newRec];
    setRecoverablesState(prev => [...prev, newRec]);
    supabase.from('recoverables').upsert(withSoc(newRec)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        recoverablesRef.current = recoverablesRef.current.filter(r => r.id !== newRec.id);
        setRecoverablesState(prev => prev.filter(r => r.id !== newRec.id));   // RULE 1: roll back
        toastRef.current({ title: 'सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 });
      }
    });
    return newRec;
  }, []);

  const updateRecoverable = useCallback((id: string, data: Partial<Recoverable>) => {
    if (guardFYLocked()) return;
    const before = recoverablesRef.current.find(r => r.id === id);
    if (!before) return;
    const updated = { ...before, ...data };
    setRecoverablesState(prev => prev.map(r => r.id === id ? updated : r));
    supabase.from('recoverables').upsert(withSoc(updated)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        setRecoverablesState(prev => prev.map(r => r.id === id ? before : r));   // RULE 1: roll back to prior state
        toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, []);

  const deleteRecoverable = useCallback((id: string) => {
    if (guardFYLocked()) return;
    setRecoverablesState(prev => prev.filter(r => r.id !== id));
    supabase.from('recoverables').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
  }, []);

  // ── Kachi Aarat (HAFED Proforma 8) ─────────────────────────────────────────
  const addKachiAaratEntry = useCallback((data: Omit<KachiAaratEntry, 'id' | 'createdAt'>): KachiAaratEntry => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as KachiAaratEntry;
    const newEntry: KachiAaratEntry = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    kachiAaratEntriesRef.current = [...kachiAaratEntriesRef.current, newEntry];
    setKachiAaratEntriesState(prev => [...prev, newEntry]);
    supabase.from('kachi_aarat_entries').upsert(withSoc(newEntry)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        kachiAaratEntriesRef.current = kachiAaratEntriesRef.current.filter(e => e.id !== newEntry.id);
        setKachiAaratEntriesState(prev => prev.filter(e => e.id !== newEntry.id));   // RULE 1: roll back
        toastRef.current({ title: 'सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 });
      }
    });
    return newEntry;
  }, []);

  const updateKachiAaratEntry = useCallback((id: string, data: Partial<KachiAaratEntry>) => {
    if (guardFYLocked()) return;
    const before = kachiAaratEntriesRef.current.find(e => e.id === id);
    if (!before) return;
    const updated = { ...before, ...data };
    setKachiAaratEntriesState(prev => prev.map(e => e.id === id ? updated : e));
    supabase.from('kachi_aarat_entries').upsert(withSoc(updated)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        setKachiAaratEntriesState(prev => prev.map(e => e.id === id ? before : e));   // RULE 1: roll back to prior state
        toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, []);

  const deleteKachiAaratEntry = useCallback((id: string) => {
    if (guardFYLocked()) return;
    setKachiAaratEntriesState(prev => prev.filter(e => e.id !== id));
    supabase.from('kachi_aarat_entries').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
  }, []);

  // ── P7 Entries (HAFED Proforma 7) — one row per FY ─────────────────────────
  const upsertP7Entry = useCallback((data: Omit<P7Entry, 'id' | 'createdAt'> & { id?: string }): P7Entry => {
    // If an entry for the same fyStartDate already exists, update it; else create.
    const existing = p7EntriesRef.current.find(e => e.fyStartDate === data.fyStartDate);
    const id = data.id || existing?.id || crypto.randomUUID();
    const createdAt = existing?.createdAt || new Date().toISOString();
    const entry: P7Entry = { ...(existing || {} as P7Entry), ...data, id, createdAt };
    if (guardFYLocked()) return entry;
    setP7EntriesState(prev => {
      const filtered = prev.filter(e => e.id !== id);
      return [...filtered, entry];
    });
    p7EntriesRef.current = [...p7EntriesRef.current.filter(e => e.id !== id), entry];
    supabase.from('p7_entries').upsert(withSoc(entry)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    return entry;
  }, []);

  const deleteP7Entry = useCallback((id: string) => {
    if (guardFYLocked()) return;
    setP7EntriesState(prev => prev.filter(e => e.id !== id));
    supabase.from('p7_entries').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
  }, []);

  const addMember = useCallback((data: Omit<Member, 'id'>): Member => {
    if (guardFYLocked()) return { ...data, id: '' } as Member;
    const newMember: Member = { ...data, id: crypto.randomUUID() };
    setMembersState(prev => {
      const updated = [...prev, newMember];
      return updated;
    });
    supabase.from('members').upsert(withSoc(newMember)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        setMembersState(prev => prev.filter(m => m.id !== newMember.id));   // RULE 1: roll back local state
        toastRef.current({ title: 'सदस्य सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara jodein.`, variant: 'destructive', duration: 12000 });
      }
    });
    // Skip auto-vouchers for pending applications (created on approval)
    if (newMember.approvalStatus === 'pending') return newMember;
    // Auto-create Receipt vouchers for Share Capital and Admission Fee
    if ((newMember.shareCapital || 0) > 0) {
      const v: Voucher = { id: crypto.randomUUID(), voucherNo: storage.getNextVoucherNo('receipt', society.financialYear, vouchersRef.current), type: 'receipt', date: newMember.joinDate, debitAccountId: ACCOUNT_IDS.CASH, creditAccountId: ACCOUNT_IDS.SHARE_CAP, amount: newMember.shareCapital, narration: `Share Capital received from ${newMember.name}`, memberId: newMember.id, createdAt: new Date().toISOString(), createdBy: 'System' };
      vouchersRef.current = [...vouchersRef.current, v];
      setVouchersState(prev => { const updated = [...prev, v]; return updated; });
      supabase.from('vouchers').upsert(withSoc(v)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    }
    if ((newMember.admissionFee || 0) > 0) {
      const v: Voucher = { id: crypto.randomUUID(), voucherNo: storage.getNextVoucherNo('receipt', society.financialYear, vouchersRef.current), type: 'receipt', date: newMember.joinDate, debitAccountId: ACCOUNT_IDS.CASH, creditAccountId: ACCOUNT_IDS.ADM_FEE, amount: newMember.admissionFee!, narration: `Admission Fee received from ${newMember.name}`, memberId: newMember.id, createdAt: new Date().toISOString(), createdBy: 'System' };
      vouchersRef.current = [...vouchersRef.current, v];
      setVouchersState(prev => { const updated = [...prev, v]; return updated; });
      supabase.from('vouchers').upsert(withSoc(v)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    }
    return newMember;
  }, [society.financialYear]);

  const updateMember = useCallback((id: string, data: Partial<Member>) => {
    if (guardFYLocked()) return;
    const oldMember = membersRef.current.find(m => m.id === id);
    if (!oldMember) return;
    const updatedMember = { ...oldMember, ...data };
    setMembersState(prev => {
      const updated = prev.map(m => m.id === id ? updatedMember : m);
      return updated;
    });
    supabase.from('members').upsert(withSoc(updatedMember)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        setMembersState(prev => prev.map(m => m.id === id ? oldMember : m));   // RULE 1: roll back to prior state
        toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
    // Helper: re-sync a member's auto-voucher (Share Capital / Admission Fee).
    // Updates amount + narration + lines AND syncs voucher_entries so SQL reports match.
    // If the voucher was cancelled earlier, warn the user instead of silently no-op.
    const resyncMemberVoucher = (creditAccountId: string, newAmount: number, kind: string) => {
      const active = vouchersRef.current.find(v => v.memberId === id && v.creditAccountId === creditAccountId && !v.isDeleted);
      if (active) {
        const lid = () => crypto.randomUUID();
        // Rebuild lines so multi-line vouchers stay consistent; legacy single-line use derived
        const newLines: VoucherLine[] = [
          { id: lid(), accountId: active.debitAccountId, type: 'Dr', amount: newAmount },
          { id: lid(), accountId: creditAccountId, type: 'Cr', amount: newAmount },
        ];
        const updatedV: Voucher = {
          ...active,
          amount: newAmount,
          lines: newLines,
          narration: `${kind} updated for ${updatedMember.name}`,
        };
        setVouchersState(prev => prev.map(v => v.id === active.id ? updatedV : v));
        supabase.from('vouchers').upsert(withSoc(updatedV)).then(({ error }) => {
          if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); }
          else syncEntries(updatedV); // rebuild voucher_entries rows with new amount
        });
      } else {
        const cancelled = vouchersRef.current.find(v => v.memberId === id && v.creditAccountId === creditAccountId && v.isDeleted);
        if (cancelled) {
          toastRef.current({
            title: `${kind} voucher cancelled`,
            description: `Previous ${kind} voucher was cancelled — amount changed but no new voucher auto-created. Add a manual voucher if needed.`,
            variant: 'default',
          });
        }
      }
    };

    if (data.shareCapital !== undefined && data.shareCapital !== oldMember.shareCapital) {
      resyncMemberVoucher(ACCOUNT_IDS.SHARE_CAP, data.shareCapital, 'Share Capital');
    }
    if (data.admissionFee !== undefined && data.admissionFee !== oldMember.admissionFee) {
      resyncMemberVoucher(ACCOUNT_IDS.ADM_FEE, data.admissionFee, 'Admission Fee');
    }
  }, []);

  const deleteMember = useCallback((id: string) => {
    if (guardFYLocked()) return;
    setMembersState(prev => {
      const updated = prev.filter(m => m.id !== id);
      return updated;
    });
    supabase.from('members').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    // RULE 3: soft-cancel the member's auto-generated vouchers (share capital /
    // admission fee) so no ghost Share Capital lingers in the Trial Balance.
    const now = new Date().toISOString();
    const linkedIds = new Set(vouchersRef.current.filter(v => v.memberId === id && !v.isDeleted && !isEngineVoucher(v)).map(v => v.id));
    if (linkedIds.size > 0) {
      const cancel = (v: Voucher) => linkedIds.has(v.id) ? { ...v, isDeleted: true, deletedAt: now, deletedBy: user?.name || 'System', deletedReason: 'Member deleted' } : v;
      vouchersRef.current = vouchersRef.current.map(cancel);
      setVouchersState(prev => prev.map(cancel));
      linkedIds.forEach(vid => supabase.from('vouchers').update({ isDeleted: true }).eq('id', vid).then(({ error }) => { if (error) console.error('Member voucher cancel sync:', error.message); else deleteEntries(vid); }));
    }
    console.info(`[AUDIT-DELETE] Member id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, []);

  // ── Housing Flats/Units register (master data; Member-pattern persistence + RULE-1 rollback) ──
  const addHousingFlat = useCallback((data: Omit<HousingFlat, 'id' | 'createdAt'>): HousingFlat => {
    if (guardFYLocked()) return { ...data, id: '', createdAt: '' } as HousingFlat;
    const flat: HousingFlat = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setHousingFlatsState(prev => { const u = [...prev, flat]; storage.setHousingFlats(u); return u; });
    supabase.from('housing_flats').upsert(withSoc(flat)).then(({ error }) => {
      if (error) {
        console.error('Housing flat save error:', error.message);
        setHousingFlatsState(prev => { const r = prev.filter(f => f.id !== flat.id); storage.setHousingFlats(r); return r; });
        toastRef.current({ title: 'फ्लैट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara jodein.`, variant: 'destructive', duration: 12000 });
      }
    });
    return flat;
  }, []);

  const updateHousingFlat = useCallback((id: string, data: Partial<HousingFlat>) => {
    if (guardFYLocked()) return;
    const old = housingFlats.find(f => f.id === id);
    if (!old) return;
    const updated = { ...old, ...data };
    setHousingFlatsState(prev => { const u = prev.map(f => f.id === id ? updated : f); storage.setHousingFlats(u); return u; });
    supabase.from('housing_flats').upsert(withSoc(updated)).then(({ error }) => {
      if (error) {
        console.error('Housing flat update error:', error.message);
        setHousingFlatsState(prev => { const u = prev.map(f => f.id === id ? old : f); storage.setHousingFlats(u); return u; });
        toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [housingFlats]);

  const deleteHousingFlat = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const old = housingFlats.find(f => f.id === id);
    setHousingFlatsState(prev => { const u = prev.filter(f => f.id !== id); storage.setHousingFlats(u); return u; });
    supabase.from('housing_flats').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Housing flat delete error:', error.message);
        if (old) setHousingFlatsState(prev => { const u = [...prev, old]; storage.setHousingFlats(u); return u; });
        toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [housingFlats]);

  // ── Housing Maintenance Billing — one bill per flat per period; posts a receivable ──
  // voucher (Dr 3303 Maintenance Receivable / Cr 4101 Maintenance Charges) tagged to the
  // owner member. Billing only (collection is a separate delivery). RULE-6 FY-lock,
  // RULE-1 rollback (cancel the voucher if the bill row fails to persist).
  const generateMaintenanceBills = useCallback((data: { period: string; date?: string; flatIds?: string[] }): MaintenanceBill[] => {
    if (guardFYLocked()) return [];
    if (!/^\d{4}-\d{2}$/.test(data.period || '')) {
      toastRef.current({ title: 'अवधि चुनें', description: 'महीना (YYYY-MM) चुनें। (Select a billing month)', variant: 'destructive', duration: 8000 });
      return [];
    }
    if (!accounts.some(a => a.id === '3303') || !accounts.some(a => a.id === '4101')) {
      toastRef.current({ title: 'खाते नहीं मिले', description: 'रखरखाव खाते (3303 / 4101) इस समिति के चार्ट में नहीं हैं। Housing chart सेट करें।', variant: 'destructive', duration: 10000 });
      return [];
    }
    const targets = housingFlats.filter(f => !f.isDeleted && (f.monthlyMaintenance || 0) > 0 && (!data.flatIds || data.flatIds.includes(f.id)));
    const billed = new Set(maintenanceBills.filter(b => !b.isDeleted && b.period === data.period).map(b => b.flatId));
    const date = data.date || new Date().toISOString().split('T')[0];
    const created: MaintenanceBill[] = [];
    const lid = () => crypto.randomUUID();
    for (const flat of targets) {
      if (billed.has(flat.id)) continue;
      const amount = +flat.monthlyMaintenance.toFixed(2);
      const billId = crypto.randomUUID();
      const v = addVoucher({
        type: 'journal', date,
        debitAccountId: '3303', creditAccountId: '4101', amount,
        narration: `रखरखाव बिल ${data.period} — ${flat.flatNo}`,
        refType: 'maintenance.bill', refId: billId,
        memberId: flat.memberId,
        createdBy: user?.name || 'System',
        lines: [
          { id: lid(), accountId: '3303', type: 'Dr', amount },
          { id: lid(), accountId: '4101', type: 'Cr', amount },
        ],
      });
      if (!v.id) continue;
      created.push({ id: billId, billNo: `${data.period}/${flat.flatNo}`, flatId: flat.id, flatNo: flat.flatNo, memberId: flat.memberId, period: data.period, date, amount, voucherId: v.id, paidAmount: 0, status: 'unpaid', isDeleted: false, createdAt: new Date().toISOString() });
    }
    if (created.length === 0) {
      toastRef.current({ title: 'कोई नया बिल नहीं', description: 'इस अवधि के लिए सभी पात्र फ्लैट पहले से बिल हो चुके हैं या कोई पात्र फ्लैट नहीं।', variant: 'default', duration: 8000 });
      return [];
    }
    setMaintenanceBillsState(prev => { const u = [...prev, ...created]; storage.setMaintenanceBills(u); return u; });
    created.forEach(bill => {
      supabase.from('maintenance_bills').upsert(withSoc(bill)).then(({ error }) => {
        if (error) {
          console.error('Maintenance bill save error:', error.message);
          setMaintenanceBillsState(prev => { const r = prev.filter(b => b.id !== bill.id); storage.setMaintenanceBills(r); return r; });
          if (bill.voucherId) cancelVoucher(bill.voucherId, 'Maintenance bill save failed (auto-rollback)', user?.name || 'System');
          toastRef.current({ title: 'बिल सेव नहीं हुआ', description: `${bill.billNo} — cloud save fail (${error.message}). इसका receivable voucher वापस ले लिया गया।`, variant: 'destructive', duration: 12000 });
        }
      });
    });
    toastRef.current({ title: 'रखरखाव बिल बने', description: `${created.length} बिल · अवधि ${data.period}`, duration: 6000 });
    return created;
  }, [accounts, housingFlats, maintenanceBills, addVoucher, cancelVoucher, user]);

  const deleteMaintenanceBill = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const bill = maintenanceBills.find(b => b.id === id && !b.isDeleted);
    if (!bill) return;
    // RULE 3: cancel the linked receivable voucher so no ghost receivable/income lingers.
    if (bill.voucherId) cancelVoucher(bill.voucherId, `Maintenance bill ${bill.billNo} deleted`, user?.name || 'System');
    setMaintenanceBillsState(prev => { const u = prev.filter(b => b.id !== id); storage.setMaintenanceBills(u); return u; });
    supabase.from('maintenance_bills').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Maintenance bill delete error:', error.message);
        setMaintenanceBillsState(prev => { const u = [...prev, bill]; storage.setMaintenanceBills(u); return u; });
        toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [maintenanceBills, cancelVoucher, user]);

  const approveMember = useCallback((id: string) => {
    const member = membersRef.current.find(m => m.id === id);
    if (!member) return;
    const approved = { ...member, approvalStatus: 'approved' as const };
    setMembersState(prev => prev.map(m => m.id === id ? approved : m));
    supabase.from('members').upsert(withSoc(approved)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    // Now create auto-vouchers for Share Capital and Admission Fee
    if ((approved.shareCapital || 0) > 0) {
      const v: Voucher = { id: crypto.randomUUID(), voucherNo: storage.getNextVoucherNo('receipt', society.financialYear, vouchersRef.current), type: 'receipt', date: approved.joinDate, debitAccountId: ACCOUNT_IDS.CASH, creditAccountId: ACCOUNT_IDS.SHARE_CAP, amount: approved.shareCapital, narration: `Share Capital received from ${approved.name}`, memberId: approved.id, createdAt: new Date().toISOString(), createdBy: 'System' };
      vouchersRef.current = [...vouchersRef.current, v];
      setVouchersState(prev => [...prev, v]);
      supabase.from('vouchers').upsert(withSoc(v)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    }
    if ((approved.admissionFee || 0) > 0) {
      const v: Voucher = { id: crypto.randomUUID(), voucherNo: storage.getNextVoucherNo('receipt', society.financialYear, vouchersRef.current), type: 'receipt', date: approved.joinDate, debitAccountId: ACCOUNT_IDS.CASH, creditAccountId: ACCOUNT_IDS.ADM_FEE, amount: approved.admissionFee!, narration: `Admission Fee received from ${approved.name}`, memberId: approved.id, createdAt: new Date().toISOString(), createdBy: 'System' };
      vouchersRef.current = [...vouchersRef.current, v];
      setVouchersState(prev => [...prev, v]);
      supabase.from('vouchers').upsert(withSoc(v)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    }
    console.info(`[AUDIT] Member id=${id} approved by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, [society.financialYear]);

  const rejectMember = useCallback((id: string) => {
    const member = membersRef.current.find(m => m.id === id);
    if (!member) return;
    const rejected = { ...member, approvalStatus: 'rejected' as const };
    setMembersState(prev => prev.map(m => m.id === id ? rejected : m));
    supabase.from('members').upsert(withSoc(rejected)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    console.info(`[AUDIT] Member id=${id} rejected by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, []);

  const addAccount = useCallback((data: Omit<LedgerAccount, 'id'>): LedgerAccount => {
    if (guardFYLocked()) return { ...data, id: '' } as LedgerAccount;
    const newAccount: LedgerAccount = { ...data, id: crypto.randomUUID() };
    setAccountsState(prev => {
      const updated = [...prev, newAccount];
      return updated;
    });
    supabase.from('accounts').upsert(withSoc(newAccount)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    return newAccount;
  }, []);

  const updateAccount = useCallback((id: string, data: Partial<LedgerAccount>) => {
    if (guardFYLocked()) return;
    setAccountsState(prev => {
      const before = prev.find(a => a.id === id);
      const updated = prev.map(a => a.id === id ? { ...a, ...data } : a);
      const updatedAccount = updated.find(a => a.id === id);
      if (updatedAccount && before) supabase.from('accounts').upsert(withSoc(updatedAccount)).then(({ error }) => {
        if (error) {
          console.error('DB sync error:', error.message);
          setAccountsState(p => p.map(a => a.id === id ? before : a));   // RULE 1: roll back to prior state
          toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
        }
      });
      return updated;
    });
  }, []);

  const deleteAccount = useCallback((id: string) => {
    if (guardFYLocked()) return;

    // H11: Block deletion of built-in system accounts (CASH, BANK, 5101, 3403, etc.)
    const account = accounts.find(a => a.id === id);
    if (!account) { toastRef.current({ title: 'Account not found', variant: 'destructive' }); return; }
    if (account.isSystem) {
      toastRef.current({ title: 'System account', description: `"${account.name}" is a built-in system account — cannot be deleted (used by Sales/Purchases/Closing Stock posting).`, variant: 'destructive' });
      return;
    }

    // H10: Block if account is referenced by active vouchers or by a supplier/customer sub-ledger
    const activeV = vouchersRef.current.filter(v => !v.isDeleted);
    const usedInLines = activeV.some(v =>
      v.debitAccountId === id || v.creditAccountId === id ||
      (v.lines && v.lines.some(l => l.accountId === id))
    );
    if (usedInLines) {
      toastRef.current({ title: 'Cannot delete account', description: `"${account.name}" is used in active vouchers. Cancel/delete those vouchers first.`, variant: 'destructive' });
      return;
    }
    const supLinked = suppliersRef.current.find(s => s.accountId === id);
    if (supLinked) {
      toastRef.current({ title: 'Cannot delete account', description: `"${account.name}" is Supplier "${supLinked.name}"'s account. Delete the supplier instead.`, variant: 'destructive' });
      return;
    }
    const cusLinked = customersRef.current.find(c => c.accountId === id);
    if (cusLinked) {
      toastRef.current({ title: 'Cannot delete account', description: `"${account.name}" is Customer "${cusLinked.name}"'s account. Delete the customer instead.`, variant: 'destructive' });
      return;
    }

    setAccountsState(prev => prev.filter(a => a.id !== id));
    supabase.from('accounts').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    console.info(`[AUDIT-DELETE] Account id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, [accounts, society.fyLocked]);

  // Merge duplicate accounts: move all voucher references from removeId → keepId, then delete removeId
  const mergeAccounts = useCallback((keepId: string, removeId: string): number => {
    if (guardFYLocked()) return 0;
    // P0.1b: engine vouchers are immutable — never silently re-point their accounts. If any
    // engine voucher references the account being merged away (removeId), abort the WHOLE merge
    // (no partial merge). Correction must go through a reversal, not an edit.
    const engineRefKind = (v: Voucher): 'Debit' | 'Credit' | 'Line' | null =>
      v.debitAccountId === removeId ? 'Debit'
        : v.creditAccountId === removeId ? 'Credit'
          : (v.lines?.some(l => l.accountId === removeId) ? 'Line' : null);
    const blocker = vouchersRef.current.find(v => isEngineVoucher(v) && engineRefKind(v) !== null);
    if (blocker) {
      const detail = `${blocker.voucherNo || blocker.id} (${engineRefKind(blocker)})`;
      toastRef.current({ title: 'मर्ज नहीं हो सकता', description: `इस खाते से जुड़ा सिस्टम वाउचर ${detail} है — सिस्टम वाउचर (engine-generated) के खाते बदले नहीं जा सकते। पहले reversal करें, फिर merge करें।`, variant: 'destructive', duration: 10000 });
      return 0;
    }
    // Track which voucher IDs we actually changed BEFORE we overwrite vouchersRef
    const changedIds = new Set<string>();
    const updated = vouchersRef.current.map(v => {
      let changed = false;
      const patched = { ...v };
      if (patched.debitAccountId === removeId) { patched.debitAccountId = keepId; changed = true; }
      if (patched.creditAccountId === removeId) { patched.creditAccountId = keepId; changed = true; }
      if (patched.lines && patched.lines.length > 0) {
        const newLines = patched.lines.map(l =>
          l.accountId === removeId ? { ...l, accountId: keepId } : l
        );
        if (newLines.some((l, i) => l !== patched.lines![i])) {
          patched.lines = newLines;
          changed = true;
        }
      }
      if (changed) changedIds.add(v.id);
      return changed ? patched : v;
    });
    const touchedCount = changedIds.size;
    vouchersRef.current = updated;
    setVouchersState(updated);
    // RULE 3: re-point supplier/customer sub-ledger links that pointed at removeId.
    const reSup = suppliersRef.current.filter(s => s.accountId === removeId);
    if (reSup.length > 0) {
      suppliersRef.current = suppliersRef.current.map(s => s.accountId === removeId ? { ...s, accountId: keepId } : s);
      setSuppliersState(prev => prev.map(s => s.accountId === removeId ? { ...s, accountId: keepId } : s));
      reSup.forEach(s => supabase.from('suppliers').update({ accountId: keepId }).eq('id', s.id).then(({ error }) => { if (error) console.error('Supplier re-point sync:', error.message); }));
    }
    const reCus = customersRef.current.filter(c => c.accountId === removeId);
    if (reCus.length > 0) {
      customersRef.current = customersRef.current.map(c => c.accountId === removeId ? { ...c, accountId: keepId } : c);
      setCustomersState(prev => prev.map(c => c.accountId === removeId ? { ...c, accountId: keepId } : c));
      reCus.forEach(c => supabase.from('customers').update({ accountId: keepId }).eq('id', c.id).then(({ error }) => { if (error) console.error('Customer re-point sync:', error.message); }));
    }
    // H13: Persist only the changed vouchers (and re-sync their voucher_entries rows so SQL reports
    // point at keepId, not removeId). Old filter logic was self-referential and broken.
    updated.filter(v => changedIds.has(v.id)).forEach(v => {
      const { editHistory: _eh, ...forDb } = v;
      supabase.from('vouchers').upsert(withSoc(forDb)).then(({ error }) => {
        if (error) console.error('Merge voucher save:', error.message);
        else if (!v.isDeleted) syncEntries(v); // rebuild voucher_entries with the new accountId
      });
    });
    // Delete the removed account
    setAccountsState(prev => prev.filter(a => a.id !== removeId));
    supabase.from('accounts').delete().eq('id', removeId).then(({ error }) => {
      if (error) console.error('Merge account delete:', error.message);
    });
    return touchedCount;
  }, []);

  const resetAccounts = useCallback((templateAccounts: LedgerAccount[]) => {
    if (guardFYLocked()) return;
    setAccountsState(templateAccounts);
    const sid = societyIdRef.current;
    supabase.from('accounts').delete().eq('society_id', sid).then(() => {
      const BATCH = 50;
      for (let i = 0; i < templateAccounts.length; i += BATCH) {
        const batch = templateAccounts.slice(i, i + BATCH).map(a => ({ ...a, society_id: sid }));
        supabase.from('accounts').insert(batch).then(({ error }) => {
          if (error) console.error('Reset COA batch error:', error.message);
        });
      }
    });
  }, []);

  const updateSociety = useCallback((data: Partial<SocietySettings>) => {
    setSocietyState(prev => {
      const updated = { ...prev, ...data };
      supabase.from('society_settings').upsert({ id: societyIdRef.current, society_id: societyIdRef.current, ...updated }).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
      return updated;
    });
  }, []);

  // C6: admin hides/shows an ENTITLED capability for this society. Writes/removes an
  // admin 'revoke' row only (admin can never entitle). RULE-1: optimistic + rollback on
  // failure with a destructive Hindi toast so local state never diverges from Supabase.
  const setCapabilityHidden = useCallback((capability: Capability, hidden: boolean, meta?: { reason?: string; by?: string }) => {
    const sid = societyIdRef.current;
    const stableId = `${sid}__${capability}__admin`;
    const failToast = (msg: string) => toastRef.current({ title: 'सेव नहीं हुआ', description: 'Cloud save fail — refresh karne par badlav nahi rahega. (' + msg + ')', variant: 'destructive', duration: 10000 });
    setSocietyCapabilitiesState(prev => {
      const rollback = prev;
      if (hidden) {
        const nowIso = new Date().toISOString();
        const next = [
          ...prev.filter(r => !(r.capability === capability && r.source === 'admin' && r.mode === 'revoke')),
          { capability, mode: 'revoke' as const, source: 'admin' as const, expiresAt: null, grantedBy: meta?.by ?? null, createdAt: nowIso },
        ];
        supabase.from('society_capabilities').upsert({ id: stableId, society_id: sid, capability, mode: 'revoke', source: 'admin', granted_by: meta?.by ?? null, created_at: nowIso }).then(
          ({ error }) => { if (error) { setSocietyCapabilitiesState(rollback); failToast(error.message); } else { toastRef.current({ title: 'फ़ीचर बंद किया गया', description: meta?.reason ? 'कारण: ' + meta.reason : 'सुविधा अब साइडबार में नहीं दिखेगी।' }); } },
          () => { setSocietyCapabilitiesState(rollback); failToast('network'); },
        );
        return next;
      }
      const next = prev.filter(r => !(r.capability === capability && r.source === 'admin' && r.mode === 'revoke'));
      supabase.from('society_capabilities').delete().eq('society_id', sid).eq('capability', capability).eq('source', 'admin').then(
        ({ error }) => { if (error) { setSocietyCapabilitiesState(rollback); failToast(error.message); } else { toastRef.current({ title: 'फ़ीचर चालू किया गया', description: meta?.reason ? 'कारण: ' + meta.reason : 'सुविधा अब साइडबार में दिखेगी।' }); } },
        () => { setSocietyCapabilitiesState(rollback); failToast('network'); },
      );
      return next;
    });
  }, []);

  // ── Procurement Phase 1.0 ──────────────────────────────────────────────────
  // Farmer master (minimal). Optimistic + localStorage mirror + Supabase upsert + RULE-1 rollback.
  const addFarmer = useCallback((data: { farmerName: string; fatherName?: string; mobile?: string }): Farmer => {
    if (guardFYLocked()) return { id: '', farmerCode: '', farmerName: data.farmerName, createdAt: '', updatedAt: '' };
    const now = new Date().toISOString();
    const newFarmer: Farmer = {
      id: crypto.randomUUID(),
      farmerCode: `F${String(procurementFarmersRef.current.length + 1).padStart(4, '0')}`,
      farmerName: data.farmerName,
      fatherName: data.fatherName || undefined,
      mobile: data.mobile || undefined,
      createdAt: now,
      updatedAt: now,
    };
    setProcurementFarmersState(prev => { const u = [...prev, newFarmer]; storage.setProcurementFarmers(u); return u; });
    supabase.from('procurement_farmers').upsert(withSoc(newFarmer)).then(({ error }) => {
      if (error) {
        console.error('Farmer sync error:', error.message);
        setProcurementFarmersState(prev => { const r = prev.filter(f => f.id !== newFarmer.id); storage.setProcurementFarmers(r); return r; });
        toastRef.current({ title: 'किसान सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara jodein.`, variant: 'destructive', duration: 12000 });
      }
    });
    return newFarmer;
  }, []);

  // Create a ProcurementLot + exactly ONE immutable 'lot.created' event (append-only). No voucher.
  const addProcurementLot = useCallback((data: { farmerId: string; cropId: string; varietyId?: string; quantity: Quantity; mspRate: Money }): ProcurementLot => {
    const sentinel: ProcurementLot = { id: '', centreId: '', seasonId: '', cropId: '', farmerId: '', operationalStatus: 'created', financialStatus: 'unbilled', reconciliationStatus: 'pending', createdAt: '', updatedAt: '' };
    if (guardFYLocked()) return sentinel;
    const now = new Date().toISOString();
    const lot: ProcurementLot = {
      id: crypto.randomUUID(),
      centreId: societyIdRef.current,
      seasonId: societyRef.current?.financialYear || '',
      cropId: data.cropId,
      varietyId: data.varietyId || undefined,
      farmerId: data.farmerId,
      quantity: data.quantity,
      mspRate: data.mspRate,
      operationalStatus: 'created',
      financialStatus: 'unbilled',
      reconciliationStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    const event: ProcurementEvent = {
      id: crypto.randomUUID(),
      correlationId: lot.id,
      name: 'lot.created',
      occurredAt: now,
      recordedAt: now,
      actor: user?.name || 'System',
      payload: { centreId: lot.centreId, farmerId: lot.farmerId, cropId: lot.cropId, seasonId: lot.seasonId },
    };
    setProcurementLotsState(prev => { const u = [...prev, lot]; storage.setProcurementLots(u); return u; });
    setProcurementEventsState(prev => { const u = [...prev, event]; storage.setProcurementEvents(u); return u; });
    // M1: commit the lot AND its immutable event in ONE atomic DB transaction (generic
    // business-transaction boundary). Both persist together or neither does → the cloud can
    // never hold a lot without its lot.created event. On failure, roll back BOTH optimistically.
    supabase.rpc('procurement_commit_transaction', { p_payload: { transactionType: 'lot.create', transactionId: crypto.randomUUID(), transactionVersion: 1, lots: [withSoc(lot)], events: [withSoc(event)] } }).then(({ error }) => {
      if (error) {
        console.error('Procurement commit error:', error.message);
        setProcurementLotsState(prev => { const r = prev.filter(l => l.id !== lot.id); storage.setProcurementLots(r); return r; });
        setProcurementEventsState(prev => { const r = prev.filter(e => e.id !== event.id); storage.setProcurementEvents(r); return r; });
        toastRef.current({ title: 'लॉट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara banayein.`, variant: 'destructive', duration: 12000 });
      }
    });
    return lot;
  }, [user]);

  // Phase 2.1 — Quality Inspection (pure recording). Records a QualityTest + the measured
  // MoistureRecord + two immutable events (quality.tested, moisture.recorded) for a lot, all
  // committed atomically via the frozen transaction contract. No lot status change, no voucher.
  const recordQualityInspection = useCallback((data: { lotId: string; result: string; moisture: number; inspectedBy?: string }): QualityTest => {
    const sentinel: QualityTest = { id: '', lotId: data.lotId, result: data.result, inspectedBy: '', createdAt: '', updatedAt: '' };
    if (guardFYLocked()) return sentinel;
    // Phase 2.1.1 — early validation only (NOT the business guarantee; the DB unique index on
    // lotId is). One QualityTest + one MoistureRecord per lot: reject a repeat before the RPC.
    if (procurementQualityTests.some(q => q.lotId === data.lotId) || procurementMoistureRecords.some(m => m.lotId === data.lotId)) {
      toastRef.current({ title: 'पहले से दर्ज', description: 'इस लॉट की क्वालिटी जाँच पहले से मौजूद है। (Quality already recorded for this lot)', variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    const now = new Date().toISOString();
    const by = data.inspectedBy?.trim() || user?.name || 'System';
    const qt: QualityTest = { id: crypto.randomUUID(), lotId: data.lotId, result: data.result, inspectedBy: by, createdAt: now, updatedAt: now };
    const mr: MoistureRecord = { id: crypto.randomUUID(), lotId: data.lotId, moisture: { value: data.moisture }, createdAt: now, updatedAt: now };
    const qEvent: ProcurementEvent = { id: crypto.randomUUID(), correlationId: data.lotId, name: 'quality.tested', occurredAt: now, recordedAt: now, actor: by, payload: { lotId: data.lotId, result: data.result } };
    const mEvent: ProcurementEvent = { id: crypto.randomUUID(), correlationId: data.lotId, name: 'moisture.recorded', occurredAt: now, recordedAt: now, actor: by, payload: { lotId: data.lotId, moisture: data.moisture } };
    setProcurementQualityTestsState(prev => { const u = [...prev, qt]; storage.setProcurementQualityTests(u); return u; });
    setProcurementMoistureRecordsState(prev => { const u = [...prev, mr]; storage.setProcurementMoistureRecords(u); return u; });
    setProcurementEventsState(prev => { const u = [...prev, qEvent, mEvent]; storage.setProcurementEvents(u); return u; });
    supabase.rpc('procurement_commit_transaction', { p_payload: { transactionType: 'quality.record', transactionId: crypto.randomUUID(), transactionVersion: 1, qualityTests: [withSoc(qt)], moistureRecords: [withSoc(mr)], events: [withSoc(qEvent), withSoc(mEvent)] } }).then(({ error }) => {
      if (error) {
        console.error('Quality commit error:', error.message);
        setProcurementQualityTestsState(prev => { const r = prev.filter(x => x.id !== qt.id); storage.setProcurementQualityTests(r); return r; });
        setProcurementMoistureRecordsState(prev => { const r = prev.filter(x => x.id !== mr.id); storage.setProcurementMoistureRecords(r); return r; });
        setProcurementEventsState(prev => { const r = prev.filter(e => e.id !== qEvent.id && e.id !== mEvent.id); storage.setProcurementEvents(r); return r; });
        toastRef.current({ title: 'क्वालिटी सेव नहीं हुई', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara record karein.`, variant: 'destructive', duration: 12000 });
      }
    });
    return qt;
  }, [user, procurementQualityTests, procurementMoistureRecords]);

  // Phase 2.2 — J-Form generation (business DOCUMENT only; NOT an accounting event). Generates
  // ONE J-Form per lot + one immutable 'jform.generated' event, committed atomically via the frozen
  // contract. gross = qty × MSP rate, deductions = 0 (no deduction workflow this phase), net = gross.
  // No voucher / financial intent / posting request.
  const generateJForm = useCallback((data: { lotId: string }): JForm => {
    const sentinel: JForm = { id: '', lotId: data.lotId, documentNo: '', gross: { amount: 0, currency: 'INR' }, deductions: { amount: 0, currency: 'INR' }, net: { amount: 0, currency: 'INR' }, createdAt: '', updatedAt: '' };
    if (guardFYLocked()) return sentinel;
    // Early validation only (NOT the business guarantee; the DB unique index on lotId is). One per lot.
    if (procurementJForms.some(j => j.lotId === data.lotId)) {
      toastRef.current({ title: 'पहले से जारी', description: 'इस लॉट का J-Form पहले से बना है। (J-Form already generated for this lot)', variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    const lot = procurementLots.find(l => l.id === data.lotId);
    const cur = lot?.mspRate?.currency || 'INR';
    const grossAmount = (lot?.quantity?.value || 0) * (lot?.mspRate?.amount || 0);
    const now = new Date().toISOString();
    // documentNo is DB-owned (single source of truth). The client sends a placeholder and receives the
    // authoritative number in the RPC response — it never computes J000n here.
    const jf: JForm = {
      id: crypto.randomUUID(), lotId: data.lotId, documentNo: '',
      gross: { amount: grossAmount, currency: cur },
      deductions: { amount: 0, currency: cur },
      net: { amount: grossAmount, currency: cur },
      createdAt: now, updatedAt: now,
    };
    const event: ProcurementEvent = { id: crypto.randomUUID(), correlationId: data.lotId, name: 'jform.generated', occurredAt: now, recordedAt: now, actor: user?.name || 'System', payload: { jformId: jf.id, documentNo: '', net: jf.net } };
    setProcurementJFormsState(prev => { const u = [...prev, jf]; storage.setProcurementJForms(u); return u; });
    setProcurementEventsState(prev => { const u = [...prev, event]; storage.setProcurementEvents(u); return u; });
    supabase.rpc('procurement_commit_transaction', { p_payload: { transactionType: 'jform.generate', transactionId: crypto.randomUUID(), transactionVersion: 1, jforms: [withSoc(jf)], events: [withSoc(event)] } }).then(({ data: res, error }) => {
      if (error) {
        console.error('J-Form commit error:', error.message);
        setProcurementJFormsState(prev => { const r = prev.filter(x => x.id !== jf.id); storage.setProcurementJForms(r); return r; });
        setProcurementEventsState(prev => { const r = prev.filter(e => e.id !== event.id); storage.setProcurementEvents(r); return r; });
        toastRef.current({ title: 'J-Form सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara banayein.`, variant: 'destructive', duration: 12000 });
        return;
      }
      // D1(A): patch the optimistic J-Form + its event with the DB-generated documentNo from the response.
      const gen = (res as { jforms?: Array<{ id: string; documentNo: string }> } | null)?.jforms?.find(j => j.id === jf.id);
      if (gen?.documentNo) {
        setProcurementJFormsState(prev => { const u = prev.map(x => x.id === jf.id ? { ...x, documentNo: gen.documentNo } : x); storage.setProcurementJForms(u); return u; });
        setProcurementEventsState(prev => { const u = prev.map(e => e.id === event.id ? { ...e, payload: { ...(e.payload as Record<string, unknown>), documentNo: gen.documentNo } } : e); storage.setProcurementEvents(u); return u; });
        toastRef.current({ title: 'J-Form बना', description: `${gen.documentNo} · ₹${jf.net.amount}`, duration: 6000 });
      }
    });
    return jf;
  }, [user, procurementJForms, procurementLots]);

  // Phase 3.0 — Financial Intent (business object only; NOT accounting). Generates ONE immutable
  // FinancialIntentRecord from a generated J-Form + one immutable 'financial.intent.created' event,
  // committed atomically via the frozen contract. No posting / engine / voucher / ledger.
  const generateFinancialIntent = useCallback((data: { jformId: string }): FinancialIntentRecord => {
    const sentinel: FinancialIntentRecord = { id: '', lotId: '', jformId: data.jformId, intentType: 'RecogniseProcurement', amount: { amount: 0, currency: 'INR' }, createdAt: '', updatedAt: '' };
    if (guardFYLocked()) return sentinel;
    // 2. J-Form exists?
    const jform = procurementJForms.find(j => j.id === data.jformId);
    if (!jform) {
      toastRef.current({ title: 'J-Form नहीं मिला', description: 'पहले इस लॉट का J-Form बनाएं। (Generate the J-Form first)', variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    // 3. Existing Financial Intent? (early validation; the DB unique index on jformId is the guarantee). One per J-Form.
    if (procurementFinancialIntents.some(i => i.jformId === data.jformId)) {
      toastRef.current({ title: 'पहले से बना', description: 'इस J-Form का Financial Intent पहले से मौजूद है। (Financial Intent already exists for this J-Form)', variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    const now = new Date().toISOString();
    // 4. Build the FinancialIntentRecord.
    const fi: FinancialIntentRecord = {
      id: crypto.randomUUID(), lotId: jform.lotId, jformId: jform.id,
      intentType: 'RecogniseProcurement', amount: jform.net,
      createdAt: now, updatedAt: now,
    };
    // 5. Build the immutable 'financial.intent.created' event (correlationId = lot id).
    const event: ProcurementEvent = { id: crypto.randomUUID(), correlationId: jform.lotId, name: 'financial.intent.created', occurredAt: now, recordedAt: now, actor: user?.name || 'System', payload: { intentId: fi.id, jformId: fi.jformId, amount: fi.amount } };
    setProcurementFinancialIntentsState(prev => { const u = [...prev, fi]; storage.setProcurementFinancialIntents(u); return u; });
    setProcurementEventsState(prev => { const u = [...prev, event]; storage.setProcurementEvents(u); return u; });
    // 6. Commit through the frozen transaction contract.
    supabase.rpc('procurement_commit_transaction', { p_payload: { transactionType: 'financial.intent.create', transactionId: crypto.randomUUID(), transactionVersion: 1, financialIntents: [withSoc(fi)], events: [withSoc(event)] } }).then(({ error }) => {
      if (error) {
        console.error('Financial Intent commit error:', error.message);
        setProcurementFinancialIntentsState(prev => { const r = prev.filter(x => x.id !== fi.id); storage.setProcurementFinancialIntents(r); return r; });
        setProcurementEventsState(prev => { const r = prev.filter(e => e.id !== event.id); storage.setProcurementEvents(r); return r; });
        toastRef.current({ title: 'Financial Intent सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara banayein.`, variant: 'destructive', duration: 12000 });
        return;
      }
      toastRef.current({ title: 'Financial Intent बना', description: `${fi.intentType} · ₹${fi.amount.amount}`, duration: 6000 });
    });
    return fi;
  }, [user, procurementJForms, procurementFinancialIntents]);

  // Phase 3.1 — Posting Request (business object only; NOT posting/ledger/accounting/voucher).
  // Generates ONE immutable PostingRequest from a Financial Intent + one immutable
  // 'posting.request.created' event, committed atomically via the frozen contract. requestType and
  // amount are copied from the source intent (no recalculation).
  const generatePostingRequest = useCallback((data: { financialIntentId: string }): PostingRequest => {
    const sentinel: PostingRequest = { id: '', lotId: '', jformId: '', financialIntentId: data.financialIntentId, requestType: 'RecogniseProcurement', amount: { amount: 0, currency: 'INR' }, createdAt: '', updatedAt: '' };
    if (guardFYLocked()) return sentinel;
    // 2. Financial Intent exists?
    const intent = procurementFinancialIntents.find(i => i.id === data.financialIntentId);
    if (!intent) {
      toastRef.current({ title: 'Financial Intent नहीं मिला', description: 'पहले इस लॉट का Financial Intent बनाएं। (Generate the Financial Intent first)', variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    // 3. Posting Request already exists? (early validation; the DB unique index on financialIntentId is the guarantee). One per intent.
    if (procurementPostingRequests.some(p => p.financialIntentId === data.financialIntentId)) {
      toastRef.current({ title: 'पहले से बना', description: 'इस Financial Intent का Posting Request पहले से मौजूद है। (Posting Request already exists for this Financial Intent)', variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    const now = new Date().toISOString();
    // 4. Build the PostingRequest (requestType + amount copied from the source intent).
    const pr: PostingRequest = {
      id: crypto.randomUUID(), lotId: intent.lotId, jformId: intent.jformId, financialIntentId: intent.id,
      requestType: intent.intentType, amount: intent.amount,
      createdAt: now, updatedAt: now,
    };
    // 5. Build the immutable 'posting.request.created' event (correlationId = lot id).
    const event: ProcurementEvent = { id: crypto.randomUUID(), correlationId: intent.lotId, name: 'posting.request.created', occurredAt: now, recordedAt: now, actor: user?.name || 'System', payload: { postingRequestId: pr.id, financialIntentId: pr.financialIntentId, amount: pr.amount } };
    setProcurementPostingRequestsState(prev => { const u = [...prev, pr]; storage.setProcurementPostingRequests(u); return u; });
    setProcurementEventsState(prev => { const u = [...prev, event]; storage.setProcurementEvents(u); return u; });
    // 6. Commit through the frozen transaction contract.
    supabase.rpc('procurement_commit_transaction', { p_payload: { transactionType: 'posting.request.create', transactionId: crypto.randomUUID(), transactionVersion: 1, postingRequests: [withSoc(pr)], events: [withSoc(event)] } }).then(({ error }) => {
      if (error) {
        console.error('Posting Request commit error:', error.message);
        setProcurementPostingRequestsState(prev => { const r = prev.filter(x => x.id !== pr.id); storage.setProcurementPostingRequests(r); return r; });
        setProcurementEventsState(prev => { const r = prev.filter(e => e.id !== event.id); storage.setProcurementEvents(r); return r; });
        toastRef.current({ title: 'Posting Request सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara banayein.`, variant: 'destructive', duration: 12000 });
        return;
      }
      toastRef.current({ title: 'Posting Request बना', description: `${pr.requestType} · ₹${pr.amount.amount}`, duration: 6000 });
    });
    return pr;
  }, [user, procurementFinancialIntents, procurementPostingRequests]);

  // Phase 3.2 — Posting Rule resolution (business object only; NOT posting/ledger/voucher).
  // Consumes ONE PostingRequest → resolves balanced legs via the pure resolver → persists ONE
  // immutable PostingRuleResult + one immutable 'posting.rule.resolved' event, committed atomically
  // via the frozen contract. The legs are data (symbolic selectors); no voucher / journal / ledger.
  const generatePostingRuleResult = useCallback((data: { postingRequestId: string }): PostingRuleResult => {
    const sentinel: PostingRuleResult = { id: '', postingRequestId: data.postingRequestId, lotId: '', jformId: '', financialIntentId: '', requestType: 'RecogniseProcurement', profile: 'agency', legs: [], createdAt: '', updatedAt: '' };
    if (guardFYLocked()) return sentinel;
    // 2. PostingRequest exists?
    const request = procurementPostingRequests.find(p => p.id === data.postingRequestId);
    if (!request) {
      toastRef.current({ title: 'Posting Request नहीं मिला', description: 'पहले Posting Request बनाएं। (Generate the Posting Request first)', variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    // 3. PostingRuleResult already exists? (early validation; the DB unique index on postingRequestId is the guarantee). One per request.
    if (procurementPostingRuleResults.some(r => r.postingRequestId === data.postingRequestId)) {
      toastRef.current({ title: 'पहले से बना', description: 'इस Posting Request का result पहले से मौजूद है। (Already resolved for this Posting Request)', variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    // 4. Resolve legs via the pure rule, then build the result.
    const profile: AccountingProfile = 'agency';
    // Resolution + account snapshot are FROZEN here (binding + live chart). Engine never re-resolves.
    const legs = resolvePostingLegs(request.requestType, request.amount, profile, PROCUREMENT_POSTING_BINDING, accounts);
    if (legs.length === 0) {
      toastRef.current({ title: 'Rule/खाता binding नहीं', description: `इस requestType (${request.requestType}) के लिए rule नहीं है या bound खाता chart में नहीं मिला। (No rule, or a bound account is missing from the chart)`, variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    const now = new Date().toISOString();
    const result: PostingRuleResult = {
      id: crypto.randomUUID(), postingRequestId: request.id, lotId: request.lotId, jformId: request.jformId,
      financialIntentId: request.financialIntentId, requestType: request.requestType, profile, legs,
      createdAt: now, updatedAt: now,
    };
    // 5. Build the immutable 'posting.rule.resolved' event (correlationId = lot id).
    const event: ProcurementEvent = { id: crypto.randomUUID(), correlationId: request.lotId, name: 'posting.rule.resolved', occurredAt: now, recordedAt: now, actor: user?.name || 'System', payload: { postingRuleResultId: result.id, postingRequestId: result.postingRequestId, legCount: legs.length } };
    setProcurementPostingRuleResultsState(prev => { const u = [...prev, result]; storage.setProcurementPostingRuleResults(u); return u; });
    setProcurementEventsState(prev => { const u = [...prev, event]; storage.setProcurementEvents(u); return u; });
    // 6. Commit through the frozen transaction contract.
    supabase.rpc('procurement_commit_transaction', { p_payload: { transactionType: 'posting.rule.resolve', transactionId: crypto.randomUUID(), transactionVersion: 1, postingRuleResults: [withSoc(result)], events: [withSoc(event)] } }).then(({ error }) => {
      if (error) {
        console.error('Posting Rule resolve error:', error.message);
        setProcurementPostingRuleResultsState(prev => { const r = prev.filter(x => x.id !== result.id); storage.setProcurementPostingRuleResults(r); return r; });
        setProcurementEventsState(prev => { const r = prev.filter(e => e.id !== event.id); storage.setProcurementEvents(r); return r; });
        toastRef.current({ title: 'Posting Rule result सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara karein.`, variant: 'destructive', duration: 12000 });
        return;
      }
      toastRef.current({ title: 'Posting legs resolved', description: `${result.requestType} · ${legs.length} legs`, duration: 6000 });
    });
    return result;
  }, [user, procurementPostingRequests, procurementPostingRuleResults, accounts]);

  // Phase 3.3 — Financial Engine (first slice). Consumes ONE PostingRuleResult → produces ONE
  // immutable Engine Voucher (origin:'engine'), reusing addVoucher / persistVoucher / voucherImmutability.
  // The Voucher (Accounting subsystem) is the SINGLE authoritative record; the procurement
  // 'engine.voucher.created' event is a best-effort audit log. No link table, no compensation, no
  // selector lookup — the engine maps ONLY the frozen resolvedAccountId on each leg.
  const generateEngineVoucher = useCallback((data: { postingRuleResultId: string }): Voucher => {
    const sentinel = { id: '', voucherNo: '', type: 'journal', date: '', debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    if (guardFYLocked()) return sentinel;
    // 2. PostingRuleResult exists?
    const result = procurementPostingRuleResults.find(r => r.id === data.postingRuleResultId);
    if (!result) {
      toastRef.current({ title: 'Posting Rule result नहीं मिला', description: 'पहले Resolve करें। (Resolve the Posting Request first)', variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    // 3. Engine voucher already exists? The Voucher itself is the authoritative one-to-one record
    //    (origin='engine' + refType='posting.rule.result' + refId=result.id). No duplicate link table.
    if (vouchersRef.current.some(v => !v.isDeleted && isEngineVoucher(v) && v.refType === 'posting.rule.result' && v.refId === result.id)) {
      toastRef.current({ title: 'पहले से पोस्ट', description: 'इस result का Engine Voucher पहले से बना है। (Engine voucher already exists for this result)', variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    // 4. Map the frozen legs → voucher lines (uses ONLY resolvedAccountId; no binding lookup).
    const specs = buildEngineVoucherLines(result.legs);
    if (specs.length === 0) {
      toastRef.current({ title: 'Legs resolved नहीं', description: 'इस result के legs में resolvedAccountId नहीं है — दोबारा Resolve करें। (Legs are not account-resolved)', variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    const lines: VoucherLine[] = specs.map(s => ({ id: crypto.randomUUID(), accountId: s.accountId, type: s.type, amount: s.amount }));
    const drTotal = specs.filter(s => s.type === 'Dr').reduce((sum, s) => sum + s.amount, 0);
    // 5. Create the immutable engine voucher via the EXISTING accounting path (authoritative record).
    const voucher = addVoucher({
      type: 'journal', date: new Date().toISOString().split('T')[0],
      debitAccountId: '', creditAccountId: '', amount: drTotal, lines,
      narration: `Engine: ${result.requestType} — ${result.jformId}`,
      createdBy: user?.name || 'Engine',
      origin: 'engine', refType: 'posting.rule.result', refId: result.id,
    });
    if (!voucher.id) return sentinel;   // addVoucher's own FY/balance guard already toasted
    // 6. Best-effort immutable audit event (procurement-owned; NEVER affects the voucher).
    const now = new Date().toISOString();
    const event: ProcurementEvent = { id: crypto.randomUUID(), correlationId: result.lotId, name: 'engine.voucher.created', occurredAt: now, recordedAt: now, actor: user?.name || 'System', payload: { voucherId: voucher.id, voucherNo: voucher.voucherNo, postingRuleResultId: result.id } };
    setProcurementEventsState(prev => { const u = [...prev, event]; storage.setProcurementEvents(u); return u; });
    supabase.rpc('procurement_commit_transaction', { p_payload: { transactionType: 'engine.voucher.create', transactionId: crypto.randomUUID(), transactionVersion: 1, events: [withSoc(event)] } }).then(({ error }) => {
      if (error) {
        console.warn('engine.voucher.created event commit failed:', error.message);
        setProcurementEventsState(prev => { const r = prev.filter(e => e.id !== event.id); storage.setProcurementEvents(r); return r; });
        toastRef.current({ title: '⚠️ Audit event save नहीं हुआ', description: `Engine voucher ${voucher.voucherNo} ban gaya (authoritative); par audit event cloud par save nahi hua: ${error.message}.`, variant: 'default', duration: 8000 });
      }
    });
    toastRef.current({ title: 'Engine voucher बना', description: `${voucher.voucherNo} · ${result.requestType}`, duration: 6000 });
    return voucher;
  }, [user, procurementPostingRuleResults, addVoucher]);

  // ── Farmer Settlement — the authoritative business document ──────────────────
  // Helper: the live (non-deleted) settlement for an Engine Voucher (1:1). SoT for the operator.
  const settlementForEv = (engineVoucherId: string) =>
    procurementSettlements.find(s => !s.isDeleted && s.engineVoucherId === engineVoucherId);

  // Create the DRAFT settlement for a posted Engine Voucher. Snapshots gross from the ev payable.
  // No accounting, no number yet. Plain upsert (provisional record) with RULE-1 rollback.
  const createFarmerSettlement = useCallback((data: { engineVoucherId: string }): FarmerSettlement => {
    const blank: FarmerSettlement = { id: '', engineVoucherId: data.engineVoucherId, status: 'draft', gross: { amount: 0, currency: 'INR' }, deductionLines: [], netPayable: { amount: 0, currency: 'INR' }, amountPaid: { amount: 0, currency: 'INR' }, createdAt: '', updatedAt: '' };
    if (guardFYLocked()) return blank;
    const ev = vouchersRef.current.find(v => v.id === data.engineVoucherId && !v.isDeleted && isEngineVoucher(v));
    if (!ev) {
      toastRef.current({ title: 'Engine Voucher नहीं मिला', description: 'पहले Post करें। (Post the engine voucher first)', variant: 'destructive', duration: 8000 });
      return blank;
    }
    if (procurementSettlements.some(s => !s.isDeleted && s.engineVoucherId === ev.id)) {
      toastRef.current({ title: 'पहले से बना', description: 'इस वाउचर का निपटान पहले से मौजूद है। (Settlement already exists)', variant: 'destructive', duration: 8000 });
      return blank;
    }
    const now = new Date().toISOString();
    const gross: Money = { amount: ev.amount, currency: 'INR' };
    const stl: FarmerSettlement = { id: crypto.randomUUID(), engineVoucherId: ev.id, status: 'draft', gross, deductionLines: [], netPayable: { ...gross }, amountPaid: { amount: 0, currency: 'INR' }, createdBy: user?.name || 'System', isDeleted: false, createdAt: now, updatedAt: now };
    setProcurementSettlementsState(prev => { const u = [...prev, stl]; storage.setProcurementSettlements(u); return u; });
    supabase.from('procurement_settlements').upsert(withSoc(stl)).then(({ error }) => {
      if (error) {
        console.error('Settlement create error:', error.message);
        setProcurementSettlementsState(prev => { const r = prev.filter(x => x.id !== stl.id); storage.setProcurementSettlements(r); return r; });
        toastRef.current({ title: 'निपटान सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara banayein.`, variant: 'destructive', duration: 12000 });
      }
    });
    toastRef.current({ title: 'निपटान ड्राफ्ट बना', description: `${gross.currency} ${gross.amount}`, duration: 5000 });
    return stl;
  }, [user, procurementSettlements]);

  // Internal: persist a DRAFT settlement mutation (line add/remove) with optimistic update + rollback.
  const persistDraftSettlement = (prevStl: FarmerSettlement, nextStl: FarmerSettlement) => {
    setProcurementSettlementsState(prev => { const u = prev.map(x => x.id === nextStl.id ? nextStl : x); storage.setProcurementSettlements(u); return u; });
    supabase.from('procurement_settlements').upsert(withSoc(nextStl)).then(({ error }) => {
      if (error) {
        console.error('Settlement update error:', error.message);
        setProcurementSettlementsState(prev => { const u = prev.map(x => x.id === prevStl.id ? prevStl : x); storage.setProcurementSettlements(u); return u; });
        toastRef.current({ title: 'बदलाव सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga.`, variant: 'destructive', duration: 12000 });
      }
    });
  };

  // Add a deduction LINE to a draft settlement (no accounting). Net Payable = gross − Σ lines (recomputed).
  const addSettlementDeductionLine = useCallback((data: { settlementId: string; deductionType: string; accountId: string; amount: number; reference?: string; remarks?: string }): void => {
    if (guardFYLocked()) return;
    const stl = procurementSettlements.find(s => s.id === data.settlementId && !s.isDeleted);
    if (!stl) { toastRef.current({ title: 'निपटान नहीं मिला', description: 'Settlement not found', variant: 'destructive', duration: 8000 }); return; }
    if (stl.status !== 'draft') { toastRef.current({ title: 'स्वीकृत निपटान', description: 'स्वीकृत निपटान में कटौती नहीं जोड़ सकते। (Cannot edit an approved settlement)', variant: 'destructive', duration: 9000 }); return; }
    if (!data.accountId || !accounts.some(a => a.id === data.accountId)) { toastRef.current({ title: 'खाता चुनें', description: 'कटौती के लिए एक खाता चुनें। (Select a deduction account)', variant: 'destructive', duration: 8000 }); return; }
    if (!(data.amount > 0)) { toastRef.current({ title: 'राशि डालें', description: 'कटौती राशि 0 से अधिक होनी चाहिए।', variant: 'destructive', duration: 8000 }); return; }
    const line: SettlementDeductionLine = { id: crypto.randomUUID(), deductionType: data.deductionType, accountId: data.accountId, amount: { amount: +data.amount.toFixed(2), currency: stl.gross.currency }, reference: data.reference?.trim() || undefined, remarks: data.remarks?.trim() || undefined };
    const lines = [...stl.deductionLines, line];
    const totalDed = +lines.reduce((s, l) => s + l.amount.amount, 0).toFixed(2);
    if (totalDed > stl.gross.amount) { toastRef.current({ title: 'कटौती सकल से अधिक', description: `कुल कटौती ₹${totalDed} सकल ₹${stl.gross.amount} से अधिक नहीं हो सकती।`, variant: 'destructive', duration: 9000 }); return; }
    const next: FarmerSettlement = { ...stl, deductionLines: lines, netPayable: { amount: +(stl.gross.amount - totalDed).toFixed(2), currency: stl.gross.currency }, updatedAt: new Date().toISOString() };
    persistDraftSettlement(stl, next);
    toastRef.current({ title: 'कटौती जोड़ी', description: `${data.deductionType} · ₹${line.amount.amount}`, duration: 5000 });
  }, [accounts, procurementSettlements]);

  // Remove a deduction line from a draft settlement.
  const removeSettlementDeductionLine = useCallback((data: { settlementId: string; lineId: string }): void => {
    if (guardFYLocked()) return;
    const stl = procurementSettlements.find(s => s.id === data.settlementId && !s.isDeleted);
    if (!stl || stl.status !== 'draft') { toastRef.current({ title: 'संभव नहीं', description: 'केवल ड्राफ्ट निपटान संपादित कर सकते हैं।', variant: 'destructive', duration: 8000 }); return; }
    const lines = stl.deductionLines.filter(l => l.id !== data.lineId);
    const totalDed = +lines.reduce((s, l) => s + l.amount.amount, 0).toFixed(2);
    const next: FarmerSettlement = { ...stl, deductionLines: lines, netPayable: { amount: +(stl.gross.amount - totalDed).toFixed(2), currency: stl.gross.currency }, updatedAt: new Date().toISOString() };
    persistDraftSettlement(stl, next);
  }, [procurementSettlements]);

  // APPROVE — the single business event (immutable Settlement Transaction). Posts ONE compound
  // deduction voucher (Dr payable Σ / Cr each deduction account) as the accounting CONSEQUENCE, locks
  // Net Payable, and commits the approved settlement + 'settlement.approved' event via the atomic RPC,
  // which assigns the DB-owned gap-free Settlement Number. Voucher is created FIRST (authoritative
  // accounting); on RPC failure it is cancelled and the settlement reverts to draft (RULE 1).
  const approveFarmerSettlement = useCallback((data: { settlementId: string }): FarmerSettlement => {
    const blank = { id: '', engineVoucherId: '', status: 'draft', gross: { amount: 0, currency: 'INR' }, deductionLines: [], netPayable: { amount: 0, currency: 'INR' }, amountPaid: { amount: 0, currency: 'INR' }, createdAt: '', updatedAt: '' } as FarmerSettlement;
    if (guardFYLocked()) return blank;
    const stl = procurementSettlements.find(s => s.id === data.settlementId && !s.isDeleted);
    if (!stl) { toastRef.current({ title: 'निपटान नहीं मिला', description: 'Settlement not found', variant: 'destructive', duration: 8000 }); return blank; }
    if (stl.status !== 'draft') { toastRef.current({ title: 'पहले से स्वीकृत', description: 'यह निपटान पहले ही स्वीकृत है। (Already approved)', variant: 'destructive', duration: 8000 }); return blank; }
    const ev = vouchersRef.current.find(v => v.id === stl.engineVoucherId && !v.isDeleted && isEngineVoucher(v));
    if (!ev) { toastRef.current({ title: 'Engine Voucher नहीं मिला', description: 'Post the engine voucher first', variant: 'destructive', duration: 8000 }); return blank; }
    const totalDed = +stl.deductionLines.reduce((s, l) => s + l.amount.amount, 0).toFixed(2);
    const netPayable: Money = { amount: +(stl.gross.amount - totalDed).toFixed(2), currency: stl.gross.currency };
    const payableAcc = ev.lines?.find(l => l.type === 'Cr')?.accountId || ev.creditAccountId;
    const now = new Date().toISOString();

    // 1. Accounting consequence — ONE compound deduction voucher (only if there are deductions).
    let settlementVoucherId: string | undefined;
    if (totalDed > 0) {
      const lid = () => crypto.randomUUID();
      const v = addVoucher({
        type: 'journal', date: now.split('T')[0],
        debitAccountId: payableAcc, creditAccountId: stl.deductionLines[0].accountId, amount: totalDed,
        narration: `निपटान कटौती — ${ev.voucherNo}`,
        refType: 'farmer.settlement', refId: stl.id,
        createdBy: user?.name || 'System',
        lines: [
          { id: lid(), accountId: payableAcc, type: 'Dr', amount: totalDed },
          ...stl.deductionLines.map(l => ({ id: lid(), accountId: l.accountId, type: 'Cr' as const, amount: l.amount.amount })),
        ],
      });
      if (!v.id) { toastRef.current({ title: 'कटौती वाउचर नहीं बना', description: 'Settlement not approved.', variant: 'destructive', duration: 9000 }); return blank; }
      settlementVoucherId = v.id;
    }

    // 2. The approved Settlement Transaction (settlementNo assigned by the RPC). Optimistic local update.
    const approved: FarmerSettlement = { ...stl, status: 'approved', netPayable, amountPaid: { amount: 0, currency: netPayable.currency }, settlementVoucherId, approvedAt: now, approvedBy: user?.name || 'System', updatedAt: now };
    const event: ProcurementEvent = { id: crypto.randomUUID(), correlationId: ev.id, name: 'settlement.approved', occurredAt: now, recordedAt: now, actor: user?.name || 'System', payload: { settlementId: stl.id, settlementNo: '', engineVoucherId: ev.id, netPayable, settlementVoucherId } };
    setProcurementSettlementsState(prev => { const u = prev.map(x => x.id === stl.id ? approved : x); storage.setProcurementSettlements(u); return u; });
    setProcurementEventsState(prev => { const u = [...prev, event]; storage.setProcurementEvents(u); return u; });
    supabase.rpc('procurement_commit_transaction', { p_payload: { transactionType: 'settlement.approve', transactionId: crypto.randomUUID(), transactionVersion: 1, settlements: [withSoc(approved)], events: [withSoc(event)] } }).then(({ data: res, error }) => {
      if (error) {
        console.error('Settlement approve commit error:', error.message);
        // RULE 1 — revert to draft AND cancel the accounting consequence so re-approval can't double-post.
        setProcurementSettlementsState(prev => { const u = prev.map(x => x.id === stl.id ? stl : x); storage.setProcurementSettlements(u); return u; });
        setProcurementEventsState(prev => { const r = prev.filter(e => e.id !== event.id); storage.setProcurementEvents(r); return r; });
        if (settlementVoucherId) cancelVoucher(settlementVoucherId, 'Settlement approval failed (auto-rollback)', user?.name || 'System');
        toastRef.current({ title: 'निपटान स्वीकृत नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara approve karein.`, variant: 'destructive', duration: 12000 });
        return;
      }
      const gen = (res as { settlements?: Array<{ id: string; settlementNo: string }> } | null)?.settlements?.find(s => s.id === stl.id);
      if (gen?.settlementNo) {
        setProcurementSettlementsState(prev => { const u = prev.map(x => x.id === stl.id ? { ...x, settlementNo: gen.settlementNo } : x); storage.setProcurementSettlements(u); return u; });
        setProcurementEventsState(prev => { const u = prev.map(e => e.id === event.id ? { ...e, payload: { ...(e.payload as Record<string, unknown>), settlementNo: gen.settlementNo } } : e); storage.setProcurementEvents(u); return u; });
        toastRef.current({ title: 'निपटान स्वीकृत', description: `${gen.settlementNo} · निवल देय ₹${netPayable.amount}`, duration: 6000 });
      }
    });
    return approved;
  }, [user, procurementSettlements, addVoucher, cancelVoucher]);

  // Farmer Payment — settles the APPROVED settlement's Net Payable. Dr = the Engine Voucher's payable
  // account (its Cr leg); Cr = Cash / selected Bank. Outstanding reads the STORED settlement (SoT):
  // netPayable − amountPaid. The payment voucher is the authoritative base; advancing amountPaid is the
  // extra (RULE-1 step-2 — mild warning on failure, since amountPaid is reconcilable from payments).
  const recordFarmerPayment = useCallback((data: { engineVoucherId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; paymentDate: string; reference?: string; remarks?: string }): Voucher => {
    const sentinel = { id: '', voucherNo: '', type: 'payment', date: data.paymentDate, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    if (guardFYLocked()) return sentinel;
    const ev = vouchersRef.current.find(v => v.id === data.engineVoucherId && !v.isDeleted && isEngineVoucher(v));
    if (!ev) {
      toastRef.current({ title: 'Engine Voucher नहीं मिला', description: 'पहले Post करें। (Post the engine voucher first)', variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    const stl = procurementSettlements.find(s => !s.isDeleted && s.engineVoucherId === ev.id);
    if (!stl || stl.status !== 'approved') {
      toastRef.current({ title: 'पहले निपटान स्वीकृत करें', description: 'भुगतान से पहले निपटान बनाकर स्वीकृत करें। (Approve the settlement before paying)', variant: 'destructive', duration: 9000 });
      return sentinel;
    }
    const outstanding = +(stl.netPayable.amount - stl.amountPaid.amount).toFixed(2);
    if (!(data.amount > 0)) {
      toastRef.current({ title: 'राशि डालें', description: 'भुगतान राशि 0 से अधिक होनी चाहिए। (Amount must be greater than 0)', variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    if (data.amount > outstanding) {
      toastRef.current({ title: 'राशि बकाया से अधिक', description: `भुगतान ₹${data.amount} बकाया ₹${outstanding} से अधिक नहीं हो सकता। (Cannot exceed outstanding)`, variant: 'destructive', duration: 9000 });
      return sentinel;
    }
    const payableAcc = ev.lines?.find(l => l.type === 'Cr')?.accountId || ev.creditAccountId;
    const creditAcc = data.mode === 'cash' ? ACCOUNT_IDS.CASH : (data.bankAccountId || getBankAccountIds(accounts)[0] || ACCOUNT_IDS.BANK);
    const lid = () => crypto.randomUUID();
    const ref = data.reference?.trim() ? ` · Ref ${data.reference.trim()}` : '';
    const rem = data.remarks?.trim() ? ` · ${data.remarks.trim()}` : '';
    // Authoritative base: the payment voucher (addVoucher self-manages RULE-1).
    const voucher = addVoucher({
      type: 'payment', date: data.paymentDate,
      debitAccountId: payableAcc, creditAccountId: creditAcc, amount: data.amount,
      narration: `किसान को भुगतान — ${ev.voucherNo}${ref}${rem}`,
      refType: 'farmer.payment', refId: ev.id,
      createdBy: user?.name || 'System',
      lines: [
        { id: lid(), accountId: payableAcc, type: 'Dr', amount: data.amount },
        { id: lid(), accountId: creditAcc, type: 'Cr', amount: data.amount },
      ],
    });
    if (!voucher.id) return sentinel;
    // Extra: advance the settlement's stored payment progress (amountPaid). Reconcilable from payment
    // vouchers, so a cloud-save miss here is a MILD warning (no rollback of the saved payment).
    const next: FarmerSettlement = { ...stl, amountPaid: { amount: +(stl.amountPaid.amount + data.amount).toFixed(2), currency: stl.netPayable.currency }, updatedAt: new Date().toISOString() };
    setProcurementSettlementsState(prev => { const u = prev.map(x => x.id === stl.id ? next : x); storage.setProcurementSettlements(u); return u; });
    supabase.from('procurement_settlements').upsert(withSoc(next)).then(({ error }) => {
      if (error) {
        console.warn('Settlement amountPaid update failed:', error.message);
        toastRef.current({ title: 'भुगतान दर्ज हुआ', description: 'निपटान प्रगति cloud पर अभी update नहीं हुई — refresh पर ठीक हो जाएगी। (Payment saved; settlement progress will sync.)', variant: 'default', duration: 9000 });
      }
    });
    return voucher;
  }, [user, accounts, addVoucher, procurementSettlements]);

  // Only active (non-deleted) vouchers for all financial calculations
  const activeVouchers = vouchers.filter(v => !v.isDeleted);

  const getAccountBalance = useCallback((accountId: string): number => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return 0;
    let balance = account.openingBalanceType === 'debit' ? account.openingBalance : -account.openingBalance;
    activeVouchers.forEach(v => {
      getVoucherLines(v).forEach(l => {
        if (l.accountId === accountId) balance += l.type === 'Dr' ? l.amount : -l.amount;
      });
    });
    return balance;
  }, [accounts, activeVouchers]);

  const getCashBookEntries = useCallback((fromDate?: string, toDate?: string): CashBookEntry[] => {
    const cashAccount = accounts.find(a => a.id === ACCOUNT_IDS.CASH);
    if (!cashAccount) return [];
    let runningBalance = cashAccount.openingBalanceType === 'debit'
      ? cashAccount.openingBalance
      : -cashAccount.openingBalance;

    const cashVouchers = activeVouchers
      .filter(v => getVoucherLines(v).some(l => l.accountId === ACCOUNT_IDS.CASH))
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

    if (fromDate) {
      cashVouchers.filter(v => v.date < fromDate).forEach(v => {
        getVoucherLines(v).filter(l => l.accountId === ACCOUNT_IDS.CASH).forEach(l => {
          runningBalance += l.type === 'Dr' ? l.amount : -l.amount;
        });
      });
    }

    const result: CashBookEntry[] = [];
    cashVouchers
      .filter(v => {
        if (fromDate && v.date < fromDate) return false;
        if (toDate && v.date > toDate) return false;
        return true;
      })
      .forEach(v => {
        const cashLines = getVoucherLines(v).filter(l => l.accountId === ACCOUNT_IDS.CASH);
        cashLines.forEach(l => {
          runningBalance += l.type === 'Dr' ? l.amount : -l.amount;
          const otherLines = getVoucherLines(v).filter(ol => ol.accountId !== ACCOUNT_IDS.CASH);
          const otherAcc = accounts.find(a => a.id === otherLines[0]?.accountId);
          result.push({
            id: v.id,
            date: v.date,
            voucherNo: v.voucherNo,
            particulars: v.narration || otherAcc?.name || '',
            type: l.type === 'Dr' ? 'receipt' : 'payment',
            amount: l.amount,
            runningBalance,
          });
        });
      });
    return result;
  }, [accounts, activeVouchers]);

  const getBankBookEntries = useCallback((fromDate?: string, toDate?: string, bankAccountId?: string): BankBookEntry[] => {
    const targetBankId = bankAccountId || getBankAccountIds(accounts)[0] || ACCOUNT_IDS.BANK;
    const bankAccount = accounts.find(a => a.id === targetBankId);
    if (!bankAccount) return [];
    let runningBalance = bankAccount.openingBalanceType === 'debit'
      ? bankAccount.openingBalance
      : -bankAccount.openingBalance;

    const bankVouchers = activeVouchers
      .filter(v => getVoucherLines(v).some(l => l.accountId === targetBankId))
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

    if (fromDate) {
      bankVouchers.filter(v => v.date < fromDate).forEach(v => {
        getVoucherLines(v).filter(l => l.accountId === targetBankId).forEach(l => {
          runningBalance += l.type === 'Dr' ? l.amount : -l.amount;
        });
      });
    }

    const result: BankBookEntry[] = [];
    bankVouchers
      .filter(v => {
        if (fromDate && v.date < fromDate) return false;
        if (toDate && v.date > toDate) return false;
        return true;
      })
      .forEach(v => {
        const bankLines = getVoucherLines(v).filter(l => l.accountId === targetBankId);
        bankLines.forEach(l => {
          runningBalance += l.type === 'Dr' ? l.amount : -l.amount;
          const otherLines = getVoucherLines(v).filter(ol => ol.accountId !== targetBankId);
          const otherAcc = accounts.find(a => a.id === otherLines[0]?.accountId);
          result.push({
            id: v.id,
            date: v.date,
            voucherNo: v.voucherNo,
            particulars: v.narration || otherAcc?.name || '',
            type: l.type === 'Dr' ? 'deposit' : 'withdrawal',
            amount: l.amount,
            runningBalance,
          });
        });
      });
    return result;
  }, [accounts, activeVouchers]);

  // BUG-03 FIX: Accept optional asOnDate to filter vouchers up to that date.
  const getTrialBalance = useCallback((asOnDate?: string): AccountBalance[] => {
    const vouchersToUse = asOnDate
      ? activeVouchers.filter(v => v.date <= asOnDate)
      : activeVouchers;

    // Build results for existing accounts
    const accountIds = new Set(accounts.filter(a => !a.isGroup).map(a => a.id));
    const results = accounts.filter(a => !a.isGroup).map(account => {
      const openingDebit = account.openingBalanceType === 'debit' ? account.openingBalance : 0;
      const openingCredit = account.openingBalanceType === 'credit' ? account.openingBalance : 0;
      let transactionDebit = 0;
      let transactionCredit = 0;
      vouchersToUse.forEach(v => {
        getVoucherLines(v).forEach(l => {
          if (l.accountId === account.id) {
            if (l.type === 'Dr') transactionDebit += l.amount;
            else transactionCredit += l.amount;
          }
        });
      });
      const totalDebit = openingDebit + transactionDebit;
      const totalCredit = openingCredit + transactionCredit;
      return { account, openingDebit, openingCredit, transactionDebit, transactionCredit, totalDebit, totalCredit, netBalance: totalDebit - totalCredit };
    });

    // Detect orphaned transactions (voucher lines referencing deleted/missing accounts)
    const orphanMap: Record<string, { dr: number; cr: number }> = {};
    vouchersToUse.forEach(v => {
      getVoucherLines(v).forEach(l => {
        if (!accountIds.has(l.accountId)) {
          if (!orphanMap[l.accountId]) orphanMap[l.accountId] = { dr: 0, cr: 0 };
          if (l.type === 'Dr') orphanMap[l.accountId].dr += l.amount;
          else orphanMap[l.accountId].cr += l.amount;
        }
      });
    });
    // Add orphaned accounts as synthetic entries so TB can balance
    Object.entries(orphanMap).forEach(([id, { dr, cr }]) => {
      const syntheticAccount: LedgerAccount = {
        id, name: `[Deleted] ${id.slice(0, 8)}...`, nameHi: `[हटाया] ${id.slice(0, 8)}...`,
        type: 'liability', openingBalance: 0, openingBalanceType: 'credit',
      };
      results.push({ account: syntheticAccount, openingDebit: 0, openingCredit: 0, transactionDebit: dr, transactionCredit: cr, totalDebit: dr, totalCredit: cr, netBalance: dr - cr });
    });

    return results;
  }, [accounts, activeVouchers]);

  const getMemberLedger = useCallback((memberId: string): MemberLedgerEntry[] => {
    const member = members.find(m => m.id === memberId);
    if (!member) return [];

    // Only show Share Capital related vouchers (exclude ADM_FEE and others)
    const memberVouchers = activeVouchers
      .filter(v => v.memberId === memberId && (v.creditAccountId === ACCOUNT_IDS.SHARE_CAP || v.debitAccountId === ACCOUNT_IDS.SHARE_CAP))
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

    const hasShareCapVoucher = memberVouchers.some(v => v.creditAccountId === ACCOUNT_IDS.SHARE_CAP);
    // If a proper voucher exists, start at 0 (voucher covers it). Otherwise show OB row.
    let balance = hasShareCapVoucher ? 0 : (member.shareCapital || 0);
    const result: MemberLedgerEntry[] = [];

    // Show Opening Balance row only if no proper voucher exists (backward compatibility)
    if (!hasShareCapVoucher && (member.shareCapital || 0) > 0) {
      result.push({
        id: 'ob',
        date: member.joinDate,
        voucherNo: 'OB',
        particulars: 'Opening Share Capital',
        credit: member.shareCapital,
        debit: 0,
        balance,
      });
    }

    memberVouchers.forEach(v => {
      const isCredit = v.creditAccountId === ACCOUNT_IDS.SHARE_CAP;
      const credit = isCredit ? v.amount : 0;
      const debit = !isCredit ? v.amount : 0;
      balance = balance + credit - debit;
      result.push({
        id: v.id,
        date: v.date,
        voucherNo: v.voucherNo,
        particulars: v.narration || (isCredit ? 'Share deposit received' : 'Share withdrawal'),
        credit,
        debit,
        balance,
      });
    });

    return result;
  }, [members, activeVouchers]);

  const addLoan = useCallback((data: Omit<Loan, 'id' | 'loanNo' | 'createdAt'>): Loan => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as Loan;
    const fy = society.financialYear;
    const maxNum = loansRef.current.filter(l => l.loanNo?.includes(fy)).reduce((max, l) => {
      const m = l.loanNo?.match(/\/(\d+)$/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const loanNo = `L/${fy}/${String(maxNum + 1).padStart(3, '0')}`;
    const newLoan: Loan = { ...data, id: crypto.randomUUID(), loanNo, createdAt: new Date().toISOString() };
    loansRef.current = [...loansRef.current, newLoan];
    setLoansState(prev => { const updated = [...prev, newLoan]; return updated; });
    supabase.from('loans').upsert(withSoc(newLoan)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        loansRef.current = loansRef.current.filter(l => l.id !== newLoan.id);
        setLoansState(prev => prev.filter(l => l.id !== newLoan.id));   // RULE 1: roll back
        toastRef.current({ title: 'ऋण सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara jodein.`, variant: 'destructive', duration: 12000 });
      }
    });

    // M16: Create disbursement voucher so loan appears as an asset in Trial Balance / Balance Sheet.
    // Dr: Loans & Advances (3304) for principal; Cr: Cash (default) — user can re-class later from Vouchers.
    // Tolerant of chart-of-accounts variants: if 3304 isn't present, look for any account whose name
    // contains "Loans" under parent 3300.
    if (newLoan.amount > 0) {
      const loanAccount = accounts.find(a => a.id === '3304')
        || accounts.find(a => a.parentId === '3300' && /loan/i.test(a.name) && !a.isGroup);
      if (loanAccount) {
        const member = membersRef.current.find(m => m.id === newLoan.memberId);
        addVoucher({
          type: 'payment',
          date: newLoan.disbursementDate || new Date().toISOString().split('T')[0],
          debitAccountId: loanAccount.id,
          creditAccountId: ACCOUNT_IDS.CASH,
          amount: newLoan.amount,
          narration: `Loan ${loanNo} disbursed to ${member?.name || newLoan.memberId} — ${newLoan.purpose || newLoan.loanType}`,
          createdBy: user?.name ?? 'System',
          memberId: newLoan.memberId,
        });
      } else {
        toastRef.current({
          title: 'Loan saved, voucher skipped',
          description: 'No "Loans & Advances" (3304) account found. Trial Balance will not show this loan until you add a manual disbursement voucher.',
          variant: 'default',
        });
      }
    }

    return newLoan;
  }, [society.financialYear, accounts, addVoucher, user?.name]);

  const updateLoan = useCallback((id: string, data: Partial<Loan>) => {
    if (guardFYLocked()) return;
    const before = loansRef.current.find(l => l.id === id);
    if (!before) return;
    const updated = { ...before, ...data };
    setLoansState(prev => prev.map(l => l.id === id ? updated : l));
    supabase.from('loans').upsert(withSoc(updated)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        setLoansState(prev => prev.map(l => l.id === id ? before : l));   // RULE 1: roll back to prior state
        toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, []);

  const deleteLoan = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const loan = loansRef.current.find(l => l.id === id);
    setLoansState(prev => { const updated = prev.filter(l => l.id !== id); return updated; });
    supabase.from('loans').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    // RULE 3: soft-cancel the auto-generated disbursement voucher (matched by the unique loanNo
    // in its narration) so no ghost "Loans & Advances" asset lingers in Trial Balance / Balance Sheet.
    if (loan?.loanNo) {
      const now = new Date().toISOString();
      const linkedIds = new Set(vouchersRef.current.filter(v => !v.isDeleted && v.memberId === loan.memberId && v.narration?.includes(loan.loanNo) && !isEngineVoucher(v)).map(v => v.id));
      if (linkedIds.size > 0) {
        const cancel = (v: Voucher) => linkedIds.has(v.id) ? { ...v, isDeleted: true, deletedAt: now, deletedBy: user?.name || 'System', deletedReason: 'Loan deleted' } : v;
        vouchersRef.current = vouchersRef.current.map(cancel);
        setVouchersState(prev => prev.map(cancel));
        linkedIds.forEach(vid => supabase.from('vouchers').update({ isDeleted: true }).eq('id', vid).then(({ error }) => { if (error) console.error('Loan voucher cancel sync:', error.message); else deleteEntries(vid); }));
      }
    }
    console.info(`[AUDIT-DELETE] Loan id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, []);

  const addAsset = useCallback((data: Omit<Asset, 'id' | 'assetNo'>): Asset => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as Asset;
    const maxNum = assetsRef.current.reduce((max, a) => {
      const m = a.assetNo?.match(/AST\/(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const assetNo = `AST/${String(maxNum + 1).padStart(4, '0')}`;
    const newAsset: Asset = { ...data, id: crypto.randomUUID(), assetNo };
    assetsRef.current = [...assetsRef.current, newAsset];
    setAssetsState(prev => { const updated = [...prev, newAsset]; return updated; });
    supabase.from('assets').upsert(withSoc(newAsset)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        assetsRef.current = assetsRef.current.filter(a => a.id !== newAsset.id);
        setAssetsState(prev => prev.filter(a => a.id !== newAsset.id));   // RULE 1: roll back
        toastRef.current({ title: 'संपत्ति सेव नहीं हुई', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 });
      }
    });
    return newAsset;
  }, []);

  const updateAsset = useCallback((id: string, data: Partial<Asset>) => {
    if (guardFYLocked()) return;
    const before = assetsRef.current.find(a => a.id === id);
    if (!before) return;
    const updated = { ...before, ...data };
    setAssetsState(prev => prev.map(a => a.id === id ? updated : a));
    supabase.from('assets').upsert(withSoc(updated)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        setAssetsState(prev => prev.map(a => a.id === id ? before : a));   // RULE 1: roll back to prior state
        toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, []);

  const deleteAsset = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const asset = assetsRef.current.find(a => a.id === id);
    setAssetsState(prev => { const updated = prev.filter(a => a.id !== id); return updated; });
    supabase.from('assets').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    // RULE 3: soft-cancel any depreciation journal(s) auto-posted for this asset (matched by its
    // unique assetNo in the narration) so no orphan depreciation expense / accumulated-dep lingers.
    if (asset?.assetNo) {
      const now = new Date().toISOString();
      const linkedIds = new Set(vouchersRef.current.filter(v => !v.isDeleted && v.narration?.includes(asset.assetNo) && !isEngineVoucher(v)).map(v => v.id));
      if (linkedIds.size > 0) {
        const cancel = (v: Voucher) => linkedIds.has(v.id) ? { ...v, isDeleted: true, deletedAt: now, deletedBy: user?.name || 'System', deletedReason: 'Asset deleted' } : v;
        vouchersRef.current = vouchersRef.current.map(cancel);
        setVouchersState(prev => prev.map(cancel));
        linkedIds.forEach(vid => supabase.from('vouchers').update({ isDeleted: true }).eq('id', vid).then(({ error }) => { if (error) console.error('Asset depreciation voucher cancel sync:', error.message); else deleteEntries(vid); }));
      }
    }
    console.info(`[AUDIT-DELETE] Asset id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, []);

  // ── Depreciation Posting ───────────────────────────────────────────────────
  // Posts one journal entry per active depreciable asset for the given FY.
  // Skips assets already posted, with zero rate, Land category, or disposed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const postDepreciation = useCallback((fy?: string): { posted: number; skipped: number } => {
    if (guardFYLocked()) return { posted: 0, skipped: 0 };
    const targetFY  = fy || society.financialYear;
    const fyDates   = parseFY(targetFY);
    if (!fyDates) return { posted: 0, skipped: 0 };

    const depDate   = fyDates.end; // last day of FY
    const createdBy = user?.name || 'System';

    const currentAccounts = accounts;
    const currentVouchers = vouchersRef.current.filter(v => !v.isDeleted);

    let posted = 0, skipped = 0;

    for (const asset of assets) {
      if (asset.status !== 'active' || !asset.depreciationRate || asset.depreciationRate <= 0) { skipped++; continue; }
      const depAcc = DEP_ACCOUNTS[asset.category];
      if (!depAcc) { skipped++; continue; } // Land or unknown
      if (asset.depreciationPostedFY?.includes(targetFY)) { skipped++; continue; }

      // WDV needs THIS asset's OWN accumulated depreciation (replayed per-asset). The
      // category ledger (accumId) holds the whole group, so using it over-/under-depreciated
      // any asset sharing a category (Audit #6). SLM is cost-based and ignores this.
      const priorAccumDep = (asset.depreciationMethod ?? 'SLM') === 'WDV'
        ? wdvAccumulatedBefore(asset, targetFY)
        : 0;

      const depAmount = calcDepForFY(asset, targetFY, priorAccumDep);
      if (depAmount <= 0) { skipped++; continue; }

      addVoucher({
        type: 'journal',
        date: depDate,
        debitAccountId:  depAcc.expenseId,
        creditAccountId: depAcc.accumId,
        amount: depAmount,
        narration: `Depreciation: ${asset.name} (${asset.assetNo}) FY ${targetFY}`,
        createdBy,
      });

      // Mark FY as posted on the asset record
      updateAsset(asset.id, {
        depreciationPostedFY: [...(asset.depreciationPostedFY ?? []), targetFY],
      });

      posted++;
    }

    return { posted, skipped };
  // addVoucher and updateAsset are stable callbacks; assets/accounts/society/user are state
  }, [assets, accounts, society, user, addVoucher, updateAsset]); // eslint-disable-line

  const getReceiptsPayments = useCallback((asOnDate?: string): ReceiptsPaymentsData => {
    const cashAccount = accounts.find(a => a.id === ACCOUNT_IDS.CASH);
    const bankIds = getBankAccountIds(accounts);
    // Sign the opening by balance type (Dr = +, Cr/overdraft = −), same as closingFor below —
    // a raw openingBalance showed an overdraft opening as a positive receipt (Audit #5).
    const signedOpening = (acc?: LedgerAccount) =>
      acc ? (acc.openingBalanceType === 'debit' ? acc.openingBalance : -acc.openingBalance) : 0;
    const openingCash = signedOpening(cashAccount);
    const openingBank = bankIds.reduce((sum, bid) => sum + signedOpening(accounts.find(a => a.id === bid)), 0);

    // ── Audit C-11/C-12: classify each R&P line by GL-head type and Capital/Revenue ──
    // NCDC Annexure VII: a Receipts & Payments Account must distinguish CAPITAL
    // receipts/payments (share capital, reserves, long-term loans, fixed assets,
    // investments, deposits) from REVENUE ones (trading, income, operating expenses,
    // trade debtors/creditors). Everything else defaults to Revenue.
    const CAPITAL_PARENTS = new Set(['1100', '1200', '2300', '3100', '3200']);
    const CAPITAL_SUBTYPES = new Set(['fixed_asset', 'investment', 'long_term_loan', 'deposit', 'accumulated_dep', 'reserve', 'surplus', 'share_capital']);
    const natureOf = (accId: string): 'capital' | 'revenue' => {
      const acc = accounts.find(a => a.id === accId);
      if (!acc) return 'revenue';
      if (acc.type === 'equity') return 'capital';
      if (acc.subtype && CAPITAL_SUBTYPES.has(acc.subtype)) return 'capital';
      if (acc.parentId && CAPITAL_PARENTS.has(acc.parentId)) return 'capital';
      return 'revenue';
    };
    const glTypeOf = (accId: string): string => accounts.find(a => a.id === accId)?.type || 'asset';

    type RPEntry = { name: string; nameHi: string; amount: number; nature: 'capital' | 'revenue'; glType: string };
    const receiptMap: Record<string, RPEntry> = {};
    const paymentMap: Record<string, RPEntry> = {};

    // M15: Honor asOnDate so historical Day Book / Balance Sheet lookups stay accurate.
    const vouchersToUse = asOnDate ? activeVouchers.filter(v => v.date <= asOnDate) : activeVouchers;
    // BUG-02 FIX: Use getVoucherLines() to handle multi-line Expert Mode vouchers.
    // For each line touching Cash/Bank, find the "other" side accounts in the same voucher.
    vouchersToUse.forEach(v => {
      const lines = getVoucherLines(v);
      const isCashBank = (id: string) => id === ACCOUNT_IDS.CASH || isBankAccount(id, accounts);
      // Did this voucher move cash/bank IN (a Dr line) and/or OUT (a Cr line)?
      const hasCashBankDr = lines.some(l => isCashBank(l.accountId) && l.type === 'Dr');
      const hasCashBankCr = lines.some(l => isCashBank(l.accountId) && l.type === 'Cr');
      if (!hasCashBankDr && !hasCashBankCr) return; // no cash/bank movement → not an R&P voucher

      // Book each NON-cash counterparty line exactly ONCE. Previously the other side was
      // re-added per cash/bank line, so a split receipt (Dr Cash 600 / Dr Bank 400 / Cr
      // Sales 1000) booked Sales twice = 2000. A non-cash Cr with cash/bank debited is a
      // receipt source; a non-cash Dr with cash/bank credited is a payment use. A pure
      // Cash↔Bank contra has no non-cash line, so it is still correctly excluded (C-11).
      // R&P is cash-basis. A voucher's NET cash movement equals (its non-cash Cr
      // legs) − (its non-cash Dr legs), because the voucher itself balances. So book
      // EVERY non-cash Cr leg as a receipt (source of funds) and EVERY non-cash Dr leg
      // as a payment (use of funds), regardless of which side cash/bank sat on. This
      // nets compound legs correctly and keeps R&P balanced. Example — an audit fee
      // paid net of TDS (Dr Audit 10,000 / Cr Bank 9,000 / Cr TDS-Payable 1,000):
      // books Audit 10,000 payment + TDS-Payable 1,000 receipt = ₹9,000 net cash, which
      // is exactly what left the bank. The earlier `&& hasCashBankDr/Cr` conditions
      // dropped the TDS leg, overstating the payment by the TDS amount and unbalancing
      // the statement. (A pure cash↔bank contra has no non-cash leg → still excluded.)
      lines.forEach(l => {
        if (isCashBank(l.accountId)) return;
        const otherAcc = accounts.find(a => a.id === l.accountId);
        const name = otherAcc?.name || v.narration || 'Deleted Account';
        const nameHi = otherAcc?.nameHi || name;
        if (l.type === 'Cr') {
          if (!receiptMap[l.accountId]) receiptMap[l.accountId] = { name, nameHi, amount: 0, nature: natureOf(l.accountId), glType: glTypeOf(l.accountId) };
          receiptMap[l.accountId].amount += l.amount;
        } else {
          if (!paymentMap[l.accountId]) paymentMap[l.accountId] = { name, nameHi, amount: 0, nature: natureOf(l.accountId), glType: glTypeOf(l.accountId) };
          paymentMap[l.accountId].amount += l.amount;
        }
      });
    });

    // M15: Compute closing balances honoring asOnDate (instead of always-current getAccountBalance).
    const closingFor = (accId: string): number => {
      const acc = accounts.find(a => a.id === accId);
      if (!acc) return 0;
      let bal = acc.openingBalanceType === 'debit' ? acc.openingBalance : -acc.openingBalance;
      vouchersToUse.forEach(v => {
        getVoucherLines(v).forEach(l => {
          if (l.accountId === accId) bal += l.type === 'Dr' ? l.amount : -l.amount;
        });
      });
      return bal;
    };
    const closingCash = closingFor(ACCOUNT_IDS.CASH);
    const closingBank = bankIds.reduce((sum, bid) => sum + closingFor(bid), 0);

    return {
      openingCash,
      openingBank,
      receipts: Object.entries(receiptMap).map(([id, v]) => ({ accountId: id, accountName: v.name, accountNameHi: v.nameHi || v.name, amount: v.amount, nature: v.nature, glType: v.glType })),
      payments: Object.entries(paymentMap).map(([id, v]) => ({ accountId: id, accountName: v.name, accountNameHi: v.nameHi || v.name, amount: v.amount, nature: v.nature, glType: v.glType })),
      closingCash,
      closingBank,
    };
  }, [accounts, vouchers, activeVouchers]);

  const getTradingAccount = useCallback((asOnDate?: string) => {
    // BS-tie fix: when no date is given, bound to the FINANCIAL-YEAR END (not "all
    // time"), so vouchers mis-dated into the next FY never leak into this year's
    // Trading A/c / Gross Profit and unbalance the Balance Sheet.
    const fyEnd = `20${society.financialYear.split('-')[1]}-03-31`;
    const effDate = asOnDate ?? fyEnd;
    // M15: Pass effDate to underlying TB so historical Trading A/c is consistent.
    const tb = getTrialBalance(effDate);
    const fy = society.financialYear;

    // Cr side: Sales / Trading Income (parentId '4100'). Signed (-nb) so a net SALES
    // RETURN (abnormal debit) reduces sales and stays consistent with the ledger
    // (BS-tie fix — Math.abs would inflate sales and break the Balance Sheet).
    const salesItems = tb
      .filter(b => b.account.parentId === '4100')
      .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: -b.netBalance }))
      .filter(i => Math.abs(i.amount) > 0.005);

    // Cr side: Closing Stock from ledger (net balance of inventory accounts under '3400').
    // Signed (not Math.max(0,..)) so an abnormal credit balance nets correctly against
    // the same account on the asset side, keeping the Balance Sheet in balance.
    const ledgerClosingItems = tb
      .filter(b => b.account.parentId === '3400')
      .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: b.netBalance }))
      .filter(i => Math.abs(i.amount) > 0.005);

    // Physical closing stock — use movement-based qty (same formula as Inventory/Stock Valuation)
    // so that orphan currentStock left over from old buggy edits/deletes doesn't show as phantom stock.
    // M15: Filter movements by effDate so historical Trading A/c matches its date window.
    const movementsToUse = stockMovements.filter(m => m.date <= effDate);
    // Value closing stock at weighted-average COST from movements (NOT the stale
    // purchaseRate field, which is 0 after some imports → silently zeroed closing stock).
    const physicalClosingStock = stockItems
      .filter(s => s.isActive)
      .reduce((sum, s) => sum + computeStockValue(s, movementsToUse), 0);

    // Check if the closing-stock journal has been posted for this FY.
    // Audit C-8: the NEW journal credits the dedicated 5150 (Purchases stay gross);
    // LEGACY journals credited 5101 (Purchases reduced — needs gross-up below).
    // Detect the posting against the SAME date window as the balances (effDate),
    // else an interim Balance Sheet before the posting date would drop closing stock.
    const closingScopedVouchers = activeVouchers.filter(v => v.date <= effDate);
    const closingViaLegacy = closingScopedVouchers.some(v =>
      getVoucherLines(v).some(l => l.accountId === '3403' && l.type === 'Dr') &&
      getVoucherLines(v).some(l => l.accountId === '5101' && l.type === 'Cr') &&
      v.narration.includes(fy)
    );
    const closingViaDedicated = closingScopedVouchers.some(v =>
      getVoucherLines(v).some(l => l.accountId === '3403' && l.type === 'Dr') &&
      getVoucherLines(v).some(l => l.accountId === '5150' && l.type === 'Cr') &&
      v.narration.includes(fy)
    );
    const closingStockPosted = closingViaLegacy || closingViaDedicated;

    // Use ledger closing stock if journals are posted; otherwise use physical stock as synthetic item
    const closingStockItems = ledgerClosingItems.length > 0
      ? ledgerClosingItems
      : physicalClosingStock > 0
        ? [{ name: 'Closing Stock (Physical)', nameHi: 'समापन माल (भौतिक)', amount: physicalClosingStock }]
        : [];

    // Dr side: Opening Stock = opening debit balances of inventory accounts
    const openingStockItems = tb
      .filter(b => b.account.parentId === '3400')
      .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: b.openingDebit }))
      .filter(i => i.amount > 0);

    const totalClosingStockEarly = closingStockItems.reduce((s, i) => s + i.amount, 0);

    // Dr side: Purchases (account 5101).
    // Audit C-8: a LEGACY closing-stock journal (Dr 3403 / Cr 5101) reduced 5101 by
    // the closing-stock value, so we GROSS IT UP to keep GP = Sales + ClosingStock −
    // Opening − GrossPurchases − DirectExp consistent. The NEW journal credits the
    // dedicated 5150 instead, leaving 5101 already gross — so no gross-up then.
    // Activity-wise purchase heads (audit C-5) belong with Purchases, not Direct
    // Expenses, so the Trading A/c lists each commodity's purchase under "Purchases".
    const PURCHASE_ACTIVITY_IDS = ['5110', '5111', '5112', '5113', '5114', '5115', '5116'];
    const purchase5101Net = (tb.find(b => b.account.id === '5101')?.netBalance) || 0;
    const purchase5101Gross = closingViaLegacy ? purchase5101Net + totalClosingStockEarly : purchase5101Net;
    // Include even when net is negative (abnormal — e.g. returns exceed purchases) so
    // the figure ties to the ledger (BS-tie fix).
    const purchaseItems = [
      ...(Math.abs(purchase5101Gross) > 0.005 ? [{ name: 'Purchase', nameHi: 'क्रय', amount: purchase5101Gross }] : []),
      ...tb.filter(b => PURCHASE_ACTIVITY_IDS.includes(b.account.id) && Math.abs(b.netBalance) > 0.005)
        .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: b.netBalance })),
    ];

    // Dr side: Direct Expenses (parentId '5100', excluding 5101 Purchase, the activity
    // purchase heads (now under Purchases), AND the 5150 Closing-Stock contra — the
    // closing stock is shown on the Cr side from the 3403 asset, so counting 5150 here
    // would double-count it). Keep signed so a credit balance nets correctly.
    const directExpItems = tb
      .filter(b => b.account.parentId === '5100' && b.account.id !== '5101' && b.account.id !== '5150' && !PURCHASE_ACTIVITY_IDS.includes(b.account.id))
      .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: b.netBalance }))
      .filter(i => Math.abs(i.amount) > 0.005);

    const totalSales        = salesItems.reduce((s, i) => s + i.amount, 0);
    const totalClosingStock = totalClosingStockEarly;
    const totalOpeningStock = openingStockItems.reduce((s, i) => s + i.amount, 0);
    const totalPurchases    = purchaseItems.reduce((s, i) => s + i.amount, 0);
    const totalDirectExp    = directExpItems.reduce((s, i) => s + i.amount, 0);

    const crTotal   = totalSales + totalClosingStock;
    const drTotal   = totalOpeningStock + totalPurchases + totalDirectExp;
    const grossProfit = crTotal - drTotal;

    // ── Audit C-7: activity-wise Trading breakdown (NCDC Annexure V) ─────────────
    // ADDITIVE — does NOT change grossProfit / the combined totals above (P&L and
    // Balance Sheet depend on them). Each commodity pairs its Sales head with its
    // Purchase head; Gross Margin = Sales − Purchases (the closing-stock adjustment
    // stays in the combined statement). Purchases still parked in the generic 5101,
    // plus non-purchase direct expenses, surface under "Unallocated" so the user can
    // see exactly which postings still need per-item activity routing.
    const nbById = (id: string) => tb.find(b => b.account.id === id)?.netBalance ?? 0;
    const ACTIVITY_DEFS: { key: string; keyHi: string; salesId: string; purchaseId: string }[] = [
      { key: 'Fertilizer',        keyHi: 'उर्वरक',            salesId: '4101', purchaseId: '5110' },
      { key: 'Seed',              keyHi: 'बीज',               salesId: '4102', purchaseId: '5111' },
      { key: 'Consumer Goods',    keyHi: 'उपभोक्ता वस्तु',    salesId: '4103', purchaseId: '5112' },
      { key: 'Pesticides',        keyHi: 'कीटनाशक',           salesId: '4104', purchaseId: '5113' },
      { key: 'Animal Feed',       keyHi: 'पशु आहार',          salesId: '4105', purchaseId: '5114' },
      { key: 'Agri Implements',   keyHi: 'कृषि यंत्र',        salesId: '4106', purchaseId: '' },
      { key: 'PDS / Ration',      keyHi: 'सार्वजनिक वितरण',   salesId: '4107', purchaseId: '5115' },
      { key: 'Govt Procurement',  keyHi: 'सरकारी खरीद',       salesId: '4108', purchaseId: '5116' },
    ];
    const activityPurchaseIds = new Set(ACTIVITY_DEFS.map(a => a.purchaseId).filter(Boolean));
    const activitySalesIds = new Set(ACTIVITY_DEFS.map(a => a.salesId));
    const activities = ACTIVITY_DEFS.map(a => {
      const sales = -nbById(a.salesId);                       // credit-nature → positive
      const purchases = a.purchaseId ? nbById(a.purchaseId) : 0; // debit-nature → positive
      const hasRoutedPurchase = Math.abs(purchases) > 0.005;
      return { key: a.key, keyHi: a.keyHi, salesId: a.salesId, purchaseId: a.purchaseId,
        sales, purchases, hasRoutedPurchase, grossMargin: sales - purchases };
    }).filter(a => Math.abs(a.sales) > 0.005 || a.hasRoutedPurchase);

    // Unallocated bucket: generic 5101 purchases + non-purchase direct expenses +
    // any 4100 sales not mapped to a defined activity.
    const unallocated = {
      purchases: nbById('5101'),
      directExp: tb.filter(b => b.account.parentId === '5100' && b.account.id !== '5101' && b.account.id !== '5150' && !activityPurchaseIds.has(b.account.id))
        .reduce((s, b) => s + b.netBalance, 0),
      otherSales: tb.filter(b => b.account.parentId === '4100' && !activitySalesIds.has(b.account.id))
        .reduce((s, b) => s + (-b.netBalance), 0),
    };

    return { salesItems, closingStockItems, openingStockItems, purchaseItems, directExpItems,
      totalSales, totalClosingStock, totalOpeningStock, totalPurchases, totalDirectExp, grossProfit,
      physicalClosingStock, closingStockPosted, activities, unallocated };
  }, [getTrialBalance, stockItems, stockMovements, activeVouchers, society.financialYear]);

  const postClosingStock = useCallback((fy?: string): { posted: boolean; amount: number; alreadyPosted: boolean } => {
    if (guardFYLocked()) return { posted: false, amount: 0, alreadyPosted: false };
    const currentFY = fy ?? society.financialYear;
    // Check if already posted — accept the NEW (Cr 5150) or LEGACY (Cr 5101) journal.
    const alreadyPosted = activeVouchers.some(v =>
      getVoucherLines(v).some(l => l.accountId === '3403' && l.type === 'Dr') &&
      getVoucherLines(v).some(l => (l.accountId === '5150' || l.accountId === '5101') && l.type === 'Cr') &&
      v.narration.includes(currentFY)
    );
    if (alreadyPosted) return { posted: false, amount: 0, alreadyPosted: true };

    // Use movement-based qty (same formula as Inventory / Stock Valuation / Trading Account)
    // so the journal posts the same number user sees in reports.
    const amount = stockItems
      .filter(s => s.isActive)
      .reduce((sum, s) => sum + computeStockValue(s, stockMovements), 0);

    if (amount <= 0) return { posted: false, amount: 0, alreadyPosted: false };

    addVoucher({
      type: 'journal',
      date: new Date().toISOString().split('T')[0],
      debitAccountId: '3403',   // Trading Goods inventory (Balance Sheet asset)
      creditAccountId: '5150',  // Audit C-8: dedicated Closing Stock A/c — keeps Purchases (5101) gross
      amount,
      narration: `Closing Stock at year end — FY ${currentFY}`,
      createdBy: user?.name ?? 'System',
    });
    return { posted: true, amount, alreadyPosted: false };
  }, [stockItems, stockMovements, activeVouchers, society.financialYear, addVoucher, user?.name]);

  const getProfitLoss = useCallback((asOnDate?: string) => {
    // BS-tie fix: default to the FINANCIAL-YEAR END so a voucher mis-dated into the
    // next FY can't inflate this year's surplus (which would unbalance the Balance
    // Sheet, whose asset side is correctly date-filtered).
    const fyEnd = `20${society.financialYear.split('-')[1]}-03-31`;
    const effDate = asOnDate ?? fyEnd;
    // M15: Pass effDate to underlying TB so historical P&L is accurate.
    const tb = getTrialBalance(effDate);

    // Indian Cooperative Act: a TRADING Account is only meaningful for goods-trading
    // societies (those entitled to inventory_sales). Service societies (housing, labour,
    // …) have no trading — their 4100/5100 heads are ordinary income/expense and must
    // appear DIRECTLY in Income & Expenditure (no Trading A/c, no Gross-Profit bridge).
    const hasTrading = resolveCapabilities(society.societyType ?? 'other', societyCapabilities).has('inventory_sales');

    // ── Audit C-9: NCDC two-statement structure (Trading A/c → P&L/I&E) ──────
    // Per NCDC Annexure II + III, trading heads (Sales, Purchases, direct expenses,
    // opening/closing stock) are absorbed into the TRADING ACCOUNT, and only the
    // resulting GROSS PROFIT (or Gross Loss) flows into the P&L/I&E. Previously
    // getProfitLoss summed Sales (4100) as income and Purchases/direct-exp (5100)
    // as expense DIRECTLY — which (a) ignored closing stock (unsold inventory wrongly
    // treated as a full expense) and (b) never showed the Trading Gross Profit line.
    // Fix: exclude trading heads here and inject the single Gross Profit line.
    const isTradingIncome  = (parentId?: string) => parentId === '4100';            // Sales / Trading Income
    const isTradingExpense = (parentId?: string) => parentId === '5100';            // Purchases + Direct Expenses

    // Indirect (non-trading) INCOME — commission, scheme income, interest, rent,
    // admission fee, misc. (credit-nature: abs(netBalance) is the income amount).
    // Use signed (-netBalance) NOT Math.abs: income accounts are credit-nature so
    // -nb is the positive income amount, but an account carrying an abnormal DEBIT
    // balance (refund/over-credit) must REDUCE income — and must net to the same
    // figure the ledger holds, otherwise the Balance Sheet won't tie. (BS-tie fix.)
    const incomeItems = tb
      .filter(b => b.account.type === 'income' && (!hasTrading || !isTradingIncome(b.account.parentId)) && b.netBalance !== 0)
      .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: -b.netBalance }));

    // Indirect (operating) EXPENSES — establishment, admin, depreciation, statutory.
    // P2-4: keep sign so a Cr balance (refund/over-credit) REDUCES total expenses.
    const expenseItems = tb
      .filter(b => b.account.type === 'expense' && (!hasTrading || !isTradingExpense(b.account.parentId)) && b.netBalance !== 0)
      .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: b.netBalance }));

    // Bridge line from the Trading Account (Annexure III opens P&L Cr side with it).
    // Service societies (no trading) skip this — their 4100/5100 are already included above.
    if (hasTrading) {
      const trading = getTradingAccount(effDate);
      const gp = trading.grossProfit;
      if (gp > 0.005) {
        incomeItems.unshift({ name: 'Gross Profit from Trading', nameHi: 'व्यापार से सकल लाभ', amount: gp });
      } else if (gp < -0.005) {
        expenseItems.unshift({ name: 'Gross Loss from Trading', nameHi: 'व्यापार से सकल हानि', amount: Math.abs(gp) });
      }
    }

    const totalIncome = incomeItems.reduce((s, i) => s + i.amount, 0);
    const totalExpenses = expenseItems.reduce((s, i) => s + i.amount, 0);
    return { incomeItems, expenseItems, totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses };
  }, [getTrialBalance, getTradingAccount, society.financialYear, society.societyType, societyCapabilities]);

  // ── Inventory ──────────────────────────────────────────────────────────────
  // Two-step stock_items save pattern (same as purchases for GST/TDS columns):
  // Step 1: upsert base columns only — schema cache always knows these, never fails.
  // Step 2: update the late-added columns (stockGroup, salesAccountId, purchaseAccountId,
  // p4Category, valuationMethod) separately. If user hasn't run the ALTER TABLE migration
  // yet, only step 2 fails — local state stays consistent and base save still works.
  const persistStockItem = (item: StockItem, opts?: { onBaseFail?: () => void }) => {
    const { salesAccountId, purchaseAccountId, stockGroup, p4Category, valuationMethod, ...baseCols } = item;
    supabase.from('stock_items').upsert(withSoc(baseCols)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        opts?.onBaseFail?.();   // RULE 1: roll back local state
        toastRef.current({ title: 'स्टॉक आइटम सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara save karein.`, variant: 'destructive', duration: 12000 });
        return;
      }
      const extras: Record<string, unknown> = {};
      if (salesAccountId !== undefined) extras.salesAccountId = salesAccountId || null;
      if (purchaseAccountId !== undefined) extras.purchaseAccountId = purchaseAccountId || null;
      if (stockGroup !== undefined) extras.stockGroup = stockGroup || null;
      if (p4Category !== undefined) extras.p4Category = p4Category || null;
      if (valuationMethod !== undefined) extras.valuationMethod = valuationMethod || null;
      if (Object.keys(extras).length === 0) return;
      supabase.from('stock_items').update(extras).eq('id', item.id)
        .then(({ error: extraErr }) => {
          if (extraErr) {
            console.warn('Stock item extras update (run ALTER TABLE if column missing):', extraErr.message);
            // Show a milder warning instead of "Save failed" so the user knows save partially worked
            toastRef.current({
              title: 'Saved, but A/c routing not persisted',
              description: `${extraErr.message}. Run the latest supabase-tables.sql migration to enable A/c routing columns.`,
              variant: 'default',
            });
          }
        });
    });
  };

  const addStockItem = useCallback((data: Omit<StockItem, 'id' | 'itemCode'>): StockItem => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as StockItem;
    // Derive next item code from existing items (not localStorage counter) to prevent duplicates
    let newItem: StockItem;
    setStockItemsState(prev => {
      const maxNum = prev.reduce((max, i) => {
        const m = i.itemCode?.match(/ITM\/(\d+)/);
        return m ? Math.max(max, parseInt(m[1])) : max;
      }, 0);
      const itemCode = `ITM/${String(maxNum + 1).padStart(3, '0')}`;
      newItem = { ...data, id: crypto.randomUUID(), itemCode };
      persistStockItem(newItem, { onBaseFail: () => setStockItemsState(p => p.filter(i => i.id !== newItem.id)) });
      return [...prev, newItem];
    });
    return newItem!;
  }, []);

  const updateStockItem = useCallback((id: string, data: Partial<StockItem>) => {
    if (guardFYLocked()) return;
    setStockItemsState(prev => {
      const before = prev.find(i => i.id === id);
      const updated = prev.map(i => i.id === id ? { ...i, ...data } : i);
      const updatedItem = updated.find(i => i.id === id);
      if (updatedItem && before) persistStockItem(updatedItem, { onBaseFail: () => setStockItemsState(p => p.map(i => i.id === id ? before : i)) });
      return updated;
    });
  }, []);

  const deleteStockItem = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const today = new Date().toISOString().split('T')[0];
    setStockItemsState(prev => {
      const item = prev.find(i => i.id === id);
      // Write-off uses the AUTHORITATIVE movement-based qty (RULE 2), not the cached
      // currentStock field — which can be stale after a purchase edit/delete and would
      // otherwise create a phantom write-off journal for stock that no longer exists.
      const realQty = item ? computeStock(item, stockMovementsRef.current) : 0;
      // Value the write-off at weighted-average COST from movements (RULE 2), not the
      // stale purchaseRate field — else deleting an item whose purchaseRate is 0 would
      // post a ₹0 write-off and leave its closing-stock asset on the books forever.
      const costRate = item ? computeStockCostRate(item, stockMovementsRef.current) : 0;
      if (item && item.isActive && realQty > 0) {
        const amount = Math.round(realQty * costRate * 100) / 100;
        if (amount > 0) {
          // Dr 5101 (Purchases/Write-off expense) / Cr 3403 (Closing Stock asset) — reverses closing stock asset
          addVoucher({
            type: 'journal',
            date: today,
            debitAccountId: '5101',
            creditAccountId: '3403',
            amount,
            narration: `Stock write-off on deletion: ${item.name} (${realQty} ${item.unit} @ ₹${costRate.toFixed(2)})`,
            createdBy: user?.name ?? 'System',
          });
        }
      }
      // Soft-delete: mark inactive, zero out stock (preserve history)
      const updated = prev.map(i => i.id === id ? { ...i, isActive: false, currentStock: 0 } : i);
      return updated;
    });
    // Also remove orphaned stock movements for this item
    setStockMovementsState(prev => {
      const updated = prev.filter(m => m.itemId !== id);
      return updated;
    });
    supabase.from('stock_items').update({ isActive: false, currentStock: 0 }).eq('id', id)
      .then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    supabase.from('stock_movements').delete().eq('itemId', id)
      .then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    console.info(`[AUDIT-DELETE] StockItem id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, [addVoucher, user?.name]);

  const addStockMovement = useCallback((data: Omit<StockMovement, 'id' | 'createdAt'>) => {
    if (guardFYLocked()) return;
    const movement: StockMovement = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    stockMovementsRef.current = [...stockMovementsRef.current, movement];
    setStockMovementsState(prev => [...prev, movement]);
    supabase.from('stock_movements').upsert(withSoc(movement)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        stockMovementsRef.current = stockMovementsRef.current.filter(m => m.id !== movement.id);
        setStockMovementsState(prev => prev.filter(m => m.id !== movement.id));   // RULE 1: roll back
        toastRef.current({ title: 'स्टॉक मूवमेंट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 });
      }
    });

    // Recompute currentStock from openingStock + ALL movements (authoritative — prevents drift
    // from past partial-sync failures or manual adjustments). Same formula as Inventory page.
    const allMovs = stockMovementsRef.current;
    setStockItemsState(prev => prev.map(i => {
      if (i.id !== data.itemId) return i;
      let qty = i.openingStock || 0;
      for (const m of allMovs) {
        if (m.itemId !== i.id) continue;
        if (m.type === 'purchase' || (m.type === 'adjustment' && m.qty > 0)) qty += m.qty;
        else qty -= Math.abs(m.qty);
      }
      qty = Math.max(0, qty);
      supabase.from('stock_items').update({ currentStock: qty }).eq('id', i.id).then(({ error }) => { if (error) { console.error('Stock currentStock sync error:', error.message); toastRef.current({ title: 'Stock update failed', description: error.message, variant: 'destructive' }); } });
      return { ...i, currentStock: qty };
    }));
  }, []);

  // ── Sales ──────────────────────────────────────────────────────────────────
  const addSale = useCallback((data: Omit<Sale, 'id' | 'saleNo' | 'createdAt'>): Sale => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as Sale;
    // Enforce per-item Sales A/c (group): block posting if any STOCK item being
    // sold has no salesAccountId, so sales never silently fall back to '4101'.
    const unmappedNames = data.items
      .map(it => stockItems.find(s => s.id === it.itemId))
      .filter((s): s is NonNullable<typeof s> => !!s && !s.salesAccountId)
      .map(s => s.name);
    if (unmappedNames.length > 0) {
      throw new Error(
        `इन वस्तुओं को पहले बिक्री खाता (group) असाइन करें: ${unmappedNames.join(', ')} — फिर बिक्री पोस्ट होगी। (Assign a Sales A/c to: ${unmappedNames.join(', ')})`
      );
    }

    const fy = society.financialYear;
    const maxSaleNum = salesRef.current.filter(s => s.saleNo?.includes(fy)).reduce((max, s) => {
      const m = s.saleNo?.match(/\/(\d+)$/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const saleNo = `SL/${fy}/${String(maxSaleNum + 1).padStart(3, '0')}`;
    const grandTotal = data.grandTotal ?? data.netAmount;
    const lid = () => crypto.randomUUID();

    // Build multi-line sale voucher (ONE voucher covers everything)
    const lines: VoucherLine[] = [];

    // Dr: Cash / Bank / Debtor for grand total
    const debitAccId = data.paymentMode === 'cash' ? ACCOUNT_IDS.CASH
      : data.paymentMode === 'bank' ? (data.bankAccountId || getBankAccountIds(accounts)[0] || ACCOUNT_IDS.BANK)
      : (data.customerId ? (customers.find(c => c.id === data.customerId)?.accountId || '3303') : '3303');
    lines.push({ id: lid(), accountId: debitAccId, type: 'Dr', amount: grandTotal });

    // Cr: Sales A/c — split by each item's salesAccountId so multi-product societies
    // get per-category lines in TB / Trading A/c. Falls back to '4101' for unmapped items.
    const netAmt = data.netAmount || (grandTotal - (data.taxAmount || 0));
    if (netAmt > 0) {
      const totalItemAmount = data.items.reduce((s, it) => s + it.amount, 0) || 1;
      const salesAccBuckets = new Map<string, number>();
      data.items.forEach(it => {
        const stock = stockItems.find(s => s.id === it.itemId);
        const acc = stock?.salesAccountId || '4101';
        // Pro-rate net amount by item value share (handles discount + tax-exclusive routing)
        const itemNet = (it.amount / totalItemAmount) * netAmt;
        salesAccBuckets.set(acc, (salesAccBuckets.get(acc) || 0) + itemNet);
      });
      salesAccBuckets.forEach((amt, accId) => {
        const rounded = Math.round(amt * 100) / 100;
        if (rounded > 0) lines.push({ id: lid(), accountId: accId, type: 'Cr', amount: rounded });
      });
    }

    // Cr: GST Output Payable (2201) for tax amount
    if ((data.taxAmount ?? 0) > 0) {
      lines.push({ id: lid(), accountId: '2201', type: 'Cr', amount: data.taxAmount!, narration: `GST: CGST ₹${data.cgstAmount||0} + SGST ₹${data.sgstAmount||0} + IGST ₹${data.igstAmount||0}` });
    }

    const vType = data.paymentMode === 'credit' ? 'sale' : 'receipt';
    const saleId = lid();
    const newVoucher = addVoucher({
      type: vType,
      date: data.date,
      lines,
      debitAccountId: debitAccId,
      creditAccountId: '4101',
      amount: grandTotal,
      narration: data.narration || `Sale: ${data.customerName} — ${saleNo}`,
      createdBy: data.createdBy,
      refType: 'sale',
      refId: saleId,
    });

    // Stock movements
    data.items.forEach(item => {
      setStockItemsState(prev => {
        const updated = prev.map(i => {
          if (i.id !== item.itemId) return i;
          const newStock = Math.max(0, i.currentStock - item.qty);
          supabase.from('stock_items').update({ currentStock: newStock }).eq('id', i.id)
            .then(({ error }) => { if (error) { console.error('Stock sync error:', error.message); toastRef.current({ title: 'Stock save failed', description: error.message, variant: 'destructive' }); } });
          return { ...i, currentStock: newStock };
        });
        return updated;
      });
      const mv: StockMovement = { id: lid(), date: data.date, itemId: item.itemId, type: 'sale', qty: item.qty, rate: item.rate, amount: item.amount, referenceNo: saleNo, narration: `Sale to ${data.customerName}`, createdAt: new Date().toISOString() };
      setStockMovementsState(prev => [...prev, mv]);
      supabase.from('stock_movements').upsert(withSoc(mv)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    });

    const sale: Sale = { ...data, id: saleId, saleNo, voucherId: newVoucher.id, gstVoucherIds: undefined, createdAt: new Date().toISOString() };
    salesRef.current = [...salesRef.current, sale];
    setSalesState(prev => [...prev, sale]);

    // Two-step save — same pattern as purchases fix:
    // Step 1: upsert base columns only (schema cache always knows these)
    // Step 2: update GST columns separately (ALTER TABLE columns — schema cache may lag)
    const { cgstPct: sCgst, sgstPct: sSgst, igstPct: sIgst, cgstAmount: sCgstA, sgstAmount: sSgstA, igstAmount: sIgstA, taxAmount: sTaxA, grandTotal: sGrand, customerId, gstVoucherIds: _gv, ...saleBase } = sale;
    supabase.from('sales').upsert(withSoc(saleBase)).then(({ error }) => {
      if (error) {
        console.error('Sale save failed:', error.message);
        salesRef.current = salesRef.current.filter(s => s.id !== sale.id);
        setSalesState(prev => prev.filter(s => s.id !== sale.id));
        toastRef.current({ title: 'Sale save nahi hua', description: error.message, variant: 'destructive' });
      } else {
        // Step 2: GST columns update (only Sale GST fields — no TDS for sales)
        supabase.from('sales').update({ cgstPct: sCgst, sgstPct: sSgst, igstPct: sIgst, cgstAmount: sCgstA, sgstAmount: sSgstA, igstAmount: sIgstA, taxAmount: sTaxA, grandTotal: sGrand, customerId })
          .eq('id', sale.id)
          .then(({ error: gstErr }) => { if (gstErr) console.warn('Sale GST fields update:', gstErr.message); });
      }
    });
    return sale;
  }, [society.financialYear, customers, accounts, addVoucher, stockItems]);

  const deleteSale = useCallback((id: string) => {
    if (guardFYLocked()) return;
    setSalesState(prev => {
      const sale = prev.find(s => s.id === id);
      if (sale) {
        const now = new Date().toISOString();
        // Soft-delete all linked vouchers (main + GST)
        const linkedIds = ([sale.voucherId, ...(sale.gstVoucherIds ?? [])].filter(Boolean) as string[]).filter(vid => !isEngineVoucher(vouchersRef.current.find(v => v.id === vid)));
        if (linkedIds.length > 0) {
          setVouchersState(v => {
            const updated = v.map(x => linkedIds.includes(x.id)
              ? { ...x, isDeleted: true, deletedAt: now, deletedBy: 'System', deletedReason: `Sale ${sale.saleNo} deleted` }
              : x
            );
            linkedIds.forEach(vid => {
              const cancelled = updated.find(x => x.id === vid);
              if (cancelled) supabase.from('vouchers').update({ isDeleted: true, deletedAt: cancelled.deletedAt, deletedBy: cancelled.deletedBy, deletedReason: cancelled.deletedReason }).eq('id', vid).then(({ error }) => {
                if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); }
                else deleteEntries(vid); // cascade: remove from voucher_entries so SQL reports see the cancellation
              });
            });
            return updated;
          });
        }
        // Reverse stock deductions on stock_items.currentStock
        sale.items.forEach(item => {
          setStockItemsState(s => {
            const updated = s.map(i => { if (i.id !== item.itemId) return i; const newStock = i.currentStock + item.qty; supabase.from('stock_items').update({ currentStock: newStock }).eq('id', i.id).then(({ error }) => { if (error) { console.error('Stock currentStock sync error:', error.message); toastRef.current({ title: 'Stock update failed', description: error.message, variant: 'destructive' }); } }); return { ...i, currentStock: newStock }; });
            return updated;
          });
        });
        // Cascade-delete stock_movements for this sale
        // (Inventory / Stock Valuation / Closing Stock all derive qty from movements.)
        setStockMovementsState(s => s.filter(m => m.referenceNo !== sale.saleNo));
        supabase.from('stock_movements').delete().eq('referenceNo', sale.saleNo)
          .then(({ error }) => { if (error) console.error('Movements cascade-delete sync:', error.message); });
      }
      const updated = prev.filter(s => s.id !== id);
      return updated;
    });
    supabase.from('sales').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    console.info(`[AUDIT-DELETE] Sale id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, []);

  const updateSale = useCallback((id: string, data: Omit<Sale, 'id' | 'saleNo' | 'createdAt'>): Sale | null => {
    if (guardFYLocked()) return null;
    // Enforce per-item Sales A/c (group) BEFORE mutating anything (no data loss).
    const unmappedNames = data.items
      .map(it => stockItems.find(s => s.id === it.itemId))
      .filter((s): s is NonNullable<typeof s> => !!s && !s.salesAccountId)
      .map(s => s.name);
    if (unmappedNames.length > 0) {
      toastRef.current({
        title: 'बिक्री खाता आवश्यक',
        description: `इन वस्तुओं को पहले बिक्री खाता (group) असाइन करें: ${unmappedNames.join(', ')}`,
        variant: 'destructive',
        duration: 10000,
      });
      return null;
    }
    const original = salesRef.current.find(s => s.id === id);
    if (!original) {
      toastRef.current({ title: 'Sale not found', variant: 'destructive' });
      return null;
    }

    const now = new Date().toISOString();
    const lid = () => crypto.randomUUID();

    // 1️⃣ Compute net stock delta (sale REDUCES stock — revert old qty adds back, new qty subtracts).
    const stockDelta = new Map<string, number>();
    original.items.forEach(item => {
      stockDelta.set(item.itemId, (stockDelta.get(item.itemId) || 0) + item.qty); // revert old sale → add back
    });
    data.items.forEach(item => {
      stockDelta.set(item.itemId, (stockDelta.get(item.itemId) || 0) - item.qty); // new sale → subtract
    });

    setStockItemsState(prev => prev.map(i => {
      const delta = stockDelta.get(i.id);
      if (delta == null || delta === 0) return i;
      const newStock = Math.max(0, i.currentStock + delta);
      supabase.from('stock_items').update({ currentStock: newStock }).eq('id', i.id)
        .then(({ error }) => { if (error) console.error('Stock update sync:', error.message); });
      return { ...i, currentStock: newStock };
    }));

    // 1b: Delete old stock_movements rows for this sale (so movement sum stays correct).
    setStockMovementsState(prev => prev.filter(m => m.referenceNo !== original.saleNo));
    supabase.from('stock_movements').delete().eq('referenceNo', original.saleNo)
      .then(({ error }) => { if (error) console.error('Old movements delete sync:', error.message); });

    // 2️⃣ Soft-cancel the original sale voucher(s) + drop voucher_entries
    const linkedIds = ([original.voucherId, ...(original.gstVoucherIds ?? [])].filter(Boolean) as string[]).filter(vid => !isEngineVoucher(vouchersRef.current.find(v => v.id === vid)));
    if (linkedIds.length > 0) {
      setVouchersState(v => {
        const updated = v.map(x => linkedIds.includes(x.id)
          ? { ...x, isDeleted: true, deletedAt: now, deletedBy: data.createdBy || 'System', deletedReason: `Sale ${original.saleNo} edited` }
          : x
        );
        linkedIds.forEach(vid => {
          const cancelled = updated.find(x => x.id === vid);
          if (cancelled) supabase.from('vouchers').update({ isDeleted: true, deletedAt: cancelled.deletedAt, deletedBy: cancelled.deletedBy, deletedReason: cancelled.deletedReason }).eq('id', vid).then(({ error }) => {
            if (error) console.error('Voucher cancel sync:', error.message);
            else deleteEntries(vid);
          });
        });
        return updated;
      });
    }

    // 3️⃣ Build fresh voucher lines from new data
    const grandTotal = data.grandTotal ?? data.netAmount;
    const lines: VoucherLine[] = [];
    const debitAccId = data.paymentMode === 'cash' ? ACCOUNT_IDS.CASH
      : data.paymentMode === 'bank' ? (data.bankAccountId || getBankAccountIds(accounts)[0] || ACCOUNT_IDS.BANK)
      : (data.customerId ? (customers.find(c => c.id === data.customerId)?.accountId || '3303') : '3303');
    lines.push({ id: lid(), accountId: debitAccId, type: 'Dr', amount: grandTotal });

    const netAmt = data.netAmount || (grandTotal - (data.taxAmount || 0));
    if (netAmt > 0) {
      // Split by each item's salesAccountId (same logic as addSale)
      const totalItemAmount = data.items.reduce((s, it) => s + it.amount, 0) || 1;
      const salesAccBuckets = new Map<string, number>();
      data.items.forEach(it => {
        const stock = stockItems.find(s => s.id === it.itemId);
        const acc = stock?.salesAccountId || '4101';
        const itemNet = (it.amount / totalItemAmount) * netAmt;
        salesAccBuckets.set(acc, (salesAccBuckets.get(acc) || 0) + itemNet);
      });
      salesAccBuckets.forEach((amt, accId) => {
        const rounded = Math.round(amt * 100) / 100;
        if (rounded > 0) lines.push({ id: lid(), accountId: accId, type: 'Cr', amount: rounded });
      });
    }
    if ((data.taxAmount ?? 0) > 0) {
      lines.push({ id: lid(), accountId: '2201', type: 'Cr', amount: data.taxAmount!, narration: `GST: CGST ₹${data.cgstAmount||0} + SGST ₹${data.sgstAmount||0} + IGST ₹${data.igstAmount||0}` });
    }

    const vType = data.paymentMode === 'credit' ? 'sale' : 'receipt';
    const newVoucher = addVoucher({
      type: vType,
      date: data.date,
      lines,
      debitAccountId: debitAccId,
      creditAccountId: '4101',
      amount: grandTotal,
      narration: data.narration || `Sale: ${data.customerName} — ${original.saleNo}`,
      createdBy: data.createdBy,
      refType: 'sale',
      refId: id,
    });

    // 4️⃣ Add fresh stock_movement rows for the edited sale
    data.items.forEach(item => {
      const mv: StockMovement = { id: lid(), date: data.date, itemId: item.itemId, type: 'sale', qty: item.qty, rate: item.rate, amount: item.amount, referenceNo: original.saleNo, narration: `Sale to ${data.customerName} (edited)`, createdAt: now };
      setStockMovementsState(prev => [...prev, mv]);
      supabase.from('stock_movements').upsert(withSoc(mv)).then(({ error }) => { if (error) console.error('Movement upsert sync:', error.message); });
    });

    // 5️⃣ Update the sale record in place (same id + saleNo)
    const updated: Sale = {
      ...data,
      id,
      saleNo: original.saleNo,
      voucherId: newVoucher.id,
      gstVoucherIds: undefined,
      createdAt: original.createdAt,
    };
    salesRef.current = salesRef.current.map(s => s.id === id ? updated : s);
    setSalesState(prev => prev.map(s => s.id === id ? updated : s));

    const { cgstPct: sCgst, sgstPct: sSgst, igstPct: sIgst, cgstAmount: sCgstA, sgstAmount: sSgstA, igstAmount: sIgstA, taxAmount: sTaxA, grandTotal: sGrand, customerId, gstVoucherIds: _gv, ...saleBase } = updated;
    supabase.from('sales').upsert(withSoc(saleBase)).then(({ error }) => {
      if (error) {
        console.error('Sale update failed:', error.message);
        toastRef.current({ title: 'Sale update nahi hua', description: error.message, variant: 'destructive' });
      } else {
        supabase.from('sales').update({ cgstPct: sCgst, sgstPct: sSgst, igstPct: sIgst, cgstAmount: sCgstA, sgstAmount: sSgstA, igstAmount: sIgstA, taxAmount: sTaxA, grandTotal: sGrand, customerId })
          .eq('id', id)
          .then(({ error: gstErr }) => { if (gstErr) console.warn('Sale GST fields update:', gstErr.message); });
      }
    });

    console.info(`[AUDIT-EDIT] Sale id=${id} edited by ${data.createdBy || 'unknown'} at ${now}`);
    return updated;
  }, [society.fyLocked, customers, accounts, addVoucher, stockItems]);

  // ── Purchases ──────────────────────────────────────────────────────────────
  const addPurchase = useCallback((data: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt'>): Purchase => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as Purchase;
    // Enforce per-item Purchase A/c (group): block posting if any STOCK item being
    // purchased has no purchaseAccountId, so purchases never silently fall to '5101'.
    const unmappedNames = data.items
      .map(it => stockItems.find(s => s.id === it.itemId))
      .filter((s): s is NonNullable<typeof s> => !!s && !s.purchaseAccountId)
      .map(s => s.name);
    if (unmappedNames.length > 0) {
      throw new Error(
        `इन वस्तुओं को पहले खरीद खाता (group) असाइन करें: ${unmappedNames.join(', ')} — फिर खरीद पोस्ट होगी। (Assign a Purchase A/c to: ${unmappedNames.join(', ')})`
      );
    }

    const fy = society.financialYear;
    const maxPurNum = purchasesRef.current.filter(p => p.purchaseNo?.includes(fy)).reduce((max, p) => {
      const m = p.purchaseNo?.match(/\/(\d+)$/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const purchaseNo = `PUR/${fy}/${String(maxPurNum + 1).padStart(3, '0')}`;
    const grandTotal = data.grandTotal ?? data.netAmount;
    const lid = () => crypto.randomUUID();

    // Build multi-line purchase voucher
    const lines: VoucherLine[] = [];
    const supplierAccId = data.supplierId ? (suppliers.find(s => s.id === data.supplierId)?.accountId || '2101') : '2101';
    const creditAccId = data.paymentMode === 'cash' ? ACCOUNT_IDS.CASH
      : data.paymentMode === 'bank' ? (data.bankAccountId || getBankAccountIds(accounts)[0] || ACCOUNT_IDS.BANK)
      : supplierAccId;

    // Dr: Purchases A/c — split by each item's purchaseAccountId so multi-product
    // societies get per-category lines. Falls back to '5101' for unmapped items.
    const netAmt = data.netAmount || (grandTotal - (data.taxAmount || 0) + (data.tdsAmount || 0));
    if (netAmt > 0) {
      const totalItemAmount = data.items.reduce((s, it) => s + it.amount, 0) || 1;
      const purchaseAccBuckets = new Map<string, number>();
      data.items.forEach(it => {
        const stock = stockItems.find(s => s.id === it.itemId);
        const acc = stock?.purchaseAccountId || '5101';
        const itemNet = (it.amount / totalItemAmount) * netAmt;
        purchaseAccBuckets.set(acc, (purchaseAccBuckets.get(acc) || 0) + itemNet);
      });
      purchaseAccBuckets.forEach((amt, accId) => {
        const rounded = Math.round(amt * 100) / 100;
        if (rounded > 0) lines.push({ id: lid(), accountId: accId, type: 'Dr', amount: rounded });
      });
    }

    // Dr: GST Input Credit (3310) for tax amount
    if ((data.taxAmount ?? 0) > 0) {
      lines.push({ id: lid(), accountId: '3310', type: 'Dr', amount: data.taxAmount!, narration: `GST ITC: CGST ₹${data.cgstAmount||0} + SGST ₹${data.sgstAmount||0} + IGST ₹${data.igstAmount||0}` });
    }

    // Cr: Cash / Bank / Supplier for net payable (grandTotal - tdsAmount)
    const netPayable = grandTotal;  // grandTotal already nets TDS (= netAmount + tax − TDS)
    if (netPayable > 0) {
      lines.push({ id: lid(), accountId: creditAccId, type: 'Cr', amount: netPayable });
    }

    // Cr: TDS Payable (2202) for TDS amount
    if ((data.tdsAmount ?? 0) > 0) {
      lines.push({ id: lid(), accountId: '2202', type: 'Cr', amount: data.tdsAmount!, narration: `TDS ${data.tdsPct||0}%` });
    }

    const vType = data.paymentMode === 'credit' ? 'purchase' : 'payment';
    const purchaseId = lid();
    const newVoucher = addVoucher({
      type: vType,
      date: data.date,
      lines,
      debitAccountId: '5101',
      creditAccountId: creditAccId,
      amount: grandTotal,
      narration: data.narration || `Purchase: ${data.supplierName} — ${purchaseNo}`,
      createdBy: data.createdBy,
      refType: 'purchase',
      refId: purchaseId,
    });

    // Stock movements
    data.items.forEach(item => {
      setStockItemsState(prev => {
        const updated = prev.map(i => {
          if (i.id !== item.itemId) return i;
          const newStock = i.currentStock + item.qty;
          supabase.from('stock_items').update({ currentStock: newStock, purchaseRate: item.rate }).eq('id', i.id)
            .then(({ error }) => { if (error) { console.error('Stock sync error:', error.message); toastRef.current({ title: 'Stock save failed', description: error.message, variant: 'destructive' }); } });
          return { ...i, currentStock: newStock, purchaseRate: item.rate };
        });
        return updated;
      });
      const mv: StockMovement = { id: lid(), date: data.date, itemId: item.itemId, type: 'purchase', qty: item.qty, rate: item.rate, amount: item.amount, referenceNo: purchaseNo, narration: `Purchase from ${data.supplierName}`, createdAt: new Date().toISOString() };
      setStockMovementsState(prev => [...prev, mv]);
      supabase.from('stock_movements').upsert(withSoc(mv)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    });

    const purchase: Purchase = { ...data, id: purchaseId, purchaseNo, voucherId: newVoucher.id, taxVoucherIds: undefined, createdAt: new Date().toISOString() };
    purchasesRef.current = [...purchasesRef.current, purchase];
    setPurchasesState(prev => [...prev, purchase]);

    // Two-step save — same pattern as editHistory fix for vouchers:
    // Step 1: upsert ONLY the original-table base columns (schema cache always knows these → never fails)
    // Step 2: update GST/TDS columns separately (added via ALTER TABLE — schema cache may lag)
    const { cgstPct: pCgstPct, sgstPct: pSgstPct, igstPct: pIgstPct, tdsPct: pTdsPct, cgstAmount: pCgstAmt, sgstAmount: pSgstAmt, igstAmount: pIgstAmt, tdsAmount: pTdsAmt, taxAmount: pTaxAmt, grandTotal: pGrandTotal, supplierId: pSupplierId, taxVoucherIds: _tv, ...purchaseBase } = purchase;
    supabase.from('purchases').upsert(withSoc(purchaseBase)).then(({ error }) => {
      if (error) {
        console.error('Purchase save failed:', error.message);
        purchasesRef.current = purchasesRef.current.filter(p => p.id !== purchase.id);
        setPurchasesState(prev => prev.filter(p => p.id !== purchase.id));
        toastRef.current({ title: 'Purchase save nahi hua', description: error.message, variant: 'destructive' });
      } else {
        // Step 2: GST/TDS columns update (safe — if this fails, base record is already saved)
        supabase.from('purchases').update({ cgstPct: pCgstPct, sgstPct: pSgstPct, igstPct: pIgstPct, tdsPct: pTdsPct, cgstAmount: pCgstAmt, sgstAmount: pSgstAmt, igstAmount: pIgstAmt, tdsAmount: pTdsAmt, taxAmount: pTaxAmt, grandTotal: pGrandTotal, supplierId: pSupplierId })
          .eq('id', purchase.id)
          .then(({ error: gstErr }) => { if (gstErr) console.warn('Purchase GST fields update:', gstErr.message); });
      }
    });
    return purchase;
  }, [society.financialYear, suppliers, accounts, addVoucher, stockItems]);

  const deletePurchase = useCallback((id: string) => {
    if (guardFYLocked()) return;
    setPurchasesState(prev => {
      const purchase = prev.find(p => p.id === id);
      if (purchase) {
        const now = new Date().toISOString();
        // Cascade soft-delete: main voucher + all GST/TDS tax vouchers
        const linkedIds = ([purchase.voucherId, ...(purchase.taxVoucherIds ?? [])].filter(Boolean) as string[]).filter(vid => !isEngineVoucher(vouchersRef.current.find(v => v.id === vid)));
        if (linkedIds.length > 0) {
          setVouchersState(v => {
            const updated = v.map(x => linkedIds.includes(x.id)
              ? { ...x, isDeleted: true, deletedAt: now, deletedBy: 'System', deletedReason: `Purchase ${purchase.purchaseNo} deleted` }
              : x
            );
            linkedIds.forEach(vid => {
              const cancelled = updated.find(x => x.id === vid);
              if (cancelled) supabase.from('vouchers').update({ isDeleted: true, deletedAt: cancelled.deletedAt, deletedBy: cancelled.deletedBy, deletedReason: cancelled.deletedReason }).eq('id', vid).then(({ error }) => {
                if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); }
                else deleteEntries(vid); // cascade: remove from voucher_entries so SQL reports see the cancellation
              });
            });
            return updated;
          });
        }
        // Reverse stock additions on stock_items.currentStock
        purchase.items.forEach(item => {
          setStockItemsState(s => {
            const updated = s.map(i => { if (i.id !== item.itemId) return i; const newStock = Math.max(0, i.currentStock - item.qty); supabase.from('stock_items').update({ currentStock: newStock }).eq('id', i.id).then(({ error }) => { if (error) { console.error('Stock currentStock sync error:', error.message); toastRef.current({ title: 'Stock update failed', description: error.message, variant: 'destructive' }); } }); return { ...i, currentStock: newStock }; });
            return updated;
          });
        });
        // Cascade-delete stock_movements for this purchase
        // (Inventory / Stock Valuation / Closing Stock all compute qty from movements,
        //  so orphan movements would keep stock showing as if the purchase still existed.)
        setStockMovementsState(s => s.filter(m => m.referenceNo !== purchase.purchaseNo));
        supabase.from('stock_movements').delete().eq('referenceNo', purchase.purchaseNo)
          .then(({ error }) => { if (error) console.error('Movements cascade-delete sync:', error.message); });
      }
      const updated = prev.filter(p => p.id !== id);
      return updated;
    });
    supabase.from('purchases').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    console.info(`[AUDIT-DELETE] Purchase id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, []);

  const updatePurchase = useCallback((id: string, data: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt'>): Purchase | null => {
    if (guardFYLocked()) return null;
    // Enforce per-item Purchase A/c (group) BEFORE mutating anything (no data loss).
    const unmappedNames = data.items
      .map(it => stockItems.find(s => s.id === it.itemId))
      .filter((s): s is NonNullable<typeof s> => !!s && !s.purchaseAccountId)
      .map(s => s.name);
    if (unmappedNames.length > 0) {
      toastRef.current({
        title: 'खरीद खाता आवश्यक',
        description: `इन वस्तुओं को पहले खरीद खाता (group) असाइन करें: ${unmappedNames.join(', ')}`,
        variant: 'destructive',
        duration: 10000,
      });
      return null;
    }
    const original = purchasesRef.current.find(p => p.id === id);
    if (!original) {
      toastRef.current({ title: 'Purchase not found', variant: 'destructive' });
      return null;
    }

    const now = new Date().toISOString();
    const lid = () => crypto.randomUUID();

    // 1️⃣ Compute net stock delta per item (old qty -> new qty) and apply atomically
    const stockDelta = new Map<string, number>();
    original.items.forEach(item => {
      stockDelta.set(item.itemId, (stockDelta.get(item.itemId) || 0) - item.qty);
    });
    data.items.forEach(item => {
      stockDelta.set(item.itemId, (stockDelta.get(item.itemId) || 0) + item.qty);
    });
    const newRateMap = new Map<string, number>();
    data.items.forEach(item => { newRateMap.set(item.itemId, item.rate); });

    setStockItemsState(prev => prev.map(i => {
      const delta = stockDelta.get(i.id);
      if (delta == null || delta === 0 && !newRateMap.has(i.id)) return i;
      const newStock = Math.max(0, i.currentStock + (delta || 0));
      const newRate = newRateMap.get(i.id) ?? i.purchaseRate;
      supabase.from('stock_items').update({ currentStock: newStock, purchaseRate: newRate }).eq('id', i.id)
        .then(({ error }) => { if (error) console.error('Stock update sync:', error.message); });
      return { ...i, currentStock: newStock, purchaseRate: newRate };
    }));

    // 1️⃣b Delete old stock_movements for this purchase (so they don't double-count)
    setStockMovementsState(prev => prev.filter(m => m.referenceNo !== original.purchaseNo));
    supabase.from('stock_movements').delete().eq('referenceNo', original.purchaseNo)
      .then(({ error }) => { if (error) console.error('Old movements delete sync:', error.message); });

    // 2️⃣ Soft-delete the original purchase voucher(s)
    const linkedIds = ([original.voucherId, ...(original.taxVoucherIds ?? [])].filter(Boolean) as string[]).filter(vid => !isEngineVoucher(vouchersRef.current.find(v => v.id === vid)));
    if (linkedIds.length > 0) {
      setVouchersState(v => {
        const updated = v.map(x => linkedIds.includes(x.id)
          ? { ...x, isDeleted: true, deletedAt: now, deletedBy: data.createdBy || 'System', deletedReason: `Purchase ${original.purchaseNo} edited` }
          : x
        );
        linkedIds.forEach(vid => {
          const cancelled = updated.find(x => x.id === vid);
          if (cancelled) supabase.from('vouchers').update({ isDeleted: true, deletedAt: cancelled.deletedAt, deletedBy: cancelled.deletedBy, deletedReason: cancelled.deletedReason }).eq('id', vid).then(({ error }) => {
            if (error) console.error('Voucher cancel sync:', error.message);
            else deleteEntries(vid); // cascade: remove from voucher_entries
          });
        });
        return updated;
      });
    }

    // 3️⃣ Build new voucher lines from updated data
    const grandTotal = data.grandTotal ?? data.netAmount;
    const lines: VoucherLine[] = [];
    const supplierAccId = data.supplierId ? (suppliers.find(s => s.id === data.supplierId)?.accountId || '2101') : '2101';
    const creditAccId = data.paymentMode === 'cash' ? ACCOUNT_IDS.CASH
      : data.paymentMode === 'bank' ? (data.bankAccountId || getBankAccountIds(accounts)[0] || ACCOUNT_IDS.BANK)
      : supplierAccId;

    const netAmt = data.netAmount || (grandTotal - (data.taxAmount || 0) + (data.tdsAmount || 0));
    if (netAmt > 0) {
      // Split by each item's purchaseAccountId (same logic as addPurchase)
      const totalItemAmount = data.items.reduce((s, it) => s + it.amount, 0) || 1;
      const purchaseAccBuckets = new Map<string, number>();
      data.items.forEach(it => {
        const stock = stockItems.find(s => s.id === it.itemId);
        const acc = stock?.purchaseAccountId || '5101';
        const itemNet = (it.amount / totalItemAmount) * netAmt;
        purchaseAccBuckets.set(acc, (purchaseAccBuckets.get(acc) || 0) + itemNet);
      });
      purchaseAccBuckets.forEach((amt, accId) => {
        const rounded = Math.round(amt * 100) / 100;
        if (rounded > 0) lines.push({ id: lid(), accountId: accId, type: 'Dr', amount: rounded });
      });
    }
    if ((data.taxAmount ?? 0) > 0) {
      lines.push({ id: lid(), accountId: '3310', type: 'Dr', amount: data.taxAmount!, narration: `GST ITC: CGST ₹${data.cgstAmount||0} + SGST ₹${data.sgstAmount||0} + IGST ₹${data.igstAmount||0}` });
    }
    const netPayable = grandTotal;  // grandTotal already nets TDS (= netAmount + tax − TDS)
    if (netPayable > 0) {
      lines.push({ id: lid(), accountId: creditAccId, type: 'Cr', amount: netPayable });
    }
    if ((data.tdsAmount ?? 0) > 0) {
      lines.push({ id: lid(), accountId: '2202', type: 'Cr', amount: data.tdsAmount!, narration: `TDS ${data.tdsPct||0}%` });
    }

    const vType = data.paymentMode === 'credit' ? 'purchase' : 'payment';
    const newVoucher = addVoucher({
      type: vType,
      date: data.date,
      lines,
      debitAccountId: '5101',
      creditAccountId: creditAccId,
      amount: grandTotal,
      narration: data.narration || `Purchase: ${data.supplierName} — ${original.purchaseNo}`,
      createdBy: data.createdBy,
      refType: 'purchase',
      refId: id,
    });

    // 4️⃣ Add fresh stock_movement rows for the edited purchase
    //    (stock currentStock was already updated above via net-delta;
    //     old movement rows were deleted in step 1b)
    data.items.forEach(item => {
      const mv: StockMovement = { id: lid(), date: data.date, itemId: item.itemId, type: 'purchase', qty: item.qty, rate: item.rate, amount: item.amount, referenceNo: original.purchaseNo, narration: `Purchase from ${data.supplierName} (edited)`, createdAt: now };
      setStockMovementsState(prev => [...prev, mv]);
      supabase.from('stock_movements').upsert(withSoc(mv)).then(({ error }) => { if (error) console.error('Movement upsert sync:', error.message); });
    });

    // 5️⃣ Update the purchase record in place (same id + purchaseNo)
    const updated: Purchase = {
      ...data,
      id,
      purchaseNo: original.purchaseNo,
      voucherId: newVoucher.id,
      taxVoucherIds: undefined,
      createdAt: original.createdAt,
    };
    purchasesRef.current = purchasesRef.current.map(p => p.id === id ? updated : p);
    setPurchasesState(prev => prev.map(p => p.id === id ? updated : p));

    const { cgstPct: pCgstPct, sgstPct: pSgstPct, igstPct: pIgstPct, tdsPct: pTdsPct, cgstAmount: pCgstAmt, sgstAmount: pSgstAmt, igstAmount: pIgstAmt, tdsAmount: pTdsAmt, taxAmount: pTaxAmt, grandTotal: pGrandTotal, supplierId: pSupplierId, taxVoucherIds: _tv, ...purchaseBase } = updated;
    supabase.from('purchases').upsert(withSoc(purchaseBase)).then(({ error }) => {
      if (error) {
        console.error('Purchase update failed:', error.message);
        toastRef.current({ title: 'Purchase update nahi hua', description: error.message, variant: 'destructive' });
      } else {
        supabase.from('purchases').update({ cgstPct: pCgstPct, sgstPct: pSgstPct, igstPct: pIgstPct, tdsPct: pTdsPct, cgstAmount: pCgstAmt, sgstAmount: pSgstAmt, igstAmount: pIgstAmt, tdsAmount: pTdsAmt, taxAmount: pTaxAmt, grandTotal: pGrandTotal, supplierId: pSupplierId })
          .eq('id', id)
          .then(({ error: gstErr }) => { if (gstErr) console.warn('Purchase GST fields update:', gstErr.message); });
      }
    });

    console.info(`[AUDIT-EDIT] Purchase id=${id} edited by ${data.createdBy || 'unknown'} at ${now}`);
    return updated;
  }, [society.fyLocked, suppliers, accounts, addVoucher, stockItems]);

  // ── Employees ──────────────────────────────────────────────────────────────
  const addEmployee = useCallback((data: Omit<Employee, 'id' | 'empNo'>): Employee => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as Employee;
    const maxEmpNum = employeesRef.current.reduce((max, e) => {
      const m = e.empNo?.match(/EMP\/(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const empNo = `EMP/${String(maxEmpNum + 1).padStart(3, '0')}`;
    const emp: Employee = { ...data, id: crypto.randomUUID(), empNo };
    employeesRef.current = [...employeesRef.current, emp];
    setEmployeesState(prev => { const updated = [...prev, emp]; return updated; });
    supabase.from('employees').upsert(withSoc(emp)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        employeesRef.current = employeesRef.current.filter(e => e.id !== emp.id);
        setEmployeesState(prev => prev.filter(e => e.id !== emp.id));   // RULE 1: roll back
        toastRef.current({ title: 'कर्मचारी सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 });
      }
    });
    return emp;
  }, []);

  const updateEmployee = useCallback((id: string, data: Partial<Employee>) => {
    if (guardFYLocked()) return;
    const before = employeesRef.current.find(e => e.id === id);
    if (!before) return;
    const updated = { ...before, ...data };
    setEmployeesState(prev => prev.map(e => e.id === id ? updated : e));
    supabase.from('employees').upsert(withSoc(updated)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        setEmployeesState(prev => prev.map(e => e.id === id ? before : e));   // RULE 1: roll back to prior state
        toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, []);

  const deleteEmployee = useCallback((id: string) => {
    if (guardFYLocked()) return;
    setEmployeesState(prev => { const updated = prev.filter(e => e.id !== id); return updated; });
    supabase.from('employees').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    console.info(`[AUDIT-DELETE] Employee id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, []);

  // ── Salary Records ─────────────────────────────────────────────────────────
  const addSalaryRecord = useCallback((data: Omit<SalaryRecord, 'id' | 'slipNo' | 'createdAt'>): SalaryRecord => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as SalaryRecord;
    const fy = society.financialYear;
    const maxSlipNum = salaryRecordsRef.current.filter(r => r.slipNo?.includes(fy)).reduce((max, r) => {
      const m = r.slipNo?.match(/\/(\d+)$/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const slipNo = `SAL/${fy}/${String(maxSlipNum + 1).padStart(3, '0')}`;
    const record: SalaryRecord = { ...data, id: crypto.randomUUID(), slipNo, createdAt: new Date().toISOString() };
    salaryRecordsRef.current = [...salaryRecordsRef.current, record];
    setSalaryRecordsState(prev => { const updated = [...prev, record]; return updated; });
    supabase.from('salary_records').upsert(withSoc(record)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        salaryRecordsRef.current = salaryRecordsRef.current.filter(r => r.id !== record.id);
        setSalaryRecordsState(prev => prev.filter(r => r.id !== record.id));   // RULE 1: roll back
        toastRef.current({ title: 'वेतन रिकॉर्ड सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 });
      }
    });
    return record;
  }, [society.financialYear]);

  const updateSalaryRecord = useCallback((id: string, data: Partial<SalaryRecord>) => {
    if (guardFYLocked()) return;
    const oldRecord = salaryRecordsRef.current.find(r => r.id === id);
    if (!oldRecord) return;
    const merged = { ...oldRecord, ...data };
    const lid = () => crypto.randomUUID();

    // H8: Voucher lifecycle —
    // (a) Was paid, now unpaid → cancel existing voucher
    // (b) Was unpaid, now paid → create new voucher
    // (c) Still paid, but amount/date/paymentMode changed → update existing voucher + entries

    if (oldRecord.isPaid && !data.isPaid && oldRecord.voucherId) {
      // (a) Cancel the linked voucher
      const v = vouchersRef.current.find(x => x.id === oldRecord.voucherId);
      if (v && !v.isDeleted && !isEngineVoucher(v)) {
        const cancelled = { ...v, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: 'System', deletedReason: `Salary slip ${oldRecord.slipNo} marked unpaid` };
        setVouchersState(prev => prev.map(x => x.id === v.id ? cancelled : x));
        supabase.from('vouchers').update({ isDeleted: true, deletedAt: cancelled.deletedAt, deletedBy: cancelled.deletedBy, deletedReason: cancelled.deletedReason }).eq('id', v.id).then(({ error }) => {
          if (error) console.error('Salary voucher cancel sync:', error.message);
          else deleteEntries(v.id);
        });
      }
      merged.voucherId = undefined;
    } else if (!oldRecord.isPaid && data.isPaid && !oldRecord.voucherId) {
      // (b) Create new payment voucher
      const emp = employees.find(e => e.id === oldRecord.employeeId);
      const creditAcc = merged.paymentMode === 'cash' ? ACCOUNT_IDS.CASH : (getBankAccountIds(accounts)[0] || ACCOUNT_IDS.BANK);
      const newV = addVoucher({
        type: 'payment' as const,
        date: merged.paidDate || new Date().toISOString().split('T')[0],
        debitAccountId: '5201',
        creditAccountId: creditAcc,
        amount: merged.netSalary,
        narration: `Salary: ${emp?.name || ''} - ${oldRecord.month}`,
        createdBy: 'System',
      });
      if (newV.id) merged.voucherId = newV.id;
    } else if (oldRecord.isPaid && data.isPaid && oldRecord.voucherId) {
      // (c) Still paid — re-sync voucher if amount / date / paymentMode changed
      const amountChanged = data.netSalary !== undefined && data.netSalary !== oldRecord.netSalary;
      const dateChanged = data.paidDate !== undefined && data.paidDate !== oldRecord.paidDate;
      const modeChanged = data.paymentMode !== undefined && data.paymentMode !== oldRecord.paymentMode;
      if (amountChanged || dateChanged || modeChanged) {
        const v = vouchersRef.current.find(x => x.id === oldRecord.voucherId);
        if (v && !v.isDeleted) {
          const emp = employees.find(e => e.id === oldRecord.employeeId);
          const creditAcc = merged.paymentMode === 'cash' ? ACCOUNT_IDS.CASH : (getBankAccountIds(accounts)[0] || ACCOUNT_IDS.BANK);
          const newLines: VoucherLine[] = [
            { id: lid(), accountId: '5201', type: 'Dr', amount: merged.netSalary },
            { id: lid(), accountId: creditAcc, type: 'Cr', amount: merged.netSalary },
          ];
          const updatedV: Voucher = {
            ...v,
            date: merged.paidDate || v.date,
            creditAccountId: creditAcc,
            amount: merged.netSalary,
            lines: newLines,
            narration: `Salary: ${emp?.name || ''} - ${oldRecord.month}`,
          };
          setVouchersState(prev => prev.map(x => x.id === v.id ? updatedV : x));
          supabase.from('vouchers').upsert(withSoc(updatedV)).then(({ error }) => {
            if (error) console.error('Salary voucher resync:', error.message);
            else syncEntries(updatedV);
          });
        }
      }
    }

    salaryRecordsRef.current = salaryRecordsRef.current.map(r => r.id === id ? merged : r);
    setSalaryRecordsState(prev => prev.map(r => r.id === id ? merged : r));
    supabase.from('salary_records').upsert(withSoc(merged)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        salaryRecordsRef.current = salaryRecordsRef.current.map(r => r.id === id ? oldRecord : r);
        setSalaryRecordsState(prev => prev.map(r => r.id === id ? oldRecord : r));   // RULE 1: roll back to prior state
        toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [employees, accounts, addVoucher]);

  const deleteSalaryRecord = useCallback((id: string) => {
    if (guardFYLocked()) return;
    // H8: Cascade-cancel the linked payment voucher (if any) so accounting reverses
    const record = salaryRecordsRef.current.find(r => r.id === id);
    if (record?.voucherId) {
      const v = vouchersRef.current.find(x => x.id === record.voucherId);
      if (v && !v.isDeleted && !isEngineVoucher(v)) {
        const cancelled = { ...v, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: 'System', deletedReason: `Salary slip ${record.slipNo} deleted` };
        setVouchersState(prev => prev.map(x => x.id === v.id ? cancelled : x));
        supabase.from('vouchers').update({ isDeleted: true, deletedAt: cancelled.deletedAt, deletedBy: cancelled.deletedBy, deletedReason: cancelled.deletedReason }).eq('id', v.id).then(({ error }) => {
          if (error) console.error('Salary voucher cancel sync:', error.message);
          else deleteEntries(v.id);
        });
      }
    }
    setSalaryRecordsState(prev => prev.filter(r => r.id !== id));
    salaryRecordsRef.current = salaryRecordsRef.current.filter(r => r.id !== id);
    supabase.from('salary_records').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    console.info(`[AUDIT-DELETE] SalaryRecord id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, []);

  // ── Suppliers ──────────────────────────────────────────────────────────────
  // Two-step supplier save (mirror of persistCustomer — RULE 1).
  // Base columns save first; Tally extras patched separately so missing
  // migration only shows a soft warning.
  const persistSupplier = (s: Supplier, opts: { onBaseFail: () => void; isUpdate: boolean }) => {
    const {
      legalName, tradeName, mailingName, supplierType,
      addressLine1, addressLine2, city, state, pincode, country,
      mobile, landline, email, website, contactPerson, contactDesignation, salesRep,
      gstin, pan, registrationType, placeOfSupply, tdsApplicable, tdsSection, tcsApplicable,
      bankName, accountNo, ifsc, branch, upiId, beneficiaryName,
      creditDays, creditLimit, discountPercent, openingBalance, openingBalanceType,
      notes,
      ...baseCols
    } = s;
    supabase.from('suppliers').upsert(withSoc(baseCols)).then(({ error }) => {
      if (error) {
        console.error(`Supplier ${opts.isUpdate ? 'update' : 'save'} failed (base):`, error.message);
        opts.onBaseFail();
        toastRef.current({
          title: '❌ Supplier cloud par save NAHI hua',
          description: `${error.message}. Local state se hata di gayi.`,
          variant: 'destructive',
          duration: 15000,
        });
        return;
      }
      const extras: Record<string, unknown> = {};
      const setIf = (k: string, v: unknown) => { if (v !== undefined) extras[k] = v; };
      setIf('legalName', legalName); setIf('tradeName', tradeName); setIf('mailingName', mailingName);
      setIf('supplierType', supplierType);
      setIf('addressLine1', addressLine1); setIf('addressLine2', addressLine2);
      setIf('city', city); setIf('state', state); setIf('pincode', pincode); setIf('country', country);
      setIf('mobile', mobile); setIf('landline', landline); setIf('email', email);
      setIf('website', website); setIf('contactPerson', contactPerson); setIf('contactDesignation', contactDesignation);
      setIf('salesRep', salesRep);
      setIf('gstin', gstin); setIf('pan', pan); setIf('registrationType', registrationType);
      setIf('placeOfSupply', placeOfSupply); setIf('tdsApplicable', tdsApplicable);
      setIf('tdsSection', tdsSection); setIf('tcsApplicable', tcsApplicable);
      setIf('bankName', bankName); setIf('accountNo', accountNo); setIf('ifsc', ifsc);
      setIf('branch', branch); setIf('upiId', upiId); setIf('beneficiaryName', beneficiaryName);
      setIf('creditDays', creditDays); setIf('creditLimit', creditLimit); setIf('discountPercent', discountPercent);
      setIf('openingBalance', openingBalance); setIf('openingBalanceType', openingBalanceType);
      setIf('notes', notes);
      if (Object.keys(extras).length === 0) return;
      supabase.from('suppliers').update(extras).eq('id', s.id).then(({ error: e2 }) => {
        if (e2) {
          console.warn('Supplier extras patch warning (run STEP 17g migration):', e2.message);
          toastRef.current({
            title: '⚠️ Supplier saved partially',
            description: `Base info saved. Extra fields (GST/Bank/etc.) failed: ${e2.message}. Run STEP 17g migration.`,
            variant: 'default',
            duration: 8000,
          });
        }
      });
    });
  };

  const addSupplier = useCallback((data: Omit<Supplier, 'id' | 'supplierCode' | 'accountId' | 'createdAt'>): Supplier => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as Supplier;
    const accountId = crypto.randomUUID();
    // Auto-create ledger account under Sundry Creditors (2101)
    const newAccount: LedgerAccount = {
      id: accountId,
      name: data.legalName || data.name,
      nameHi: data.nameHi || data.legalName || data.name,
      type: 'liability',
      openingBalance: data.openingBalance || 0,
      openingBalanceType: data.openingBalanceType || 'credit',
      isSystem: false,
      isGroup: false,
      parentId: '2101',
    };
    setAccountsState(prev => [...prev, newAccount]);
    supabase.from('accounts').upsert(withSoc(newAccount)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });

    const maxSupNum = suppliersRef.current.reduce((max, s) => {
      const m = s.supplierCode?.match(/SUP\/(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const supplierCode = `SUP/${String(maxSupNum + 1).padStart(3, '0')}`;
    const supplier: Supplier = { ...data, id: crypto.randomUUID(), supplierCode, accountId, createdAt: new Date().toISOString() };
    suppliersRef.current = [...suppliersRef.current, supplier];
    setSuppliersState(prev => [...prev, supplier]);
    persistSupplier(supplier, {
      isUpdate: false,
      onBaseFail: () => {
        suppliersRef.current = suppliersRef.current.filter(s => s.id !== supplier.id);
        setSuppliersState(prev => prev.filter(s => s.id !== supplier.id));
      },
    });
    return supplier;
  }, []);

  const updateSupplier = useCallback((id: string, data: Partial<Omit<Supplier, 'id' | 'supplierCode' | 'accountId' | 'createdAt'>>) => {
    if (guardFYLocked()) return;
    const before = suppliersRef.current.find(s => s.id === id);
    if (!before) return;
    const updated: Supplier = { ...before, ...data };
    suppliersRef.current = suppliersRef.current.map(s => s.id === id ? updated : s);
    setSuppliersState(prev => prev.map(s => s.id === id ? updated : s));

    // Mirror name + opening balance changes to the linked Sundry Creditor account
    if (data.name || data.nameHi || data.legalName || data.openingBalance !== undefined || data.openingBalanceType) {
      setAccountsState(prev => prev.map(a => {
        if (a.id !== updated.accountId) return a;
        return {
          ...a,
          name: updated.legalName || updated.name,
          nameHi: updated.nameHi || updated.legalName || updated.name,
          openingBalance: updated.openingBalance ?? a.openingBalance,
          openingBalanceType: updated.openingBalanceType ?? a.openingBalanceType,
        };
      }));
    }

    persistSupplier(updated, {
      isUpdate: true,
      onBaseFail: () => {
        suppliersRef.current = suppliersRef.current.map(s => s.id === id ? before : s);
        setSuppliersState(prev => prev.map(s => s.id === id ? before : s));
      },
    });
  }, []);

  const deleteSupplier = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const sup = suppliers.find(s => s.id === id);
    if (!sup) return;
    // H9: Block if supplier has live purchases — otherwise sub-ledger reconciliation breaks
    const livePurchases = purchasesRef.current.filter(p => p.supplierId === id).length;
    if (livePurchases > 0) {
      toastRef.current({ title: 'Cannot delete supplier', description: `${livePurchases} purchase(s) linked. Delete those purchases first from Purchase Management.`, variant: 'destructive' });
      return;
    }
    setSuppliersState(prev => prev.filter(s => s.id !== id));
    supabase.from('suppliers').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    // Only hard-delete the linked Sundry Creditor account if NO vouchers (even soft-deleted) reference it
    if (sup.accountId) {
      const accountReferenced = vouchersRef.current.some(v =>
        v.debitAccountId === sup.accountId || v.creditAccountId === sup.accountId ||
        (v.lines && v.lines.some(l => l.accountId === sup.accountId))
      );
      if (accountReferenced) {
        // Keep the account so historical vouchers stay reconcilable; just rename it to mark orphan
        setAccountsState(prev => prev.map(a => a.id === sup.accountId ? { ...a, name: `${a.name} [Supplier deleted]`, isSystem: false } : a));
        supabase.from('accounts').update({ name: `${sup.name} [Supplier deleted]` }).eq('id', sup.accountId)
          .then(({ error }) => { if (error) console.error('Account rename sync:', error.message); });
      } else {
        setAccountsState(prev => prev.filter(a => a.id !== sup.accountId));
        supabase.from('accounts').delete().eq('id', sup.accountId).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
      }
    }
    console.info(`[AUDIT-DELETE] Supplier id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, [suppliers]);

  // ── Customers ──────────────────────────────────────────────────────────────
  // Two-step customer save (RULE 1): base columns (name, nameHi, address, phone, gstNo,
  // accountId, isActive, createdAt) save first — schema cache always knows these. Tally
  // extras (legalName, tradeName, customerType, addressLine1/2, city, state, pincode,
  // country, mobile, landline, email, website, contactPerson, contactDesignation, gstin,
  // pan, registrationType, placeOfSupply, tdsApplicable, tcsApplicable, bankName, accountNo,
  // ifsc, branch, upiId, creditDays, creditLimit, discountPercent, openingBalance,
  // openingBalanceType, notes, mailingName) patch separately so missing migration only
  // shows a soft warning instead of nuking the row.
  const persistCustomer = (c: Customer, opts: { onBaseFail: () => void; isUpdate: boolean }) => {
    const {
      legalName, tradeName, mailingName, customerType,
      addressLine1, addressLine2, city, state, pincode, country,
      mobile, landline, email, website, contactPerson, contactDesignation,
      gstin, pan, registrationType, placeOfSupply, tdsApplicable, tcsApplicable,
      bankName, accountNo, ifsc, branch, upiId,
      creditDays, creditLimit, discountPercent, openingBalance, openingBalanceType,
      notes,
      ...baseCols
    } = c;
    supabase.from('customers').upsert(withSoc(baseCols)).then(({ error }) => {
      if (error) {
        console.error(`Customer ${opts.isUpdate ? 'update' : 'save'} failed (base):`, error.message);
        opts.onBaseFail();
        toastRef.current({
          title: '❌ Customer cloud par save NAHI hua',
          description: `${error.message}. Local state se hata di gayi.`,
          variant: 'destructive',
          duration: 15000,
        });
        return;
      }
      const extras: Record<string, unknown> = {};
      const setIf = (k: string, v: unknown) => { if (v !== undefined) extras[k] = v; };
      setIf('legalName', legalName); setIf('tradeName', tradeName); setIf('mailingName', mailingName);
      setIf('customerType', customerType);
      setIf('addressLine1', addressLine1); setIf('addressLine2', addressLine2);
      setIf('city', city); setIf('state', state); setIf('pincode', pincode); setIf('country', country);
      setIf('mobile', mobile); setIf('landline', landline); setIf('email', email);
      setIf('website', website); setIf('contactPerson', contactPerson); setIf('contactDesignation', contactDesignation);
      setIf('gstin', gstin); setIf('pan', pan); setIf('registrationType', registrationType);
      setIf('placeOfSupply', placeOfSupply); setIf('tdsApplicable', tdsApplicable); setIf('tcsApplicable', tcsApplicable);
      setIf('bankName', bankName); setIf('accountNo', accountNo); setIf('ifsc', ifsc);
      setIf('branch', branch); setIf('upiId', upiId);
      setIf('creditDays', creditDays); setIf('creditLimit', creditLimit); setIf('discountPercent', discountPercent);
      setIf('openingBalance', openingBalance); setIf('openingBalanceType', openingBalanceType);
      setIf('notes', notes);
      if (Object.keys(extras).length === 0) return;
      supabase.from('customers').update(extras).eq('id', c.id).then(({ error: e2 }) => {
        if (e2) {
          console.warn('Customer extras patch warning (run latest supabase-tables.sql migration):', e2.message);
          toastRef.current({
            title: '⚠️ Customer saved partially',
            description: `Base info saved. Extra fields (GST/Bank/etc.) failed: ${e2.message}. Run STEP 17f migration.`,
            variant: 'default',
            duration: 8000,
          });
        }
      });
    });
  };

  const addCustomer = useCallback((data: Omit<Customer, 'id' | 'customerCode' | 'accountId' | 'createdAt'>): Customer => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as Customer;
    const accountId = crypto.randomUUID();
    // Auto-create ledger account under Sundry Debtors (3303)
    const newAccount: LedgerAccount = {
      id: accountId,
      name: data.legalName || data.name,
      nameHi: data.nameHi || data.legalName || data.name,
      type: 'asset',
      openingBalance: data.openingBalance || 0,
      openingBalanceType: data.openingBalanceType || 'debit',
      isSystem: false,
      isGroup: false,
      parentId: '3303',
    };
    setAccountsState(prev => [...prev, newAccount]);
    supabase.from('accounts').upsert(withSoc(newAccount)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });

    const maxCusNum = customersRef.current.reduce((max, c) => {
      const m = c.customerCode?.match(/CUS\/(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const customerCode = `CUS/${String(maxCusNum + 1).padStart(3, '0')}`;
    const customer: Customer = { ...data, id: crypto.randomUUID(), customerCode, accountId, createdAt: new Date().toISOString() };
    customersRef.current = [...customersRef.current, customer];
    setCustomersState(prev => [...prev, customer]);
    persistCustomer(customer, {
      isUpdate: false,
      onBaseFail: () => {
        customersRef.current = customersRef.current.filter(c => c.id !== customer.id);
        setCustomersState(prev => prev.filter(c => c.id !== customer.id));
      },
    });
    return customer;
  }, []);

  const updateCustomer = useCallback((id: string, data: Partial<Omit<Customer, 'id' | 'customerCode' | 'accountId' | 'createdAt'>>) => {
    if (guardFYLocked()) return;
    const before = customersRef.current.find(c => c.id === id);
    if (!before) return;
    const updated: Customer = { ...before, ...data };
    customersRef.current = customersRef.current.map(c => c.id === id ? updated : c);
    setCustomersState(prev => prev.map(c => c.id === id ? updated : c));

    // Mirror name + opening balance changes to the linked Sundry Debtor account
    if (data.name || data.nameHi || data.legalName || data.openingBalance !== undefined || data.openingBalanceType) {
      setAccountsState(prev => prev.map(a => {
        if (a.id !== updated.accountId) return a;
        return {
          ...a,
          name: updated.legalName || updated.name,
          nameHi: updated.nameHi || updated.legalName || updated.name,
          openingBalance: updated.openingBalance ?? a.openingBalance,
          openingBalanceType: updated.openingBalanceType ?? a.openingBalanceType,
        };
      }));
    }

    persistCustomer(updated, {
      isUpdate: true,
      onBaseFail: () => {
        customersRef.current = customersRef.current.map(c => c.id === id ? before : c);
        setCustomersState(prev => prev.map(c => c.id === id ? before : c));
      },
    });
  }, []);

  const deleteCustomer = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const cus = customers.find(c => c.id === id);
    if (!cus) return;
    // H9: Block if customer has live sales
    const liveSales = salesRef.current.filter(s => s.customerId === id).length;
    if (liveSales > 0) {
      toastRef.current({ title: 'Cannot delete customer', description: `${liveSales} sale(s) linked. Delete those sales first from Sale Management.`, variant: 'destructive' });
      return;
    }
    setCustomersState(prev => prev.filter(c => c.id !== id));
    supabase.from('customers').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    if (cus.accountId) {
      const accountReferenced = vouchersRef.current.some(v =>
        v.debitAccountId === cus.accountId || v.creditAccountId === cus.accountId ||
        (v.lines && v.lines.some(l => l.accountId === cus.accountId))
      );
      if (accountReferenced) {
        setAccountsState(prev => prev.map(a => a.id === cus.accountId ? { ...a, name: `${a.name} [Customer deleted]`, isSystem: false } : a));
        supabase.from('accounts').update({ name: `${cus.name} [Customer deleted]` }).eq('id', cus.accountId)
          .then(({ error }) => { if (error) console.error('Account rename sync:', error.message); });
      } else {
        setAccountsState(prev => prev.filter(a => a.id !== cus.accountId));
        supabase.from('accounts').delete().eq('id', cus.accountId).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
      }
    }
    console.info(`[AUDIT-DELETE] Customer id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, [customers]);

  const getEntityLinks = useCallback((entityType: 'member' | 'customer' | 'supplier' | 'stockItem' | 'employee' | 'account' | 'loan' | 'asset', id: string): EntityLink[] => {
    const links: EntityLink[] = [];
    const activeVouchers = vouchersRef.current.filter(v => !v.isDeleted);

    if (entityType === 'member') {
      const vCount = activeVouchers.filter(v => v.memberId === id).length;
      if (vCount > 0) links.push({
        module: 'Vouchers', count: vCount,
        labelHi: `${vCount} वाउचर`, labelEn: `${vCount} Voucher(s)`,
        instructionHi: 'Vouchers page pe jao → in vouchers ko pehle cancel karo',
        instructionEn: 'Go to Vouchers page → cancel these vouchers first',
        blocking: true,
      });
      const lCount = loansRef.current.filter(l => l.memberId === id).length;
      if (lCount > 0) links.push({
        module: 'Loans', count: lCount,
        labelHi: `${lCount} ऋण`, labelEn: `${lCount} Loan(s)`,
        instructionHi: 'Loan Register pe jao → pehle ye loans delete karo',
        instructionEn: 'Go to Loan Register → delete these loans first',
        blocking: true,
      });
    }

    if (entityType === 'customer') {
      const sCount = salesRef.current.filter(s => s.customerId === id).length;
      if (sCount > 0) links.push({
        module: 'Sales', count: sCount,
        labelHi: `${sCount} बिक्री`, labelEn: `${sCount} Sale(s)`,
        instructionHi: 'Sale Management pe jao → pehle ye sales delete karo',
        instructionEn: 'Go to Sale Management → delete these sales first',
        blocking: true,
      });
    }

    if (entityType === 'supplier') {
      const pCount = purchasesRef.current.filter(p => p.supplierId === id).length;
      if (pCount > 0) links.push({
        module: 'Purchases', count: pCount,
        labelHi: `${pCount} खरीद`, labelEn: `${pCount} Purchase(s)`,
        instructionHi: 'Purchase Management pe jao → pehle ye purchases delete karo',
        instructionEn: 'Go to Purchase Management → delete these purchases first',
        blocking: true,
      });
    }

    if (entityType === 'stockItem') {
      // Only count movements whose parent purchase/sale still exists.
      // Orphan movements (parent already deleted) are auto-cleaned by deleteStockItem,
      // so they should NOT block deletion.
      const livePurchaseNos = new Set(purchasesRef.current.map(p => p.purchaseNo));
      const liveSaleNos = new Set(salesRef.current.map(s => s.saleNo));
      const mvCount = stockMovements.filter(m =>
        m.itemId === id && (livePurchaseNos.has(m.referenceNo || '') || liveSaleNos.has(m.referenceNo || ''))
      ).length;
      if (mvCount > 0) links.push({
        module: 'Stock Movements', count: mvCount,
        labelHi: `${mvCount} स्टॉक मूवमेंट`, labelEn: `${mvCount} Stock Movement(s)`,
        instructionHi: 'Is item ki stock movements hain (purchases/sales). Pehle linked purchases aur sales delete karo.',
        instructionEn: 'This item has stock movements (purchases/sales). Delete linked purchases and sales first.',
        blocking: true,
      });
      const pCount = purchasesRef.current.filter(p => p.items.some(i => i.itemId === id)).length;
      if (pCount > 0) links.push({
        module: 'Purchases', count: pCount,
        labelHi: `${pCount} खरीद में शामिल`, labelEn: `${pCount} Purchase(s) contain this item`,
        instructionHi: 'Purchase Management pe jao → ye purchases delete karo',
        instructionEn: 'Go to Purchase Management → delete these purchases',
        blocking: true,
      });
      const sCount = salesRef.current.filter(s => s.items.some(i => i.itemId === id)).length;
      if (sCount > 0) links.push({
        module: 'Sales', count: sCount,
        labelHi: `${sCount} बिक्री में शामिल`, labelEn: `${sCount} Sale(s) contain this item`,
        instructionHi: 'Sale Management pe jao → ye sales delete karo',
        instructionEn: 'Go to Sale Management → delete these sales',
        blocking: true,
      });
    }

    if (entityType === 'employee') {
      const srCount = salaryRecordsRef.current.filter(r => r.employeeId === id).length;
      if (srCount > 0) links.push({
        module: 'Salary Records', count: srCount,
        labelHi: `${srCount} वेतन रिकॉर्ड`, labelEn: `${srCount} Salary Record(s)`,
        instructionHi: 'Salary Management pe jao → is employee ke salary records pehle delete karo',
        instructionEn: 'Go to Salary Management → delete this employee\'s salary records first',
        blocking: true,
      });
    }

    if (entityType === 'account') {
      const vCount = activeVouchers.filter(v => v.debitAccountId === id || v.creditAccountId === id).length;
      if (vCount > 0) links.push({
        module: 'Vouchers', count: vCount,
        labelHi: `${vCount} वाउचर में use ho raha hai`, labelEn: `Used in ${vCount} Voucher(s)`,
        instructionHi: 'Vouchers page pe jao → pehle in vouchers ko cancel karo',
        instructionEn: 'Go to Vouchers page → cancel these vouchers first',
        blocking: true,
      });
      const supLinked = suppliersRef.current.find(s => s.accountId === id);
      if (supLinked) links.push({
        module: 'Supplier', count: 1,
        labelHi: `Supplier "${supLinked.name}" ka account hai`, labelEn: `This is Supplier "${supLinked.name}"'s account`,
        instructionHi: 'Suppliers page pe jao → pehle supplier delete karo',
        instructionEn: 'Go to Suppliers page → delete the supplier first',
        blocking: true,
      });
      const cusLinked = customersRef.current.find(c => c.accountId === id);
      if (cusLinked) links.push({
        module: 'Customer', count: 1,
        labelHi: `Customer "${cusLinked.name}" ka account hai`, labelEn: `This is Customer "${cusLinked.name}"'s account`,
        instructionHi: 'Customers page pe jao → pehle customer delete karo',
        instructionEn: 'Go to Customers page → delete the customer first',
        blocking: true,
      });
    }

    if (entityType === 'loan') {
      const vCount = activeVouchers.filter(v => v.narration?.includes(loansRef.current.find(l => l.id === id)?.loanNo || '____NOMATCH____')).length;
      if (vCount > 0) links.push({
        module: 'Vouchers', count: vCount,
        labelHi: `${vCount} वाउचर linked`, labelEn: `${vCount} linked Voucher(s)`,
        instructionHi: 'Vouchers page pe jao → pehle in vouchers ko cancel karo',
        instructionEn: 'Go to Vouchers → cancel linked vouchers first',
        blocking: false,
      });
    }

    if (entityType === 'asset') {
      const asset = assetsRef.current.find(a => a.id === id);
      if (asset) {
        // M14: Tighter match — require a word-boundary around assetNo (prevents AST/0010
        // matching AST/00100) AND restrict to depreciation/disposal vouchers, so a casual
        // narration mention of the assetNo doesn't falsely block deletion.
        const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const assetNoRe = new RegExp(`(^|[^\\w/-])${escapeRegex(asset.assetNo)}([^\\w/-]|$)`);
        const vCount = activeVouchers.filter(v => {
          if (!v.narration || !assetNoRe.test(v.narration)) return false;
          return /depreciation|disposal|sold|written off|impair/i.test(v.narration);
        }).length;
        if (vCount > 0) links.push({
          module: 'Vouchers', count: vCount,
          labelHi: `${vCount} वाउचर (ह्रास आदि)`, labelEn: `${vCount} Voucher(s) (depreciation etc.)`,
          instructionHi: 'Vouchers page pe jao → pehle in vouchers ko cancel karo',
          instructionEn: 'Go to Vouchers → cancel depreciation vouchers first',
          blocking: true,
        });
      }
    }

    return links;
  }, [stockMovements]); // eslint-disable-line

  return (
    <DataContext.Provider value={{
      vouchers, members, accounts, society, loans, assets, auditObjections,
      stockItems, stockMovements, sales, purchases, employees, salaryRecords,
      suppliers, customers, kccLoans, societyCapabilities, setCapabilityHidden,
      procurementFarmers, procurementLots, procurementEvents, addFarmer, addProcurementLot,
      procurementQualityTests, procurementMoistureRecords, recordQualityInspection,
      procurementJForms, generateJForm,
      procurementFinancialIntents, generateFinancialIntent,
      procurementPostingRequests, generatePostingRequest,
      procurementPostingRuleResults, generatePostingRuleResult, generateEngineVoucher,
      procurementSettlements, createFarmerSettlement, addSettlementDeductionLine, removeSettlementDeductionLine, approveFarmerSettlement,
      recordFarmerPayment,
      addVoucher, updateVoucher, cancelVoucher, restoreVoucher, clearVoucher, unclearVoucher, approveVoucher, rejectVoucher,
      addMember, updateMember, deleteMember, approveMember, rejectMember,
      housingFlats, addHousingFlat, updateHousingFlat, deleteHousingFlat,
      maintenanceBills, generateMaintenanceBills, deleteMaintenanceBill,
      addAccount, updateAccount, deleteAccount, mergeAccounts, resetAccounts, updateSociety,
      addLoan, updateLoan, deleteLoan,
      addAsset, updateAsset, deleteAsset, postDepreciation,
      addAuditObjection, updateAuditObjection, deleteAuditObjection,
      recoverables, addRecoverable, updateRecoverable, deleteRecoverable,
      kachiAaratEntries, addKachiAaratEntry, updateKachiAaratEntry, deleteKachiAaratEntry,
      p7Entries, upsertP7Entry, deleteP7Entry,
      addStockItem, updateStockItem, deleteStockItem, addStockMovement,
      addSale, updateSale, deleteSale, addBillReceipt, addBillPayment,
      addPurchase, updatePurchase, deletePurchase,
      addEmployee, updateEmployee, deleteEmployee,
      addSalaryRecord, updateSalaryRecord, deleteSalaryRecord,
      addSupplier, updateSupplier, deleteSupplier,
      addCustomer, updateCustomer, deleteCustomer,
      getAccountBalance, getCashBookEntries, getBankBookEntries,
      getTrialBalance, getProfitLoss, getTradingAccount, getMemberLedger, getReceiptsPayments, postClosingStock,
      getEntityLinks,
      isLoading,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type {
  Voucher, VoucherEditSnapshot, VoucherLine, VoucherType, Member, LedgerAccount, SocietySettings,
  AccountBalance, CashBookEntry, BankBookEntry, MemberLedgerEntry, ReceiptsPaymentsData,
  Loan, Asset, AuditObjection, Recoverable, KachiAaratEntry, P7Entry,
  StockItem, StockMovement,
  Sale, Purchase,
  Employee, SalaryRecord, PaymentMode,
  Supplier, Customer,
  KccLoan,
  VoucherEntry,
  EntityLink,
} from '@/types';
import { getVoucherLines } from '@/lib/voucherUtils';
import * as storage from '@/lib/storage';
import { ACCOUNT_IDS, CMS_SOCIETY_ACCOUNTS, getBankAccountIds, isBankAccount } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { calcDepForFY, DEP_ACCOUNTS, parseFY } from '@/lib/depreciation';

interface DataContextType {
  vouchers: Voucher[];
  members: Member[];
  accounts: LedgerAccount[];
  society: SocietySettings;
  loans: Loan[];
  assets: Asset[];

  addVoucher: (data: Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'> & { voucherNo?: string }) => Voucher;
  updateVoucher: (id: string, data: Partial<Pick<Voucher, 'type' | 'date' | 'debitAccountId' | 'creditAccountId' | 'amount' | 'narration' | 'memberId' | 'lines'>>) => void;
  cancelVoucher: (id: string, reason: string, deletedBy: string) => void;
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
  const [loans, setLoansState] = useState<Loan[]>([]);
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
    setVouchersState([]); setMembersState([]); setLoansState([]);
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
              autoVouchers.push({ id: crypto.randomUUID(), voucherNo: storage.getNextVoucherNo('receipt', fyStr, allSoFar), type: 'receipt', date: member.joinDate || new Date().toISOString().split('T')[0], debitAccountId: ACCOUNT_IDS.CASH, creditAccountId: ACCOUNT_IDS.SHARE_CAP, amount: Number(member.shareCapital), narration: `Share Capital received from ${member.name}`, memberId: member.id, createdAt: new Date().toISOString() });
            }
            if (!mv.some(v => v.creditAccountId === ACCOUNT_IDS.ADM_FEE) && (member.admissionFee || 0) > 0) {
              const allSoFar = [...existingVouchers, ...autoVouchers];
              autoVouchers.push({ id: crypto.randomUUID(), voucherNo: storage.getNextVoucherNo('receipt', fyStr, allSoFar), type: 'receipt', date: member.joinDate || new Date().toISOString().split('T')[0], debitAccountId: ACCOUNT_IDS.CASH, creditAccountId: ACCOUNT_IDS.ADM_FEE, amount: Number(member.admissionFee), narration: `Admission Fee received from ${member.name}`, memberId: member.id, createdAt: new Date().toISOString() });
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
            const netPayable = grandTotal - (purchase.tdsAmount || 0);
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
    const { lines, refType, refId, isCleared, clearedDate, editHistory, groupId,
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

  const updateVoucher = useCallback((id: string, data: Partial<Pick<Voucher, 'type' | 'date' | 'debitAccountId' | 'creditAccountId' | 'amount' | 'narration' | 'memberId' | 'lines'>>) => {
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
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

  const cancelVoucher = useCallback((id: string, reason: string, deletedBy: string) => {
    if (society.fyLocked) { toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' }); return; }
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;

    // 🔒 Block deletion of vouchers ACTIVELY linked to a Purchase / Sale parent.
    // If the parent purchase/sale no longer points to THIS voucher (i.e., it's an
    // orphan or duplicate left over from auto-repair), allow cancellation so the
    // user can clean up. Without this, duplicate cleanup is impossible.
    if (current.refType === 'purchase') {
      const parent = purchasesRef.current.find(p => p.id === current.refId);
      const isActive = parent && parent.voucherId === current.id;
      if (isActive) {
        toastRef.current({
          title: 'Voucher delete nahi ho sakta',
          description: 'Ye voucher Purchase Management se bana hai. Isko Purchase Management → Purchase List se delete karo — stock bhi sahi rahega.',
          variant: 'destructive',
        });
        return;
      }
      // else: orphan/duplicate — allow cancellation
    }
    if (current.refType === 'sale') {
      const parent = salesRef.current.find(s => s.id === current.refId);
      const isActive = parent && parent.voucherId === current.id;
      if (isActive) {
        toastRef.current({
          title: 'Voucher delete nahi ho sakta',
          description: 'Ye voucher Sale Management se bana hai. Isko Sale Management → Sale List se delete karo — stock bhi sahi rahega.',
          variant: 'destructive',
        });
        return;
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
      return;
    }
    if (current.memberId && (current.creditAccountId === ACCOUNT_IDS.SHARE_CAP || current.creditAccountId === ACCOUNT_IDS.ADM_FEE)) {
      const kind = current.creditAccountId === ACCOUNT_IDS.SHARE_CAP ? 'Share Capital' : 'Admission Fee';
      toastRef.current({
        title: 'Voucher delete nahi ho sakta',
        description: `Ye Member ka auto-generated ${kind} voucher hai. Members page se member ko edit / delete karo.`,
        variant: 'destructive',
      });
      return;
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
        return;
      }
    }

    const cancelledVoucher = { ...current, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy, deletedReason: reason };
    setVouchersState(prev => {
      const updated = prev.map(v => v.id === id ? cancelledVoucher : v);
      return updated;
    });
    supabase.from('vouchers').upsert(withSoc(cancelledVoucher)).then(({ error }) => {
      if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); }
      else deleteEntries(id); // remove from voucher_entries so cancelled voucher has no SQL-visible impact
    });
  }, []);

  const restoreVoucher = useCallback((id: string) => {
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
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
      if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); }
      else syncEntries(restoredVoucher); // re-populate voucher_entries so SQL reports see it again
    });
  }, []);

  const clearVoucher = useCallback((id: string, clearedDate?: string) => {
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    const cleared = { ...current, isCleared: true, clearedDate: clearedDate ?? new Date().toISOString().split('T')[0] };
    setVouchersState(prev => { const updated = prev.map(v => v.id === id ? cleared : v); return updated; });
    supabase.from('vouchers').upsert(withSoc(cleared)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
  }, []);

  const unclearVoucher = useCallback((id: string) => {
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    const uncleared = { ...current, isCleared: false, clearedDate: undefined };
    setVouchersState(prev => { const updated = prev.map(v => v.id === id ? uncleared : v); return updated; });
    supabase.from('vouchers').upsert(withSoc(uncleared)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
  }, []);

  const approveVoucher = useCallback((id: string, approvedBy: string) => {
    if (society.fyLocked) { toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' }); return; }
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    const updated = { ...current, approvalStatus: 'approved' as const, approvedBy, approvedAt: new Date().toISOString() };
    setVouchersState(prev => { const u = prev.map(v => v.id === id ? updated : v); return u; });
    supabase.from('vouchers').upsert(withSoc(updated)).then(({ error }) => {
      if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); }
      else syncEntries(updated); // mirror to voucher_entries so SQL reports see the approved entries
    });
  }, [society.fyLocked]);

  const rejectVoucher = useCallback((id: string, rejectedBy: string, reason: string) => {
    if (society.fyLocked) { toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' }); return; }
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    const updated = { ...current, approvalStatus: 'rejected' as const, approvalRemarks: reason, approvedBy: rejectedBy, approvedAt: new Date().toISOString() };
    setVouchersState(prev => { const u = prev.map(v => v.id === id ? updated : v); return u; });
    supabase.from('vouchers').upsert(withSoc(updated)).then(({ error }) => {
      if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); }
      else deleteEntries(id); // rejected vouchers shouldn't impact SQL reports
    });
  }, [society.fyLocked]);

  const addAuditObjection = useCallback((data: Omit<AuditObjection, 'id' | 'objectionNo' | 'createdAt'>): AuditObjection => {
    const maxNum = auditObjectionsRef.current.filter(o => o.objectionNo?.includes(data.auditYear)).reduce((max, o) => {
      const m = o.objectionNo?.match(/\/(\d+)$/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const objectionNo = `AUD/${data.auditYear}/${String(maxNum + 1).padStart(3, '0')}`;
    const newObj: AuditObjection = { ...data, id: crypto.randomUUID(), objectionNo, createdAt: new Date().toISOString() };
    auditObjectionsRef.current = [...auditObjectionsRef.current, newObj];
    setAuditObjectionsState(prev => { const updated = [...prev, newObj]; return updated; });
    supabase.from('audit_objections').upsert(withSoc(newObj)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    return newObj;
  }, []);

  const updateAuditObjection = useCallback((id: string, data: Partial<AuditObjection>) => {
    setAuditObjectionsState(prev => {
      const updated = prev.map(o => o.id === id ? { ...o, ...data } : o);
      const updated_obj = updated.find(o => o.id === id);
      if (updated_obj) supabase.from('audit_objections').upsert(updated_obj).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
      return updated;
    });
  }, []);

  const deleteAuditObjection = useCallback((id: string) => {
    if (society.fyLocked) { toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' }); return; }
    setAuditObjectionsState(prev => { const updated = prev.filter(o => o.id !== id); return updated; });
    supabase.from('audit_objections').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    console.info(`[AUDIT-DELETE] AuditObjection id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, []);

  // ── Recoverables (HAFED Proforma 2) ────────────────────────────────────────
  const addRecoverable = useCallback((data: Omit<Recoverable, 'id' | 'createdAt'>): Recoverable => {
    const newRec: Recoverable = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    recoverablesRef.current = [...recoverablesRef.current, newRec];
    setRecoverablesState(prev => [...prev, newRec]);
    supabase.from('recoverables').upsert(withSoc(newRec)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    return newRec;
  }, []);

  const updateRecoverable = useCallback((id: string, data: Partial<Recoverable>) => {
    setRecoverablesState(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, ...data } : r);
      const upd = updated.find(r => r.id === id);
      if (upd) supabase.from('recoverables').upsert(withSoc(upd)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
      return updated;
    });
  }, []);

  const deleteRecoverable = useCallback((id: string) => {
    if (society.fyLocked) { toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' }); return; }
    setRecoverablesState(prev => prev.filter(r => r.id !== id));
    supabase.from('recoverables').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
  }, []);

  // ── Kachi Aarat (HAFED Proforma 8) ─────────────────────────────────────────
  const addKachiAaratEntry = useCallback((data: Omit<KachiAaratEntry, 'id' | 'createdAt'>): KachiAaratEntry => {
    const newEntry: KachiAaratEntry = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    kachiAaratEntriesRef.current = [...kachiAaratEntriesRef.current, newEntry];
    setKachiAaratEntriesState(prev => [...prev, newEntry]);
    supabase.from('kachi_aarat_entries').upsert(withSoc(newEntry)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    return newEntry;
  }, []);

  const updateKachiAaratEntry = useCallback((id: string, data: Partial<KachiAaratEntry>) => {
    setKachiAaratEntriesState(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, ...data } : e);
      const upd = updated.find(e => e.id === id);
      if (upd) supabase.from('kachi_aarat_entries').upsert(withSoc(upd)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
      return updated;
    });
  }, []);

  const deleteKachiAaratEntry = useCallback((id: string) => {
    if (society.fyLocked) { toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' }); return; }
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
    setP7EntriesState(prev => {
      const filtered = prev.filter(e => e.id !== id);
      return [...filtered, entry];
    });
    p7EntriesRef.current = [...p7EntriesRef.current.filter(e => e.id !== id), entry];
    supabase.from('p7_entries').upsert(withSoc(entry)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    return entry;
  }, []);

  const deleteP7Entry = useCallback((id: string) => {
    if (society.fyLocked) { toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' }); return; }
    setP7EntriesState(prev => prev.filter(e => e.id !== id));
    supabase.from('p7_entries').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
  }, []);

  const addMember = useCallback((data: Omit<Member, 'id'>): Member => {
    const newMember: Member = { ...data, id: crypto.randomUUID() };
    setMembersState(prev => {
      const updated = [...prev, newMember];
      return updated;
    });
    supabase.from('members').upsert(withSoc(newMember)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    // Skip auto-vouchers for pending applications (created on approval)
    if (newMember.approvalStatus === 'pending') return newMember;
    // Auto-create Receipt vouchers for Share Capital and Admission Fee
    if ((newMember.shareCapital || 0) > 0) {
      const v: Voucher = { id: crypto.randomUUID(), voucherNo: storage.getNextVoucherNo('receipt', society.financialYear, vouchersRef.current), type: 'receipt', date: newMember.joinDate, debitAccountId: ACCOUNT_IDS.CASH, creditAccountId: ACCOUNT_IDS.SHARE_CAP, amount: newMember.shareCapital, narration: `Share Capital received from ${newMember.name}`, memberId: newMember.id, createdAt: new Date().toISOString() };
      vouchersRef.current = [...vouchersRef.current, v];
      setVouchersState(prev => { const updated = [...prev, v]; return updated; });
      supabase.from('vouchers').upsert(withSoc(v)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    }
    if ((newMember.admissionFee || 0) > 0) {
      const v: Voucher = { id: crypto.randomUUID(), voucherNo: storage.getNextVoucherNo('receipt', society.financialYear, vouchersRef.current), type: 'receipt', date: newMember.joinDate, debitAccountId: ACCOUNT_IDS.CASH, creditAccountId: ACCOUNT_IDS.ADM_FEE, amount: newMember.admissionFee!, narration: `Admission Fee received from ${newMember.name}`, memberId: newMember.id, createdAt: new Date().toISOString() };
      vouchersRef.current = [...vouchersRef.current, v];
      setVouchersState(prev => { const updated = [...prev, v]; return updated; });
      supabase.from('vouchers').upsert(withSoc(v)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    }
    return newMember;
  }, [society.financialYear]);

  const updateMember = useCallback((id: string, data: Partial<Member>) => {
    const oldMember = membersRef.current.find(m => m.id === id);
    if (!oldMember) return;
    const updatedMember = { ...oldMember, ...data };
    setMembersState(prev => {
      const updated = prev.map(m => m.id === id ? updatedMember : m);
      return updated;
    });
    supabase.from('members').upsert(withSoc(updatedMember)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
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
    if (society.fyLocked) { toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' }); return; }
    setMembersState(prev => {
      const updated = prev.filter(m => m.id !== id);
      return updated;
    });
    supabase.from('members').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    console.info(`[AUDIT-DELETE] Member id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, []);

  const approveMember = useCallback((id: string) => {
    const member = membersRef.current.find(m => m.id === id);
    if (!member) return;
    const approved = { ...member, approvalStatus: 'approved' as const };
    setMembersState(prev => prev.map(m => m.id === id ? approved : m));
    supabase.from('members').upsert(withSoc(approved)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    // Now create auto-vouchers for Share Capital and Admission Fee
    if ((approved.shareCapital || 0) > 0) {
      const v: Voucher = { id: crypto.randomUUID(), voucherNo: storage.getNextVoucherNo('receipt', society.financialYear, vouchersRef.current), type: 'receipt', date: approved.joinDate, debitAccountId: ACCOUNT_IDS.CASH, creditAccountId: ACCOUNT_IDS.SHARE_CAP, amount: approved.shareCapital, narration: `Share Capital received from ${approved.name}`, memberId: approved.id, createdAt: new Date().toISOString() };
      vouchersRef.current = [...vouchersRef.current, v];
      setVouchersState(prev => [...prev, v]);
      supabase.from('vouchers').upsert(withSoc(v)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    }
    if ((approved.admissionFee || 0) > 0) {
      const v: Voucher = { id: crypto.randomUUID(), voucherNo: storage.getNextVoucherNo('receipt', society.financialYear, vouchersRef.current), type: 'receipt', date: approved.joinDate, debitAccountId: ACCOUNT_IDS.CASH, creditAccountId: ACCOUNT_IDS.ADM_FEE, amount: approved.admissionFee!, narration: `Admission Fee received from ${approved.name}`, memberId: approved.id, createdAt: new Date().toISOString() };
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
    const newAccount: LedgerAccount = { ...data, id: crypto.randomUUID() };
    setAccountsState(prev => {
      const updated = [...prev, newAccount];
      return updated;
    });
    supabase.from('accounts').upsert(withSoc(newAccount)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    return newAccount;
  }, []);

  const updateAccount = useCallback((id: string, data: Partial<LedgerAccount>) => {
    setAccountsState(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, ...data } : a);
      const updatedAccount = updated.find(a => a.id === id);
      if (updatedAccount) supabase.from('accounts').upsert(updatedAccount).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
      return updated;
    });
  }, []);

  const deleteAccount = useCallback((id: string) => {
    if (society.fyLocked) { toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' }); return; }

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
    const fy = society.financialYear;
    const maxNum = loansRef.current.filter(l => l.loanNo?.includes(fy)).reduce((max, l) => {
      const m = l.loanNo?.match(/\/(\d+)$/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const loanNo = `L/${fy}/${String(maxNum + 1).padStart(3, '0')}`;
    const newLoan: Loan = { ...data, id: crypto.randomUUID(), loanNo, createdAt: new Date().toISOString() };
    loansRef.current = [...loansRef.current, newLoan];
    setLoansState(prev => { const updated = [...prev, newLoan]; return updated; });
    supabase.from('loans').upsert(withSoc(newLoan)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });

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
    setLoansState(prev => {
      const updated = prev.map(l => l.id === id ? { ...l, ...data } : l);
      const updatedLoan = updated.find(l => l.id === id);
      if (updatedLoan) supabase.from('loans').upsert(updatedLoan).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
      return updated;
    });
  }, []);

  const deleteLoan = useCallback((id: string) => {
    if (society.fyLocked) { toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' }); return; }
    setLoansState(prev => { const updated = prev.filter(l => l.id !== id); return updated; });
    supabase.from('loans').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    console.info(`[AUDIT-DELETE] Loan id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, []);

  const addAsset = useCallback((data: Omit<Asset, 'id' | 'assetNo'>): Asset => {
    const maxNum = assetsRef.current.reduce((max, a) => {
      const m = a.assetNo?.match(/AST\/(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const assetNo = `AST/${String(maxNum + 1).padStart(4, '0')}`;
    const newAsset: Asset = { ...data, id: crypto.randomUUID(), assetNo };
    assetsRef.current = [...assetsRef.current, newAsset];
    setAssetsState(prev => { const updated = [...prev, newAsset]; return updated; });
    supabase.from('assets').upsert(withSoc(newAsset)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    return newAsset;
  }, []);

  const updateAsset = useCallback((id: string, data: Partial<Asset>) => {
    setAssetsState(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, ...data } : a);
      const updatedAsset = updated.find(a => a.id === id);
      if (updatedAsset) supabase.from('assets').upsert(updatedAsset).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
      return updated;
    });
  }, []);

  const deleteAsset = useCallback((id: string) => {
    if (society.fyLocked) { toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' }); return; }
    setAssetsState(prev => { const updated = prev.filter(a => a.id !== id); return updated; });
    supabase.from('assets').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    console.info(`[AUDIT-DELETE] Asset id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, []);

  // ── Depreciation Posting ───────────────────────────────────────────────────
  // Posts one journal entry per active depreciable asset for the given FY.
  // Skips assets already posted, with zero rate, Land category, or disposed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const postDepreciation = useCallback((fy?: string): { posted: number; skipped: number } => {
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

      // Accumulated depreciation posted so far (for WDV book value)
      const accumAcc = currentAccounts.find(a => a.id === depAcc.accumId);
      let priorAccumDep = 0;
      if (accumAcc) {
        let bal = accumAcc.openingBalanceType === 'debit' ? accumAcc.openingBalance : -accumAcc.openingBalance;
        currentVouchers.forEach(v => {
          if (v.debitAccountId  === depAcc.accumId) bal += v.amount;
          if (v.creditAccountId === depAcc.accumId) bal -= v.amount;
        });
        priorAccumDep = -bal; // credit-balance accounts return negative; flip to positive
      }

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
    const openingCash = cashAccount?.openingBalance ?? 0;
    const openingBank = bankIds.reduce((sum, bid) => {
      const acc = accounts.find(a => a.id === bid);
      return sum + (acc?.openingBalance ?? 0);
    }, 0);

    const receiptMap: Record<string, { name: string; amount: number }> = {};
    const paymentMap: Record<string, { name: string; amount: number }> = {};

    // M15: Honor asOnDate so historical Day Book / Balance Sheet lookups stay accurate.
    const vouchersToUse = asOnDate ? activeVouchers.filter(v => v.date <= asOnDate) : activeVouchers;
    // BUG-02 FIX: Use getVoucherLines() to handle multi-line Expert Mode vouchers.
    // For each line touching Cash/Bank, find the "other" side accounts in the same voucher.
    vouchersToUse.forEach(v => {
      const lines = getVoucherLines(v);
      lines.forEach(l => {
        const isCashBank = l.accountId === ACCOUNT_IDS.CASH || isBankAccount(l.accountId, accounts);
        if (!isCashBank) return;

        // Determine other-side lines (contra side)
        const otherLines = lines.filter(ol => ol.type !== l.type);
        if (otherLines.length === 0) return;

        if (l.type === 'Dr') {
          otherLines.forEach(ol => {
            const otherAcc = accounts.find(a => a.id === ol.accountId);
            const name = otherAcc?.name || v.narration || 'Deleted Account';
            const nameHi = otherAcc?.nameHi || name;
            if (!receiptMap[ol.accountId]) receiptMap[ol.accountId] = { name, nameHi, amount: 0 };
            receiptMap[ol.accountId].amount += ol.amount;
          });
        } else {
          otherLines.forEach(ol => {
            const otherAcc = accounts.find(a => a.id === ol.accountId);
            const name = otherAcc?.name || v.narration || 'Deleted Account';
            const nameHi = otherAcc?.nameHi || name;
            if (!paymentMap[ol.accountId]) paymentMap[ol.accountId] = { name, nameHi, amount: 0 };
            paymentMap[ol.accountId].amount += ol.amount;
          });
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
      receipts: Object.entries(receiptMap).map(([id, v]) => ({ accountId: id, accountName: v.name, accountNameHi: (v as any).nameHi || v.name, amount: v.amount })),
      payments: Object.entries(paymentMap).map(([id, v]) => ({ accountId: id, accountName: v.name, accountNameHi: (v as any).nameHi || v.name, amount: v.amount })),
      closingCash,
      closingBank,
    };
  }, [accounts, vouchers, activeVouchers]);

  const getTradingAccount = useCallback((asOnDate?: string) => {
    // M15: Pass asOnDate to underlying TB so historical Trading A/c is consistent.
    const tb = getTrialBalance(asOnDate);
    const fy = society.financialYear;

    // Cr side: Sales / Trading Income (parentId '4100')
    const salesItems = tb
      .filter(b => b.account.parentId === '4100')
      .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: Math.abs(b.netBalance) }))
      .filter(i => i.amount > 0);

    // Cr side: Closing Stock from ledger (net debit balance of inventory accounts under parentId '3400')
    const ledgerClosingItems = tb
      .filter(b => b.account.parentId === '3400')
      .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: Math.max(0, b.netBalance) }))
      .filter(i => i.amount > 0);

    // Physical closing stock — use movement-based qty (same formula as Inventory/Stock Valuation)
    // so that orphan currentStock left over from old buggy edits/deletes doesn't show as phantom stock.
    // M15: Filter movements by asOnDate so historical Trading A/c matches its date window.
    const movementsToUse = asOnDate ? stockMovements.filter(m => m.date <= asOnDate) : stockMovements;
    const physicalClosingStock = stockItems
      .filter(s => s.isActive)
      .reduce((sum, s) => {
        let qty = s.openingStock || 0;
        for (const m of movementsToUse) {
          if (m.itemId !== s.id) continue;
          if (m.type === 'purchase' || (m.type === 'adjustment' && m.qty > 0)) qty += m.qty;
          else qty -= Math.abs(m.qty);
        }
        qty = Math.max(0, qty);
        return sum + qty * (s.purchaseRate || 0);
      }, 0);

    // Check if closing stock journal has been posted for this FY — use getVoucherLines() (Rule 4)
    const closingStockPosted = activeVouchers.some(v =>
      getVoucherLines(v).some(l => l.accountId === '3403' && l.type === 'Dr') &&
      getVoucherLines(v).some(l => l.accountId === '5101' && l.type === 'Cr') &&
      v.narration.includes(fy)
    );

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

    // Dr side: Purchases (account 5101)
    const purchaseItems = tb
      .filter(b => b.account.id === '5101')
      .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: b.netBalance }))
      .filter(i => i.amount > 0);

    // Dr side: Direct Expenses (parentId '5100', excluding 5101 Purchase)
    const directExpItems = tb
      .filter(b => b.account.parentId === '5100' && b.account.id !== '5101')
      .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: b.netBalance }))
      .filter(i => i.amount > 0);

    const totalSales        = salesItems.reduce((s, i) => s + i.amount, 0);
    const totalClosingStock = closingStockItems.reduce((s, i) => s + i.amount, 0);
    const totalOpeningStock = openingStockItems.reduce((s, i) => s + i.amount, 0);
    const totalPurchases    = purchaseItems.reduce((s, i) => s + i.amount, 0);
    const totalDirectExp    = directExpItems.reduce((s, i) => s + i.amount, 0);

    const crTotal   = totalSales + totalClosingStock;
    const drTotal   = totalOpeningStock + totalPurchases + totalDirectExp;
    const grossProfit = crTotal - drTotal;

    return { salesItems, closingStockItems, openingStockItems, purchaseItems, directExpItems,
      totalSales, totalClosingStock, totalOpeningStock, totalPurchases, totalDirectExp, grossProfit,
      physicalClosingStock, closingStockPosted };
  }, [getTrialBalance, stockItems, stockMovements, activeVouchers, society.financialYear]);

  const postClosingStock = useCallback((fy?: string): { posted: boolean; amount: number; alreadyPosted: boolean } => {
    const currentFY = fy ?? society.financialYear;
    // Check if already posted — use getVoucherLines() to support Expert Mode multi-line vouchers (Rule 4)
    const alreadyPosted = activeVouchers.some(v =>
      getVoucherLines(v).some(l => l.accountId === '3403' && l.type === 'Dr') &&
      getVoucherLines(v).some(l => l.accountId === '5101' && l.type === 'Cr') &&
      v.narration.includes(currentFY)
    );
    if (alreadyPosted) return { posted: false, amount: 0, alreadyPosted: true };

    // Use movement-based qty (same formula as Inventory / Stock Valuation / Trading Account)
    // so the journal posts the same number user sees in reports.
    const amount = stockItems
      .filter(s => s.isActive)
      .reduce((sum, s) => {
        let qty = s.openingStock || 0;
        for (const m of stockMovements) {
          if (m.itemId !== s.id) continue;
          if (m.type === 'purchase' || (m.type === 'adjustment' && m.qty > 0)) qty += m.qty;
          else qty -= Math.abs(m.qty);
        }
        qty = Math.max(0, qty);
        return sum + qty * (s.purchaseRate || 0);
      }, 0);

    if (amount <= 0) return { posted: false, amount: 0, alreadyPosted: false };

    addVoucher({
      type: 'journal',
      date: new Date().toISOString().split('T')[0],
      debitAccountId: '3403',   // Trading Goods inventory
      creditAccountId: '5101',  // Purchase (reduces net purchase cost)
      amount,
      narration: `Closing Stock at year end — FY ${currentFY}`,
      createdBy: user?.name ?? 'System',
    });
    return { posted: true, amount, alreadyPosted: false };
  }, [stockItems, stockMovements, activeVouchers, society.financialYear, addVoucher, user?.name]);

  const getProfitLoss = useCallback((asOnDate?: string) => {
    // M15: Pass asOnDate to underlying TB so historical P&L is accurate.
    const tb = getTrialBalance(asOnDate);
    // Income accounts are credit-nature: netBalance = debit - credit → normally negative → abs gives the income amount.
    const incomeItems = tb
      .filter(b => b.account.type === 'income' && b.netBalance !== 0)
      .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: Math.abs(b.netBalance) }));
    // P2-4 FIX: Expense accounts are debit-nature: netBalance > 0 = normal expense.
    // If netBalance < 0 (Cr balance = refund / over-credit), keep it negative so it
    // correctly REDUCES total expenses rather than inflating them via Math.abs().
    // This was the root cause of the Rs. 1,234 deficit understatement in the audit.
    const expenseItems = tb
      .filter(b => b.account.type === 'expense' && b.netBalance !== 0)
      .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: b.netBalance }));
    const totalIncome = incomeItems.reduce((s, i) => s + i.amount, 0);
    const totalExpenses = expenseItems.reduce((s, i) => s + i.amount, 0);
    return { incomeItems, expenseItems, totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses };
  }, [getTrialBalance]);

  // ── Inventory ──────────────────────────────────────────────────────────────
  // Two-step stock_items save pattern (same as purchases for GST/TDS columns):
  // Step 1: upsert base columns only — schema cache always knows these, never fails.
  // Step 2: update the late-added columns (stockGroup, salesAccountId, purchaseAccountId,
  // p4Category, valuationMethod) separately. If user hasn't run the ALTER TABLE migration
  // yet, only step 2 fails — local state stays consistent and base save still works.
  const persistStockItem = (item: StockItem) => {
    const { salesAccountId, purchaseAccountId, stockGroup, p4Category, valuationMethod, ...baseCols } = item;
    supabase.from('stock_items').upsert(withSoc(baseCols)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message);
        toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' });
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
    // Derive next item code from existing items (not localStorage counter) to prevent duplicates
    let newItem: StockItem;
    setStockItemsState(prev => {
      const maxNum = prev.reduce((max, i) => {
        const m = i.itemCode?.match(/ITM\/(\d+)/);
        return m ? Math.max(max, parseInt(m[1])) : max;
      }, 0);
      const itemCode = `ITM/${String(maxNum + 1).padStart(3, '0')}`;
      newItem = { ...data, id: crypto.randomUUID(), itemCode };
      persistStockItem(newItem);
      return [...prev, newItem];
    });
    return newItem!;
  }, []);

  const updateStockItem = useCallback((id: string, data: Partial<StockItem>) => {
    setStockItemsState(prev => {
      const updated = prev.map(i => i.id === id ? { ...i, ...data } : i);
      const updatedItem = updated.find(i => i.id === id);
      if (updatedItem) persistStockItem(updatedItem);
      return updated;
    });
  }, []);

  const deleteStockItem = useCallback((id: string) => {
    if (society.fyLocked) { toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' }); return; }
    const today = new Date().toISOString().split('T')[0];
    setStockItemsState(prev => {
      const item = prev.find(i => i.id === id);
      // If item has remaining stock, create a write-off journal to keep Trial Balance balanced
      if (item && item.isActive && item.currentStock > 0) {
        const amount = Math.round(item.currentStock * item.purchaseRate * 100) / 100;
        if (amount > 0) {
          // Dr 5101 (Purchases/Write-off expense) / Cr 3403 (Closing Stock asset) — reverses closing stock asset
          addVoucher({
            type: 'journal',
            date: today,
            debitAccountId: '5101',
            creditAccountId: '3403',
            amount,
            narration: `Stock write-off on deletion: ${item.name} (${item.currentStock} ${item.unit} @ ₹${item.purchaseRate})`,
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
    const movement: StockMovement = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    stockMovementsRef.current = [...stockMovementsRef.current, movement];
    setStockMovementsState(prev => [...prev, movement]);
    supabase.from('stock_movements').upsert(withSoc(movement)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });

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
  }, [society.financialYear, customers, addVoucher]);

  const deleteSale = useCallback((id: string) => {
    if (society.fyLocked) { toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' }); return; }
    setSalesState(prev => {
      const sale = prev.find(s => s.id === id);
      if (sale) {
        const now = new Date().toISOString();
        // Soft-delete all linked vouchers (main + GST)
        const linkedIds = [sale.voucherId, ...(sale.gstVoucherIds ?? [])].filter(Boolean) as string[];
        if (linkedIds.length > 0) {
          setVouchersState(v => {
            const updated = v.map(x => linkedIds.includes(x.id)
              ? { ...x, isDeleted: true, deletedAt: now, deletedBy: 'System', deletedReason: `Sale ${sale.saleNo} deleted` }
              : x
            );
            linkedIds.forEach(vid => {
              const cancelled = updated.find(x => x.id === vid);
              if (cancelled) supabase.from('vouchers').upsert(cancelled).then(({ error }) => {
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
    if (society.fyLocked) {
      toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' });
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
    const linkedIds = [original.voucherId, ...(original.gstVoucherIds ?? [])].filter(Boolean) as string[];
    if (linkedIds.length > 0) {
      setVouchersState(v => {
        const updated = v.map(x => linkedIds.includes(x.id)
          ? { ...x, isDeleted: true, deletedAt: now, deletedBy: data.createdBy || 'System', deletedReason: `Sale ${original.saleNo} edited` }
          : x
        );
        linkedIds.forEach(vid => {
          const cancelled = updated.find(x => x.id === vid);
          if (cancelled) supabase.from('vouchers').upsert(cancelled).then(({ error }) => {
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
  }, [society.fyLocked, customers, accounts, addVoucher]);

  // ── Purchases ──────────────────────────────────────────────────────────────
  const addPurchase = useCallback((data: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt'>): Purchase => {
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
    const netPayable = grandTotal - (data.tdsAmount || 0);
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
  }, [society.financialYear, suppliers, addVoucher]);

  const deletePurchase = useCallback((id: string) => {
    if (society.fyLocked) { toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' }); return; }
    setPurchasesState(prev => {
      const purchase = prev.find(p => p.id === id);
      if (purchase) {
        const now = new Date().toISOString();
        // Cascade soft-delete: main voucher + all GST/TDS tax vouchers
        const linkedIds = [purchase.voucherId, ...(purchase.taxVoucherIds ?? [])].filter(Boolean) as string[];
        if (linkedIds.length > 0) {
          setVouchersState(v => {
            const updated = v.map(x => linkedIds.includes(x.id)
              ? { ...x, isDeleted: true, deletedAt: now, deletedBy: 'System', deletedReason: `Purchase ${purchase.purchaseNo} deleted` }
              : x
            );
            linkedIds.forEach(vid => {
              const cancelled = updated.find(x => x.id === vid);
              if (cancelled) supabase.from('vouchers').upsert(cancelled).then(({ error }) => {
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
    if (society.fyLocked) {
      toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' });
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
    const linkedIds = [original.voucherId, ...(original.taxVoucherIds ?? [])].filter(Boolean) as string[];
    if (linkedIds.length > 0) {
      setVouchersState(v => {
        const updated = v.map(x => linkedIds.includes(x.id)
          ? { ...x, isDeleted: true, deletedAt: now, deletedBy: data.createdBy || 'System', deletedReason: `Purchase ${original.purchaseNo} edited` }
          : x
        );
        linkedIds.forEach(vid => {
          const cancelled = updated.find(x => x.id === vid);
          if (cancelled) supabase.from('vouchers').upsert(cancelled).then(({ error }) => {
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
    const netPayable = grandTotal - (data.tdsAmount || 0);
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
  }, [society.fyLocked, suppliers, accounts, addVoucher]);

  // ── Employees ──────────────────────────────────────────────────────────────
  const addEmployee = useCallback((data: Omit<Employee, 'id' | 'empNo'>): Employee => {
    const maxEmpNum = employeesRef.current.reduce((max, e) => {
      const m = e.empNo?.match(/EMP\/(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const empNo = `EMP/${String(maxEmpNum + 1).padStart(3, '0')}`;
    const emp: Employee = { ...data, id: crypto.randomUUID(), empNo };
    employeesRef.current = [...employeesRef.current, emp];
    setEmployeesState(prev => { const updated = [...prev, emp]; return updated; });
    supabase.from('employees').upsert(withSoc(emp)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    return emp;
  }, []);

  const updateEmployee = useCallback((id: string, data: Partial<Employee>) => {
    setEmployeesState(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, ...data } : e);
      const updatedEmp = updated.find(e => e.id === id);
      if (updatedEmp) supabase.from('employees').upsert(updatedEmp).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
      return updated;
    });
  }, []);

  const deleteEmployee = useCallback((id: string) => {
    if (society.fyLocked) { toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' }); return; }
    setEmployeesState(prev => { const updated = prev.filter(e => e.id !== id); return updated; });
    supabase.from('employees').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    console.info(`[AUDIT-DELETE] Employee id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, []);

  // ── Salary Records ─────────────────────────────────────────────────────────
  const addSalaryRecord = useCallback((data: Omit<SalaryRecord, 'id' | 'slipNo' | 'createdAt'>): SalaryRecord => {
    const fy = society.financialYear;
    const maxSlipNum = salaryRecordsRef.current.filter(r => r.slipNo?.includes(fy)).reduce((max, r) => {
      const m = r.slipNo?.match(/\/(\d+)$/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const slipNo = `SAL/${fy}/${String(maxSlipNum + 1).padStart(3, '0')}`;
    const record: SalaryRecord = { ...data, id: crypto.randomUUID(), slipNo, createdAt: new Date().toISOString() };
    salaryRecordsRef.current = [...salaryRecordsRef.current, record];
    setSalaryRecordsState(prev => { const updated = [...prev, record]; return updated; });
    supabase.from('salary_records').upsert(withSoc(record)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    return record;
  }, [society.financialYear]);

  const updateSalaryRecord = useCallback((id: string, data: Partial<SalaryRecord>) => {
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
      if (v && !v.isDeleted) {
        const cancelled = { ...v, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: 'System', deletedReason: `Salary slip ${oldRecord.slipNo} marked unpaid` };
        setVouchersState(prev => prev.map(x => x.id === v.id ? cancelled : x));
        supabase.from('vouchers').upsert(withSoc(cancelled)).then(({ error }) => {
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
    supabase.from('salary_records').upsert(merged).then(({ error }) => {
      if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); }
    });
  }, [employees, accounts, addVoucher]);

  const deleteSalaryRecord = useCallback((id: string) => {
    if (society.fyLocked) { toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' }); return; }
    // H8: Cascade-cancel the linked payment voucher (if any) so accounting reverses
    const record = salaryRecordsRef.current.find(r => r.id === id);
    if (record?.voucherId) {
      const v = vouchersRef.current.find(x => x.id === record.voucherId);
      if (v && !v.isDeleted) {
        const cancelled = { ...v, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: 'System', deletedReason: `Salary slip ${record.slipNo} deleted` };
        setVouchersState(prev => prev.map(x => x.id === v.id ? cancelled : x));
        supabase.from('vouchers').upsert(withSoc(cancelled)).then(({ error }) => {
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
    if (society.fyLocked) { toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' }); return; }
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
    if (society.fyLocked) { toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' }); return; }
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
      suppliers, customers, kccLoans,
      addVoucher, updateVoucher, cancelVoucher, restoreVoucher, clearVoucher, unclearVoucher, approveVoucher, rejectVoucher,
      addMember, updateMember, deleteMember, approveMember, rejectMember,
      addAccount, updateAccount, deleteAccount, mergeAccounts, resetAccounts, updateSociety,
      addLoan, updateLoan, deleteLoan,
      addAsset, updateAsset, deleteAsset, postDepreciation,
      addAuditObjection, updateAuditObjection, deleteAuditObjection,
      recoverables, addRecoverable, updateRecoverable, deleteRecoverable,
      kachiAaratEntries, addKachiAaratEntry, updateKachiAaratEntry, deleteKachiAaratEntry,
      p7Entries, upsertP7Entry, deleteP7Entry,
      addStockItem, updateStockItem, deleteStockItem, addStockMovement,
      addSale, updateSale, deleteSale,
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

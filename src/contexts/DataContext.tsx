import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type {
  Voucher, VoucherEditSnapshot, VoucherLine, Member, LedgerAccount, SocietySettings,
  AccountBalance, CashBookEntry, BankBookEntry, MemberLedgerEntry, ReceiptsPaymentsData,
  Loan, Asset, AuditObjection,
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
import { ACCOUNT_IDS, CMS_SOCIETY_ACCOUNTS } from '@/lib/storage';
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

  addMember: (data: Omit<Member, 'id'>) => Member;
  updateMember: (id: string, data: Partial<Member>) => void;
  deleteMember: (id: string) => void;

  addAccount: (data: Omit<LedgerAccount, 'id'>) => LedgerAccount;
  updateAccount: (id: string, data: Partial<LedgerAccount>) => void;
  deleteAccount: (id: string) => void;
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
  deleteSale: (id: string) => void;

  // Purchases
  purchases: Purchase[];
  addPurchase: (data: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt'>) => Purchase;
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
  getBankBookEntries: (fromDate?: string, toDate?: string) => BankBookEntry[];
  getTrialBalance: (asOnDate?: string) => AccountBalance[];
  getMemberLedger: (memberId: string) => MemberLedgerEntry[];
  getProfitLoss: () => {
    incomeItems: { name: string; nameHi: string; amount: number }[];
    expenseItems: { name: string; nameHi: string; amount: number }[];
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
  };
  getReceiptsPayments: () => ReceiptsPaymentsData;
  getTradingAccount: () => {
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
  getEntityLinks: (entityType: 'member' | 'customer' | 'supplier' | 'stockItem' | 'employee' | 'account' | 'loan', id: string) => EntityLink[];
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
  const [stockItems, setStockItemsState] = useState<StockItem[]>([]);
  const [stockMovements, setStockMovementsState] = useState<StockMovement[]>([]);
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

    const loadFromSupabase = async () => {
      try {
        const [
          { data: vData, error: vErr }, { data: mData }, { data: aData },
          { data: lData }, { data: asData }, { data: aoData },
          { data: siData }, { data: smData }, { data: slData },
          { data: puData }, { data: emData }, { data: srData },
          { data: socData }, { data: supData }, { data: cusData },
          { data: kccData },
        ] = await Promise.all([
          supabase.from('vouchers').select('*').eq('society_id', sid).order('createdAt'),
          supabase.from('members').select('*').eq('society_id', sid),
          supabase.from('accounts').select('*').eq('society_id', sid),
          supabase.from('loans').select('*').eq('society_id', sid),
          supabase.from('assets').select('*').eq('society_id', sid),
          supabase.from('audit_objections').select('*').eq('society_id', sid),
          supabase.from('stock_items').select('*').eq('society_id', sid),
          supabase.from('stock_movements').select('*').eq('society_id', sid).order('createdAt'),
          supabase.from('sales').select('*').eq('society_id', sid).order('createdAt'),
          supabase.from('purchases').select('*').eq('society_id', sid).order('createdAt'),
          supabase.from('employees').select('*').eq('society_id', sid),
          supabase.from('salary_records').select('*').eq('society_id', sid).order('createdAt'),
          supabase.from('society_settings').select('*').eq('society_id', sid).limit(1),
          supabase.from('suppliers').select('*').eq('society_id', sid),
          supabase.from('customers').select('*').eq('society_id', sid),
          supabase.from('kcc_loans').select('*').eq('society_id', sid),
        ]);

        if (vErr) console.warn('Vouchers query error:', vErr.message);
        // Load vouchers — safe first, auto-migration separate
        if (vData && vData.length > 0) { setVouchersState(vData); storage.setVouchers(vData); }
        else if (!vErr) setVouchersState([]);
        if (mData && mData.length > 0) { setMembersState(mData); storage.setMembers(mData); }
        else setMembersState([]);

        // Load accounts from Supabase; fall back to CMS template (never stale localStorage) if none exist
        const rawAccts: LedgerAccount[] = aData && aData.length > 0 ? [...aData] : [...CMS_SOCIETY_ACCOUNTS];
        const { accounts: baseAccts, changed: acctsMigrated } = storage.migrateAccounts(rawAccts);
        setAccountsState(baseAccts);
        storage.setAccounts(baseAccts);
        // Sync migrated accounts back to Supabase if anything changed
        if (acctsMigrated) {
          supabase.from('accounts').delete().eq('society_id', sid).then(() => {
            const rows = baseAccts.map(a => ({ ...a, society_id: sid }));
            supabase.from('accounts').insert(rows).then(({ error }) => {
              if (error) console.warn('Account migration sync error:', error.message);
            });
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
        setSalesState(slData || []);
        setPurchasesState(puData || []);
        setEmployeesState(emData || []);
        setSalaryRecordsState(srData || []);
        setSuppliersState(supData || []);
        setCustomersState(cusData || []);
        setKccLoansState(kccData || []);

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

  const addVoucher = useCallback((data: Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'> & { voucherNo?: string }): Voucher => {
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
    supabase.from('vouchers').upsert(withSoc(newVoucher)).then(({ error }) => {
      if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); }
      else syncEntries(newVoucher);
    });
    return newVoucher;
  }, [society.financialYear]);

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
    // Strip editHistory from main upsert — PostgREST schema cache may lag after column additions.
    // editHistory is saved separately via .update() so it never blocks the primary save.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { editHistory: _eh, ...voucherForDb } = updatedVoucher;
    supabase.from('vouchers').upsert(withSoc(voucherForDb)).then(({ error }) => {
      if (error) {
        console.error('Voucher save failed:', error.message);
        // Revert local state so UI matches what's actually in Supabase
        vouchersRef.current = vouchersRef.current.map(v => v.id === id ? current : v);
        setVouchersState(prev => prev.map(v => v.id === id ? current : v));
        toastRef.current({
          title: 'Save failed — voucher not updated',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        syncEntries(updatedVoucher);
        if (updatedVoucher.editHistory && updatedVoucher.editHistory.length > 0) {
          // Save editHistory separately once main save succeeds
          supabase.from('vouchers')
            .update({ editHistory: updatedVoucher.editHistory })
            .eq('id', id)
            .then(({ error: ehErr }) => { if (ehErr) console.warn('editHistory update:', ehErr.message); });
        }
      }
    });
  }, []);

  const cancelVoucher = useCallback((id: string, reason: string, deletedBy: string) => {
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;

    // 🔒 Block deletion of vouchers linked to Purchase/Sale — must delete from their module
    if (current.refType === 'purchase') {
      toastRef.current({
        title: 'Voucher delete nahi ho sakta',
        description: 'Ye voucher Purchase Management se bana hai. Isko Purchase Management → Purchase List se delete karo — stock bhi sahi rahega.',
        variant: 'destructive',
      });
      return;
    }
    if (current.refType === 'sale') {
      toastRef.current({
        title: 'Voucher delete nahi ho sakta',
        description: 'Ye voucher Sale Management se bana hai. Isko Sale Management → Sale List se delete karo — stock bhi sahi rahega.',
        variant: 'destructive',
      });
      return;
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { deletedAt: _da, deletedBy: _db, deletedReason: _dr, ...rest } = current as Voucher & { deletedAt?: string; deletedBy?: string; deletedReason?: string };
    const restoredVoucher = { ...rest, isDeleted: false };
    setVouchersState(prev => {
      const updated = prev.map(v => v.id === id ? restoredVoucher : v);
      return updated;
    });
    supabase.from('vouchers').upsert(withSoc(restoredVoucher)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
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
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    const updated = { ...current, approvalStatus: 'approved' as const, approvedBy, approvedAt: new Date().toISOString() };
    setVouchersState(prev => { const u = prev.map(v => v.id === id ? updated : v); return u; });
    supabase.from('vouchers').upsert(withSoc(updated)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
  }, []);

  const rejectVoucher = useCallback((id: string, rejectedBy: string, reason: string) => {
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    const updated = { ...current, approvalStatus: 'rejected' as const, approvalRemarks: reason, approvedBy: rejectedBy, approvedAt: new Date().toISOString() };
    setVouchersState(prev => { const u = prev.map(v => v.id === id ? updated : v); return u; });
    supabase.from('vouchers').upsert(withSoc(updated)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
  }, []);

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
    setAuditObjectionsState(prev => { const updated = prev.filter(o => o.id !== id); return updated; });
    supabase.from('audit_objections').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
  }, []);

  const addMember = useCallback((data: Omit<Member, 'id'>): Member => {
    const newMember: Member = { ...data, id: crypto.randomUUID() };
    setMembersState(prev => {
      const updated = [...prev, newMember];
      return updated;
    });
    supabase.from('members').upsert(withSoc(newMember)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
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
    // Update Share Capital voucher if amount changed
    if (data.shareCapital !== undefined && data.shareCapital !== oldMember.shareCapital) {
      const scv = vouchersRef.current.find(v => v.memberId === id && v.creditAccountId === ACCOUNT_IDS.SHARE_CAP && !v.isDeleted);
      if (scv) {
        const updated = { ...scv, amount: data.shareCapital };
        setVouchersState(prev => { const list = prev.map(v => v.id === scv.id ? updated : v); return list; });
        supabase.from('vouchers').upsert(withSoc(updated)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
      }
    }
    // Update Admission Fee voucher if amount changed
    if (data.admissionFee !== undefined && data.admissionFee !== oldMember.admissionFee) {
      const afv = vouchersRef.current.find(v => v.memberId === id && v.creditAccountId === ACCOUNT_IDS.ADM_FEE && !v.isDeleted);
      if (afv) {
        const updated = { ...afv, amount: data.admissionFee };
        setVouchersState(prev => { const list = prev.map(v => v.id === afv.id ? updated : v); return list; });
        supabase.from('vouchers').upsert(withSoc(updated)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
      }
    }
  }, []);

  const deleteMember = useCallback((id: string) => {
    setMembersState(prev => {
      const updated = prev.filter(m => m.id !== id);
      return updated;
    });
    supabase.from('members').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
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
    setAccountsState(prev => {
      const updated = prev.filter(a => a.id !== id);
      return updated;
    });
    supabase.from('accounts').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
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

  const getBankBookEntries = useCallback((fromDate?: string, toDate?: string): BankBookEntry[] => {
    const bankAccount = accounts.find(a => a.id === ACCOUNT_IDS.BANK);
    if (!bankAccount) return [];
    let runningBalance = bankAccount.openingBalanceType === 'debit'
      ? bankAccount.openingBalance
      : -bankAccount.openingBalance;

    const bankVouchers = activeVouchers
      .filter(v => getVoucherLines(v).some(l => l.accountId === ACCOUNT_IDS.BANK))
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

    if (fromDate) {
      bankVouchers.filter(v => v.date < fromDate).forEach(v => {
        getVoucherLines(v).filter(l => l.accountId === ACCOUNT_IDS.BANK).forEach(l => {
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
        const bankLines = getVoucherLines(v).filter(l => l.accountId === ACCOUNT_IDS.BANK);
        bankLines.forEach(l => {
          runningBalance += l.type === 'Dr' ? l.amount : -l.amount;
          const otherLines = getVoucherLines(v).filter(ol => ol.accountId !== ACCOUNT_IDS.BANK);
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
    // Exclude group/header accounts from Trial Balance — only leaf accounts have transactions
    const vouchersToUse = asOnDate
      ? activeVouchers.filter(v => v.date <= asOnDate)
      : activeVouchers;
    return accounts.filter(a => !a.isGroup).map(account => {
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
    return newLoan;
  }, [society.financialYear]);

  const updateLoan = useCallback((id: string, data: Partial<Loan>) => {
    setLoansState(prev => {
      const updated = prev.map(l => l.id === id ? { ...l, ...data } : l);
      const updatedLoan = updated.find(l => l.id === id);
      if (updatedLoan) supabase.from('loans').upsert(updatedLoan).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
      return updated;
    });
  }, []);

  const deleteLoan = useCallback((id: string) => {
    setLoansState(prev => { const updated = prev.filter(l => l.id !== id); return updated; });
    supabase.from('loans').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
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
    setAssetsState(prev => { const updated = prev.filter(a => a.id !== id); return updated; });
    supabase.from('assets').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
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

  const getReceiptsPayments = useCallback((): ReceiptsPaymentsData => {
    const cashAccount = accounts.find(a => a.id === ACCOUNT_IDS.CASH);
    const bankAccount = accounts.find(a => a.id === ACCOUNT_IDS.BANK);
    const openingCash = cashAccount?.openingBalance ?? 0;
    const openingBank = bankAccount?.openingBalance ?? 0;

    const receiptMap: Record<string, { name: string; amount: number }> = {};
    const paymentMap: Record<string, { name: string; amount: number }> = {};

    // BUG-02 FIX: Use getVoucherLines() to handle multi-line Expert Mode vouchers.
    // For each line touching Cash/Bank, find the "other" side accounts in the same voucher.
    activeVouchers.forEach(v => {
      const lines = getVoucherLines(v);
      lines.forEach(l => {
        const isCashBank = l.accountId === ACCOUNT_IDS.CASH || l.accountId === ACCOUNT_IDS.BANK;
        if (!isCashBank) return;

        // Determine other-side lines (contra side)
        const otherLines = lines.filter(ol => ol.type !== l.type);
        if (otherLines.length === 0) return;

        if (l.type === 'Dr') {
          // Cash/Bank Dr = Receipt (money came in) — credit side is the source
          otherLines.forEach(ol => {
            const otherAcc = accounts.find(a => a.id === ol.accountId);
            const name = otherAcc?.name || ol.accountId;
            if (!receiptMap[ol.accountId]) receiptMap[ol.accountId] = { name, amount: 0 };
            receiptMap[ol.accountId].amount += ol.amount;
          });
        } else {
          // Cash/Bank Cr = Payment (money went out) — debit side is the destination
          otherLines.forEach(ol => {
            const otherAcc = accounts.find(a => a.id === ol.accountId);
            const name = otherAcc?.name || ol.accountId;
            if (!paymentMap[ol.accountId]) paymentMap[ol.accountId] = { name, amount: 0 };
            paymentMap[ol.accountId].amount += ol.amount;
          });
        }
      });
    });

    const closingCash = getAccountBalance(ACCOUNT_IDS.CASH);
    const closingBank = getAccountBalance(ACCOUNT_IDS.BANK);

    return {
      openingCash,
      openingBank,
      receipts: Object.entries(receiptMap).map(([id, v]) => ({ accountId: id, accountName: v.name, amount: v.amount })),
      payments: Object.entries(paymentMap).map(([id, v]) => ({ accountId: id, accountName: v.name, amount: v.amount })),
      closingCash,
      closingBank,
    };
  }, [accounts, vouchers, getAccountBalance]);

  const getTradingAccount = useCallback(() => {
    const tb = getTrialBalance();
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

    // Physical closing stock from stockItems (currentStock × purchaseRate)
    const physicalClosingStock = stockItems
      .filter(s => s.isActive && s.currentStock > 0)
      .reduce((sum, s) => sum + s.currentStock * s.purchaseRate, 0);

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
  }, [getTrialBalance, stockItems, activeVouchers, society.financialYear]);

  const postClosingStock = useCallback((fy?: string): { posted: boolean; amount: number; alreadyPosted: boolean } => {
    const currentFY = fy ?? society.financialYear;
    // Check if already posted — use getVoucherLines() to support Expert Mode multi-line vouchers (Rule 4)
    const alreadyPosted = activeVouchers.some(v =>
      getVoucherLines(v).some(l => l.accountId === '3403' && l.type === 'Dr') &&
      getVoucherLines(v).some(l => l.accountId === '5101' && l.type === 'Cr') &&
      v.narration.includes(currentFY)
    );
    if (alreadyPosted) return { posted: false, amount: 0, alreadyPosted: true };

    const amount = stockItems
      .filter(s => s.isActive && s.currentStock > 0)
      .reduce((sum, s) => sum + s.currentStock * s.purchaseRate, 0);

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
  }, [stockItems, activeVouchers, society.financialYear, addVoucher, user?.name]);

  const getProfitLoss = useCallback(() => {
    const tb = getTrialBalance();
    // Income accounts are credit-nature: netBalance = debit - credit → normally negative → abs gives the income amount.
    const incomeItems = tb
      .filter(b => b.account.type === 'income' && b.netBalance !== 0)
      .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: Math.abs(b.netBalance) }));
    // BUG-08 FIX: Expense accounts are debit-nature: netBalance normally positive.
    // Use Math.abs() for safety in case of over-credit (unusual but possible refund scenario).
    const expenseItems = tb
      .filter(b => b.account.type === 'expense' && b.netBalance !== 0)
      .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: Math.abs(b.netBalance) }));
    const totalIncome = incomeItems.reduce((s, i) => s + i.amount, 0);
    const totalExpenses = expenseItems.reduce((s, i) => s + i.amount, 0);
    return { incomeItems, expenseItems, totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses };
  }, [getTrialBalance]);

  // ── Inventory ──────────────────────────────────────────────────────────────
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
      supabase.from('stock_items').upsert(withSoc(newItem)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
      return [...prev, newItem];
    });
    return newItem!;
  }, []);

  const updateStockItem = useCallback((id: string, data: Partial<StockItem>) => {
    setStockItemsState(prev => {
      const updated = prev.map(i => i.id === id ? { ...i, ...data } : i);
      const updatedItem = updated.find(i => i.id === id);
      if (updatedItem) supabase.from('stock_items').upsert(updatedItem).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
      return updated;
    });
  }, []);

  const deleteStockItem = useCallback((id: string) => {
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
  }, [addVoucher, user?.name]);

  const addStockMovement = useCallback((data: Omit<StockMovement, 'id' | 'createdAt'>) => {
    const movement: StockMovement = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setStockMovementsState(prev => { const updated = [...prev, movement]; return updated; });
    supabase.from('stock_movements').upsert(withSoc(movement)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    // Update currentStock on the item (Supabase)
    setStockItemsState(prev => {
      const updated = prev.map(i => {
        if (i.id !== data.itemId) return i;
        const delta = data.type === 'purchase' || (data.type === 'adjustment' && data.qty > 0) ? data.qty : -Math.abs(data.qty);
        const newStock = i.currentStock + delta;
        supabase.from('stock_items').update({ currentStock: newStock }).eq('id', i.id).then(({ error }) => { if (error) { console.error('Stock currentStock sync error:', error.message); toastRef.current({ title: 'Stock update failed', description: error.message, variant: 'destructive' }); } });
        return { ...i, currentStock: newStock };
      });
      return updated;
    });
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
      : data.paymentMode === 'bank' ? ACCOUNT_IDS.BANK
      : (data.customerId ? (customers.find(c => c.id === data.customerId)?.accountId || '3303') : '3303');
    lines.push({ id: lid(), accountId: debitAccId, type: 'Dr', amount: grandTotal });

    // Cr: Sales A/c (4101) for net amount (excluding GST)
    const netAmt = data.netAmount || (grandTotal - (data.taxAmount || 0));
    if (netAmt > 0) {
      lines.push({ id: lid(), accountId: '4101', type: 'Cr', amount: netAmt });
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
              if (cancelled) supabase.from('vouchers').upsert(cancelled).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
            });
            return updated;
          });
        }
        // Reverse stock deductions
        sale.items.forEach(item => {
          setStockItemsState(s => {
            const updated = s.map(i => { if (i.id !== item.itemId) return i; const newStock = i.currentStock + item.qty; supabase.from('stock_items').update({ currentStock: newStock }).eq('id', i.id).then(({ error }) => { if (error) { console.error('Stock currentStock sync error:', error.message); toastRef.current({ title: 'Stock update failed', description: error.message, variant: 'destructive' }); } }); return { ...i, currentStock: newStock }; });
            return updated;
          });
        });
      }
      const updated = prev.filter(s => s.id !== id);
      return updated;
    });
    supabase.from('sales').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
  }, []);

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
      : data.paymentMode === 'bank' ? ACCOUNT_IDS.BANK
      : supplierAccId;

    // Dr: Purchases (5101) for net amount
    const netAmt = data.netAmount || (grandTotal - (data.taxAmount || 0) + (data.tdsAmount || 0));
    if (netAmt > 0) {
      lines.push({ id: lid(), accountId: '5101', type: 'Dr', amount: netAmt });
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
              if (cancelled) supabase.from('vouchers').upsert(cancelled).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
            });
            return updated;
          });
        }
        // Reverse stock additions
        purchase.items.forEach(item => {
          setStockItemsState(s => {
            const updated = s.map(i => { if (i.id !== item.itemId) return i; const newStock = Math.max(0, i.currentStock - item.qty); supabase.from('stock_items').update({ currentStock: newStock }).eq('id', i.id).then(({ error }) => { if (error) { console.error('Stock currentStock sync error:', error.message); toastRef.current({ title: 'Stock update failed', description: error.message, variant: 'destructive' }); } }); return { ...i, currentStock: newStock }; });
            return updated;
          });
        });
      }
      const updated = prev.filter(p => p.id !== id);
      return updated;
    });
    supabase.from('purchases').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
  }, []);

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
    setEmployeesState(prev => { const updated = prev.filter(e => e.id !== id); return updated; });
    supabase.from('employees').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
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
    setSalaryRecordsState(prev => {
      const updated = prev.map(r => {
        if (r.id !== id) return r;
        const merged = { ...r, ...data };
        // Auto-create voucher when marking as paid
        if (data.isPaid && !r.isPaid && !r.voucherId) {
          const emp = employees.find(e => e.id === r.employeeId);
          const creditAcc = merged.paymentMode === 'cash' ? ACCOUNT_IDS.CASH : ACCOUNT_IDS.BANK;
          const voucherNo = storage.getNextVoucherNo('payment', society.financialYear, vouchersRef.current);
          const newV = { type: 'payment' as const, date: merged.paidDate || new Date().toISOString().split('T')[0], debitAccountId: '5201', creditAccountId: creditAcc, amount: merged.netSalary, narration: `Salary: ${emp?.name || ''} - ${r.month}`, memberId: undefined as undefined, createdBy: 'System', id: crypto.randomUUID(), voucherNo, createdAt: new Date().toISOString() };
          setVouchersState(v => { const upd = [...v, newV]; return upd; });
          supabase.from('vouchers').upsert(withSoc(newV)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
          merged.voucherId = newV.id;
        }
        return merged;
      });
      const updatedRecord = updated.find(r => r.id === id);
      if (updatedRecord) {
        supabase.from('salary_records').upsert(updatedRecord).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
      }
      return updated;
    });
  }, [employees, society.financialYear]);

  const deleteSalaryRecord = useCallback((id: string) => {
    setSalaryRecordsState(prev => { const updated = prev.filter(r => r.id !== id); return updated; });
    supabase.from('salary_records').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
  }, []);

  // ── Suppliers ──────────────────────────────────────────────────────────────
  const addSupplier = useCallback((data: Omit<Supplier, 'id' | 'supplierCode' | 'accountId' | 'createdAt'>): Supplier => {
    const accountId = crypto.randomUUID();
    // Auto-create ledger account under Sundry Creditors (2101)
    const newAccount: LedgerAccount = {
      id: accountId,
      name: data.name,
      nameHi: data.nameHi || data.name,
      type: 'liability',
      openingBalance: 0,
      openingBalanceType: 'credit',
      isSystem: false,
      isGroup: false,
      parentId: '2101',
    };
    setAccountsState(prev => { const updated = [...prev, newAccount]; return updated; });
    supabase.from('accounts').upsert(withSoc(newAccount)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });

    const maxSupNum = suppliersRef.current.reduce((max, s) => {
      const m = s.supplierCode?.match(/SUP\/(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const supplierCode = `SUP/${String(maxSupNum + 1).padStart(3, '0')}`;
    const supplier: Supplier = { ...data, id: crypto.randomUUID(), supplierCode, accountId, createdAt: new Date().toISOString() };
    suppliersRef.current = [...suppliersRef.current, supplier];
    setSuppliersState(prev => { const updated = [...prev, supplier]; return updated; });
    supabase.from('suppliers').upsert(withSoc(supplier)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    return supplier;
  }, []);

  const updateSupplier = useCallback((id: string, data: Partial<Omit<Supplier, 'id' | 'supplierCode' | 'accountId' | 'createdAt'>>) => {
    let updated: Supplier | undefined;
    setSuppliersState(prev => {
      const arr = prev.map(s => s.id === id ? { ...s, ...data } : s);
      updated = arr.find(s => s.id === id);
      return arr;
    });
    // Sync name change to linked account
    if (data.name || data.nameHi) {
      setAccountsState(prev => {
        const sup = suppliers.find(s => s.id === id);
        if (!sup) return prev;
        const arr = prev.map(a => a.id === sup.accountId ? { ...a, name: data.name ?? a.name, nameHi: data.nameHi ?? data.name ?? a.nameHi } : a);
        return arr;
      });
    }
    if (updated) supabase.from('suppliers').upsert(withSoc(updated)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
  }, [suppliers]);

  const deleteSupplier = useCallback((id: string) => {
    const sup = suppliers.find(s => s.id === id);
    setSuppliersState(prev => { const arr = prev.filter(s => s.id !== id); return arr; });
    supabase.from('suppliers').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    if (sup?.accountId) {
      setAccountsState(prev => { const arr = prev.filter(a => a.id !== sup.accountId); return arr; });
      supabase.from('accounts').delete().eq('id', sup.accountId).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    }
  }, [suppliers]);

  // ── Customers ──────────────────────────────────────────────────────────────
  const addCustomer = useCallback((data: Omit<Customer, 'id' | 'customerCode' | 'accountId' | 'createdAt'>): Customer => {
    const accountId = crypto.randomUUID();
    // Auto-create ledger account under Sundry Debtors (3303)
    const newAccount: LedgerAccount = {
      id: accountId,
      name: data.name,
      nameHi: data.nameHi || data.name,
      type: 'asset',
      openingBalance: 0,
      openingBalanceType: 'debit',
      isSystem: false,
      isGroup: false,
      parentId: '3303',
    };
    setAccountsState(prev => { const updated = [...prev, newAccount]; return updated; });
    supabase.from('accounts').upsert(withSoc(newAccount)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });

    const maxCusNum = customersRef.current.reduce((max, c) => {
      const m = c.customerCode?.match(/CUS\/(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const customerCode = `CUS/${String(maxCusNum + 1).padStart(3, '0')}`;
    const customer: Customer = { ...data, id: crypto.randomUUID(), customerCode, accountId, createdAt: new Date().toISOString() };
    customersRef.current = [...customersRef.current, customer];
    setCustomersState(prev => { const updated = [...prev, customer]; return updated; });
    supabase.from('customers').upsert(withSoc(customer)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    return customer;
  }, []);

  const updateCustomer = useCallback((id: string, data: Partial<Omit<Customer, 'id' | 'customerCode' | 'accountId' | 'createdAt'>>) => {
    let updated: Customer | undefined;
    setCustomersState(prev => {
      const arr = prev.map(c => c.id === id ? { ...c, ...data } : c);
      updated = arr.find(c => c.id === id);
      return arr;
    });
    if (data.name || data.nameHi) {
      setAccountsState(prev => {
        const cus = customers.find(c => c.id === id);
        if (!cus) return prev;
        const arr = prev.map(a => a.id === cus.accountId ? { ...a, name: data.name ?? a.name, nameHi: data.nameHi ?? data.name ?? a.nameHi } : a);
        return arr;
      });
    }
    if (updated) supabase.from('customers').upsert(withSoc(updated)).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
  }, [customers]);

  const deleteCustomer = useCallback((id: string) => {
    const cus = customers.find(c => c.id === id);
    setCustomersState(prev => { const arr = prev.filter(c => c.id !== id); return arr; });
    supabase.from('customers').delete().eq('id', id).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    if (cus?.accountId) {
      setAccountsState(prev => { const arr = prev.filter(a => a.id !== cus.accountId); return arr; });
      supabase.from('accounts').delete().eq('id', cus.accountId).then(({ error }) => { if (error) { console.error('DB sync error:', error.message); toastRef.current({ title: 'Save failed', description: error.message, variant: 'destructive' }); } });
    }
  }, [customers]);

  const getEntityLinks = useCallback((entityType: 'member' | 'customer' | 'supplier' | 'stockItem' | 'employee' | 'account' | 'loan', id: string): EntityLink[] => {
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
      const mvCount = stockMovements.filter(m => m.itemId === id).length;
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

    return links;
  }, [stockMovements]); // eslint-disable-line

  return (
    <DataContext.Provider value={{
      vouchers, members, accounts, society, loans, assets, auditObjections,
      stockItems, stockMovements, sales, purchases, employees, salaryRecords,
      suppliers, customers, kccLoans,
      addVoucher, updateVoucher, cancelVoucher, restoreVoucher, clearVoucher, unclearVoucher, approveVoucher, rejectVoucher,
      addMember, updateMember, deleteMember,
      addAccount, updateAccount, deleteAccount, updateSociety,
      addLoan, updateLoan, deleteLoan,
      addAsset, updateAsset, deleteAsset, postDepreciation,
      addAuditObjection, updateAuditObjection, deleteAuditObjection,
      addStockItem, updateStockItem, deleteStockItem, addStockMovement,
      addSale, deleteSale,
      addPurchase, deletePurchase,
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

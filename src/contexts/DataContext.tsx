import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type {
  Voucher, VoucherEditSnapshot, Member, LedgerAccount, SocietySettings,
  AccountBalance, CashBookEntry, BankBookEntry, MemberLedgerEntry, ReceiptsPaymentsData,
  Loan, Asset, AuditObjection,
  StockItem, StockMovement,
  Sale, Purchase,
  Employee, SalaryRecord, PaymentMode,
  Supplier, Customer,
} from '@/types';
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
  updateVoucher: (id: string, data: Partial<Pick<Voucher, 'type' | 'date' | 'debitAccountId' | 'creditAccountId' | 'amount' | 'narration' | 'memberId'>>) => void;
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

  getAccountBalance: (accountId: string) => number;
  getCashBookEntries: (fromDate?: string, toDate?: string) => CashBookEntry[];
  getBankBookEntries: (fromDate?: string, toDate?: string) => BankBookEntry[];
  getTrialBalance: () => AccountBalance[];
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
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const societyIdRef = useRef(user?.societyId || 'SOC001');
  // Keep ref updated when user changes
  useEffect(() => { societyIdRef.current = user?.societyId || 'SOC001'; }, [user?.societyId]);
  // Helper: adds society_id to any Supabase record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withSoc = (d: Record<string, any>) => ({ ...d, society_id: societyIdRef.current });

  const [vouchers, setVouchersState] = useState<Voucher[]>(() => storage.getVouchers());
  const vouchersRef = useRef<Voucher[]>(vouchers);
  useEffect(() => { vouchersRef.current = vouchers; }, [vouchers]);
  const [members, setMembersState] = useState<Member[]>(() => storage.getMembers());
  const membersRef = useRef<Member[]>(members);
  useEffect(() => { membersRef.current = members; }, [members]);
  const [accounts, setAccountsState] = useState<LedgerAccount[]>(() => storage.getAccounts());
  const [society, setSocietyState] = useState<SocietySettings>(() => storage.getSociety());
  const [loans, setLoansState] = useState<Loan[]>(() => storage.getLoans());
  const [assets, setAssetsState] = useState<Asset[]>(() => storage.getAssets());
  const [auditObjections, setAuditObjectionsState] = useState<AuditObjection[]>(() => storage.getAuditObjections());
  const [stockItems, setStockItemsState] = useState<StockItem[]>(() => storage.getStockItems());
  const [stockMovements, setStockMovementsState] = useState<StockMovement[]>(() => storage.getStockMovements());
  const [sales, setSalesState] = useState<Sale[]>(() => storage.getSales());
  const [purchases, setPurchasesState] = useState<Purchase[]>(() => storage.getPurchases());
  const [employees, setEmployeesState] = useState<Employee[]>(() => storage.getEmployees());
  const [salaryRecords, setSalaryRecordsState] = useState<SalaryRecord[]>(() => storage.getSalaryRecords());
  const [suppliers, setSuppliersState] = useState<Supplier[]>(() => storage.getSuppliers());
  const [customers, setCustomersState] = useState<Customer[]>(() => storage.getCustomers());

  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    const sid = user?.societyId || 'SOC001';
    societyIdRef.current = sid;

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
              supabase.from('vouchers').upsert({ ...v, society_id: sid }).then(({ error }) => { if (error) console.warn('Auto member voucher sync error:', error.message); });
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
        if (supData && supData.length > 0) { setSuppliersState(supData); storage.setSuppliers(supData); } else setSuppliersState(storage.getSuppliers());
        if (cusData && cusData.length > 0) { setCustomersState(cusData); storage.setCustomers(cusData); } else setCustomersState(storage.getCustomers());
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
        setDbReady(true);
      }
    };
    loadFromSupabase();
  }, [user?.societyId]);

  const addVoucher = useCallback((data: Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'> & { voucherNo?: string }): Voucher => {
    const voucherNo = data.voucherNo?.trim() || storage.getNextVoucherNo(data.type, society.financialYear, vouchersRef.current);
    const newVoucher: Voucher = {
      ...data,
      id: crypto.randomUUID(),
      voucherNo,
      createdAt: new Date().toISOString(),
    };
    // Update ref immediately so the next addVoucher call in the same tick sees this voucher
    vouchersRef.current = [...vouchersRef.current, newVoucher];
    setVouchersState(prev => {
      const updated = [...prev, newVoucher];
      storage.setVouchers(updated);
      return updated;
    });
    supabase.from('vouchers').upsert(withSoc(newVoucher)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    return newVoucher;
  }, [society.financialYear]);

  const updateVoucher = useCallback((id: string, data: Partial<Pick<Voucher, 'type' | 'date' | 'debitAccountId' | 'creditAccountId' | 'amount' | 'narration' | 'memberId'>>) => {
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
    setVouchersState(prev => {
      const updated = prev.map(v => v.id === id ? updatedVoucher : v);
      storage.setVouchers(updated);
      return updated;
    });
    supabase.from('vouchers').upsert(withSoc(updatedVoucher)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
  }, []);

  const cancelVoucher = useCallback((id: string, reason: string, deletedBy: string) => {
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    const cancelledVoucher = { ...current, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy, deletedReason: reason };
    setVouchersState(prev => {
      const updated = prev.map(v => v.id === id ? cancelledVoucher : v);
      storage.setVouchers(updated);
      return updated;
    });
    supabase.from('vouchers').upsert(withSoc(cancelledVoucher)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
  }, []);

  const restoreVoucher = useCallback((id: string) => {
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { deletedAt: _da, deletedBy: _db, deletedReason: _dr, ...rest } = current as Voucher & { deletedAt?: string; deletedBy?: string; deletedReason?: string };
    const restoredVoucher = { ...rest, isDeleted: false };
    setVouchersState(prev => {
      const updated = prev.map(v => v.id === id ? restoredVoucher : v);
      storage.setVouchers(updated);
      return updated;
    });
    supabase.from('vouchers').upsert(withSoc(restoredVoucher)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
  }, []);

  const clearVoucher = useCallback((id: string, clearedDate?: string) => {
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    const cleared = { ...current, isCleared: true, clearedDate: clearedDate ?? new Date().toISOString().split('T')[0] };
    setVouchersState(prev => { const updated = prev.map(v => v.id === id ? cleared : v); storage.setVouchers(updated); return updated; });
    supabase.from('vouchers').upsert(withSoc(cleared)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
  }, []);

  const unclearVoucher = useCallback((id: string) => {
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    const uncleared = { ...current, isCleared: false, clearedDate: undefined };
    setVouchersState(prev => { const updated = prev.map(v => v.id === id ? uncleared : v); storage.setVouchers(updated); return updated; });
    supabase.from('vouchers').upsert(withSoc(uncleared)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
  }, []);

  const approveVoucher = useCallback((id: string, approvedBy: string) => {
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    const updated = { ...current, approvalStatus: 'approved' as const, approvedBy, approvedAt: new Date().toISOString() };
    setVouchersState(prev => { const u = prev.map(v => v.id === id ? updated : v); storage.setVouchers(u); return u; });
    supabase.from('vouchers').upsert(withSoc(updated)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
  }, []);

  const rejectVoucher = useCallback((id: string, rejectedBy: string, reason: string) => {
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    const updated = { ...current, approvalStatus: 'rejected' as const, approvalRemarks: reason, approvedBy: rejectedBy, approvedAt: new Date().toISOString() };
    setVouchersState(prev => { const u = prev.map(v => v.id === id ? updated : v); storage.setVouchers(u); return u; });
    supabase.from('vouchers').upsert(withSoc(updated)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
  }, []);

  const addAuditObjection = useCallback((data: Omit<AuditObjection, 'id' | 'objectionNo' | 'createdAt'>): AuditObjection => {
    const objectionNo = storage.getNextObjectionNo(data.auditYear);
    const newObj: AuditObjection = { ...data, id: crypto.randomUUID(), objectionNo, createdAt: new Date().toISOString() };
    setAuditObjectionsState(prev => { const updated = [...prev, newObj]; storage.setAuditObjections(updated); return updated; });
    supabase.from('audit_objections').upsert(withSoc(newObj)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    return newObj;
  }, []);

  const updateAuditObjection = useCallback((id: string, data: Partial<AuditObjection>) => {
    let updated_obj: AuditObjection | undefined;
    setAuditObjectionsState(prev => {
      const updated = prev.map(o => o.id === id ? { ...o, ...data } : o);
      updated_obj = updated.find(o => o.id === id);
      storage.setAuditObjections(updated);
      return updated;
    });
    if (updated_obj) {
      supabase.from('audit_objections').upsert(updated_obj).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    }
  }, []);

  const deleteAuditObjection = useCallback((id: string) => {
    setAuditObjectionsState(prev => { const updated = prev.filter(o => o.id !== id); storage.setAuditObjections(updated); return updated; });
    supabase.from('audit_objections').delete().eq('id', id).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
  }, []);

  const addMember = useCallback((data: Omit<Member, 'id'>): Member => {
    const newMember: Member = { ...data, id: crypto.randomUUID() };
    setMembersState(prev => {
      const updated = [...prev, newMember];
      storage.setMembers(updated);
      return updated;
    });
    supabase.from('members').upsert(withSoc(newMember)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    // Auto-create Receipt vouchers for Share Capital and Admission Fee
    if ((newMember.shareCapital || 0) > 0) {
      const v: Voucher = { id: crypto.randomUUID(), voucherNo: storage.getNextVoucherNo('receipt', society.financialYear, vouchersRef.current), type: 'receipt', date: newMember.joinDate, debitAccountId: ACCOUNT_IDS.CASH, creditAccountId: ACCOUNT_IDS.SHARE_CAP, amount: newMember.shareCapital, narration: `Share Capital received from ${newMember.name}`, memberId: newMember.id, createdAt: new Date().toISOString() };
      vouchersRef.current = [...vouchersRef.current, v];
      setVouchersState(prev => { const updated = [...prev, v]; storage.setVouchers(updated); return updated; });
      supabase.from('vouchers').upsert(withSoc(v)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    }
    if ((newMember.admissionFee || 0) > 0) {
      const v: Voucher = { id: crypto.randomUUID(), voucherNo: storage.getNextVoucherNo('receipt', society.financialYear, vouchersRef.current), type: 'receipt', date: newMember.joinDate, debitAccountId: ACCOUNT_IDS.CASH, creditAccountId: ACCOUNT_IDS.ADM_FEE, amount: newMember.admissionFee!, narration: `Admission Fee received from ${newMember.name}`, memberId: newMember.id, createdAt: new Date().toISOString() };
      vouchersRef.current = [...vouchersRef.current, v];
      setVouchersState(prev => { const updated = [...prev, v]; storage.setVouchers(updated); return updated; });
      supabase.from('vouchers').upsert(withSoc(v)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    }
    return newMember;
  }, [society.financialYear]);

  const updateMember = useCallback((id: string, data: Partial<Member>) => {
    const oldMember = membersRef.current.find(m => m.id === id);
    if (!oldMember) return;
    const updatedMember = { ...oldMember, ...data };
    setMembersState(prev => {
      const updated = prev.map(m => m.id === id ? updatedMember : m);
      storage.setMembers(updated);
      return updated;
    });
    supabase.from('members').upsert(withSoc(updatedMember)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    // Update Share Capital voucher if amount changed
    if (data.shareCapital !== undefined && data.shareCapital !== oldMember.shareCapital) {
      const scv = vouchersRef.current.find(v => v.memberId === id && v.creditAccountId === ACCOUNT_IDS.SHARE_CAP && !v.isDeleted);
      if (scv) {
        const updated = { ...scv, amount: data.shareCapital };
        setVouchersState(prev => { const list = prev.map(v => v.id === scv.id ? updated : v); storage.setVouchers(list); return list; });
        supabase.from('vouchers').upsert(withSoc(updated)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
      }
    }
    // Update Admission Fee voucher if amount changed
    if (data.admissionFee !== undefined && data.admissionFee !== oldMember.admissionFee) {
      const afv = vouchersRef.current.find(v => v.memberId === id && v.creditAccountId === ACCOUNT_IDS.ADM_FEE && !v.isDeleted);
      if (afv) {
        const updated = { ...afv, amount: data.admissionFee };
        setVouchersState(prev => { const list = prev.map(v => v.id === afv.id ? updated : v); storage.setVouchers(list); return list; });
        supabase.from('vouchers').upsert(withSoc(updated)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
      }
    }
  }, []);

  const deleteMember = useCallback((id: string) => {
    setMembersState(prev => {
      const updated = prev.filter(m => m.id !== id);
      storage.setMembers(updated);
      return updated;
    });
    supabase.from('members').delete().eq('id', id).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
  }, []);

  const addAccount = useCallback((data: Omit<LedgerAccount, 'id'>): LedgerAccount => {
    const newAccount: LedgerAccount = { ...data, id: crypto.randomUUID() };
    setAccountsState(prev => {
      const updated = [...prev, newAccount];
      storage.setAccounts(updated);
      return updated;
    });
    supabase.from('accounts').upsert(withSoc(newAccount)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    return newAccount;
  }, []);

  const updateAccount = useCallback((id: string, data: Partial<LedgerAccount>) => {
    let updatedAccount: LedgerAccount | undefined;
    setAccountsState(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, ...data } : a);
      updatedAccount = updated.find(a => a.id === id);
      storage.setAccounts(updated);
      return updated;
    });
    if (updatedAccount) {
      supabase.from('accounts').upsert(updatedAccount).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    }
  }, []);

  const deleteAccount = useCallback((id: string) => {
    setAccountsState(prev => {
      const updated = prev.filter(a => a.id !== id);
      storage.setAccounts(updated);
      return updated;
    });
    supabase.from('accounts').delete().eq('id', id).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
  }, []);

  const updateSociety = useCallback((data: Partial<SocietySettings>) => {
    setSocietyState(prev => {
      const updated = { ...prev, ...data };
      storage.setSociety(updated);
      supabase.from('society_settings').upsert({ id: societyIdRef.current, society_id: societyIdRef.current, ...updated }).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
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
      if (v.debitAccountId === accountId) balance += v.amount;
      if (v.creditAccountId === accountId) balance -= v.amount;
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
      .filter(v => v.debitAccountId === ACCOUNT_IDS.CASH || v.creditAccountId === ACCOUNT_IDS.CASH)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

    if (fromDate) {
      cashVouchers.filter(v => v.date < fromDate).forEach(v => {
        if (v.debitAccountId === ACCOUNT_IDS.CASH) runningBalance += v.amount;
        else runningBalance -= v.amount;
      });
    }

    return cashVouchers
      .filter(v => {
        if (fromDate && v.date < fromDate) return false;
        if (toDate && v.date > toDate) return false;
        return true;
      })
      .map(v => {
        const isReceipt = v.debitAccountId === ACCOUNT_IDS.CASH;
        if (isReceipt) runningBalance += v.amount;
        else runningBalance -= v.amount;
        const otherId = isReceipt ? v.creditAccountId : v.debitAccountId;
        const otherAcc = accounts.find(a => a.id === otherId);
        return {
          id: v.id,
          date: v.date,
          voucherNo: v.voucherNo,
          particulars: v.narration || otherAcc?.nameHi || otherAcc?.name || '',
          type: isReceipt ? 'receipt' : 'payment',
          amount: v.amount,
          runningBalance,
        };
      });
  }, [accounts, activeVouchers]);

  const getBankBookEntries = useCallback((fromDate?: string, toDate?: string): BankBookEntry[] => {
    const bankAccount = accounts.find(a => a.id === ACCOUNT_IDS.BANK);
    if (!bankAccount) return [];
    let runningBalance = bankAccount.openingBalanceType === 'debit'
      ? bankAccount.openingBalance
      : -bankAccount.openingBalance;

    const bankVouchers = activeVouchers
      .filter(v => v.debitAccountId === ACCOUNT_IDS.BANK || v.creditAccountId === ACCOUNT_IDS.BANK)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

    if (fromDate) {
      bankVouchers.filter(v => v.date < fromDate).forEach(v => {
        if (v.debitAccountId === ACCOUNT_IDS.BANK) runningBalance += v.amount;
        else runningBalance -= v.amount;
      });
    }

    return bankVouchers
      .filter(v => {
        if (fromDate && v.date < fromDate) return false;
        if (toDate && v.date > toDate) return false;
        return true;
      })
      .map(v => {
        const isDeposit = v.debitAccountId === ACCOUNT_IDS.BANK;
        if (isDeposit) runningBalance += v.amount;
        else runningBalance -= v.amount;
        const otherId = isDeposit ? v.creditAccountId : v.debitAccountId;
        const otherAcc = accounts.find(a => a.id === otherId);
        return {
          id: v.id,
          date: v.date,
          voucherNo: v.voucherNo,
          particulars: v.narration || otherAcc?.nameHi || otherAcc?.name || '',
          type: isDeposit ? 'deposit' : 'withdrawal',
          amount: v.amount,
          runningBalance,
        };
      });
  }, [accounts, activeVouchers]);

  const getTrialBalance = useCallback((): AccountBalance[] => {
    // Exclude group/header accounts from Trial Balance — only leaf accounts have transactions
    return accounts.filter(a => !a.isGroup).map(account => {
      const openingDebit = account.openingBalanceType === 'debit' ? account.openingBalance : 0;
      const openingCredit = account.openingBalanceType === 'credit' ? account.openingBalance : 0;
      let transactionDebit = 0;
      let transactionCredit = 0;
      activeVouchers.forEach(v => {
        if (v.debitAccountId === account.id) transactionDebit += v.amount;
        if (v.creditAccountId === account.id) transactionCredit += v.amount;
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
    const loanNo = storage.getNextLoanNo(society.financialYear);
    const newLoan: Loan = { ...data, id: crypto.randomUUID(), loanNo, createdAt: new Date().toISOString() };
    setLoansState(prev => { const updated = [...prev, newLoan]; storage.setLoans(updated); return updated; });
    supabase.from('loans').upsert(withSoc(newLoan)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    return newLoan;
  }, [society.financialYear]);

  const updateLoan = useCallback((id: string, data: Partial<Loan>) => {
    let updatedLoan: Loan | undefined;
    setLoansState(prev => {
      const updated = prev.map(l => l.id === id ? { ...l, ...data } : l);
      updatedLoan = updated.find(l => l.id === id);
      storage.setLoans(updated);
      return updated;
    });
    if (updatedLoan) {
      supabase.from('loans').upsert(updatedLoan).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    }
  }, []);

  const deleteLoan = useCallback((id: string) => {
    setLoansState(prev => { const updated = prev.filter(l => l.id !== id); storage.setLoans(updated); return updated; });
    supabase.from('loans').delete().eq('id', id).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
  }, []);

  const addAsset = useCallback((data: Omit<Asset, 'id' | 'assetNo'>): Asset => {
    const assetNo = storage.getNextAssetNo();
    const newAsset: Asset = { ...data, id: crypto.randomUUID(), assetNo };
    setAssetsState(prev => { const updated = [...prev, newAsset]; storage.setAssets(updated); return updated; });
    supabase.from('assets').upsert(withSoc(newAsset)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    return newAsset;
  }, []);

  const updateAsset = useCallback((id: string, data: Partial<Asset>) => {
    let updatedAsset: Asset | undefined;
    setAssetsState(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, ...data } : a);
      updatedAsset = updated.find(a => a.id === id);
      storage.setAssets(updated);
      return updated;
    });
    if (updatedAsset) {
      supabase.from('assets').upsert(updatedAsset).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    }
  }, []);

  const deleteAsset = useCallback((id: string) => {
    setAssetsState(prev => { const updated = prev.filter(a => a.id !== id); storage.setAssets(updated); return updated; });
    supabase.from('assets').delete().eq('id', id).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
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

    activeVouchers.forEach(v => {
      const isCashDebit = v.debitAccountId === ACCOUNT_IDS.CASH;
      const isBankDebit = v.debitAccountId === ACCOUNT_IDS.BANK;
      const isCashCredit = v.creditAccountId === ACCOUNT_IDS.CASH;
      const isBankCredit = v.creditAccountId === ACCOUNT_IDS.BANK;

      if (isCashDebit || isBankDebit) {
        const otherId = v.creditAccountId;
        const otherAcc = accounts.find(a => a.id === otherId);
        const name = otherAcc?.name || otherId;
        if (!receiptMap[otherId]) receiptMap[otherId] = { name, amount: 0 };
        receiptMap[otherId].amount += v.amount;
      }
      if (isCashCredit || isBankCredit) {
        const otherId = v.debitAccountId;
        const otherAcc = accounts.find(a => a.id === otherId);
        const name = otherAcc?.name || otherId;
        if (!paymentMap[otherId]) paymentMap[otherId] = { name, amount: 0 };
        paymentMap[otherId].amount += v.amount;
      }
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

    // Check if closing stock journal has been posted for this FY
    const closingStockPosted = activeVouchers.some(v =>
      v.debitAccountId === '3403' &&
      v.creditAccountId === '5101' &&
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
    // Check if already posted
    const alreadyPosted = activeVouchers.some(v =>
      v.debitAccountId === '3403' &&
      v.creditAccountId === '5101' &&
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
    const incomeItems = tb
      .filter(b => b.account.type === 'income' && b.netBalance !== 0)
      .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: Math.abs(b.netBalance) }));
    const expenseItems = tb
      .filter(b => b.account.type === 'expense' && b.netBalance !== 0)
      .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: b.netBalance }));
    const totalIncome = incomeItems.reduce((s, i) => s + i.amount, 0);
    const totalExpenses = expenseItems.reduce((s, i) => s + i.amount, 0);
    return { incomeItems, expenseItems, totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses };
  }, [getTrialBalance]);

  // ── Inventory ──────────────────────────────────────────────────────────────
  const addStockItem = useCallback((data: Omit<StockItem, 'id' | 'itemCode'>): StockItem => {
    const item: StockItem = { ...data, id: crypto.randomUUID(), itemCode: storage.getNextItemCode() };
    setStockItemsState(prev => { const updated = [...prev, item]; storage.setStockItems(updated); return updated; });
    supabase.from('stock_items').upsert(withSoc(item)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    return item;
  }, []);

  const updateStockItem = useCallback((id: string, data: Partial<StockItem>) => {
    let updatedItem: StockItem | undefined;
    setStockItemsState(prev => {
      const updated = prev.map(i => i.id === id ? { ...i, ...data } : i);
      updatedItem = updated.find(i => i.id === id);
      storage.setStockItems(updated);
      return updated;
    });
    if (updatedItem) {
      supabase.from('stock_items').upsert(updatedItem).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    }
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
      storage.setStockItems(updated);
      return updated;
    });
    // Also remove orphaned stock movements for this item
    setStockMovementsState(prev => {
      const updated = prev.filter(m => m.itemId !== id);
      storage.setStockMovements(updated);
      return updated;
    });
    supabase.from('stock_items').update({ isActive: false, currentStock: 0 }).eq('id', id)
      .then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    supabase.from('stock_movements').delete().eq('itemId', id)
      .then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
  }, [addVoucher, user?.name]);

  const addStockMovement = useCallback((data: Omit<StockMovement, 'id' | 'createdAt'>) => {
    const movement: StockMovement = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setStockMovementsState(prev => { const updated = [...prev, movement]; storage.setStockMovements(updated); return updated; });
    supabase.from('stock_movements').upsert(withSoc(movement)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    // Update currentStock on the item (localStorage + Supabase)
    setStockItemsState(prev => {
      const updated = prev.map(i => {
        if (i.id !== data.itemId) return i;
        const delta = data.type === 'purchase' || (data.type === 'adjustment' && data.qty > 0) ? data.qty : -Math.abs(data.qty);
        const newStock = i.currentStock + delta;
        supabase.from('stock_items').update({ currentStock: newStock }).eq('id', i.id).then(({ error }) => { if (error) console.warn('Stock currentStock sync error:', error.message); });
        return { ...i, currentStock: newStock };
      });
      storage.setStockItems(updated);
      return updated;
    });
  }, []);

  // ── Sales ──────────────────────────────────────────────────────────────────
  const addSale = useCallback((data: Omit<Sale, 'id' | 'saleNo' | 'createdAt'>): Sale => {
    const saleNo = storage.getNextSaleNo(society.financialYear);
    const grandTotal = data.grandTotal ?? data.netAmount; // fallback if not provided
    let voucherId: string | undefined;

    // Main receipt/journal voucher — Dr Cash/Bank/Debtor, Cr Sales (4101) for grandTotal
    if (data.paymentMode !== 'credit') {
      const debitAcc = data.paymentMode === 'cash' ? ACCOUNT_IDS.CASH : ACCOUNT_IDS.BANK;
      const voucherNo = storage.getNextVoucherNo('receipt', society.financialYear, vouchersRef.current);
      const newV = { type: 'receipt' as const, date: data.date, debitAccountId: debitAcc, creditAccountId: '4101', amount: grandTotal, narration: data.narration || `Sale: ${data.customerName} - ${saleNo}`, memberId: undefined as undefined, createdBy: data.createdBy, id: crypto.randomUUID(), voucherNo, createdAt: new Date().toISOString() };
      vouchersRef.current = [...vouchersRef.current, newV];
      setVouchersState(prev => { const updated = [...prev, newV]; storage.setVouchers(updated); return updated; });
      supabase.from('vouchers').upsert(withSoc(newV)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
      voucherId = newV.id;
    } else {
      const customerAccountId = data.customerId ? customers.find(c => c.id === data.customerId)?.accountId || '3303' : '3303';
      const voucherNo = storage.getNextVoucherNo('journal', society.financialYear, vouchersRef.current);
      const newV = { type: 'journal' as const, date: data.date, debitAccountId: customerAccountId, creditAccountId: '4101', amount: grandTotal, narration: data.narration || `Credit Sale: ${data.customerName} - ${saleNo}`, memberId: undefined as undefined, createdBy: data.createdBy, id: crypto.randomUUID(), voucherNo, createdAt: new Date().toISOString() };
      vouchersRef.current = [...vouchersRef.current, newV];
      setVouchersState(prev => { const updated = [...prev, newV]; storage.setVouchers(updated); return updated; });
      supabase.from('vouchers').upsert(withSoc(newV)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
      voucherId = newV.id;
    }

    // ── Auto-create Output GST journal (Dr Sales / Cr GST Output 2201) ────────
    // This reclassifies the tax portion: Sales A/c net = grandTotal - taxAmount = netAmount ✓
    const gstVoucherIds: string[] = [];
    if ((data.taxAmount ?? 0) > 0) {
      const gstVoucherNo = storage.getNextVoucherNo('journal', society.financialYear, vouchersRef.current);
      const gstV = {
        type: 'journal' as const,
        date: data.date,
        debitAccountId: '4101',   // Dr Sales (reduce by tax portion)
        creditAccountId: '2201',  // Cr GST Output Payable
        amount: data.taxAmount!,
        narration: `Output GST on Sale ${saleNo} (CGST:${data.cgstAmount||0} + SGST:${data.sgstAmount||0} + IGST:${data.igstAmount||0})`,
        memberId: undefined as undefined,
        createdBy: data.createdBy,
        id: crypto.randomUUID(),
        voucherNo: gstVoucherNo,
        createdAt: new Date().toISOString(),
      };
      vouchersRef.current = [...vouchersRef.current, gstV];
      setVouchersState(prev => { const updated = [...prev, gstV]; storage.setVouchers(updated); return updated; });
      supabase.from('vouchers').upsert(withSoc(gstV)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
      gstVoucherIds.push(gstV.id);
    }

    // Reduce stock & add movements
    data.items.forEach(item => {
      setStockItemsState(prev => { const updated = prev.map(i => { if (i.id !== item.itemId) return i; const newStock = Math.max(0, i.currentStock - item.qty); supabase.from('stock_items').update({ currentStock: newStock }).eq('id', i.id).then(({ error }) => { if (error) console.warn('Stock currentStock sync error:', error.message); }); return { ...i, currentStock: newStock }; }); storage.setStockItems(updated); return updated; });
      const mv: StockMovement = { id: crypto.randomUUID(), date: data.date, itemId: item.itemId, type: 'sale', qty: item.qty, rate: item.rate, amount: item.amount, referenceNo: saleNo, narration: `Sale to ${data.customerName}`, createdAt: new Date().toISOString() };
      setStockMovementsState(prev => { const updated = [...prev, mv]; storage.setStockMovements(updated); return updated; });
      supabase.from('stock_movements').upsert(withSoc(mv)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    });
    const sale: Sale = { ...data, id: crypto.randomUUID(), saleNo, voucherId, gstVoucherIds: gstVoucherIds.length > 0 ? gstVoucherIds : undefined, createdAt: new Date().toISOString() };
    setSalesState(prev => { const updated = [...prev, sale]; storage.setSales(updated); return updated; });
    supabase.from('sales').upsert(withSoc(sale)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    return sale;
  }, [society.financialYear, customers]);

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
            storage.setVouchers(updated);
            linkedIds.forEach(vid => {
              const cancelled = updated.find(x => x.id === vid);
              if (cancelled) supabase.from('vouchers').upsert(cancelled).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
            });
            return updated;
          });
        }
        // Reverse stock deductions
        sale.items.forEach(item => {
          setStockItemsState(s => {
            const updated = s.map(i => { if (i.id !== item.itemId) return i; const newStock = i.currentStock + item.qty; supabase.from('stock_items').update({ currentStock: newStock }).eq('id', i.id).then(({ error }) => { if (error) console.warn('Stock currentStock sync error:', error.message); }); return { ...i, currentStock: newStock }; });
            storage.setStockItems(updated);
            return updated;
          });
        });
      }
      const updated = prev.filter(s => s.id !== id);
      storage.setSales(updated);
      return updated;
    });
    supabase.from('sales').delete().eq('id', id).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
  }, []);

  // ── Purchases ──────────────────────────────────────────────────────────────
  const addPurchase = useCallback((data: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt'>): Purchase => {
    const purchaseNo = storage.getNextPurchaseNo(society.financialYear);
    let voucherId: string | undefined;
    if (data.paymentMode !== 'credit') {
      const creditAcc = data.paymentMode === 'cash' ? ACCOUNT_IDS.CASH : ACCOUNT_IDS.BANK;
      const voucherNo = storage.getNextVoucherNo('payment', society.financialYear, vouchersRef.current);
      const newV = { type: 'payment' as const, date: data.date, debitAccountId: '3403', creditAccountId: creditAcc, amount: data.netAmount, narration: `Purchase: ${data.supplierName} - ${purchaseNo}`, memberId: undefined as undefined, createdBy: data.createdBy, id: crypto.randomUUID(), voucherNo, createdAt: new Date().toISOString() };
      setVouchersState(prev => { const updated = [...prev, newV]; storage.setVouchers(updated); return updated; });
      supabase.from('vouchers').upsert(withSoc(newV)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
      voucherId = newV.id;
    } else {
      const supplierAccountId = data.supplierId ? suppliers.find(s => s.id === data.supplierId)?.accountId || '2101' : '2101';
      const voucherNo = storage.getNextVoucherNo('journal', society.financialYear, vouchersRef.current);
      const newV = { type: 'journal' as const, date: data.date, debitAccountId: '5101', creditAccountId: supplierAccountId, amount: data.netAmount, narration: `Credit Purchase: ${data.supplierName} - ${purchaseNo}`, memberId: undefined as undefined, createdBy: data.createdBy, id: crypto.randomUUID(), voucherNo, createdAt: new Date().toISOString() };
      setVouchersState(prev => { const updated = [...prev, newV]; storage.setVouchers(updated); return updated; });
      supabase.from('vouchers').upsert(withSoc(newV)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
      voucherId = newV.id;
    }
    // ── Auto-create GST journal entry (Dr GST Input / Cr Supplier or Cash/Bank) ──
    const taxVoucherIds: string[] = [];
    if ((data.taxAmount || 0) > 0) {
      const supplierAccountId = data.supplierId ? suppliers.find(s => s.id === data.supplierId)?.accountId || '2101' : '2101';
      const gstCrAcc = data.paymentMode === 'cash' ? ACCOUNT_IDS.CASH : data.paymentMode === 'bank' ? ACCOUNT_IDS.BANK : supplierAccountId;
      const gstVoucherNo = storage.getNextVoucherNo('journal', society.financialYear, vouchersRef.current);
      const gstV = { type: 'journal' as const, date: data.date, debitAccountId: '3310', creditAccountId: gstCrAcc, amount: data.taxAmount!, narration: `GST ITC on Purchase: ${data.supplierName} - ${purchaseNo} (CGST:${data.cgstAmount||0} + SGST:${data.sgstAmount||0} + IGST:${data.igstAmount||0})`, memberId: undefined as undefined, createdBy: data.createdBy, id: crypto.randomUUID(), voucherNo: gstVoucherNo, createdAt: new Date().toISOString() };
      vouchersRef.current = [...vouchersRef.current, gstV];
      setVouchersState(prev => { const updated = [...prev, gstV]; storage.setVouchers(updated); return updated; });
      supabase.from('vouchers').upsert(withSoc(gstV)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
      taxVoucherIds.push(gstV.id);
    }
    // ── Auto-create TDS journal entry (Dr Supplier / Cr TDS Payable) ─────────
    if ((data.tdsAmount || 0) > 0) {
      const supplierAccountId = data.supplierId ? suppliers.find(s => s.id === data.supplierId)?.accountId || '2101' : '2101';
      const tdsVoucherNo = storage.getNextVoucherNo('journal', society.financialYear, vouchersRef.current);
      const tdsV = { type: 'journal' as const, date: data.date, debitAccountId: supplierAccountId, creditAccountId: '2202', amount: data.tdsAmount!, narration: `TDS deducted on Purchase: ${data.supplierName} - ${purchaseNo} (${data.tdsPct||0}%)`, memberId: undefined as undefined, createdBy: data.createdBy, id: crypto.randomUUID(), voucherNo: tdsVoucherNo, createdAt: new Date().toISOString() };
      vouchersRef.current = [...vouchersRef.current, tdsV];
      setVouchersState(prev => { const updated = [...prev, tdsV]; storage.setVouchers(updated); return updated; });
      supabase.from('vouchers').upsert(withSoc(tdsV)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
      taxVoucherIds.push(tdsV.id);
    }
    // Increase stock & add movements, update purchaseRate
    data.items.forEach(item => {
      setStockItemsState(prev => { const updated = prev.map(i => { if (i.id !== item.itemId) return i; const newStock = i.currentStock + item.qty; supabase.from('stock_items').update({ currentStock: newStock, purchaseRate: item.rate }).eq('id', i.id).then(({ error }) => { if (error) console.warn('Stock currentStock sync error:', error.message); }); return { ...i, currentStock: newStock, purchaseRate: item.rate }; }); storage.setStockItems(updated); return updated; });
      const mv: StockMovement = { id: crypto.randomUUID(), date: data.date, itemId: item.itemId, type: 'purchase', qty: item.qty, rate: item.rate, amount: item.amount, referenceNo: purchaseNo, narration: `Purchase from ${data.supplierName}`, createdAt: new Date().toISOString() };
      setStockMovementsState(prev => { const updated = [...prev, mv]; storage.setStockMovements(updated); return updated; });
      supabase.from('stock_movements').upsert(withSoc(mv)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    });
    const purchase: Purchase = { ...data, id: crypto.randomUUID(), purchaseNo, voucherId, taxVoucherIds: taxVoucherIds.length > 0 ? taxVoucherIds : undefined, createdAt: new Date().toISOString() };
    setPurchasesState(prev => { const updated = [...prev, purchase]; storage.setPurchases(updated); return updated; });
    supabase.from('purchases').upsert(withSoc(purchase)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    return purchase;
  }, [society.financialYear, suppliers]);

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
            storage.setVouchers(updated);
            linkedIds.forEach(vid => {
              const cancelled = updated.find(x => x.id === vid);
              if (cancelled) supabase.from('vouchers').upsert(cancelled).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
            });
            return updated;
          });
        }
        // Reverse stock additions
        purchase.items.forEach(item => {
          setStockItemsState(s => {
            const updated = s.map(i => { if (i.id !== item.itemId) return i; const newStock = Math.max(0, i.currentStock - item.qty); supabase.from('stock_items').update({ currentStock: newStock }).eq('id', i.id).then(({ error }) => { if (error) console.warn('Stock currentStock sync error:', error.message); }); return { ...i, currentStock: newStock }; });
            storage.setStockItems(updated);
            return updated;
          });
        });
      }
      const updated = prev.filter(p => p.id !== id);
      storage.setPurchases(updated);
      return updated;
    });
    supabase.from('purchases').delete().eq('id', id).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
  }, []);

  // ── Employees ──────────────────────────────────────────────────────────────
  const addEmployee = useCallback((data: Omit<Employee, 'id' | 'empNo'>): Employee => {
    const emp: Employee = { ...data, id: crypto.randomUUID(), empNo: storage.getNextEmpNo() };
    setEmployeesState(prev => { const updated = [...prev, emp]; storage.setEmployees(updated); return updated; });
    supabase.from('employees').upsert(withSoc(emp)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    return emp;
  }, []);

  const updateEmployee = useCallback((id: string, data: Partial<Employee>) => {
    let updatedEmp: Employee | undefined;
    setEmployeesState(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, ...data } : e);
      updatedEmp = updated.find(e => e.id === id);
      storage.setEmployees(updated);
      return updated;
    });
    if (updatedEmp) {
      supabase.from('employees').upsert(updatedEmp).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    }
  }, []);

  const deleteEmployee = useCallback((id: string) => {
    setEmployeesState(prev => { const updated = prev.filter(e => e.id !== id); storage.setEmployees(updated); return updated; });
    supabase.from('employees').delete().eq('id', id).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
  }, []);

  // ── Salary Records ─────────────────────────────────────────────────────────
  const addSalaryRecord = useCallback((data: Omit<SalaryRecord, 'id' | 'slipNo' | 'createdAt'>): SalaryRecord => {
    const slipNo = storage.getNextSalarySlipNo(society.financialYear);
    const record: SalaryRecord = { ...data, id: crypto.randomUUID(), slipNo, createdAt: new Date().toISOString() };
    setSalaryRecordsState(prev => { const updated = [...prev, record]; storage.setSalaryRecords(updated); return updated; });
    supabase.from('salary_records').upsert(withSoc(record)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
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
          setVouchersState(v => { const upd = [...v, newV]; storage.setVouchers(upd); return upd; });
          supabase.from('vouchers').upsert(withSoc(newV)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
          merged.voucherId = newV.id;
        }
        return merged;
      });
      storage.setSalaryRecords(updated);
      const updatedRecord = updated.find(r => r.id === id);
      if (updatedRecord) {
        supabase.from('salary_records').upsert(updatedRecord).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
      }
      return updated;
    });
  }, [employees, society.financialYear]);

  const deleteSalaryRecord = useCallback((id: string) => {
    setSalaryRecordsState(prev => { const updated = prev.filter(r => r.id !== id); storage.setSalaryRecords(updated); return updated; });
    supabase.from('salary_records').delete().eq('id', id).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
  }, []);

  // ── Suppliers ──────────────────────────────────────────────────────────────
  const addSupplier = useCallback((data: Omit<Supplier, 'id' | 'supplierCode' | 'accountId' | 'createdAt'>): Supplier => {
    const accountId = crypto.randomUUID();
    // Auto-create ledger account under Sundry Creditors (2101)
    const newAccount: LedgerAccount = {
      id: accountId,
      name: data.name,
      nameHi: data.name,
      type: 'liability',
      openingBalance: 0,
      openingBalanceType: 'credit',
      isSystem: false,
      isGroup: false,
      parentId: '2101',
    };
    setAccountsState(prev => { const updated = [...prev, newAccount]; storage.setAccounts(updated); return updated; });
    supabase.from('accounts').upsert(withSoc(newAccount)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });

    const supplier: Supplier = { ...data, id: crypto.randomUUID(), supplierCode: storage.getNextSupplierCode(), accountId, createdAt: new Date().toISOString() };
    setSuppliersState(prev => { const updated = [...prev, supplier]; storage.setSuppliers(updated); return updated; });
    supabase.from('suppliers').upsert(withSoc(supplier)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    return supplier;
  }, []);

  const updateSupplier = useCallback((id: string, data: Partial<Omit<Supplier, 'id' | 'supplierCode' | 'accountId' | 'createdAt'>>) => {
    let updated: Supplier | undefined;
    setSuppliersState(prev => {
      const arr = prev.map(s => s.id === id ? { ...s, ...data } : s);
      updated = arr.find(s => s.id === id);
      storage.setSuppliers(arr);
      return arr;
    });
    // Sync name change to linked account
    if (data.name) {
      setAccountsState(prev => {
        const sup = suppliers.find(s => s.id === id);
        if (!sup) return prev;
        const arr = prev.map(a => a.id === sup.accountId ? { ...a, name: data.name!, nameHi: data.name! } : a);
        storage.setAccounts(arr);
        return arr;
      });
    }
    if (updated) supabase.from('suppliers').upsert(withSoc(updated)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
  }, [suppliers]);

  const deleteSupplier = useCallback((id: string) => {
    const sup = suppliers.find(s => s.id === id);
    setSuppliersState(prev => { const arr = prev.filter(s => s.id !== id); storage.setSuppliers(arr); return arr; });
    supabase.from('suppliers').delete().eq('id', id).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    if (sup?.accountId) {
      setAccountsState(prev => { const arr = prev.filter(a => a.id !== sup.accountId); storage.setAccounts(arr); return arr; });
      supabase.from('accounts').delete().eq('id', sup.accountId).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    }
  }, [suppliers]);

  // ── Customers ──────────────────────────────────────────────────────────────
  const addCustomer = useCallback((data: Omit<Customer, 'id' | 'customerCode' | 'accountId' | 'createdAt'>): Customer => {
    const accountId = crypto.randomUUID();
    // Auto-create ledger account under Sundry Debtors (3303)
    const newAccount: LedgerAccount = {
      id: accountId,
      name: data.name,
      nameHi: data.name,
      type: 'asset',
      openingBalance: 0,
      openingBalanceType: 'debit',
      isSystem: false,
      isGroup: false,
      parentId: '3303',
    };
    setAccountsState(prev => { const updated = [...prev, newAccount]; storage.setAccounts(updated); return updated; });
    supabase.from('accounts').upsert(withSoc(newAccount)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });

    const customer: Customer = { ...data, id: crypto.randomUUID(), customerCode: storage.getNextCustomerCode(), accountId, createdAt: new Date().toISOString() };
    setCustomersState(prev => { const updated = [...prev, customer]; storage.setCustomers(updated); return updated; });
    supabase.from('customers').upsert(withSoc(customer)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    return customer;
  }, []);

  const updateCustomer = useCallback((id: string, data: Partial<Omit<Customer, 'id' | 'customerCode' | 'accountId' | 'createdAt'>>) => {
    let updated: Customer | undefined;
    setCustomersState(prev => {
      const arr = prev.map(c => c.id === id ? { ...c, ...data } : c);
      updated = arr.find(c => c.id === id);
      storage.setCustomers(arr);
      return arr;
    });
    if (data.name) {
      setAccountsState(prev => {
        const cus = customers.find(c => c.id === id);
        if (!cus) return prev;
        const arr = prev.map(a => a.id === cus.accountId ? { ...a, name: data.name!, nameHi: data.name! } : a);
        storage.setAccounts(arr);
        return arr;
      });
    }
    if (updated) supabase.from('customers').upsert(withSoc(updated)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
  }, [customers]);

  const deleteCustomer = useCallback((id: string) => {
    const cus = customers.find(c => c.id === id);
    setCustomersState(prev => { const arr = prev.filter(c => c.id !== id); storage.setCustomers(arr); return arr; });
    supabase.from('customers').delete().eq('id', id).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    if (cus?.accountId) {
      setAccountsState(prev => { const arr = prev.filter(a => a.id !== cus.accountId); storage.setAccounts(arr); return arr; });
      supabase.from('accounts').delete().eq('id', cus.accountId).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    }
  }, [customers]);

  return (
    <DataContext.Provider value={{
      vouchers, members, accounts, society, loans, assets, auditObjections,
      stockItems, stockMovements, sales, purchases, employees, salaryRecords,
      suppliers, customers,
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

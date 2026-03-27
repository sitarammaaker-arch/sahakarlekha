import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type {
  Voucher, Member, LedgerAccount, SocietySettings,
  AccountBalance, CashBookEntry, BankBookEntry, MemberLedgerEntry, ReceiptsPaymentsData,
  Loan, Asset, AuditObjection,
  StockItem, StockMovement,
  Sale, Purchase,
  Employee, SalaryRecord, PaymentMode,
} from '@/types';
import * as storage from '@/lib/storage';
import { supabase } from '@/lib/supabase';

interface DataContextType {
  vouchers: Voucher[];
  members: Member[];
  accounts: LedgerAccount[];
  society: SocietySettings;
  loans: Loan[];
  assets: Asset[];

  addVoucher: (data: Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>) => Voucher;
  updateVoucher: (id: string, data: Partial<Pick<Voucher, 'type' | 'date' | 'debitAccountId' | 'creditAccountId' | 'amount' | 'narration' | 'memberId'>>) => void;
  cancelVoucher: (id: string, reason: string, deletedBy: string) => void;
  restoreVoucher: (id: string) => void;
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

  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    const sid = user?.societyId || 'SOC001';
    societyIdRef.current = sid;

    // Reset all state to empty before loading new society's data
    setVouchersState([]); setMembersState([]); setLoansState([]);
    setAssetsState([]); setAuditObjectionsState([]); setStockItemsState([]);
    setStockMovementsState([]); setSalesState([]); setPurchasesState([]);
    setEmployeesState([]); setSalaryRecordsState([]);

    const loadFromSupabase = async () => {
      try {
        const [
          { data: vData, error: vErr }, { data: mData }, { data: aData },
          { data: lData }, { data: asData }, { data: aoData },
          { data: siData }, { data: smData }, { data: slData },
          { data: puData }, { data: emData }, { data: srData },
          { data: socData },
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
        ]);

        if (vErr) console.warn('Vouchers query error:', vErr.message);
        if (mData && mData.length > 0) { setMembersState(mData); storage.setMembers(mData); }
        else setMembersState([]);

        // Ensure ADM_FEE account exists for this society
        const baseAccts: LedgerAccount[] = aData && aData.length > 0 ? [...aData] : [...storage.getAccounts()];
        if (!baseAccts.some(a => a.id === 'ADM_FEE')) {
          const admFeeAcc: LedgerAccount = { id: 'ADM_FEE', name: 'Admission Fee Income', nameHi: 'प्रवेश शुल्क आय', type: 'income', openingBalance: 0, openingBalanceType: 'credit', isSystem: true };
          baseAccts.push(admFeeAcc);
          supabase.from('accounts').upsert({ ...admFeeAcc, society_id: sid }).then(({ error }) => { if (error) console.warn('ADM_FEE account sync error:', error.message); });
        }
        setAccountsState(baseAccts);
        storage.setAccounts(baseAccts);

        // Auto-create missing member vouchers (Share Capital & Admission Fee) for proper double-entry
        const loadedVouchers: Voucher[] = !vErr && vData ? vData : [];
        const fyStr = (socData && socData.length > 0 ? socData[0] : society).financialYear;
        const autoVouchers: Voucher[] = [];
        for (const member of (mData || [])) {
          const mv = loadedVouchers.filter(v => v.memberId === member.id && !v.isDeleted);
          if (!mv.some(v => v.creditAccountId === 'SHARE_CAP') && (member.shareCapital || 0) > 0) {
            autoVouchers.push({ id: crypto.randomUUID(), voucherNo: storage.getNextVoucherNo('receipt', fyStr), type: 'receipt', date: member.joinDate, debitAccountId: 'CASH', creditAccountId: 'SHARE_CAP', amount: member.shareCapital, narration: `Share Capital received from ${member.name}`, memberId: member.id, createdAt: new Date().toISOString() });
          }
          if (!mv.some(v => v.creditAccountId === 'ADM_FEE') && (member.admissionFee || 0) > 0) {
            autoVouchers.push({ id: crypto.randomUUID(), voucherNo: storage.getNextVoucherNo('receipt', fyStr), type: 'receipt', date: member.joinDate, debitAccountId: 'CASH', creditAccountId: 'ADM_FEE', amount: member.admissionFee, narration: `Admission Fee received from ${member.name}`, memberId: member.id, createdAt: new Date().toISOString() });
          }
        }
        const finalVouchers = [...loadedVouchers, ...autoVouchers];
        setVouchersState(finalVouchers);
        storage.setVouchers(finalVouchers);
        for (const v of autoVouchers) {
          supabase.from('vouchers').upsert({ ...v, society_id: sid }).then(({ error }) => { if (error) console.warn('Auto member voucher sync error:', error.message); });
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
        if (socData && socData.length > 0) { setSocietyState(socData[0]); storage.setSociety(socData[0]); }
      } catch (err) {
        console.warn('Supabase load failed, using localStorage:', err);
      } finally {
        setDbReady(true);
      }
    };
    loadFromSupabase();
  }, [user?.societyId]);

  const addVoucher = useCallback((data: Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>): Voucher => {
    const voucherNo = storage.getNextVoucherNo(data.type, society.financialYear);
    const newVoucher: Voucher = {
      ...data,
      id: crypto.randomUUID(),
      voucherNo,
      createdAt: new Date().toISOString(),
    };
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
    const updatedVoucher = { ...current, ...data };
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
      const v: Voucher = { id: crypto.randomUUID(), voucherNo: storage.getNextVoucherNo('receipt', society.financialYear), type: 'receipt', date: newMember.joinDate, debitAccountId: 'CASH', creditAccountId: 'SHARE_CAP', amount: newMember.shareCapital, narration: `Share Capital received from ${newMember.name}`, memberId: newMember.id, createdAt: new Date().toISOString() };
      setVouchersState(prev => { const updated = [...prev, v]; storage.setVouchers(updated); return updated; });
      supabase.from('vouchers').upsert(withSoc(v)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    }
    if ((newMember.admissionFee || 0) > 0) {
      const v: Voucher = { id: crypto.randomUUID(), voucherNo: storage.getNextVoucherNo('receipt', society.financialYear), type: 'receipt', date: newMember.joinDate, debitAccountId: 'CASH', creditAccountId: 'ADM_FEE', amount: newMember.admissionFee!, narration: `Admission Fee received from ${newMember.name}`, memberId: newMember.id, createdAt: new Date().toISOString() };
      setVouchersState(prev => { const updated = [...prev, v]; storage.setVouchers(updated); return updated; });
      supabase.from('vouchers').upsert(withSoc(v)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    }
    return newMember;
  }, [society.financialYear]);

  const updateMember = useCallback((id: string, data: Partial<Member>) => {
    let oldMember: Member | undefined;
    let updatedMember: Member | undefined;
    setMembersState(prev => {
      oldMember = prev.find(m => m.id === id);
      const updated = prev.map(m => m.id === id ? { ...m, ...data } : m);
      updatedMember = updated.find(m => m.id === id);
      storage.setMembers(updated);
      return updated;
    });
    if (updatedMember) {
      supabase.from('members').upsert(updatedMember).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    }
    // Update Share Capital voucher if amount changed
    if (oldMember && data.shareCapital !== undefined && data.shareCapital !== oldMember.shareCapital) {
      const scv = vouchersRef.current.find(v => v.memberId === id && v.creditAccountId === 'SHARE_CAP' && !v.isDeleted);
      if (scv) {
        const updated = { ...scv, amount: data.shareCapital };
        setVouchersState(prev => { const list = prev.map(v => v.id === scv.id ? updated : v); storage.setVouchers(list); return list; });
        supabase.from('vouchers').upsert(withSoc(updated)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
      }
    }
    // Update Admission Fee voucher if amount changed
    if (oldMember && data.admissionFee !== undefined && data.admissionFee !== oldMember.admissionFee) {
      const afv = vouchersRef.current.find(v => v.memberId === id && v.creditAccountId === 'ADM_FEE' && !v.isDeleted);
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
    const cashAccount = accounts.find(a => a.id === 'CASH');
    if (!cashAccount) return [];
    let runningBalance = cashAccount.openingBalance;

    const cashVouchers = activeVouchers
      .filter(v => v.debitAccountId === 'CASH' || v.creditAccountId === 'CASH')
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

    if (fromDate) {
      cashVouchers.filter(v => v.date < fromDate).forEach(v => {
        if (v.debitAccountId === 'CASH') runningBalance += v.amount;
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
        const isReceipt = v.debitAccountId === 'CASH';
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
    const bankAccount = accounts.find(a => a.id === 'BANK');
    if (!bankAccount) return [];
    let runningBalance = bankAccount.openingBalance;

    const bankVouchers = activeVouchers
      .filter(v => v.debitAccountId === 'BANK' || v.creditAccountId === 'BANK')
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

    if (fromDate) {
      bankVouchers.filter(v => v.date < fromDate).forEach(v => {
        if (v.debitAccountId === 'BANK') runningBalance += v.amount;
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
        const isDeposit = v.debitAccountId === 'BANK';
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
    return accounts.map(account => {
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
      .filter(v => v.memberId === memberId && (v.creditAccountId === 'SHARE_CAP' || v.debitAccountId === 'SHARE_CAP'))
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

    const hasShareCapVoucher = memberVouchers.some(v => v.creditAccountId === 'SHARE_CAP');
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
      const isCredit = v.creditAccountId === 'SHARE_CAP';
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

  const getReceiptsPayments = useCallback((): ReceiptsPaymentsData => {
    const cashAccount = accounts.find(a => a.id === 'CASH');
    const bankAccount = accounts.find(a => a.id === 'BANK');
    const openingCash = cashAccount?.openingBalance ?? 0;
    const openingBank = bankAccount?.openingBalance ?? 0;

    const receiptMap: Record<string, { name: string; amount: number }> = {};
    const paymentMap: Record<string, { name: string; amount: number }> = {};

    activeVouchers.forEach(v => {
      const isCashDebit = v.debitAccountId === 'CASH';
      const isBankDebit = v.debitAccountId === 'BANK';
      const isCashCredit = v.creditAccountId === 'CASH';
      const isBankCredit = v.creditAccountId === 'BANK';

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

    const closingCash = getAccountBalance('CASH');
    const closingBank = getAccountBalance('BANK');

    return {
      openingCash,
      openingBank,
      receipts: Object.entries(receiptMap).map(([id, v]) => ({ accountId: id, accountName: v.name, amount: v.amount })),
      payments: Object.entries(paymentMap).map(([id, v]) => ({ accountId: id, accountName: v.name, amount: v.amount })),
      closingCash,
      closingBank,
    };
  }, [accounts, vouchers, getAccountBalance]);

  const getProfitLoss = useCallback(() => {
    const tb = getTrialBalance();
    const incomeItems = tb
      .filter(b => b.account.type === 'income')
      .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: Math.abs(b.netBalance) }));
    const expenseItems = tb
      .filter(b => b.account.type === 'expense')
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
    setStockItemsState(prev => { const updated = prev.filter(i => i.id !== id); storage.setStockItems(updated); return updated; });
    supabase.from('stock_items').delete().eq('id', id).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
  }, []);

  const addStockMovement = useCallback((data: Omit<StockMovement, 'id' | 'createdAt'>) => {
    const movement: StockMovement = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setStockMovementsState(prev => { const updated = [...prev, movement]; storage.setStockMovements(updated); return updated; });
    supabase.from('stock_movements').upsert(withSoc(movement)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    // Update currentStock on the item
    setStockItemsState(prev => {
      const updated = prev.map(i => {
        if (i.id !== data.itemId) return i;
        const delta = data.type === 'purchase' || (data.type === 'adjustment' && data.qty > 0) ? data.qty : -Math.abs(data.qty);
        return { ...i, currentStock: i.currentStock + delta };
      });
      storage.setStockItems(updated);
      return updated;
    });
  }, []);

  // ── Sales ──────────────────────────────────────────────────────────────────
  const addSale = useCallback((data: Omit<Sale, 'id' | 'saleNo' | 'createdAt'>): Sale => {
    const saleNo = storage.getNextSaleNo(society.financialYear);
    let voucherId: string | undefined;
    // Auto-create voucher for cash/bank
    if (data.paymentMode !== 'credit') {
      const debitAcc = data.paymentMode === 'cash' ? 'CASH' : 'BANK';
      const v = { type: 'receipt' as const, date: data.date, debitAccountId: debitAcc, creditAccountId: 'STOCK', amount: data.netAmount, narration: `Sale: ${data.customerName} - ${saleNo}`, memberId: undefined, createdBy: data.createdBy };
      const voucherNo = storage.getNextVoucherNo('receipt', society.financialYear);
      const newV = { ...v, id: crypto.randomUUID(), voucherNo, createdAt: new Date().toISOString() };
      setVouchersState(prev => { const updated = [...prev, newV]; storage.setVouchers(updated); return updated; });
      supabase.from('vouchers').upsert(withSoc(newV)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
      voucherId = newV.id;
    } else {
      const voucherNo = storage.getNextVoucherNo('journal', society.financialYear);
      const newV = { type: 'journal' as const, date: data.date, debitAccountId: 'DEBTORS', creditAccountId: 'STOCK', amount: data.netAmount, narration: `Credit Sale: ${data.customerName} - ${saleNo}`, memberId: undefined, createdBy: data.createdBy, id: crypto.randomUUID(), voucherNo, createdAt: new Date().toISOString() };
      setVouchersState(prev => { const updated = [...prev, newV]; storage.setVouchers(updated); return updated; });
      supabase.from('vouchers').upsert(withSoc(newV)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
      voucherId = newV.id;
    }
    // Reduce stock & add movements
    data.items.forEach(item => {
      setStockItemsState(prev => { const updated = prev.map(i => i.id === item.itemId ? { ...i, currentStock: i.currentStock - item.qty } : i); storage.setStockItems(updated); return updated; });
      const mv: StockMovement = { id: crypto.randomUUID(), date: data.date, itemId: item.itemId, type: 'sale', qty: item.qty, rate: item.rate, amount: item.amount, referenceNo: saleNo, narration: `Sale to ${data.customerName}`, createdAt: new Date().toISOString() };
      setStockMovementsState(prev => { const updated = [...prev, mv]; storage.setStockMovements(updated); return updated; });
      supabase.from('stock_movements').upsert(withSoc(mv)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    });
    const sale: Sale = { ...data, id: crypto.randomUUID(), saleNo, voucherId, createdAt: new Date().toISOString() };
    setSalesState(prev => { const updated = [...prev, sale]; storage.setSales(updated); return updated; });
    supabase.from('sales').upsert(withSoc(sale)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    return sale;
  }, [society.financialYear]);

  const deleteSale = useCallback((id: string) => {
    setSalesState(prev => {
      const sale = prev.find(s => s.id === id);
      if (sale?.voucherId) {
        setVouchersState(v => {
          const updated = v.map(x => x.id === sale.voucherId ? { ...x, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: 'System', deletedReason: 'Sale deleted' } : x);
          storage.setVouchers(updated);
          const cancelledV = updated.find(x => x.id === sale.voucherId);
          if (cancelledV) {
            supabase.from('vouchers').upsert(cancelledV).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
          }
          return updated;
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
      const creditAcc = data.paymentMode === 'cash' ? 'CASH' : 'BANK';
      const voucherNo = storage.getNextVoucherNo('payment', society.financialYear);
      const newV = { type: 'payment' as const, date: data.date, debitAccountId: 'STOCK', creditAccountId: creditAcc, amount: data.netAmount, narration: `Purchase: ${data.supplierName} - ${purchaseNo}`, memberId: undefined as undefined, createdBy: data.createdBy, id: crypto.randomUUID(), voucherNo, createdAt: new Date().toISOString() };
      setVouchersState(prev => { const updated = [...prev, newV]; storage.setVouchers(updated); return updated; });
      supabase.from('vouchers').upsert(withSoc(newV)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
      voucherId = newV.id;
    } else {
      const voucherNo = storage.getNextVoucherNo('journal', society.financialYear);
      const newV = { type: 'journal' as const, date: data.date, debitAccountId: 'STOCK', creditAccountId: 'CREDITORS', amount: data.netAmount, narration: `Credit Purchase: ${data.supplierName} - ${purchaseNo}`, memberId: undefined as undefined, createdBy: data.createdBy, id: crypto.randomUUID(), voucherNo, createdAt: new Date().toISOString() };
      setVouchersState(prev => { const updated = [...prev, newV]; storage.setVouchers(updated); return updated; });
      supabase.from('vouchers').upsert(withSoc(newV)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
      voucherId = newV.id;
    }
    // Increase stock & add movements, update purchaseRate
    data.items.forEach(item => {
      setStockItemsState(prev => { const updated = prev.map(i => i.id === item.itemId ? { ...i, currentStock: i.currentStock + item.qty, purchaseRate: item.rate } : i); storage.setStockItems(updated); return updated; });
      const mv: StockMovement = { id: crypto.randomUUID(), date: data.date, itemId: item.itemId, type: 'purchase', qty: item.qty, rate: item.rate, amount: item.amount, referenceNo: purchaseNo, narration: `Purchase from ${data.supplierName}`, createdAt: new Date().toISOString() };
      setStockMovementsState(prev => { const updated = [...prev, mv]; storage.setStockMovements(updated); return updated; });
      supabase.from('stock_movements').upsert(withSoc(mv)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    });
    const purchase: Purchase = { ...data, id: crypto.randomUUID(), purchaseNo, voucherId, createdAt: new Date().toISOString() };
    setPurchasesState(prev => { const updated = [...prev, purchase]; storage.setPurchases(updated); return updated; });
    supabase.from('purchases').upsert(withSoc(purchase)).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
    return purchase;
  }, [society.financialYear]);

  const deletePurchase = useCallback((id: string) => {
    setPurchasesState(prev => {
      const purchase = prev.find(p => p.id === id);
      if (purchase?.voucherId) {
        setVouchersState(v => {
          const updated = v.map(x => x.id === purchase.voucherId ? { ...x, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: 'System', deletedReason: 'Purchase deleted' } : x);
          storage.setVouchers(updated);
          const cancelledV = updated.find(x => x.id === purchase.voucherId);
          if (cancelledV) {
            supabase.from('vouchers').upsert(cancelledV).then(({ error }) => { if (error) console.warn('Supabase sync error:', error.message); });
          }
          return updated;
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
          const creditAcc = merged.paymentMode === 'cash' ? 'CASH' : 'BANK';
          const voucherNo = storage.getNextVoucherNo('payment', society.financialYear);
          const newV = { type: 'payment' as const, date: merged.paidDate || new Date().toISOString().split('T')[0], debitAccountId: 'SAL_EXP', creditAccountId: creditAcc, amount: merged.netSalary, narration: `Salary: ${emp?.name || ''} - ${r.month}`, memberId: undefined as undefined, createdBy: 'System', id: crypto.randomUUID(), voucherNo, createdAt: new Date().toISOString() };
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

  return (
    <DataContext.Provider value={{
      vouchers, members, accounts, society, loans, assets, auditObjections,
      stockItems, stockMovements, sales, purchases, employees, salaryRecords,
      addVoucher, updateVoucher, cancelVoucher, restoreVoucher,
      addMember, updateMember, deleteMember,
      addAccount, updateAccount, deleteAccount, updateSociety,
      addLoan, updateLoan, deleteLoan,
      addAsset, updateAsset, deleteAsset,
      addAuditObjection, updateAuditObjection, deleteAuditObjection,
      addStockItem, updateStockItem, deleteStockItem, addStockMovement,
      addSale, deleteSale,
      addPurchase, deletePurchase,
      addEmployee, updateEmployee, deleteEmployee,
      addSalaryRecord, updateSalaryRecord, deleteSalaryRecord,
      getAccountBalance, getCashBookEntries, getBankBookEntries,
      getTrialBalance, getProfitLoss, getMemberLedger, getReceiptsPayments,
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

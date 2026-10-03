/**
 * TDS Register — Quarterly TDS tracking + Form 26Q export
 * Auto-imports from purchases, allows manual entries, challan linking, 26Q text export
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/lib/supabase';
import * as storage from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, Plus, AlertTriangle, CheckCircle2, Clock, FileSpreadsheet, Calendar, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { fmtDate } from '@/lib/dateUtils';
import { generate26QText, download26Q, validate26QData, getQuarterFromDate, getQuarterDueDate } from '@/lib/tds26q';
import { applyPercent, toMinor, toRupees } from '@/lib/money';
import type { TdsEntry, TdsChallan, TdsChallanLink, TdsSection, TdsDeducteeType, TdsQuarter } from '@/types';
import { resolveSectionRef, describeSectionRef, isAct2025 } from '@/lib/rules/tdsSections';
import { reportError } from '@/lib/errorReporting';
import { buildChallanPosting, CHALLAN_REF_TYPE, CHALLAN_POSTING_MESSAGE } from '@/lib/tax/challanPosting';
import { tdsPayableAccountId, penaltyAccountId, MISSING_HEAD_TOAST } from '@/lib/accounting/headResolve';
import { Checkbox } from '@/components/ui/checkbox';

const fmt = (n: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

// Extract PAN (chars 3–12) from a GSTIN, but ONLY when it's a well-formed 15-char
// GSTIN — otherwise return '' so a missing/short GSTIN can't produce a corrupt PAN
// that silently breaks 26Q export.
const panFromGstin = (gstin?: string): string => {
  const g = (gstin || '').trim().toUpperCase();
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/.test(g) ? g.substring(2, 12) : '';
};

const TDS_SECTIONS: { value: TdsSection; label: string; rate: string }[] = [
  { value: '192', label: 'Sec 192 — Salary', rate: 'Slab' },
  { value: '194A', label: 'Sec 194A — Interest', rate: '10%' },
  { value: '194C', label: 'Sec 194C — Contractor', rate: '1%/2%' },
  { value: '194H', label: 'Sec 194H — Commission', rate: '2%' },
  { value: '194I', label: 'Sec 194I — Rent (land/building)', rate: '10%' },
  { value: '194J', label: 'Sec 194J — Professional', rate: '10%' },
  { value: '194Q', label: 'Sec 194Q — Purchase', rate: '0.1%' },
  { value: '195', label: 'Sec 195 — Non-resident', rate: 'Varies' },
];

const QUARTERS: { value: TdsQuarter; label: string; months: string }[] = [
  { value: 'Q1', label: 'Q1', months: 'Apr-Jun' },
  { value: 'Q2', label: 'Q2', months: 'Jul-Sep' },
  { value: 'Q3', label: 'Q3', months: 'Oct-Dec' },
  { value: 'Q4', label: 'Q4', months: 'Jan-Mar' },
];

const EMPTY_ENTRY = (): Omit<TdsEntry, 'id' | 'createdAt'> => ({
  date: new Date().toISOString().split('T')[0],
  deducteePan: '',
  deducteeName: '',
  deducteeType: 'individual' as TdsDeducteeType,
  section: '194C' as TdsSection,
  natureOfPayment: '',
  grossAmount: 0,
  tdsRate: 0,
  tdsAmount: 0,
  quarter: getQuarterFromDate(new Date().toISOString().split('T')[0]),
  financialYear: '',
  status: 'pending',
});

const EMPTY_CHALLAN = (): Omit<TdsChallan, 'id' | 'createdAt'> => ({
  bsrCode: '',
  challanDate: new Date().toISOString().split('T')[0],
  challanSerial: '',
  amount: 0,
  bankName: '',
  quarter: getQuarterFromDate(new Date().toISOString().split('T')[0]),
  financialYear: '',
  status: 'paid',   // a challan number / BSR code exists only once the tax is deposited
});

const TdsRegister: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { purchases: allPurchases, suppliers, society, matchesActiveBranch, salaryRecords: allSalaryRecords, employees, accounts, vouchers, addVoucher, cancelVoucher } = useData();
  // ECR-17: honour the active branch (same rule as GstSummary / the registers).
  const purchases = useMemo(() => allPurchases.filter(p => matchesActiveBranch(p.branchId)), [allPurchases, matchesActiveBranch]);
  /* Salary is NOT branch-scoped — `SalaryRecord` has no branchId (verified, not assumed:
     tsc rejected it). So a branch view shows every branch's salary TDS. That is a real
     gap for a multi-branch society's 24Q, but inventing a scope here would be worse than
     naming it: the fix belongs on the record, not on this page's filter. */
  const salaryRecords = allSalaryRecords;
  const { toast } = useToast();
  const hi = language === 'hi';
  const fy = society.financialYear;
  const societyId = user?.societyId || 'SOC001';
  const withSoc = <T extends object>(d: T) => ({ ...d, society_id: societyId });

  // State — manual entries + challans (persisted; Supabase-first, localStorage fallback)
  const [entries, setEntries] = useState<TdsEntry[]>(() => storage.getTdsEntries());
  const [challans, setChallans] = useState<TdsChallan[]>(() => storage.getTdsChallans());
  const [links, setLinks] = useState<TdsChallanLink[]>(() => storage.getTdsChallanLinks());
  useEffect(() => {
    if (!user?.societyId) { setEntries([]); setChallans([]); setLinks([]); return; }
    supabase.from('tds_entries').select('*').eq('society_id', user.societyId).then(
      ({ data, error }) => setEntries(error || !data ? storage.getTdsEntries() : (data as TdsEntry[])),
      () => setEntries(storage.getTdsEntries()),
    );
    supabase.from('tds_challans').select('*').eq('society_id', user.societyId).then(
      ({ data, error }) => setChallans(error || !data ? storage.getTdsChallans() : (data as TdsChallan[])),
      () => setChallans(storage.getTdsChallans()),
    );
    supabase.from('tds_challan_links').select('*').eq('society_id', user.societyId).then(
      ({ data, error }) => setLinks(error || !data ? storage.getTdsChallanLinks() : (data as TdsChallanLink[])),
      () => setLinks(storage.getTdsChallanLinks()),
    );
  }, [user?.societyId]);
  const [selectedQuarter, setSelectedQuarter] = useState<TdsQuarter>(() => getQuarterFromDate(new Date().toISOString().split('T')[0]));
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showAddChallan, setShowAddChallan] = useState(false);
  const [entryForm, setEntryForm] = useState(EMPTY_ENTRY());
  const [challanForm, setChallanForm] = useState(EMPTY_CHALLAN());
  // Ledger voucher for a PAID challan (Dr TDS Payable [+ Dr penalty] / Cr Bank). Kept apart from the challan row, which has no
  // columns for these: the amounts live in the voucher, which is linked back through refType/refId.
  const [postChallanVoucher, setPostChallanVoucher] = useState(true);
  const [challanBankId, setChallanBankId] = useState('');
  const [challanInterest, setChallanInterest] = useState(0);
  const [challanOther, setChallanOther] = useState(0);
  const bankAccounts = useMemo(() => storage.getBankAccountIds(accounts).map(id => accounts.find(a => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a), [accounts]);

  // Auto-import from purchases with TDS
  const purchaseTdsEntries = useMemo((): TdsEntry[] => {
    return purchases
      .filter(p => !(p as any).isDeleted && p.tdsAmount > 0)
      .map(p => {
        const supplier = suppliers.find(s => s.id === p.supplierId);
        // Derive the FY from the purchase DATE, not the society's current FY, so a
        // cross-year purchase lands in the correct 26Q period (Audit #10).
        const pd = new Date(p.date);
        const psy = pd.getMonth() >= 3 ? pd.getFullYear() : pd.getFullYear() - 1;
        const pfy = `${psy}-${String((psy + 1) % 100).padStart(2, '0')}`;
        return {
          id: `pur-${p.id}`,
          date: p.date,
          deducteePan: panFromGstin(supplier?.gstNo),
          deducteeName: p.supplierName || supplier?.name || '',
          deducteeType: 'firm' as TdsDeducteeType,
          section: '194Q' as TdsSection,
          natureOfPayment: 'Purchase of Goods',
          grossAmount: p.netAmount,
          tdsRate: p.tdsPct || 0.1,
          tdsAmount: p.tdsAmount,
          quarter: getQuarterFromDate(p.date),
          financialYear: pfy,
          status: 'pending' as const,
          purchaseId: p.id,
          createdAt: p.createdAt,
        };
      });
  }, [purchases, suppliers, fy]);

  /* Auto-import from salary (s.192 / Act-2025 s.392) — the same DERIVE pattern as
     purchases above, deliberately.

     Salary TDS lives in `SalaryRecord.tds`, and that stays its ONE source of truth: we
     derive a view, we do not copy rows. Storing it a second time is what breeds the
     "the reports don't agree" class of bug RULE 2 warns about — and the register would
     be the copy that silently drifts.

     `sal-<id>` mirrors `pur-<id>`, which matters more than it looks: the challan-link
     map below is keyed on the stable entry id and already "works for auto pur-<id> +
     manual alike". So salary TDS gets challan linkage, 24Q and the 26Q export for free —
     no migration, no new table, no change to tds26q.ts. */
  const salaryTdsEntries = useMemo((): TdsEntry[] => {
    return salaryRecords
      // No isDeleted on SalaryRecord (unlike purchases) — a salary run is cancelled by
      // reversing the voucher, not by soft-deleting the record.
      .filter(r => (r.tds || 0) > 0)
      .map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        // FY from the salary MONTH, not the society's current FY — a March salary
        // processed in April belongs to the old year's 24Q (mirrors Audit #10 above).
        const d = `${r.month}-01`;
        const sd = new Date(d);
        const sy = sd.getMonth() >= 3 ? sd.getFullYear() : sd.getFullYear() - 1;
        const gross = (r.basicSalary || 0) + (r.allowances || 0);
        return {
          id: `sal-${r.id}`,
          date: d,
          deducteePan: emp?.pan || '',
          deducteeName: emp?.name || '',
          deducteeType: 'individual' as TdsDeducteeType,
          section: '192' as TdsSection,
          natureOfPayment: 'Salary',
          grossAmount: gross,
          // The RATE is not a rule here — salary TDS is slab-derived, so it is whatever
          // this month's deduction worked out to. Recording a made-up "rate" would be a
          // fabricated figure on a statutory register (AI-N8).
          tdsRate: gross > 0 ? Number(((r.tds || 0) / gross * 100).toFixed(2)) : 0,
          tdsAmount: r.tds || 0,
          quarter: getQuarterFromDate(d),
          financialYear: `${sy}-${String((sy + 1) % 100).padStart(2, '0')}`,
          status: 'pending' as const,
          createdAt: r.createdAt,
        };
      });
  }, [salaryRecords, employees]);

  // Combined entries (auto-imported + persisted manual, excluding soft-deleted)
  const activeManualEntries = useMemo(() => entries.filter(e => !e.isDeleted), [entries]);
  const activeChallans = useMemo(() => challans.filter(c => !c.isDeleted), [challans]);
  // Resolve challan links onto entries (works for auto `pur-<id>` + manual alike) so
  // the 26Q export + display see the linkage without any change to tds26q.ts.
  const linkMap = useMemo(() => { const m = new Map<string, string>(); for (const l of links) { if (l.challanId) m.set(l.entryId, l.challanId); } return m; }, [links]);
  const allEntries = useMemo(
    () => [...purchaseTdsEntries, ...salaryTdsEntries, ...activeManualEntries].map(e => { const c = linkMap.get(e.id); return c ? { ...e, challanId: c } : e; }),
    [purchaseTdsEntries, salaryTdsEntries, activeManualEntries, linkMap],
  );
  const quarterEntries = allEntries.filter(e => e.quarter === selectedQuarter && e.financialYear === fy);
  const quarterChallans = activeChallans.filter(c => c.quarter === selectedQuarter && c.financialYear === fy);

  // Stats
  const totalDeducted = quarterEntries.reduce((s, e) => s + e.tdsAmount, 0);
  const totalDeposited = quarterChallans.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
  const totalPending = totalDeducted - totalDeposited;
  const dueDate = getQuarterDueDate(selectedQuarter, fy);

  // ── RULE-1 persistence helpers ────────────────────────────────────────────
  const persistEntries = (next: TdsEntry[]) => { setEntries(next); storage.setTdsEntries(next); };
  const persistChallans = (next: TdsChallan[]) => { setChallans(next); storage.setTdsChallans(next); };
  const persistLinks = (next: TdsChallanLink[]) => { setLinks(next); storage.setTdsChallanLinks(next); };

  // Assign an entry to a challan ('' = unlink). RULE-1 rollback on cloud-fail.
  const setEntryChallan = (entryId: string, challanId: string) => {
    if (society.fyLocked) { toast({ title: hi ? 'FY लॉक' : 'FY Locked', variant: 'destructive' }); return; }
    const prev = links;
    persistLinks(challanId ? [...links.filter(l => l.entryId !== entryId), { entryId, challanId }] : links.filter(l => l.entryId !== entryId));
    if (challanId) {
      supabase.from('tds_challan_links').upsert(withSoc({ entryId, challanId }), { onConflict: 'society_id,entryId' }).then(({ error }) => {
        if (error) { console.error('TDS link save error:', error.message); persistLinks(prev); toast({ title: hi ? 'चालान लिंक सेव नहीं हुआ' : 'Challan link not saved', description: `Cloud save fail — ${error.message}. (Pehli baar: tds_challan_links block chalayein.)`, variant: 'destructive', duration: 12000 }); }
      });
    } else {
      // RULE 1 (TAX-02): an unlink that did not reach the cloud is rolled back and shown.
      supabase.from('tds_challan_links').delete().eq('society_id', societyId).eq('entryId', entryId).then(({ error }) => {
        if (error) { reportError('tds-unlink', error.message, { entryId }); persistLinks(prev); toast({ title: hi ? 'चालान लिंक नहीं हटा' : 'Challan link not removed', description: `Cloud save fail — ${error.message}. बदलाव वापस लिया गया।`, variant: 'destructive', duration: 12000 }); }
      }, () => { persistLinks(prev); toast({ title: hi ? 'चालान लिंक नहीं हटा' : 'Challan link not removed', description: 'Network error', variant: 'destructive', duration: 12000 }); });
    }
  };

  // Add manual entry
  const handleAddEntry = () => {
    if (society.fyLocked) { toast({ title: hi ? 'FY लॉक' : 'FY Locked', description: hi ? 'ऑडिट-लॉक होने पर जोड़ नहीं सकते।' : 'Cannot add while FY is audit-locked.', variant: 'destructive' }); return; }
    const entry: TdsEntry = {
      ...entryForm,
      id: crypto.randomUUID(),
      financialYear: fy,
      quarter: getQuarterFromDate(entryForm.date),
      // T-02: TDS via money.applyPercent (disciplined half-up) — no `+(x).toFixed(2)` misround.
      tdsAmount: toRupees(applyPercent(toMinor(Number(entryForm.grossAmount) || 0), Number(entryForm.tdsRate) || 0).minor),
      createdAt: new Date().toISOString(),
    };
    const prev = entries;
    persistEntries([...entries, entry]);
    setShowAddEntry(false);
    setEntryForm(EMPTY_ENTRY());
    supabase.from('tds_entries').upsert(withSoc(entry)).then(({ error }) => {
      if (error) {
        console.error('TDS entry save error:', error.message);
        persistEntries(prev); // RULE-1 rollback
        toast({ title: hi ? 'TDS एंट्री सेव नहीं हुई' : 'TDS entry not saved', description: `Cloud save fail — ${error.message}. (Pehli baar: tds_entries block chalayein.)`, variant: 'destructive', duration: 12000 });
      } else {
        toast({ title: hi ? '✅ TDS एंट्री जोड़ी गई' : '✅ TDS entry added' });
      }
    });
  };

  // Add challan. A PAID challan also posts its ledger voucher (Dr TDS Payable [+ Dr penalty] / Cr Bank), so the liability that
  // deducting TDS created actually comes down. Order: the voucher first (its guards — FY / period lock — decide), the challan row
  // second, and a failed cloud save of the row cancels the voucher again (RULE 1).
  const handleAddChallan = () => {
    if (society.fyLocked) { toast({ title: hi ? 'FY लॉक' : 'FY Locked', description: hi ? 'ऑडिट-लॉक होने पर जोड़ नहीं सकते।' : 'Cannot add while FY is audit-locked.', variant: 'destructive' }); return; }
    const challanId = crypto.randomUUID();
    let voucherId: string | undefined;
    if (challanForm.status === 'paid' && postChallanVoucher) {
      const tdsHead = tdsPayableAccountId(accounts);
      if (!tdsHead) { toast({ ...MISSING_HEAD_TOAST.tds, variant: 'destructive', duration: 12000 }); return; }
      const built = buildChallanPosting({
        amount: challanForm.amount, interestAmount: challanInterest, otherAmount: challanOther,
        bankAccountId: challanBankId || bankAccounts[0]?.id, tdsPayableId: tdsHead, penaltyId: penaltyAccountId(accounts),
      });
      if (built.ok === false) {   // explicit: the app's tsconfig is not strict, so `!built.ok` would not narrow the union
        if (built.error === 'no_penalty_head') toast({ ...MISSING_HEAD_TOAST.penalty, variant: 'destructive', duration: 12000 });
        else if (built.error === 'no_tds_head') toast({ ...MISSING_HEAD_TOAST.tds, variant: 'destructive', duration: 12000 });
        else toast({ title: hi ? 'चालान वाउचर नहीं बना' : 'Challan voucher not created', description: CHALLAN_POSTING_MESSAGE[built.error], variant: 'destructive', duration: 12000 });
        return;
      }
      const v = addVoucher({
        type: 'payment', date: challanForm.challanDate, debitAccountId: tdsHead, creditAccountId: built.lines[built.lines.length - 1].accountId,
        amount: built.amount, lines: built.lines,
        narration: `TDS challan deposit — BSR ${challanForm.bsrCode} / ${challanForm.challanSerial || '-'} · ${selectedQuarter} ${fy}`,
        refType: CHALLAN_REF_TYPE, refId: challanId, createdBy: user?.name || 'System',
      });
      if (!v?.id) return;   // addVoucher already told the user why (lock / unbalanced) — no challan row either
      voucherId = v.id;
    }
    const challan: TdsChallan = {
      ...challanForm,
      id: challanId,
      financialYear: fy,
      quarter: selectedQuarter,
      createdAt: new Date().toISOString(),
    };
    const prev = challans;
    persistChallans([...challans, challan]);
    setShowAddChallan(false);
    setChallanForm(EMPTY_CHALLAN());
    setChallanBankId(''); setChallanInterest(0); setChallanOther(0); setPostChallanVoucher(true);
    supabase.from('tds_challans').upsert(withSoc(challan)).then(({ error }) => {
      if (error) {
        console.error('TDS challan save error:', error.message);
        persistChallans(prev); // RULE-1 rollback
        if (voucherId) cancelVoucher(voucherId, 'TDS challan not saved (cloud save failed)', user?.name || 'System');   // the voucher must not outlive its challan
        toast({ title: hi ? 'चालान सेव नहीं हुआ' : 'Challan not saved', description: `Cloud save fail — ${error.message}. (Pehli baar: tds_challans block chalayein.)`, variant: 'destructive', duration: 12000 });
      } else {
        toast({ title: hi ? '✅ चालान जोड़ा गया' : '✅ Challan added' });
      }
    });
  };

  // Delete a manual entry / challan (auto-imported purchase entries can't be deleted here)
  // RULE 1 (TAX-02): a delete is applied on screen, then confirmed by the cloud — a failure OR a refusal
  // (RLS lets the update touch 0 rows without an error) rolls it back with a destructive toast. Before
  // this, a failed delete only reached console.warn and the row came back on refresh.
  const failDelete = (what: string, msg: string, rollback: () => void) => {
    rollback();
    reportError('tds-delete', msg, { what });
    toast({ title: hi ? `${what} नहीं हटा` : `${what} not deleted`, description: `Cloud save fail — ${msg}. बदलाव वापस लिया गया; refresh पर भी वही दिखेगा।`, variant: 'destructive', duration: 12000 });
  };
  const handleDeleteEntry = (id: string) => {
    if (society.fyLocked) { toast({ title: hi ? 'FY लॉक' : 'FY Locked', variant: 'destructive' }); return; }
    const prev = entries;
    persistEntries(entries.filter(e => e.id !== id));
    supabase.from('tds_entries').update({ isDeleted: true }).eq('id', id).select('id').then(({ data, error }) => {
      if (error || !data?.length) failDelete(hi ? 'TDS एंट्री' : 'TDS entry', error?.message ?? (hi ? 'अनुमति नहीं' : 'not permitted'), () => persistEntries(prev));
      else toast({ title: hi ? 'TDS एंट्री हटाई गई' : 'TDS entry deleted' });
    }, () => failDelete(hi ? 'TDS एंट्री' : 'TDS entry', 'network', () => persistEntries(prev)));
  };
  const handleDeleteChallan = (id: string) => {
    if (society.fyLocked) { toast({ title: hi ? 'FY लॉक' : 'FY Locked', variant: 'destructive' }); return; }
    // RULE 3: the challan's ledger voucher goes with it. If it cannot be cancelled (period lock, approval), nothing is deleted.
    for (const v of vouchers.filter(x => x.refType === CHALLAN_REF_TYPE && x.refId === id && !x.isDeleted)) {
      if (!cancelVoucher(v.id, `TDS challan ${id} deleted`, user?.name || 'System')) {
        toast({ title: hi ? 'चालान नहीं हटा' : 'Challan not deleted', description: hi ? `इससे जुड़ा वाउचर ${v.voucherNo} रद्द नहीं हो सका — पहले उसका कारण देखें।` : `Its voucher ${v.voucherNo} could not be cancelled.`, variant: 'destructive', duration: 12000 });
        return;
      }
    }
    const prevChallans = challans;
    const prevLinks = links;
    persistChallans(challans.filter(c => c.id !== id));
    persistLinks(links.filter(l => l.challanId !== id));   // RULE 3: entries of a deleted challan are unlinked
    supabase.from('tds_challans').update({ isDeleted: true }).eq('id', id).select('id').then(({ data, error }) => {
      if (error || !data?.length) {
        failDelete(hi ? 'चालान' : 'Challan', error?.message ?? (hi ? 'अनुमति नहीं' : 'not permitted'), () => { persistChallans(prevChallans); persistLinks(prevLinks); });
        return;
      }
      supabase.from('tds_challan_links').delete().eq('society_id', societyId).eq('challanId', id).then(({ error: le }) => {
        if (le) { reportError('tds-unlink', le.message, { challanId: id }); toast({ title: hi ? 'चालान हटा, पर उसके लिंक नहीं हटे' : 'Challan deleted, links not removed', description: le.message, variant: 'destructive', duration: 12000 }); }
        else toast({ title: hi ? 'चालान हटाया गया' : 'Challan deleted' });
      });
    }, () => failDelete(hi ? 'चालान' : 'Challan', 'network', () => { persistChallans(prevChallans); persistLinks(prevLinks); }));
  };

  // 26Q Export
  const handleExport26Q = () => {
    const errors = validate26QData(quarterEntries, quarterChallans, society);
    if (errors.length > 0) {
      toast({
        title: hi ? '26Q निर्यात त्रुटि' : '26Q Export Validation Errors',
        description: errors.slice(0, 3).join('; '),
        variant: 'destructive',
      });
      return;
    }
    const text = generate26QText({
      entries: quarterEntries,
      challans: quarterChallans,
      society,
      quarter: selectedQuarter,
      financialYear: fy,
    });
    download26Q(text, society, selectedQuarter, fy);
    // The file carries 1961 section numbers, and for FY 2026-27 onwards those sections
    // are repealed (Income-tax Act 2025, in force 1-4-2026). We do NOT silently rewrite
    // them: our 2025 mapping is CA-confirmed but single-sourced, and a wrong statutory
    // reference on a government return is worse than a stale one — it looks checked.
    // So we say it, at the exact moment it matters: the download.
    if (isAct2025(`${fy.slice(0, 4)}-07-01`)) {
      toast({
        title: hi ? '26Q डाउनलोड — पर पहले जाँच लें' : '26Q downloaded — check before filing',
        description: hi
          ? 'फ़ाइल में धाराएँ 1961 अधिनियम की हैं (194C आदि)। आयकर अधिनियम 2025 (1-4-2026 से) ने इन्हें बदल दिया है। दाख़िल करने से पहले अपने CA से पुष्टि करें।'
          : 'The file uses 1961-Act sections (194C etc.). The Income-tax Act 2025 (in force 1-4-2026) renumbered them. Confirm with your CA before filing.',
        duration: 14000,
      });
    } else {
      toast({ title: hi ? '26Q फ़ाइल डाउनलोड हो गई' : '26Q file downloaded' });
    }
  };

  // CSV/Excel export
  const exportHeaders = ['Date', 'Deductee PAN', 'Deductee Name', 'Section', 'Nature', 'Gross Amt', 'Rate %', 'TDS Amt', 'Status'];
  const exportRows = () => quarterEntries.map(e => [
    fmtDate(e.date), e.deducteePan, e.deducteeName, e.section, e.natureOfPayment,
    e.grossAmount, e.tdsRate, e.tdsAmount, e.status,
  ]);
  const handleCSV = () => downloadCSV(exportHeaders, exportRows(), `tds-register-${selectedQuarter}-${fy}`);
  const handleExcel = () => downloadExcelSingle(exportHeaders, exportRows(), `tds-register-${selectedQuarter}-${fy}`, 'TDS Register');

  const statusBadge = (status: string) => {
    if (status === 'filed') return <Badge className="bg-success/20 text-success border-success/30">Filed</Badge>;
    if (status === 'deposited') return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Deposited</Badge>;
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            {hi ? 'TDS रजिस्टर / 26Q निर्यात' : 'TDS Register / 26Q Export'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {hi ? `वित्तीय वर्ष ${fy} | TAN: ${society.tan || 'सेटअप में भरें'}` : `FY ${fy} | TAN: ${society.tan || 'Set in Society Setup'}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExcel}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleCSV}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button size="sm" className="gap-1 bg-primary" onClick={handleExport26Q}>
            <FileText className="h-4 w-4" /> 26Q Export
          </Button>
        </div>
      </div>

      {/* Quarter Selector */}
      <div className="flex gap-2 flex-wrap">
        {QUARTERS.map(q => (
          <Button
            key={q.value}
            variant={selectedQuarter === q.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedQuarter(q.value)}
            className="gap-1"
          >
            <Calendar className="h-3 w-3" />
            {q.label} ({q.months})
          </Button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'कुल TDS काटा' : 'Total Deducted'}</p>
            <p className="text-xl font-bold text-blue-700">{fmt(totalDeducted)}</p>
            <p className="text-xs text-muted-foreground">{quarterEntries.length} {hi ? 'एंट्रियां' : 'entries'}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'जमा किया' : 'Deposited'}</p>
            <p className="text-xl font-bold text-green-700">{fmt(totalDeposited)}</p>
            <p className="text-xs text-muted-foreground">{quarterChallans.filter(c => c.status === 'paid').length} {hi ? 'चालान' : 'challans'}</p>
          </CardContent>
        </Card>
        <Card className={`${totalPending > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'लंबित जमा' : 'Pending Deposit'}</p>
            <p className={`text-xl font-bold ${totalPending > 0 ? 'text-amber-700' : 'text-green-700'}`}>{fmt(Math.max(0, totalPending))}</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'फाइलिंग नियत तिथि' : 'Filing Due Date'}</p>
            <p className="text-xl font-bold text-purple-700">{dueDate ? fmtDate(dueDate) : '—'}</p>
            <p className="text-xs text-muted-foreground">{selectedQuarter} — {fy}</p>
          </CardContent>
        </Card>
      </div>

      {/* TAN/PAN Warning */}
      {(!society.tan || !society.entityPan) && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              {hi
                ? 'TAN और PAN Society Setup में भरें — 26Q निर्यात के लिए आवश्यक है'
                : 'Please set TAN and PAN in Society Setup — required for 26Q export'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Entries + Challans */}
      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries" className="gap-1">
            <FileText className="h-4 w-4" />
            {hi ? 'TDS एंट्रियां' : 'TDS Entries'} ({quarterEntries.length})
          </TabsTrigger>
          <TabsTrigger value="challans" className="gap-1">
            <CheckCircle2 className="h-4 w-4" />
            {hi ? 'चालान' : 'Challans'} ({quarterChallans.length})
          </TabsTrigger>
        </TabsList>

        {/* TDS Entries Tab */}
        <TabsContent value="entries">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{hi ? 'TDS कटौती' : 'TDS Deductions'} — {selectedQuarter}</CardTitle>
                {quarterEntries.filter(e => !e.challanId).length > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                    {quarterEntries.filter(e => !e.challanId).length} {hi ? 'बिना चालान' : 'unlinked'}
                  </Badge>
                )}
              </div>
              <Button size="sm" className="gap-1" onClick={() => setShowAddEntry(true)}>
                <Plus className="h-4 w-4" /> {hi ? 'मैन्युअल जोड़ें' : 'Add Manual'}
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                    <TableHead>{hi ? 'कटौतीधारक (PAN)' : 'Deductee (PAN)'}</TableHead>
                    <TableHead>{hi ? 'धारा' : 'Section'}</TableHead>
                    <TableHead>{hi ? 'प्रकृति' : 'Nature'}</TableHead>
                    <TableHead className="text-right">{hi ? 'सकल राशि' : 'Gross Amt'}</TableHead>
                    <TableHead className="text-right">{hi ? 'दर %' : 'Rate %'}</TableHead>
                    <TableHead className="text-right">{hi ? 'TDS राशि' : 'TDS Amt'}</TableHead>
                    <TableHead>{hi ? 'स्रोत' : 'Source'}</TableHead>
                    <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                    <TableHead>{hi ? 'चालान' : 'Challan'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quarterEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        {hi ? 'इस तिमाही में कोई TDS एंट्री नहीं' : 'No TDS entries for this quarter'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    quarterEntries.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm">{fmtDate(entry.date)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{entry.deducteeName}</p>
                            <p className="text-xs font-mono text-muted-foreground">{entry.deducteePan || '—'}</p>
                          </div>
                        </TableCell>
                        {/* The stored key is 1961 numbering and never changes (it IS the
                            key). What it means depends on the entry's own date: the
                            Income-tax Act 2025 came into force 1-4-2026 and renumbered
                            everything. So we show what applies TO THIS ENTRY, and say
                            plainly that the new mapping is not yet verified — see
                            lib/rules/tdsSections.ts. The EXPORT deliberately still
                            prints the stored key: an unverified reference on a
                            government return would be worse than an obviously stale
                            one, because it looks checked. */}
                        <TableCell>
                          {(() => {
                            const ref = resolveSectionRef(entry.section, entry.date);
                            return (
                              <Badge
                                variant="outline"
                                className={`text-xs ${ref.act === '2025' && !ref.verified ? 'border-amber-500/60 text-amber-700 dark:text-amber-500' : ''}`}
                                title={ref.act === '2025' ? `${describeSectionRef(ref)} · संग्रहीत: ${entry.section}` : ref.cite}
                              >
                                {ref.label}{ref.act === '2025' && !ref.verified ? ' ⚠️' : ''}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-sm max-w-32 truncate">{entry.natureOfPayment}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(entry.grossAmount)}</TableCell>
                        <TableCell className="text-right">{entry.tdsRate}%</TableCell>
                        <TableCell className="text-right font-bold text-primary">{fmt(entry.tdsAmount)}</TableCell>
                        <TableCell>
                          {entry.purchaseId
                            ? <Badge variant="outline" className="text-xs bg-blue-50">Auto</Badge>
                            : <span className="inline-flex items-center gap-1">
                                <Badge variant="outline" className="text-xs bg-amber-50">Manual</Badge>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700" title={hi ? 'हटाएं' : 'Delete'} onClick={() => handleDeleteEntry(entry.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </span>
                          }
                        </TableCell>
                        <TableCell>{statusBadge(entry.status)}</TableCell>
                        <TableCell>
                          <Select value={entry.challanId || 'none'} onValueChange={v => setEntryChallan(entry.id, v === 'none' ? '' : v)}>
                            <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{hi ? '— कोई नहीं —' : '— None —'}</SelectItem>
                              {quarterChallans.map(ch => (
                                <SelectItem key={ch.id} value={ch.id}>{(ch.bsrCode || '—')}/{(ch.challanSerial || '—')}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {quarterEntries.length > 0 && (
                    <TableRow className="bg-muted font-bold">
                      <TableCell colSpan={4}>{hi ? 'कुल' : 'Total'}</TableCell>
                      <TableCell className="text-right">{fmt(quarterEntries.reduce((s, e) => s + e.grossAmount, 0))}</TableCell>
                      <TableCell />
                      <TableCell className="text-right text-primary">{fmt(totalDeducted)}</TableCell>
                      <TableCell colSpan={3} />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Section-wise Summary */}
          {quarterEntries.length > 0 && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{hi ? 'धारा-वार सारांश' : 'Section-wise Summary'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {TDS_SECTIONS.map(sec => {
                    const secEntries = quarterEntries.filter(e => e.section === sec.value);
                    const secTotal = secEntries.reduce((s, e) => s + e.tdsAmount, 0);
                    return (
                      <div key={sec.value} className={`p-3 rounded-lg border ${secTotal > 0 ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}>
                        <p className="text-xs font-medium">{sec.value}</p>
                        <p className="text-sm font-bold">{fmt(secTotal)}</p>
                        <p className="text-xs text-muted-foreground">{secEntries.length} {hi ? 'एंट्रियां' : 'entries'}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Challans Tab */}
        <TabsContent value="challans">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">{hi ? 'TDS चालान' : 'TDS Challans'} — {selectedQuarter}</CardTitle>
              <Button size="sm" className="gap-1" onClick={() => setShowAddChallan(true)}>
                <Plus className="h-4 w-4" /> {hi ? 'चालान जोड़ें' : 'Add Challan'}
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>BSR Code</TableHead>
                    <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                    <TableHead>{hi ? 'क्रमांक' : 'Serial No.'}</TableHead>
                    <TableHead>{hi ? 'बैंक' : 'Bank'}</TableHead>
                    <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                    <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quarterChallans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {hi ? 'कोई चालान नहीं' : 'No challans for this quarter'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    quarterChallans.map(ch => (
                      <TableRow key={ch.id}>
                        <TableCell className="font-mono">{ch.bsrCode}</TableCell>
                        <TableCell>{fmtDate(ch.challanDate)}</TableCell>
                        <TableCell>{ch.challanSerial}</TableCell>
                        <TableCell>{ch.bankName}</TableCell>
                        <TableCell className="text-right font-bold">{fmt(ch.amount)}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1">
                            <Badge className={ch.status === 'paid' ? 'bg-success/20 text-success' : 'bg-amber-100 text-amber-700'}>
                              {ch.status === 'paid' ? (hi ? 'भुगतान' : 'Paid') : (hi ? 'लंबित' : 'Pending')}
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700" title={hi ? 'हटाएं' : 'Delete'} onClick={() => handleDeleteChallan(ch.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Manual Entry Dialog */}
      <Dialog open={showAddEntry} onOpenChange={setShowAddEntry}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{hi ? 'TDS एंट्री जोड़ें' : 'Add TDS Entry'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{hi ? 'तिथि' : 'Date'}</Label>
                <Input type="date" value={entryForm.date} onChange={e => setEntryForm(f => ({ ...f, date: e.target.value, quarter: getQuarterFromDate(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'धारा' : 'Section'}</Label>
                <Select value={entryForm.section} onValueChange={v => setEntryForm(f => ({ ...f, section: v as TdsSection }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TDS_SECTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{hi ? 'कटौतीधारक नाम' : 'Deductee Name'}</Label>
                <Input value={entryForm.deducteeName} onChange={e => setEntryForm(f => ({ ...f, deducteeName: e.target.value }))} placeholder="Name" />
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'PAN' : 'Deductee PAN'}</Label>
                <Input value={entryForm.deducteePan} onChange={e => setEntryForm(f => ({ ...f, deducteePan: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" maxLength={10} className="font-mono" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{hi ? 'भुगतान प्रकृति' : 'Nature of Payment'}</Label>
              <Input value={entryForm.natureOfPayment} onChange={e => setEntryForm(f => ({ ...f, natureOfPayment: e.target.value }))} placeholder="e.g. Audit Fee, Contractor Payment" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{hi ? 'सकल राशि (₹)' : 'Gross Amount (₹)'}</Label>
                <Input type="number" min={0} value={entryForm.grossAmount || ''} onChange={e => setEntryForm(f => ({ ...f, grossAmount: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'TDS दर (%)' : 'TDS Rate (%)'}</Label>
                <Input type="number" min={0} step={0.01} value={entryForm.tdsRate || ''} onChange={e => setEntryForm(f => ({ ...f, tdsRate: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'TDS राशि (₹)' : 'TDS Amount (₹)'}</Label>
                <Input type="number" readOnly value={(entryForm.grossAmount * entryForm.tdsRate / 100).toFixed(2)} className="bg-muted" />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowAddEntry(false)}>{hi ? 'रद्द' : 'Cancel'}</Button>
              <Button onClick={handleAddEntry} disabled={!entryForm.deducteeName || entryForm.grossAmount <= 0}>
                {hi ? 'जोड़ें' : 'Add Entry'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Challan Dialog */}
      <Dialog open={showAddChallan} onOpenChange={setShowAddChallan}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{hi ? 'TDS चालान जोड़ें' : 'Add TDS Challan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>BSR Code (7 digits)</Label>
                <Input value={challanForm.bsrCode} onChange={e => setChallanForm(f => ({ ...f, bsrCode: e.target.value.replace(/\D/g, '').slice(0, 7) }))} placeholder="1234567" maxLength={7} className="font-mono" />
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'चालान तिथि' : 'Challan Date'}</Label>
                <Input type="date" value={challanForm.challanDate} onChange={e => setChallanForm(f => ({ ...f, challanDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{hi ? 'क्रमांक' : 'Serial No.'}</Label>
                <Input value={challanForm.challanSerial} onChange={e => setChallanForm(f => ({ ...f, challanSerial: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'राशि (₹)' : 'Amount (₹)'}</Label>
                <Input type="number" min={0} value={challanForm.amount || ''} onChange={e => setChallanForm(f => ({ ...f, amount: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{hi ? 'बैंक' : 'Bank Name'}</Label>
              <Input value={challanForm.bankName} onChange={e => setChallanForm(f => ({ ...f, bankName: e.target.value }))} placeholder="SBI, PNB..." />
            </div>
            <div className="space-y-1">
              <Label>{hi ? 'स्थिति' : 'Status'}</Label>
              <Select value={challanForm.status} onValueChange={v => setChallanForm(f => ({ ...f, status: v as TdsChallan['status'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">{hi ? 'भुगतान हो चुका' : 'Paid'}</SelectItem>
                  <SelectItem value="pending">{hi ? 'लंबित' : 'Pending'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {challanForm.status === 'paid' && (
              <div className="space-y-3 rounded-md border p-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={postChallanVoucher} onCheckedChange={c => setPostChallanVoucher(c === true)} />
                  {hi ? 'लेखे में वाउचर बनाएँ (देय TDS घटाएँ)' : 'Create the ledger voucher (reduces TDS Payable)'}
                </label>
                {postChallanVoucher && (
                  <>
                    <div className="space-y-1">
                      <Label>{hi ? 'बैंक खाता (लेखा)' : 'Bank account (ledger)'}</Label>
                      <Select value={challanBankId || bankAccounts[0]?.id || ''} onValueChange={setChallanBankId}>
                        <SelectTrigger><SelectValue placeholder={hi ? 'बैंक चुनें' : 'Choose bank'} /></SelectTrigger>
                        <SelectContent>
                          {bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>{hi ? 'ब्याज (₹)' : 'Interest (₹)'}</Label>
                        <Input type="number" min={0} value={challanInterest || ''} onChange={e => setChallanInterest(Number(e.target.value))} />
                      </div>
                      <div className="space-y-1">
                        <Label>{hi ? 'अन्य शुल्क (₹)' : 'Other charges (₹)'}</Label>
                        <Input type="number" min={0} value={challanOther || ''} onChange={e => setChallanOther(Number(e.target.value))} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {hi ? 'देय TDS में घटेगा' : 'Reduces TDS Payable by'}: ₹{Math.max(0, challanForm.amount - challanInterest - challanOther).toLocaleString('en-IN')}
                      {' · '}{hi ? 'ब्याज/शुल्क व्यय में' : 'interest / charges to expense'}: ₹{(challanInterest + challanOther).toLocaleString('en-IN')}
                    </p>
                  </>
                )}
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowAddChallan(false)}>{hi ? 'रद्द' : 'Cancel'}</Button>
              <Button onClick={handleAddChallan} disabled={!challanForm.bsrCode || challanForm.amount <= 0}>
                {hi ? 'जोड़ें' : 'Add Challan'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TdsRegister;

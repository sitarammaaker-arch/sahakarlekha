/**
 * Payroll (new pay_* engine, read surface). Lists payroll runs computed by the payroll platform and,
 * on selecting a run, shows its payslips. Reads via the tenant-safe public RPCs (pay_list_runs /
 * pay_run_payslips, migration 115) — the browser cannot touch the pay_* schemas directly. RLS scopes
 * everything to the logged-in user's society.
 *
 * Full cycle: add employees + attendance + statutory IDs/rates → run → verify/approve/lock → post to
 * the ledger → pay; plus payslip print, Register CSV, and the PF ECR filing file. Writes go through the
 * pay-* Edge Functions (the browser cannot touch the pay_* schemas); reads via the tenant-safe RPCs.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet, Users, IndianRupee, Loader2, Play, UserPlus, Printer, Download, Settings2 } from 'lucide-react';

interface PayRun {
  run_id: string; run_no: string; period: string; period_month: string;
  state: string; currency: string; created_at: string; payslip_count: number; total_net_minor: number;
}
interface Payslip {
  payslip_id: string; employee_code: string; employee_name: { hi?: string; en?: string } | null;
  payslip_no: string; gross_minor: number; deductions_minor: number; net_minor: number;
  currency: string; paid_days: number; lop_days: number; status: string;
}
interface Payline {
  code: string; name: { hi?: string; en?: string } | null; kind: string; computed_minor: number; currency: string; seq: number;
}
interface Employee {
  id: string; employee_code: string; full_name: { hi?: string; en?: string } | null; date_of_join: string; basic_minor: number | null;
  employment_type?: string | null; uan?: string | null; pan?: string | null; esic_ip?: string | null;
}
interface StatSetting { key: string; value_num: number; label: string | null; source: string | null; }
interface StructComp {
  code: string; display_name: { hi?: string; en?: string } | null; kind: string;
  calc_method: string; expression_text: string | null; fixed_minor: number | null;
}
const isDeduction = (kind: string) => kind === 'deduction' || kind === 'loan_recovery';

// Employee types (map to seeded pay_core.employment_type codes).
const EMP_TYPES = [
  { code: 'permanent',  hi: 'स्थायी',              en: 'Permanent' },
  { code: 'probation',  hi: 'परिवीक्षाधीन',        en: 'Probationer' },
  { code: 'deputation', hi: 'प्रतिनियुक्ति',       en: 'Deputation' },
  { code: 'fixedterm',  hi: 'नियत-अवधि',           en: 'Fixed-term' },
  { code: 'seasonal',   hi: 'मौसमी',               en: 'Seasonal' },
  { code: 'muster',     hi: 'मस्टर / दैनिक श्रमिक', en: 'Daily Wages' },
  { code: 'casual',     hi: 'आकस्मिक / दिहाड़ी',    en: 'Casual' },
  { code: 'apprentice', hi: 'प्रशिक्षु',           en: 'Apprentice' },
  { code: 'parttime',   hi: 'अंशकालिक',            en: 'Part-time' },
  { code: 'contract',   hi: 'संविदा',              en: 'Contractual' },
  { code: 'consultant', hi: 'सलाहकार',             en: 'Consultant' },
  { code: 'honorary',   hi: 'मानद',                en: 'Honorary' },
];
const DAILY_TYPES = ['muster', 'casual'];
const empTypeLabel = (code: string | null | undefined, hi: boolean) => {
  const t = EMP_TYPES.find((x) => x.code === code);
  return t ? (hi ? t.hi : t.en) : (code || '');
};
// consolidated (single monthly amount) types; the daily types take a per-day rate; apprentice a
// stipend; everything else a monthly Basic.
const isConsolidatedType = (code: string) => ['contract', 'honorary', 'parttime', 'consultant'].includes(code);
const isDailyType = (code: string) => DAILY_TYPES.includes(code);

// supabase-js resolves an Edge Function's non-2xx as { data: null, error: FunctionsHttpError }, and the
// JSON body — our friendly { error: "…" } message — lives on error.context, NOT error.message (which is
// the generic "…non-2xx status code"). Unwrap it so the server's message actually reaches the user.
async function invokeError(error: unknown, data: unknown): Promise<string> {
  const inData = (data as { error?: string } | null)?.error;
  if (inData) return inData;
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try { const body = await ctx.json() as { error?: string }; if (body?.error) return body.error; } catch { /* body not JSON */ }
  }
  return (error as { message?: string } | null)?.message ?? 'unknown error';
}

const rupees = (minor: number | string) =>
  '₹' + (Number(minor) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const stateVariant = (s: string): 'default' | 'secondary' | 'outline' =>
  s === 'posted' || s === 'paid' ? 'default' : s === 'draft' ? 'outline' : 'secondary';

const Payroll: React.FC = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [runs, setRuns] = useState<PayRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PayRun | null>(null);
  const [slips, setSlips] = useState<Payslip[]>([]);
  const [slipsLoading, setSlipsLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lines, setLines] = useState<Payline[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);

  const [runOpen, setRunOpen] = useState(false);
  const [period, setPeriod] = useState('');
  const [running, setRunning] = useState(false);
  const [transitioning, setTransitioning] = useState<string | null>(null);

  const [statList, setStatList] = useState<StatSetting[]>([]);
  const [statOpen, setStatOpen] = useState(false);
  const [statKey, setStatKey] = useState('');
  const [statVal, setStatVal] = useState('');
  const [statSrc, setStatSrc] = useState('');
  const [statBusy, setStatBusy] = useState(false);

  const loadStatutory = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('pay-employee', { body: { action: 'statutory-list' } });
    if (!error && data) setStatList((data as { settings?: StatSetting[] }).settings || []);
  }, []);

  const editStat = (s: StatSetting) => { setStatKey(s.key); setStatVal(String(Number(s.value_num))); setStatSrc(s.source || ''); };

  const saveStatutory = async () => {
    const value = Number(statVal);
    if (!Number.isFinite(value) || value < 0) { toast({ title: hi ? 'मान डालें' : 'Enter a value', variant: 'destructive' }); return; }
    if (!statSrc.trim()) { toast({ title: hi ? 'स्रोत ज़रूरी' : 'Source required', description: hi ? 'Act/circular का हवाला डालें' : 'Cite the Act/circular', variant: 'destructive' }); return; }
    setStatBusy(true);
    const { data, error } = await supabase.functions.invoke('pay-employee', { body: { action: 'statutory-set', key: statKey, value, source: statSrc.trim() } });
    setStatBusy(false);
    if (error || (data as { error?: string })?.error) { toast({ title: hi ? 'नहीं सहेजा' : 'Save failed', description: await invokeError(error, data), variant: 'destructive' }); return; }
    toast({ title: hi ? 'दर सहेजी ✓' : 'Rate saved ✓', description: `${statKey} = ${value}` });
    setStatKey(''); loadStatutory();
  };

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empOpen, setEmpOpen] = useState(false);
  const [empName, setEmpName] = useState('');
  const [empCode, setEmpCode] = useState('');
  const [empBasic, setEmpBasic] = useState('');
  const [empType, setEmpType] = useState('permanent');
  const [empSaving, setEmpSaving] = useState(false);

  const [attEmp, setAttEmp] = useState<Employee | null>(null);
  const [attPeriod, setAttPeriod] = useState('');
  const [attLop, setAttLop] = useState('');
  const [attSaving, setAttSaving] = useState(false);
  const [editBasic, setEditBasic] = useState('');
  const [empBusy, setEmpBusy] = useState(false);
  const [idUan, setIdUan] = useState('');
  const [idPan, setIdPan] = useState('');
  const [idEsic, setIdEsic] = useState('');
  const [idBusy, setIdBusy] = useState(false);

  const [history, setHistory] = useState<{ id: string; from: string; to: string | null; values: { code: string; name: { hi?: string; en?: string } | null; minor: number }[] }[]>([]);
  const [histOpen, setHistOpen] = useState(false);

  const loadHistory = async (empId: string) => {
    setHistory([]);
    const { data, error } = await supabase.functions.invoke('pay-employee', { body: { action: 'history-get', employeeId: empId } });
    if (!error && data) setHistory((data as { history?: typeof history }).history || []);
  };

  const [structure, setStructure] = useState<StructComp[]>([]);
  const [structEdit, setStructEdit] = useState('');
  const [structVal, setStructVal] = useState('');
  const [structBusy, setStructBusy] = useState('');

  const loadStructure = async (empId: string) => {
    setStructure([]);
    const { data, error } = await supabase.functions.invoke('pay-employee', { body: { action: 'structure-get', employeeId: empId } });
    if (!error && data) setStructure((data as { components?: StructComp[] }).components || []);
  };

  // Editing one component's amount for ONE employee — the server versions the assignment so the
  // employee's pay history is preserved (nothing is overwritten).
  const saveStructVal = async (code: string) => {
    const minor = Math.round(Number(structVal) * 100);
    if (!Number.isFinite(minor) || minor < 0) { toast({ title: hi ? 'मान डालें' : 'Enter a value', variant: 'destructive' }); return; }
    setStructBusy(code);
    const { data, error } = await supabase.functions.invoke('pay-employee', { body: { action: 'structure-set', employeeId: attEmp!.id, code, basicMinor: minor } });
    setStructBusy('');
    if (error || (data as { error?: string })?.error) { toast({ title: hi ? 'नहीं बदला' : 'Update failed', description: await invokeError(error, data), variant: 'destructive' }); return; }
    const versioned = (data as { versioned?: boolean })?.versioned;
    toast({ title: hi ? 'ढाँचा बदला ✓' : 'Structure updated ✓', description: `${code} = ₹${structVal}` + (versioned ? (hi ? ' · नया संस्करण (पुराना इतिहास सुरक्षित)' : ' · new version (history kept)') : '') });
    setStructEdit(''); loadStructure(attEmp!.id); loadHistory(attEmp!.id); loadEmployees();
  };

  const saveIdentity = async () => {
    setIdBusy(true);
    const { data, error } = await supabase.functions.invoke('pay-employee', { body: { action: 'identity-set', employeeId: attEmp!.id, uan: idUan.trim(), pan: idPan.trim(), esicIp: idEsic.trim() } });
    setIdBusy(false);
    if (error || (data as { error?: string })?.error) { toast({ title: hi ? 'नहीं सहेजा' : 'Save failed', description: await invokeError(error, data), variant: 'destructive' }); return; }
    toast({ title: hi ? 'सांविधिक पहचान सहेजी ✓' : 'Statutory IDs saved ✓', description: hi ? 'ECR/24Q में उपयोग होगा' : 'Used in ECR / 24Q filing' });
    setAttEmp(null); loadEmployees();
  };

  const updateSalary = async () => {
    const basicMinor = Math.round(Number(editBasic) * 100);
    if (!Number.isFinite(basicMinor) || basicMinor <= 0) { toast({ title: hi ? 'मूल वेतन डालें' : 'Enter basic salary', variant: 'destructive' }); return; }
    setEmpBusy(true);
    const { data, error } = await supabase.functions.invoke('pay-employee', { body: { action: 'update', employeeId: attEmp!.id, basicMinor } });
    setEmpBusy(false);
    if (error || (data as { error?: string })?.error) { toast({ title: hi ? 'नहीं बदला' : 'Update failed', description: await invokeError(error, data), variant: 'destructive' }); return; }
    toast({ title: hi ? 'वेतन बदला ✓' : 'Salary updated ✓', description: `${nameOf(attEmp!.full_name)} — ₹${editBasic}` });
    setAttEmp(null); loadEmployees();
  };

  const deactivateEmp = async () => {
    setEmpBusy(true);
    const { data, error } = await supabase.functions.invoke('pay-employee', { body: { action: 'deactivate', employeeId: attEmp!.id } });
    setEmpBusy(false);
    if (error || (data as { error?: string })?.error) { toast({ title: hi ? 'नहीं हटा' : 'Failed', description: await invokeError(error, data), variant: 'destructive' }); return; }
    toast({ title: hi ? 'कर्मचारी हटाया ✓' : 'Employee removed ✓', description: hi ? 'अगली पेरोल से बाहर (पुरानी पेस्लिप सुरक्षित)' : 'Excluded from future runs (past payslips kept)' });
    setAttEmp(null); loadEmployees();
  };

  const saveAttendance = async () => {
    if (!/^\d{4}-\d{2}$/.test(attPeriod)) { toast({ title: hi ? 'अवधि चुनें' : 'Pick a period', variant: 'destructive' }); return; }
    const lop = Number(attLop);
    if (!Number.isFinite(lop) || lop < 0 || lop > 31) { toast({ title: hi ? 'LOP दिन 0–31' : 'LOP days 0–31', variant: 'destructive' }); return; }
    setAttSaving(true);
    const { data, error } = await supabase.functions.invoke('pay-employee', { body: { action: 'attendance', employeeId: attEmp!.id, period: attPeriod, lopDays: lop } });
    setAttSaving(false);
    if (error || (data as { error?: string })?.error) {
      toast({ title: hi ? 'उपस्थिति नहीं सहेजी' : 'Could not save', description: await invokeError(error, data), variant: 'destructive' });
      return;
    }
    toast({ title: hi ? 'उपस्थिति सहेजी ✓' : 'Attendance saved ✓', description: `${attPeriod}: ${30 - lop} ${hi ? 'दिन' : 'days'} (LOP ${lop})` });
    setAttEmp(null);
  };

  const loadEmployees = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('pay-employee', { body: { action: 'list' } });
    if (!error && data) setEmployees((data as { employees?: Employee[] }).employees || []);
  }, []);

  const addEmployee = async () => {
    const basicMinor = Math.round(Number(empBasic) * 100);
    if (!empName.trim() || !empCode.trim()) { toast({ title: hi ? 'नाम और कोड ज़रूरी' : 'Name and code required', variant: 'destructive' }); return; }
    if (!Number.isFinite(basicMinor) || basicMinor <= 0) { toast({ title: hi ? 'राशि डालें' : 'Enter an amount', variant: 'destructive' }); return; }
    setEmpSaving(true);
    const { data, error } = await supabase.functions.invoke('pay-employee', { body: { action: 'add', name: empName.trim(), code: empCode.trim(), type: empType, basicMinor } });
    setEmpSaving(false);
    if (error || (data as { error?: string })?.error) {
      toast({ title: hi ? 'कर्मचारी नहीं जुड़ा' : 'Could not add employee', description: await invokeError(error, data), variant: 'destructive' });
      return;
    }
    toast({ title: hi ? 'कर्मचारी जुड़ गया ✓' : 'Employee added ✓', description: `${empName} (${empCode}) · ${empTypeLabel(empType, hi)}` });
    setEmpOpen(false); setEmpName(''); setEmpCode(''); setEmpBasic(''); setEmpType('permanent');
    loadEmployees();
  };

  const loadRuns = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('pay_list_runs');
    if (error) {
      toast({ title: hi ? 'पेरोल लोड नहीं हुआ' : 'Could not load payroll', description: error.message, variant: 'destructive' });
    } else {
      setRuns((data as PayRun[]) || []);
    }
    setLoading(false);
  }, [hi, toast]);

  useEffect(() => { loadRuns(); loadEmployees(); loadStatutory(); }, [loadRuns, loadEmployees, loadStatutory]);

  const runPayroll = async () => {
    if (!/^\d{4}-\d{2}$/.test(period)) {
      toast({ title: hi ? 'अवधि चुनें' : 'Pick a period', description: hi ? 'YYYY-MM (जैसे 2026-05)' : 'YYYY-MM (e.g. 2026-05)', variant: 'destructive' });
      return;
    }
    setRunning(true);
    const { data, error } = await supabase.functions.invoke('pay-run', { body: { period } });
    setRunning(false);
    if (error || (data && (data as { error?: string }).error)) {
      toast({ title: hi ? 'पेरोल नहीं चला' : 'Payroll run failed', description: await invokeError(error, data) || '', variant: 'destructive' });
      return;
    }
    const d = data as { runNo?: string; employeeCount?: number };
    toast({ title: hi ? 'पेरोल चल गया ✓' : 'Payroll run complete ✓', description: `${d.runNo} — ${d.employeeCount} ${hi ? 'पेस्लिप' : 'payslip(s)'}` });
    setRunOpen(false);
    loadRuns();
  };

  const openRun = async (run: PayRun) => {
    setSelected(run);
    setSlipsLoading(true);
    setSlips([]);
    const { data, error } = await supabase.rpc('pay_run_payslips', { p_run_id: run.run_id });
    if (error) {
      toast({ title: hi ? 'पेस्लिप लोड नहीं हुईं' : 'Could not load payslips', description: error.message, variant: 'destructive' });
    } else {
      setSlips((data as Payslip[]) || []);
    }
    setSlipsLoading(false);
  };

  const toggleLines = async (payslipId: string) => {
    if (expanded === payslipId) { setExpanded(null); return; }
    setExpanded(payslipId);
    setLinesLoading(true);
    setLines([]);
    const { data, error } = await supabase.rpc('pay_payslip_lines', { p_payslip_id: payslipId });
    if (error) {
      toast({ title: hi ? 'ब्रेकडाउन लोड नहीं हुआ' : 'Could not load breakdown', description: error.message, variant: 'destructive' });
    } else {
      setLines((data as Payline[]) || []);
    }
    setLinesLoading(false);
  };

  const nextAction = (state: string): { action: string; label: string } | null => {
    if (state === 'draft') return { action: 'verify', label: hi ? 'सत्यापित करें' : 'Verify' };
    if (state === 'verified') return { action: 'approve', label: hi ? 'स्वीकृत करें' : 'Approve' };
    if (state === 'approved') return { action: 'lock', label: hi ? 'लॉक करें' : 'Lock' };
    if (state === 'locked') return { action: 'post', label: hi ? 'बही में पोस्ट करें' : 'Post to ledger' };
    if (state === 'posted') return { action: 'pay', label: hi ? 'भुगतान करें' : 'Pay salaries' };
    return null;
  };

  const doTransition = async (runId: string, action: string) => {
    setTransitioning(runId);
    // 'post' → pay-post · 'pay' → pay-pay · 'rollback' → pay-rollback · rest → pay-transition
    const fn = action === 'post' ? 'pay-post' : action === 'pay' ? 'pay-pay' : action === 'rollback' ? 'pay-rollback' : 'pay-transition';
    const isFinancial = action === 'post' || action === 'pay' || action === 'rollback';
    const { data, error } = await supabase.functions.invoke(fn, { body: isFinancial ? { runId } : { runId, action } });
    setTransitioning(null);
    if (error || (data as { error?: string })?.error) {
      toast({ title: hi ? 'बदलाव नहीं हुआ' : 'Action failed', description: await invokeError(error, data), variant: 'destructive' });
      return;
    }
    if (action === 'post') {
      const d = data as { expense?: number };
      toast({ title: hi ? 'बही में पोस्ट हो गया ✓' : 'Posted to ledger ✓', description: hi ? `journal voucher बना (₹${d.expense})` : `journal voucher created (₹${d.expense})` });
    } else if (action === 'pay') {
      const d = data as { net?: number };
      toast({ title: hi ? 'भुगतान हो गया ✓' : 'Salaries paid ✓', description: hi ? `payment voucher बना (₹${d.net})` : `payment voucher created (₹${d.net})` });
    } else if (action === 'rollback') {
      const d = data as { reversed?: { rev: string }[] };
      toast({ title: hi ? 'रन उलट दिया गया ✓' : 'Run reversed ✓', description: hi ? `${d.reversed?.length ?? 0} reversing voucher बने (books शून्य पर)` : `${d.reversed?.length ?? 0} reversing voucher(s) — books net to zero` });
    } else if (action === 'cancel') {
      toast({ title: hi ? 'रन रद्द ✓' : 'Run cancelled ✓', description: hi ? 'इस अवधि का नया run बनाया जा सकता है' : 'You can start a fresh run for this period' });
    } else {
      toast({ title: hi ? 'हो गया ✓' : 'Done ✓', description: `${(data as { from?: string }).from} → ${(data as { state?: string }).state}` });
    }
    loadRuns();
  };

  const nameOf = (n: { hi?: string; en?: string } | null) => (hi ? n?.hi : n?.en) || n?.en || n?.hi || '—';

  const printPayslip = (slip: Payslip, slipLines: Payline[]) => {
    const earn = slipLines.filter((l) => !isDeduction(l.kind));
    const ded = slipLines.filter((l) => isDeduction(l.kind));
    const rows = (arr: Payline[]) => arr.map((l) => `<tr><td>${nameOf(l.name)} <span style="color:#888;font-size:11px">${l.code}</span></td><td style="text-align:right">${rupees(l.computed_minor)}</td></tr>`).join('') || '<tr><td colspan="2" style="color:#888">—</td></tr>';
    const w = window.open('', '_blank', 'width=720,height=900');
    if (!w) { toast({ title: hi ? 'प्रिंट विंडो नहीं खुली' : 'Print window blocked', description: hi ? 'popup की अनुमति दें' : 'Allow popups', variant: 'destructive' }); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${hi ? 'वेतन पर्ची' : 'Payslip'} ${slip.payslip_no}</title>
      <style>body{font-family:system-ui,'Segoe UI',sans-serif;color:#111;margin:32px;max-width:640px}h1{font-size:20px;margin:0 0 2px}.sub{color:#555;font-size:13px;margin:0 0 16px}table{width:100%;border-collapse:collapse;margin:8px 0}td,th{padding:6px 8px;border-bottom:1px solid #eee;font-size:13px}th{text-align:left;background:#f6f6f6}.tot td{font-weight:600;border-top:2px solid #333}.net{margin-top:16px;padding:10px 12px;background:#f0f7f0;border-radius:8px;font-size:16px;font-weight:700;display:flex;justify-content:space-between}.cols{display:flex;gap:16px}.cols>div{flex:1}@media print{body{margin:12px}}</style></head><body>
      <h1>${hi ? 'वेतन पर्ची' : 'Salary Slip'}</h1>
      <p class="sub">${nameOf(slip.employee_name)} · ${slip.employee_code} &nbsp;|&nbsp; ${hi ? 'अवधि' : 'Period'}: ${selected?.period ?? ''} &nbsp;|&nbsp; ${slip.payslip_no}<br>${hi ? 'भुगतान दिन' : 'Paid days'}: ${Number(slip.paid_days)}</p>
      <div class="cols">
        <div><table><thead><tr><th>${hi ? 'आय' : 'Earnings'}</th><th style="text-align:right">₹</th></tr></thead><tbody>${rows(earn)}<tr class="tot"><td>${hi ? 'कुल आय' : 'Gross'}</td><td style="text-align:right">${rupees(slip.gross_minor)}</td></tr></tbody></table></div>
        <div><table><thead><tr><th>${hi ? 'कटौती' : 'Deductions'}</th><th style="text-align:right">₹</th></tr></thead><tbody>${rows(ded)}<tr class="tot"><td>${hi ? 'कुल कटौती' : 'Total'}</td><td style="text-align:right">${rupees(slip.deductions_minor)}</td></tr></tbody></table></div>
      </div>
      <div class="net"><span>${hi ? 'शुद्ध वेतन / Net Pay' : 'Net Pay'}</span><span>${rupees(slip.net_minor)}</span></div>
      <p style="color:#999;font-size:11px;margin-top:24px">${hi ? 'सहकार लेखा द्वारा गणना' : 'Computed by SahakarLekha'}</p>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  const downloadRegister = () => {
    if (!selected || slips.length === 0) return;
    const money = (m: number) => (Number(m) / 100).toFixed(2);
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const head = [hi ? 'कर्मचारी' : 'Employee', hi ? 'कोड' : 'Code', hi ? 'सकल' : 'Gross', hi ? 'कटौती' : 'Deductions', hi ? 'नेट' : 'Net', hi ? 'भुगतान दिन' : 'Paid Days'];
    const rows = slips.map((s) => [nameOf(s.employee_name), s.employee_code, money(s.gross_minor), money(s.deductions_minor), money(s.net_minor), String(Number(s.paid_days))]);
    const totals = [hi ? 'कुल' : 'TOTAL', '', money(slips.reduce((a, s) => a + Number(s.gross_minor), 0)), money(slips.reduce((a, s) => a + Number(s.deductions_minor), 0)), money(slips.reduce((a, s) => a + Number(s.net_minor), 0)), ''];
    const csv = '﻿' + [head, ...rows, totals].map((r) => r.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `payroll-register-${selected.run_no}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast({ title: hi ? 'रजिस्टर डाउनलोड ✓' : 'Register downloaded ✓', description: `${selected.run_no} — ${slips.length} ${hi ? 'कर्मचारी' : 'employees'}` });
  };

  const rate = (k: string, dflt: number) => { const s = statList.find((x) => x.key === k); return s ? Number(s.value_num) : dflt; };
  const saveText = (name: string, text: string, mime: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  // PF ECR (EPFO Unified Portal) — 11 fields, '#~#'-separated, one line per member. Employer split
  // (EPS/EDLI) uses editable-sourced rates; nothing statutory is hard-coded. Whole rupees, per ECR spec.
  const downloadEcr = async () => {
    if (!selected || slips.length === 0) return;
    const epsRate = rate('eps_rate', 8.33), employerPfRate = rate('employer_pf_rate', 12), ceilingP = Math.round(rate('eps_wage_ceiling', 15000) * 100);
    const uanByCode: Record<string, string> = {};
    employees.forEach((e) => { if (e.uan) uanByCode[e.employee_code] = e.uan; });
    const R = (p: number) => String(Math.round(p / 100)); // paise → whole rupees
    const missing: string[] = [];
    const rows: string[] = [];
    for (const s of slips) {
      const { data } = await supabase.rpc('pay_payslip_lines', { p_payslip_id: s.payslip_id });
      const ls = (data as Payline[]) || [];
      const amt = (code: string) => Number(ls.find((l) => l.code === code)?.computed_minor ?? 0);
      const epfWagesP = amt('BASIC');                         // EPF wages
      const empPfP = amt('PF');                               // employee EPF remitted
      const epsWagesP = Math.min(epfWagesP, ceilingP);        // capped
      const epsP = Math.round(epsWagesP * epsRate / 100);                       // EPS (employer, of capped wages)
      const diffP = Math.max(0, Math.round(epfWagesP * employerPfRate / 100) - epsP); // EPF-EPS diff (employer share − EPS)
      const ncp = Math.max(0, 30 - Number(s.paid_days));
      const uan = uanByCode[s.employee_code] || '';
      if (!uan) missing.push(s.employee_code);
      rows.push([uan, nameOf(s.employee_name), R(Number(s.gross_minor)), R(epfWagesP), R(epsWagesP), R(epsWagesP), R(empPfP), R(epsP), R(diffP), String(ncp), '0'].join('#~#'));
    }
    saveText(`ECR-${selected.run_no}.txt`, rows.join('\n') + '\n', 'text/plain');
    toast({
      title: hi ? 'PF ECR फ़ाइल डाउनलोड ✓' : 'PF ECR file downloaded ✓',
      description: (missing.length ? (hi ? `⚠ ${missing.length} कर्मचारी बिना UAN (${missing.join(', ')}). ` : `⚠ ${missing.length} without UAN (${missing.join(', ')}). `) : '')
        + (hi ? 'अपलोड से पहले वर्तमान EPFO ECR spec से मिलाएँ।' : 'Confirm against the current EPFO ECR spec before upload.'),
      variant: missing.length ? 'destructive' : 'default',
      duration: missing.length ? 12000 : 6000,
    });
  };

  // The payroll is audit-append-only (records are never hard-deleted). Hide the ones the user has
  // retired so they don't clutter the working view: cancelled runs (void, no ledger effect) and
  // deactivated employees (no active salary assignment → basic_minor is null). History still exists.
  const visibleRuns = runs.filter((r) => r.state !== 'cancelled');
  const activeEmployees = employees.filter((e) => e.basic_minor != null);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-6 w-6 text-primary" />
        <h1 className="text-xl md:text-2xl font-semibold">{hi ? 'पेरोल' : 'Payroll'}</h1>
        <Badge variant="secondary" className="ml-1">{hi ? 'नया इंजन' : 'new engine'}</Badge>
        <Button className="ml-auto" size="sm" variant="ghost" onClick={() => { setStatKey(''); setStatOpen(true); }}>
          <Settings2 className="h-4 w-4 mr-1" /> {hi ? 'सांविधिक दरें' : 'Statutory rates'}
        </Button>
        <Button size="sm" onClick={() => { setPeriod(''); setRunOpen(true); }}>
          <Play className="h-4 w-4 mr-1" /> {hi ? 'नया पेरोल चलाएँ' : 'Run payroll'}
        </Button>
      </div>

      <Dialog open={statOpen} onOpenChange={(o) => !statBusy && setStatOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'सांविधिक दरें' : 'Statutory rates'}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">{hi ? 'ये दरें payroll की गणना चलाती हैं। हर दर के साथ उसका authoritative स्रोत (Act/circular) ज़रूर दर्ज करें — मान अनुमान से नहीं, स्रोत से।' : 'These rates drive the payroll calculation. Record each rate WITH its authoritative source (Act/circular) — values come from the source, never a guess.'}</p>
          <div className="space-y-2">
            {statList.length === 0 ? (
              <p className="text-sm text-muted-foreground">{hi ? 'कोई दर नहीं (पहला कर्मचारी जोड़ने पर pf_rate बनती है)।' : 'No rates yet (pf_rate is created when you add the first employee).'}</p>
            ) : statList.map((s) => (
              <div key={s.key} className="border rounded-md p-2">
                {statKey === s.key ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">{s.label || s.key} <span className="text-xs text-muted-foreground">({s.key})</span></div>
                    <div className="flex gap-2 items-center"><Input type="number" className="w-24" value={statVal} onChange={(e) => setStatVal(e.target.value)} /><span className="text-sm text-muted-foreground">{hi ? '(मान)' : '(value)'}</span></div>
                    <Input value={statSrc} onChange={(e) => setStatSrc(e.target.value)} placeholder={hi ? 'स्रोत — Act धारा / circular / URL' : 'Source — Act section / circular / URL'} />
                    <div className="flex gap-2"><Button size="sm" onClick={saveStatutory} disabled={statBusy}>{statBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : (hi ? 'सहेजें' : 'Save')}</Button><Button size="sm" variant="ghost" onClick={() => setStatKey('')}>{hi ? 'रद्द' : 'Cancel'}</Button></div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div><span className="font-medium">{s.label || s.key}</span> <span className="text-sm">= {Number(s.value_num)}</span><div className="text-xs text-muted-foreground">{s.source || (hi ? '⚠ स्रोत दर्ज नहीं' : '⚠ no source recorded')}</div></div>
                    <Button size="sm" variant="outline" onClick={() => editStat(s)}>{hi ? 'बदलें' : 'Edit'}</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setStatOpen(false)}>{hi ? 'बंद करें' : 'Close'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={runOpen} onOpenChange={(o) => !running && setRunOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{hi ? 'नया पेरोल चलाएँ' : 'Run payroll'}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pay-period">{hi ? 'अवधि (माह)' : 'Period (month)'}</Label>
            <Input id="pay-period" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
            <p className="text-xs text-muted-foreground">{hi ? 'सर्वर इस माह के लिए सभी नियुक्त कर्मचारियों की गणना करके पेस्लिप बनाएगा।' : 'The server computes payslips for all assigned employees for this month.'}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunOpen(false)} disabled={running}>{hi ? 'रद्द' : 'Cancel'}</Button>
            <Button onClick={runPayroll} disabled={running}>
              {running ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {hi ? 'चल रहा है…' : 'Running…'}</> : <>{hi ? 'चलाएँ' : 'Run'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p className="text-sm text-muted-foreground">
        {hi ? 'पेरोल इंजन द्वारा गणना किए गए वेतन-रन और उनकी पेस्लिप।' : 'Salary runs computed by the payroll engine and their payslips.'}
      </p>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-medium">{hi ? 'कर्मचारी' : 'Employees'}</span>
            <Badge variant="outline">{activeEmployees.length}</Badge>
            <Button className="ml-auto" size="sm" variant="outline" onClick={() => { setEmpName(''); setEmpCode(''); setEmpBasic(''); setEmpType('permanent'); setEmpOpen(true); }}>
              <UserPlus className="h-4 w-4 mr-1" /> {hi ? 'कर्मचारी जोड़ें' : 'Add employee'}
            </Button>
          </div>
          {activeEmployees.length === 0 ? (
            <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई कर्मचारी नहीं। "कर्मचारी जोड़ें" से शुरू करें, फिर पेरोल चलाएँ।' : 'No employees yet — add one, then run payroll.'}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeEmployees.map((e) => (
                <button key={e.id} type="button" className="text-sm border rounded-md px-2 py-1 hover:bg-muted text-left" title={hi ? 'उपस्थिति सेट करें' : 'Set attendance'}
                  onClick={() => { setAttEmp(e); setAttPeriod(''); setAttLop('0'); setEditBasic(e.basic_minor != null ? String(Number(e.basic_minor) / 100) : ''); setIdUan(e.uan || ''); setIdPan(e.pan || ''); setIdEsic(e.esic_ip || ''); setStructEdit(''); setHistOpen(false); loadStructure(e.id); loadHistory(e.id); }}>
                  <span className="font-medium">{nameOf(e.full_name)}</span> <span className="text-xs text-muted-foreground">{e.employee_code}</span>
                  {e.employment_type && <span className="ml-1 text-[10px] px-1 rounded bg-muted text-muted-foreground">{empTypeLabel(e.employment_type, hi)}</span>}
                  {e.basic_minor != null && <span className="ml-1 text-xs text-muted-foreground">· {rupees(e.basic_minor)}</span>}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={empOpen} onOpenChange={(o) => !empSaving && setEmpOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{hi ? 'कर्मचारी जोड़ें' : 'Add employee'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>{hi ? 'नाम' : 'Name'}</Label><Input value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder={hi ? 'जैसे रमेश कुमार' : 'e.g. Ramesh Kumar'} /></div>
            <div className="space-y-1"><Label>{hi ? 'कर्मचारी कोड' : 'Employee code'}</Label><Input value={empCode} onChange={(e) => setEmpCode(e.target.value)} placeholder="E001" /></div>
            <div className="space-y-1">
              <Label>{hi ? 'प्रकार' : 'Type'}</Label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={empType} onChange={(e) => setEmpType(e.target.value)}>
                {EMP_TYPES.map((t) => <option key={t.code} value={t.code}>{hi ? t.hi : t.en}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>{isDailyType(empType) ? (hi ? 'दैनिक दर (₹/दिन)' : 'Daily rate (₹/day)')
                : empType === 'apprentice' ? (hi ? 'छात्रवृत्ति (₹/माह)' : 'Stipend (₹/month)')
                : isConsolidatedType(empType) ? (hi ? 'एकमुश्त राशि (₹/माह)' : 'Consolidated amount (₹/month)')
                : (hi ? 'मूल वेतन (₹/माह)' : 'Basic salary (₹/month)')}</Label>
              <Input type="number" value={empBasic} onChange={(e) => setEmpBasic(e.target.value)} placeholder={isDailyType(empType) ? '500' : '25000'} />
            </div>
            <p className="text-xs text-muted-foreground">
              {(empType === 'permanent' || empType === 'probation') ? (hi ? 'DA (मूल का 20%), HRA (40%), PF (12%) अपने-आप जुड़ेंगे।' : 'DA (20% of basic), HRA (40%), PF (12%) are added automatically.')
                : empType === 'deputation' ? (hi ? 'मूल + DA + प्रतिनियुक्ति भत्ता (बाद में सेट करें)। PF नहीं।' : 'Basic + DA + Deputation allowance (set later). No PF.')
                : (empType === 'seasonal' || empType === 'fixedterm') ? (hi ? 'मूल + DA + PF (HRA नहीं)।' : 'Basic + DA + PF (no HRA).')
                : isDailyType(empType) ? (hi ? 'वेतन = दैनिक दर × उपस्थिति-दिन (उपस्थिति चिप पर सेट करें)।' : 'Pay = daily rate × days worked (set attendance on the chip).')
                : empType === 'apprentice' ? (hi ? 'केवल छात्रवृत्ति, कोई सांविधिक कटौती नहीं।' : 'Stipend only, no statutory deductions.')
                : (hi ? 'केवल एकमुश्त राशि, कोई सांविधिक कटौती नहीं (TDS बाद में)।' : 'Consolidated amount only, no statutory deductions (TDS later).')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmpOpen(false)} disabled={empSaving}>{hi ? 'रद्द' : 'Cancel'}</Button>
            <Button onClick={addEmployee} disabled={empSaving}>{empSaving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {hi ? 'जोड़ रहा है…' : 'Adding…'}</> : (hi ? 'जोड़ें' : 'Add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!attEmp} onOpenChange={(o) => !attSaving && !empBusy && !o && setAttEmp(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{attEmp ? nameOf(attEmp.full_name) : ''} <span className="text-xs text-muted-foreground font-normal">{attEmp?.employee_code}</span></DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {hi ? 'वेतन ढाँचा' : 'Salary structure'}
                {attEmp?.employment_type && <span className="ml-1 text-[10px] px-1 rounded bg-muted text-muted-foreground font-normal">{empTypeLabel(attEmp.employment_type, hi)}</span>}
              </Label>
              {structure.length === 0 ? (
                <p className="text-xs text-muted-foreground">{hi ? 'लोड हो रहा है…' : 'Loading…'}</p>
              ) : structure.map((c) => (
                <div key={c.code} className="border rounded-md p-2 text-sm">
                  {structEdit === c.code ? (
                    <div className="flex gap-2 items-center">
                      <Input type="number" className="h-8" value={structVal} onChange={(e) => setStructVal(e.target.value)} autoFocus />
                      <Button size="sm" onClick={() => saveStructVal(c.code)} disabled={structBusy === c.code}>{structBusy === c.code ? <Loader2 className="h-4 w-4 animate-spin" /> : (hi ? 'सहेजें' : 'Save')}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setStructEdit('')}>{hi ? 'रद्द' : 'Cancel'}</Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-medium">{nameOf(c.display_name)}</span>
                        <span className="ml-1 text-[10px] text-muted-foreground">{isDeduction(c.kind) ? (hi ? 'कटौती' : 'deduction') : c.kind === 'employer_contrib' ? (hi ? 'इनपुट' : 'input') : (hi ? 'आय' : 'earning')}</span>
                        <div className="text-xs text-muted-foreground">
                          {c.fixed_minor != null ? rupees(c.fixed_minor) : (hi ? 'सूत्र से गणना' : 'computed by formula')}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => { setStructEdit(c.code); setStructVal(c.fixed_minor != null ? String(Number(c.fixed_minor) / 100) : ''); }}>{hi ? 'बदलें' : 'Edit'}</Button>
                    </div>
                  )}
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">{hi ? 'कोई भी मान इस कर्मचारी के लिए तय कर सकते हैं — सूत्र वाले घटक पर भी। बदलाव इतिहास में सुरक्षित रहता है।' : 'You can pin any amount for THIS employee — even on a formula component. Every change is kept in history.'}</p>
            </div>

            <div className="border-t pt-3 space-y-2">
              <button type="button" className="flex items-center gap-1 text-sm font-medium hover:underline" onClick={() => setHistOpen((o) => !o)}>
                {hi ? 'वेतन इतिहास' : 'Pay history'} <Badge variant="outline" className="text-[10px]">{history.length}</Badge>
                <span className="text-xs text-muted-foreground">{histOpen ? '▲' : '▼'}</span>
              </button>
              {histOpen && (history.length === 0 ? (
                <p className="text-xs text-muted-foreground">{hi ? 'कोई इतिहास नहीं' : 'No history'}</p>
              ) : (
                <div className="space-y-1">
                  {history.map((v) => (
                    <div key={v.id} className="text-xs border-l-2 border-muted pl-2 py-1">
                      <div className="font-medium">
                        {String(v.from).slice(0, 10)} → {v.to ? String(v.to).slice(0, 10) : (hi ? 'अब तक' : 'current')}
                        {!v.to && <span className="ml-1 text-[10px] px-1 rounded bg-primary/10 text-primary">{hi ? 'चालू' : 'active'}</span>}
                      </div>
                      <div className="text-muted-foreground">
                        {v.values.length === 0 ? (hi ? '— कोई तय राशि नहीं' : '— no pinned amounts')
                          : v.values.map((x) => `${nameOf(x.name)} ${rupees(x.minor)}`).join(' · ')}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">{hi ? 'हर दर-बदलाव एक नया संस्करण बनाता है — पुराना कभी मिटता नहीं (audit)।' : 'Every rate change opens a new version — the old one is never erased (audit).'}</p>
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-sm font-medium">{hi ? 'उपस्थिति' : 'Attendance'}</Label>
              <div className="space-y-1"><Label className="text-xs">{hi ? 'अवधि (माह)' : 'Period (month)'}</Label><Input type="month" value={attPeriod} onChange={(e) => setAttPeriod(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">{hi ? 'बिना-वेतन दिन (LOP)' : 'Loss-of-pay days (LOP)'}</Label><Input type="number" min="0" max="31" value={attLop} onChange={(e) => setAttLop(e.target.value)} placeholder="0" /></div>
              <Button size="sm" variant="outline" onClick={saveAttendance} disabled={attSaving}>{attSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (hi ? 'उपस्थिति सहेजें' : 'Save attendance')}</Button>
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-sm font-medium">{hi ? 'सांविधिक पहचान (filing के लिए)' : 'Statutory IDs (for filing)'}</Label>
              <div className="space-y-1"><Label className="text-xs">UAN <span className="text-muted-foreground">({hi ? 'PF ECR' : 'PF ECR'})</span></Label><Input value={idUan} onChange={(e) => setIdUan(e.target.value)} placeholder="12 digits" maxLength={12} /></div>
              <div className="space-y-1"><Label className="text-xs">PAN <span className="text-muted-foreground">(TDS 24Q)</span></Label><Input value={idPan} onChange={(e) => setIdPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} /></div>
              <div className="space-y-1"><Label className="text-xs">ESIC IP <span className="text-muted-foreground">(ESI)</span></Label><Input value={idEsic} onChange={(e) => setIdEsic(e.target.value)} placeholder={hi ? 'IP संख्या' : 'IP number'} /></div>
              <Button size="sm" variant="outline" onClick={saveIdentity} disabled={idBusy}>{idBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : (hi ? 'पहचान सहेजें' : 'Save IDs')}</Button>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="ghost" className="text-destructive" onClick={deactivateEmp} disabled={empBusy}>{hi ? 'कर्मचारी हटाएँ' : 'Remove employee'}</Button>
            <Button variant="outline" onClick={() => setAttEmp(null)} disabled={attSaving || empBusy}>{hi ? 'बंद करें' : 'Close'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {hi ? 'लोड हो रहा है…' : 'Loading…'}</div>
          ) : visibleRuns.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {hi ? 'अभी कोई पेरोल-रन नहीं। (पेरोल इंजन से एक रन बनने पर यहाँ दिखेगा।)' : 'No payroll runs yet. (A run computed by the payroll engine will appear here.)'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'रन नं.' : 'Run No.'}</TableHead>
                  <TableHead>{hi ? 'अवधि' : 'Period'}</TableHead>
                  <TableHead>{hi ? 'स्थिति' : 'State'}</TableHead>
                  <TableHead className="text-right">{hi ? 'पेस्लिप' : 'Payslips'}</TableHead>
                  <TableHead className="text-right">{hi ? 'कुल नेट' : 'Total Net'}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRuns.map((r) => (
                  <TableRow key={r.run_id} className="cursor-pointer" onClick={() => openRun(r)}>
                    <TableCell className="font-medium">{r.run_no}</TableCell>
                    <TableCell>{r.period}</TableCell>
                    <TableCell><Badge variant={stateVariant(r.state)}>{r.state}</Badge></TableCell>
                    <TableCell className="text-right">{r.payslip_count}</TableCell>
                    <TableCell className="text-right font-medium">{rupees(r.total_net_minor)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {nextAction(r.state) && (
                        <Button size="sm" variant="outline" className="mr-1" disabled={transitioning === r.run_id}
                          onClick={(e) => { e.stopPropagation(); doTransition(r.run_id, nextAction(r.state)!.action); }}>
                          {transitioning === r.run_id ? <Loader2 className="h-3 w-3 animate-spin" /> : nextAction(r.state)!.label}
                        </Button>
                      )}
                      {(r.state === 'posted' || r.state === 'paid') && (
                        <Button size="sm" variant="ghost" className="mr-1 text-destructive" disabled={transitioning === r.run_id}
                          onClick={(e) => {
                            e.stopPropagation();
                            const msg = hi
                              ? `रन ${r.run_no} को उलटें? इसकी बही entries reverse हो जाएँगी (books शून्य पर आएँगी); original रहेंगे। यह सुधार के लिए है।`
                              : `Reverse run ${r.run_no}? Its ledger entries will be reversed (books net to zero); originals are kept. For corrections.`;
                            if (window.confirm(msg)) doTransition(r.run_id, 'rollback');
                          }}>
                          {transitioning === r.run_id ? <Loader2 className="h-3 w-3 animate-spin" /> : (hi ? 'उलटें' : 'Reverse')}
                        </Button>
                      )}
                      {(r.state === 'draft' || r.state === 'verified' || r.state === 'approved') && (
                        <Button size="sm" variant="ghost" className="mr-1 text-destructive" disabled={transitioning === r.run_id}
                          onClick={(e) => {
                            e.stopPropagation();
                            const msg = hi
                              ? `रन ${r.run_no} रद्द करें? यह post होने से पहले का सुधार है — बही पर कोई असर नहीं। रद्द run दोबारा नहीं चलता; उसी अवधि का नया run बनाया जा सकता है।`
                              : `Cancel run ${r.run_no}? Pre-post — no ledger impact. A cancelled run can't resume; you can start a fresh run for the same period.`;
                            if (window.confirm(msg)) doTransition(r.run_id, 'cancel');
                          }}>
                          {transitioning === r.run_id ? <Loader2 className="h-3 w-3 animate-spin" /> : (hi ? 'रद्द करें' : 'Cancel')}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openRun(r); }}>{hi ? 'देखें' : 'View'}</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5" />
              {hi ? 'पेस्लिप' : 'Payslips'} — {selected?.run_no} <span className="text-muted-foreground font-normal">({selected?.period})</span>
              {slips.length > 0 && (
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={downloadRegister}>
                    <Download className="h-4 w-4 mr-1" /> {hi ? 'रजिस्टर CSV' : 'Register CSV'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={downloadEcr} title={hi ? 'EPFO PF ECR फ़ाइल' : 'EPFO PF ECR file'}>
                    <Download className="h-4 w-4 mr-1" /> {hi ? 'PF ECR' : 'PF ECR'}
                  </Button>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>
          {slipsLoading ? (
            <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {hi ? 'लोड हो रहा है…' : 'Loading…'}</div>
          ) : slips.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground"><Users className="h-5 w-5 mx-auto mb-1" />{hi ? 'कोई पेस्लिप नहीं' : 'No payslips'}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'कर्मचारी' : 'Employee'}</TableHead>
                    <TableHead className="text-right">{hi ? 'सकल' : 'Gross'}</TableHead>
                    <TableHead className="text-right">{hi ? 'कटौती' : 'Deductions'}</TableHead>
                    <TableHead className="text-right">{hi ? 'नेट' : 'Net'}</TableHead>
                    <TableHead className="text-right">{hi ? 'दिन' : 'Days'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slips.map((s) => (
                    <React.Fragment key={s.payslip_id}>
                      <TableRow className="cursor-pointer" onClick={() => toggleLines(s.payslip_id)}>
                        <TableCell>
                          <span className="text-xs text-primary mr-1">{expanded === s.payslip_id ? '▾' : '▸'}</span>
                          <span className="font-medium">{nameOf(s.employee_name)}</span> <span className="text-xs text-muted-foreground">{s.employee_code}</span>
                        </TableCell>
                        <TableCell className="text-right">{rupees(s.gross_minor)}</TableCell>
                        <TableCell className="text-right">{rupees(s.deductions_minor)}</TableCell>
                        <TableCell className="text-right font-semibold">{rupees(s.net_minor)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{Number(s.paid_days)}</TableCell>
                      </TableRow>
                      {expanded === s.payslip_id && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/40 py-2">
                            {linesLoading ? (
                              <div className="flex items-center gap-2 px-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> {hi ? 'लोड हो रहा है…' : 'Loading…'}</div>
                            ) : (
                              <div className="space-y-1">
                                {lines.map((ln) => (
                                  <div key={ln.code} className="flex justify-between text-sm px-2">
                                    <span>{nameOf(ln.name)} <span className="text-xs text-muted-foreground">{ln.code}</span></span>
                                    <span className={isDeduction(ln.kind) ? 'text-destructive' : ''}>{isDeduction(ln.kind) ? '− ' : ''}{rupees(ln.computed_minor)}</span>
                                  </div>
                                ))}
                                <div className="pt-1 px-2">
                                  <Button size="sm" variant="outline" onClick={() => printPayslip(s, lines)}>
                                    <Printer className="h-3 w-3 mr-1" /> {hi ? 'पर्ची प्रिंट करें' : 'Print payslip'}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Payroll;

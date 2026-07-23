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
import { useData } from '@/contexts/DataContext';
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
interface AttRow {
  id: string; employee_code: string; full_name: { hi?: string; en?: string } | null;
  employment_type: string | null; paid_days: number | null; lop_days: number | null;
}
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
// Components an admin can add to one employee's structure (mirrors the server's COMPONENTS catalog).
// FIXED_COMPONENTS need an amount when added — the calc refuses a fixed component with no value.
const ADDABLE_COMPONENTS = [
  { code: 'BASIC', hi: 'मूल वेतन', en: 'Basic' },
  { code: 'DA', hi: 'महँगाई भत्ता (DA)', en: 'DA' },
  { code: 'HRA', hi: 'मकान भत्ता (HRA)', en: 'HRA' },
  { code: 'PF', hi: 'भविष्य निधि (PF)', en: 'PF' },
  // LOP variants — one day of what THAT structure actually earns. The payslip shows them all as
  // "Loss of Pay"; only this picker spells out which basis, so the right one can be chosen.
  { code: 'LOP', hi: 'बिना-वेतन कटौती (मूल+DA+HRA)', en: 'Loss of Pay (basic+DA+HRA)' },
  { code: 'LOP_NOHRA', hi: 'बिना-वेतन कटौती (मूल+DA)', en: 'Loss of Pay (basic+DA)' },
  { code: 'LOP_DEP', hi: 'बिना-वेतन कटौती (प्रतिनियुक्ति)', en: 'Loss of Pay (deputation)' },
  { code: 'LOP_CONSOL', hi: 'बिना-वेतन कटौती (एकमुश्त वेतन)', en: 'Loss of Pay (consolidated)' },
  { code: 'LOP_STIPEND', hi: 'बिना-वेतन कटौती (छात्रवृत्ति)', en: 'Loss of Pay (stipend)' },
  { code: 'DEP_ALLOW', hi: 'प्रतिनियुक्ति भत्ता', en: 'Deputation Allowance' },
  { code: 'CONSOLIDATED', hi: 'एकमुश्त वेतन', en: 'Consolidated Pay' },
  { code: 'STIPEND', hi: 'छात्रवृत्ति', en: 'Stipend' },
  { code: 'DAILY_RATE', hi: 'दैनिक दर', en: 'Daily Rate' },
  { code: 'DAILY_WAGE', hi: 'दैनिक वेतन', en: 'Daily Wages' },
];
const FIXED_COMPONENTS = ['BASIC', 'DEP_ALLOW', 'CONSOLIDATED', 'STIPEND', 'DAILY_RATE'];
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

// Amount in words, Indian grouping (crore / lakh / thousand) — a payslip is not complete without it.
// English wording is the convention on Indian salary slips even on Hindi documents.
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const under100 = (n: number): string => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''));
const under1000 = (n: number): string =>
  n >= 100 ? ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + under100(n % 100) : '') : under100(n);
const wholeInWords = (n: number): string => {
  if (n === 0) return 'Zero';
  let out = '';
  const cr = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const th = Math.floor(n / 1000); n %= 1000;
  if (cr) out += under1000(cr) + ' Crore ';
  if (lakh) out += under1000(lakh) + ' Lakh ';
  if (th) out += under1000(th) + ' Thousand ';
  if (n) out += under1000(n);
  return out.trim();
};
/** paise → "Twenty Four Thousand Rupees and Fifty Paise Only" */
const amountInWords = (minor: number): string => {
  const m = Math.round(Math.abs(Number(minor)));
  const rs = Math.floor(m / 100), ps = m % 100;
  return `${wholeInWords(rs)} Rupees${ps ? ' and ' + wholeInWords(ps) + ' Paise' : ''} Only`;
};

const stateVariant = (s: string): 'default' | 'secondary' | 'outline' =>
  s === 'posted' || s === 'paid' ? 'default' : s === 'draft' ? 'outline' : 'secondary';

const Payroll: React.FC = () => {
  const { language } = useLanguage();
  const { society } = useData();   // letterhead for the printed payslip / service record
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
  // who this run would cover, and who has no attendance recorded — shown in the Run dialog itself
  const [runAtt, setRunAtt] = useState<AttRow[]>([]);
  const loadRunAtt = async (p: string) => {
    if (!/^\d{4}-\d{2}$/.test(p)) { setRunAtt([]); return; }
    const { data, error } = await supabase.functions.invoke('pay-employee', { body: { action: 'attendance-list', period: p } });
    setRunAtt(!error && data ? ((data as { attendance?: AttRow[] }).attendance || []) : []);
  };
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
  const [empJoin, setEmpJoin] = useState('');    // date of joining — a fact, printed on the payslip
  const [joinEdit, setJoinEdit] = useState('');  // correcting it for an existing employee
  const [joinBusy, setJoinBusy] = useState(false);
  const [empSaving, setEmpSaving] = useState(false);

  const saveJoining = async () => {
    setJoinBusy(true);
    const { data, error } = await supabase.functions.invoke('pay-employee', { body: { action: 'joining-set', employeeId: attEmp!.id, dateOfJoin: joinEdit } });
    setJoinBusy(false);
    if (error || (data as { error?: string })?.error) { toast({ title: hi ? 'नहीं बदली' : 'Update failed', description: await invokeError(error, data), variant: 'destructive' }); return; }
    toast({ title: hi ? 'नियुक्ति तिथि बदली ✓' : 'Joining date updated ✓', description: joinEdit });
    setAttEmp((e) => (e ? { ...e, date_of_join: joinEdit } : e));
    loadEmployees();
  };

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

  // Service record (सेवा पुस्तिका) — the payroll portion, assembled from what the system already holds:
  // bio + employment type + statutory identity + the current structure + the full pay timeline. The
  // official statutory service book also carries leave / postings / attestation, which are not payroll
  // data — the footer says so rather than implying this is the prescribed form.
  const printServiceBook = () => {
    if (!attEmp) return;
    const w = window.open('', '_blank', 'width=820,height=1000');
    if (!w) { toast({ title: hi ? 'प्रिंट विंडो नहीं खुली' : 'Print window blocked', description: hi ? 'popup की अनुमति दें' : 'Allow popups', variant: 'destructive' }); return; }
    const esc = (s: unknown) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
    const info = (k: string, v: unknown) => `<div class="f"><span class="fk">${k}</span><span class="fv">${esc(v) || '—'}</span></div>`;
    const socName = esc(hi ? (society?.nameHi || society?.name) : (society?.name || society?.nameHi));
    const socAddr = [society?.address, society?.district, society?.state].filter(Boolean).map(esc).join(', ')
      + (society?.pinCode ? ' – ' + esc(society.pinCode) : '');
    const socContact = [society?.phone && `${hi ? 'दूरभाष' : 'Ph'}: ${esc(society.phone)}`, society?.email && esc(society.email)].filter(Boolean).join(' · ');
    const kindLabel = (k: string) => isDeduction(k) ? (hi ? 'कटौती' : 'deduction') : k === 'employer_contrib' ? (hi ? 'इनपुट' : 'input') : (hi ? 'आय' : 'earning');
    const struct = structure.map((c) => `<tr><td>${esc(nameOf(c.display_name))} <span class="mut">${kindLabel(c.kind)}</span></td><td class="amt">${c.fixed_minor != null ? rupees(c.fixed_minor) : `<span class="mut">${hi ? 'सूत्र से गणना' : 'computed by formula'}</span>`}</td></tr>`).join('')
      || `<tr><td colspan="2" class="mut">—</td></tr>`;
    const hist = history.map((v) => `<tr><td>${String(v.from).slice(0, 10)} → ${v.to ? String(v.to).slice(0, 10) : `<b>${hi ? 'अब तक' : 'current'}</b>`}</td><td class="amt">${v.values.length ? v.values.map((x) => `${esc(nameOf(x.name))} ${rupees(x.minor)}`).join(' · ') : `<span class="mut">${hi ? '— कोई तय राशि नहीं' : '— no pinned amounts'}</span>`}</td></tr>`).join('')
      || `<tr><td colspan="2" class="mut">—</td></tr>`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${hi ? 'सेवा पुस्तिका' : 'Service Record'} — ${esc(nameOf(attEmp.full_name))}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Segoe UI',system-ui,sans-serif;color:#1a1a1a;margin:0;padding:28px;background:#fff}
  .sheet{max-width:760px;margin:0 auto;border:1px solid #cfd4da}
  .head{text-align:center;padding:16px 20px 12px;border-bottom:2px solid #1f3a5f}
  .soc{font-size:19px;font-weight:700;color:#1f3a5f;letter-spacing:.2px}
  .addr{font-size:11px;color:#555;margin-top:3px;line-height:1.5}
  .title{background:#1f3a5f;color:#fff;text-align:center;padding:7px;font-size:13px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase}
  .sec{background:#eef2f7;color:#1f3a5f;font-size:11px;text-transform:uppercase;letter-spacing:.6px;padding:6px 20px;border-top:1px solid #cfd4da;border-bottom:1px solid #cfd4da;font-weight:600}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:0 24px;padding:12px 20px}
  .f{display:flex;gap:8px;font-size:12px;padding:3px 0;border-bottom:1px dotted #e8eaed}
  .fk{color:#666;min-width:112px}
  .fv{font-weight:600;color:#1a1a1a}
  table{width:100%;border-collapse:collapse}
  td{padding:6px 20px;font-size:12.5px;border-bottom:1px solid #f1f3f5;vertical-align:top}
  td.amt{text-align:right;font-variant-numeric:tabular-nums}
  .mut{color:#8a8f96;font-size:11px}
  .note{margin:14px 20px;padding:10px 12px;background:#f7f9fc;border:1px solid #e3e6ea;border-radius:6px;color:#555;font-size:10.5px;line-height:1.6}
  .foot{padding:0 20px 14px;font-size:10.5px;color:#777}
  @media print{body{padding:0}.sheet{border:none}}
</style></head><body>
  <div class="sheet">
    <div class="head">
      <div class="soc">${socName || (hi ? 'सहकारी समिति' : 'Cooperative Society')}</div>
      ${socAddr ? `<div class="addr">${socAddr}</div>` : ''}
      <div class="addr">${society?.registrationNo ? `${hi ? 'पंजीकरण संख्या' : 'Reg. No'}: ${esc(society.registrationNo)}` : ''}${socContact ? ' &nbsp;·&nbsp; ' + socContact : ''}</div>
    </div>
    <div class="title">${hi ? 'सेवा पुस्तिका — वेतन अभिलेख' : 'Service Record — Pay'}</div>

    <div class="sec">${hi ? 'कर्मचारी विवरण' : 'Employee details'}</div>
    <div class="meta">
      <div>
        ${info(hi ? 'नाम' : 'Name', nameOf(attEmp.full_name))}
        ${info(hi ? 'कर्मचारी कोड' : 'Employee code', attEmp.employee_code)}
        ${info(hi ? 'प्रकार' : 'Employment type', empTypeLabel(attEmp.employment_type, hi))}
      </div>
      <div>
        ${info(hi ? 'नियुक्ति तिथि' : 'Date of joining', String(attEmp.date_of_join || '').slice(0, 10))}
        ${info('UAN', attEmp.uan)}
        ${info('PAN', attEmp.pan)}
        ${info('ESIC IP', attEmp.esic_ip)}
      </div>
    </div>

    <div class="sec">${hi ? 'वर्तमान वेतन ढाँचा' : 'Current salary structure'}</div>
    <table>${struct}</table>

    <div class="sec">${hi ? 'वेतन इतिहास' : 'Pay history'}</div>
    <table>${hist}</table>

    <div class="note">${hi
      ? 'यह अभिलेख सहकार लेखा की पेरोल प्रणाली से स्वतः बना है और सेवा पुस्तिका का <b>वेतन-भाग</b> दर्शाता है। पूर्ण सांविधिक सेवा पुस्तिका में अवकाश-खाता, स्थानांतरण/पदस्थापन, योग्यता तथा प्रमाणन प्रविष्टियाँ भी होती हैं — वे इस प्रणाली में अभी दर्ज़ नहीं होतीं। निर्धारित प्रपत्र अपने नियमों के अनुसार पुष्टि करें।'
      : 'Generated by the SahakarLekha payroll system; it covers the <b>pay portion</b> of a service book. A full statutory service book also carries the leave account, postings/transfers, qualifications and attestation entries, which this system does not yet record. Confirm the prescribed form against your own rules.'}</div>
    <div class="foot">${hi ? 'निर्मित' : 'Generated'}: ${new Date().toLocaleString(hi ? 'hi-IN' : 'en-IN')}</div>
  </div>
  <script>window.onload=function(){window.print()}</script>
</body></html>`);
    w.document.close();
  };

  interface Loan { id: string; principal_minor: number; installment_minor: number; recovered_minor: number; purpose: string | null; status: string; started_on: string }
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanPrincipal, setLoanPrincipal] = useState('');
  const [loanInstallment, setLoanInstallment] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('');
  const [loanBusy, setLoanBusy] = useState(false);

  const loadLoans = async (empId: string) => {
    setLoans([]);
    const { data, error } = await supabase.functions.invoke('pay-employee', { body: { action: 'loan-list', employeeId: empId } });
    if (!error && data) setLoans((data as { loans?: Loan[] }).loans || []);
  };

  const addLoan = async () => {
    const principal = Math.round(Number(loanPrincipal) * 100), installment = Math.round(Number(loanInstallment) * 100);
    if (!(principal > 0) || !(installment > 0)) { toast({ title: hi ? 'राशि और किस्त डालें' : 'Enter amount and instalment', variant: 'destructive' }); return; }
    setLoanBusy(true);
    const { data, error } = await supabase.functions.invoke('pay-employee', { body: { action: 'loan-add', employeeId: attEmp!.id, principal, installment, purpose: loanPurpose.trim() || null } });
    setLoanBusy(false);
    if (error || (data as { error?: string })?.error) { toast({ title: hi ? 'अग्रिम नहीं जुड़ा' : 'Could not add advance', description: await invokeError(error, data), variant: 'destructive' }); return; }
    toast({ title: hi ? 'अग्रिम दर्ज़ ✓' : 'Advance recorded ✓', description: hi ? 'अगली पेरोल से वसूली शुरू' : 'Recovery starts from the next run' });
    setLoanPrincipal(''); setLoanInstallment(''); setLoanPurpose('');
    loadLoans(attEmp!.id); loadStructure(attEmp!.id);
  };

  const closeLoan = async (loanId: string) => {
    setLoanBusy(true);
    const { data, error } = await supabase.functions.invoke('pay-employee', { body: { action: 'loan-close', loanId } });
    setLoanBusy(false);
    if (error || (data as { error?: string })?.error) { toast({ title: hi ? 'बंद नहीं हुआ' : 'Could not close', description: await invokeError(error, data), variant: 'destructive' }); return; }
    toast({ title: hi ? 'अग्रिम बंद ✓' : 'Advance closed ✓' });
    loadLoans(attEmp!.id);
  };

  // Drop a pinned amount so the component goes back to its formula — the way out of pinning something
  // by mistake (the run computes it again instead of paying the pinned figure).
  const unpinComponent = async (code: string) => {
    setStructBusy(code);
    const { data, error } = await supabase.functions.invoke('pay-employee', { body: { action: 'structure-unset', employeeId: attEmp!.id, code } });
    setStructBusy('');
    if (error || (data as { error?: string })?.error) { toast({ title: hi ? 'नहीं हुआ' : 'Failed', description: await invokeError(error, data), variant: 'destructive' }); return; }
    toast({ title: hi ? 'सूत्र पर लौटा ✓' : 'Back to formula ✓', description: hi ? `${code} अब सूत्र से गणना होगा` : `${code} is computed by its formula again` });
    loadStructure(attEmp!.id); loadHistory(attEmp!.id); loadEmployees();
  };

  // ── Attendance for the whole society, one period at a time ────────────────────────────
  // Setting it employee-by-employee is fine for one absence and painful for a month-end; and an
  // employee with NO row is silently paid a full 30 days, which the admin should SEE before running.
  const [attListOpen, setAttListOpen] = useState(false);
  const [attListPeriod, setAttListPeriod] = useState('');
  const [attRows, setAttRows] = useState<AttRow[]>([]);
  const [attEdits, setAttEdits] = useState<Record<string, string>>({});
  const [attListBusy, setAttListBusy] = useState(false);

  const loadAttList = async (period: string) => {
    if (!/^\d{4}-\d{2}$/.test(period)) { setAttRows([]); setAttEdits({}); return; }
    const { data, error } = await supabase.functions.invoke('pay-employee', { body: { action: 'attendance-list', period } });
    if (error || !data) { toast({ title: hi ? 'लोड नहीं हुआ' : 'Could not load', description: await invokeError(error, data), variant: 'destructive' }); return; }
    const rows = (data as { attendance?: AttRow[] }).attendance || [];
    setAttRows(rows);
    // A daily wager's box means DAYS WORKED, everyone else's means DAYS ABSENT — that is how each is
    // actually counted on the muster roll, and entering one as the other is how mistakes get made.
    setAttEdits(Object.fromEntries(rows.map((r) => {
      const v = isDailyType(r.employment_type ?? '') ? r.paid_days : r.lop_days;
      return [r.id, v == null ? '' : String(Number(v))];
    })));
  };

  const saveAttList = async () => {
    setAttListBusy(true);
    let saved = 0, failed = 0;
    for (const r of attRows) {
      const raw = (attEdits[r.id] ?? '').trim();
      if (raw === '') continue;                                        // left blank → leave as it was
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 31) { failed++; continue; }
      const daily = isDailyType(r.employment_type ?? '');
      const was = daily ? r.paid_days : r.lop_days;
      if (was != null && Number(was) === n) continue;                   // unchanged
      const { data, error } = await supabase.functions.invoke('pay-employee', {
        body: { action: 'attendance', employeeId: r.id, period: attListPeriod, ...(daily ? { paidDays: n } : { lopDays: n }) },
      });
      if (error || (data as { error?: string })?.error) failed++; else saved++;
    }
    setAttListBusy(false);
    toast({
      title: failed ? (hi ? 'कुछ नहीं सहेजे' : 'Some failed') : (hi ? 'उपस्थिति सहेजी ✓' : 'Attendance saved ✓'),
      description: hi ? `${saved} सहेजे${failed ? `, ${failed} विफल (0–31 दिन ही मान्य)` : ''}` : `${saved} saved${failed ? `, ${failed} failed (0–31 days only)` : ''}`,
      variant: failed ? 'destructive' : 'default',
    });
    loadAttList(attListPeriod);
  };

  const [addCode, setAddCode] = useState('');
  const [addVal, setAddVal] = useState('');

  // Add / remove a component for THIS employee only. The server creates a new structure version so
  // past periods keep the structure they were paid on.
  const changeComponent = async (action: 'structure-add' | 'structure-remove', code: string) => {
    setStructBusy(code);
    const body: Record<string, unknown> = { action, employeeId: attEmp!.id, code };
    if (action === 'structure-add' && FIXED_COMPONENTS.includes(code)) body.basicMinor = Math.round(Number(addVal || 0) * 100);
    const { data, error } = await supabase.functions.invoke('pay-employee', { body });
    setStructBusy('');
    if (error || (data as { error?: string })?.error) { toast({ title: hi ? 'नहीं हुआ' : 'Failed', description: await invokeError(error, data), variant: 'destructive' }); return; }
    toast({ title: action === 'structure-add' ? (hi ? 'घटक जुड़ा ✓' : 'Component added ✓') : (hi ? 'घटक हटाया ✓' : 'Component removed ✓'), description: code });
    setAddCode(''); setAddVal('');
    loadStructure(attEmp!.id); loadHistory(attEmp!.id); loadEmployees();
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
    const n = Number(attLop);
    if (!Number.isFinite(n) || n < 0 || n > 31) { toast({ title: hi ? 'दिन 0–31' : 'Days 0–31', variant: 'destructive' }); return; }
    const daily = isDailyType(attEmp?.employment_type ?? '');   // daily wagers enter DAYS WORKED
    setAttSaving(true);
    const { data, error } = await supabase.functions.invoke('pay-employee', {
      body: { action: 'attendance', employeeId: attEmp!.id, period: attPeriod, ...(daily ? { paidDays: n } : { lopDays: n }) },
    });
    setAttSaving(false);
    if (error || (data as { error?: string })?.error) {
      toast({ title: hi ? 'उपस्थिति नहीं सहेजी' : 'Could not save', description: await invokeError(error, data), variant: 'destructive' });
      return;
    }
    const paid = daily ? n : 30 - n;
    toast({ title: hi ? 'उपस्थिति सहेजी ✓' : 'Attendance saved ✓', description: `${attPeriod}: ${paid} ${hi ? 'दिन' : 'days'}${daily ? '' : ` (LOP ${n})`}` });
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
    const { data, error } = await supabase.functions.invoke('pay-employee', { body: { action: 'add', name: empName.trim(), code: empCode.trim(), type: empType, basicMinor, dateOfJoin: empJoin } });
    setEmpSaving(false);
    if (error || (data as { error?: string })?.error) {
      toast({ title: hi ? 'कर्मचारी नहीं जुड़ा' : 'Could not add employee', description: await invokeError(error, data), variant: 'destructive' });
      return;
    }
    toast({ title: hi ? 'कर्मचारी जुड़ गया ✓' : 'Employee added ✓', description: `${empName} (${empCode}) · ${empTypeLabel(empType, hi)}` });
    setEmpOpen(false); setEmpName(''); setEmpCode(''); setEmpBasic(''); setEmpType('permanent'); setEmpJoin('');
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
    const emp = employees.find((e) => e.employee_code === slip.employee_code);
    const esc = (s: unknown) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
    // period "2026-06" → "June 2026" / "जून 2026"
    const [py, pm] = String(selected?.period ?? '').split('-');
    const MONTHS = hi
      ? ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर']
      : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const periodLabel = pm ? `${MONTHS[Number(pm) - 1] ?? pm} ${py}` : String(selected?.period ?? '');

    // Somebody who joined mid-month is paid only for the days served, so the payslip carries a large
    // Loss of Pay line. Say WHY on the slip itself — an unexplained half-salary is what generates the
    // "meri tankhwah kam kyun aayi" question this page exists to prevent.
    const dim = py && pm ? new Date(Number(py), Number(pm), 0).getDate() : 30;
    const doj = String(emp?.date_of_join ?? '').slice(0, 10);
    const joinedMidPeriod = doj > `${py}-${pm}-01` && doj <= `${py}-${pm}-${String(dim).padStart(2, '0')}`;
    const serviceSpan = `${doj.slice(8)} ${hi ? 'से' : 'to'} ${dim} ${MONTHS[Number(pm) - 1] ?? pm} ${py}`;

    // pad the shorter column so both tables end level — a payslip that doesn't line up looks amateur
    const pad = Math.max(earn.length, ded.length);
    const cell = (l: Payline | undefined) => l
      ? `<td>${esc(nameOf(l.name))}</td><td class="amt">${rupees(l.computed_minor)}</td>`
      : '<td>&nbsp;</td><td class="amt">&nbsp;</td>';
    const bodyRows = Array.from({ length: pad }, (_, i) => `<tr>${cell(earn[i])}${cell(ded[i])}</tr>`).join('')
      || '<tr><td colspan="4" class="mut">—</td></tr>';

    const info = (k: string, v: unknown) => `<div class="f"><span class="fk">${k}</span><span class="fv">${esc(v) || '—'}</span></div>`;
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) { toast({ title: hi ? 'प्रिंट विंडो नहीं खुली' : 'Print window blocked', description: hi ? 'popup की अनुमति दें' : 'Allow popups', variant: 'destructive' }); return; }
    const socName = esc(hi ? (society?.nameHi || society?.name) : (society?.name || society?.nameHi));
    const socAddr = [society?.address, society?.district, society?.state].filter(Boolean).map(esc).join(', ')
      + (society?.pinCode ? ' – ' + esc(society.pinCode) : '');
    const socContact = [society?.phone && `${hi ? 'दूरभाष' : 'Ph'}: ${esc(society.phone)}`, society?.email && esc(society.email)].filter(Boolean).join(' · ');

    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${hi ? 'वेतन पर्ची' : 'Salary Slip'} — ${esc(nameOf(slip.employee_name))} — ${esc(periodLabel)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Segoe UI',system-ui,sans-serif;color:#1a1a1a;margin:0;padding:28px;background:#fff}
  .sheet{max-width:760px;margin:0 auto;border:1px solid #cfd4da}
  .head{text-align:center;padding:16px 20px 12px;border-bottom:2px solid #1f3a5f}
  .soc{font-size:19px;font-weight:700;color:#1f3a5f;letter-spacing:.2px}
  .addr{font-size:11px;color:#555;margin-top:3px;line-height:1.5}
  .title{background:#1f3a5f;color:#fff;text-align:center;padding:7px;font-size:13px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:0 24px;padding:14px 20px;border-bottom:1px solid #e3e6ea}
  .f{display:flex;gap:8px;font-size:12px;padding:3px 0;border-bottom:1px dotted #e8eaed}
  .fk{color:#666;min-width:112px}
  .fv{font-weight:600;color:#1a1a1a}
  table{width:100%;border-collapse:collapse}
  thead th{background:#eef2f7;color:#1f3a5f;font-size:11px;text-transform:uppercase;letter-spacing:.6px;padding:8px 12px;text-align:left;border-bottom:1px solid #cfd4da}
  thead th.amt,td.amt{text-align:right}
  td{padding:6px 12px;font-size:12.5px;border-bottom:1px solid #f1f3f5}
  td.amt{font-variant-numeric:tabular-nums;white-space:nowrap}
  th.sep,td.sep{border-left:1px solid #cfd4da}
  tfoot td{font-weight:700;background:#f7f9fc;border-top:2px solid #1f3a5f;border-bottom:none;padding:9px 12px;font-size:13px}
  .net{display:flex;justify-content:space-between;align-items:center;padding:12px 20px;background:#1f3a5f;color:#fff}
  .net .lbl{font-size:12px;letter-spacing:.8px;text-transform:uppercase;opacity:.9}
  .net .val{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums}
  .words{padding:9px 20px;font-size:11.5px;color:#333;background:#f7f9fc;border-bottom:1px solid #e3e6ea}
  .words b{color:#1f3a5f}
  .foot{padding:12px 20px;font-size:10.5px;color:#777;line-height:1.6;display:flex;justify-content:space-between;gap:16px}
  .mut{color:#999}
  @media print{body{padding:0}.sheet{border:none}}
</style></head><body>
  <div class="sheet">
    <div class="head">
      <div class="soc">${socName || (hi ? 'सहकारी समिति' : 'Cooperative Society')}</div>
      ${socAddr ? `<div class="addr">${socAddr}</div>` : ''}
      <div class="addr">${society?.registrationNo ? `${hi ? 'पंजीकरण संख्या' : 'Reg. No'}: ${esc(society.registrationNo)}` : ''}${socContact ? ' &nbsp;·&nbsp; ' + socContact : ''}</div>
    </div>
    <div class="title">${hi ? `वेतन पर्ची — ${periodLabel}` : `Salary Slip — ${periodLabel}`}</div>

    <div class="meta">
      <div>
        ${info(hi ? 'कर्मचारी' : 'Employee', nameOf(slip.employee_name))}
        ${info(hi ? 'कर्मचारी कोड' : 'Employee code', slip.employee_code)}
        ${info(hi ? 'प्रकार' : 'Type', empTypeLabel(emp?.employment_type, hi))}
        ${info(hi ? 'नियुक्ति तिथि' : 'Date of joining', String(emp?.date_of_join ?? '').slice(0, 10))}
      </div>
      <div>
        ${info(hi ? 'पर्ची संख्या' : 'Payslip no.', slip.payslip_no)}
        ${info(hi ? 'भुगतान दिन' : 'Paid days', `${Number(slip.paid_days)}${Number(slip.lop_days) ? `  (${hi ? 'अवैतनिक' : 'LOP'} ${Number(slip.lop_days)})` : ''}`)}
        ${joinedMidPeriod ? info(hi ? 'इस माह सेवा' : 'Service this month', serviceSpan) : ''}
        ${info('UAN', emp?.uan)}
        ${info('PAN', emp?.pan)}
      </div>
    </div>

    <table>
      <thead><tr>
        <th>${hi ? 'आय' : 'Earnings'}</th><th class="amt">${hi ? 'राशि (₹)' : 'Amount (₹)'}</th>
        <th class="sep">${hi ? 'कटौती' : 'Deductions'}</th><th class="amt">${hi ? 'राशि (₹)' : 'Amount (₹)'}</th>
      </tr></thead>
      <tbody>${bodyRows}</tbody>
      <tfoot><tr>
        <td>${hi ? 'कुल आय' : 'Gross earnings'}</td><td class="amt">${rupees(slip.gross_minor)}</td>
        <td class="sep">${hi ? 'कुल कटौती' : 'Total deductions'}</td><td class="amt">${rupees(slip.deductions_minor)}</td>
      </tr></tfoot>
    </table>

    <div class="net"><span class="lbl">${hi ? 'शुद्ध देय वेतन' : 'Net pay'}</span><span class="val">${rupees(slip.net_minor)}</span></div>
    <div class="words"><b>${hi ? 'अक्षरे' : 'In words'}:</b> ${amountInWords(Number(slip.net_minor))}</div>

    <div class="foot">
      <span>${hi ? 'यह कंप्यूटर-जनित वेतन पर्ची है; हस्ताक्षर की आवश्यकता नहीं।' : 'This is a computer-generated payslip and needs no signature.'}</span>
      <span style="white-space:nowrap">${hi ? 'निर्मित' : 'Generated'}: ${new Date().toLocaleDateString(hi ? 'hi-IN' : 'en-IN')}</span>
    </div>
  </div>
  <script>window.onload=function(){window.print()}</script>
</body></html>`);
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

  // What each type will ACTUALLY pay. The PF figure is read from the society's configured rate, never
  // hard-coded — if it is 0 the hint says so instead of promising a deduction the run will not make.
  const typeHint = (t: string) => {
    const pf = rate('pf_rate', 12);
    const pfWarn = hi
      ? '⚠ PF दर अभी 0% है — ऊपर "सांविधिक दरें" में सही दर (स्रोत सहित) भरें, वरना PF नहीं कटेगा।'
      : '⚠ The PF rate is 0% — set it (with its source) under "Statutory rates", or no PF will be deducted.';
    if (t === 'permanent' || t === 'probation') {
      const base = hi ? 'DA (मूल का 20%), HRA (40%)' : 'DA (20% of basic), HRA (40%)';
      return pf > 0
        ? (hi ? `${base}, PF (${pf}%) अपने-आप जुड़ेंगे।` : `${base}, PF (${pf}%) are added automatically.`)
        : `${hi ? `${base} अपने-आप जुड़ेंगे।` : `${base} are added automatically.`} ${pfWarn}`;
    }
    if (t === 'deputation') return hi ? 'मूल + DA + प्रतिनियुक्ति भत्ता (बाद में सेट करें)। PF नहीं।' : 'Basic + DA + Deputation allowance (set later). No PF.';
    if (t === 'seasonal' || t === 'fixedterm') {
      return pf > 0
        ? (hi ? `मूल + DA + PF (${pf}%) — HRA नहीं।` : `Basic + DA + PF (${pf}%) — no HRA.`)
        : `${hi ? 'मूल + DA + PF — HRA नहीं।' : 'Basic + DA + PF — no HRA.'} ${pfWarn}`;
    }
    if (isDailyType(t)) return hi ? 'वेतन = दैनिक दर × उपस्थिति-दिन (उपस्थिति चिप पर सेट करें)।' : 'Pay = daily rate × days worked (set attendance on the chip).';
    if (t === 'apprentice') return hi ? 'केवल छात्रवृत्ति, कोई सांविधिक कटौती नहीं।' : 'Stipend only, no statutory deductions.';
    return hi ? 'केवल एकमुश्त राशि, कोई सांविधिक कटौती नहीं (TDS बाद में)।' : 'Consolidated amount only, no statutory deductions (TDS later).';
  };

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
        <Button className="ml-auto" size="sm" variant="ghost" onClick={() => { const p = new Date().toISOString().slice(0, 7); setAttListPeriod(p); setAttListOpen(true); loadAttList(p); }}>
          <Users className="h-4 w-4 mr-1" /> {hi ? 'उपस्थिति' : 'Attendance'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setStatKey(''); setStatOpen(true); }}>
          <Settings2 className="h-4 w-4 mr-1" /> {hi ? 'सांविधिक दरें' : 'Statutory rates'}
        </Button>
        <Button size="sm" onClick={() => { setPeriod(''); setRunAtt([]); setRunOpen(true); }}>
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
                    <div>
                      <span className="font-medium">{s.label || s.key}</span> <span className="text-sm">= {Number(s.value_num)}</span>
                      {Number(s.value_num) === 0 && <span className="ml-1 text-[10px] px-1 rounded bg-destructive/10 text-destructive">{hi ? '⚠ 0 — कोई कटौती नहीं होगी' : '⚠ 0 — nothing will be deducted'}</span>}
                      <div className="text-xs text-muted-foreground">{s.source || (hi ? '⚠ स्रोत दर्ज नहीं' : '⚠ no source recorded')}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => editStat(s)}>{hi ? 'बदलें' : 'Edit'}</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setStatOpen(false)}>{hi ? 'बंद करें' : 'Close'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={attListOpen} onOpenChange={(o) => !attListBusy && setAttListOpen(o)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader><DialogTitle>{hi ? 'उपस्थिति — पूरी समिति' : 'Attendance — whole society'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">{hi ? 'अवधि (माह)' : 'Period (month)'}</Label>
              <Input type="month" value={attListPeriod} onChange={(e) => { setAttListPeriod(e.target.value); loadAttList(e.target.value); }} />
            </div>
            {attRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{hi ? 'इस अवधि के लिए कोई कर्मचारी नहीं (या अवधि चुनें)।' : 'No payable employees for this period (or pick a period).'}</p>
            ) : (
              <>
                {attRows.some((r) => r.lop_days == null) && (
                  <p className="text-xs px-2 py-1.5 rounded bg-amber-500/10 text-amber-700">
                    {hi
                      ? `⚠ ${attRows.filter((r) => r.lop_days == null).length} कर्मचारियों की उपस्थिति दर्ज़ नहीं — उन्हें बिना किसी अनुपस्थिति के, पूरी सेवा-अवधि का वेतन मिलेगा।`
                      : `⚠ ${attRows.filter((r) => r.lop_days == null).length} employee(s) have no attendance recorded — they will be paid for their whole period of service, with no absence.`}
                  </p>
                )}
                <div className="space-y-1">
                  {attRows.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 border rounded-md px-2 py-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{nameOf(r.full_name)} <span className="text-xs text-muted-foreground">{r.employee_code}</span></div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.lop_days == null
                            ? (hi ? 'दर्ज़ नहीं → 30 दिन' : 'not recorded → 30 days')
                            : (hi ? `भुगतान ${Number(r.paid_days)} दिन` : `${Number(r.paid_days)} paid days`)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Input type="number" min="0" max="31" className="h-8 w-16" placeholder="0"
                          value={attEdits[r.id] ?? ''} onChange={(e) => setAttEdits((m) => ({ ...m, [r.id]: e.target.value }))} />
                        <span className="text-[11px] text-muted-foreground">
                          {isDailyType(r.employment_type ?? '') ? (hi ? 'काम के दिन' : 'days worked') : (hi ? 'LOP दिन' : 'LOP')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">{hi ? 'खाली छोड़ा तो जैसा है वैसा ही रहेगा। LOP = बिना-वेतन दिन (0–31)।' : 'Left blank stays as it is. LOP = loss-of-pay days (0–31).'}</p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttListOpen(false)} disabled={attListBusy}>{hi ? 'बंद करें' : 'Close'}</Button>
            <Button onClick={saveAttList} disabled={attListBusy || attRows.length === 0}>
              {attListBusy ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {hi ? 'सहेज रहा है…' : 'Saving…'}</> : (hi ? 'सहेजें' : 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={runOpen} onOpenChange={(o) => !running && setRunOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{hi ? 'नया पेरोल चलाएँ' : 'Run payroll'}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pay-period">{hi ? 'अवधि (माह)' : 'Period (month)'}</Label>
            <Input id="pay-period" type="month" value={period} onChange={(e) => { setPeriod(e.target.value); loadRunAtt(e.target.value); }} />
            <p className="text-xs text-muted-foreground">{hi ? 'सर्वर इस माह के लिए सभी नियुक्त कर्मचारियों की गणना करके पेस्लिप बनाएगा।' : 'The server computes payslips for all assigned employees for this month.'}</p>
            {/* The attendance warning belongs HERE — this is where the decision is made. Someone who
                never opens the Attendance screen would otherwise pay a full month by accident. */}
            {runAtt.length > 0 && (() => {
              const missing = runAtt.filter((r) => r.lop_days == null).length;
              return (
                <div className={`text-xs px-2 py-1.5 rounded ${missing ? 'bg-amber-500/10 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                  {hi ? `${runAtt.length} कर्मचारी इसमें शामिल होंगे।` : `${runAtt.length} employee(s) will be included.`}
                  {missing > 0 && (
                    <> {hi ? `⚠ इनमें ${missing} की उपस्थिति दर्ज़ नहीं — उन्हें पूरे 30 दिन का वेतन मिलेगा।` : `⚠ ${missing} of them have no attendance recorded — they will be paid a full 30 days.`}
                      <button type="button" className="ml-1 underline font-medium"
                        onClick={() => { setRunOpen(false); setAttListPeriod(period); setAttListOpen(true); loadAttList(period); }}>
                        {hi ? 'अभी भरें' : 'Fill it now'}
                      </button>
                    </>
                  )}
                </div>
              );
            })()}
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
            <Button className="ml-auto" size="sm" variant="outline" onClick={() => { setEmpName(''); setEmpCode(''); setEmpBasic(''); setEmpType('permanent'); setEmpJoin(new Date().toISOString().slice(0,10)); setEmpOpen(true); }}>
              <UserPlus className="h-4 w-4 mr-1" /> {hi ? 'कर्मचारी जोड़ें' : 'Add employee'}
            </Button>
          </div>
          {activeEmployees.length === 0 ? (
            <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई कर्मचारी नहीं। "कर्मचारी जोड़ें" से शुरू करें, फिर पेरोल चलाएँ।' : 'No employees yet — add one, then run payroll.'}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeEmployees.map((e) => (
                <button key={e.id} type="button" className="text-sm border rounded-md px-2 py-1 hover:bg-muted text-left" title={hi ? 'उपस्थिति सेट करें' : 'Set attendance'}
                  onClick={() => { setAttEmp(e); setAttPeriod(''); setAttLop('0'); setEditBasic(e.basic_minor != null ? String(Number(e.basic_minor) / 100) : ''); setIdUan(e.uan || ''); setIdPan(e.pan || ''); setIdEsic(e.esic_ip || ''); setJoinEdit(String(e.date_of_join || '').slice(0,10)); setStructEdit(''); setHistOpen(false); loadStructure(e.id); loadHistory(e.id); loadLoans(e.id); }}>
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
              <Label>{hi ? 'नियुक्ति तिथि' : 'Date of joining'}</Label>
              <Input type="date" value={empJoin} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setEmpJoin(e.target.value)} />
            </div>
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
            <p className="text-xs text-muted-foreground">{typeHint(empType)}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmpOpen(false)} disabled={empSaving}>{hi ? 'रद्द' : 'Cancel'}</Button>
            <Button onClick={addEmployee} disabled={empSaving}>{empSaving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {hi ? 'जोड़ रहा है…' : 'Adding…'}</> : (hi ? 'जोड़ें' : 'Add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!attEmp} onOpenChange={(o) => !attSaving && !empBusy && !o && setAttEmp(null)}>
        {/* This dialog carries the structure editor, advances and history now — it needs room, and its
            rows must be free to shrink, else the content overflows sideways instead of wrapping. */}
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader><DialogTitle className="break-words">{attEmp ? nameOf(attEmp.full_name) : ''} <span className="text-xs text-muted-foreground font-normal">{attEmp?.employee_code}</span></DialogTitle></DialogHeader>
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
                      <Input type="number" className="h-8 flex-1 min-w-0" value={structVal} onChange={(e) => setStructVal(e.target.value)} autoFocus />
                      <Button size="sm" className="shrink-0" onClick={() => saveStructVal(c.code)} disabled={structBusy === c.code}>{structBusy === c.code ? <Loader2 className="h-4 w-4 animate-spin" /> : (hi ? 'सहेजें' : 'Save')}</Button>
                      <Button size="sm" variant="ghost" className="shrink-0" onClick={() => setStructEdit('')}>{hi ? 'रद्द' : 'Cancel'}</Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-medium">{nameOf(c.display_name)}</span>
                        <span className="ml-1 text-[10px] text-muted-foreground">{isDeduction(c.kind) ? (hi ? 'कटौती' : 'deduction') : c.kind === 'employer_contrib' ? (hi ? 'इनपुट' : 'input') : (hi ? 'आय' : 'earning')}</span>
                        <div className="text-xs text-muted-foreground">
                          {c.fixed_minor != null ? rupees(c.fixed_minor) : (hi ? 'सूत्र से गणना' : 'computed by formula')}
                          {c.fixed_minor != null && c.calc_method === 'formula' && (
                            <span className="ml-1 text-[10px] px-1 rounded bg-amber-500/10 text-amber-700">{hi ? 'तय किया हुआ — सूत्र निष्क्रिय' : 'pinned — formula off'}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {/* a pinned formula component can go back to being computed */}
                        {c.fixed_minor != null && c.calc_method === 'formula' && (
                          <Button size="sm" variant="ghost" className="px-2" title={hi ? 'सूत्र पर लौटाएँ' : 'Back to formula'} disabled={structBusy === c.code}
                            onClick={() => unpinComponent(c.code)}>
                            {structBusy === c.code ? <Loader2 className="h-3 w-3 animate-spin" /> : '↺'}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => { setStructEdit(c.code); setStructVal(c.fixed_minor != null ? String(Number(c.fixed_minor) / 100) : ''); }}>{hi ? 'बदलें' : 'Edit'}</Button>
                        <Button size="sm" variant="ghost" className="text-destructive px-2" disabled={structBusy === c.code}
                          onClick={() => { if (window.confirm(hi ? `${nameOf(c.display_name)} को इस कर्मचारी के ढाँचे से हटाएँ?` : `Remove ${nameOf(c.display_name)} from this employee's structure?`)) changeComponent('structure-remove', c.code); }}>
                          {structBusy === c.code ? <Loader2 className="h-3 w-3 animate-spin" /> : '✕'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div className="flex gap-1 items-center">
                <select className="h-8 flex-1 min-w-0 rounded-md border border-input bg-background px-2 text-xs" value={addCode} onChange={(e) => { setAddCode(e.target.value); setAddVal(''); }}>
                  <option value="">{hi ? '+ घटक जोड़ें…' : '+ Add component…'}</option>
                  {ADDABLE_COMPONENTS.filter((a) => !structure.some((s) => s.code === a.code)).map((a) => (
                    <option key={a.code} value={a.code}>{hi ? a.hi : a.en}</option>
                  ))}
                </select>
                {addCode && FIXED_COMPONENTS.includes(addCode) && (
                  <Input type="number" className="h-8 w-24" value={addVal} onChange={(e) => setAddVal(e.target.value)} placeholder="₹" />
                )}
                {addCode && (
                  <Button size="sm" onClick={() => changeComponent('structure-add', addCode)} disabled={structBusy === addCode}>
                    {structBusy === addCode ? <Loader2 className="h-4 w-4 animate-spin" /> : (hi ? 'जोड़ें' : 'Add')}
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">{hi ? 'कोई भी मान इस कर्मचारी के लिए तय कर सकते हैं — सूत्र वाले घटक पर भी। बदलाव इतिहास में सुरक्षित रहता है।' : 'You can pin any amount for THIS employee — even on a formula component. Every change is kept in history.'}</p>
            </div>

            <div className="border-t pt-3 space-y-2">
              <Label className="text-sm font-medium">{hi ? 'अग्रिम / ऋण' : 'Advance / loan'}</Label>
              {loans.filter((l) => l.status === 'active').map((l) => {
                const outstanding = Number(l.principal_minor) - Number(l.recovered_minor);
                return (
                  <div key={l.id} className="border rounded-md p-2 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{rupees(l.principal_minor)} {l.purpose && <span className="text-muted-foreground font-normal">· {l.purpose}</span>}</span>
                      <Button size="sm" variant="ghost" className="text-destructive h-7" disabled={loanBusy}
                        onClick={() => { if (window.confirm(hi ? 'यह अग्रिम बंद करें? वसूली रुक जाएगी।' : 'Close this advance? Recovery stops.')) closeLoan(l.id); }}>
                        {hi ? 'बंद करें' : 'Close'}
                      </Button>
                    </div>
                    <div className="text-muted-foreground">
                      {hi ? 'किस्त' : 'Instalment'} {rupees(l.installment_minor)}/{hi ? 'माह' : 'mo'} · {hi ? 'वसूल' : 'recovered'} {rupees(l.recovered_minor)} · <span className="font-medium text-foreground">{hi ? 'बकाया' : 'outstanding'} {rupees(outstanding)}</span>
                    </div>
                  </div>
                );
              })}
              {loans.some((l) => l.status === 'active') ? (
                <p className="text-[11px] text-muted-foreground">{hi ? 'वसूली हर पेरोल में कटती है, पर बकाया तभी घटता है जब run का भुगतान हो जाए।' : 'Recovery is deducted each run, but the outstanding drops only once a run is actually paid.'}</p>
              ) : (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    <Input type="number" className="h-8 flex-1 min-w-0" value={loanPrincipal} onChange={(e) => setLoanPrincipal(e.target.value)} placeholder={hi ? 'राशि ₹' : 'Amount ₹'} />
                    <Input type="number" className="h-8 flex-1 min-w-0" value={loanInstallment} onChange={(e) => setLoanInstallment(e.target.value)} placeholder={hi ? 'किस्त ₹/माह' : 'Instalment ₹/mo'} />
                  </div>
                  <div className="flex gap-1">
                    <Input className="h-8 flex-1 min-w-0" value={loanPurpose} onChange={(e) => setLoanPurpose(e.target.value)} placeholder={hi ? 'प्रयोजन (वैकल्पिक)' : 'Purpose (optional)'} />
                    <Button size="sm" className="shrink-0" onClick={addLoan} disabled={loanBusy}>{loanBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : (hi ? 'दर्ज़ करें' : 'Record')}</Button>
                  </div>
                </div>
              )}
              {loans.filter((l) => l.status !== 'active').length > 0 && (
                <p className="text-[11px] text-muted-foreground">{hi ? 'पुराने अग्रिम' : 'Past advances'}: {loans.filter((l) => l.status !== 'active').map((l) => `${rupees(l.principal_minor)} (${l.status})`).join(', ')}</p>
              )}
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
              <div className="space-y-1">
                <Label className="text-xs">
                  {isDailyType(attEmp?.employment_type ?? '')
                    ? (hi ? 'काम किए दिन' : 'Days worked')
                    : (hi ? 'बिना-वेतन दिन (LOP)' : 'Loss-of-pay days (LOP)')}
                </Label>
                <Input type="number" min="0" max="31" value={attLop} onChange={(e) => setAttLop(e.target.value)} placeholder="0" />
              </div>
              <Button size="sm" variant="outline" onClick={saveAttendance} disabled={attSaving}>{attSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (hi ? 'उपस्थिति सहेजें' : 'Save attendance')}</Button>
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-sm font-medium">{hi ? 'नियुक्ति तिथि' : 'Date of joining'}</Label>
              <div className="flex gap-2">
                <Input type="date" className="h-8 flex-1 min-w-0" max={new Date().toISOString().slice(0, 10)}
                  value={joinEdit} onChange={(e) => setJoinEdit(e.target.value)} />
                <Button size="sm" variant="outline" className="shrink-0" onClick={saveJoining} disabled={joinBusy || !joinEdit}>
                  {joinBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : (hi ? 'बदलें' : 'Update')}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">{hi ? 'यह तिथि वेतन-पर्ची और सेवा-अभिलेख पर छपती है।' : 'This date prints on the payslip and the service record.'}</p>
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={printServiceBook}>
                <Printer className="h-4 w-4 mr-1" /> {hi ? 'सेवा पुस्तिका' : 'Service record'}
              </Button>
              <Button variant="outline" onClick={() => setAttEmp(null)} disabled={attSaving || empBusy}>{hi ? 'बंद करें' : 'Close'}</Button>
            </div>
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

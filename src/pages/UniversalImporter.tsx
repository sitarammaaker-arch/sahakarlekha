import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Download, Upload, CheckCircle2, XCircle, AlertTriangle,
  FileSpreadsheet, Users, BookOpen, ArrowRight, Info, FileText
} from 'lucide-react';
import { LedgerAccount, Member, VoucherType } from '@/types';
import { mapImportedOpenings, openingWarnings, accountImportOpeningCheck, type ImportedOpeningRow, type OpeningWarnings } from '@/lib/openingBalances';
import { planJoiningReceipts, summariseJoiningPlans, type JoiningReceiptPlan } from '@/lib/members/joiningReceipts';
import { getBankAccountIds, defaultBankAccountId } from '@/lib/storage';
import {
  ACCOUNTS_TEMPLATE, MEMBERS_TEMPLATE, OPENING_BALANCES_TEMPLATE, vouchersTemplate, parseCSV,
  validateAccountRow, resolveParentGroup, validateMemberRow, validateObRow, validateVoucherRow, type RowError,
} from '@/lib/importTemplates';

// ─── Types ────────────────────────────────────────────────────────────────────

type RowStatus = 'ok' | 'error' | 'warning';

interface PreviewRow {
  rowNum: number;
  status: RowStatus;
  errors: RowError[];
  data: Record<string, string>;
}

// ─── File Parser (CSV + Excel) ────────────────────────────────────────────────

function parseFileToRows(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const buffer = ev.target?.result as ArrayBuffer;
          const wb = XLSX.read(buffer, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const raw = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' });
          resolve(raw.map(r => r.map(c => String(c ?? '').trim())));
        } catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = ev => resolve(parseCSV(ev.target?.result as string));
      reader.readAsText(file, 'UTF-8');
    }
  });
}

// ─── Template Generators ──────────────────────────────────────────────────────

function downloadTemplate(filename: string, content: string) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadExcelTemplate(filename: string, csvContent: string) {
  const rows = csvContent.split('\n').map(r => r.split(','));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, filename);
}

// ─── Main Component ───────────────────────────────────────────────────────────

const UniversalImporter: React.FC = () => {
  const { accounts, members, vouchers, addAccount, addMember, addVoucher, updateAccount, society } = useData();
  const { user } = useAuth();
  const { toast } = useToast();

  // Accounts tab state
  const [accountPreview, setAccountPreview] = useState<PreviewRow[] | null>(null);
  const [accountImporting, setAccountImporting] = useState(false);
  const accountFileRef = useRef<HTMLInputElement>(null);

  // Members tab state
  const [memberPreview, setMemberPreview] = useState<PreviewRow[] | null>(null);
  const [memberImporting, setMemberImporting] = useState(false);
  const memberFileRef = useRef<HTMLInputElement>(null);

  // Opening Balances tab state
  const [obPreview, setObPreview] = useState<PreviewRow[] | null>(null);
  const [obImporting, setObImporting] = useState(false);
  const obFileRef = useRef<HTMLInputElement>(null);

  // Vouchers tab state
  const [voucherPreview, setVoucherPreview] = useState<PreviewRow[] | null>(null);
  const [voucherImporting, setVoucherImporting] = useState(false);
  const voucherFileRef = useRef<HTMLInputElement>(null);

  // ── Parse helpers ──

  function buildPreviewFromParsed(
    rows: string[][],
    headers: string[],
    validate: (row: Record<string, string>, rowNum: number) => RowError[]
  ): PreviewRow[] {
    // Skip header row(s): first row is headers, second row is Hindi hints
    const dataRows = rows.slice(2);
    return dataRows.map((cells, i) => {
      const rowNum = i + 3;
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = (cells[idx] || '').trim(); });
      const errors = validate(row, rowNum);
      return {
        rowNum,
        status: (errors.length > 0 ? 'error' : 'ok') as RowStatus,
        errors,
        data: row,
      };
    }).filter(r => {
      // skip completely empty rows
      return Object.values(r.data).some(v => v !== '');
    });
  }

  // ── Accounts ──

  async function handleAccountFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseFileToRows(file);
      if (parsed.length < 3) {
        toast({ title: 'File खाली है', description: 'कम से कम 1 data row होनी चाहिए', variant: 'destructive' });
        return;
      }
      const headers = parsed[0].map(h => h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, ''));
      setAccountPreview(buildPreviewFromParsed(parsed, headers, (row, rowNum) => validateAccountRow(row, rowNum, accounts)));
    } catch { toast({ title: 'File parse error', description: 'Valid CSV या Excel file upload करें', variant: 'destructive' }); }
    e.target.value = '';
  }

  function handleAccountImport() {
    if (!accountPreview) return;

    // RULE 6 — `addAccount` bails silently when the FY is locked, so without this the
    // loop below would report "N imported" while nothing was written. Stop, and say so.
    if (society.fyLocked) {
      toast({
        title: 'FY Locked',
        description: 'वित्तीय वर्ष audit-locked है — accounts import नहीं हो सकते।',
        variant: 'destructive',
      });
      return;
    }

    const validRows = accountPreview.filter(r => r.status === 'ok');
    if (validRows.length === 0) {
      toast({ title: 'Import नहीं हो सकता', description: 'सभी rows में errors हैं। पहले CSV fix करें।', variant: 'destructive' });
      return;
    }
    setAccountImporting(true);
    // Count from the CLOUD result (RULE 1): the old loop said "N imported" before any save had
    // answered, so a failed write still read as success. addAccount reports onSaved / onFailed.
    const toSave = validRows.filter(row => {
      const name = row.data.account_name.trim();
      return !accounts.some(a => a.name.toLowerCase() === name.toLowerCase());
    });
    const skipped = validRows.length - toSave.length;
    // A skipped (already existing) account's opening is NOT applied — say so, with names (2026-10-11).
    const droppedOpenings = validRows
      .filter(row => !toSave.includes(row) && (parseFloat(row.data.opening_balance) || 0) > 0)
      .map(row => row.data.account_name.trim());
    const droppedNote = droppedOpenings.length > 0
      ? ` इनमें ${droppedOpenings.length} की opening नहीं लगी (खाता पहले से था): ${droppedOpenings.slice(0, 5).join(', ')}${droppedOpenings.length > 5 ? ' …' : ''} — इन्हें "Opening Balances" import या पेज से भरें।`
      : '';
    let saved = 0, failed = 0;
    const settle = () => {
      if (saved + failed < toSave.length) return;
      setAccountImporting(false);
      setAccountPreview(null);
      if (failed > 0) {
        toast({
          title: `${saved} खाते सेव हुए, ${failed} सेव नहीं हुए`,
          description: `जो सेव नहीं हुए, वे सूची में नहीं जोड़े गए — फ़ाइल दोबारा import करें (पहले से बने खाते अपने-आप skip होंगे)।${skipped > 0 ? ` ${skipped} पहले से मौजूद थे।` : ''}${droppedNote}`,
          variant: 'destructive', duration: 12000,
        });
      } else {
        toast({
          title: `${saved} खाते import हुए`,
          description: skipped > 0 ? `${skipped} खाते पहले से मौजूद थे, skip किए गए।${droppedNote}` : 'सभी खाते क्लाउड में सेव हो गए',
          ...(droppedOpenings.length > 0 ? { variant: 'destructive' as const, duration: 15000 } : {}),
        });
      }
    };
    if (toSave.length === 0) { saved = 0; settle(); return; }
    for (const row of toSave) {
      const id = addAccount({
        name: row.data.account_name.trim(),
        nameHi: row.data.account_name.trim(),
        type: row.data.account_type.toLowerCase() as LedgerAccount['type'],
        parentId: resolveParentGroup(row.data, accounts).parentId ?? undefined,
        openingBalance: parseFloat(row.data.opening_balance) || 0,
        openingBalanceType: row.data.balance_type.toLowerCase() as 'debit' | 'credit',
        isSystem: false,
      }, {
        onSaved: () => { saved++; settle(); },
        onFailed: () => { failed++; settle(); },
      });
      void id;
    }
  }

  // ── Members ──

  async function handleMemberFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseFileToRows(file);
      if (parsed.length < 3) {
        toast({ title: 'File खाली है', description: 'कम से कम 1 data row होनी चाहिए', variant: 'destructive' });
        return;
      }
      const headers = parsed[0].map(h => h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, ''));
      setMemberPreview(buildPreviewFromParsed(parsed, headers, validateMemberRow));
    } catch { toast({ title: 'File parse error', description: 'Valid CSV या Excel file upload करें', variant: 'destructive' }); }
    e.target.value = '';
  }

  function handleMemberImport() {
    if (!memberPreview) return;

    // RULE 6 — `addMember` bails silently when the FY is locked (via guardFYLocked), so
    // without this the loop would fire a toast per row AND report "N imported" while nothing
    // was written. Stop once, honestly, before the loop.
    if (society.fyLocked) {
      toast({
        title: 'FY Locked',
        description: 'वित्तीय वर्ष audit-locked है — members import नहीं हो सकते।',
        variant: 'destructive',
      });
      return;
    }

    const validRows = memberPreview.filter(r => r.status === 'ok');
    if (validRows.length === 0) {
      toast({ title: 'Import नहीं हो सकता', description: 'सभी rows में errors हैं। पहले CSV fix करें।', variant: 'destructive' });
      return;
    }
    setMemberImporting(true);
    let imported = 0;
    let skipped = 0;
    // Same rule addMember applies per member (joiningReceipts) — collected for ONE summary instead of a toast per row.
    const plans: JoiningReceiptPlan[] = [];
    const planOpts = { financialYear: society.financialYear, today: new Date().toISOString().split('T')[0], bankAccountId: defaultBankAccountId(accounts) || null };
    for (const row of validRows) {
      const mid = row.data.member_id.trim();
      const exists = members.find(m => m.memberId === mid);
      if (exists) { skipped++; continue; }
      const memberData: Omit<Member, 'id'> = {
        memberId: mid,
        name: row.data.name.trim(),
        fatherName: row.data.father_name?.trim() || '',
        address: row.data.address?.trim() || '',
        phone: row.data.phone?.trim() || '',
        shareCapital: parseFloat(row.data.share_capital) || 0,
        admissionFee: parseFloat(row.data.admission_fee) || 0,
        memberType: (row.data.member_type?.toLowerCase() === 'nominal' ? 'nominal' : 'member') as Member['memberType'],
        joinDate: row.data.join_date?.trim() || new Date().toISOString().split('T')[0],
        status: (row.data.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active') as Member['status'],
        shareCount: parseFloat(row.data.share_count) || undefined,
        shareFaceValue: parseFloat(row.data.share_face_value) || undefined,
        nomineeName: row.data.nominee_name?.trim() || undefined,
        nomineeRelation: row.data.nominee_relation?.trim() || undefined,
        nomineePhone: row.data.nominee_phone?.trim() || undefined,
        age: parseInt(row.data.age) || undefined,
        occupation: row.data.occupation?.trim() || undefined,
        caste: (['General', 'Backward Class', 'Schedule Caste', 'Schedule Tribe'].includes(row.data.caste?.trim()) ? row.data.caste.trim() : undefined) as Member['caste'],
        postOffice: row.data.post_office?.trim() || undefined,
        tehsil: row.data.tehsil?.trim() || undefined,
        district: row.data.district?.trim() || undefined,
        state: row.data.state?.trim() || undefined,
        pinCode: row.data.pin_code?.trim() || undefined,
        paymentMode: (['cash', 'cheque', 'online'].includes(row.data.payment_mode?.toLowerCase()) ? row.data.payment_mode.toLowerCase() : undefined) as Member['paymentMode'],
        nomineeFatherName: row.data.nominee_father_name?.trim() || undefined,
        nomineeAge: parseInt(row.data.nominee_age) || undefined,
        nomineeOccupation: row.data.nominee_occupation?.trim() || undefined,
        nomineeAddress: row.data.nominee_address?.trim() || undefined,
        nomineeShares: parseInt(row.data.nominee_shares) || undefined,
      };
      addMember(memberData, { quiet: true });
      plans.push(planJoiningReceipts(memberData, planOpts));
      imported++;
    }
    setMemberImporting(false);
    setMemberPreview(null);
    const sum = summariseJoiningPlans(plans);
    toast({
      title: `${imported} Members Import हुए`,
      description: skipped > 0 ? `${skipped} members पहले से exist थे (same Member ID), skip किए गए` : 'सभी members successfully import हो गए',
    });
    if (sum.historicalMembers > 0) {
      // Old members get no cash receipt — their share belongs in the opening balances (joiningReceipts).
      toast({
        title: `${sum.historicalMembers} पुराने सदस्य — नकद रसीद नहीं बनी`,
        description: `ये सदस्य इस वित्तीय वर्ष से पहले जुड़े थे। इनकी शेयर पूँजी ₹${sum.historicalShare}${sum.historicalAdmission ? ` (प्रवेश शुल्क ₹${sum.historicalAdmission})` : ''} opening balance में शामिल करें (शेयर पूँजी 1102)। (Joined before this FY — carry these amounts in the opening balances.)`,
        duration: 15000,
      });
    }
  }

  // ── Opening Balances ──

  async function handleObFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseFileToRows(file);
      if (parsed.length < 3) {
        toast({ title: 'File खाली है', description: 'कम से कम 1 data row होनी चाहिए', variant: 'destructive' });
        return;
      }
      const headers = parsed[0].map(h => h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, ''));
      setObPreview(buildPreviewFromParsed(parsed, headers, (row, rowNum) => validateObRow(row, accounts, rowNum)));
    } catch { toast({ title: 'File parse error', description: 'Valid CSV या Excel file upload करें', variant: 'destructive' }); }
    e.target.value = '';
  }

  /**
   * T-04: opening balances now persist to Supabase via `updateAccount`, exactly as the
   * Opening Balances page does. They used to be written to a `sahayata_opening_balances`
   * localStorage key that NOTHING ever read — the import reported success and the data
   * was discarded. `updateAccount` carries the RULE 1 contract (optimistic update, roll
   * back + destructive toast on cloud failure) and the RULE 6 FY-lock guard.
   */
  function handleObImport() {
    if (!obPreview) return;

    // RULE 6 — check here too. `updateAccount` bails silently when the FY is locked,
    // which would let us report "N imported" while nothing was written.
    if (society.fyLocked) {
      toast({
        title: 'FY Locked',
        description: 'वित्तीय वर्ष audit-locked है — opening balances import नहीं हो सकते।',
        variant: 'destructive',
      });
      return;
    }

    const validRows = obPreview.filter(r => r.status === 'ok');
    if (validRows.length === 0) {
      toast({ title: 'Import नहीं हो सकता', description: 'सभी rows में errors हैं।', variant: 'destructive' });
      return;
    }

    setObImporting(true);
    const { entries, unmatched } = mapImportedOpenings(
      validRows.map(r => r.data as unknown as ImportedOpeningRow),
      accounts
    );

    for (const entry of entries) {
      updateAccount(entry.accountId, { openingBalance: entry.amount, openingBalanceType: entry.type });
    }

    setObImporting(false);
    setObPreview(null);

    // Never silently drop a row (P7). Validation already blocks unknown accounts, so
    // `unmatched` here means the chart changed between preview and commit.
    if (unmatched.length > 0) {
      toast({
        title: `${unmatched.length} rows skip हुईं`,
        description: `ये accounts अब नहीं मिले: ${unmatched.slice(0, 3).join(', ')}${unmatched.length > 3 ? '…' : ''}. दोबारा preview करें।`,
        variant: 'destructive',
        duration: 12000,
      });
    }
    toast({
      title: `${entries.length} Opening Balances Set हुए`,
      description: 'Supabase में save हो रहे हैं। कोई cloud error आया तो अलग से चेतावनी दिखेगी। Opening Balances page से verify करें।',
    });
  }

  // ── Vouchers (bulk) ──

  async function handleVoucherFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseFileToRows(file);
      if (parsed.length < 3) {
        toast({ title: 'File खाली है', description: 'कम से कम 1 data row होनी चाहिए', variant: 'destructive' });
        return;
      }
      const headers = parsed[0].map(h => h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, ''));
      const fyStart = society.financialYearStart;
      const fyEnd = `20${society.financialYear.split('-')[1]}-03-31`;
      setVoucherPreview(buildPreviewFromParsed(parsed, headers, (row, rowNum) => validateVoucherRow(row, accounts, fyStart, fyEnd, rowNum)));
    } catch { toast({ title: 'File parse error', description: 'Valid CSV या Excel file upload करें', variant: 'destructive' }); }
    e.target.value = '';
  }

  function handleVoucherImport() {
    if (!voucherPreview) return;
    if (society.fyLocked) {
      toast({ title: 'FY Locked', description: 'वित्त वर्ष audit-locked है — नई entries नहीं जोड़ी जा सकतीं।', variant: 'destructive' });
      return;
    }
    const validRows = voucherPreview.filter(r => r.status === 'ok');
    if (validRows.length === 0) {
      toast({ title: 'Import नहीं हो सकता', description: 'सभी rows में errors हैं। पहले file fix करें।', variant: 'destructive' });
      return;
    }
    setVoucherImporting(true);
    // Idempotency: skip rows whose `reference` was already bulk-imported (re-uploading
    // the same file won't double-post). `seen` also dedupes repeats WITHIN this file.
    const seen = new Set(vouchers.filter(v => v.refType === 'bulk-import' && v.refId).map(v => v.refId!));
    let imported = 0, skipped = 0, failed = 0;
    for (const row of validRows) {
      const ref = (row.data.reference || '').trim();
      const hasRef = ref !== '' && !ref.startsWith('(');
      if (hasRef && seen.has(ref)) { skipped++; continue; }
      const dr = accounts.find(a => !a.isGroup && a.name.toLowerCase().trim() === row.data.debit_account.toLowerCase().trim());
      const cr = accounts.find(a => !a.isGroup && a.name.toLowerCase().trim() === row.data.credit_account.toLowerCase().trim());
      if (!dr || !cr) { failed++; continue; }
      const v = addVoucher({
        type: row.data.type.toLowerCase() as VoucherType,
        date: row.data.date.trim(),
        debitAccountId: dr.id,
        creditAccountId: cr.id,
        amount: parseFloat(row.data.amount) || 0,
        narration: (row.data.narration || '').trim(),
        createdBy: user?.name || 'Bulk Import',
        ...(hasRef ? { refType: 'bulk-import', refId: ref } : {}),
      });
      if (!v.id) { failed++; continue; } // FY-lock / imbalance guard returned a dummy
      if (hasRef) seen.add(ref);
      imported++;
    }
    setVoucherImporting(false);
    setVoucherPreview(null);
    const parts = [];
    if (skipped) parts.push(`${skipped} पहले से import थे (skip)`);
    if (failed) parts.push(`${failed} fail हुए`);
    toast({
      title: `${imported} वाउचर Import हुए`,
      description: parts.length ? parts.join(' · ') : 'सभी वाउचर successfully बन गए। Vouchers / Day Book से verify करें।',
    });
  }

  // ── Opening checks shown under a preview, BEFORE import (2026-10-11) ──
  const OpeningWarnCard: React.FC<{ w: OpeningWarnings; dropped?: string[] }> = ({ w, dropped = [] }) => {
    if (!w.wrongSide.length && !w.plHeads.length && !dropped.length) return null;
    const list = (xs: string[]) => xs.slice(0, 6).join(', ') + (xs.length > 6 ? ` … (+${xs.length - 6})` : '');
    return (
      <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs space-y-1.5">
        {w.wrongSide.length > 0 && (
          <p><b>⚠️ {w.wrongSide.length} rows की opening उलटी तरफ़ है</b> (देनदारी/पूँजी Dr में या संपत्ति Cr में, कुल ₹{w.wrongSide.reduce((t, r) => t + r.amount, 0).toLocaleString('hi-IN')}) — ज़्यादातर यह file में Dr/Cr की गलती होती है: {list(w.wrongSide.map(r => r.name))}</p>
        )}
        {w.plHeads.length > 0 && (
          <p><b>ℹ️ {w.plHeads.length} आय/व्यय खातों पर opening है</b> — यह तभी सही है जब समिति बीच साल से शुरू कर रही हो: {list(w.plHeads.map(r => r.name))}</p>
        )}
        {dropped.length > 0 && (
          <p><b>⚠️ {dropped.length} खाते पहले से मौजूद हैं — इनकी opening नहीं लगेगी</b> (खाता skip होगा): {list(dropped)}। इन्हें "Opening Balances" import से भरें।</p>
        )}
      </div>
    );
  };
  const accountOpeningCheck = accountPreview ? accountImportOpeningCheck(accountPreview.filter(r => r.status === 'ok').map(r => r.data), accounts) : null;
  const obOpeningCheck = obPreview ? (() => {
    const { entries } = mapImportedOpenings(obPreview.filter(r => r.status === 'ok').map(r => r.data as unknown as ImportedOpeningRow), accounts);
    return openingWarnings(entries, accounts);
  })() : null;

  // ── Preview Table Component ──

  const PreviewTable: React.FC<{
    preview: PreviewRow[];
    columns: string[];
    labels: Record<string, string>;
  }> = ({ preview, columns, labels }) => {
    const okCount = preview.filter(r => r.status === 'ok').length;
    const errCount = preview.filter(r => r.status === 'error').length;

    return (
      <div className="space-y-3">
        {/* Summary bar */}
        <div className="flex gap-3 flex-wrap">
          <Badge variant="outline" className="gap-1 text-green-700 border-green-300 bg-green-50">
            <CheckCircle2 className="h-3 w-3" /> {okCount} rows ready
          </Badge>
          {errCount > 0 && (
            <Badge variant="outline" className="gap-1 text-red-700 border-red-300 bg-red-50">
              <XCircle className="h-3 w-3" /> {errCount} rows में error
            </Badge>
          )}
          {errCount > 0 && (
            <p className="text-xs text-muted-foreground self-center">
              Error वाली rows skip होंगी। CSV fix करके दोबारा upload करें।
            </p>
          )}
        </div>

        {/* Errors list */}
        {errCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
            {preview.filter(r => r.status === 'error').flatMap(r => r.errors).map((err, i) => (
              <p key={i} className="text-xs text-red-700 flex gap-1">
                <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                {err.message}
              </p>
            ))}
          </div>
        )}

        {/* Data table */}
        <div className="overflow-x-auto border rounded-lg">
          <table className="text-xs w-full">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left font-medium w-8">#</th>
                <th className="p-2 text-left font-medium w-16">Status</th>
                {columns.map(c => (
                  <th key={c} className="p-2 text-left font-medium">{labels[c] || c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map(row => (
                <tr
                  key={row.rowNum}
                  className={row.status === 'error' ? 'bg-red-50' : 'bg-white hover:bg-gray-50'}
                >
                  <td className="p-2 text-muted-foreground">{row.rowNum}</td>
                  <td className="p-2">
                    {row.status === 'ok'
                      ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                      : <XCircle className="h-4 w-4 text-red-500" />}
                  </td>
                  {columns.map(c => (
                    <td key={c} className="p-2 max-w-[180px] truncate" title={row.data[c]}>
                      {row.data[c] || <span className="text-muted-foreground italic">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Step indicator ──
  const StepBadge: React.FC<{ n: number; label: string }> = ({ n, label }) => (
    <div className="flex items-center gap-2 text-sm">
      <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">{n}</span>
      <span>{label}</span>
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Upload className="h-6 w-6 text-primary" />
          Universal Importer
        </h1>
        <p className="text-muted-foreground mt-1">
          दूसरे software से data import करें — CSV या Excel (.xlsx) template, preview और Hindi error messages के साथ
        </p>
      </div>

      {/* How it works */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4 pb-3">
          <p className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-1">
            <Info className="h-4 w-4" /> कैसे काम करता है?
          </p>
          <div className="flex flex-wrap gap-4">
            <StepBadge n={1} label="Template Download करें" />
            <ArrowRight className="h-4 w-4 text-blue-400 self-center hidden sm:block" />
            <StepBadge n={2} label="Data भरें / पुराने software से export करके columns match करें" />
            <ArrowRight className="h-4 w-4 text-blue-400 self-center hidden sm:block" />
            <StepBadge n={3} label="CSV या Excel Upload करें — Preview देखें — Confirm करके Import करें" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="accounts">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="accounts" className="gap-1">
            <BookOpen className="h-4 w-4" /> Accounts
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1">
            <Users className="h-4 w-4" /> Members
          </TabsTrigger>
          <TabsTrigger value="opening" className="gap-1">
            <FileSpreadsheet className="h-4 w-4" /> Opening Bal.
          </TabsTrigger>
          <TabsTrigger value="vouchers" className="gap-1">
            <FileText className="h-4 w-4" /> Vouchers
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Accounts Master ── */}
        <TabsContent value="accounts" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Accounts Master Import</CardTitle>
              <CardDescription>
                Chart of Accounts / Ledger Heads — नए accounts bulk में add करें।
                System accounts (Cash, Bank, Share Capital आदि) पहले से exist करते हैं।
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Step 1 */}
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">1</span>
                  Template Download करें
                </p>
                <p className="text-xs text-muted-foreground ml-7">
                  नीचे दिए template में example rows और Hindi hints पहले से भरे हैं।
                  Example rows delete करके अपना data भरें।
                </p>
                <div className="ml-7 flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => downloadExcelTemplate('accounts_template.xlsx', ACCOUNTS_TEMPLATE)}
                  >
                    <Download className="h-4 w-4" />
                    Excel (.xlsx) Download करें
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-muted-foreground"
                    onClick={() => downloadTemplate('accounts_template.csv', ACCOUNTS_TEMPLATE)}
                  >
                    <Download className="h-4 w-4" />
                    CSV Download करें
                  </Button>
                </div>
              </div>

              {/* Template format info */}
              <div className="ml-7 bg-muted rounded-lg p-3 text-xs space-y-1">
                <p className="font-medium mb-1">Template Columns:</p>
                <p><span className="font-medium text-primary">account_name</span> — Account का नाम (जैसे: Cash in Hand, Bank - SBI)</p>
                <p><span className="font-medium text-primary">account_type</span> — <span className="text-green-700">Asset</span> / <span className="text-orange-600">Liability</span> / <span className="text-purple-600">Equity</span> / <span className="text-blue-600">Income</span> / <span className="text-red-600">Expense</span></p>
                <p><span className="font-medium text-primary">opening_balance</span> — शुरुआती राशि (सिर्फ numbers, जैसे: 50000)</p>
                <p><span className="font-medium text-primary">balance_type</span> — <span className="text-green-700">Debit</span> (Asset/Expense) / <span className="text-orange-600">Credit</span> (Liability/Income)</p>
                <p><span className="font-medium text-primary">parent_group</span> — (वैकल्पिक) किस समूह के नीचे खाता जाए — समूह का नाम या कोड (जैसे: Bank Accounts, Loans, Admin Expenses)। खाली छोड़ें तो प्रकार का सामान्य समूह लगेगा। समूह खाते के प्रकार का ही होना चाहिए।</p>
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">2</span>
                  CSV Upload करें
                </p>
                <div className="ml-7">
                  <input
                    ref={accountFileRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleAccountFile}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => accountFileRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    CSV / Excel File चुनें
                  </Button>
                </div>
              </div>

              {/* Step 3: Preview */}
              {accountPreview && (
                <div className="space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">3</span>
                    Preview — confirm करके Import करें
                  </p>
                  <div className="ml-7 space-y-3">
                    <PreviewTable
                      preview={accountPreview}
                      columns={['account_name', 'account_type', 'opening_balance', 'balance_type', 'parent_group']}
                      labels={{
                        account_name: 'Account Name',
                        account_type: 'Type',
                        opening_balance: 'Opening Bal.',
                        balance_type: 'Dr/Cr',
                        parent_group: 'समूह (Group)',
                      }}
                    />
                    {accountOpeningCheck && <OpeningWarnCard w={accountOpeningCheck.warnings} dropped={accountOpeningCheck.dropped} />}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="gap-2"
                        disabled={accountImporting || accountPreview.filter(r => r.status === 'ok').length === 0}
                        onClick={handleAccountImport}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {accountPreview.filter(r => r.status === 'ok').length} Accounts Import करें
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAccountPreview(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Members Master ── */}
        <TabsContent value="members" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Members Master Import</CardTitle>
              <CardDescription>
                सदस्यों का data bulk में add करें। Same Member ID वाले records skip होंगे।
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Step 1 */}
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">1</span>
                  Template Download करें
                </p>
                <div className="ml-7 flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => downloadExcelTemplate('members_template.xlsx', MEMBERS_TEMPLATE)}
                  >
                    <Download className="h-4 w-4" />
                    Excel (.xlsx) Download करें
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-muted-foreground"
                    onClick={() => downloadTemplate('members_template.csv', MEMBERS_TEMPLATE)}
                  >
                    <Download className="h-4 w-4" />
                    CSV Download करें
                  </Button>
                </div>
              </div>

              {/* Template format info */}
              <div className="ml-7 bg-muted rounded-lg p-3 text-xs space-y-1">
                <p className="font-medium mb-1">Required Columns:</p>
                <p><span className="font-medium text-primary">member_id</span> — Unique सदस्य क्रमांक (जैसे: M001, M002)</p>
                <p><span className="font-medium text-primary">name</span> — सदस्य का पूरा नाम</p>
                <p><span className="font-medium text-primary">father_name</span> — पिता/पति का नाम</p>
                <p><span className="font-medium text-primary">member_type</span> — <span className="text-green-700">member</span> / <span className="text-orange-600">nominal</span></p>
                <p><span className="font-medium text-primary">join_date</span> — Format: YYYY-MM-DD (जैसे: 2022-04-01)</p>
                <p><span className="font-medium text-primary">status</span> — <span className="text-green-700">active</span> / <span className="text-orange-600">inactive</span></p>
                <p><span className="font-medium text-primary">share_capital</span> — शेयर पूंजी (numbers only)</p>
                <p className="text-muted-foreground mt-1">Optional — Personal: age, occupation, caste (General/Backward Class/Schedule Caste/Schedule Tribe)</p>
                <p className="text-muted-foreground">Optional — Address: address, post_office, tehsil, district, state, pin_code, phone</p>
                <p className="text-muted-foreground">Optional — Finance: admission_fee, payment_mode (cash/cheque/online), share_count, share_face_value</p>
                <p className="text-muted-foreground">Optional — Nominee: nominee_name, nominee_father_name, nominee_relation, nominee_age, nominee_occupation, nominee_address, nominee_shares, nominee_phone</p>
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">2</span>
                  CSV Upload करें
                </p>
                <div className="ml-7">
                  <input
                    ref={memberFileRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleMemberFile}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => memberFileRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    CSV / Excel File चुनें
                  </Button>
                </div>
              </div>

              {/* Step 3: Preview */}
              {memberPreview && (
                <div className="space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">3</span>
                    Preview — confirm करके Import करें
                  </p>
                  <div className="ml-7 space-y-3">
                    <PreviewTable
                      preview={memberPreview}
                      columns={['member_id', 'name', 'father_name', 'age', 'caste', 'district', 'member_type', 'share_capital']}
                      labels={{
                        member_id: 'Member ID',
                        name: 'नाम',
                        father_name: 'पिता का नाम',
                        age: 'आयु',
                        caste: 'वर्ग',
                        district: 'जिला',
                        member_type: 'Type',
                        share_capital: 'Share Capital',
                      }}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="gap-2"
                        disabled={memberImporting || memberPreview.filter(r => r.status === 'ok').length === 0}
                        onClick={handleMemberImport}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {memberPreview.filter(r => r.status === 'ok').length} Members Import करें
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMemberPreview(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Opening Balances ── */}
        <TabsContent value="opening" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Opening Balances Import</CardTitle>
              <CardDescription>
                पिछले साल का closing balance / शुरुआती शेष set करें।
                Account का नाम बिल्कुल वैसा होना चाहिए जैसा system में Ledger Heads में है।
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Warning */}
              <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 space-y-1">
                  <p className="font-medium">Important:</p>
                  <p>Opening Balance import करने से पहले सुनिश्चित करें कि सभी accounts <strong>Ledger Heads</strong> में बन चुके हैं।</p>
                  <p>अगर account_name exactly match नहीं करेगा तो row skip होगी।</p>
                  <p>Same account की existing opening balance overwrite होगी।</p>
                </div>
              </div>

              {/* Step 1 */}
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">1</span>
                  Template Download करें
                </p>
                <div className="ml-7 flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => downloadExcelTemplate('opening_balances_template.xlsx', OPENING_BALANCES_TEMPLATE)}
                  >
                    <Download className="h-4 w-4" />
                    Excel (.xlsx) Download करें
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-muted-foreground"
                    onClick={() => downloadTemplate('opening_balances_template.csv', OPENING_BALANCES_TEMPLATE)}
                  >
                    <Download className="h-4 w-4" />
                    CSV Download करें
                  </Button>
                </div>
              </div>

              {/* Template format info */}
              <div className="ml-7 bg-muted rounded-lg p-3 text-xs space-y-1">
                <p className="font-medium mb-1">Template Columns:</p>
                <p><span className="font-medium text-primary">account_name</span> — System में exact नाम (जैसे: Cash in Hand, Share Capital)</p>
                <p><span className="font-medium text-primary">opening_balance</span> — राशि (numbers only, जैसे: 50000)</p>
                <p><span className="font-medium text-primary">balance_type</span> — <span className="text-green-700">Debit</span> / <span className="text-orange-600">Credit</span></p>
                <p className="text-muted-foreground mt-1">Tip: Ledger Heads page से account names copy करें ताकि exact match हो।</p>
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">2</span>
                  CSV Upload करें
                </p>
                <div className="ml-7">
                  <input
                    ref={obFileRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleObFile}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => obFileRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    CSV / Excel File चुनें
                  </Button>
                </div>
              </div>

              {/* Step 3: Preview */}
              {obPreview && (
                <div className="space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">3</span>
                    Preview — confirm करके Import करें
                  </p>
                  <div className="ml-7 space-y-3">
                    <PreviewTable
                      preview={obPreview}
                      columns={['account_name', 'opening_balance', 'balance_type']}
                      labels={{
                        account_name: 'Account Name',
                        opening_balance: 'Opening Balance',
                        balance_type: 'Dr/Cr',
                      }}
                    />
                    {obOpeningCheck && <OpeningWarnCard w={obOpeningCheck} />}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="gap-2"
                        disabled={obImporting || obPreview.filter(r => r.status === 'ok').length === 0}
                        onClick={handleObImport}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {obPreview.filter(r => r.status === 'ok').length} Opening Balances Set करें
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setObPreview(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 4: Vouchers (bulk transactions) ── */}
        <TabsContent value="vouchers" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Bulk Voucher Import</CardTitle>
              <CardDescription>
                एक ही तरह के बहुत सारे वाउचर एक साथ डालें — जैसे MSP खरीद के हज़ारों वाउचर।
                हर पंक्ति = एक वाउचर (एक Debit, एक Credit). Accounts पहले से बने होने चाहिए।
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Step 1 */}
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">1</span>
                  Template Download करें
                </p>
                <div className="ml-7 flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" className="gap-2"
                    onClick={() => downloadExcelTemplate('vouchers_template.xlsx', vouchersTemplate(society.financialYearStart))}>
                    <Download className="h-4 w-4" /> Excel (.xlsx) Download करें
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 text-muted-foreground"
                    onClick={() => downloadTemplate('vouchers_template.csv', vouchersTemplate(society.financialYearStart))}>
                    <Download className="h-4 w-4" /> CSV Download करें
                  </Button>
                </div>
              </div>

              {/* Template format info */}
              <div className="ml-7 bg-muted rounded-lg p-3 text-xs space-y-1">
                <p className="font-medium mb-1">Template Columns:</p>
                <p><span className="font-medium text-primary">date</span> — YYYY-MM-DD (चालू वित्त वर्ष के भीतर)</p>
                <p><span className="font-medium text-primary">type</span> — receipt / payment / journal / contra / sale / purchase</p>
                <p><span className="font-medium text-primary">debit_account</span> · <span className="font-medium text-primary">credit_account</span> — System में मौजूद <strong>exact</strong> नाम (Ledger Heads से लें)</p>
                <p><span className="font-medium text-primary">amount</span> — राशि (numbers only); हर वाउचर अपने-आप balanced (Dr = Cr)</p>
                <p><span className="font-medium text-primary">narration</span> — विवरण (जैसे किसान का नाम) · <span className="font-medium text-primary">reference</span> — बाहरी ref (गेट-पास नं)</p>
                <p className="text-orange-700 mt-1">⚠️ same <strong>reference</strong> दोबारा upload करने पर वह वाउचर skip होगा (duplicate नहीं बनेगा)।</p>
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">2</span>
                  CSV / Excel Upload करें
                </p>
                <div className="ml-7">
                  <input ref={voucherFileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleVoucherFile} />
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => voucherFileRef.current?.click()}>
                    <Upload className="h-4 w-4" /> CSV / Excel File चुनें
                  </Button>
                </div>
              </div>

              {/* Step 3: Preview */}
              {voucherPreview && (
                <div className="space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">3</span>
                    Preview — confirm करके Import करें
                  </p>
                  <div className="ml-7 space-y-3">
                    <PreviewTable
                      preview={voucherPreview}
                      columns={['date', 'type', 'debit_account', 'credit_account', 'amount', 'narration', 'reference']}
                      labels={{
                        date: 'Date', type: 'Type', debit_account: 'Debit', credit_account: 'Credit',
                        amount: 'Amount', narration: 'Narration', reference: 'Ref',
                      }}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-2"
                        disabled={voucherImporting || voucherPreview.filter(r => r.status === 'ok').length === 0}
                        onClick={handleVoucherImport}>
                        <CheckCircle2 className="h-4 w-4" />
                        {voucherImporting ? 'Import हो रहा है…' : `${voucherPreview.filter(r => r.status === 'ok').length} वाउचर Import करें`}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setVoucherPreview(null)}>Cancel</Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UniversalImporter;

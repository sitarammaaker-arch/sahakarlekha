import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Download, Upload, CheckCircle2, XCircle, AlertTriangle,
  FileSpreadsheet, Users, BookOpen, ArrowRight, Info
} from 'lucide-react';
import { LedgerAccount, Member } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RowError {
  row: number;
  field: string;
  message: string;
}

type RowStatus = 'ok' | 'error' | 'warning';

interface PreviewRow {
  rowNum: number;
  status: RowStatus;
  errors: RowError[];
  data: Record<string, string>;
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines
    .filter(l => l.trim() !== '')
    .map(line => {
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      cells.push(current.trim());
      return cells;
    });
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

const ACCOUNTS_TEMPLATE = `account_name,account_type,opening_balance,balance_type
(यहाँ Account का नाम लिखें),(Asset/Liability/Income/Expense),(शुरुआती राशि रुपये में),(Debit/Credit)
Cash in Hand,Asset,50000,Debit
Bank - SBI,Asset,120000,Debit
Share Capital,Liability,500000,Credit
Loan from Bank,Liability,200000,Credit
Admission Fee Income,Income,0,Credit
Salary Expense,Expense,0,Debit`;

const MEMBERS_TEMPLATE = `member_id,name,father_name,address,phone,share_capital,admission_fee,member_type,join_date,status,share_count,share_face_value,nominee_name,nominee_relation,nominee_phone
(सदस्य क्रमांक),(पूरा नाम),(पिता/पति का नाम),(पता),(मोबाइल नं),(शेयर पूंजी रुपये),(प्रवेश शुल्क),(member/nominal),(YYYY-MM-DD),(active/inactive),(शेयर संख्या),(प्रति शेयर मूल्य),(नामिनी का नाम),(संबंध),(नामिनी मोबाइल)
M001,राम कुमार शर्मा,श्री हरि शर्मा,ग्राम - रामपुर जिला - लखनऊ,9876543210,5000,100,member,2020-04-01,active,10,500,सीता देवी,पत्नी,9876543211
M002,सुरेश यादव,श्री महेश यादव,ग्राम - शिवपुर,9988776655,2500,100,member,2021-06-15,active,5,500,,,`;

const OPENING_BALANCES_TEMPLATE = `account_name,opening_balance,balance_type
(Account का नाम — बिल्कुल वैसा जैसा system में है),(राशि रुपये में),(Debit/Credit)
Cash in Hand,45000,Debit
Bank - SBI,115000,Debit
Share Capital,500000,Credit
Reserve Fund,80000,Credit`;

// ─── Validators ───────────────────────────────────────────────────────────────

const VALID_ACCOUNT_TYPES = ['asset', 'liability', 'income', 'expense', 'equity'];
const VALID_BALANCE_TYPES = ['debit', 'credit'];
const VALID_MEMBER_TYPES = ['member', 'nominal'];
const VALID_STATUS = ['active', 'inactive'];

function validateAccountRow(row: Record<string, string>, rowNum: number): RowError[] {
  const errors: RowError[] = [];
  if (!row.account_name || row.account_name.startsWith('('))
    errors.push({ row: rowNum, field: 'account_name', message: `Row ${rowNum}: account_name खाली है या example row है` });
  if (!VALID_ACCOUNT_TYPES.includes((row.account_type || '').toLowerCase()))
    errors.push({ row: rowNum, field: 'account_type', message: `Row ${rowNum}: account_type "${row.account_type}" गलत है — Asset, Liability, Income, Expense में से एक होना चाहिए` });
  const bal = parseFloat(row.opening_balance);
  if (isNaN(bal) || bal < 0)
    errors.push({ row: rowNum, field: 'opening_balance', message: `Row ${rowNum}: opening_balance "${row.opening_balance}" एक valid number होना चाहिए` });
  if (!VALID_BALANCE_TYPES.includes((row.balance_type || '').toLowerCase()))
    errors.push({ row: rowNum, field: 'balance_type', message: `Row ${rowNum}: balance_type "${row.balance_type}" गलत है — Debit या Credit होना चाहिए` });
  return errors;
}

function validateMemberRow(row: Record<string, string>, rowNum: number): RowError[] {
  const errors: RowError[] = [];
  if (!row.member_id || row.member_id.startsWith('('))
    errors.push({ row: rowNum, field: 'member_id', message: `Row ${rowNum}: member_id खाली है या example row है` });
  if (!row.name || row.name.startsWith('('))
    errors.push({ row: rowNum, field: 'name', message: `Row ${rowNum}: name (सदस्य का नाम) खाली है` });
  if (!row.father_name || row.father_name.startsWith('('))
    errors.push({ row: rowNum, field: 'father_name', message: `Row ${rowNum}: father_name खाली है` });
  if (!VALID_MEMBER_TYPES.includes((row.member_type || '').toLowerCase()))
    errors.push({ row: rowNum, field: 'member_type', message: `Row ${rowNum}: member_type "${row.member_type}" गलत है — member या nominal होना चाहिए` });
  if (!row.join_date || !/^\d{4}-\d{2}-\d{2}$/.test(row.join_date))
    errors.push({ row: rowNum, field: 'join_date', message: `Row ${rowNum}: join_date "${row.join_date}" format YYYY-MM-DD होना चाहिए (जैसे 2022-04-01)` });
  if (!VALID_STATUS.includes((row.status || '').toLowerCase()))
    errors.push({ row: rowNum, field: 'status', message: `Row ${rowNum}: status "${row.status}" गलत है — active या inactive होना चाहिए` });
  const sc = parseFloat(row.share_capital);
  if (isNaN(sc) || sc < 0)
    errors.push({ row: rowNum, field: 'share_capital', message: `Row ${rowNum}: share_capital "${row.share_capital}" एक valid number होना चाहिए` });
  return errors;
}

function validateObRow(row: Record<string, string>, accounts: LedgerAccount[], rowNum: number): RowError[] {
  const errors: RowError[] = [];
  if (!row.account_name || row.account_name.startsWith('('))
    errors.push({ row: rowNum, field: 'account_name', message: `Row ${rowNum}: account_name खाली है या example row है` });
  else {
    const found = accounts.find(a => a.name.toLowerCase().trim() === row.account_name.toLowerCase().trim());
    if (!found)
      errors.push({ row: rowNum, field: 'account_name', message: `Row ${rowNum}: account "${row.account_name}" system में नहीं मिला — पहले Ledger Heads में account बनाएं या नाम check करें` });
  }
  const bal = parseFloat(row.opening_balance);
  if (isNaN(bal) || bal < 0)
    errors.push({ row: rowNum, field: 'opening_balance', message: `Row ${rowNum}: opening_balance "${row.opening_balance}" एक valid number होना चाहिए` });
  if (!VALID_BALANCE_TYPES.includes((row.balance_type || '').toLowerCase()))
    errors.push({ row: rowNum, field: 'balance_type', message: `Row ${rowNum}: balance_type "${row.balance_type}" गलत है — Debit या Credit होना चाहिए` });
  return errors;
}

// ─── Main Component ───────────────────────────────────────────────────────────

const UniversalImporter: React.FC = () => {
  const { accounts, members, addAccount, addMember } = useData();
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
        status: errors.length > 0 ? 'error' : 'ok',
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
      setAccountPreview(buildPreviewFromParsed(parsed, headers, validateAccountRow));
    } catch { toast({ title: 'File parse error', description: 'Valid CSV या Excel file upload करें', variant: 'destructive' }); }
    e.target.value = '';
  }

  function handleAccountImport() {
    if (!accountPreview) return;
    const validRows = accountPreview.filter(r => r.status === 'ok');
    if (validRows.length === 0) {
      toast({ title: 'Import नहीं हो सकता', description: 'सभी rows में errors हैं। पहले CSV fix करें।', variant: 'destructive' });
      return;
    }
    setAccountImporting(true);
    let imported = 0;
    let skipped = 0;
    for (const row of validRows) {
      const name = row.data.account_name.trim();
      const exists = accounts.find(a => a.name.toLowerCase() === name.toLowerCase());
      if (exists) { skipped++; continue; }
      addAccount({
        name,
        nameHi: name,
        type: row.data.account_type.toLowerCase() as LedgerAccount['type'],
        openingBalance: parseFloat(row.data.opening_balance) || 0,
        openingBalanceType: row.data.balance_type.toLowerCase() as 'debit' | 'credit',
        isSystem: false,
      });
      imported++;
    }
    setAccountImporting(false);
    setAccountPreview(null);
    toast({
      title: `${imported} Accounts Import हुए`,
      description: skipped > 0 ? `${skipped} accounts पहले से exist थे, skip किए गए` : 'सभी accounts successfully import हो गए',
    });
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
    const validRows = memberPreview.filter(r => r.status === 'ok');
    if (validRows.length === 0) {
      toast({ title: 'Import नहीं हो सकता', description: 'सभी rows में errors हैं। पहले CSV fix करें।', variant: 'destructive' });
      return;
    }
    setMemberImporting(true);
    let imported = 0;
    let skipped = 0;
    for (const row of validRows) {
      const mid = row.data.member_id.trim();
      const exists = members.find(m => m.memberId === mid);
      if (exists) { skipped++; continue; }
      addMember({
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
      });
      imported++;
    }
    setMemberImporting(false);
    setMemberPreview(null);
    toast({
      title: `${imported} Members Import हुए`,
      description: skipped > 0 ? `${skipped} members पहले से exist थे (same Member ID), skip किए गए` : 'सभी members successfully import हो गए',
    });
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

  function handleObImport() {
    if (!obPreview) return;
    const validRows = obPreview.filter(r => r.status === 'ok');
    if (validRows.length === 0) {
      toast({ title: 'Import नहीं हो सकता', description: 'सभी rows में errors हैं।', variant: 'destructive' });
      return;
    }
    setObImporting(true);
    const OB_KEY = 'sahayata_opening_balances';
    const existing: Record<string, { accountId: string; amount: number; type: 'debit' | 'credit' }> =
      JSON.parse(localStorage.getItem(OB_KEY) || '{}');

    let imported = 0;
    for (const row of validRows) {
      const acct = accounts.find(a => a.name.toLowerCase().trim() === row.data.account_name.toLowerCase().trim());
      if (!acct) continue;
      existing[acct.id] = {
        accountId: acct.id,
        amount: parseFloat(row.data.opening_balance) || 0,
        type: row.data.balance_type.toLowerCase() as 'debit' | 'credit',
      };
      imported++;
    }
    localStorage.setItem(OB_KEY, JSON.stringify(existing));
    setObImporting(false);
    setObPreview(null);
    toast({
      title: `${imported} Opening Balances Set हुए`,
      description: 'Opening Balances successfully save हो गए। Opening Balances page से verify करें।',
    });
  }

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
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="accounts" className="gap-1">
            <BookOpen className="h-4 w-4" /> Accounts
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1">
            <Users className="h-4 w-4" /> Members
          </TabsTrigger>
          <TabsTrigger value="opening" className="gap-1">
            <FileSpreadsheet className="h-4 w-4" /> Opening Bal.
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
                <p><span className="font-medium text-primary">account_type</span> — <span className="text-green-700">Asset</span> / <span className="text-orange-600">Liability</span> / <span className="text-blue-600">Income</span> / <span className="text-red-600">Expense</span></p>
                <p><span className="font-medium text-primary">opening_balance</span> — शुरुआती राशि (सिर्फ numbers, जैसे: 50000)</p>
                <p><span className="font-medium text-primary">balance_type</span> — <span className="text-green-700">Debit</span> (Asset/Expense) / <span className="text-orange-600">Credit</span> (Liability/Income)</p>
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
                      columns={['account_name', 'account_type', 'opening_balance', 'balance_type']}
                      labels={{
                        account_name: 'Account Name',
                        account_type: 'Type',
                        opening_balance: 'Opening Bal.',
                        balance_type: 'Dr/Cr',
                      }}
                    />
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
                <p className="text-muted-foreground">Optional: address, phone, admission_fee, share_count, share_face_value, nominee fields</p>
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
                      columns={['member_id', 'name', 'father_name', 'member_type', 'join_date', 'status', 'share_capital']}
                      labels={{
                        member_id: 'Member ID',
                        name: 'नाम',
                        father_name: 'पिता का नाम',
                        member_type: 'Type',
                        join_date: 'Join Date',
                        status: 'Status',
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
      </Tabs>
    </div>
  );
};

export default UniversalImporter;

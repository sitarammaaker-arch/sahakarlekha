/**
 * Multi-Society Consolidation
 *
 * Import up to 6 branch backup JSON files and view a consolidated
 * financial summary across all branches.
 */
import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Upload, Download, X, Building2, AlertTriangle, FileJson, RefreshCw, FileSpreadsheet, Wifi, WifiOff } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPageNumbers } from '@/lib/pdf';
import { downloadCSV, downloadExcel } from '@/lib/exportUtils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface BackupFile {
  version: string;
  createdAt: string;
  societyName: string;
  financialYear: string;
  data: Record<string, unknown>;
  stats: Record<string, number>;
}

interface Account {
  id: string;
  name: string;
  code?: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  openingBalance: number;
  openingBalanceType: 'debit' | 'credit';
}

interface VoucherLine { accountId: string; type: 'Dr' | 'Cr'; amount: number; }

interface Voucher {
  id: string;
  date: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
  isDeleted?: boolean;
  lines?: VoucherLine[];
}

// Supports multi-line Expert Mode vouchers from backup files
function getLines(v: Voucher): VoucherLine[] {
  if (v.lines && Array.isArray(v.lines) && v.lines.length > 0) return v.lines;
  const result: VoucherLine[] = [];
  if (v.debitAccountId) result.push({ accountId: v.debitAccountId, type: 'Dr', amount: v.amount });
  if (v.creditAccountId) result.push({ accountId: v.creditAccountId, type: 'Cr', amount: v.amount });
  return result;
}

interface Member {
  id: string;
  name: string;
  isActive?: boolean;
  shareCapital?: number;
}

interface Loan {
  id: string;
  memberId: string;
  principalAmount: number;
  outstandingAmount: number;
}

interface BranchData {
  fileName: string;
  societyName: string;
  financialYear: string;
  createdAt: string;
  // Computed financial totals
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalIncome: number;
  totalExpenditure: number;
  netSurplus: number;
  // Members & loans
  activeMembers: number;
  totalShareCapital: number;
  loansOutstanding: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(Math.round(n));

const fmtN = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(Math.round(n));

function parseAsArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  return [];
}

/**
 * Compute signed closing balance for an account.
 * Convention: debit-nature accounts have positive balance when they have a debit balance.
 * sign = +1 for debit-type accounts (asset, expense), -1 for credit-type (liability, equity, income)
 */
function computeClosingBalance(account: Account, vouchers: Voucher[]): number {
  // Opening: debit side → positive, credit side → negative (for debit-convention)
  let bal =
    account.openingBalanceType === 'debit'
      ? account.openingBalance
      : -account.openingBalance;

  for (const v of vouchers) {
    if (v.isDeleted) continue;
    getLines(v).forEach(l => {
      if (l.accountId !== account.id) return;
      if (l.type === 'Dr') bal += l.amount;
      else bal -= l.amount;
    });
  }

  return bal;
}

function processBranchBackup(fileName: string, backup: BackupFile): BranchData {
  const accounts = parseAsArray<Account>(backup.data['sahayata_accounts']);
  const vouchers = parseAsArray<Voucher>(backup.data['sahayata_vouchers']);
  const members  = parseAsArray<Member>(backup.data['sahayata_members']);
  const loans    = parseAsArray<Loan>(backup.data['sahayata_loans']);

  // Compute per-account closing balances grouped by type
  let totalAssets      = 0;
  let totalLiabilities = 0;
  let totalEquity      = 0;
  let totalIncome      = 0;
  let totalExpenditure = 0;

  for (const account of accounts) {
    const bal = computeClosingBalance(account, vouchers);
    switch (account.type) {
      case 'asset':
        // Asset accounts: positive bal = debit balance (normal), add to assets
        totalAssets += bal;
        break;
      case 'liability':
        // Liability accounts: negative bal means credit balance (normal)
        totalLiabilities += -bal;
        break;
      case 'equity':
        totalEquity += -bal;
        break;
      case 'income':
        totalIncome += -bal;
        break;
      case 'expense':
        totalExpenditure += bal;
        break;
    }
  }

  // Net surplus = Income − Expenditure
  const netSurplus = totalIncome - totalExpenditure;

  // Members
  const activeMembers = members.filter(m => m.isActive !== false).length;
  const totalShareCapital = members.reduce((s, m) => s + (m.shareCapital ?? 0), 0);

  // Loans
  const loansOutstanding = loans.reduce((s, l) => s + (l.outstandingAmount ?? 0), 0);

  return {
    fileName,
    societyName: backup.societyName || 'Unknown',
    financialYear: backup.financialYear || '—',
    createdAt: backup.createdAt,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalIncome,
    totalExpenditure,
    netSurplus,
    activeMembers,
    totalShareCapital,
    loansOutstanding,
  };
}

// ── CSV / Excel Export ──────────────────────────────────────────────────────────

function buildExportData(branches: BranchData[]) {
  const fmtNum = (n: number) => Math.round(n);
  const totalOf = (key: keyof BranchData) =>
    branches.reduce((s, b) => s + (b[key] as number), 0);

  const finHeaders = ['Particulars', ...branches.map(b => b.societyName), 'Consolidated Total'];
  const finRows: (string | number)[][] = [
    ['Total Assets',      ...branches.map(b => fmtNum(b.totalAssets)),      fmtNum(totalOf('totalAssets'))],
    ['Total Liabilities', ...branches.map(b => fmtNum(b.totalLiabilities)), fmtNum(totalOf('totalLiabilities'))],
    ['Capital & Equity',  ...branches.map(b => fmtNum(b.totalEquity)),      fmtNum(totalOf('totalEquity'))],
    ['Total Income',      ...branches.map(b => fmtNum(b.totalIncome)),       fmtNum(totalOf('totalIncome'))],
    ['Total Expenditure', ...branches.map(b => fmtNum(b.totalExpenditure)),  fmtNum(totalOf('totalExpenditure'))],
    ['Net Surplus',       ...branches.map(b => fmtNum(b.netSurplus)),        fmtNum(totalOf('netSurplus'))],
  ];

  const mlHeaders = ['Branch', 'Financial Year', 'Active Members', 'Total Share Capital', 'Loans Outstanding'];
  const mlRows: (string | number)[][] = [
    ...branches.map(b => [b.societyName, b.financialYear, b.activeMembers, fmtNum(b.totalShareCapital), fmtNum(b.loansOutstanding)]),
    ['TOTAL', '—', branches.reduce((s, b) => s + b.activeMembers, 0), fmtNum(totalOf('totalShareCapital')), fmtNum(totalOf('loansOutstanding'))],
  ];

  return { finHeaders, finRows, mlHeaders, mlRows };
}

// ── PDF Export ─────────────────────────────────────────────────────────────────

function exportConsolidatedPDF(branches: BranchData[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Consolidated Financial Statement', pageW / 2, 18, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const societyLine = branches.map(b => b.societyName).join(' | ');
  doc.text(societyLine, pageW / 2, 25, { align: 'center' });

  const fyLine = `Financial Year: ${[...new Set(branches.map(b => b.financialYear))].join(', ')}`;
  doc.text(fyLine, pageW / 2, 31, { align: 'center' });

  const printedOn = `Printed on: ${new Date().toLocaleDateString('en-IN')}`;
  doc.text(printedOn, pageW / 2, 37, { align: 'center' });

  // ── Financial Summary Table ────────────────────────────────────────────────
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Financial Summary', 14, 46);

  const colHead = ['Particulars', ...branches.map(b => b.societyName), 'Consolidated Total'];

  const totalOf = (key: keyof BranchData) =>
    branches.reduce((s, b) => s + (b[key] as number), 0);

  const financialRows: (string | number)[][] = [
    ['Total Assets',      ...branches.map(b => b.totalAssets),      totalOf('totalAssets')],
    ['Total Liabilities', ...branches.map(b => b.totalLiabilities), totalOf('totalLiabilities')],
    ['Capital & Equity',  ...branches.map(b => b.totalEquity),      totalOf('totalEquity')],
    ['Total Income',      ...branches.map(b => b.totalIncome),       totalOf('totalIncome')],
    ['Total Expenditure', ...branches.map(b => b.totalExpenditure),  totalOf('totalExpenditure')],
    ['Net Surplus',       ...branches.map(b => b.netSurplus),        totalOf('netSurplus')],
  ];

  const fmtCell = (v: string | number) =>
    typeof v === 'number'
      ? new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(Math.round(v))
      : v;

  autoTable(doc, {
    startY: 50,
    head: [colHead],
    body: financialRows.map(row => row.map(fmtCell)),
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold' },
      [colHead.length - 1]: { fontStyle: 'bold', fillColor: [239, 246, 255] },
    },
  });

  // ── Members & Loans Table ──────────────────────────────────────────────────
  const afterY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Members & Loans Summary', 14, afterY);

  autoTable(doc, {
    startY: afterY + 4,
    head: [['Branch', 'Financial Year', 'Active Members', 'Total Share Capital (Rs)', 'Loans Outstanding (Rs)']],
    body: [
      ...branches.map(b => [
        b.societyName,
        b.financialYear,
        b.activeMembers,
        fmtCell(b.totalShareCapital),
        fmtCell(b.loansOutstanding),
      ]),
      [
        'TOTAL', '—',
        branches.reduce((s, b) => s + b.activeMembers, 0),
        fmtCell(totalOf('totalShareCapital')),
        fmtCell(totalOf('loansOutstanding')),
      ],
    ],
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
    foot: [],
  });

  addPageNumbers(doc, 'helvetica');
  doc.save('ConsolidatedFinancialStatement.pdf');
}

// ── Component ──────────────────────────────────────────────────────────────────

const MAX_BRANCHES = 6;

// ── Live society row (from get_all_societies RPC) ─────────────────────────────
interface LiveSociety {
  society_id: string;
  name: string;
  societyType: string;
  financialYear: string;
  district: string;
  state: string;
  plan: string;
  is_locked: boolean;
  user_count?: number;
}

const SOCIETY_TYPE_SHORT: Record<string, string> = {
  marketing_processing: 'CMS',
  pacs: 'PACS',
  consumer: 'Consumer',
  labour: 'Labour',
  other: 'Other',
};

const MultiSocietyConsolidation: React.FC = () => {
  const { language } = useLanguage();
  const { user, isSuperAdmin } = useAuth();
  const hi = language === 'hi';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // ── Live societies (super admin only) ─────────────────────────────────────
  const [liveSocieties, setLiveSocieties] = useState<LiveSociety[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    setLiveLoading(true);
    Promise.all([
      supabase.rpc('get_all_societies'),
      supabase.rpc('get_society_user_counts'),
    ]).then(([{ data: sData }, { data: uData }]) => {
      const countMap: Record<string, number> = {};
      (uData ?? []).forEach((r: { society_id: string; user_count: number }) => {
        countMap[r.society_id] = Number(r.user_count);
      });
      setLiveSocieties(
        (sData ?? []).map((s: LiveSociety) => ({ ...s, user_count: countMap[s.society_id] ?? 0 }))
      );
    }).finally(() => setLiveLoading(false));
  }, [isSuperAdmin]);

  const handleCSV = () => {
    if (branches.length === 0) return;
    const { finHeaders, finRows } = buildExportData(branches);
    downloadCSV(finHeaders, finRows, 'multi-society-consolidation');
  };

  const handleExcel = () => {
    if (branches.length === 0) return;
    const { finHeaders, finRows, mlHeaders, mlRows } = buildExportData(branches);
    downloadExcel(
      [
        { name: 'Financial Summary', headers: finHeaders, rows: finRows },
        { name: 'Members & Loans',   headers: mlHeaders,  rows: mlRows  },
      ],
      'multi-society-consolidation'
    );
  };

  // ── Guard: admin only ──────────────────────────────────────────────────────
  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <h2 className="text-xl font-bold text-gray-800">
          {hi ? 'केवल व्यवस्थापक पहुंच' : 'Admin Access Only'}
        </h2>
        <p className="text-gray-500 max-w-md">
          {hi
            ? 'यह पृष्ठ केवल व्यवस्थापक उपयोगकर्ताओं के लिए उपलब्ध है।'
            : 'This page is available to administrator users only.'}
        </p>
      </div>
    );
  }

  // ── File parsing ───────────────────────────────────────────────────────────
  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArr = Array.from(files);
      const newErrors: string[] = [];
      const newBranches: BranchData[] = [];

      for (const file of fileArr) {
        if (branches.length + newBranches.length >= MAX_BRANCHES) {
          newErrors.push(
            hi
              ? `अधिकतम ${MAX_BRANCHES} शाखाएं लोड की जा सकती हैं।`
              : `Maximum ${MAX_BRANCHES} branches can be loaded.`
          );
          break;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const parsed = JSON.parse(ev.target?.result as string) as BackupFile;
            if (!parsed.version || !parsed.data || !parsed.createdAt) {
              throw new Error('Invalid backup file');
            }
            const branch = processBranchBackup(file.name, parsed);
            setBranches(prev => {
              if (prev.length >= MAX_BRANCHES) return prev;
              // Avoid duplicates by fileName
              if (prev.some(b => b.fileName === file.name)) return prev;
              return [...prev, branch];
            });
          } catch {
            setErrors(prev => [
              ...prev,
              hi
                ? `"${file.name}" — अमान्य बैकअप फ़ाइल।`
                : `"${file.name}" — Invalid backup file.`,
            ]);
          }
        };
        reader.readAsText(file);
      }

      if (newErrors.length) setErrors(prev => [...prev, ...newErrors]);
    },
    [branches.length, hi]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const removeBranch = (idx: number) => {
    setBranches(prev => prev.filter((_, i) => i !== idx));
  };

  const clearAll = () => {
    setBranches([]);
    setErrors([]);
  };

  // ── Consolidated totals ────────────────────────────────────────────────────
  const consolidated = useMemo<BranchData | null>(() => {
    if (branches.length === 0) return null;
    return {
      fileName: '',
      societyName: hi ? 'समेकित' : 'Consolidated',
      financialYear: [...new Set(branches.map(b => b.financialYear))].join(', '),
      createdAt: '',
      totalAssets:      branches.reduce((s, b) => s + b.totalAssets,      0),
      totalLiabilities: branches.reduce((s, b) => s + b.totalLiabilities, 0),
      totalEquity:      branches.reduce((s, b) => s + b.totalEquity,      0),
      totalIncome:      branches.reduce((s, b) => s + b.totalIncome,       0),
      totalExpenditure: branches.reduce((s, b) => s + b.totalExpenditure,  0),
      netSurplus:       branches.reduce((s, b) => s + b.netSurplus,        0),
      activeMembers:    branches.reduce((s, b) => s + b.activeMembers,     0),
      totalShareCapital:branches.reduce((s, b) => s + b.totalShareCapital, 0),
      loansOutstanding: branches.reduce((s, b) => s + b.loansOutstanding,  0),
    };
  }, [branches, hi]);

  // ── Financial rows definition ──────────────────────────────────────────────
  type FinancialRowDef = {
    label: { hi: string; en: string };
    key: keyof BranchData;
    highlight?: boolean;
    surplusColor?: boolean;
  };

  const financialRows: FinancialRowDef[] = [
    { label: { hi: 'कुल संपत्ति',           en: 'Total Assets'       }, key: 'totalAssets'      },
    { label: { hi: 'कुल देयताएं',           en: 'Total Liabilities'  }, key: 'totalLiabilities' },
    { label: { hi: 'पूंजी एवं स्वामित्व',  en: 'Capital & Equity'   }, key: 'totalEquity'      },
    { label: { hi: 'कुल आय',               en: 'Total Income'       }, key: 'totalIncome'      },
    { label: { hi: 'कुल व्यय',             en: 'Total Expenditure'  }, key: 'totalExpenditure' },
    { label: { hi: 'शुद्ध अधिशेष',        en: 'Net Surplus'        }, key: 'netSurplus', highlight: true, surplusColor: true },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-5 max-w-full">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg shrink-0">
            <Building2 className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {hi ? 'बहु-समिति समेकन' : 'Multi-Society Consolidation'}
            </h1>
            <p className="text-sm text-gray-500">
              {hi
                ? 'कई शाखाओं के बैकअप आयात करें और समेकित वित्तीय सारांश देखें'
                : 'Import backups from multiple branches and view a consolidated financial summary'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {branches.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-red-600 border-red-300 hover:bg-red-50"
                onClick={clearAll}
              >
                <RefreshCw className="h-4 w-4" />
                {hi ? 'सभी हटाएं' : 'Clear All'}
              </Button>
              <Button
                size="sm"
                className="gap-2 bg-blue-700 hover:bg-blue-800"
                onClick={() => exportConsolidatedPDF(branches)}
              >
                <Download className="h-4 w-4" />
                {hi ? 'PDF निर्यात' : 'Export PDF'}
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV}>
                <FileSpreadsheet className="h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExcel}>
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Live Supabase Overview (Super Admin only) ────────────────────── */}
      {isSuperAdmin && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2 text-purple-800">
              {liveLoading ? <WifiOff className="h-4 w-4 animate-pulse" /> : <Wifi className="h-4 w-4" />}
              {hi ? 'Live — सभी पंजीकृत समितियाँ (Supabase)' : 'Live — All Registered Societies (Supabase)'}
              <Badge className="bg-purple-200 text-purple-800 text-xs ml-auto">{liveSocieties.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-purple-200 bg-purple-100">
                    {['Society', 'Type', 'FY', 'District', 'Users', 'Plan', 'Locked'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-purple-700">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {liveLoading ? (
                    <tr><td colSpan={7} className="px-3 py-4 text-center text-purple-500">Loading…</td></tr>
                  ) : liveSocieties.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-400">No societies found</td></tr>
                  ) : liveSocieties.map(s => (
                    <tr key={s.society_id} className="border-b border-purple-100 hover:bg-purple-100/50">
                      <td className="px-3 py-1.5 font-medium text-gray-800">{s.name}</td>
                      <td className="px-3 py-1.5 text-gray-600">{SOCIETY_TYPE_SHORT[s.societyType] ?? s.societyType}</td>
                      <td className="px-3 py-1.5 text-gray-600">{s.financialYear}</td>
                      <td className="px-3 py-1.5 text-gray-600">{s.district}{s.state ? `, ${s.state.toUpperCase()}` : ''}</td>
                      <td className="px-3 py-1.5 text-gray-600">{s.user_count ?? 0}</td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          s.plan === 'active' ? 'bg-green-100 text-green-800' :
                          s.plan === 'expired' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>{s.plan}</span>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {s.is_locked ? '🔒' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-purple-500 p-3 border-t border-purple-200">
              {hi
                ? 'Full financial consolidation के लिए नीचे JSON backup files import करें।'
                : 'For full financial consolidation, import JSON backup files below.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Error notices ────────────────────────────────────────────────── */}
      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((err, i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{err}</span>
              <button
                onClick={() => setErrors(prev => prev.filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Import section ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4 text-blue-600" />
            {hi ? 'बैकअप फ़ाइलें आयात करें' : 'Import Backup Files'}
            <Badge variant="outline" className="ml-auto text-xs">
              {branches.length}/{MAX_BRANCHES} {hi ? 'शाखाएं' : 'branches'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
              ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
              ${branches.length >= MAX_BRANCHES ? 'opacity-50 pointer-events-none' : ''}
            `}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">
              {hi
                ? 'JSON बैकअप फ़ाइलें यहां खींचें या क्लिक करें'
                : 'Drag & drop JSON backup files here, or click to browse'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {hi
                ? `अधिकतम ${MAX_BRANCHES} फ़ाइलें • sahakarlekha-backup-*.json`
                : `Up to ${MAX_BRANCHES} files • sahakarlekha-backup-*.json`}
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />

          {/* Loaded branches chips */}
          {branches.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {branches.map((branch, idx) => (
                <div
                  key={branch.fileName}
                  className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  <FileJson className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-900 truncate">{branch.societyName}</p>
                    <p className="text-xs text-blue-600 truncate">{branch.fileName}</p>
                    <p className="text-xs text-gray-500">
                      {hi ? 'वित्त वर्ष:' : 'FY:'} {branch.financialYear}
                    </p>
                  </div>
                  <button
                    onClick={() => removeBranch(idx)}
                    className="text-blue-400 hover:text-red-500 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {branches.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="p-4 bg-gray-100 rounded-full">
            <Building2 className="h-10 w-10 text-gray-400" />
          </div>
          <p className="text-lg font-medium text-gray-600">
            {hi ? 'कोई शाखा लोड नहीं हुई' : 'No branches loaded'}
          </p>
          <p className="text-sm text-gray-400 max-w-sm">
            {hi
              ? 'ऊपर से एक या अधिक शाखाओं की बैकअप JSON फ़ाइलें अपलोड करें।'
              : 'Upload one or more branch backup JSON files above to view the consolidated summary.'}
          </p>
        </div>
      )}

      {/* ── Consolidated Financial Summary Table ─────────────────────────── */}
      {branches.length > 0 && consolidated && (
        <Card>
          <CardHeader className="py-3 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <FileJson className="h-4 w-4 text-blue-600" />
              {hi ? 'वित्तीय सारांश' : 'Financial Summary'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-50">
                    <TableHead className="font-bold text-gray-700 min-w-[160px]">
                      {hi ? 'विवरण' : 'Particulars'}
                    </TableHead>
                    {branches.map((b, i) => (
                      <TableHead key={i} className="text-right font-semibold text-blue-800 min-w-[130px]">
                        <div className="truncate max-w-[120px]" title={b.societyName}>
                          {b.societyName}
                        </div>
                        <div className="text-xs font-normal text-gray-500">{b.financialYear}</div>
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-bold text-blue-900 bg-blue-100 min-w-[140px]">
                      {hi ? 'समेकित कुल' : 'Consolidated Total'}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {financialRows.map((row) => {
                    const consolidatedVal = consolidated[row.key] as number;
                    const isNegSurplus = row.surplusColor && consolidatedVal < 0;
                    return (
                      <TableRow
                        key={row.key}
                        className={row.highlight ? 'bg-blue-50 font-semibold border-t-2 border-blue-200' : ''}
                      >
                        <TableCell className="font-medium">
                          {row.label[hi ? 'hi' : 'en']}
                        </TableCell>
                        {branches.map((b, i) => {
                          const val = b[row.key] as number;
                          return (
                            <TableCell key={i} className="text-right tabular-nums">
                              {fmt(val)}
                            </TableCell>
                          );
                        })}
                        <TableCell
                          className={`text-right font-bold tabular-nums bg-blue-50
                            ${row.surplusColor
                              ? isNegSurplus
                                ? 'text-red-700'
                                : 'text-green-700'
                              : ''
                            }`}
                        >
                          {fmt(consolidatedVal)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Members & Loans Summary Table ────────────────────────────────── */}
      {branches.length > 0 && consolidated && (
        <Card>
          <CardHeader className="py-3 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-green-600" />
              {hi ? 'सदस्य एवं ऋण सारांश' : 'Members & Loans Summary'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-green-50">
                    <TableHead className="font-bold text-gray-700">
                      {hi ? 'शाखा' : 'Branch'}
                    </TableHead>
                    <TableHead className="font-bold text-gray-700">
                      {hi ? 'वित्त वर्ष' : 'Financial Year'}
                    </TableHead>
                    <TableHead className="text-right font-bold text-gray-700">
                      {hi ? 'सक्रिय सदस्य' : 'Active Members'}
                    </TableHead>
                    <TableHead className="text-right font-bold text-gray-700">
                      {hi ? 'कुल अंश पूंजी' : 'Total Share Capital'}
                    </TableHead>
                    <TableHead className="text-right font-bold text-gray-700">
                      {hi ? 'बकाया ऋण' : 'Loans Outstanding'}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((b, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{b.societyName}</TableCell>
                      <TableCell>{b.financialYear}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.activeMembers}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(b.totalShareCapital)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(b.loansOutstanding)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-green-50 font-bold">
                    <TableCell colSpan={2}>
                      {hi ? 'कुल योग' : 'Grand Total'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtN(consolidated.activeMembers)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmt(consolidated.totalShareCapital)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmt(consolidated.loansOutstanding)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Quick stats row ──────────────────────────────────────────────── */}
      {branches.length > 0 && consolidated && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            {
              label: hi ? 'कुल संपत्ति'    : 'Total Assets',
              value: fmt(consolidated.totalAssets),
              cls: 'text-blue-700',
              bg: 'bg-blue-50',
            },
            {
              label: hi ? 'कुल देयताएं'    : 'Total Liabilities',
              value: fmt(consolidated.totalLiabilities),
              cls: 'text-orange-700',
              bg: 'bg-orange-50',
            },
            {
              label: hi ? 'पूंजी'          : 'Capital & Equity',
              value: fmt(consolidated.totalEquity),
              cls: 'text-purple-700',
              bg: 'bg-purple-50',
            },
            {
              label: hi ? 'आय'             : 'Income',
              value: fmt(consolidated.totalIncome),
              cls: 'text-green-700',
              bg: 'bg-green-50',
            },
            {
              label: hi ? 'व्यय'           : 'Expenditure',
              value: fmt(consolidated.totalExpenditure),
              cls: 'text-red-700',
              bg: 'bg-red-50',
            },
            {
              label: hi ? 'शुद्ध अधिशेष'  : 'Net Surplus',
              value: fmt(consolidated.netSurplus),
              cls: consolidated.netSurplus >= 0 ? 'text-green-700' : 'text-red-700',
              bg: consolidated.netSurplus >= 0 ? 'bg-green-50' : 'bg-red-50',
            },
          ].map(item => (
            <Card key={item.label} className={`${item.bg} border-0`}>
              <CardContent className="p-3">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className={`text-base font-bold mt-1 ${item.cls} truncate`} title={item.value}>
                  {item.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

    </div>
  );
};

export default MultiSocietyConsolidation;

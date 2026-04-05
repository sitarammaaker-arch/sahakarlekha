/**
 * AR / AP Aging Analysis + Sundry Debtor/Creditor Report
 *
 * Tabs:
 *  1. Debtors (AR) — Sundry Debtors account 3303 + customer sub-accounts
 *  2. Creditors (AP) — Sundry Creditors account 2101 + supplier sub-accounts
 *
 * Aging buckets: Current (0-30) | 31-60 | 61-90 | 91-180 | >180 days
 * Based on individual transaction dates vs today.
 */
import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { TrendingDown, TrendingUp, Download, Search, Info, FileSpreadsheet } from 'lucide-react';
import { getVoucherLines } from '@/lib/voucherUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { addHeader, addPageNumbers, addSignatureBlock, getSignatoryNames, pdfFileName, rightAlignAmountColumns } from '@/lib/pdf';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AgingRow {
  accountId: string;
  name: string;
  code: string;
  phone: string;
  totalOutstanding: number;
  bucket0_30: number;
  bucket31_60: number;
  bucket61_90: number;
  bucket91_180: number;
  bucketOver180: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const today = new Date();
today.setHours(0, 0, 0, 0);

const daysSince = (dateStr: string): number => {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - d.getTime()) / 86_400_000));
};

const fmt = (n: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

const fmtN = (n: number) =>
  new Intl.NumberFormat('hi-IN', { minimumFractionDigits: 2 }).format(Math.round(n));

const BUCKET_LABELS = (hi: boolean) => [
  { key: 'bucket0_30',    label: hi ? '0–30 दिन'   : '0–30 days',   cls: 'text-green-700'  },
  { key: 'bucket31_60',   label: hi ? '31–60 दिन'  : '31–60 days',  cls: 'text-yellow-700' },
  { key: 'bucket61_90',   label: hi ? '61–90 दिन'  : '61–90 days',  cls: 'text-orange-600' },
  { key: 'bucket91_180',  label: hi ? '91–180 दिन' : '91–180 days', cls: 'text-red-600'    },
  { key: 'bucketOver180', label: hi ? '>180 दिन'   : '>180 days',   cls: 'text-red-800 font-bold' },
] as const;

// ── Core aging calc ───────────────────────────────────────────────────────────
/**
 * Build aging rows for a set of accountIds.
 * For each transaction (voucher) involving the account:
 *   - If account is on DEBIT side → increases balance (money owed TO us / DR balance)
 *   - If account is on CREDIT side → decreases balance
 * We spread the net signed amount into aging buckets by voucher date.
 */
function buildAgingRows(
  accountIds: string[],
  nameMap: Record<string, { name: string; code: string; phone: string }>,
  vouchers: ReturnType<typeof useData>['vouchers'],
  mode: 'dr' | 'cr'   // dr = debtors (DR balance expected), cr = creditors (CR balance expected)
): AgingRow[] {
  const rows: AgingRow[] = [];

  for (const accountId of accountIds) {
    // Collect all non-deleted vouchers touching this account (supports multi-line Expert Mode vouchers)
    const relevant = vouchers.filter(v =>
      !v.isDeleted &&
      getVoucherLines(v).some(l => l.accountId === accountId)
    );

    let totalOutstanding = 0;
    let bucket0_30 = 0, bucket31_60 = 0, bucket61_90 = 0, bucket91_180 = 0, bucketOver180 = 0;

    for (const v of relevant) {
      const days = daysSince(v.date);
      // Iterate each line that touches this account
      getVoucherLines(v).forEach(l => {
        if (l.accountId !== accountId) return;
        // Signed amount: positive = increases balance (Dr for debtors, Cr for creditors)
        let signed = 0;
        if (mode === 'dr') {
          signed = l.type === 'Dr' ? l.amount : -l.amount;
        } else {
          signed = l.type === 'Cr' ? l.amount : -l.amount;
        }

        totalOutstanding += signed;

        if (days <= 30)       bucket0_30    += signed;
        else if (days <= 60)  bucket31_60   += signed;
        else if (days <= 90)  bucket61_90   += signed;
        else if (days <= 180) bucket91_180  += signed;
        else                  bucketOver180 += signed;
      });
    }

    // Only include if there's an outstanding balance
    if (Math.abs(totalOutstanding) < 0.01) continue;

    const meta = nameMap[accountId] ?? { name: accountId, code: '—', phone: '—' };
    rows.push({
      accountId,
      name: meta.name,
      code: meta.code,
      phone: meta.phone,
      totalOutstanding,
      bucket0_30,
      bucket31_60,
      bucket61_90,
      bucket91_180,
      bucketOver180,
    });
  }

  return rows.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
}

// ── AgingTable component ──────────────────────────────────────────────────────
const AgingTable: React.FC<{
  rows: AgingRow[];
  hi: boolean;
  mode: 'dr' | 'cr';
  search: string;
}> = ({ rows, hi, mode, search }) => {
  const buckets = BUCKET_LABELS(hi);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(() => filtered.reduce((acc, r) => ({
    total: acc.total + r.totalOutstanding,
    b0: acc.b0 + r.bucket0_30,
    b1: acc.b1 + r.bucket31_60,
    b2: acc.b2 + r.bucket61_90,
    b3: acc.b3 + r.bucket91_180,
    b4: acc.b4 + r.bucketOver180,
  }), { total: 0, b0: 0, b1: 0, b2: 0, b3: 0, b4: 0 }), [filtered]);

  if (rows.length === 0) {
    return (
      <p className="p-8 text-center text-gray-400 text-sm">
        {hi ? 'कोई बकाया शेष नहीं।' : 'No outstanding balances.'}
      </p>
    );
  }

  const amtCell = (n: number, cls = '') => (
    <TableCell className={`text-right text-sm ${Math.abs(n) < 0.01 ? 'text-gray-300' : cls}`}>
      {Math.abs(n) < 0.01 ? '—' : fmtN(n)}
    </TableCell>
  );

  return (
    <div className="overflow-x-auto">
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-8">#</TableHead>
            <TableHead>{hi ? 'नाम' : 'Name'}</TableHead>
            <TableHead>{hi ? 'कोड' : 'Code'}</TableHead>
            <TableHead>{hi ? 'फोन' : 'Phone'}</TableHead>
            <TableHead className="text-right font-bold">{hi ? 'कुल बकाया' : 'Total Outstanding'}</TableHead>
            {buckets.map(b => (
              <TableHead key={b.key} className={`text-right ${b.cls}`}>{b.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((r, i) => (
            <TableRow key={r.accountId} className={i % 2 === 0 ? '' : 'bg-gray-50/50'}>
              <TableCell className="text-gray-400">{i + 1}</TableCell>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="font-mono">{r.code}</TableCell>
              <TableCell>{r.phone || '—'}</TableCell>
              <TableCell className={`text-right font-bold ${mode === 'dr' ? 'text-blue-700' : 'text-orange-700'}`}>
                {fmtN(r.totalOutstanding)}
              </TableCell>
              {amtCell(r.bucket0_30,    'text-green-700')}
              {amtCell(r.bucket31_60,   'text-yellow-700')}
              {amtCell(r.bucket61_90,   'text-orange-600')}
              {amtCell(r.bucket91_180,  'text-red-600')}
              {amtCell(r.bucketOver180, 'text-red-800 font-semibold')}
            </TableRow>
          ))}
        </TableBody>
        <tfoot>
          <tr className="bg-gray-100 border-t-2 font-bold text-xs">
            <td colSpan={4} className="px-4 py-2">{hi ? `कुल (${filtered.length})` : `Total (${filtered.length})`}</td>
            <td className={`px-4 py-2 text-right ${mode === 'dr' ? 'text-blue-700' : 'text-orange-700'}`}>{fmtN(totals.total)}</td>
            <td className="px-4 py-2 text-right text-green-700">{fmtN(totals.b0)}</td>
            <td className="px-4 py-2 text-right text-yellow-700">{fmtN(totals.b1)}</td>
            <td className="px-4 py-2 text-right text-orange-600">{fmtN(totals.b2)}</td>
            <td className="px-4 py-2 text-right text-red-600">{fmtN(totals.b3)}</td>
            <td className="px-4 py-2 text-right text-red-800">{fmtN(totals.b4)}</td>
          </tr>
        </tfoot>
      </Table>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const AgingAnalysis: React.FC = () => {
  const { language } = useLanguage();
  const { vouchers, accounts, customers, suppliers, society } = useData();
  const hi = language === 'hi';
  const [search, setSearch] = useState('');

  // ── Debtor accounts: 3303 (Sundry Debtors) + customer sub-accounts ─────────
  const debtorAccountIds = useMemo(() => {
    const ids = new Set<string>();
    ids.add('3303');
    customers.filter(c => c.isActive && c.accountId).forEach(c => ids.add(c.accountId));
    // Also include any account under 3303 group
    accounts.filter(a => !a.isGroup && a.parentId === '3303').forEach(a => ids.add(a.id));
    return [...ids];
  }, [customers, accounts]);

  // ── Creditor accounts: 2101 (Sundry Creditors) + supplier sub-accounts ──────
  const creditorAccountIds = useMemo(() => {
    const ids = new Set<string>();
    ids.add('2101');
    suppliers.filter(s => s.isActive && s.accountId).forEach(s => ids.add(s.accountId));
    accounts.filter(a => !a.isGroup && a.parentId === '2101').forEach(a => ids.add(a.id));
    return [...ids];
  }, [suppliers, accounts]);

  // ── Name maps ──────────────────────────────────────────────────────────────
  const debtorNameMap = useMemo(() => {
    const map: Record<string, { name: string; code: string; phone: string }> = {};
    customers.forEach(c => {
      map[c.accountId] = { name: c.name, code: c.customerCode, phone: c.phone ?? '' };
    });
    // Fallback to account name for 3303
    const acc3303 = accounts.find(a => a.id === '3303');
    if (acc3303) map['3303'] = { name: hi ? acc3303.nameHi : acc3303.name, code: '3303', phone: '' };
    return map;
  }, [customers, accounts, hi]);

  const creditorNameMap = useMemo(() => {
    const map: Record<string, { name: string; code: string; phone: string }> = {};
    suppliers.forEach(s => {
      map[s.accountId] = { name: s.name, code: s.supplierCode, phone: s.phone ?? '' };
    });
    const acc2101 = accounts.find(a => a.id === '2101');
    if (acc2101) map['2101'] = { name: hi ? acc2101.nameHi : acc2101.name, code: '2101', phone: '' };
    return map;
  }, [suppliers, accounts, hi]);

  // ── Aging rows ─────────────────────────────────────────────────────────────
  const debtorRows  = useMemo(() => buildAgingRows(debtorAccountIds,  debtorNameMap,  vouchers, 'dr'), [debtorAccountIds,  debtorNameMap,  vouchers]);
  const creditorRows = useMemo(() => buildAgingRows(creditorAccountIds, creditorNameMap, vouchers, 'cr'), [creditorAccountIds, creditorNameMap, vouchers]);

  const totalAR = debtorRows.reduce((s, r)  => s + r.totalOutstanding, 0);
  const totalAP = creditorRows.reduce((s, r) => s + r.totalOutstanding, 0);
  const netPosition = totalAR - totalAP;

  // ── CSV / Excel export ─────────────────────────────────────────────────────
  const agingHeaders = ['#', 'Name', 'Code', 'Phone', 'Total Outstanding', '0-30d', '31-60d', '61-90d', '91-180d', '>180d'];

  const agingRowsFor = (rows: AgingRow[]) =>
    rows.map((r, i) => [
      i + 1, r.name, r.code, r.phone || '—',
      Math.round(r.totalOutstanding),
      Math.round(r.bucket0_30), Math.round(r.bucket31_60), Math.round(r.bucket61_90),
      Math.round(r.bucket91_180), Math.round(r.bucketOver180),
    ]);

  const handleCSV = (mode: 'ar' | 'ap') => {
    const rows = mode === 'ar' ? debtorRows : creditorRows;
    downloadCSV(agingHeaders, agingRowsFor(rows), `aging-analysis-${mode}`);
  };

  const handleExcel = (mode: 'ar' | 'ap') => {
    const rows = mode === 'ar' ? debtorRows : creditorRows;
    const sheetName = mode === 'ar' ? 'AR Debtors' : 'AP Creditors';
    downloadExcelSingle(agingHeaders, agingRowsFor(rows), 'aging-analysis', sheetName);
  };

  // ── PDF export ─────────────────────────────────────────────────────────────
  const handleDownloadPDF = (mode: 'ar' | 'ap') => {
    const rows   = mode === 'ar' ? debtorRows : creditorRows;
    const subtitle = mode === 'ar' ? 'AR Aging — Sundry Debtors' : 'AP Aging — Sundry Creditors';
    const doc    = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const { startY, font } = addHeader(doc, 'Aging Analysis Report', society, subtitle, { reportCode: 'AGE' });

    autoTable(doc, {
      startY,
      head: [['#', 'Name', 'Code', 'Phone', 'Total Outstanding', '0-30d', '31-60d', '61-90d', '91-180d', '>180d']],
      body: rows.map((r, i) => [
        i + 1, r.name, r.code, r.phone || '—',
        fmtN(r.totalOutstanding),
        fmtN(r.bucket0_30), fmtN(r.bucket31_60), fmtN(r.bucket61_90),
        fmtN(r.bucket91_180), fmtN(r.bucketOver180),
      ]),
      foot: [['', 'Total', '', '',
        fmtN(rows.reduce((s, r) => s + r.totalOutstanding, 0)),
        fmtN(rows.reduce((s, r) => s + r.bucket0_30, 0)),
        fmtN(rows.reduce((s, r) => s + r.bucket31_60, 0)),
        fmtN(rows.reduce((s, r) => s + r.bucket61_90, 0)),
        fmtN(rows.reduce((s, r) => s + r.bucket91_180, 0)),
        fmtN(rows.reduce((s, r) => s + r.bucketOver180, 0)),
      ]],
      styles: { fontSize: 7.5 },
      headStyles: { fillColor: mode === 'ar' ? [37, 99, 235] : [234, 88, 12] },
      footStyles: { fontStyle: 'bold' },
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right' } },
      didParseCell: rightAlignAmountColumns(4, 5, 6, 7, 8, 9),
    });

    const sigY = (doc as any).lastAutoTable.finalY + 10;
    const sig = getSignatoryNames(society);
    addSignatureBlock(doc, font, ['Accountant', 'Secretary / Manager', 'President'], sigY, undefined,
      [sig.accountant, sig.secretary, sig.president]);

    addPageNumbers(doc, font, society.name);
    doc.save(pdfFileName('AgingAnalysis', society));
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <TrendingDown className="h-6 w-6 text-indigo-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {hi ? 'AR/AP बकाया विश्लेषण' : 'AR / AP Aging Analysis'}
          </h1>
          <p className="text-sm text-gray-500">
            {society.name} · {hi ? 'आज:' : 'As on:'} {today.toLocaleDateString('hi-IN')}
          </p>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {hi
            ? 'प्रत्येक वाउचर की तिथि के आधार पर बकाया राशि को समय-वर्गों में बांटा गया है।'
            : 'Outstanding amounts are bucketed by days elapsed since each voucher date.'}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-700" />
              <p className="text-xs text-blue-700 font-medium">{hi ? 'कुल प्राप्य (AR)' : 'Total Receivable (AR)'}</p>
            </div>
            <p className="text-2xl font-bold text-blue-700">{fmt(totalAR)}</p>
            <p className="text-xs text-blue-500 mt-0.5">{debtorRows.length} {hi ? 'देनदार' : 'debtors'}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-orange-700" />
              <p className="text-xs text-orange-700 font-medium">{hi ? 'कुल देय (AP)' : 'Total Payable (AP)'}</p>
            </div>
            <p className="text-2xl font-bold text-orange-700">{fmt(totalAP)}</p>
            <p className="text-xs text-orange-500 mt-0.5">{creditorRows.length} {hi ? 'लेनदार' : 'creditors'}</p>
          </CardContent>
        </Card>
        <Card className={netPosition >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <CardContent className="p-4">
            <p className="text-xs font-medium mb-1" style={{ color: netPosition >= 0 ? '#15803d' : '#dc2626' }}>
              {hi ? 'शुद्ध स्थिति (AR − AP)' : 'Net Position (AR − AP)'}
            </p>
            <p className={`text-2xl font-bold ${netPosition >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {fmt(Math.abs(netPosition))}
            </p>
            <p className={`text-xs mt-0.5 ${netPosition >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {netPosition >= 0 ? (hi ? 'नेट प्राप्य' : 'Net Receivable') : (hi ? 'नेट देय' : 'Net Payable')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Tabs */}
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-gray-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={hi ? 'नाम / कोड खोजें…' : 'Search name / code…'}
          className="h-8 w-48"
        />
      </div>

      <Tabs defaultValue="ar">
        <TabsList>
          <TabsTrigger value="ar" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            {hi ? 'देनदार (AR)' : 'Debtors (AR)'}
            {debtorRows.length > 0 && (
              <Badge className="bg-blue-100 text-blue-700 ml-1 text-xs">{debtorRows.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ap" className="gap-2">
            <TrendingDown className="h-4 w-4" />
            {hi ? 'लेनदार (AP)' : 'Creditors (AP)'}
            {creditorRows.length > 0 && (
              <Badge className="bg-orange-100 text-orange-700 ml-1 text-xs">{creditorRows.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ar">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="text-blue-700">{hi ? 'सुंदरी देनदार — बकाया विश्लेषण' : 'Sundry Debtors — Aging Analysis'}</span>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleDownloadPDF('ar')}>
                    <Download className="h-3.5 w-3.5" />PDF
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleExcel('ar')}>
                    <FileSpreadsheet className="h-3.5 w-3.5" />Excel
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleCSV('ar')}>
                    <FileSpreadsheet className="h-3.5 w-3.5" />CSV
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <AgingTable rows={debtorRows} hi={hi} mode="dr" search={search} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ap">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="text-orange-700">{hi ? 'सुंदरी लेनदार — बकाया विश्लेषण' : 'Sundry Creditors — Aging Analysis'}</span>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleDownloadPDF('ap')}>
                    <Download className="h-3.5 w-3.5" />PDF
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleExcel('ap')}>
                    <FileSpreadsheet className="h-3.5 w-3.5" />Excel
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleCSV('ap')}>
                    <FileSpreadsheet className="h-3.5 w-3.5" />CSV
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <AgingTable rows={creditorRows} hi={hi} mode="cr" search={search} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AgingAnalysis;

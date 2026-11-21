import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllPaged } from '@/lib/supabasePaging';
import * as storage from '@/lib/storage';
import type { TdsEntry as ManualTdsEntry, TdsChallan, TdsChallanLink } from '@/types';
import { buildForm16aRows, groupForm16a, challanLabel, type Form16aRow } from '@/lib/tax/form16aRows';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { addHeader, addPageNumbers, addDocumentSignatureBlock, getSignatoryNames, pdfFileName } from '@/lib/pdf';
import { purchaseTdsParty } from '@/lib/tax/purchaseTdsParty';

const fmt = (n: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

function fyBounds(fy: string) {
  const [startYear] = fy.split('-').map(Number);
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` };
}

export default function TdsForm16A() {
  const { purchases: allPurchases, suppliers, society, matchesActiveBranch } = useData();
  const { user } = useAuth();
  // Leftover after RPT-15: the manual TDS register entries and the challans they were deposited under (same load as
  // the TDS Register page: Supabase first, the local copy only if the read fails).
  const [manual, setManual] = useState<ManualTdsEntry[]>(() => storage.getTdsEntries());
  const [challans, setChallans] = useState<TdsChallan[]>(() => storage.getTdsChallans());
  const [links, setLinks] = useState<TdsChallanLink[]>(() => storage.getTdsChallanLinks());
  useEffect(() => {
    if (!user?.societyId) { setManual([]); setChallans([]); setLinks([]); return; }
    fetchAllPaged<ManualTdsEntry>('tds_entries', user.societyId).then(({ data, error }) => setManual(error || !data ? storage.getTdsEntries() : data as ManualTdsEntry[]), () => setManual(storage.getTdsEntries()));
    fetchAllPaged<TdsChallan>('tds_challans', user.societyId).then(({ data, error }) => setChallans(error || !data ? storage.getTdsChallans() : data as TdsChallan[]), () => setChallans(storage.getTdsChallans()));
    fetchAllPaged<TdsChallanLink>('tds_challan_links', user.societyId, ['entryId']).then(({ data, error }) => setLinks(error || !data ? storage.getTdsChallanLinks() : data as TdsChallanLink[]), () => setLinks(storage.getTdsChallanLinks()));
  }, [user?.societyId]);
  // ECR-17: honour the active branch (same rule as GstSummary / TdsRegister).
  const purchases = useMemo(() => allPurchases.filter(p => matchesActiveBranch(p.branchId)), [allPurchases, matchesActiveBranch]);
  const { language } = useLanguage();
  const hi = language === 'hi';

  const [selectedFY, setSelectedFY] = useState(society.financialYear);
  const [deductorName, setDeductorName] = useState(society.name);
  // RPT-15: prefilled from the society record (they printed as blanks), still editable.
  const [deductorPan, setDeductorPan] = useState(society.entityPan || '');
  const [deductorTan, setDeductorTan] = useState(society.tan || '');
  // RPT-15: the FY list follows the society's own year (it was hard-coded up to 2025-26).
  const fyOptions = useMemo(() => {
    const start = Number(String(society.financialYear || '').split('-')[0]) || new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => { const y = start - i; return `${y}-${String((y + 1) % 100).padStart(2, '0')}`; });
  }, [society.financialYear]);
  const [filterSupplier, setFilterSupplier] = useState('__all__');

  const { from, to } = fyBounds(selectedFY);

  // Every non-salary deduction of the year: purchases + manual entries, each with its challan; grouped by deductee
  // id / PAN (not by name — two suppliers with one name stay apart).
  const tdsEntries: Form16aRow[] = useMemo(() => buildForm16aRows({
    purchases,
    partyOf: (p) => purchaseTdsParty(suppliers.find(x => x.id === p.supplierId)),
    manual: manual.filter(m => matchesActiveBranch((m as { branchId?: string }).branchId)),
    challans, links, from, to,
  }), [purchases, suppliers, manual, challans, links, from, to, matchesActiveBranch]);
  const groups = useMemo(() => groupForm16a(tdsEntries), [tdsEntries]);
  const groupByKey = useMemo(() => new Map(groups.map(g => [g.key, g])), [groups]);
  const filtered = (filterSupplier && filterSupplier !== '__all__') ? groupByKey.get(filterSupplier)?.rows ?? [] : tdsEntries;
  const filterName = groupByKey.get(filterSupplier)?.name ?? '';
  const unlinked = filtered.filter(e => !e.challan).length;

  const totalTds = filtered.reduce((s, e) => s + e.tdsAmount, 0);
  const totalGross = filtered.reduce((s, e) => s + e.grossAmount, 0);

  const tdsHeaders = ['#', 'Date', 'Bill / Nature', 'Deductee', 'PAN', 'Section', 'Gross Amount', 'TDS %', 'TDS Amount', 'Challan BSR', 'Challan Date', 'Challan Serial'];
  const rowOf = (e: Form16aRow, i: number) => [i + 1, e.date, e.docNo, e.deducteeName, e.deducteePan || 'PAN not available', e.section, e.grossAmount, `${e.tdsPct}%`, e.tdsAmount, e.challan?.bsrCode ?? '', e.challan?.challanDate ?? '', e.challan?.challanSerial ?? ''];

  const handleCSV = () => {
    const rows = filtered.map(rowOf);   // RPT-15: honours the supplier filter
    downloadCSV(tdsHeaders, rows, 'tds-form-16a');
  };

  const handleExcel = () => {
    const rows = filtered.map(rowOf);
    downloadExcelSingle(tdsHeaders, rows, 'tds-form-16a', 'TDS Form 16A');
  };

  const handlePDF = (deducteeKey?: string) => {
    const group = deducteeKey ? groupByKey.get(deducteeKey) : undefined;
    const supplierName = group?.name;
    const entries = group ? group.rows : tdsEntries;
    if (entries.length === 0) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const subtitle = supplierName
      ? `Deductee: ${supplierName} | FY: ${selectedFY}`
      : `Statement of TDS deducted (non-salary) — NOT the TRACES certificate | FY: ${selectedFY}`;   // RPT-15: honest label (no 1961-Act citation)
    const { startY, font } = addHeader(doc, 'TDS Form 16A', society, subtitle, { reportCode: 'F16A' });

    // Deductor Info
    let y = startY;
    doc.setFontSize(9);
    doc.setFont(font, 'normal');
    doc.text(`Name of Deductor: ${deductorName}`, 14, y); y += 6;
    doc.text(`TAN: ${deductorTan || '____________'}   PAN: ${deductorPan || '____________'}`, 14, y); y += 8;

    if (group) {
      if (group.pan) { doc.text(`PAN of Deductee: ${group.pan}`, 14, y); y += 6; }
      const totalDedGross = entries.reduce((s, e) => s + e.grossAmount, 0);
      const totalDedTds = entries.reduce((s, e) => s + e.tdsAmount, 0);
      doc.text(`Total Payment: ${fmt(totalDedGross)}   Total TDS: ${fmt(totalDedTds)}`, 14, y); y += 6;

      autoTable(doc, {
        startY: y,
        head: [['#', 'Date', 'Bill / Nature', 'Section', 'Gross Amount', 'TDS %', 'TDS', 'Challan (BSR · date · serial)']],
        body: entries.map((e, i) => [i + 1, e.date, e.docNo, e.section, e.grossAmount.toFixed(2), `${e.tdsPct}%`, e.tdsAmount.toFixed(2), challanLabel(e.challan)]),
        foot: [['', '', '', 'Total', totalDedGross.toFixed(2), '', totalDedTds.toFixed(2), '']],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
        footStyles: { fontStyle: 'bold' },
      });

      const sigY = (doc as any).lastAutoTable.finalY + 10;
      const sig = getSignatoryNames(society);
      addDocumentSignatureBlock(doc, font, ['Accountant', 'Authorized Signatory'], sigY, undefined,
        [sig.accountant, deductorName]);
    } else {
      // Summary for all suppliers
      autoTable(doc, {
        startY: y,
        head: [['#', 'Deductee', 'PAN', 'Transactions', 'Gross Amount', 'TDS %', 'TDS Amount']],
        body: groups.map((g, i) => {
          const avgPct = g.gross > 0 ? (g.tds / g.gross) * 100 : 0;
          return [i + 1, g.name, g.pan || '—', g.rows.length, g.gross.toFixed(2), `${avgPct.toFixed(1)}%`, g.tds.toFixed(2)];
        }),
        foot: [['', 'Total', '', tdsEntries.length, totalGross.toFixed(2), '', totalTds.toFixed(2)]],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
        footStyles: { fontStyle: 'bold' },
      });
    }

    addPageNumbers(doc, font, society.name);
    doc.save(pdfFileName('TDS_Form16A', society));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'TDS प्रमाणपत्र — Form 16A' : 'TDS Certificate — Form 16A'}</h1>
          <p className="text-muted-foreground text-sm">{hi ? 'स्रोत पर कर कटौती का विवरण और प्रमाण पत्र' : 'Tax Deducted at Source details and certificate'}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => handlePDF()} variant="outline">
            <Download className="h-4 w-4 mr-2" />{hi ? 'सारांश PDF' : 'Summary PDF'}
          </Button>
          <Button onClick={handleExcel} variant="outline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />Excel
          </Button>
          <Button onClick={handleCSV} variant="outline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />CSV
          </Button>
        </div>
      </div>

      {/* Deductor details */}
      <Card>
        <CardHeader><CardTitle className="text-sm">{hi ? 'कटौतीकर्ता विवरण' : 'Deductor Details'}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label>{hi ? 'समिति का नाम' : 'Society Name'}</Label>
            <Input value={deductorName} onChange={e => setDeductorName(e.target.value)} />
          </div>
          <div>
            <Label>PAN</Label>
            <Input value={deductorPan} onChange={e => setDeductorPan(e.target.value.toUpperCase())} placeholder="AAAAA1234A" maxLength={10} />
          </div>
          <div>
            <Label>TAN</Label>
            <Input value={deductorTan} onChange={e => setDeductorTan(e.target.value.toUpperCase())} placeholder="AAAA12345A" maxLength={10} />
          </div>
          <div>
            <Label>{hi ? 'वित्तीय वर्ष' : 'Financial Year'}</Label>
            <Select value={selectedFY} onValueChange={setSelectedFY}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {fyOptions.map(fy => (
                  <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'कुल TDS' : 'Total TDS Deducted'}</p>
          <p className="font-bold text-blue-700 text-lg">{fmt(totalTds)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'कुल सकल भुगतान' : 'Total Gross Payment'}</p>
          <p className="font-bold">{fmt(totalGross)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'लेनदेन' : 'Transactions'}</p>
          <p className="font-bold">{filtered.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'कटौती वाले पक्ष' : 'Deductees'}</p>
          <p className="font-bold">{groups.length}</p>
        </CardContent></Card>
      </div>

      {/* Supplier-wise summary */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">{hi ? 'पक्ष-वार TDS सारांश' : 'Deductee-wise TDS Summary'}</CardTitle>
          <Select value={filterSupplier} onValueChange={setFilterSupplier}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={hi ? 'सभी आपूर्तिकर्ता' : 'All Suppliers'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{hi ? 'सभी' : 'All'}</SelectItem>
              {groups.map(g => <SelectItem key={g.key} value={g.key}>{g.name}{g.pan ? ` (${g.pan})` : ''}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{hi ? 'पक्ष' : 'Deductee'}</TableHead>
                <TableHead className="text-right">{hi ? 'लेनदेन' : 'Trans.'}</TableHead>
                <TableHead className="text-right">{hi ? 'सकल राशि' : 'Gross Amt'}</TableHead>
                <TableHead className="text-right">TDS %</TableHead>
                <TableHead className="text-right">{hi ? 'TDS राशि' : 'TDS Amt'}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {hi ? 'इस वर्ष कोई TDS कटौती नहीं मिली' : 'No TDS deductions found for this year'}
                  </TableCell>
                </TableRow>
              ) : groups.map(g => {
                const gross = g.gross;
                const tds = g.tds;
                const avgPct = gross > 0 ? (tds / gross) * 100 : 0;
                return (
                  <TableRow key={g.key}>
                    <TableCell className="font-medium">{g.name}{g.pan && <span className="ml-2 text-xs text-muted-foreground font-mono">{g.pan}</span>}</TableCell>
                    <TableCell className="text-right">{g.rows.length}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(gross)}</TableCell>
                    <TableCell className="text-right">{avgPct.toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono font-semibold text-blue-700">{fmt(tds)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => handlePDF(g.key)}>
                        <FileText className="h-4 w-4 mr-1" />16A
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {groups.length > 0 && (
                <TableRow className="font-bold bg-muted/30">
                  <TableCell colSpan={3} className="text-right">{hi ? 'कुल' : 'Total'}</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-mono text-blue-700">{fmt(totalTds)}</TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail entries */}
      {filterSupplier && filterSupplier !== '__all__' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{filterName} — {hi ? 'लेनदेन विवरण' : 'Transaction Details'}</CardTitle>
            {unlinked > 0 && (
              <p className="text-xs text-amber-700">
                {hi ? `${unlinked} कटौती अभी किसी चालान से नहीं जुड़ी — TDS Register में चालान चुनें, तभी Form 16A पूरा होगा।` : `${unlinked} deduction(s) are not linked to a challan yet — pick the challan in the TDS Register to complete Form 16A.`}
              </p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                  <TableHead>{hi ? 'बिल / प्रकृति' : 'Bill / Nature'}</TableHead>
                  <TableHead>{hi ? 'धारा' : 'Section'}</TableHead>
                  <TableHead>{hi ? 'सकल राशि' : 'Gross'}</TableHead>
                  <TableHead>TDS %</TableHead>
                  <TableHead>{hi ? 'TDS' : 'TDS'}</TableHead>
                  <TableHead>{hi ? 'चालान' : 'Challan'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(e => (
                  <TableRow key={e.entryId}>
                    <TableCell>{e.date}</TableCell>
                    <TableCell>{e.docNo}</TableCell>
                    <TableCell>{e.section}</TableCell>
                    <TableCell className="font-mono">{fmt(e.grossAmount)}</TableCell>
                    <TableCell>{e.tdsPct}%</TableCell>
                    <TableCell className="font-mono text-blue-700">{fmt(e.tdsAmount)}</TableCell>
                    <TableCell className={e.challan ? 'text-xs font-mono' : 'text-xs text-amber-700'}>
                      {e.challan ? challanLabel(e.challan) : (hi ? 'चालान नहीं जुड़ा' : 'Not linked')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

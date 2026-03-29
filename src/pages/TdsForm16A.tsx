import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmt = (n: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

function fyBounds(fy: string) {
  const [startYear] = fy.split('-').map(Number);
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` };
}

interface TdsEntry {
  purchaseId: string;
  date: string;
  supplierName: string;
  supplierId?: string;
  grossAmount: number;
  tdsPct: number;
  tdsAmount: number;
  netAmount: number;
}

export default function TdsForm16A() {
  const { purchases, society } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';

  const [selectedFY, setSelectedFY] = useState(society.financialYear);
  const [deductorName, setDeductorName] = useState(society.name);
  const [deductorPan, setDeductorPan] = useState('');
  const [deductorTan, setDeductorTan] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('__all__');

  const { from, to } = fyBounds(selectedFY);

  const tdsEntries: TdsEntry[] = useMemo(() => {
    return purchases
      .filter(p =>
        !(p as any).isDeleted &&
        p.date >= from && p.date <= to &&
        p.tdsAmount > 0
      )
      .map(p => ({
        purchaseId: p.id,
        date: p.date,
        supplierName: p.supplierName,
        supplierId: p.supplierId,
        grossAmount: p.netAmount,
        tdsPct: p.tdsPct,
        tdsAmount: p.tdsAmount,
        netAmount: p.grandTotal,
      }));
  }, [purchases, from, to]);

  // Group by supplier
  const supplierMap = useMemo(() => {
    const map: Record<string, TdsEntry[]> = {};
    for (const e of tdsEntries) {
      if (!map[e.supplierName]) map[e.supplierName] = [];
      map[e.supplierName].push(e);
    }
    return map;
  }, [tdsEntries]);

  const uniqueSuppliers = Object.keys(supplierMap).sort();
  const filtered = (filterSupplier && filterSupplier !== '__all__') ? supplierMap[filterSupplier] || [] : tdsEntries;

  const totalTds = filtered.reduce((s, e) => s + e.tdsAmount, 0);
  const totalGross = filtered.reduce((s, e) => s + e.grossAmount, 0);

  const handlePDF = (supplierName?: string) => {
    const entries = supplierName ? (supplierMap[supplierName] || []) : tdsEntries;
    if (entries.length === 0) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const w = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(14);
    doc.text('FORM 16A', w / 2, 14, { align: 'center' });
    doc.setFontSize(10);
    doc.text(hi ? 'स्रोत पर कर कटौती का प्रमाण पत्र (TDS)' : 'Certificate of Tax Deducted at Source (TDS)', w / 2, 21, { align: 'center' });
    doc.text(`[${hi ? 'आयकर अधिनियम, 1961 की धारा 203 के अंतर्गत' : 'Under Section 203 of Income Tax Act, 1961'}]`, w / 2, 27, { align: 'center' });

    doc.line(14, 30, w - 14, 30);

    // Deductor Info
    doc.setFontSize(9);
    doc.text(`${hi ? 'कटौतीकर्ता का नाम' : 'Name of Deductor'}: ${deductorName}`, 14, 36);
    doc.text(`TAN: ${deductorTan || '____________'}   PAN: ${deductorPan || '____________'}`, 14, 42);
    doc.text(`${hi ? 'वित्तीय वर्ष' : 'Financial Year'}: ${selectedFY}`, 14, 48);

    if (supplierName) {
      const totalDedGross = entries.reduce((s, e) => s + e.grossAmount, 0);
      const totalDedTds = entries.reduce((s, e) => s + e.tdsAmount, 0);
      doc.line(14, 51, w - 14, 51);
      doc.text(`${hi ? 'कटौती प्राप्तकर्ता' : 'Deductee'}: ${supplierName}`, 14, 57);
      doc.text(`${hi ? 'कुल भुगतान' : 'Total Payment'}: ${fmt(totalDedGross)}   ${hi ? 'कुल TDS' : 'Total TDS'}: ${fmt(totalDedTds)}`, 14, 63);

      autoTable(doc, {
        startY: 68,
        head: [['#', hi ? 'तिथि' : 'Date', hi ? 'विवरण' : 'Particulars', hi ? 'सकल राशि' : 'Gross Amount', 'TDS %', 'TDS']],
        body: entries.map((e, i) => [i + 1, e.date, `Purchase #${e.purchaseId.slice(-6)}`, e.grossAmount.toFixed(2), `${e.tdsPct}%`, e.tdsAmount.toFixed(2)]),
        foot: [['', '', hi ? 'कुल' : 'Total', totalDedGross.toFixed(2), '', totalDedTds.toFixed(2)]],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
        footStyles: { fontStyle: 'bold' },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.text(hi ? 'कटौतीकर्ता का हस्ताक्षर' : 'Signature of Deductor', 14, finalY + 10);
      doc.text('__________________________', 14, finalY + 16);
      doc.text(deductorName, 14, finalY + 22);
      doc.text(`${hi ? 'पद' : 'Designation'}: _______________________`, 14, finalY + 28);
    } else {
      // Summary for all suppliers
      autoTable(doc, {
        startY: 55,
        head: [['#', hi ? 'आपूर्तिकर्ता' : 'Supplier', hi ? 'लेनदेन' : 'Transactions', hi ? 'सकल भुगतान' : 'Gross Amount', 'TDS %', hi ? 'TDS राशि' : 'TDS Amount']],
        body: uniqueSuppliers.map((s, i) => {
          const es = supplierMap[s];
          const gross = es.reduce((x, e) => x + e.grossAmount, 0);
          const tds = es.reduce((x, e) => x + e.tdsAmount, 0);
          const avgPct = gross > 0 ? (tds / gross) * 100 : 0;
          return [i + 1, s, es.length, gross.toFixed(2), `${avgPct.toFixed(1)}%`, tds.toFixed(2)];
        }),
        foot: [['', hi ? 'कुल' : 'Total', tdsEntries.length, totalGross.toFixed(2), '', totalTds.toFixed(2)]],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
        footStyles: { fontStyle: 'bold' },
      });
    }

    doc.save(`form16a-${supplierName ? supplierName.replace(/\s+/g, '-') : 'all'}-${selectedFY}.pdf`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'TDS प्रमाणपत्र — Form 16A' : 'TDS Certificate — Form 16A'}</h1>
          <p className="text-muted-foreground text-sm">{hi ? 'स्रोत पर कर कटौती का विवरण और प्रमाण पत्र' : 'Tax Deducted at Source details and certificate'}</p>
        </div>
        <Button onClick={() => handlePDF()} variant="outline">
          <Download className="h-4 w-4 mr-2" />{hi ? 'सारांश PDF' : 'Summary PDF'}
        </Button>
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
                {['2022-23', '2023-24', '2024-25', '2025-26'].map(fy => (
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
          <p className="text-xs text-muted-foreground">{hi ? 'आपूर्तिकर्ता' : 'Suppliers'}</p>
          <p className="font-bold">{uniqueSuppliers.length}</p>
        </CardContent></Card>
      </div>

      {/* Supplier-wise summary */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">{hi ? 'आपूर्तिकर्ता-वार TDS सारांश' : 'Supplier-wise TDS Summary'}</CardTitle>
          <Select value={filterSupplier} onValueChange={setFilterSupplier}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={hi ? 'सभी आपूर्तिकर्ता' : 'All Suppliers'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{hi ? 'सभी' : 'All'}</SelectItem>
              {uniqueSuppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{hi ? 'आपूर्तिकर्ता' : 'Supplier'}</TableHead>
                <TableHead className="text-right">{hi ? 'लेनदेन' : 'Trans.'}</TableHead>
                <TableHead className="text-right">{hi ? 'सकल राशि' : 'Gross Amt'}</TableHead>
                <TableHead className="text-right">TDS %</TableHead>
                <TableHead className="text-right">{hi ? 'TDS राशि' : 'TDS Amt'}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {uniqueSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {hi ? 'TDS वाला कोई खरीद नहीं मिला' : 'No purchases with TDS found for this period'}
                  </TableCell>
                </TableRow>
              ) : uniqueSuppliers.map(s => {
                const es = supplierMap[s];
                const gross = es.reduce((x, e) => x + e.grossAmount, 0);
                const tds = es.reduce((x, e) => x + e.tdsAmount, 0);
                const avgPct = gross > 0 ? (tds / gross) * 100 : 0;
                return (
                  <TableRow key={s}>
                    <TableCell className="font-medium">{s}</TableCell>
                    <TableCell className="text-right">{es.length}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(gross)}</TableCell>
                    <TableCell className="text-right">{avgPct.toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono font-semibold text-blue-700">{fmt(tds)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => handlePDF(s)}>
                        <FileText className="h-4 w-4 mr-1" />16A
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {uniqueSuppliers.length > 0 && (
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
          <CardHeader><CardTitle className="text-base">{filterSupplier} — {hi ? 'लेनदेन विवरण' : 'Transaction Details'}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                  <TableHead>{hi ? 'सकल राशि' : 'Gross'}</TableHead>
                  <TableHead>TDS %</TableHead>
                  <TableHead>{hi ? 'TDS' : 'TDS'}</TableHead>
                  <TableHead>{hi ? 'शुद्ध' : 'Net'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(e => (
                  <TableRow key={e.purchaseId}>
                    <TableCell>{e.date}</TableCell>
                    <TableCell className="font-mono">{fmt(e.grossAmount)}</TableCell>
                    <TableCell>{e.tdsPct}%</TableCell>
                    <TableCell className="font-mono text-blue-700">{fmt(e.tdsAmount)}</TableCell>
                    <TableCell className="font-mono">{fmt(e.netAmount)}</TableCell>
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

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeftRight, Download, FileSpreadsheet } from 'lucide-react';
import { generateReceiptsPaymentsPDF } from '@/lib/pdf';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';

const ReceiptsPayments: React.FC = () => {
  const { language } = useLanguage();
  const { getReceiptsPayments, society } = useData();

  const fmt = (amount: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

  const data = getReceiptsPayments();
  const { openingCash, openingBank, receipts, payments, closingCash, closingBank } = data;

  const totalReceipts = receipts.reduce((s, r) => s + r.amount, 0);
  const totalPayments = payments.reduce((s, p) => s + p.amount, 0);

  const drTotal = openingCash + openingBank + totalReceipts;
  const crTotal = totalPayments + closingCash + closingBank;

  // P5-3: Previous year comparison
  const pyRP = society.previousYearRP;
  const hasPY = !!pyRP && !!society.previousFinancialYear;
  const pyLabel = society.previousFinancialYear || '';
  const getPYReceipt = (name: string) => pyRP?.receipts.find(r => r.accountName === name)?.amount ?? 0;
  const getPYPayment = (name: string) => pyRP?.payments.find(p => p.accountName === name)?.amount ?? 0;
  const pyDrTotal = hasPY ? (pyRP!.openingCash + pyRP!.openingBank + pyRP!.totalReceipts) : 0;
  const pyCrTotal = hasPY ? (pyRP!.totalPayments + pyRP!.closingCash + pyRP!.closingBank) : 0;

  const hi = language === 'hi';

  const exportHeaders = ['Type', 'Particulars', 'Amount (₹)'];
  const exportRows = (): (string | number)[][] => {
    const rows: (string | number)[][] = [];
    rows.push(['Receipt', 'Opening Balance — Cash in Hand', openingCash]);
    rows.push(['Receipt', 'Opening Balance — Cash at Bank', openingBank]);
    receipts.forEach(r => rows.push(['Receipt', r.accountName, r.amount]));
    rows.push(['Receipt', 'Total Receipts (Dr)', drTotal]);
    payments.forEach(p => rows.push(['Payment', p.accountName, p.amount]));
    rows.push(['Payment', 'Closing Balance — Cash in Hand', closingCash]);
    rows.push(['Payment', 'Closing Balance — Cash at Bank', closingBank]);
    rows.push(['Payment', 'Total Payments (Cr)', crTotal]);
    return rows;
  };

  const handleCSV = () => downloadCSV(exportHeaders, exportRows(), `receipts-payments-${society.financialYear}`);
  const handleExcel = () => downloadExcelSingle(exportHeaders, exportRows(), `receipts-payments-${society.financialYear}`, 'Receipts & Payments');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ArrowLeftRight className="h-7 w-7 text-primary" />
            {hi ? 'प्राप्ति एवं भुगतान खाता' : 'Receipts & Payments Account'}
          </h1>
          <p className="text-muted-foreground">
            {hi
              ? `वित्तीय वर्ष ${society.financialYear} के लिए`
              : `For the Financial Year ${society.financialYear}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => generateReceiptsPaymentsPDF(data, society)}>
            <Download className="h-4 w-4" />PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExcel}>
            <FileSpreadsheet className="h-4 w-4" />Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV}>
            <FileSpreadsheet className="h-4 w-4" />CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-success/10 border-success/20">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{hi ? 'कुल प्राप्तियां' : 'Total Receipts'}</p>
            <p className="text-2xl font-bold text-success">{fmt(totalReceipts)}</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{hi ? 'कुल भुगतान' : 'Total Payments'}</p>
            <p className="text-2xl font-bold text-destructive">{fmt(totalPayments)}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{hi ? 'अंतिम शेष (नकद+बैंक)' : 'Closing Balance (Cash+Bank)'}</p>
            <p className="text-2xl font-bold text-primary">{fmt(closingCash + closingBank)}</p>
          </CardContent>
        </Card>
      </div>

      {/* T-Account format */}
      <Card className="shadow-card">
        <CardHeader className="border-b text-center">
          <CardTitle className="text-xl">
            {hi ? 'प्राप्ति एवं भुगतान खाता' : 'Receipts & Payments Account'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{hi ? society.nameHi : society.name}</p>
          <p className="text-sm text-muted-foreground">
            {hi
              ? `वित्तीय वर्ष ${society.financialYear} के लिए`
              : `For the Financial Year ${society.financialYear}`}
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dr side — Opening Balance + Receipts */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-success pb-2 border-b flex items-center gap-2">
                {hi ? 'Dr. — प्राप्तियां' : 'Dr. — Receipts'}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'विवरण' : 'Particulars'}</TableHead>
                    {hasPY && <TableHead className="text-right text-muted-foreground text-xs">{pyLabel}</TableHead>}
                    <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Opening Balance */}
                  <TableRow className="bg-muted/30 font-medium">
                    <TableCell>{hi ? 'प्रारंभिक शेष (To Balance b/d)' : 'To Balance b/d (Opening)'}</TableCell>
                    {hasPY && <TableCell className="text-right text-muted-foreground text-sm">—</TableCell>}
                    <TableCell className="text-right"></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-6 text-muted-foreground">{hi ? 'नकद' : 'Cash in Hand'}</TableCell>
                    {hasPY && <TableCell className="text-right text-muted-foreground text-sm">{fmt(pyRP!.openingCash)}</TableCell>}
                    <TableCell className="text-right">{fmt(openingCash)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-6 text-muted-foreground">{hi ? 'बैंक' : 'Cash at Bank'}</TableCell>
                    {hasPY && <TableCell className="text-right text-muted-foreground text-sm">{fmt(pyRP!.openingBank)}</TableCell>}
                    <TableCell className="text-right">{fmt(openingBank)}</TableCell>
                  </TableRow>
                  {/* Receipts */}
                  {receipts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={hasPY ? 3 : 2} className="text-center text-muted-foreground">
                        {hi ? 'कोई प्राप्ति नहीं' : 'No receipts'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    receipts.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>To {r.accountName}</TableCell>
                        {hasPY && <TableCell className="text-right text-muted-foreground text-sm">{getPYReceipt(r.accountName) ? fmt(getPYReceipt(r.accountName)) : '—'}</TableCell>}
                        <TableCell className="text-right font-medium">{fmt(r.amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  {/* Total */}
                  <TableRow className="bg-success/10 font-bold text-lg">
                    <TableCell>{hi ? 'कुल' : 'Total'}</TableCell>
                    {hasPY && <TableCell className="text-right text-muted-foreground">{fmt(pyDrTotal)}</TableCell>}
                    <TableCell className="text-right text-success">{fmt(drTotal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Cr side — Payments + Closing Balance */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-destructive pb-2 border-b flex items-center gap-2">
                {hi ? 'Cr. — भुगतान' : 'Cr. — Payments'}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'विवरण' : 'Particulars'}</TableHead>
                    {hasPY && <TableHead className="text-right text-muted-foreground text-xs">{pyLabel}</TableHead>}
                    <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Payments */}
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={hasPY ? 3 : 2} className="text-center text-muted-foreground">
                        {hi ? 'कोई भुगतान नहीं' : 'No payments'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>By {p.accountName}</TableCell>
                        {hasPY && <TableCell className="text-right text-muted-foreground text-sm">{getPYPayment(p.accountName) ? fmt(getPYPayment(p.accountName)) : '—'}</TableCell>}
                        <TableCell className="text-right font-medium">{fmt(p.amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  {/* Closing Balance */}
                  <TableRow className="bg-muted/30 font-medium">
                    <TableCell>{hi ? 'अंतिम शेष (By Balance c/d)' : 'By Balance c/d (Closing)'}</TableCell>
                    {hasPY && <TableCell className="text-right text-muted-foreground text-sm">—</TableCell>}
                    <TableCell className="text-right"></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-6 text-muted-foreground">{hi ? 'नकद' : 'Cash in Hand'}</TableCell>
                    {hasPY && <TableCell className="text-right text-muted-foreground text-sm">{fmt(pyRP!.closingCash)}</TableCell>}
                    <TableCell className="text-right">{fmt(closingCash)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-6 text-muted-foreground">{hi ? 'बैंक' : 'Cash at Bank'}</TableCell>
                    {hasPY && <TableCell className="text-right text-muted-foreground text-sm">{fmt(pyRP!.closingBank)}</TableCell>}
                    <TableCell className="text-right">{fmt(closingBank)}</TableCell>
                  </TableRow>
                  {/* Total */}
                  <TableRow className="bg-destructive/10 font-bold text-lg">
                    <TableCell>{hi ? 'कुल' : 'Total'}</TableCell>
                    {hasPY && <TableCell className="text-right text-muted-foreground">{fmt(pyCrTotal)}</TableCell>}
                    <TableCell className="text-right text-destructive">{fmt(crTotal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Verification */}
          <div className="mt-6 p-4 rounded-lg bg-muted/50 text-center">
            <div className="flex justify-center gap-8 flex-wrap text-sm">
              <div>
                <span className="text-muted-foreground">{hi ? 'Dr कुल' : 'Dr Total'}:</span>{' '}
                <span className="font-bold">{fmt(drTotal)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{hi ? 'Cr कुल' : 'Cr Total'}:</span>{' '}
                <span className="font-bold">{fmt(crTotal)}</span>
              </div>
              <div className={Math.abs(drTotal - crTotal) < 1 ? 'text-success' : 'text-destructive'}>
                <span className="font-bold">
                  {Math.abs(drTotal - crTotal) < 1
                    ? (hi ? '✓ संतुलित' : '✓ Balanced')
                    : (hi ? '✗ असंतुलित' : '✗ Not Balanced')}
                </span>
              </div>
            </div>
          </div>

          {/* Signature */}
          <div className="mt-8 pt-8 border-t grid grid-cols-3 gap-4 text-center text-sm">
            {[
              hi ? 'लेखाकार' : 'Accountant',
              hi ? 'सचिव' : 'Secretary',
              hi ? 'अध्यक्ष' : 'Chairman',
            ].map(label => (
              <div key={label}>
                <div className="h-16 border-b border-dashed border-muted-foreground/30 mb-2" />
                <p className="font-medium">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReceiptsPayments;

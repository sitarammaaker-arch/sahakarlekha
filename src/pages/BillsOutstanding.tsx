/**
 * बकाया बिल / Bills Outstanding (Ageing) — Tally-style Receivables & Payables report.
 * Lists every open credit bill (sale = receivable, purchase = payable) with its age in
 * days and ageing bucket, plus unallocated advance / on-account balances per party.
 * Balances are DERIVED from active bill-allocations (lib/billUtils) — single source of truth.
 */
import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, Download, FileSpreadsheet } from 'lucide-react';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { fmtDate } from '@/lib/dateUtils';
import {
  getOpenBills, getOpenPurchaseBills, getPartyUnallocated, bucketByAge, ageInDays,
} from '@/lib/billUtils';

const today = () => new Date().toISOString().split('T')[0];
const fmt = (n: number) => 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

interface Row { party: string; no: string; date: string; balance: number; days: number; }

const BillsOutstanding: React.FC = () => {
  const { language } = useLanguage();
  const { society, customers, suppliers, sales, purchases, vouchers } = useData();
  const hi = language === 'hi';

  const [asOf, setAsOf] = useState(today());
  const [tab, setTab] = useState<'receivable' | 'payable'>('receivable');
  const [partyFilter, setPartyFilter] = useState('');

  const receivableRows = useMemo<Row[]>(() => {
    const rows: Row[] = [];
    for (const c of customers) {
      for (const { sale, balance } of getOpenBills(sales, vouchers, c.id)) {
        rows.push({ party: c.name, no: sale.saleNo, date: sale.date, balance, days: ageInDays(sale.date, asOf) });
      }
    }
    return rows.sort((a, b) => b.days - a.days);
  }, [customers, sales, vouchers, asOf]);

  const payableRows = useMemo<Row[]>(() => {
    const rows: Row[] = [];
    for (const s of suppliers) {
      for (const { purchase, balance } of getOpenPurchaseBills(purchases, vouchers, s.id)) {
        rows.push({ party: s.name, no: purchase.purchaseNo, date: purchase.date, balance, days: ageInDays(purchase.date, asOf) });
      }
    }
    return rows.sort((a, b) => b.days - a.days);
  }, [suppliers, purchases, vouchers, asOf]);

  // Unallocated advance / on-account held across all parties (this tab's side).
  const advanceTotal = useMemo(() => {
    const refType = tab === 'receivable' ? 'bill-receipt' : 'bill-payment';
    const parties = tab === 'receivable' ? customers : suppliers;
    return parties.reduce((s, p) => s + getPartyUnallocated(vouchers, refType, p.id), 0);
  }, [tab, customers, suppliers, vouchers]);

  const rows = tab === 'receivable' ? receivableRows : payableRows;
  const filtered = useMemo(
    () => rows.filter(r => !partyFilter || r.party.toLowerCase().includes(partyFilter.toLowerCase())),
    [rows, partyFilter],
  );
  const buckets = useMemo(() => bucketByAge(filtered.map(r => ({ date: r.date, balance: r.balance })), asOf), [filtered, asOf]);

  const bucketLabel = (days: number) => days <= 30 ? '0–30' : days <= 60 ? '31–60' : days <= 90 ? '61–90' : '90+';
  const bucketCls = (days: number) => days <= 30 ? 'text-success' : days <= 60 ? 'text-amber-700' : days <= 90 ? 'text-orange-600' : 'text-destructive';

  const headers = ['Party', 'Bill No', 'Date', 'Days', 'Bucket', 'Balance'];
  const csvRows = () => filtered.map(r => [r.party, r.no, fmtDate(r.date), r.days, bucketLabel(r.days), r.balance]);
  const fileBase = `${tab === 'receivable' ? 'receivables' : 'payables'}-ageing-${asOf}`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg"><Clock className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{hi ? 'बकाया बिल (Ageing)' : 'Bills Outstanding (Ageing)'}</h1>
            <p className="text-sm text-muted-foreground">{hi ? 'बिल-वार वसूली योग्य व देय राशि, उम्र सहित' : 'Bill-wise receivables & payables with ageing'}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadExcelSingle(headers, csvRows(), fileBase, tab === 'receivable' ? 'Receivables' : 'Payables')}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadCSV(headers, csvRows(), fileBase)}><Download className="h-4 w-4" />CSV</Button>
        </div>
      </div>

      {/* Tabs + controls */}
      <Card>
        <CardContent className="pt-4 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex rounded-lg border overflow-hidden">
            <button onClick={() => setTab('receivable')} className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'receivable' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
              {hi ? 'वसूली योग्य (ग्राहक)' : 'Receivables (Customers)'}
            </button>
            <button onClick={() => setTab('payable')} className={`px-4 py-2 text-sm font-medium transition-colors border-l ${tab === 'payable' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
              {hi ? 'देय (आपूर्तिकर्ता)' : 'Payables (Suppliers)'}
            </button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{hi ? 'इस तिथि तक' : 'As of date'}</Label>
            <Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="h-9 w-44" />
          </div>
          <div className="space-y-1 flex-1">
            <Label className="text-xs">{hi ? 'पार्टी खोजें' : 'Search party'}</Label>
            <Input value={partyFilter} onChange={e => setPartyFilter(e.target.value)} className="h-9" placeholder={hi ? 'नाम...' : 'Name...'} />
          </div>
        </CardContent>
      </Card>

      {/* Ageing summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: '0–30', value: buckets.b0_30, color: 'text-success' },
          { label: '31–60', value: buckets.b31_60, color: 'text-amber-700' },
          { label: '61–90', value: buckets.b61_90, color: 'text-orange-600' },
          { label: '90+', value: buckets.b90plus, color: 'text-destructive' },
          { label: hi ? 'कुल बकाया' : 'Total', value: buckets.total, color: 'text-primary' },
        ].map(c => (
          <Card key={c.label}><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">{c.label} {c.label !== (hi ? 'कुल बकाया' : 'Total') ? (hi ? 'दिन' : 'days') : ''}</p><p className={`text-lg font-bold ${c.color}`}>{fmt(c.value)}</p></CardContent></Card>
        ))}
      </div>

      {advanceTotal > 0.01 && (
        <div className="text-sm text-muted-foreground">
          {hi ? 'बिना बिल अग्रिम / On-Account (इस पक्ष में): ' : 'Unallocated advance / on-account (this side): '}
          <span className="font-semibold text-foreground">{fmt(advanceTotal)}</span>
        </div>
      )}

      {/* Table */}
      <Card className="shadow-card">
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-base">{tab === 'receivable' ? (hi ? 'वसूली योग्य बिल' : 'Receivable Bills') : (hi ? 'देय बिल' : 'Payable Bills')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{hi ? 'कोई बकाया बिल नहीं 🎉' : 'No outstanding bills 🎉'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'पार्टी' : 'Party'}</TableHead>
                    <TableHead>{hi ? 'बिल नं' : 'Bill No'}</TableHead>
                    <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                    <TableHead className="text-right">{hi ? 'दिन' : 'Days'}</TableHead>
                    <TableHead className="text-center">{hi ? 'आयु-वर्ग' : 'Bucket'}</TableHead>
                    <TableHead className="text-right">{hi ? 'बकाया' : 'Balance'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r, i) => (
                    <TableRow key={`${r.no}-${i}`} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{r.party}</TableCell>
                      <TableCell className="font-mono text-xs">{r.no}</TableCell>
                      <TableCell>{fmtDate(r.date)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.days}</TableCell>
                      <TableCell className={`text-center text-xs font-medium ${bucketCls(r.days)}`}>{bucketLabel(r.days)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-amber-700">{fmt(r.balance)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell colSpan={5}>{hi ? 'कुल' : 'Total'}</TableCell>
                    <TableCell className="text-right">{fmt(buckets.total)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BillsOutstanding;

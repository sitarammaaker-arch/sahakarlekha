import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useConsumerData } from '@/contexts/ConsumerDataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { FileSpreadsheet, Download } from 'lucide-react';
import { buildCounterSummary, buildOutstandingRegister } from '@/lib/consumer/registers';
import { downloadCSV } from '@/lib/exportUtils';
import { cn } from '@/lib/utils';

const TODAY = () => new Date().toISOString().split('T')[0];
const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

const ConsumerRegisters: React.FC = () => {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { sales, members, society } = useData();
  const { memberRecoveries } = useConsumerData();

  const [from, setFrom] = useState(TODAY());
  const [to, setTo] = useState(TODAY());
  const [asOf, setAsOf] = useState(TODAY());

  const summary = useMemo(() => buildCounterSummary(sales, from, to), [sales, from, to]);
  const recoveryRows = useMemo(() => memberRecoveries.map(v => ({ memberId: v.memberId, amount: v.amount, isDeleted: v.isDeleted })), [memberRecoveries]);
  const register = useMemo(() => buildOutstandingRegister(members, sales, recoveryRows, asOf), [members, sales, recoveryRows, asOf]);

  const exportSummary = () => {
    const headers = ['Tender', 'Bills', 'Amount'];
    const rows: (string | number)[][] = [
      [hi ? 'Cash' : 'Cash', summary.tenders.cash.count, summary.tenders.cash.amount],
      [hi ? 'Bank/UPI' : 'Bank/UPI', summary.tenders.bank.count, summary.tenders.bank.amount],
      [hi ? 'Credit' : 'Credit', summary.tenders.credit.count, summary.tenders.credit.amount],
      ['Total', summary.count, summary.total],
    ];
    downloadCSV(headers, rows, `counter-summary-${from}_${to}.csv`);
  };
  const exportRegister = () => {
    const headers = ['Member', 'Outstanding', '0-30', '31-60', '61-90', '90+'];
    const rows = register.rows.map(r => [r.memberName, r.outstanding, r.ageing.b0_30, r.ageing.b31_60, r.ageing.b61_90, r.ageing.b90plus]);
    downloadCSV(headers, rows, `member-outstanding-${asOf}.csv`);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-100 rounded-lg"><FileSpreadsheet className="h-6 w-6 text-emerald-700" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{hi ? 'उपभोक्ता रजिस्टर' : 'Consumer Registers'}</h1>
          <p className="text-sm text-gray-500">{society.name}</p>
        </div>
      </div>

      <Tabs defaultValue="counter">
        <TabsList>
          <TabsTrigger value="counter">{hi ? 'काउंटर सारांश' : 'Counter Summary'}</TabsTrigger>
          <TabsTrigger value="outstanding">{hi ? 'बकाया रजिस्टर' : 'Outstanding Register'}</TabsTrigger>
        </TabsList>

        {/* Counter Z-report */}
        <TabsContent value="counter" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="space-y-1"><Label>{hi ? 'तिथि से' : 'From'}</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
              <div className="space-y-1"><Label>{hi ? 'तिथि तक' : 'To'}</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
              <Button variant="outline" className="gap-1" onClick={exportSummary}><Download className="h-4 w-4" />CSV</Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">{hi ? 'कुल बिक्री' : 'Total Sales'}</p><p className="text-2xl font-bold text-emerald-700">{fmt(summary.total)}</p><p className="text-xs text-gray-400">{summary.count} {hi ? 'बिल' : 'bills'}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">{hi ? 'नकद' : 'Cash'}</p><p className="text-xl font-bold">{fmt(summary.tenders.cash.amount)}</p><p className="text-xs text-gray-400">{summary.tenders.cash.count}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">{hi ? 'बैंक / UPI' : 'Bank / UPI'}</p><p className="text-xl font-bold">{fmt(summary.tenders.bank.amount)}</p><p className="text-xs text-gray-400">{summary.tenders.bank.count}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">{hi ? 'उधार' : 'Credit'}</p><p className="text-xl font-bold text-orange-700">{fmt(summary.tenders.credit.amount)}</p><p className="text-xs text-gray-400">{summary.tenders.credit.count}</p></CardContent></Card>
          </div>
        </TabsContent>

        {/* Outstanding register */}
        <TabsContent value="outstanding" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-4 flex flex-wrap gap-3 items-end justify-between">
              <div className="space-y-1"><Label>{hi ? 'तिथि तक (ageing)' : 'As of (ageing)'}</Label><Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="w-44" /></div>
              <div className="text-right">
                <p className="text-xs text-gray-500">{hi ? 'कुल बकाया' : 'Total Outstanding'}</p>
                <p className="text-2xl font-bold text-orange-700">{fmt(register.totalOutstanding)}</p>
              </div>
              <Button variant="outline" className="gap-1" onClick={exportRegister}><Download className="h-4 w-4" />CSV</Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'सदस्य' : 'Member'}</TableHead>
                    <TableHead className="text-right">{hi ? 'बकाया' : 'Outstanding'}</TableHead>
                    <TableHead className="text-right">0–30</TableHead>
                    <TableHead className="text-right">31–60</TableHead>
                    <TableHead className="text-right">61–90</TableHead>
                    <TableHead className="text-right">90+</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {register.rows.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">{hi ? 'कोई बकाया नहीं' : 'No outstanding credit'}</TableCell></TableRow>
                  ) : (
                    <>
                      {register.rows.map(r => (
                        <TableRow key={r.memberId}>
                          <TableCell className="font-medium">{r.memberName}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(r.outstanding)}</TableCell>
                          <TableCell className="text-right">{r.ageing.b0_30 ? fmt(r.ageing.b0_30) : '—'}</TableCell>
                          <TableCell className="text-right">{r.ageing.b31_60 ? fmt(r.ageing.b31_60) : '—'}</TableCell>
                          <TableCell className="text-right">{r.ageing.b61_90 ? fmt(r.ageing.b61_90) : '—'}</TableCell>
                          <TableCell className={cn('text-right', r.ageing.b90plus > 0 && 'text-red-600 font-semibold')}>{r.ageing.b90plus ? fmt(r.ageing.b90plus) : '—'}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2 bg-gray-50">
                        <TableCell className="font-bold">{hi ? 'कुल' : 'Total'}</TableCell>
                        <TableCell className="text-right font-bold">{fmt(register.totalOutstanding)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(register.totalAgeing.b0_30)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(register.totalAgeing.b31_60)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(register.totalAgeing.b61_90)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(register.totalAgeing.b90plus)}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConsumerRegisters;

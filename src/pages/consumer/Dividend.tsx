import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useConsumerData } from '@/contexts/ConsumerDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Landmark, Trash2, CheckCircle2, AlertTriangle, Wallet } from 'lucide-react';
import { downloadCSV } from '@/lib/exportUtils';
import { fmtDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

const TODAY = () => new Date().toISOString().split('T')[0];
const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

const Dividend: React.FC = () => {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { society, getProfitLoss } = useData();
  const { patronageRuns, createDividendRun, approvePatronageRun, recordPatronagePayment, deletePatronageRun } = useConsumerData();

  const [ratePct, setRatePct] = useState<number>(0);
  const [fyLabel, setFyLabel] = useState((society as { financialYear?: string })?.financialYear || '');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolutionNo, setResolutionNo] = useState('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMode, setPayMode] = useState<'cash' | 'bank'>('cash');
  const [payDate, setPayDate] = useState(TODAY());

  const runs = useMemo(() => patronageRuns.filter(r => !r.isDeleted && r.kind === 'dividend').sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [patronageRuns]);
  const selected = selectedId ? runs.find(r => r.id === selectedId) : undefined;
  const netProfit = useMemo(() => { try { return getProfitLoss().netProfit; } catch { return 0; } }, [getProfitLoss]);

  const handleCreate = () => {
    const run = createDividendRun({ ratePct, fyLabel: fyLabel.trim() || undefined });
    if (run) { setSelectedId(run.id); setResolutionNo(''); }
  };
  const handleApprove = () => { if (selected) { const r = approvePatronageRun({ runId: selected.id, resolutionNo, resolutionDate: TODAY() }); if (r) setResolutionNo(''); } };
  const handlePay = () => { if (selected) { const v = recordPatronagePayment({ runId: selected.id, amount: payAmount, mode: payMode, date: payDate }); if (v) setPayAmount(0); } };
  const exportLines = () => {
    if (!selected) return;
    downloadCSV(['Member', 'Share Capital', 'Dividend'], selected.lines.map(l => [l.memberName, l.base, l.amount]), `dividend-${selected.fyLabel || selected.createdAt.slice(0, 10)}.csv`);
  };

  const outstanding = selected ? +(selected.total - selected.amountPaid).toFixed(2) : 0;
  const overSurplus = selected && selected.status === 'draft' && netProfit > 0 && selected.total > netProfit;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-lg"><Landmark className="h-6 w-6 text-indigo-700" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{hi ? 'लाभांश (Dividend)' : 'Dividend'}</h1>
          <p className="text-sm text-gray-500">{society.name}</p>
        </div>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        {hi
          ? 'सदस्यों को उनकी चुकता शेयर पूंजी पर लाभांश। शुद्ध अधिशेष में से, सभा/बोर्ड प्रस्ताव पर ही स्वीकृत करें (उपनियम की दर-सीमा का ध्यान रखें)।'
          : 'Dividend to members on their paid-up share capital. Distribute only from net surplus, by resolution (mind the bye-law rate cap).'}
      </div>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">{hi ? 'नया लाभांश रन' : 'New Dividend Run'}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-1"><Label>{hi ? 'वित्तीय वर्ष' : 'FY Label'}</Label><Input value={fyLabel} onChange={e => setFyLabel(e.target.value)} placeholder="2025-26" /></div>
          <div className="space-y-1"><Label>{hi ? 'लाभांश दर %' : 'Dividend %'}</Label><Input type="number" min={0} step={0.1} value={ratePct} onChange={e => setRatePct(Math.max(0, Number(e.target.value)))} /></div>
          <Button onClick={handleCreate} className="gap-1"><Landmark className="h-4 w-4" />{hi ? 'ड्राफ्ट बनाएँ' : 'Create Draft'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{hi ? 'वित्तीय वर्ष' : 'FY'}</TableHead>
                <TableHead className="text-center">{hi ? 'सदस्य' : 'Members'}</TableHead>
                <TableHead>{hi ? 'दर' : 'Rate'}</TableHead>
                <TableHead className="text-right">{hi ? 'कुल लाभांश' : 'Total'}</TableHead>
                <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">{hi ? 'कोई लाभांश रन नहीं' : 'No dividend runs'}</TableCell></TableRow>
              ) : runs.map(r => (
                <TableRow key={r.id} className={cn('cursor-pointer', selectedId === r.id && 'bg-indigo-50')} onClick={() => setSelectedId(r.id)}>
                  <TableCell>{r.fyLabel || '—'}</TableCell>
                  <TableCell className="text-center">{r.lines.length}</TableCell>
                  <TableCell>{r.ratePct}%</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(r.total)}</TableCell>
                  <TableCell><Badge variant="outline" className={cn(r.status === 'approved' ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : 'border-amber-400 text-amber-700 bg-amber-50')}>{r.status === 'approved' ? (hi ? 'स्वीकृत' : 'Approved') : (hi ? 'ड्राफ्ट' : 'Draft')}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={(e) => { e.stopPropagation(); deletePatronageRun(r.id); if (selectedId === r.id) setSelectedId(null); }}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">{hi ? 'लाभांश विवरण' : 'Dividend Detail'} — {selected.fyLabel || fmtDate(selected.createdAt.slice(0, 10))}</CardTitle>
            <Button variant="outline" size="sm" onClick={exportLines}>CSV</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {overSurplus && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-800 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {hi ? `कुल लाभांश ${fmt(selected.total)} मौजूदा शुद्ध अधिशेष ${fmt(netProfit)} से अधिक है — फिर भी स्वीकृत किया जा सकता है।` : `Total dividend ${fmt(selected.total)} exceeds current net surplus ${fmt(netProfit)} — approval still allowed.`}
              </div>
            )}

            {selected.status === 'draft' ? (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end p-3 bg-gray-50 rounded-lg">
                <div className="space-y-1 flex-1"><Label>{hi ? 'प्रस्ताव संख्या (आवश्यक)' : 'Resolution No. (required)'}</Label><Input value={resolutionNo} onChange={e => setResolutionNo(e.target.value)} placeholder={hi ? 'सभा प्रस्ताव सं.' : 'GB resolution no.'} /></div>
                <Button onClick={handleApprove} className="gap-1"><CheckCircle2 className="h-4 w-4" />{hi ? 'स्वीकृत करें' : 'Approve'}</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end p-3 bg-emerald-50 rounded-lg">
                <div className="sm:col-span-4 text-sm text-emerald-800">{hi ? 'प्रस्ताव' : 'Resolution'}: <b>{selected.resolutionNo}</b> · {hi ? 'बकाया' : 'Outstanding'}: <b>{fmt(outstanding)}</b></div>
                <div className="space-y-1"><Label>{hi ? 'भुगतान राशि' : 'Pay amount'}</Label><Input type="number" min={0} value={payAmount} onChange={e => setPayAmount(Math.max(0, Number(e.target.value)))} /></div>
                <div className="space-y-1">
                  <Label>{hi ? 'विधि' : 'Mode'}</Label>
                  <div className="flex gap-1">
                    {(['cash', 'bank'] as const).map(md => (
                      <button key={md} type="button" onClick={() => setPayMode(md)} className={cn('flex-1 px-2 py-2 rounded text-xs font-medium border', payMode === md ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-200 text-gray-600')}>{md === 'cash' ? (hi ? 'नकद' : 'Cash') : (hi ? 'बैंक' : 'Bank')}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1"><Label>{hi ? 'तिथि' : 'Date'}</Label><Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} /></div>
                <Button onClick={handlePay} disabled={outstanding <= 0} className="gap-1"><Wallet className="h-4 w-4" />{hi ? 'भुगतान' : 'Pay'}</Button>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'सदस्य' : 'Member'}</TableHead>
                  <TableHead className="text-right">{hi ? 'शेयर पूंजी' : 'Share Capital'}</TableHead>
                  <TableHead className="text-right">{hi ? 'लाभांश' : 'Dividend'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selected.lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>{l.memberName}</TableCell>
                    <TableCell className="text-right text-gray-500">{fmt(l.base)}</TableCell>
                    <TableCell className="text-right font-semibold text-indigo-700">{fmt(l.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2">
                  <TableCell className="font-bold">{hi ? 'कुल' : 'Total'}</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-bold">{fmt(selected.total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dividend;

import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useDairyData } from '@/contexts/DairyDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { downloadCSV } from '@/lib/exportUtils';
import { Gift, Trash2, CheckCircle2, HandCoins, Download } from 'lucide-react';
import type { DairyDistribution, DairyBonusBasis } from '@/types';

const inr = (n: number) => `₹${(Number.isFinite(n) ? n : 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);
const out = (d: DairyDistribution) => Math.max(0, +(d.total - d.amountPaid).toFixed(2));

function DistributionCard({ d }: { d: DairyDistribution }) {
  const { accounts } = useData();
  const { approveDairyDistribution, recordDistributionPayment, deleteDairyDistribution } = useDairyData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const banks = useMemo(() => accounts.filter(a => a.subtype === 'cash_bank' && a.id !== '3301'), [accounts]);
  const isDraft = d.status === 'draft';
  const outstanding = out(d);

  const [resNo, setResNo] = useState('');
  const [resDate, setResDate] = useState(today());
  const [pAmt, setPAmt] = useState('');
  const [pMode, setPMode] = useState<'cash' | 'bank'>('bank');
  const [pBank, setPBank] = useState('');
  const [pDate, setPDate] = useState(today());
  const [showLines, setShowLines] = useState(false);

  const kindLabel = d.kind === 'bonus' ? (hi ? 'बोनस' : 'Bonus') : (hi ? 'लाभांश' : 'Dividend');
  const exportLines = () => downloadCSV(
    [hi ? 'सदस्य' : 'Member', hi ? 'आधार' : 'Base', hi ? 'राशि' : 'Amount'],
    d.lines.map(l => [l.memberName, l.base, l.amount]),
    `${d.kind}-distribution-${d.resolutionNo || d.id.slice(0, 6)}.csv`,
  );

  return (
    <div className="rounded-lg border p-3 space-y-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium flex flex-wrap items-center gap-1">
            <Badge>{kindLabel}</Badge>
            {d.resolutionNo && <Badge variant="outline">{hi ? 'प्रस्ताव' : 'Res'} {d.resolutionNo}</Badge>}
            <Badge variant={isDraft ? 'secondary' : 'default'}>{isDraft ? (hi ? 'ड्राफ्ट' : 'Draft') : (hi ? 'स्वीकृत' : 'Approved')}</Badge>
          </div>
          <div className="text-muted-foreground text-xs">
            {d.kind === 'bonus' ? `${d.from} → ${d.to} · ${d.basis === 'per_value' ? (hi ? 'मूल्य' : 'value') : (hi ? 'प्रति लीटर' : 'per L')} @ ${d.rate}` : `${d.fyLabel || ''} · ${d.rate}% ${hi ? 'शेयर पूंजी पर' : 'of share capital'}`}
          </div>
        </div>
        <Button size="sm" variant="ghost" className="shrink-0" onClick={() => { if (window.confirm(hi ? 'वितरण हटाएँ?' : 'Delete distribution?')) deleteDairyDistribution(d.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div><div className="text-muted-foreground">{hi ? 'सदस्य' : 'Members'}</div><div className="font-medium">{d.lines.length}</div></div>
        <div><div className="text-muted-foreground">{hi ? 'कुल' : 'Total'}</div><div className="font-medium">{inr(d.total)}</div></div>
        <div><div className="text-muted-foreground">{hi ? 'बकाया' : 'Outstanding'}</div><div className="font-medium text-amber-700">{inr(outstanding)}</div></div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowLines(s => !s)}>{showLines ? (hi ? 'सूची छिपाएँ' : 'Hide list') : (hi ? 'सदस्य सूची' : 'Member list')}</Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={exportLines}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
      </div>
      {showLines && (
        <div className="overflow-x-auto max-h-[40vh] border rounded"><Table>
          <TableHeader><TableRow><TableHead>{hi ? 'सदस्य' : 'Member'}</TableHead><TableHead className="text-right">{hi ? 'आधार' : 'Base'}</TableHead><TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead></TableRow></TableHeader>
          <TableBody>{d.lines.map(l => <TableRow key={l.memberId}><TableCell>{l.memberName}</TableCell><TableCell className="text-right">{l.base.toLocaleString('en-IN')}</TableCell><TableCell className="text-right font-medium">{inr(l.amount)}</TableCell></TableRow>)}</TableBody>
        </Table></div>
      )}

      {isDraft && (
        <div className="space-y-2 rounded-md border-dashed border p-2">
          <p className="text-xs font-medium">{hi ? 'प्रस्ताव के साथ स्वीकृत करें (अनिवार्य)' : 'Approve with resolution (mandatory)'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-end">
            <div className="space-y-1"><Label className="text-xs">{hi ? 'प्रस्ताव सं.' : 'Resolution No'} *</Label><Input className="h-8" value={resNo} onChange={e => setResNo(e.target.value)} placeholder={hi ? 'AGM/2026/07' : 'AGM/2026/07'} /></div>
            <div className="space-y-1"><Label className="text-xs">{hi ? 'प्रस्ताव तिथि' : 'Res. date'}</Label><Input type="date" className="h-8" value={resDate} onChange={e => setResDate(e.target.value)} /></div>
            <Button size="sm" disabled={!resNo.trim()} onClick={() => approveDairyDistribution({ distributionId: d.id, resolutionNo: resNo, resolutionDate: resDate })}><CheckCircle2 className="h-4 w-4 mr-1" />{hi ? `स्वीकृत — ${inr(d.total)}` : `Approve — ${inr(d.total)}`}</Button>
          </div>
        </div>
      )}

      {!isDraft && outstanding > 0 && (
        <div className="space-y-2 rounded-md border-dashed border p-2">
          <p className="text-xs font-medium">{hi ? 'भुगतान दर्ज करें' : 'Record payment'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
            <div className="space-y-1"><Label className="text-xs">{hi ? 'राशि' : 'Amount'}</Label><Input type="number" className="h-8" value={pAmt} onChange={e => setPAmt(e.target.value)} placeholder={String(outstanding)} /></div>
            <div className="space-y-1"><Label className="text-xs">{hi ? 'माध्यम' : 'Mode'}</Label>
              <Select value={pMode} onValueChange={v => setPMode(v as 'cash' | 'bank')}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem><SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem></SelectContent></Select></div>
            {pMode === 'bank' && <div className="space-y-1"><Label className="text-xs">{hi ? 'बैंक' : 'Bank'}</Label>
              <Select value={pBank} onValueChange={setPBank}><SelectTrigger className="h-8"><SelectValue placeholder="3302" /></SelectTrigger>
                <SelectContent>{banks.map(a => <SelectItem key={a.id} value={a.id}>{hi ? (a.nameHi || a.name) : (a.name || a.nameHi)}</SelectItem>)}</SelectContent></Select></div>}
            <div className="space-y-1"><Label className="text-xs">{hi ? 'तिथि' : 'Date'}</Label><Input type="date" className="h-8" value={pDate} onChange={e => setPDate(e.target.value)} /></div>
            <Button size="sm" onClick={() => { recordDistributionPayment({ distributionId: d.id, amount: Number(pAmt) || outstanding, mode: pMode, bankAccountId: pMode === 'bank' ? (pBank || undefined) : undefined, date: pDate }); setPAmt(''); }}><HandCoins className="h-4 w-4 mr-1" />{hi ? 'भुगतान' : 'Pay'}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DairyDistribution() {
  const { society } = useData();
  const { distributions, createDairyDistribution } = useDairyData();
  const { language } = useLanguage();
  const hi = language === 'hi';

  const [kind, setKind] = useState<'bonus' | 'dividend'>('bonus');
  const [from, setFrom] = useState(society?.financialYearStart || today());
  const [to, setTo] = useState(society?.financialYearEnd || today());
  const [basis, setBasis] = useState<DairyBonusBasis>('per_litre');
  const [rate, setRate] = useState('');
  const [fyLabel, setFyLabel] = useState(society?.financialYear || '');

  const list = distributions.filter(d => !d.isDeleted).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const create = () => {
    if (kind === 'bonus') createDairyDistribution({ kind: 'bonus', from, to, basis, rate: Number(rate) || 0 });
    else createDairyDistribution({ kind: 'dividend', rate: Number(rate) || 0, fyLabel: fyLabel.trim() || undefined });
    setRate('');
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Gift className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'बोनस व लाभांश वितरण' : 'Bonus & Dividend Distribution'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'वर्षांत — संरक्षण बोनस (दूध-वार) व लाभांश (शेयर-वार), प्रस्ताव-गेटेड' : 'Year-end — patronage bonus (milk) & dividend (shares), resolution-gated'}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नया वितरण (गणना)' : 'New Distribution (compute)'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2"><Label>{hi ? 'प्रकार' : 'Kind'}</Label>
              <Select value={kind} onValueChange={v => setKind(v as 'bonus' | 'dividend')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="bonus">{hi ? 'संरक्षण बोनस' : 'Patronage Bonus'}</SelectItem><SelectItem value="dividend">{hi ? 'लाभांश' : 'Dividend'}</SelectItem></SelectContent></Select></div>
            {kind === 'bonus' ? (
              <>
                <div className="space-y-2"><Label>{hi ? 'से' : 'From'}</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
                <div className="space-y-2"><Label>{hi ? 'तक' : 'To'}</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
                <div className="space-y-2"><Label>{hi ? 'आधार' : 'Basis'}</Label>
                  <Select value={basis} onValueChange={v => setBasis(v as DairyBonusBasis)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="per_litre">{hi ? 'प्रति लीटर' : 'Per litre'}</SelectItem><SelectItem value="per_value">{hi ? 'दूध-मूल्य पर' : 'On milk value'}</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>{basis === 'per_value' ? (hi ? 'दर (मूल्य का अंश)' : 'Rate (fraction of value)') : (hi ? 'दर ₹/लीटर' : 'Rate ₹/L')} *</Label><Input type="number" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder={basis === 'per_value' ? '0.05' : '0.50'} /></div>
              </>
            ) : (
              <>
                <div className="space-y-2"><Label>{hi ? 'वित्त वर्ष' : 'Financial Year'}</Label><Input value={fyLabel} onChange={e => setFyLabel(e.target.value)} placeholder="2025-26" /></div>
                <div className="space-y-2"><Label>{hi ? 'दर % (शेयर पूंजी)' : 'Rate % (share capital)'} *</Label><Input type="number" step="0.1" value={rate} onChange={e => setRate(e.target.value)} placeholder="10" /></div>
              </>
            )}
          </div>
          <Button className="w-full" disabled={!(Number(rate) > 0)} onClick={create}>{hi ? 'गणना करें (draft)' : 'Compute (draft)'}</Button>
          <p className="text-xs text-muted-foreground">{hi ? 'गणना के बाद प्रस्ताव संख्या के साथ स्वीकृत करें। बोनस: Dr संरक्षण बोनस वितरण / Cr देय बोनस। लाभांश: Dr लाभांश वितरण / Cr देय लाभांश।' : 'After computing, approve with a resolution no. Bonus: Dr Bonus Distribution / Cr Bonus Payable. Dividend: Dr Dividend Distribution / Cr Dividend Payable.'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'वितरण' : 'Distributions'} ({list.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {list.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'कोई वितरण नहीं।' : 'No distributions yet.'}</p>}
          {list.map(d => <DistributionCard key={d.id} d={d} />)}
        </CardContent>
      </Card>
    </div>
  );
}

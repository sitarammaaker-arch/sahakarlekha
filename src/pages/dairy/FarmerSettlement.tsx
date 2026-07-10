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
import { HandCoins, Trash2, CheckCircle2, Plus } from 'lucide-react';
import type { DairySettlement } from '@/types';
import EntityExportButton from '@/components/export/EntityExportButton';

const inr = (n: number) => `₹${(Number.isFinite(n) ? n : 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);
const out = (s: DairySettlement) => Math.max(0, +(s.netPayable - s.amountPaid).toFixed(2));

function SettlementCard({ s }: { s: DairySettlement }) {
  const { accounts } = useData();
  const { addDairyDeduction, removeDairyDeduction, approveDairySettlement, recordDairySettlementPayment, deleteDairySettlement, getMemberInputBalance, memberInputReceivableAccountId } = useDairyData();
  const inputBal = getMemberInputBalance(s.memberId);
  const { language } = useLanguage();
  const hi = language === 'hi';
  const postable = useMemo(() => accounts.filter(a => !a.isGroup), [accounts]);
  const banks = useMemo(() => accounts.filter(a => a.subtype === 'cash_bank' && a.id !== '3301'), [accounts]);
  const acctName = (id: string) => { const a = accounts.find(x => x.id === id); return a ? (hi ? (a.nameHi || a.name) : (a.name || a.nameHi)) : id; };

  const DED_TYPES = hi
    ? [['Feed', 'पशु आहार'], ['Medicine', 'दवा'], ['Advance', 'अग्रिम'], ['Loan', 'ऋण किस्त'], ['Other', 'अन्य']]
    : [['Feed', 'Feed'], ['Medicine', 'Medicine'], ['Advance', 'Advance'], ['Loan', 'Loan'], ['Other', 'Other']];
  const [dType, setDType] = useState('Feed');
  const [dAcc, setDAcc] = useState('');
  const [dAmt, setDAmt] = useState('');

  const [pAmt, setPAmt] = useState('');
  const [pMode, setPMode] = useState<'cash' | 'bank'>('cash');
  const [pBank, setPBank] = useState('');
  const [pDate, setPDate] = useState(today());

  const isDraft = s.status === 'draft';
  const outstanding = out(s);

  return (
    <div className="rounded-lg border p-3 space-y-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium flex flex-wrap items-center gap-1">
            <span>{s.memberName}</span>
            {s.settlementNo && <Badge variant="outline">{s.settlementNo}</Badge>}
            <Badge variant={isDraft ? 'secondary' : 'default'}>{isDraft ? (hi ? 'ड्राफ्ट' : 'Draft') : (hi ? 'स्वीकृत' : 'Approved')}</Badge>
          </div>
          <div className="text-muted-foreground">{s.from} → {s.to}</div>
        </div>
        <Button size="sm" variant="ghost" className="shrink-0" onClick={() => { if (window.confirm(hi ? 'सेटलमेंट हटाएँ?' : 'Delete settlement?')) deleteDairySettlement(s.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div><div className="text-muted-foreground">{hi ? 'सकल' : 'Gross'}</div><div className="font-medium">{inr(s.gross)}</div></div>
        <div><div className="text-muted-foreground">{hi ? 'कटौती' : 'Deductions'}</div><div className="font-medium">{inr(s.gross - s.netPayable)}</div></div>
        <div><div className="text-muted-foreground">{hi ? 'नेट देय' : 'Net payable'}</div><div className="font-medium">{inr(s.netPayable)}</div></div>
        <div><div className="text-muted-foreground">{hi ? 'बकाया' : 'Outstanding'}</div><div className="font-medium text-amber-700">{inr(outstanding)}</div></div>
      </div>

      {s.deductionLines.length > 0 && (
        <div className="space-y-1">
          {s.deductionLines.map(l => (
            <div key={l.id} className="flex items-center justify-between rounded border bg-muted/30 px-2 py-1 text-xs">
              <span>{l.type} · {acctName(l.accountId)}{l.remarks ? ` — ${l.remarks}` : ''}</span>
              <span className="flex items-center gap-2"><b>{inr(l.amount)}</b>{isDraft && <button onClick={() => removeDairyDeduction({ settlementId: s.id, lineId: l.id })} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}</span>
            </div>
          ))}
        </div>
      )}

      {isDraft && (
        <div className="space-y-2 rounded-md border-dashed border p-2">
          {inputBal.outstanding > 0 && memberInputReceivableAccountId && (
            <div className="flex items-center justify-between rounded bg-amber-50 border border-amber-200 px-2 py-1 text-xs">
              <span>{hi ? 'बकाया आदान (आहार/दवा)' : 'Outstanding inputs (feed/medicine)'}: <b>₹{inputBal.outstanding.toLocaleString('en-IN')}</b></span>
              <Button size="sm" variant="secondary" className="h-7" onClick={() => addDairyDeduction({ settlementId: s.id, type: hi ? 'आदान वसूली' : 'Input Recovery', accountId: memberInputReceivableAccountId, amount: inputBal.outstanding })}>{hi ? 'वसूल करें' : 'Recover'}</Button>
            </div>
          )}
          <p className="text-xs font-medium">{hi ? 'कटौती जोड़ें (वसूली)' : 'Add deduction (recovery)'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
            <div className="space-y-1"><Label className="text-xs">{hi ? 'प्रकार' : 'Type'}</Label>
              <Select value={dType} onValueChange={setDType}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{DED_TYPES.map(([v, lbl]) => <SelectItem key={v} value={v}>{lbl}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1 col-span-2"><Label className="text-xs">{hi ? 'खाता (Cr)' : 'Account (Cr)'}</Label>
              <Select value={dAcc} onValueChange={setDAcc}><SelectTrigger className="h-8"><SelectValue placeholder={hi ? 'खाता चुनें' : 'Select'} /></SelectTrigger>
                <SelectContent>{postable.map(a => <SelectItem key={a.id} value={a.id}>{hi ? (a.nameHi || a.name) : (a.name || a.nameHi)}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-xs">{hi ? 'राशि' : 'Amount'}</Label><Input type="number" className="h-8" value={dAmt} onChange={e => setDAmt(e.target.value)} /></div>
          </div>
          <div className="flex justify-between">
            <Button size="sm" variant="secondary" disabled={!dAcc || !(Number(dAmt) > 0)} onClick={() => { addDairyDeduction({ settlementId: s.id, type: dType, accountId: dAcc, amount: Number(dAmt) }); setDAmt(''); }}><Plus className="h-3.5 w-3.5 mr-1" />{hi ? 'कटौती' : 'Deduction'}</Button>
            <Button size="sm" onClick={() => approveDairySettlement(s.id)}><CheckCircle2 className="h-4 w-4 mr-1" />{hi ? `Approve — नेट ${inr(s.netPayable)}` : `Approve — net ${inr(s.netPayable)}`}</Button>
          </div>
        </div>
      )}

      {!isDraft && outstanding > 0 && (
        <div className="space-y-2 rounded-md border-dashed border p-2">
          <p className="text-xs font-medium">{hi ? 'भुगतान दर्ज करें' : 'Record payment'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
            <div className="space-y-1"><Label className="text-xs">{hi ? 'राशि' : 'Amount'}</Label><Input type="number" className="h-8" value={pAmt} onChange={e => setPAmt(e.target.value)} placeholder={String(outstanding)} /></div>
            <div className="space-y-1"><Label className="text-xs">{hi ? 'माध्यम' : 'Mode'}</Label>
              <Select value={pMode} onValueChange={v => setPMode(v as 'cash' | 'bank')}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem><SelectItem value="bank">{hi ? 'बैंक' : 'Bank'}</SelectItem></SelectContent></Select></div>
            {pMode === 'bank' && <div className="space-y-1"><Label className="text-xs">{hi ? 'बैंक खाता' : 'Bank a/c'}</Label>
              <Select value={pBank} onValueChange={setPBank}><SelectTrigger className="h-8"><SelectValue placeholder="3302" /></SelectTrigger>
                <SelectContent>{banks.map(a => <SelectItem key={a.id} value={a.id}>{hi ? (a.nameHi || a.name) : (a.name || a.nameHi)}</SelectItem>)}</SelectContent></Select></div>}
            <div className="space-y-1"><Label className="text-xs">{hi ? 'तिथि' : 'Date'}</Label><Input type="date" className="h-8" value={pDate} onChange={e => setPDate(e.target.value)} /></div>
          </div>
          <Button size="sm" onClick={() => { recordDairySettlementPayment({ settlementId: s.id, amount: Number(pAmt) || outstanding, mode: pMode, bankAccountId: pMode === 'bank' ? (pBank || undefined) : undefined, date: pDate }); setPAmt(''); }}><HandCoins className="h-4 w-4 mr-1" />{hi ? 'भुगतान' : 'Pay'}</Button>
        </div>
      )}
    </div>
  );
}

export default function FarmerSettlement() {
  const { members } = useData();
  const { settlements, createDairySettlement } = useDairyData();
  const { language } = useLanguage();
  const hi = language === 'hi';

  const [memberId, setMemberId] = useState('');
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());

  const list = settlements.filter(s => !s.isDeleted).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><HandCoins className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'दुग्ध सेटलमेंट (सदस्य भुगतान)' : 'Farmer Settlement (Milk Payout)'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'सदस्य-वार चक्र: सकल − वसूली = नेट देय → भुगतान' : 'Per-member cycle: gross − recoveries = net payable → pay'}</p>
        </div>
        {/* T-21: this register had no export at all (audit gap EXP-10). The
            Export Registry decides whether it renders, which columns leave, and whether
            the audit row was written before any bytes did. */}
        <div className="ml-auto">
          <EntityExportButton entityKey="dairy_settlement" />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नया सेटलमेंट (चक्र)' : 'New Settlement (cycle)'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2 sm:col-span-1"><Label>{hi ? 'सदस्य' : 'Member'}</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'सदस्य चुनें' : 'Select member'} /></SelectTrigger>
                <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}{m.memberId ? ` (${m.memberId})` : ''}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-2"><Label>{hi ? 'से' : 'From'}</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div className="space-y-2"><Label>{hi ? 'तक' : 'To'}</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          </div>
          <Button className="w-full" disabled={!memberId} onClick={() => { const s = createDairySettlement({ memberId, from, to }); if (s.id) setMemberId(''); }}>{hi ? 'सेटलमेंट बनाएँ' : 'Create Settlement'}</Button>
          <p className="text-xs text-muted-foreground">{hi ? 'सकल = इस अवधि में सदस्य का स्वीकृत दूध-मूल्य। Approve करने पर Dr दुग्ध खरीदी लागत / Cr देय भुगतान(नेट) / Cr वसूली पोस्ट होती है।' : 'Gross = the member’s accepted milk value in the period. Approval posts Dr milk cost / Cr payable(net) / Cr recoveries.'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'सेटलमेंट' : 'Settlements'} ({list.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {list.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'कोई सेटलमेंट नहीं।' : 'No settlements yet.'}</p>}
          {list.map(s => <SettlementCard key={s.id} s={s} />)}
        </CardContent>
      </Card>
    </div>
  );
}

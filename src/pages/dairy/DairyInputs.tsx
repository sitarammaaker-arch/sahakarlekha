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
import { PackagePlus, Trash2 } from 'lucide-react';
import type { DairyInputType } from '@/types';

const inr = (n: number) => `₹${(Number.isFinite(n) ? n : 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function DairyInputs() {
  const { members, accounts } = useData();
  const { inputIssues, recordDairyInputIssue, deleteDairyInputIssue, getMemberInputBalance } = useDairyData();
  const { language } = useLanguage();
  const hi = language === 'hi';

  const incomeAccts = useMemo(() => accounts.filter(a => a.type === 'income' && !a.isGroup), [accounts]);
  const acctName = (id: string) => { const a = accounts.find(x => x.id === id); return a ? (hi ? (a.nameHi || a.name) : (a.name || a.nameHi)) : id; };

  const TYPES: { v: DairyInputType; hi: string; en: string; acct: string }[] = [
    { v: 'feed', hi: 'पशु आहार', en: 'Feed', acct: '4103' },
    { v: 'medicine', hi: 'दवा', en: 'Medicine', acct: '4405' },
    { v: 'ai', hi: 'कृत्रिम गर्भाधान', en: 'AI', acct: '4405' },
    { v: 'other', hi: 'अन्य', en: 'Other', acct: '4405' },
  ];

  const [date, setDate] = useState(today());
  const [memberId, setMemberId] = useState('');
  const [inputType, setInputType] = useState<DairyInputType>('feed');
  const [itemName, setItemName] = useState('');
  const [qty, setQty] = useState('');
  const [amount, setAmount] = useState('');
  const [incomeAccountId, setIncomeAccountId] = useState('');

  const defaultIncome = () => {
    const t = TYPES.find(x => x.v === inputType);
    const preferred = accounts.find(a => a.id === (t?.acct || '4103') && !a.isGroup);
    return preferred?.id || incomeAccts[0]?.id || '';
  };
  const effectiveIncome = incomeAccountId || defaultIncome();

  const memberName = (id: string) => members.find(m => m.id === id)?.name || id;
  const list = inputIssues.filter(i => !i.isDeleted).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.createdAt < b.createdAt ? 1 : -1)));
  const bal = memberId ? getMemberInputBalance(memberId) : null;

  const save = () => {
    const m = members.find(x => x.id === memberId);
    if (!m) return;
    const issue = recordDairyInputIssue({
      date, memberId: m.id, memberName: m.name, inputType,
      itemName: itemName.trim() || undefined, qty: qty ? Number(qty) : undefined,
      amount: Number(amount) || 0, incomeAccountId: effectiveIncome,
    });
    if (issue.id) { setItemName(''); setQty(''); setAmount(''); }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><PackagePlus className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'सदस्य आदान (उधार)' : 'Member Inputs (on credit)'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'पशु आहार / दवा / AI उधार पर — सेटलमेंट में वसूली' : 'Feed / medicine / AI on credit — recovered at settlement'}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नया आदान' : 'New Input Issue'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2"><Label>{hi ? 'सदस्य' : 'Member'}</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'सदस्य चुनें' : 'Select member'} /></SelectTrigger>
                <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}{m.memberId ? ` (${m.memberId})` : ''}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-2"><Label>{hi ? 'तिथि' : 'Date'}</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>{hi ? 'प्रकार' : 'Type'}</Label>
              <Select value={inputType} onValueChange={v => { setInputType(v as DairyInputType); setIncomeAccountId(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t.v} value={t.v}>{hi ? t.hi : t.en}</SelectItem>)}</SelectContent></Select></div>
          </div>
          {bal && bal.outstanding > 0 && <p className="text-xs text-amber-700">{hi ? 'इस सदस्य का बकाया आदान' : 'This member’s outstanding inputs'}: <b>{inr(bal.outstanding)}</b></p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2"><Label>{hi ? 'वस्तु (वैकल्पिक)' : 'Item (optional)'}</Label><Input value={itemName} onChange={e => setItemName(e.target.value)} /></div>
            <div className="space-y-2"><Label>{hi ? 'मात्रा (वैकल्पिक)' : 'Qty (optional)'}</Label><Input type="number" value={qty} onChange={e => setQty(e.target.value)} /></div>
            <div className="space-y-2"><Label>{hi ? 'राशि' : 'Amount'} *</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>{hi ? 'आय-खाता (Cr)' : 'Income account (Cr)'}</Label>
            <Select value={effectiveIncome} onValueChange={setIncomeAccountId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{incomeAccts.map(a => <SelectItem key={a.id} value={a.id}>{hi ? (a.nameHi || a.name) : (a.name || a.nameHi)}</SelectItem>)}</SelectContent></Select></div>
          <Button className="w-full" disabled={!memberId || !(Number(amount) > 0) || !effectiveIncome} onClick={save}>{hi ? 'आदान दर्ज करें' : 'Record Input Issue'}</Button>
          <p className="text-xs text-muted-foreground">{hi ? 'पोस्ट: Dr सदस्य आदान प्राप्य (3305) / Cr आय-खाता। वसूली सेटलमेंट में होती है।' : 'Posts: Dr Member Input Receivable (3305) / Cr income. Recovery happens at settlement.'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'आदान' : 'Input Issues'} ({list.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'कोई आदान नहीं।' : 'No input issues yet.'}</p>}
          {list.map(i => (
            <div key={i.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium flex flex-wrap items-center gap-1">
                  <span>{memberName(i.memberId)}</span>
                  <Badge variant="outline">{TYPES.find(t => t.v === i.inputType)?.[hi ? 'hi' : 'en'] || i.inputType}</Badge>
                  {i.itemName && <span className="text-muted-foreground">{i.itemName}</span>}
                </div>
                <div className="text-muted-foreground text-xs">{i.date} · {acctName(i.incomeAccountId)}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-medium">{inr(i.amount)}</span>
                <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(hi ? 'आदान हटाएँ?' : 'Delete input issue?')) deleteDairyInputIssue(i.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

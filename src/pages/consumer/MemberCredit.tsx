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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { HandCoins, Trash2, Wallet } from 'lucide-react';
import { fmtDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const TODAY = () => new Date().toISOString().split('T')[0];
const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

const MemberCredit: React.FC = () => {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { members, sales, society } = useData();
  const { getMemberOutstanding, getMemberAgeing, memberRecoveries, recordMemberRecovery, deleteMemberRecovery, setMemberCreditLimit } = useConsumerData();
  const { toast } = useToast();

  const [memberId, setMemberId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [mode, setMode] = useState<'cash' | 'bank'>('cash');
  const [recDate, setRecDate] = useState(TODAY());
  const [note, setNote] = useState('');
  const [limitInput, setLimitInput] = useState<number>(0);

  // Members who have any store-credit activity (credit sale or recovery).
  const creditMemberIds = useMemo(() => {
    const ids = new Set<string>();
    sales.forEach(s => { if (s.paymentMode === 'credit' && s.memberId) ids.add(s.memberId); });
    memberRecoveries.forEach(v => { if (v.memberId) ids.add(v.memberId); });
    return ids;
  }, [sales, memberRecoveries]);

  const creditMembers = useMemo(
    () => members.filter(m => creditMemberIds.has(m.id)).map(m => ({ m, out: getMemberOutstanding(m.id) })),
    [members, creditMemberIds, getMemberOutstanding],
  );
  const totalOutstanding = creditMembers.reduce((s, x) => s + x.out, 0);

  const member = memberId ? members.find(m => m.id === memberId) : undefined;
  const outstanding = memberId ? getMemberOutstanding(memberId) : 0;
  const ageing = memberId ? getMemberAgeing(memberId) : null;

  // Member ledger: credit sales (Dr) + recoveries (Cr), chronological with running balance.
  const ledger = useMemo(() => {
    if (!memberId) return [] as Array<{ date: string; label: string; ref: string; dr: number; cr: number; recoveryId?: string; balance: number }>;
    const rows: Array<{ date: string; label: string; ref: string; dr: number; cr: number; recoveryId?: string }> = [];
    sales.filter(s => s.memberId === memberId && s.paymentMode === 'credit')
      .forEach(s => rows.push({ date: s.date, label: hi ? 'उधार बिक्री' : 'Credit sale', ref: s.saleNo, dr: s.grandTotal || s.netAmount, cr: 0 }));
    memberRecoveries.filter(v => v.memberId === memberId && !v.isDeleted)
      .forEach(v => rows.push({ date: v.date, label: hi ? 'वसूली' : 'Recovery', ref: v.voucherNo || '—', dr: 0, cr: v.amount, recoveryId: v.id }));
    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    let bal = 0;
    return rows.map(r => { bal += r.dr - r.cr; return { ...r, balance: bal }; });
  }, [memberId, sales, memberRecoveries, hi]);

  const selectMember = (id: string) => {
    setMemberId(id);
    const m = members.find(x => x.id === id);
    setLimitInput(m?.creditLimit || 0);
    setAmount(0); setNote('');
  };

  const handleRecover = () => {
    if (!member) return;
    if (!(amount > 0)) { toast({ title: hi ? 'मान्य राशि दर्ज करें' : 'Enter a valid amount', variant: 'destructive' }); return; }
    if (amount > outstanding) { toast({ title: hi ? 'बकाया से अधिक वसूली नहीं' : 'Cannot recover more than outstanding', description: `${hi ? 'बकाया' : 'Outstanding'}: ${fmt(outstanding)}`, variant: 'destructive' }); return; }
    const v = recordMemberRecovery({ memberId: member.id, memberName: member.name, amount, mode, bankAccountId: undefined, date: recDate, note });
    if (v) { toast({ title: hi ? `वसूली दर्ज: ${fmt(amount)}` : `Recovery posted: ${fmt(amount)}` }); setAmount(0); setNote(''); }
  };

  const saveLimit = () => {
    if (!member) return;
    setMemberCreditLimit(member.id, limitInput);
    toast({ title: hi ? `उधार सीमा सेव: ${fmt(limitInput)}` : `Credit limit saved: ${fmt(limitInput)}` });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-100 rounded-lg"><HandCoins className="h-6 w-6 text-orange-700" /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{hi ? 'सदस्य उधार' : 'Member Credit'}</h1>
          <p className="text-sm text-gray-500">{society.name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">{hi ? 'कुल बकाया उधार' : 'Total Outstanding'}</p>
          <p className="text-lg font-bold text-orange-700">{fmt(totalOutstanding)}</p>
        </div>
      </div>

      {/* Member picker with outstanding */}
      <Card>
        <CardContent className="pt-4">
          <Label className="text-xs text-muted-foreground">{hi ? 'सदस्य चुनें' : 'Select member'}</Label>
          <Select value={memberId} onValueChange={selectMember}>
            <SelectTrigger className="mt-1"><SelectValue placeholder={hi ? 'सदस्य चुनें' : 'Select member'} /></SelectTrigger>
            <SelectContent>
              {members.filter(m => m.status === 'active').map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.memberId} · {m.name}{creditMemberIds.has(m.id) ? ` · ${hi ? 'बकाया' : 'due'} ${fmt(getMemberOutstanding(m.id))}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {creditMembers.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {creditMembers.filter(x => x.out > 0).sort((a, b) => b.out - a.out).slice(0, 12).map(({ m, out }) => (
                <button key={m.id} onClick={() => selectMember(m.id)} className={cn('px-3 py-1 rounded-full text-xs border', memberId === m.id ? 'bg-orange-500 text-white border-orange-500' : 'border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100')}>
                  {m.name} · {fmt(out)}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {member && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">{hi ? 'बकाया' : 'Outstanding'}</p><p className="text-xl font-bold text-orange-700">{fmt(outstanding)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">0–30 {hi ? 'दिन' : 'days'}</p><p className="text-lg font-semibold">{fmt(ageing?.b0_30 || 0)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">31–60 {hi ? 'दिन' : 'days'}</p><p className="text-lg font-semibold">{fmt(ageing?.b31_60 || 0)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">60+ {hi ? 'दिन' : 'days'}</p><p className={cn('text-lg font-semibold', ((ageing?.b61_90 || 0) + (ageing?.b90plus || 0)) > 0 && 'text-red-600')}>{fmt((ageing?.b61_90 || 0) + (ageing?.b90plus || 0))}</p></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recovery */}
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" />{hi ? 'वसूली दर्ज करें' : 'Record Recovery'}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>{hi ? 'राशि (₹)' : 'Amount (₹)'}</Label><Input type="number" min={0} value={amount} onChange={e => setAmount(Math.max(0, Number(e.target.value)))} /></div>
                  <div className="space-y-1"><Label>{hi ? 'तिथि' : 'Date'}</Label><Input type="date" value={recDate} onChange={e => setRecDate(e.target.value)} /></div>
                </div>
                <div className="space-y-1">
                  <Label>{hi ? 'विधि' : 'Mode'}</Label>
                  <div className="flex gap-2">
                    {(['cash', 'bank'] as const).map(md => (
                      <button key={md} type="button" onClick={() => setMode(md)} className={cn('flex-1 px-3 py-2 rounded-lg text-sm font-medium border', mode === md ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                        {md === 'cash' ? (hi ? 'नकद' : 'Cash') : (hi ? 'बैंक / UPI' : 'Bank / UPI')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1"><Label>{hi ? 'नोट (वैकल्पिक)' : 'Note (optional)'}</Label><Input value={note} onChange={e => setNote(e.target.value)} /></div>
                <Button onClick={handleRecover} disabled={outstanding <= 0} className="w-full gap-1"><HandCoins className="h-4 w-4" />{hi ? 'वसूली दर्ज करें' : 'Post Recovery'}</Button>
              </CardContent>
            </Card>

            {/* Credit limit */}
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-base">{hi ? 'उधार सीमा' : 'Credit Limit'}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{hi ? 'सीमा से ऊपर POS केवल चेतावनी देता है, बिक्री रोकता नहीं।' : 'Above the limit the POS only warns — it never blocks the sale.'}</p>
                <div className="flex items-end gap-2">
                  <div className="space-y-1 flex-1"><Label>{hi ? 'सीमा (₹, 0 = कोई सीमा नहीं)' : 'Limit (₹, 0 = no cap)'}</Label><Input type="number" min={0} value={limitInput} onChange={e => setLimitInput(Math.max(0, Number(e.target.value)))} /></div>
                  <Button variant="outline" onClick={saveLimit}>{hi ? 'सेव' : 'Save'}</Button>
                </div>
                {member.creditLimit ? (
                  <p className="text-sm">{hi ? 'मौजूदा सीमा' : 'Current limit'}: <span className="font-semibold">{fmt(member.creditLimit)}</span>{outstanding > member.creditLimit && <Badge variant="outline" className="ml-2 border-red-400 text-red-600 bg-red-50">{hi ? 'सीमा पार' : 'over limit'}</Badge>}</p>
                ) : <p className="text-sm text-muted-foreground">{hi ? 'कोई सीमा तय नहीं' : 'No limit set'}</p>}
              </CardContent>
            </Card>
          </div>

          {/* Ledger */}
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base">{hi ? 'उधार खाता (बही)' : 'Credit Ledger'}</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                    <TableHead>{hi ? 'विवरण' : 'Particulars'}</TableHead>
                    <TableHead>{hi ? 'संदर्भ' : 'Ref'}</TableHead>
                    <TableHead className="text-right">{hi ? 'उधार' : 'Debit'}</TableHead>
                    <TableHead className="text-right">{hi ? 'वसूली' : 'Credit'}</TableHead>
                    <TableHead className="text-right">{hi ? 'शेष' : 'Balance'}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">{hi ? 'कोई उधार लेनदेन नहीं' : 'No credit transactions'}</TableCell></TableRow>
                  ) : ledger.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{fmtDate(r.date)}</TableCell>
                      <TableCell>{r.label}</TableCell>
                      <TableCell className="font-mono text-xs">{r.ref}</TableCell>
                      <TableCell className="text-right">{r.dr ? fmt(r.dr) : '—'}</TableCell>
                      <TableCell className="text-right text-emerald-700">{r.cr ? fmt(r.cr) : '—'}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(r.balance)}</TableCell>
                      <TableCell>
                        {r.recoveryId && (
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => { deleteMemberRecovery(r.recoveryId!); toast({ title: hi ? 'वसूली रद्द' : 'Recovery reversed' }); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default MemberCredit;

/**
 * Milk Collection & Member Payout — the daily operational hook for दुग्ध सहकारी समिति.
 * Records member-wise milk collection (qty × fat/SNF → rate → amount), shows a
 * payment-cycle payout sheet, and can post the cycle total to the books.
 *
 * Self-contained persistence (does NOT touch DataContext): every Supabase write
 * either succeeds silently or ROLLS BACK local state + shows a loud toast (RULE 1 —
 * local state must never diverge from Supabase). FY-lock guarded (RULE 6). No union
 * rate is hardcoded — the society enters the rate. Fully bilingual via useLanguage.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Milk, Plus, Trash2, FileDown } from 'lucide-react';
import type { MilkEntry, MilkShift } from '@/types';

const LS_KEY = (sid: string) => `sl_milk_entries_${sid}`;
const inr = (n: number) => `₹${(Number.isFinite(n) ? n : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

const MilkCollection: React.FC = () => {
  const { members, accounts, society, addVoucher } = useData();
  const { user } = useAuth();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { toast } = useToast();
  const sid = user?.societyId || 'SOC001';

  const SHIFTS: { v: MilkShift; hi: string; en: string }[] = [
    { v: 'morning', hi: 'सुबह', en: 'Morning' },
    { v: 'evening', hi: 'शाम', en: 'Evening' },
  ];
  const shiftLabel = (v: MilkShift) => { const s = SHIFTS.find((x) => x.v === v); return s ? (hi ? s.hi : s.en) : v; };

  const [entries, setEntries] = useState<MilkEntry[]>([]);

  // ── load (Supabase → localStorage fallback) ──────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from('milk_entries').select('*').eq('society_id', sid);
      if (!alive) return;
      if (error) {
        try { setEntries(JSON.parse(localStorage.getItem(LS_KEY(sid)) || '[]')); } catch { setEntries([]); }
        return;
      }
      const rows = (data || []) as unknown as MilkEntry[];
      setEntries(rows);
      try { localStorage.setItem(LS_KEY(sid), JSON.stringify(rows)); } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [sid]);

  const mirror = (rows: MilkEntry[]) => { try { localStorage.setItem(LS_KEY(sid), JSON.stringify(rows)); } catch { /* ignore */ } };

  // ── collection entry form ────────────────────────────────────────────────
  const [date, setDate] = useState(today());
  const [shift, setShift] = useState<MilkShift>('morning');
  const [fatRate, setFatRate] = useState('');   // optional ₹ per fat-point (auto-fills rate)
  const [memberId, setMemberId] = useState('');
  const [qty, setQty] = useState('');
  const [fat, setFat] = useState('');
  const [snf, setSnf] = useState('');
  const [rate, setRate] = useState('');

  const fatN = parseFloat(fat) || 0;
  const fatRateN = parseFloat(fatRate) || 0;
  const effectiveRate = rate !== '' ? (parseFloat(rate) || 0) : +(fatN * fatRateN).toFixed(2);
  const amountPreview = +((parseFloat(qty) || 0) * effectiveRate).toFixed(2);

  const addEntry = async () => {
    if (society.fyLocked) {
      toast({ title: hi ? 'FY लॉक' : 'FY Locked', description: hi ? 'वित्तीय वर्ष audit-lock है — नई एंट्री नहीं हो सकती।' : 'The financial year is audit-locked — no new entries allowed.', variant: 'destructive' });
      return;
    }
    const member = members.find((m) => m.id === memberId);
    const q = parseFloat(qty) || 0;
    if (!member || q <= 0 || effectiveRate <= 0) {
      toast({ title: hi ? 'अधूरी जानकारी' : 'Incomplete', description: hi ? 'सदस्य, लीटर और दर (या fat दर) ज़रूरी हैं।' : 'Member, litres and rate (or fat rate) are required.', variant: 'destructive' });
      return;
    }
    const entry: MilkEntry = {
      id: crypto.randomUUID(), date, shift,
      memberId: member.id, memberName: member.name,
      qty: q, fat: fatN, snf: parseFloat(snf) || 0,
      rate: effectiveRate, amount: amountPreview,
      createdAt: new Date().toISOString(),
    };
    const prev = entries;
    const next = [...entries, entry];
    setEntries(next); mirror(next);
    setMemberId(''); setQty(''); setFat(''); setSnf(''); setRate('');
    const { error } = await supabase.from('milk_entries').upsert({ ...entry, society_id: sid });
    if (error) {
      setEntries(prev); mirror(prev);
      toast({
        title: hi ? '❌ क्लाउड पर save नहीं हुआ' : '❌ Not saved to cloud',
        description: hi
          ? `${error.message}. एंट्री हटा दी गई — refresh करने पर data lose नहीं होगा। (पहली बार: supabase-tables.sql का milk_entries block चलाएँ।)`
          : `${error.message}. Entry removed — your data is safe on refresh. (First time: run the milk_entries block from supabase-tables.sql.)`,
        variant: 'destructive', duration: 15000,
      });
    }
  };

  const deleteEntry = async (id: string) => {
    if (society.fyLocked) { toast({ title: hi ? 'FY लॉक' : 'FY Locked', description: hi ? 'audit-lock में delete नहीं हो सकता।' : 'Cannot delete while audit-locked.', variant: 'destructive' }); return; }
    const prev = entries;
    const next = entries.filter((e) => e.id !== id);
    setEntries(next); mirror(next);
    const { error } = await supabase.from('milk_entries').delete().eq('id', id);
    if (error) {
      setEntries(prev); mirror(prev);
      toast({ title: hi ? '❌ Delete नहीं हुआ' : '❌ Delete failed', description: hi ? `${error.message}. एंट्री वापस ले आई गई।` : `${error.message}. Entry restored.`, variant: 'destructive', duration: 12000 });
    }
  };

  // ── today's register (filtered by date + shift) ──────────────────────────
  const dayRows = useMemo(
    () => entries.filter((e) => e.date === date && e.shift === shift).sort((a, b) => a.memberName.localeCompare(b.memberName)),
    [entries, date, shift],
  );
  const dayQty = dayRows.reduce((s, e) => s + e.qty, 0);
  const dayAmt = dayRows.reduce((s, e) => s + e.amount, 0);

  // ── payout sheet ─────────────────────────────────────────────────────────
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const payout = useMemo(() => {
    const m = new Map<string, { name: string; qty: number; amount: number }>();
    for (const e of entries) {
      if (e.date < from || e.date > to) continue;
      const cur = m.get(e.memberId) || { name: e.memberName, qty: 0, amount: 0 };
      cur.qty += e.qty; cur.amount += e.amount;
      m.set(e.memberId, cur);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, from, to]);
  const payoutTotal = payout.reduce((s, p) => s + p.amount, 0);
  const payoutQty = payout.reduce((s, p) => s + p.qty, 0);

  // ── post cycle total to the books ────────────────────────────────────────
  const postable = accounts.filter((a) => !a.isGroup);
  const guess = (kw: string[]) => postable.find((a) => kw.some((k) => (a.nameHi || a.name || '').includes(k)))?.id || '';
  const [drAcc, setDrAcc] = useState('');
  const [crAcc, setCrAcc] = useState('');
  useEffect(() => {
    if (!drAcc) setDrAcc(guess(['दुग्ध खरीदी लागत', 'दूध खरीद', 'खरीदी लागत']));
    if (!crAcc) setCrAcc(guess(['देय दुग्ध भुगतान', 'देय दुग्ध', 'दुग्ध भुगतान']));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length]);

  const postToBooks = () => {
    if (society.fyLocked) { toast({ title: hi ? 'FY लॉक' : 'FY Locked', description: hi ? 'audit-lock में पोस्ट नहीं हो सकता।' : 'Cannot post while audit-locked.', variant: 'destructive' }); return; }
    if (payoutTotal <= 0) { toast({ title: hi ? 'कुछ नहीं' : 'Nothing to post', description: hi ? 'इस अवधि में कोई राशि नहीं।' : 'No amount in this period.', variant: 'destructive' }); return; }
    if (!drAcc || !crAcc) { toast({ title: hi ? 'खाता चुनें' : 'Select accounts', description: hi ? 'खरीद-लागत (Dr) और देय-भुगतान (Cr) खाते चुनें।' : 'Choose purchase-cost (Dr) and payable (Cr) accounts.', variant: 'destructive' }); return; }
    const v = addVoucher({
      type: 'journal', date: to,
      debitAccountId: drAcc, creditAccountId: crAcc, amount: +payoutTotal.toFixed(2),
      narration: hi ? `दूध खरीद ${from} से ${to} — ${payoutQty.toFixed(1)} लीटर, ${payout.length} सदस्य` : `Milk purchase ${from} to ${to} — ${payoutQty.toFixed(1)} L, ${payout.length} members`,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0]);
    if (v?.id) toast({ title: hi ? '✅ खातों में पोस्ट हुआ' : '✅ Posted to books', description: `${inr(payoutTotal)} — Dr ${hi ? 'खरीद-लागत' : 'Purchase Cost'}, Cr ${hi ? 'देय-भुगतान' : 'Payable'}.` });
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-2">
        <Milk className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">{hi ? 'दूध संकलन व सदस्य भुगतान' : 'Milk Collection & Member Payout'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'दुग्ध सहकारी समिति का रोज़ का हिसाब' : 'Daily milk collection & payout for dairy cooperatives'}</p>
        </div>
      </div>

      {/* Entry form */}
      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नई एंट्री दर्ज करें' : 'New Entry'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1"><Label>{hi ? 'तारीख' : 'Date'}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1"><Label>{hi ? 'पाली (shift)' : 'Shift'}</Label>
              <Select value={shift} onValueChange={(v) => setShift(v as MilkShift)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SHIFTS.map((s) => <SelectItem key={s.v} value={s.v}>{hi ? s.hi : s.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>{hi ? 'fat दर ₹/point' : 'fat rate ₹/point'} <span className="text-xs text-muted-foreground">({hi ? 'वैकल्पिक' : 'optional'})</span></Label>
              <Input type="number" inputMode="decimal" value={fatRate} onChange={(e) => setFatRate(e.target.value)} placeholder={hi ? 'जैसे 7' : 'e.g. 7'} /></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
            <div className="space-y-1 col-span-2"><Label>{hi ? 'सदस्य' : 'Member'}</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'सदस्य चुनें' : 'Select member'} /></SelectTrigger>
                <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}{m.memberId ? ` (${m.memberId})` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>{hi ? 'लीटर' : 'Litres'}</Label><Input type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            <div className="space-y-1"><Label>fat %</Label><Input type="number" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} /></div>
            <div className="space-y-1"><Label>SNF</Label><Input type="number" inputMode="decimal" value={snf} onChange={(e) => setSnf(e.target.value)} /></div>
            <div className="space-y-1"><Label>{hi ? 'दर ₹/लीटर' : 'Rate ₹/L'}</Label>
              <Input type="number" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={fatRateN ? effectiveRate.toFixed(2) : ''} /></div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{hi ? 'राशि' : 'Amount'}: <b className="text-foreground">{inr(amountPreview)}</b> {fatRateN > 0 && rate === '' ? `(${hi ? 'दर' : 'rate'} ${effectiveRate.toFixed(2)} = fat ${fatN} × ${fatRateN})` : ''}</span>
            <Button onClick={addEntry}><Plus className="h-4 w-4 mr-1" /> {hi ? 'जोड़ें' : 'Add'}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Today's register */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center justify-between">
          <span>{date} · {shiftLabel(shift)} {hi ? 'पाली का संकलन' : 'shift collection'}</span>
          <span className="text-sm font-normal text-muted-foreground">{dayQty.toFixed(1)} {hi ? 'लीटर' : 'L'} · {inr(dayAmt)}</span>
        </CardTitle></CardHeader>
        <CardContent>
          {dayRows.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">{hi ? 'इस पाली में कोई एंट्री नहीं।' : 'No entries this shift.'}</p> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                <TableHead>{hi ? 'सदस्य' : 'Member'}</TableHead><TableHead className="text-right">{hi ? 'लीटर' : 'Litres'}</TableHead><TableHead className="text-right">fat</TableHead>
                <TableHead className="text-right">SNF</TableHead><TableHead className="text-right">{hi ? 'दर' : 'Rate'}</TableHead><TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>{dayRows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.memberName}</TableCell>
                  <TableCell className="text-right">{e.qty.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{e.fat || '—'}</TableCell>
                  <TableCell className="text-right">{e.snf || '—'}</TableCell>
                  <TableCell className="text-right">{e.rate.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">{inr(e.amount)}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => deleteEntry(e.id)} aria-label={hi ? 'हटाएँ' : 'Delete'}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table></div>
          )}
        </CardContent>
      </Card>

      {/* Payout sheet */}
      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'भुगतान-चक्र शीट (सदस्य-वार)' : 'Payout Sheet (member-wise)'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <div className="space-y-1"><Label>{hi ? 'से' : 'From'}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label>{hi ? 'तक' : 'To'}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="sm:col-span-2 text-right text-sm text-muted-foreground self-center">{hi ? 'कुल' : 'Total'}: <b className="text-foreground">{payoutQty.toFixed(1)} {hi ? 'लीटर' : 'L'} · {inr(payoutTotal)}</b></div>
          </div>
          {payout.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">{hi ? 'इस अवधि में कोई संकलन नहीं।' : 'No collection in this period.'}</p> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>{hi ? 'सदस्य' : 'Member'}</TableHead><TableHead className="text-right">{hi ? 'कुल लीटर' : 'Total Litres'}</TableHead><TableHead className="text-right">{hi ? 'देय राशि' : 'Amount Due'}</TableHead></TableRow></TableHeader>
              <TableBody>{payout.map((p, i) => (
                <TableRow key={i}><TableCell>{p.name}</TableCell><TableCell className="text-right">{p.qty.toFixed(1)}</TableCell><TableCell className="text-right font-medium">{inr(p.amount)}</TableCell></TableRow>
              ))}</TableBody>
            </Table></div>
          )}

          {/* Post to books */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <p className="text-sm font-medium">{hi ? 'इस चक्र की कुल राशि खातों में पोस्ट करें' : "Post this cycle's total to the books"}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">{hi ? 'Dr — दुग्ध खरीदी लागत' : 'Dr — Milk Purchase Cost'}</Label>
                <Select value={drAcc} onValueChange={setDrAcc}><SelectTrigger><SelectValue placeholder={hi ? 'खाता चुनें' : 'Select account'} /></SelectTrigger>
                  <SelectContent>{postable.map((a) => <SelectItem key={a.id} value={a.id}>{hi ? (a.nameHi || a.name) : (a.name || a.nameHi)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">{hi ? 'Cr — देय दुग्ध भुगतान' : 'Cr — Milk Payable'}</Label>
                <Select value={crAcc} onValueChange={setCrAcc}><SelectTrigger><SelectValue placeholder={hi ? 'खाता चुनें' : 'Select account'} /></SelectTrigger>
                  <SelectContent>{postable.map((a) => <SelectItem key={a.id} value={a.id}>{hi ? (a.nameHi || a.name) : (a.name || a.nameHi)}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <Button variant="outline" size="sm" onClick={postToBooks} disabled={payoutTotal <= 0}><FileDown className="h-4 w-4 mr-1" /> {hi ? `${inr(payoutTotal)} पोस्ट करें (Journal)` : `Post ${inr(payoutTotal)} (Journal)`}</Button>
            <p className="text-xs text-muted-foreground">{hi ? 'यह एक journal voucher बनाता है — Dr खरीद-लागत, Cr देय-भुगतान — जो ट्रायल बैलेंस/बैलेंस शीट में दिखेगा।' : 'Creates a journal voucher — Dr purchase-cost, Cr payable — visible in Trial Balance / Balance Sheet.'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MilkCollection;

/**
 * Milk Collection & Member Payout — the daily operational hook for दुग्ध सहकारी समिति.
 * Records member-wise milk collection (qty × fat/SNF → rate → amount), shows a
 * payment-cycle payout sheet, and can post the cycle total to the books.
 *
 * Self-contained persistence (does NOT touch DataContext): every Supabase write
 * either succeeds silently or ROLLS BACK local state + shows a loud Hindi toast
 * (RULE 1 — local state must never diverge from Supabase). FY-lock guarded (RULE 6).
 * No union rate is hardcoded — the society enters the rate (RULE: educational/own rates).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
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
const SHIFTS: { v: MilkShift; label: string }[] = [{ v: 'morning', label: 'सुबह' }, { v: 'evening', label: 'शाम' }];

const MilkCollection: React.FC = () => {
  const { members, accounts, society, addVoucher } = useData();
  const { user } = useAuth();
  const { toast } = useToast();
  const sid = user?.societyId || 'SOC001';

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
  // rate auto = fat × fatRate when a fat-rate is set AND the user hasn't typed a rate
  const effectiveRate = rate !== '' ? (parseFloat(rate) || 0) : +(fatN * fatRateN).toFixed(2);
  const amountPreview = +((parseFloat(qty) || 0) * effectiveRate).toFixed(2);

  const addEntry = async () => {
    if (society.fyLocked) {
      toast({ title: 'FY Locked', description: 'वित्तीय वर्ष audit-lock है — नई एंट्री नहीं हो सकती।', variant: 'destructive' });
      return;
    }
    const member = members.find((m) => m.id === memberId);
    const q = parseFloat(qty) || 0;
    if (!member || q <= 0 || effectiveRate <= 0) {
      toast({ title: 'अधूरी जानकारी', description: 'सदस्य, लीटर और दर (या fat दर) ज़रूरी हैं।', variant: 'destructive' });
      return;
    }
    const entry: MilkEntry = {
      id: crypto.randomUUID(), date, shift,
      memberId: member.id, memberName: member.name,
      qty: q, fat: fatN, snf: parseFloat(snf) || 0,
      rate: effectiveRate, amount: amountPreview,
      createdAt: new Date().toISOString(),
    };
    // optimistic
    const prev = entries;
    const next = [...entries, entry];
    setEntries(next); mirror(next);
    setMemberId(''); setQty(''); setFat(''); setSnf(''); setRate('');
    // persist + rollback (RULE 1)
    const { error } = await supabase.from('milk_entries').upsert({ ...entry, society_id: sid });
    if (error) {
      setEntries(prev); mirror(prev);
      toast({
        title: '❌ क्लाउड पर save नहीं हुआ',
        description: `${error.message}. एंट्री हटा दी गई — refresh करने पर data lose नहीं होगा। (पहली बार: supabase-tables.sql का milk_entries block चलाएँ।)`,
        variant: 'destructive', duration: 15000,
      });
    }
  };

  const deleteEntry = async (id: string) => {
    if (society.fyLocked) { toast({ title: 'FY Locked', description: 'audit-lock में delete नहीं हो सकता।', variant: 'destructive' }); return; }
    const prev = entries;
    const next = entries.filter((e) => e.id !== id);
    setEntries(next); mirror(next);
    const { error } = await supabase.from('milk_entries').delete().eq('id', id);
    if (error) {
      setEntries(prev); mirror(prev);
      toast({ title: '❌ Delete नहीं हुआ', description: `${error.message}. एंट्री वापस ले आई गई।`, variant: 'destructive', duration: 12000 });
    }
  };

  // ── today's register (filtered by date + shift) ──────────────────────────
  const dayRows = useMemo(
    () => entries.filter((e) => e.date === date && e.shift === shift).sort((a, b) => a.memberName.localeCompare(b.memberName)),
    [entries, date, shift],
  );
  const dayQty = dayRows.reduce((s, e) => s + e.qty, 0);
  const dayAmt = dayRows.reduce((s, e) => s + e.amount, 0);

  // ── payout sheet (payment cycle: from–to, member-wise totals) ────────────
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

  // ── post cycle total to the books (Dr खरीद-लागत, Cr देय-भुगतान) ───────────
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
    if (society.fyLocked) { toast({ title: 'FY Locked', description: 'audit-lock में पोस्ट नहीं हो सकता।', variant: 'destructive' }); return; }
    if (payoutTotal <= 0) { toast({ title: 'कुछ नहीं', description: 'इस अवधि में कोई राशि नहीं।', variant: 'destructive' }); return; }
    if (!drAcc || !crAcc) { toast({ title: 'खाता चुनें', description: 'खरीद-लागत (Dr) और देय-भुगतान (Cr) खाते चुनें।', variant: 'destructive' }); return; }
    const v = addVoucher({
      type: 'journal', date: to,
      debitAccountId: drAcc, creditAccountId: crAcc, amount: +payoutTotal.toFixed(2),
      narration: `दूध खरीद ${from} से ${to} — ${payoutQty.toFixed(1)} लीटर, ${payout.length} सदस्य`,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0]);
    if (v?.id) toast({ title: '✅ खातों में पोस्ट हुआ', description: `${inr(payoutTotal)} — Dr खरीद-लागत, Cr देय-भुगतान।` });
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-2">
        <Milk className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">दूध संकलन व सदस्य भुगतान</h1>
          <p className="text-sm text-muted-foreground">Milk collection & member payout — दुग्ध सहकारी समिति का रोज़ का हिसाब</p>
        </div>
      </div>

      {/* Entry form */}
      <Card>
        <CardHeader><CardTitle className="text-base">नई एंट्री दर्ज करें</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1"><Label>तारीख</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1"><Label>पाली (shift)</Label>
              <Select value={shift} onValueChange={(v) => setShift(v as MilkShift)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SHIFTS.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>fat दर ₹/point <span className="text-xs text-muted-foreground">(वैकल्पिक)</span></Label>
              <Input type="number" inputMode="decimal" value={fatRate} onChange={(e) => setFatRate(e.target.value)} placeholder="जैसे 7" /></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
            <div className="space-y-1 col-span-2"><Label>सदस्य</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder="सदस्य चुनें" /></SelectTrigger>
                <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}{m.memberId ? ` (${m.memberId})` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>लीटर</Label><Input type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            <div className="space-y-1"><Label>fat %</Label><Input type="number" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} /></div>
            <div className="space-y-1"><Label>SNF</Label><Input type="number" inputMode="decimal" value={snf} onChange={(e) => setSnf(e.target.value)} /></div>
            <div className="space-y-1"><Label>दर ₹/लीटर</Label>
              <Input type="number" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={fatRateN ? effectiveRate.toFixed(2) : ''} /></div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">राशि: <b className="text-foreground">{inr(amountPreview)}</b> {fatRateN > 0 && rate === '' ? `(दर ${effectiveRate.toFixed(2)} = fat ${fatN} × ${fatRateN})` : ''}</span>
            <Button onClick={addEntry}><Plus className="h-4 w-4 mr-1" /> जोड़ें</Button>
          </div>
        </CardContent>
      </Card>

      {/* Today's register */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center justify-between">
          <span>{date} · {SHIFTS.find((s) => s.v === shift)?.label} पाली का संकलन</span>
          <span className="text-sm font-normal text-muted-foreground">{dayQty.toFixed(1)} लीटर · {inr(dayAmt)}</span>
        </CardTitle></CardHeader>
        <CardContent>
          {dayRows.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">इस पाली में कोई एंट्री नहीं।</p> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                <TableHead>सदस्य</TableHead><TableHead className="text-right">लीटर</TableHead><TableHead className="text-right">fat</TableHead>
                <TableHead className="text-right">SNF</TableHead><TableHead className="text-right">दर</TableHead><TableHead className="text-right">राशि</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>{dayRows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.memberName}</TableCell>
                  <TableCell className="text-right">{e.qty.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{e.fat || '—'}</TableCell>
                  <TableCell className="text-right">{e.snf || '—'}</TableCell>
                  <TableCell className="text-right">{e.rate.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">{inr(e.amount)}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => deleteEntry(e.id)} aria-label="हटाएँ"><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table></div>
          )}
        </CardContent>
      </Card>

      {/* Payout sheet */}
      <Card>
        <CardHeader><CardTitle className="text-base">भुगतान-चक्र शीट (सदस्य-वार)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <div className="space-y-1"><Label>से</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label>तक</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="sm:col-span-2 text-right text-sm text-muted-foreground self-center">कुल: <b className="text-foreground">{payoutQty.toFixed(1)} लीटर · {inr(payoutTotal)}</b></div>
          </div>
          {payout.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">इस अवधि में कोई संकलन नहीं।</p> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>सदस्य</TableHead><TableHead className="text-right">कुल लीटर</TableHead><TableHead className="text-right">देय राशि</TableHead></TableRow></TableHeader>
              <TableBody>{payout.map((p, i) => (
                <TableRow key={i}><TableCell>{p.name}</TableCell><TableCell className="text-right">{p.qty.toFixed(1)}</TableCell><TableCell className="text-right font-medium">{inr(p.amount)}</TableCell></TableRow>
              ))}</TableBody>
            </Table></div>
          )}

          {/* Post to books */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <p className="text-sm font-medium">इस चक्र की कुल राशि खातों में पोस्ट करें</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Dr — दुग्ध खरीदी लागत</Label>
                <Select value={drAcc} onValueChange={setDrAcc}><SelectTrigger><SelectValue placeholder="खाता चुनें" /></SelectTrigger>
                  <SelectContent>{postable.map((a) => <SelectItem key={a.id} value={a.id}>{a.nameHi || a.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Cr — देय दुग्ध भुगतान</Label>
                <Select value={crAcc} onValueChange={setCrAcc}><SelectTrigger><SelectValue placeholder="खाता चुनें" /></SelectTrigger>
                  <SelectContent>{postable.map((a) => <SelectItem key={a.id} value={a.id}>{a.nameHi || a.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <Button variant="outline" size="sm" onClick={postToBooks} disabled={payoutTotal <= 0}><FileDown className="h-4 w-4 mr-1" /> {inr(payoutTotal)} पोस्ट करें (Journal)</Button>
            <p className="text-xs text-muted-foreground">यह एक journal voucher बनाता है — Dr खरीद-लागत, Cr देय-भुगतान — जो ट्रायल बैलेंस/बैलेंस शीट में दिखेगा।</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MilkCollection;

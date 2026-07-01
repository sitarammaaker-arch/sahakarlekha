/**
 * Milk Collection & Member Payout — the daily operational hook for दुग्ध सहकारी समिति.
 * Records member-wise milk collection (qty × rate → amount), shows a payment-cycle payout
 * sheet, and posts the cycle total to the books.
 *
 * Delivery D2 (C-B): state now lives in DairyDataContext (single SSOT, RULE-1 rollback + RULE-6
 * FY-lock in the context) instead of the former bespoke `sl_milk_entries_` localStorage key.
 * The rate auto-fills from the effective Fat+SNF rate chart (pricing engine) when present, and
 * posting goes through the dairy posting rule to the DEDICATED milk ledgers (Dr 5108 / Cr 2102),
 * never the generic 5101/4101 fallbacks (C-A). No union rate is hardcoded.
 */
import React, { useMemo, useRef, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useDairyData } from '@/contexts/DairyDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Milk, Plus, Trash2 } from 'lucide-react';
import type { MilkEntry, MilkShift, MilkQualityDecision } from '@/types';

const inr = (n: number) => `₹${(Number.isFinite(n) ? n : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

const MilkCollection: React.FC = () => {
  const { members } = useData();
  const { milkEntries, addMilkEntry, deleteMilkEntry, resolveMilkRate } = useDairyData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { toast } = useToast();

  const SHIFTS: { v: MilkShift; hi: string; en: string }[] = [
    { v: 'morning', hi: 'सुबह', en: 'Morning' },
    { v: 'evening', hi: 'शाम', en: 'Evening' },
  ];
  const shiftLabel = (v: MilkShift) => { const s = SHIFTS.find((x) => x.v === v); return s ? (hi ? s.hi : s.en) : v; };

  // ── collection entry form ────────────────────────────────────────────────
  const [date, setDate] = useState(today());
  const [shift, setShift] = useState<MilkShift>('morning');
  const [fatRate, setFatRate] = useState('');   // optional ₹ per fat-point (fallback when no chart)
  const [memberId, setMemberId] = useState('');
  const [qty, setQty] = useState('');
  const [fat, setFat] = useState('');
  const [snf, setSnf] = useState('');
  const [rate, setRate] = useState('');
  const [quality, setQuality] = useState<MilkQualityDecision>('accepted');

  // keyboard-first: Enter advances member → qty → fat → SNF → submit → back to member
  const memberRef = useRef<HTMLButtonElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const fatRef = useRef<HTMLInputElement>(null);
  const snfRef = useRef<HTMLInputElement>(null);
  const advance = (e: React.KeyboardEvent, next?: React.RefObject<HTMLElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (next) next.current?.focus(); else addEntry();
  };
  const QUALITY: { v: MilkQualityDecision; hi: string; en: string }[] = [
    { v: 'accepted', hi: 'स्वीकृत', en: 'Accept' },
    { v: 'accepted_cut', hi: 'कटौती सहित', en: 'Cut' },
    { v: 'rejected', hi: 'अस्वीकृत', en: 'Reject' },
  ];

  const fatN = parseFloat(fat) || 0;
  const snfN = parseFloat(snf) || 0;
  const qtyN = parseFloat(qty) || 0;
  const fatRateN = parseFloat(fatRate) || 0;
  const chartPriced = useMemo(() => resolveMilkRate({ fat: fatN, snf: snfN, qty: qtyN, date }), [resolveMilkRate, fatN, snfN, qtyN, date]);
  const manualRate = rate !== '' ? (parseFloat(rate) || 0) : 0;
  const rateSource: 'manual' | 'fat' | 'chart' | 'none' =
    manualRate > 0 ? 'manual' : fatRateN > 0 ? 'fat' : (chartPriced.rate != null && chartPriced.rate > 0) ? 'chart' : 'none';
  const effectiveRate =
    rateSource === 'manual' ? manualRate
      : rateSource === 'fat' ? +(fatN * fatRateN).toFixed(2)
        : rateSource === 'chart' ? (chartPriced.rate || 0) : 0;
  const amountPreview = +(qtyN * effectiveRate).toFixed(2);

  const addEntry = () => {
    const member = members.find((m) => m.id === memberId);
    const rejected = quality === 'rejected';
    if (!member || qtyN <= 0 || (!rejected && effectiveRate <= 0)) {
      toast({ title: hi ? 'अधूरी जानकारी' : 'Incomplete', description: rejected ? (hi ? 'सदस्य और लीटर ज़रूरी हैं।' : 'Member and litres are required.') : (hi ? 'सदस्य, लीटर और दर (चार्ट / fat-दर / मैन्युअल) ज़रूरी हैं।' : 'Member, litres and a rate (chart / fat-rate / manual) are required.'), variant: 'destructive' });
      return;
    }
    const data: Omit<MilkEntry, 'id' | 'createdAt'> = {
      date, shift, memberId: member.id, memberName: member.name,
      qty: qtyN, fat: fatN, snf: snfN,
      rate: rejected ? 0 : effectiveRate, amount: rejected ? 0 : amountPreview,
      qualityDecision: quality, source: 'manual',
    };
    const saved = addMilkEntry(data);
    if (saved.id) { setMemberId(''); setQty(''); setFat(''); setSnf(''); setRate(''); setQuality('accepted'); memberRef.current?.focus(); }
  };

  // ── today's register (filtered by date + shift) ──────────────────────────
  const dayRows = useMemo(
    () => milkEntries.filter((e) => e.date === date && e.shift === shift).sort((a, b) => a.memberName.localeCompare(b.memberName)),
    [milkEntries, date, shift],
  );
  const dayQty = dayRows.reduce((s, e) => s + e.qty, 0);                                   // collected (incl. rejected)
  const dayAmt = dayRows.reduce((s, e) => s + (e.qualityDecision === 'rejected' ? 0 : e.amount), 0);  // payable

  // ── payout sheet ─────────────────────────────────────────────────────────
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const payout = useMemo(() => {
    const m = new Map<string, { name: string; qty: number; amount: number }>();
    for (const e of milkEntries) {
      if (e.date < from || e.date > to) continue;
      if (e.qualityDecision === 'rejected') continue;   // rejected milk is not paid (matches settlement gross)
      const cur = m.get(e.memberId) || { name: e.memberName, qty: 0, amount: 0 };
      cur.qty += e.qty; cur.amount += e.amount;
      m.set(e.memberId, cur);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [milkEntries, from, to]);
  const payoutTotal = payout.reduce((s, p) => s + p.amount, 0);
  const payoutQty = payout.reduce((s, p) => s + p.qty, 0);

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
            <div className="space-y-1"><Label>{hi ? 'fat दर ₹/point' : 'fat rate ₹/point'} <span className="text-xs text-muted-foreground">({hi ? 'चार्ट न हो तो' : 'if no chart'})</span></Label>
              <Input type="number" inputMode="decimal" value={fatRate} onChange={(e) => setFatRate(e.target.value)} placeholder={hi ? 'जैसे 7' : 'e.g. 7'} /></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-7 gap-3 items-end">
            <div className="space-y-1 col-span-2"><Label>{hi ? 'सदस्य' : 'Member'}</Label>
              <Select value={memberId} onValueChange={(v) => { setMemberId(v); qtyRef.current?.focus(); }}>
                <SelectTrigger ref={memberRef}><SelectValue placeholder={hi ? 'सदस्य चुनें' : 'Select member'} /></SelectTrigger>
                <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}{m.memberId ? ` (${m.memberId})` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>{hi ? 'लीटर' : 'Litres'}</Label><Input ref={qtyRef} type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={(e) => advance(e, fatRef)} /></div>
            <div className="space-y-1"><Label>fat %</Label><Input ref={fatRef} type="number" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} onKeyDown={(e) => advance(e, snfRef)} /></div>
            <div className="space-y-1"><Label>SNF %</Label><Input ref={snfRef} type="number" inputMode="decimal" value={snf} onChange={(e) => setSnf(e.target.value)} onKeyDown={(e) => advance(e)} /></div>
            <div className="space-y-1"><Label>{hi ? 'दर ₹/लीटर' : 'Rate ₹/L'}</Label>
              <Input type="number" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={rateSource === 'chart' || rateSource === 'fat' ? effectiveRate.toFixed(2) : ''} disabled={quality === 'rejected'} /></div>
            <div className="space-y-1"><Label>{hi ? 'गुणवत्ता' : 'Quality'}</Label>
              <Select value={quality} onValueChange={(v) => setQuality(v as MilkQualityDecision)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{QUALITY.map((q) => <SelectItem key={q.v} value={q.v}>{hi ? q.hi : q.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              {hi ? 'राशि' : 'Amount'}: <b className="text-foreground">{inr(amountPreview)}</b>
              {rateSource === 'chart' && <Badge variant="secondary">{hi ? 'चार्ट दर' : 'chart rate'} ₹{effectiveRate.toFixed(2)}</Badge>}
              {rateSource === 'fat' && <Badge variant="outline">{hi ? 'दर' : 'rate'} {effectiveRate.toFixed(2)} = fat {fatN} × {fatRateN}</Badge>}
              {rateSource === 'none' && quality !== 'rejected' && (fatN > 0 || qtyN > 0) && <Badge variant="destructive">{hi ? 'दर नहीं मिली — रेट चार्ट भरें या दर डालें' : 'no rate — add a chart or enter rate'}</Badge>}
              <span className="hidden sm:inline text-xs">· {hi ? 'Enter से अगला खाना' : 'Enter = next field'}</span>
            </span>
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
                <TableRow key={e.id} className={e.qualityDecision === 'rejected' ? 'opacity-60' : ''}>
                  <TableCell>{e.memberName}
                    {e.qualityDecision === 'rejected' && <Badge variant="destructive" className="ml-1 text-[10px]">{hi ? 'अस्वीकृत' : 'reject'}</Badge>}
                    {e.qualityDecision === 'accepted_cut' && <Badge variant="secondary" className="ml-1 text-[10px]">{hi ? 'कटौती' : 'cut'}</Badge>}
                  </TableCell>
                  <TableCell className="text-right">{e.qty.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{e.fat || '—'}</TableCell>
                  <TableCell className="text-right">{e.snf || '—'}</TableCell>
                  <TableCell className="text-right">{e.rate.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">{e.qualityDecision === 'rejected' ? '—' : inr(e.amount)}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => deleteMilkEntry(e.id)} aria-label={hi ? 'हटाएँ' : 'Delete'}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
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
          <p className="text-xs text-muted-foreground">{hi ? 'खातों में पोस्टिंग अब “दुग्ध सेटलमेंट” से होती है — सदस्य-वार सकल, कटौती व नेट भुगतान।' : 'Ledger posting now happens in “Farmer Settlement” — per-member gross, recoveries & net payout.'}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MilkCollection;

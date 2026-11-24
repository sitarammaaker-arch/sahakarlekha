/**
 * Physical stock verification (भौतिक स्टॉक सत्यापन) — HAFED Accounts Manual 1976, para 10.20, Annexure XV/1.
 * Count a godown (or the whole society), compare with the book, give a reason for each difference, certify. Saving
 * stores the count FIRST (migration 204), then posts each difference as an ordinary stock adjustment — a recoverable
 * shortage through recordStockShortage (voucher first) — and marks the count complete, or partial naming what failed.
 * The figures are lib/stockVerification (pure, tested). Rows are page-local, like the TDS register: no login read.
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { fetchAllPaged } from '@/lib/supabasePaging';
import { reportError } from '@/lib/errorReporting';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardCheck, FileText, AlertTriangle } from 'lucide-react';
import { fmtDate } from '@/lib/dateUtils';
import { DECREASE_REASONS, INCREASE_REASONS, reasonLabel } from '@/lib/godownShortage';
import {
  ALL_STOCK, buildCountSheet, countLine, validateCount, nextVerificationNo, certificateText, statusAfterPosting,
  overdueCounts, countTotals, VERIFY_EVERY_DAYS,
} from '@/lib/stockVerification';
import { generateStockVerificationPDF } from '@/lib/pdfLazy';
import type { StockAdjustmentReason, StockVerification as Verification, StockVerificationLine } from '@/types';

const today = () => new Date().toISOString().split('T')[0];
// Plain objects for the jsonb column (an interface has no index signature, so it is not `Json` to the client types).
const jsonLines = (ls: readonly StockVerificationLine[]) => ls.map(l => ({ ...l }));
type Entry = { physical: string; reason: StockAdjustmentReason | ''; person: string };

export default function StockVerification() {
  const { society, stockItems, reconciledStockMovements, godowns, employees, addStockMovement, recordStockShortage, guardPageWrite } = useData();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const societyId = user?.societyId || '';

  // ── saved counts (page-local) ──
  const [list, setList] = useState<Verification[]>([]);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    if (!societyId) { setList([]); return; }
    fetchAllPaged<Verification>('stock_verifications', societyId, ['createdAt', 'id']).then(
      ({ data, error }) => { if (error) setLoadError(error.message); else setList((data as Verification[]) || []); },
      (e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)),
    );
  }, [societyId]);

  const activeGodowns = godowns.filter(g => g.isActive !== false);
  const placeName = (id?: string) => (id ? (godowns.find(g => g.id === id)?.name || id) : (hi ? 'पूरा स्टॉक' : 'Whole stock'));
  const overdue = useMemo(() => {
    const live = godowns.filter(g => g.isActive !== false);
    const places = live.length ? live.map(g => ({ id: g.id, name: g.name })) : [{ id: ALL_STOCK, name: hi ? 'पूरा स्टॉक' : 'Whole stock' }];
    return overdueCounts({ verifications: list, places, today: today() });
  }, [list, godowns, hi]);

  // ── the count being entered ──
  const [godownId, setGodownId] = useState<string>(ALL_STOCK);
  const [date, setDate] = useState(today());
  const [verifiedBy, setVerifiedBy] = useState('');
  const [designation, setDesignation] = useState('');
  const [remarks, setRemarks] = useState('');
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (activeGodowns.length && !activeGodowns.some(g => g.id === godownId)) setGodownId(activeGodowns[0].id); }, [activeGodowns.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const sheet = useMemo(() => buildCountSheet({ items: stockItems, reconciled: reconciledStockMovements, godownId: godownId || undefined, hi }), [stockItems, reconciledStockMovements, godownId, hi]);
  const setEntry = (itemId: string, patch: Partial<Entry>) => setEntries(e => ({ ...e, [itemId]: { ...(e[itemId] ?? { physical: '', reason: '', person: '' }), ...patch } }));
  // Only the items whose count was typed in are part of this verification.
  const lines: StockVerificationLine[] = sheet
    .filter(s => (entries[s.itemId]?.physical ?? '').trim() !== '')
    .map(s => { const e = entries[s.itemId]; return countLine(s, Number(e.physical), e.reason || undefined, e.person); });
  const totals = countTotals(lines);
  const fillBook = () => setEntries(Object.fromEntries(sheet.map(s => [s.itemId, { physical: String(s.bookQty), reason: '' as const, person: '' }])));

  const reset = () => { setEntries({}); setRemarks(''); };

  const save = async () => {
    const errs = validateCount({ verifiedBy, date, lines }, hi);
    if (errs.length) { toast({ title: hi ? 'सत्यापन सेव नहीं हुआ' : 'Verification not saved', description: errs.slice(0, 4).join(' · '), variant: 'destructive', duration: 10000 }); return; }
    if (guardPageWrite('create', date)) return;
    setSaving(true);
    const no = nextVerificationNo(list);
    const cert = certificateText({ verifiedBy: verifiedBy.trim(), designation: designation.trim() || undefined, date: fmtDate(date), place: placeName(godownId || undefined), differences: totals.differing }, hi);
    const row: Verification = {
      id: crypto.randomUUID(), verificationNo: no, date, godownId: godownId || undefined, verifiedBy: verifiedBy.trim(), designation: designation.trim() || undefined,
      status: 'pending', lines, certificate: cert, remarks: remarks.trim() || undefined, createdBy: user?.name, createdAt: new Date().toISOString(),
    };
    // 1. The count itself. If this fails nothing else is posted.
    const { error } = await supabase.from('stock_verifications').insert({ ...row, lines: jsonLines(row.lines), godownId: row.godownId ?? null, society_id: societyId });
    if (error) {
      reportError('db-sync', error.message, { at: 'stock_verifications insert' });
      toast({ title: hi ? 'सत्यापन सेव नहीं हुआ' : 'Verification not saved', description: hi ? `क्लाउड में सेव नहीं हुआ — ${error.message}। स्टॉक नहीं बदला।` : `Not saved to the cloud — ${error.message}. Stock was not changed.`, variant: 'destructive', duration: 12000 });
      setSaving(false);
      return;
    }
    setList(l => [...l, row]);
    // 2. Each difference, one after another (a recoverable shortage may create ledgers; never two at once).
    const posted: StockVerificationLine[] = [];
    for (const l of lines) {
      if (!l.diff) { posted.push(l); continue; }
      const narration = `${hi ? 'भौतिक सत्यापन' : 'Physical verification'} ${no}`;
      const res = await new Promise<{ ok: boolean; ref?: string }>(resolve => {
        if (l.reason === 'shortageRecoverable') {
          const started = recordStockShortage({ itemId: l.itemId, qty: l.diff, rate: l.rate, date, person: l.person || '', narration, godownId: godownId || undefined, onDone: (ok, vno) => resolve({ ok, ref: vno }) });
          if (!started) resolve({ ok: false });
        } else {
          addStockMovement(
            { date, itemId: l.itemId, type: 'adjustment', qty: l.diff, rate: l.rate, amount: l.value, referenceNo: no, narration, godownId: godownId || undefined, reason: l.reason },
            { onSaved: () => resolve({ ok: true, ref: no }), onFailed: () => resolve({ ok: false }) },
          );
        }
      });
      posted.push({ ...l, posted: res.ok, referenceNo: res.ref });
    }
    // 3. Close the count.
    const status = statusAfterPosting(posted);
    const { error: upErr } = await supabase.from('stock_verifications').update({ lines: jsonLines(posted), status }).eq('id', row.id);
    setList(l => l.map(v => (v.id === row.id ? { ...v, lines: posted, status: upErr ? 'pending' : status } : v)));
    const failed = posted.filter(l => l.diff && !l.posted).map(l => l.itemName);
    if (upErr) reportError('write-partial', upErr.message, { at: 'stock_verifications status' });
    if (failed.length) {
      toast({ title: hi ? `${no} — सत्यापन अधूरा` : `${no} — verification partial`, description: hi ? `इन वस्तुओं का समायोजन सेव नहीं हुआ: ${failed.join(', ')}। इन्हें स्टॉक → मैनुअल समायोजन से दर्ज करें।` : `The adjustment did not save for: ${failed.join(', ')}. Record them from Inventory → Manual adjustment.`, variant: 'destructive', duration: 15000 });
    } else if (upErr) {
      toast({ title: hi ? `${no} — समायोजन सेव, स्थिति नहीं` : `${no} — adjustments saved, status not`, description: hi ? `सब अंतर दर्ज हो गए, पर सत्यापन "पूरा" चिह्नित नहीं हुआ (${upErr.message})।` : `Every difference is recorded, but the count was not marked complete (${upErr.message}).`, duration: 10000 });
    } else {
      toast({ title: hi ? `${no} — सत्यापन पूरा` : `${no} — verification complete`, description: hi ? `${totals.counted} वस्तुएँ गिनी, ${totals.differing} में अंतर।` : `${totals.counted} item(s) counted, ${totals.differing} differed.` });
      reset();
    }
    setSaving(false);
  };

  const rupees = (n: number) => (n ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—');
  const qty = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 3 });
  const statusBadge = (s: Verification['status']) => s === 'complete'
    ? <Badge className="bg-green-600">{hi ? 'पूरा' : 'Complete'}</Badge>
    : s === 'partial' ? <Badge variant="destructive">{hi ? 'अधूरा' : 'Partial'}</Badge>
    : <Badge variant="outline">{hi ? 'लंबित' : 'Pending'}</Badge>;

  const pdf = (v: Verification) => {
    // English PDF: item names in English, certificate re-worded in English.
    const names = new Map(stockItems.map(i => [i.id, i.name]));
    const enLines = v.lines.map(l => ({ ...l, itemName: names.get(l.itemId) || l.itemName }));
    const cert = certificateText({ verifiedBy: v.verifiedBy, designation: v.designation, date: fmtDate(v.date), place: v.godownId ? (godowns.find(g => g.id === v.godownId)?.name || v.godownId) : 'Whole stock', differences: v.lines.filter(l => l.diff).length }, false);
    generateStockVerificationPDF({ ...v, lines: enLines }, society, v.godownId ? (godowns.find(g => g.id === v.godownId)?.name || v.godownId) : 'Whole stock', cert);
  };
  const [openId, setOpenId] = useState<string | null>(null);
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <ClipboardCheck className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{hi ? 'भौतिक स्टॉक सत्यापन' : 'Physical Stock Verification'}</h1>
          <p className="text-sm text-muted-foreground">
            {hi
              ? `गोदाम का माल गिनें, किताब से मिलाएँ, हर अंतर का कारण लिखें और प्रमाणित करें — हर ${VERIFY_EVERY_DAYS} दिन में (HAFED Accounts Manual, Annexure XV/1)।`
              : `Count the godown, compare with the book, give each difference a reason and certify it — every ${VERIFY_EVERY_DAYS} days (HAFED Accounts Manual, Annexure XV/1).`}
          </p>
        </div>
      </div>

      {loadError && (
        <Card className="border-destructive"><CardContent className="pt-6 text-sm text-destructive">
          {hi ? `पिछले सत्यापन load नहीं हुए (${loadError})। अगर यह "relation does not exist" है, तो migration 204 अभी नहीं चली है।` : `Earlier counts did not load (${loadError}). If it says "relation does not exist", migration 204 has not been run yet.`}
        </CardContent></Card>
      )}
      {!loadError && overdue.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20"><CardContent className="pt-6 text-sm flex gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            {overdue.map(p => (
              <p key={p.id || 'all'}>
                <span className="font-medium">{p.name}:</span>{' '}
                {p.lastDate
                  ? (hi ? `पिछला सत्यापन ${fmtDate(p.lastDate)} — ${p.daysSince} दिन पहले।` : `last counted ${fmtDate(p.lastDate)} — ${p.daysSince} days ago.`)
                  : (hi ? 'अब तक कोई सत्यापन नहीं।' : 'never counted yet.')}
              </p>
            ))}
          </div>
        </CardContent></Card>
      )}

      <Tabs defaultValue="count">
        <TabsList>
          <TabsTrigger value="count">{hi ? 'नई गिनती' : 'New count'}</TabsTrigger>
          <TabsTrigger value="register">{hi ? `सत्यापन रजिस्टर (${list.length})` : `Register (${list.length})`}</TabsTrigger>
        </TabsList>

        <TabsContent value="count" className="space-y-4">
          <Card>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>{hi ? 'गोदाम' : 'Godown'}</Label>
                {activeGodowns.length ? (
                  <Select value={godownId} onValueChange={v => { setGodownId(v); setEntries({}); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{activeGodowns.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : <p className="text-sm pt-2">{hi ? 'पूरा स्टॉक (कोई गोदाम नहीं बना)' : 'Whole stock (no godowns kept)'}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="pv-date">{hi ? 'तारीख़' : 'Date'}</Label>
                <Input id="pv-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pv-by">{hi ? 'सत्यापन करने वाला' : 'Verified by'} <span className="text-destructive">*</span></Label>
                <Input id="pv-by" list="pv-people" value={verifiedBy} onChange={e => setVerifiedBy(e.target.value)} placeholder={hi ? 'नाम' : 'Name'} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pv-des">{hi ? 'पद' : 'Designation'}</Label>
                <Input id="pv-des" value={designation} onChange={e => setDesignation(e.target.value)} placeholder={hi ? 'जैसे प्रबंधक' : 'e.g. Manager'} />
              </div>
              <datalist id="pv-people">{employees.filter(e => e.status === 'active').map(e => <option key={e.id} value={e.name}>{e.designation}</option>)}</datalist>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
                <span>{hi ? 'गिनती' : 'Count'}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {hi ? `गिनी ${totals.counted} · अंतर ${totals.differing} · कमी ${rupees(totals.shortValue)} · बढ़त ${rupees(totals.excessValue)}` : `counted ${totals.counted} · differing ${totals.differing} · short ${rupees(totals.shortValue)} · excess ${rupees(totals.excessValue)}`}
                </span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {hi ? 'जो वस्तु गिनी, उसकी मात्रा भरें; ख़ाली छोड़ी वस्तु इस सत्यापन में नहीं गिनी जाएगी।' : 'Enter the quantity for each item you counted; an item left blank is not part of this count.'}{' '}
                <button type="button" className="underline" onClick={fillBook}>{hi ? 'सबमें किताब वाली मात्रा भरें' : 'Fill every row with the book quantity'}</button>
              </p>
            </CardHeader>
            <CardContent>
              {sheet.length === 0 ? <p className="text-sm text-muted-foreground">{hi ? 'कोई वस्तु नहीं।' : 'No items.'}</p> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[160px]">{hi ? 'वस्तु' : 'Item'}</TableHead>
                        <TableHead className="text-right">{hi ? 'किताब में' : 'Book'}</TableHead>
                        <TableHead className="w-28">{hi ? 'गिनी मात्रा' : 'Counted'}</TableHead>
                        <TableHead className="text-right">{hi ? 'अंतर' : 'Difference'}</TableHead>
                        <TableHead className="text-right">{hi ? 'रकम' : 'Value'}</TableHead>
                        <TableHead className="min-w-[220px]">{hi ? 'कारण' : 'Reason'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sheet.map(s => {
                        const e = entries[s.itemId];
                        const counted = (e?.physical ?? '').trim() !== '';
                        const l = counted ? countLine(s, Number(e.physical), e.reason || undefined, e.person) : null;
                        const options = l && l.diff < 0 ? DECREASE_REASONS : l && l.diff > 0 ? INCREASE_REASONS : [];
                        return (
                          <TableRow key={s.itemId}>
                            <TableCell>{s.itemName} <span className="text-xs text-muted-foreground">{s.unit}</span></TableCell>
                            <TableCell className="text-right tabular-nums">{qty(s.bookQty)}</TableCell>
                            <TableCell>
                              <Input type="number" min="0" step="any" className="h-8" value={e?.physical ?? ''} onChange={ev => setEntry(s.itemId, { physical: ev.target.value })} aria-label={`${s.itemName} ${hi ? 'गिनी मात्रा' : 'counted'}`} />
                            </TableCell>
                            <TableCell className={`text-right tabular-nums ${l && l.diff < 0 ? 'text-red-600' : l && l.diff > 0 ? 'text-green-700' : ''}`}>{l ? (l.diff ? `${l.diff > 0 ? '+' : ''}${qty(l.diff)}` : '✓') : ''}</TableCell>
                            <TableCell className="text-right tabular-nums">{l && l.diff ? rupees(l.value) : ''}</TableCell>
                            <TableCell>
                              {options.length > 0 && (
                                <div className="space-y-1">
                                  <Select value={e?.reason && options.includes(e.reason) ? e.reason : ''} onValueChange={v => setEntry(s.itemId, { reason: v as StockAdjustmentReason })}>
                                    <SelectTrigger className="h-8"><SelectValue placeholder={hi ? 'कारण चुनें' : 'Choose a reason'} /></SelectTrigger>
                                    <SelectContent>{options.map(r => <SelectItem key={r} value={r}>{reasonLabel(r, hi)}</SelectItem>)}</SelectContent>
                                  </Select>
                                  {e?.reason === 'shortageRecoverable' && (
                                    <Input className="h-8" list="pv-people" value={e.person} onChange={ev => setEntry(s.itemId, { person: ev.target.value })} placeholder={hi ? 'किससे वसूली' : 'Recoverable from'} />
                                  )}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="pv-rem">{hi ? 'टिप्पणी' : 'Remarks'}</Label>
                <Input id="pv-rem" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder={hi ? 'जैसे बोरियाँ गीली मिलीं' : 'e.g. some bags found damp'} />
              </div>
              <p className="text-sm rounded-md bg-muted p-3">
                {certificateText({ verifiedBy: verifiedBy.trim() || '…', designation: designation.trim() || undefined, date: fmtDate(date), place: placeName(godownId || undefined), differences: totals.differing }, hi)}
              </p>
              <p className="text-xs text-muted-foreground">
                {hi
                  ? 'सेव करने पर हर अंतर का स्टॉक समायोजन उसके कारण के साथ बनेगा; "व्यक्ति से वसूली" पर वसूली का वाउचर भी। सामान्य सूखत, टूट-फूट और बढ़त पर वाउचर नहीं बनता।'
                  : 'Saving records each difference as a stock adjustment with its reason; a recoverable shortage also posts its voucher. Normal loss, damage and excess post no voucher.'}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={reset} disabled={saving}>{hi ? 'साफ़ करें' : 'Clear'}</Button>
                <Button onClick={save} disabled={saving || !!loadError || lines.length === 0}>{saving ? (hi ? 'सेव हो रहा है…' : 'Saving…') : (hi ? 'सत्यापन पूरा करें' : 'Complete verification')}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="register">
          <Card>
            <CardContent className="pt-6">
              {sorted.length === 0 ? <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई सत्यापन दर्ज नहीं है।' : 'No count recorded yet.'}</p> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{hi ? 'सं.' : 'No.'}</TableHead>
                        <TableHead>{hi ? 'तारीख़' : 'Date'}</TableHead>
                        <TableHead>{hi ? 'गोदाम' : 'Godown'}</TableHead>
                        <TableHead>{hi ? 'सत्यापनकर्ता' : 'Verified by'}</TableHead>
                        <TableHead className="text-right">{hi ? 'गिनी / अंतर' : 'Counted / differing'}</TableHead>
                        <TableHead className="text-right">{hi ? 'कमी' : 'Short'}</TableHead>
                        <TableHead className="text-right">{hi ? 'बढ़त' : 'Excess'}</TableHead>
                        <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sorted.map(v => {
                        const t = countTotals(v.lines);
                        return (
                          <Fragment key={v.id}>
                            <TableRow className="cursor-pointer" onClick={() => setOpenId(openId === v.id ? null : v.id)}>
                              <TableCell className="whitespace-nowrap font-medium">{v.verificationNo}</TableCell>
                              <TableCell className="whitespace-nowrap">{fmtDate(v.date)}</TableCell>
                              <TableCell>{placeName(v.godownId)}</TableCell>
                              <TableCell>{v.verifiedBy}{v.designation ? ` (${v.designation})` : ''}</TableCell>
                              <TableCell className="text-right tabular-nums">{t.counted} / {t.differing}</TableCell>
                              <TableCell className="text-right tabular-nums">{rupees(t.shortValue)}</TableCell>
                              <TableCell className="text-right tabular-nums">{rupees(t.excessValue)}</TableCell>
                              <TableCell>{statusBadge(v.status)}</TableCell>
                              <TableCell>
                                <Button variant="outline" size="sm" className="gap-1" onClick={ev => { ev.stopPropagation(); pdf(v); }}><FileText className="h-4 w-4" />PDF</Button>
                              </TableCell>
                            </TableRow>
                            {openId === v.id && (
                              <TableRow key={`${v.id}-d`}>
                                <TableCell colSpan={9} className="bg-muted/40">
                                  <div className="space-y-2 text-sm">
                                    {v.lines.filter(l => l.diff).length === 0
                                      ? <p>{hi ? 'कोई अंतर नहीं मिला।' : 'No difference found.'}</p>
                                      : v.lines.filter(l => l.diff).map(l => (
                                        <p key={l.itemId}>
                                          {l.itemName}: {qty(l.bookQty)} → {qty(l.physicalQty)} ({l.diff > 0 ? '+' : ''}{qty(l.diff)} {l.unit}, {rupees(l.value)}) — {reasonLabel(l.reason, hi)}{l.person ? ` — ${l.person}` : ''}
                                          {l.posted === false && <span className="text-destructive"> · {hi ? 'समायोजन सेव नहीं हुआ' : 'adjustment not saved'}</span>}
                                          {l.referenceNo && l.posted && <span className="text-muted-foreground"> · {l.referenceNo}</span>}
                                        </p>
                                      ))}
                                    {v.certificate && <p className="italic text-muted-foreground">{v.certificate}</p>}
                                    {v.remarks && <p>{hi ? 'टिप्पणी' : 'Remarks'}: {v.remarks}</p>}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

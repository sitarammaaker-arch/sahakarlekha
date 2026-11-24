/**
 * Godown shortage / excess register (गोदाम घटत / बढ़त रजिस्टर) — HAFED Accounts Manual 1976, paras 9.19, 9.25, 10.20.
 * Every manual stock adjustment with its reason, and the dues of each person a shortage was booked to (from their
 * "Shortage Recoverable" ledgers). Two actions: cancel a shortage booked by mistake (stock back + voucher cancelled)
 * and a Board-approved write-off (Dr Wastage / Shortage / Cr the person). A recovery is an ordinary receipt voucher.
 * The figures are lib/godownShortage (pure, tested); the posting is DataContext.
 */
import { useMemo, useState } from 'react';
import { Link } from '@/components/LocalLink';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PackageMinus, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { PrintButton, PrintHeader } from '@/components/ReportPrint';
import { buildShortageRegister, reasonLabel, type PersonDues, type ShortageRow } from '@/lib/godownShortage';
import { societyFyStart } from '@/lib/fyPeriod';
import { fmtDate } from '@/lib/dateUtils';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { generateGodownShortagePDF } from '@/lib/pdfLazy';

const today = () => new Date().toISOString().split('T')[0];

export default function GodownShortage() {
  const { society, stockMovements, stockItems, godowns, vouchers, accounts, reverseStockShortage, writeOffShortage } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';

  const fyStart = societyFyStart(society) ?? '';
  const fyEnd = fyStart ? `${Number(fyStart.slice(0, 4)) + 1}-03-31` : '';
  const [from, setFrom] = useState(fyStart);
  const [to, setTo] = useState(fyEnd);

  const reg = useMemo(() => buildShortageRegister({
    movements: stockMovements, stockItems, godowns, vouchers, accounts, from: from || undefined, to: to || undefined, hi,
  }), [stockMovements, stockItems, godowns, vouchers, accounts, from, to, hi]);

  const rupees = (n: number) => (n ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—');
  const qtyText = (r: ShortageRow) => `${r.qty > 0 ? '+' : ''}${r.qty.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${r.unit}`;

  // ── cancel a shortage ──
  const [cancelRow, setCancelRow] = useState<ShortageRow | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);
  const doCancel = () => {
    if (!cancelRow || !cancelReason.trim()) return;
    setBusy(true);
    const started = reverseStockShortage(cancelRow.id, cancelReason.trim(), ok => { setBusy(false); if (ok) { setCancelRow(null); setCancelReason(''); } });
    if (!started) setBusy(false);
  };

  // ── write off ──
  const [woPerson, setWoPerson] = useState<PersonDues | null>(null);
  const [woAmount, setWoAmount] = useState('');
  const [woDate, setWoDate] = useState(today());
  const [woResolution, setWoResolution] = useState('');
  const openWriteOff = (p: PersonDues) => { setWoPerson(p); setWoAmount(p.outstanding.toFixed(2)); setWoDate(today()); setWoResolution(''); };
  const doWriteOff = () => {
    if (!woPerson) return;
    setBusy(true);
    const started = writeOffShortage({ personAccountId: woPerson.accountId, amount: Number(woAmount), date: woDate, resolutionNo: woResolution, onDone: ok => { setBusy(false); if (ok) setWoPerson(null); } });
    if (!started) setBusy(false);
  };
  const woTooMuch = woPerson ? Number(woAmount) > woPerson.outstanding + 0.005 : false;

  // ── exports ──
  const head = [hi ? 'तारीख़' : 'Date', hi ? 'वस्तु' : 'Item', hi ? 'गोदाम' : 'Godown', hi ? 'मात्रा' : 'Qty', hi ? 'रकम (₹)' : 'Value (₹)', hi ? 'कारण' : 'Reason', hi ? 'ज़िम्मेदार व्यक्ति' : 'Responsible person', hi ? 'वाउचर' : 'Voucher', hi ? 'विवरण' : 'Narration'];
  const rowCells = (r: ShortageRow) => [fmtDate(r.date), r.itemName, r.godownName || '—', `${r.qty} ${r.unit}`.trim(), r.qty < 0 ? -r.value : r.value, reasonLabel(r.reason, hi) + (r.reversed ? (hi ? ' (रद्द)' : ' (cancelled)') : ''), r.person || '', r.voucherNo || '', r.narration];
  const fileBase = `godown-shortage-${from || 'start'}-to-${to || 'end'}`;
  const exportCsv = () => downloadCSV(head, reg.rows.map(r => rowCells(r).map(c => (typeof c === 'number' ? c.toFixed(2) : c))), `${fileBase}.csv`);
  const exportExcel = () => downloadExcelSingle(head, reg.rows.map(rowCells), fileBase, 'Godown Shortage');
  // The PDF is English only (like the other register PDFs), so it gets the English item and ledger names.
  const exportPdf = () => generateGodownShortagePDF(
    buildShortageRegister({ movements: stockMovements, stockItems, godowns, vouchers, accounts, from: from || undefined, to: to || undefined, hi: false }),
    society, from || undefined, to || undefined,
  );

  const period = hi ? `अवधि: ${from || 'शुरू से'} — ${to || 'अब तक'}` : `Period: ${from || 'start'} — ${to || 'today'}`;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <PrintHeader />
      <div className="flex items-start gap-3 flex-wrap">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 print:hidden">
          <PackageMinus className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{hi ? 'गोदाम घटत / बढ़त रजिस्टर' : 'Godown Shortage / Excess Register'}</h1>
          <p className="text-sm text-muted-foreground">
            {hi
              ? 'हर मैनुअल स्टॉक समायोजन उसके कारण के साथ, और जिन लोगों के नाम घटत चढ़ी है उन पर बकाया।'
              : 'Every manual stock adjustment with its reason, and what is due from each person a shortage was booked to.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={exportPdf} className="gap-1"><FileText className="h-4 w-4" />PDF</Button>
          <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1"><FileSpreadsheet className="h-4 w-4" />Excel</Button>
          {reg.rows.length > 0 && <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1"><Download className="h-4 w-4" />CSV</Button>}
          <PrintButton />
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="pt-6 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="gs-from">{hi ? 'से' : 'From'}</Label>
            <Input id="gs-from" type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-44" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gs-to">{hi ? 'तक' : 'To'}</Label>
            <Input id="gs-to" type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-44" />
          </div>
          <p className="text-xs text-muted-foreground">{period}</p>
        </CardContent>
      </Card>
      <p className="hidden print:block text-sm">{period}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: hi ? 'कुल घटत (रकम)' : 'Total decrease (value)', value: reg.totals.decreaseValue },
          { label: hi ? 'कुल बढ़त (रकम)' : 'Total excess (value)', value: reg.totals.increaseValue },
          { label: hi ? 'वसूली योग्य घटत' : 'Recoverable shortage', value: reg.totals.recoverableValue },
          { label: hi ? 'व्यक्तियों पर बकाया' : 'Outstanding from persons', value: reg.totals.outstanding },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-lg font-semibold tabular-nums">{rupees(s.value)}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{hi ? 'समायोजन' : 'Adjustments'}</CardTitle></CardHeader>
        <CardContent>
          {reg.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hi ? 'इस अवधि में कोई मैनुअल समायोजन नहीं है। घटत / बढ़त ' : 'No manual adjustment in this period. Record a shortage / excess from '}
              <Link to="/inventory" className="underline">{hi ? 'स्टॉक → मैनुअल समायोजन' : 'Inventory → Manual adjustment'}</Link>
              {hi ? ' से दर्ज करें।' : '.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{head[0]}</TableHead>
                    <TableHead className="min-w-[140px]">{head[1]}</TableHead>
                    <TableHead>{head[2]}</TableHead>
                    <TableHead className="text-right">{head[3]}</TableHead>
                    <TableHead className="text-right">{head[4]}</TableHead>
                    <TableHead>{head[5]}</TableHead>
                    <TableHead>{head[6]}</TableHead>
                    <TableHead>{head[7]}</TableHead>
                    <TableHead className="print:hidden" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reg.rows.map(r => (
                    <TableRow key={r.id} className={r.reversed || r.reason === 'shortageReversal' ? 'text-muted-foreground' : undefined}>
                      <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                      <TableCell>{r.itemName}</TableCell>
                      <TableCell>{r.godownName || '—'}</TableCell>
                      <TableCell className={`text-right tabular-nums ${r.qty < 0 ? 'text-red-600' : 'text-green-700'}`}>{qtyText(r)}</TableCell>
                      <TableCell className="text-right tabular-nums">{rupees(r.value)}</TableCell>
                      <TableCell>
                        {r.reason ? reasonLabel(r.reason, hi) : <span className="text-amber-700">{reasonLabel(undefined, hi)}</span>}
                        {r.reversed && <Badge variant="outline" className="ml-1">{hi ? 'रद्द' : 'Cancelled'}</Badge>}
                      </TableCell>
                      <TableCell>{r.person || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.voucherNo || '—'}</TableCell>
                      <TableCell className="print:hidden">
                        {r.reason === 'shortageRecoverable' && !r.reversed && (
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setCancelRow(r); setCancelReason(''); }}>
                            {hi ? 'रद्द करें' : 'Cancel'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{hi ? 'व्यक्तियों पर बकाया (स्टॉक घटत वसूली योग्य)' : 'Dues from persons (Shortage Recoverable)'}</CardTitle></CardHeader>
        <CardContent>
          {reg.persons.length === 0 ? (
            <p className="text-sm text-muted-foreground">{hi ? 'अभी किसी के नाम घटत नहीं चढ़ी है।' : 'No shortage has been booked to anyone yet.'}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'व्यक्ति' : 'Person'}</TableHead>
                    <TableHead className="text-right">{hi ? 'घटत चढ़ी' : 'Booked'}</TableHead>
                    <TableHead className="text-right">{hi ? 'वसूल / बट्टे खाते' : 'Recovered / written off'}</TableHead>
                    <TableHead className="text-right">{hi ? 'बकाया' : 'Outstanding'}</TableHead>
                    <TableHead className="print:hidden" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reg.persons.map(p => (
                    <TableRow key={p.accountId}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{rupees(p.booked)}</TableCell>
                      <TableCell className="text-right tabular-nums">{rupees(p.cleared)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{rupees(p.outstanding)}</TableCell>
                      <TableCell className="print:hidden">
                        {p.outstanding > 0 && (
                          <Button variant="outline" size="sm" onClick={() => openWriteOff(p)}>{hi ? 'बट्टे खाते डालें' : 'Write off'}</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 text-xs text-muted-foreground space-y-1">
          <p>{hi
            ? 'वसूली योग्य घटत पर वाउचर बनता है: व्यक्ति का खाता Dr / घटत से बिक्री Cr, औसत लागत पर। closing stock उतना ही घटता है, इसलिए सकल लाभ नहीं बदलता। (HAFED Accounts Manual, पैरा 10.20)'
            : 'A recoverable shortage posts: the person’s ledger Dr / Sales by Shortage Cr, at average cost. Closing stock falls by the same value, so gross profit does not change. (HAFED Accounts Manual, para 10.20)'}</p>
          <p>{hi
            ? 'सामान्य सूखत, टूट-फूट और बढ़त पर कोई वाउचर नहीं बनता — वे closing stock में ही रहते हैं।'
            : 'Normal loss, damage and excess post no voucher — they stay inside closing stock.'}</p>
          <p>{hi
            ? 'व्यक्ति पैसे जमा करे तो साधारण रसीद (receipt) वाउचर बनाएँ, उसके "स्टॉक घटत" खाते को Cr करके — बकाया यहाँ अपने-आप घटेगा।'
            : 'When the person pays, make an ordinary receipt voucher crediting their "shortage recoverable" ledger — the dues here fall by themselves.'}</p>
          <p>{hi ? 'बकाया "तक" वाली तारीख़ तक का है।' : 'Dues are as at the "To" date.'}</p>
        </CardContent>
      </Card>

      <Dialog open={!!cancelRow} onOpenChange={o => { if (!o) setCancelRow(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{hi ? 'घटत रद्द करें' : 'Cancel shortage'}</DialogTitle>
            <DialogDescription>
              {cancelRow && (hi
                ? `${cancelRow.itemName} ${Math.abs(cancelRow.qty)} ${cancelRow.unit} (${cancelRow.voucherNo}) — स्टॉक वापस जुड़ेगा और वाउचर रद्द होगा।`
                : `${cancelRow.itemName} ${Math.abs(cancelRow.qty)} ${cancelRow.unit} (${cancelRow.voucherNo}) — the stock is put back and the voucher cancelled.`)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="gs-cancel-reason">{hi ? 'कारण' : 'Reason'} <span className="text-destructive">*</span></Label>
            <Input id="gs-cancel-reason" value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder={hi ? 'जैसे ग़लत व्यक्ति / ग़लत मात्रा' : 'e.g. wrong person / wrong quantity'} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCancelRow(null)}>{hi ? 'वापस' : 'Back'}</Button>
            <Button variant="destructive" disabled={busy || !cancelReason.trim()} onClick={doCancel}>{busy ? (hi ? 'हो रहा है…' : 'Working…') : (hi ? 'रद्द करें' : 'Cancel shortage')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!woPerson} onOpenChange={o => { if (!o) setWoPerson(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{hi ? 'घटत बट्टे खाते डालें' : 'Write off shortage'}</DialogTitle>
            <DialogDescription>
              {woPerson && (hi
                ? `${woPerson.name} पर बकाया ${rupees(woPerson.outstanding)}। वाउचर बनेगा: बर्बादी / कमी व्यय Dr / ${woPerson.name} Cr। Board या सक्षम अधिकारी की मंज़ूरी के बाद ही करें।`
                : `${woPerson.name} owes ${rupees(woPerson.outstanding)}. Voucher: Wastage / Shortage Dr / ${woPerson.name} Cr. Only after Board or competent-authority approval.`)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="gs-wo-amount">{hi ? 'रकम (₹)' : 'Amount (₹)'}</Label>
              <Input id="gs-wo-amount" type="number" step="0.01" value={woAmount} onChange={e => setWoAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gs-wo-date">{hi ? 'तारीख़' : 'Date'}</Label>
              <Input id="gs-wo-date" type="date" value={woDate} onChange={e => setWoDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="gs-wo-res">{hi ? 'Board प्रस्ताव संख्या / तारीख़' : 'Board resolution no. / date'} <span className="text-destructive">*</span></Label>
            <Input id="gs-wo-res" value={woResolution} onChange={e => setWoResolution(e.target.value)} placeholder={hi ? 'जैसे प्रस्ताव 7, दि. 15-03-2027' : 'e.g. Resolution 7 of 15-03-2027'} />
          </div>
          {woTooMuch && <p className="text-xs text-destructive">{hi ? 'रकम बकाया से ज़्यादा है।' : 'The amount is more than what is outstanding.'}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setWoPerson(null)}>{hi ? 'वापस' : 'Back'}</Button>
            <Button disabled={busy || woTooMuch || !(Number(woAmount) > 0) || !woResolution.trim()} onClick={doWriteOff}>{busy ? (hi ? 'हो रहा है…' : 'Working…') : (hi ? 'बट्टे खाते डालें' : 'Write off')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

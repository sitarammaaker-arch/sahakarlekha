/**
 * Cheque Issue / Cheque Collection registers (चेक जारी / प्राप्ति रजिस्टर) — HAFED Accounts Manual 1976, paras 4.6–4.8,
 * Proformas IV/1 and IV/2. Read-only: every row is a voucher that carries a cheque / DD no. (migration 205); the
 * party, bank and date of realisation come from the voucher and the bank reconciliation. lib/chequeRegister (pure,
 * tested) builds the rows.
 */
import { useMemo, useState } from 'react';
import { Link } from '@/components/LocalLink';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Landmark, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { PrintButton, PrintHeader } from '@/components/ReportPrint';
import { buildChequeRegister, type ChequeRow } from '@/lib/chequeRegister';
import { getBankAccountIds } from '@/lib/storage';
import { societyFyStart } from '@/lib/fyPeriod';
import { fmtDate } from '@/lib/dateUtils';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { generateChequeRegisterPDF } from '@/lib/pdfLazy';

const ALL = '__all';
const today = () => new Date().toISOString().split('T')[0];

export default function ChequeRegister() {
  const { society, vouchers, accounts, matchesActiveBranch } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';

  const fyStart = societyFyStart(society) ?? '';
  const fyEnd = fyStart ? `${Number(fyStart.slice(0, 4)) + 1}-03-31` : '';
  const [from, setFrom] = useState(fyStart);
  const [to, setTo] = useState(fyEnd);
  const [bankId, setBankId] = useState(ALL);
  const [tab, setTab] = useState<'issued' | 'received'>('issued');

  const bankIds = useMemo(() => getBankAccountIds(accounts), [accounts]);
  const build = (h: boolean) => buildChequeRegister({
    vouchers: vouchers.filter(v => matchesActiveBranch(v.branchId)), accounts, bankIds,
    from: from || undefined, to: to || undefined, bankId: bankId === ALL ? undefined : bankId, today: today(), hi: h,
  });
  const reg = useMemo(() => build(hi), [vouchers, accounts, bankIds, from, to, bankId, hi, matchesActiveBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const rows = tab === 'issued' ? reg.issued : reg.received;
  const t = tab === 'issued' ? reg.totals.issued : reg.totals.received;
  const clearedText = (r: ChequeRow) => (r.cleared ? (r.clearedDate ? fmtDate(r.clearedDate) : (hi ? 'clear' : 'cleared')) : '');

  // ── exports (one table per tab, the manual's columns; initials left blank) ──
  const head = tab === 'issued'
    ? [hi ? 'क्र.' : 'Sr.', hi ? 'तारीख़' : 'Date', hi ? 'चेक नं.' : 'Cheque No.', hi ? 'किसके नाम' : 'Drawn in favour of', hi ? 'बैंक' : 'Bank', hi ? 'रकम' : 'Amount', hi ? 'भुगतान की तारीख़' : 'Presented on', hi ? 'वाउचर' : 'Voucher']
    : [hi ? 'क्र.' : 'Sr.', hi ? 'तारीख़' : 'Date', hi ? 'चेक / ड्राफ्ट नं.' : 'Cheque / DD No.', hi ? 'चेक की तारीख़' : 'Cheque date', hi ? 'किससे प्राप्त' : 'Received from', hi ? 'किस खाते में जमा' : 'Deposited in', hi ? 'रकम' : 'Amount', hi ? 'वसूली की तारीख़' : 'Realised on', hi ? 'वाउचर' : 'Voucher'];
  const cells = (r: ChequeRow): (string | number)[] => tab === 'issued'
    ? [String(r.serial), fmtDate(r.date), r.chequeNo, r.party, r.bankName, r.amount, clearedText(r), r.voucherNo]
    : [String(r.serial), fmtDate(r.date), r.chequeNo, r.chequeDate ? fmtDate(r.chequeDate) : '', r.party, r.bankName, r.amount, clearedText(r), r.voucherNo];
  const fileBase = `${tab === 'issued' ? 'cheque-issue' : 'cheque-collection'}-register-${from || 'start'}-to-${to || 'end'}`;
  const exportCsv = () => downloadCSV(head, rows.map(r => cells(r).map(c => (typeof c === 'number' ? c.toFixed(2) : c))), `${fileBase}.csv`);
  const exportExcel = () => downloadExcelSingle(head, rows.map(cells), fileBase, tab === 'issued' ? 'Cheque Issue' : 'Cheque Collection');
  const exportPdf = () => { const en = build(false); generateChequeRegisterPDF(tab, tab === 'issued' ? en.issued : en.received, society, from || undefined, to || undefined); };

  const table = (list: ChequeRow[], kind: 'issued' | 'received') => list.length === 0 ? (
    <p className="text-sm text-muted-foreground py-4">
      {kind === 'issued'
        ? (hi ? 'इस अवधि में कोई cheque जारी दर्ज नहीं है।' : 'No cheque issued in this period.')
        : (hi ? 'इस अवधि में कोई cheque / DD प्राप्त दर्ज नहीं है।' : 'No cheque / DD received in this period.')}
    </p>
  ) : (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{hi ? 'क्र.' : 'Sr.'}</TableHead>
            <TableHead>{hi ? 'तारीख़' : 'Date'}</TableHead>
            <TableHead>{kind === 'issued' ? (hi ? 'चेक नं.' : 'Cheque No.') : (hi ? 'चेक / ड्राफ्ट नं. व तारीख़' : 'Cheque / DD No. & date')}</TableHead>
            <TableHead className="min-w-[160px]">{kind === 'issued' ? (hi ? 'किसके नाम' : 'Drawn in favour of') : (hi ? 'किससे प्राप्त' : 'Received from')}</TableHead>
            <TableHead>{kind === 'issued' ? (hi ? 'बैंक' : 'Bank') : (hi ? 'किस खाते में जमा' : 'Deposited in')}</TableHead>
            <TableHead className="text-right">{hi ? 'रकम' : 'Amount'}</TableHead>
            <TableHead>{kind === 'issued' ? (hi ? 'भुगतान की तारीख़' : 'Presented on') : (hi ? 'वसूली की तारीख़' : 'Realised on')}</TableHead>
            <TableHead>{hi ? 'वाउचर' : 'Voucher'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map(r => (
            <TableRow key={`${r.voucherId}-${r.bankAccountId}-${kind}`}>
              <TableCell>{r.serial}</TableCell>
              <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell>
              <TableCell className="whitespace-nowrap font-medium">{r.chequeNo}{kind === 'received' && r.chequeDate ? <span className="text-muted-foreground font-normal"> / {fmtDate(r.chequeDate)}</span> : null}</TableCell>
              <TableCell>{r.party}</TableCell>
              <TableCell>{r.bankName}</TableCell>
              <TableCell className="text-right tabular-nums">{rupees(r.amount)}</TableCell>
              <TableCell className="whitespace-nowrap">
                {r.cleared
                  ? clearedText(r)
                  : <Badge variant="outline" className={r.daysPending !== undefined && r.daysPending > 30 ? 'border-red-400 text-red-700' : 'border-amber-400 text-amber-700'}>
                      {hi ? `बाकी — ${r.daysPending} दिन` : `Pending — ${r.daysPending} d`}
                    </Badge>}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{r.voucherNo}</TableCell>
            </TableRow>
          ))}
          <TableRow className="border-t-2 font-semibold">
            <TableCell colSpan={5}>{hi ? 'कुल' : 'Total'}</TableCell>
            <TableCell className="text-right tabular-nums">{rupees(list.reduce((s, r) => s + r.amount, 0))}</TableCell>
            <TableCell colSpan={2} />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );

  const period = hi ? `अवधि: ${from || 'शुरू से'} — ${to || 'अब तक'}` : `Period: ${from || 'start'} — ${to || 'today'}`;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <PrintHeader />
      <div className="flex items-start gap-3 flex-wrap">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 print:hidden">
          <Landmark className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{hi ? 'चेक रजिस्टर' : 'Cheque Register'}</h1>
          <p className="text-sm text-muted-foreground">
            {hi
              ? 'जारी और प्राप्त cheque / DD — वाउचर में भरे cheque नं. से; वसूली की तारीख़ बैंक मिलान से (HAFED Accounts Manual, Proforma IV/1, IV/2)।'
              : 'Cheques / DDs issued and received — from the cheque no. on each voucher; the date of realisation from the bank reconciliation (HAFED Accounts Manual, Proformas IV/1, IV/2).'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={exportPdf} className="gap-1"><FileText className="h-4 w-4" />PDF</Button>
          <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1"><FileSpreadsheet className="h-4 w-4" />Excel</Button>
          {rows.length > 0 && <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1"><Download className="h-4 w-4" />CSV</Button>}
          <PrintButton />
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="pt-6 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="cq-from">{hi ? 'से' : 'From'}</Label>
            <Input id="cq-from" type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-44" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cq-to">{hi ? 'तक' : 'To'}</Label>
            <Input id="cq-to" type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-44" />
          </div>
          <div className="space-y-1">
            <Label>{hi ? 'बैंक खाता' : 'Bank account'}</Label>
            <Select value={bankId} onValueChange={setBankId}>
              <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{hi ? 'सभी बैंक खाते' : 'All bank accounts'}</SelectItem>
                {bankIds.map(id => { const a = accounts.find(x => x.id === id); return <SelectItem key={id} value={id}>{a ? (hi && a.nameHi ? a.nameHi : a.name) : id}</SelectItem>; })}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">{period}</p>
        </CardContent>
      </Card>
      <p className="hidden print:block text-sm">{period}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
        {[
          { label: hi ? 'जारी cheque' : 'Cheques issued', value: `${reg.totals.issued.count} · ${rupees(reg.totals.issued.amount)}` },
          { label: hi ? 'जारी — बैंक में अभी नहीं पहुँचे' : 'Issued — not yet presented', value: `${reg.totals.issued.pendingCount} · ${rupees(reg.totals.issued.pendingAmount)}` },
          { label: hi ? 'प्राप्त cheque / DD' : 'Cheques / DDs received', value: `${reg.totals.received.count} · ${rupees(reg.totals.received.amount)}` },
          { label: hi ? 'प्राप्त — अभी वसूल नहीं' : 'Received — not yet realised', value: `${reg.totals.received.pendingCount} · ${rupees(reg.totals.received.pendingAmount)}` },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-base font-semibold tabular-nums">{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as 'issued' | 'received')}>
        <TabsList className="print:hidden">
          <TabsTrigger value="issued">{hi ? `जारी (${reg.issued.length})` : `Issued (${reg.issued.length})`}</TabsTrigger>
          <TabsTrigger value="received">{hi ? `प्राप्त (${reg.received.length})` : `Received (${reg.received.length})`}</TabsTrigger>
        </TabsList>
        <TabsContent value="issued">
          <Card><CardContent className="pt-6">
            <h2 className="hidden print:block font-semibold mb-2">{hi ? 'चेक जारी रजिस्टर' : 'Cheque Issue Register'}</h2>
            {table(reg.issued, 'issued')}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="received">
          <Card><CardContent className="pt-6">
            <h2 className="hidden print:block font-semibold mb-2">{hi ? 'चेक प्राप्ति रजिस्टर' : 'Cheque Collection Register'}</h2>
            {table(reg.received, 'received')}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardContent className="pt-6 text-xs text-muted-foreground space-y-1">
          <p>{hi
            ? 'Cheque नं. वाउचर बनाते या edit करते समय भरें — "Cheque / DD नं." खाना तभी दिखता है जब वाउचर की एक तरफ़ बैंक खाता हो।'
            : 'Enter the cheque no. when making or editing a voucher — the "Cheque / DD no." field shows when one side of the voucher is a bank account.'}{' '}
            <Link to="/vouchers" className="underline">{hi ? 'वाउचर' : 'Vouchers'}</Link>
          </p>
          <p>{hi
            ? 'भुगतान / वसूली की तारीख़ बैंक मिलान से आती है — वहाँ entry को "clear" करें।'
            : 'The presented / realised date comes from the bank reconciliation — mark the entry cleared there.'}{' '}
            <Link to="/bank-reconciliation" className="underline">{hi ? 'बैंक मिलान' : 'Bank Reconciliation'}</Link>
          </p>
          {reg.bankVouchersWithoutCheque > 0 && (
            <p className="text-amber-700">{hi
              ? `इस अवधि में ${reg.bankVouchersWithoutCheque} बैंक वाउचर में cheque नं. नहीं भरा है — वे इस रजिस्टर में नहीं हैं (online / NEFT हो तो ठीक है)।`
              : `${reg.bankVouchersWithoutCheque} bank voucher(s) in this period carry no cheque no. and are not in this register (fine for online / NEFT).`}</p>
          )}
          <p>{hi ? 'रद्द और मंज़ूरी के इंतज़ार वाले वाउचर शामिल नहीं हैं। PDF में कैशियर और अधिकारी के हस्ताक्षर के कॉलम ख़ाली हैं।' : 'Cancelled vouchers and vouchers awaiting approval are left out. The PDF leaves the cashier and officer initials blank.'}</p>
        </CardContent>
      </Card>
    </div>
  );
}

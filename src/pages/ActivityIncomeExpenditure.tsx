/**
 * Activity-wise Income & Expenditure (गतिविधि-वार आय-व्यय) — CM-PACS / multipurpose societies.
 * Splits the year's income / expense by the activity a voucher was tagged with (Voucher.costCentreId).
 * RULE 2: same voucher set (counted + active branch) and FY window as the Trial Balance / P&L; the
 * difference to the P&L surplus (Trading stock, which no voucher carries) is shown as its own line.
 */
import { Fragment, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Layers, Download } from 'lucide-react';
import { ACTIVITY_CATALOG } from '@/lib/navigation/activities';
import { computeActivityPL, UNALLOCATED } from '@/lib/reports/activityPL';
import { isCountedVoucher } from '@/lib/countedVoucher';
import { fyStartFromLabel } from '@/lib/fyPeriod';
import { downloadCSV } from '@/lib/exportUtils';

export default function ActivityIncomeExpenditure() {
  const { vouchers, accounts, society, matchesActiveBranch, getProfitLoss } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';

  const fyStart = fyStartFromLabel(society.financialYear);
  const fyEnd = `20${(society.financialYear || '').split('-')[1]}-03-31`;

  const result = useMemo(() => computeActivityPL({
    vouchers: vouchers.filter(v => isCountedVoucher(v) && matchesActiveBranch(v.branchId)),
    accounts,
    from: fyStart,
    to: fyEnd,
  }), [vouchers, accounts, fyStart, fyEnd, matchesActiveBranch]);

  const plNet = useMemo(() => Math.round((getProfitLoss().netProfit || 0) * 100), [getProfitLoss]);
  const stockAdj = plNet - result.totalNet;

  const rupees = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const colLabel = (c: string) => {
    if (c === UNALLOCATED) return hi ? 'साझा / बिना गतिविधि' : 'Common / untagged';
    const d = ACTIVITY_CATALOG.find(a => a.code === c);
    return d ? (hi ? d.labelHi : d.label) : c;
  };
  const accName = (r: { name: string; nameHi?: string }) => (hi && r.nameHi ? r.nameHi : r.name);
  const netClass = (n: number) => (n > 0 ? 'text-emerald-600' : n < 0 ? 'text-destructive' : 'text-muted-foreground');
  const cols = result.columns;
  const tagged = cols.some(c => c !== UNALLOCATED);

  const exportCsv = () => {
    const headers = [hi ? 'खाता' : 'Account', ...cols.map(colLabel), hi ? 'कुल' : 'Total'];
    const r = (p: number) => (p / 100).toFixed(2);
    const rows = [
      ...result.rows.map(x => [`${x.accountId} ${accName(x)}`, ...cols.map(c => r(x.byColumn[c] ?? 0)), r(x.total)]),
      [hi ? 'कुल आय' : 'Total income', ...cols.map(c => r(result.income[c])), r(result.totalIncome)],
      [hi ? 'कुल व्यय' : 'Total expenditure', ...cols.map(c => r(result.expense[c])), r(result.totalExpense)],
      [hi ? 'अधिशेष / (घाटा)' : 'Surplus / (deficit)', ...cols.map(c => r(result.net[c])), r(result.totalNet)],
    ];
    downloadCSV(headers, rows, `activity-income-expenditure-${society.financialYear}.csv`);
  };

  const section = (kind: 'income' | 'expense') => result.rows.filter(r => r.kind === kind);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Layers className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{hi ? 'गतिविधि-वार आय-व्यय' : 'Activity-wise Income & Expenditure'}</h1>
          <p className="text-sm text-muted-foreground">
            {hi ? `वित्त वर्ष ${society.financialYear} — हर गतिविधि (खाद दुकान, CSC, परिवहन …) की आय, व्यय और अधिशेष` : `FY ${society.financialYear} — income, expenditure and surplus of each business activity`}
          </p>
        </div>
      </div>

      {!tagged && (
        <Card>
          <CardContent className="pt-6 text-sm space-y-2">
            <p>{hi ? 'अभी किसी वाउचर पर गतिविधि नहीं चुनी गई है, इसलिए सारी रकम "साझा" कॉलम में है।' : 'No voucher carries an activity yet, so everything is in the "common" column.'}</p>
            <p className="text-muted-foreground">
              {hi ? 'नया वाउचर बनाते समय "गतिविधि (वैकल्पिक)" चुनें — ' : 'Pick "Activity (optional)" when you create a voucher — '}
              <Link to="/vouchers" className="underline">{hi ? 'वाउचर पर जाएँ' : 'go to Vouchers'}</Link>
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            <span>{hi ? 'गतिविधि-वार विवरण' : 'By activity'}</span>
            {result.rows.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1"><Download className="h-4 w-4" />CSV</Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {result.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{hi ? 'इस वित्त वर्ष में कोई आय/व्यय दर्ज नहीं है।' : 'No income or expenditure recorded in this financial year.'}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">{hi ? 'खाता' : 'Account'}</TableHead>
                    {cols.map(c => <TableHead key={c} className="text-right whitespace-nowrap">{colLabel(c)}</TableHead>)}
                    <TableHead className="text-right">{hi ? 'कुल' : 'Total'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(['income', 'expense'] as const).map(kind => (
                    <Fragment key={kind}>
                      <TableRow key={`${kind}-h`} className="bg-muted/40">
                        <TableCell colSpan={cols.length + 2} className="font-semibold">{kind === 'income' ? (hi ? 'आय' : 'Income') : (hi ? 'व्यय' : 'Expenditure')}</TableCell>
                      </TableRow>
                      {section(kind).map(r => (
                        <TableRow key={r.accountId}>
                          <TableCell>{r.accountId} · {accName(r)}</TableCell>
                          {cols.map(c => <TableCell key={c} className="text-right tabular-nums">{r.byColumn[c] ? rupees(r.byColumn[c]) : '—'}</TableCell>)}
                          <TableCell className="text-right tabular-nums font-medium">{rupees(r.total)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow key={`${kind}-t`} className="font-semibold">
                        <TableCell>{kind === 'income' ? (hi ? 'कुल आय' : 'Total income') : (hi ? 'कुल व्यय' : 'Total expenditure')}</TableCell>
                        {cols.map(c => <TableCell key={c} className="text-right tabular-nums">{rupees((kind === 'income' ? result.income : result.expense)[c])}</TableCell>)}
                        <TableCell className="text-right tabular-nums">{rupees(kind === 'income' ? result.totalIncome : result.totalExpense)}</TableCell>
                      </TableRow>
                    </Fragment>
                  ))}
                  <TableRow className="border-t-2 font-bold">
                    <TableCell>{hi ? 'अधिशेष / (घाटा)' : 'Surplus / (deficit)'}</TableCell>
                    {cols.map(c => <TableCell key={c} className={`text-right tabular-nums ${netClass(result.net[c])}`}>{rupees(result.net[c])}</TableCell>)}
                    <TableCell className={`text-right tabular-nums ${netClass(result.totalNet)}`}>{rupees(result.totalNet)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {result.rows.length > 0 && (
        <Card>
          <CardContent className="pt-6 text-sm space-y-1">
            <div className="flex justify-between gap-4"><span>{hi ? 'वाउचरों से अधिशेष (ऊपर का कुल)' : 'Surplus from vouchers (total above)'}</span><span className="tabular-nums">{rupees(result.totalNet)}</span></div>
            {stockAdj !== 0 && (
              <div className="flex justify-between gap-4"><span>{hi ? 'स्टॉक समायोजन — व्यापार खाते का प्रारंभिक/अंतिम स्टॉक (किसी गतिविधि में नहीं बाँटा गया)' : 'Stock adjustment — Trading opening/closing stock (not allocated to an activity)'}</span><span className="tabular-nums">{rupees(stockAdj)}</span></div>
            )}
            <div className="flex justify-between gap-4 font-semibold border-t pt-1"><span>{hi ? 'लाभ-हानि / आय-व्यय खाते का अधिशेष' : 'Surplus as per P&L / I&E'}</span><span className="tabular-nums">{rupees(plNet)}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

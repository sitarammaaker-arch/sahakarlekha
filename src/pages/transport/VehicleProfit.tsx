/**
 * वाहन-वार लाभ (Vehicle-wise Profit) — trip income minus running cost minus the linked asset's depreciation,
 * per vehicle, for the financial year. RULE 2: computed from the VOUCHER LINES (counted + active branch, the
 * Activity I&E page's set), the document only says which vehicle a voucher belongs to. Transport income / cost
 * that no trip / expense document tags is shown as "unallocated", never guessed onto a vehicle.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTransportOps } from '@/contexts/TransportOpsContext';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Download } from 'lucide-react';
import { computeVehicleProfit } from '@/lib/transport/vehicleProfit';
import { resolveTransportAccounts, TRANSPORT_EXPENSE_ROLES, TRANSPORT_INCOME_ROLES } from '@/lib/transport/accounts';
import { isCountedVoucher } from '@/lib/countedVoucher';
import { fyStartFromLabel } from '@/lib/fyPeriod';
import { downloadCSV } from '@/lib/exportUtils';

export default function VehicleProfit() {
  const { vehicles, trips, vehicleExpenses } = useTransportOps();
  const { vouchers, accounts, assets, society, matchesActiveBranch } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';

  const fyStart = fyStartFromLabel(society.financialYear);
  const fyEnd = `20${(society.financialYear || '').split('-')[1]}-03-31`;

  const result = useMemo(() => {
    const ids = resolveTransportAccounts(accounts);
    const pick = (roles: readonly (keyof typeof ids)[]) => roles.map(r => ids[r]).filter((x): x is string => !!x);
    return computeVehicleProfit({
      vouchers: vouchers.filter(v => isCountedVoucher(v) && matchesActiveBranch(v.branchId)),
      accounts, vehicles, trips, expenses: vehicleExpenses, assets,
      transportIncomeIds: pick(TRANSPORT_INCOME_ROLES), transportExpenseIds: pick(TRANSPORT_EXPENSE_ROLES),
      from: fyStart, to: fyEnd,
    });
  }, [vouchers, accounts, vehicles, trips, vehicleExpenses, assets, fyStart, fyEnd, matchesActiveBranch]);

  const rupees = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const netClass = (n: number) => (n > 0 ? 'text-emerald-600' : n < 0 ? 'text-destructive' : 'text-muted-foreground');
  const r2 = (p: number) => (p / 100).toFixed(2);

  const exportCsv = () => {
    const headers = hi ? ['वाहन', 'ट्रिप', 'आय', 'चालन खर्च', 'मूल्यह्रास', 'शुद्ध लाभ'] : ['Vehicle', 'Trips', 'Income', 'Running cost', 'Depreciation', 'Net'];
    const rows = [
      ...result.rows.map(x => [x.regNo, String(x.trips), r2(x.income), r2(x.runningCost), r2(x.depreciation), r2(x.net)]),
      [hi ? 'कुल' : 'Total', String(result.totals.trips), r2(result.totals.income), r2(result.totals.runningCost), r2(result.totals.depreciation), r2(result.totals.net)],
      [hi ? 'बिना वाहन (अनावंटित)' : 'Unallocated (no vehicle)', '', r2(result.unallocatedIncome), r2(result.unallocatedCost), '', r2(result.unallocatedIncome - result.unallocatedCost)],
    ];
    downloadCSV(headers, rows, `vehicle-profit-${society.financialYear}.csv`);
  };

  const hasUnallocated = result.unallocatedIncome !== 0 || result.unallocatedCost !== 0;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><TrendingUp className="h-6 w-6 text-primary" /></div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{hi ? 'वाहन-वार लाभ' : 'Vehicle-wise Profit'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? `वित्त वर्ष ${society.financialYear} — हर वाहन की भाड़ा आय, खर्च और लाभ` : `FY ${society.financialYear} — each vehicle's freight income, cost and profit`}</p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv} disabled={result.rows.length === 0}><Download className="h-4 w-4 mr-1" />CSV</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'वाहन-वार हिसाब' : 'By vehicle'}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {result.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{hi ? 'अभी कोई वाहन नहीं — ' : 'No vehicles yet — '}<Link to="/transport-vehicles" className="text-primary underline">{hi ? 'वाहन जोड़ें' : 'add one'}</Link></p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'वाहन' : 'Vehicle'}</TableHead>
                  <TableHead className="text-right">{hi ? 'ट्रिप' : 'Trips'}</TableHead>
                  <TableHead className="text-right">{hi ? 'आय' : 'Income'}</TableHead>
                  <TableHead className="text-right">{hi ? 'चालन खर्च' : 'Running cost'}</TableHead>
                  <TableHead className="text-right">{hi ? 'मूल्यह्रास' : 'Depreciation'}</TableHead>
                  <TableHead className="text-right">{hi ? 'शुद्ध लाभ' : 'Net'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map(x => (
                  <TableRow key={x.vehicleId}>
                    <TableCell className="font-medium">{x.regNo}</TableCell>
                    <TableCell className="text-right">{x.trips}</TableCell>
                    <TableCell className="text-right">{rupees(x.income)}</TableCell>
                    <TableCell className="text-right">{rupees(x.runningCost)}</TableCell>
                    <TableCell className="text-right">{rupees(x.depreciation)}</TableCell>
                    <TableCell className={`text-right font-medium ${netClass(x.net)}`}>{rupees(x.net)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold border-t-2">
                  <TableCell>{hi ? 'कुल' : 'Total'}</TableCell>
                  <TableCell className="text-right">{result.totals.trips}</TableCell>
                  <TableCell className="text-right">{rupees(result.totals.income)}</TableCell>
                  <TableCell className="text-right">{rupees(result.totals.runningCost)}</TableCell>
                  <TableCell className="text-right">{rupees(result.totals.depreciation)}</TableCell>
                  <TableCell className={`text-right ${netClass(result.totals.net)}`}>{rupees(result.totals.net)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {hasUnallocated && (
        <Card className="border-amber-300">
          <CardContent className="pt-6 text-sm space-y-1">
            <p className="font-medium">{hi ? 'बिना वाहन की परिवहन आय / खर्च' : 'Transport income / cost with no vehicle'}</p>
            <p>{hi ? 'आय' : 'Income'} {rupees(result.unallocatedIncome)} · {hi ? 'खर्च' : 'Cost'} {rupees(result.unallocatedCost)}</p>
            <p className="text-muted-foreground">{hi ? 'ये सीधे वाउचर से दर्ज हुए (ट्रिप या वाहन-खर्च से नहीं), इसलिए किसी वाहन पर नहीं गिने गए। आगे से भाड़ा "ट्रिप" में और डीज़ल-मरम्मत "वाहन खर्च" में दर्ज करें।' : 'These were entered as plain vouchers (not through a trip or vehicle expense), so no vehicle carries them. Enter freight as a Trip and running costs as a Vehicle Expense from now on.'}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Member / non-member turnover (सदस्य / गैर-सदस्य कारोबार).
 * Purchases from and sales to members, nominal / associate members and non-members, account-wise, for a period.
 * The tag comes from the bill (Sale / Purchase "सदस्य को बिक्री / सदस्य से खरीद"). Read-only; the calculation is
 * lib/memberTurnover (pure, tested). Why it matters: Income-tax Act 2025 s.149 (formerly 80P) gives the deduction
 * on members' business; the HAFED Accounts Manual (1976) keeps the two apart for that reason.
 */
import { useMemo, useState } from 'react';
import { Link } from '@/components/LocalLink';
import { useData } from '@/contexts/DataContext';
import { useConsumerData } from '@/contexts/ConsumerDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Download } from 'lucide-react';
import { PrintButton, PrintHeader } from '@/components/ReportPrint';
import { buildMemberTurnover, memberSharePct, type TurnoverSide } from '@/lib/memberTurnover';
import { societyFyStart } from '@/lib/fyPeriod';
import { downloadCSV } from '@/lib/exportUtils';

export default function MemberTurnover() {
  const { society, sales, purchases, members, stockItems, accounts, matchesActiveBranch } = useData();
  const { salesReturns, purchaseReturns } = useConsumerData();
  const { language } = useLanguage();
  const hi = language === 'hi';

  const fyStart = societyFyStart(society) ?? '';
  const fyEnd = fyStart ? `${Number(fyStart.slice(0, 4)) + 1}-03-31` : '';
  const [from, setFrom] = useState(fyStart);
  const [to, setTo] = useState(fyEnd);

  const result = useMemo(() => buildMemberTurnover({
    sales: sales.filter(s => matchesActiveBranch(s.branchId)),
    purchases: purchases.filter(p => matchesActiveBranch(p.branchId)),
    salesReturns,
    purchaseReturns,
    members,
    stockItems,
    accounts,
    from: from || undefined,
    to: to || undefined,
  }), [sales, purchases, salesReturns, purchaseReturns, members, stockItems, accounts, from, to, matchesActiveBranch]);

  const rupees = (n: number) => (n ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—');
  const accName = (r: { accountName: string; accountNameHi?: string }) => (hi && r.accountNameHi ? r.accountNameHi : r.accountName);
  const showNominal = result.sales.totals.nominal !== 0 || result.purchases.totals.nominal !== 0;
  const nothingTagged = result.sales.bills.member + result.sales.bills.nominal + result.purchases.bills.member + result.purchases.bills.nominal === 0;
  const hasAny = result.sales.rows.length + result.purchases.rows.length > 0;

  const head = {
    account: hi ? 'खाता' : 'Account',
    member: hi ? 'सदस्य' : 'Members',
    nominal: hi ? 'नाममात्र / सहयोगी सदस्य' : 'Nominal / associate',
    nonMember: hi ? 'गैर-सदस्य' : 'Non-members',
    total: hi ? 'कुल' : 'Total',
    share: hi ? 'सदस्यों का हिस्सा' : 'Members’ share',
  };

  const exportCsv = () => {
    const headers = [hi ? 'भाग' : 'Side', head.account, head.member, head.nominal, head.nonMember, head.total];
    const r = (n: number) => n.toFixed(2);
    const part = (label: string, s: TurnoverSide) => [
      ...s.rows.map(x => [label, `${x.accountId} ${accName(x)}`, r(x.member), r(x.nominal), r(x.nonMember), r(x.total)]),
      [label, hi ? 'कुल' : 'Total', r(s.totals.member), r(s.totals.nominal), r(s.totals.nonMember), r(s.totals.total)],
    ];
    downloadCSV(headers, [...part(hi ? 'खरीद' : 'Purchases', result.purchases), ...part(hi ? 'बिक्री' : 'Sales', result.sales)],
      `member-turnover-${from || 'start'}-to-${to || 'end'}.csv`);
  };

  const sideTable = (title: string, s: TurnoverSide, billWord: string) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
          <span>{title}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {head.share}: <span className="font-semibold text-foreground">{memberSharePct(s.totals)}%</span>
            {' · '}{hi ? `बिल — सदस्य ${s.bills.member}, गैर-सदस्य ${s.bills.nonMember}` : `${billWord} — members ${s.bills.member}, non-members ${s.bills.nonMember}`}
            {s.bills.nominal > 0 && (hi ? `, नाममात्र/सहयोगी ${s.bills.nominal}` : `, nominal/associate ${s.bills.nominal}`)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {s.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{hi ? 'इस अवधि में कुछ दर्ज नहीं है।' : 'Nothing recorded in this period.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">{head.account}</TableHead>
                  <TableHead className="text-right">{head.member}</TableHead>
                  {showNominal && <TableHead className="text-right">{head.nominal}</TableHead>}
                  <TableHead className="text-right">{head.nonMember}</TableHead>
                  <TableHead className="text-right">{head.total}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.rows.map(r => (
                  <TableRow key={r.accountId}>
                    <TableCell>{r.accountId} · {accName(r)}</TableCell>
                    <TableCell className="text-right tabular-nums">{rupees(r.member)}</TableCell>
                    {showNominal && <TableCell className="text-right tabular-nums">{rupees(r.nominal)}</TableCell>}
                    <TableCell className="text-right tabular-nums">{rupees(r.nonMember)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{rupees(r.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>{hi ? 'कुल' : 'Total'}</TableCell>
                  <TableCell className="text-right tabular-nums">{rupees(s.totals.member)}</TableCell>
                  {showNominal && <TableCell className="text-right tabular-nums">{rupees(s.totals.nominal)}</TableCell>}
                  <TableCell className="text-right tabular-nums">{rupees(s.totals.nonMember)}</TableCell>
                  <TableCell className="text-right tabular-nums">{rupees(s.totals.total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <PrintHeader />
      <div className="flex items-start gap-3 flex-wrap">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 print:hidden">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{hi ? 'सदस्य / गैर-सदस्य कारोबार' : 'Member / Non-member Turnover'}</h1>
          <p className="text-sm text-muted-foreground">
            {hi
              ? 'सदस्यों से खरीद और सदस्यों को बिक्री, गैर-सदस्यों से अलग — खाते-वार, GST से पहले की रकम (छूट घटाकर)।'
              : 'Purchases from and sales to members, apart from non-members — account-wise, taxable value (after discount, before GST).'}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          {hasAny && <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1"><Download className="h-4 w-4" />CSV</Button>}
          <PrintButton />
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="pt-6 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="mt-from">{hi ? 'से' : 'From'}</Label>
            <Input id="mt-from" type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-44" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mt-to">{hi ? 'तक' : 'To'}</Label>
            <Input id="mt-to" type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-44" />
          </div>
          <p className="text-xs text-muted-foreground print:block">
            {hi ? `अवधि: ${from || 'शुरू से'} — ${to || 'अब तक'}` : `Period: ${from || 'start'} — ${to || 'today'}`}
          </p>
        </CardContent>
      </Card>
      <p className="hidden print:block text-sm">{hi ? `अवधि: ${from || 'शुरू से'} — ${to || 'अब तक'}` : `Period: ${from || 'start'} — ${to || 'today'}`}</p>

      {nothingTagged && hasAny && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 print:hidden">
          <CardContent className="pt-6 text-sm space-y-1">
            <p>{hi ? 'इस अवधि में किसी बिल पर सदस्य नहीं चुना गया है, इसलिए सारा कारोबार "गैर-सदस्य" में है।' : 'No bill in this period names a member, so all business shows as non-members.'}</p>
            <p className="text-muted-foreground">
              {hi ? 'बिक्री / खरीद के फ़ॉर्म में "सदस्य को बिक्री?" / "सदस्य से खरीद?" चुनें। पुराना बिल edit करके भी चुन सकते हैं — ' : 'Pick "Sold to a member?" / "Bought from a member?" on the sale / purchase form; an old bill can be edited too — '}
              <Link to="/sales" className="underline">{hi ? 'बिक्री' : 'Sales'}</Link>
              {' · '}
              <Link to="/purchases" className="underline">{hi ? 'खरीद' : 'Purchases'}</Link>
            </p>
          </CardContent>
        </Card>
      )}

      {sideTable(hi ? 'खरीद — किससे खरीदा' : 'Purchases — bought from', result.purchases, 'bills')}
      {sideTable(hi ? 'बिक्री — किसे बेचा' : 'Sales — sold to', result.sales, 'bills')}

      <Card>
        <CardContent className="pt-6 text-xs text-muted-foreground space-y-1">
          <p>{hi
            ? 'वापसी (sales / purchase return) अपने मूल बिल की श्रेणी में घटाई गई है। मिटाए गए बिल शामिल नहीं हैं।'
            : 'Returns are subtracted in the class of their original bill. Deleted bills are left out.'}</p>
          <p>{hi
            ? 'नाममात्र और सहयोगी सदस्य अलग कॉलम में हैं — आयकर छूट में इन्हें गिनना है या नहीं, यह ऑडिटर तय करें। यह report छूट की रकम नहीं निकालती।'
            : 'Nominal and associate members are a separate column — whether they count for the income-tax deduction is for the auditor to decide. This report does not compute the deduction.'}</p>
          {result.unmatchedMemberBills > 0 && (
            <p className="text-amber-700">{hi
              ? `${result.unmatchedMemberBills} बिल ऐसे सदस्य के नाम हैं जो अब सदस्य-सूची में नहीं है; उन्हें सदस्य में गिना गया है।`
              : `${result.unmatchedMemberBills} bill(s) name a member no longer in the member list; they are counted as members.`}</p>
          )}
          <p>{hi ? 'MSP / सरकारी खरीद (Procurement) के लॉट इस report में नहीं हैं।' : 'MSP / government procurement lots are not in this report.'}</p>
        </CardContent>
      </Card>
    </div>
  );
}

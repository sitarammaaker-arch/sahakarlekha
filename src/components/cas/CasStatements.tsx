/**
 * NABARD CAS statements for PACS (Annexure II / III / IV) on screen. A reporting layer over the
 * society's own books: every figure comes from the pure builders in lib/cas/pacsCas.ts, fed by the
 * SAME trial balance / trading / P&L / balance-sheet rules the app's own statements use (RULE 2),
 * and each statement shows whether it ties to the app's own figure.
 */
import React, { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { navigationService, declaredActivities } from '@/lib/navigation';
import { balanceSheetLeaves } from '@/lib/balanceSheetLeaves';
import { buildCasBalanceSheet, buildCasProfitLoss, buildCasTrading, casBalanceSheetTies, type CasSection } from '@/lib/cas/pacsCas';
import { generateCasPdf } from '@/lib/cas/casPdf';
import { loanInterestDue } from '@/lib/loans/interestAccrual';
import { useLoanAccruals } from '@/hooks/useLoanAccruals';

const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);
const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

function Sections({ sections, hi, total, totalLabel }: { sections: CasSection[]; hi: boolean; total: number; totalLabel: string }) {
  return (
    <Table>
      <TableBody>
        {sections.map((s) => {
          const single = s.rows.length === 1 && s.rows[0].label === s.label;
          return (
            <React.Fragment key={s.id}>
              {!single && <TableRow className="bg-muted/40"><TableCell colSpan={2} className="font-semibold">{hi ? s.labelHi : s.label}</TableCell></TableRow>}
              {s.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className={single ? 'font-semibold' : 'pl-6'}>
                    {hi ? r.labelHi : r.label}
                    {r.catchAll && r.heads.length > 0 && (
                      <span className="block text-[11px] text-muted-foreground">
                        {hi ? 'इसमें: ' : 'Includes: '}{r.heads.map((h) => `${h.name} (${h.id})`).join(', ')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">{Math.abs(r.amount) < 0.005 ? '—' : fmt(r.amount)}</TableCell>
                </TableRow>
              ))}
              {!single && <TableRow><TableCell className="text-right text-xs text-muted-foreground">{hi ? 'योग' : 'Total'}</TableCell><TableCell className="text-right font-semibold whitespace-nowrap">{fmt(s.total)}</TableCell></TableRow>}
            </React.Fragment>
          );
        })}
        <TableRow className="border-t-2"><TableCell className="font-bold">{totalLabel}</TableCell><TableCell className="text-right font-bold whitespace-nowrap">{fmt(total)}</TableCell></TableRow>
      </TableBody>
    </Table>
  );
}

function Tie({ ok, hi, what }: { ok: boolean; hi: boolean; what: string }) {
  return ok
    ? <p className="flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="h-3.5 w-3.5" />{hi ? `ऐप के ${what} से मेल खाता है` : `Ties to the app's ${what}`}</p>
    : <p className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" />{hi ? `ऐप के ${what} से मेल नहीं — कृपया सूचित करें` : `Does not tie to the app's ${what} — please report`}</p>;
}

export function CasStatements({ hi }: { hi: boolean }) {
  const { society, societyCapabilities, societyActivities, getTrialBalance, getProfitLoss, getTradingAccount, loans, kccLoans, vouchers } = useData();
  const { accruals } = useLoanAccruals();
  const fyEnd = `20${(society.financialYear || '').split('-')[1]}-03-31`;

  const data = useMemo(() => {
    const tb = getTrialBalance(fyEnd);
    const appPL = getProfitLoss(fyEnd);
    const tr = getTradingAccount(fyEnd);
    // Same "trading society?" decision as DataContext.getProfitLoss (RULE 2).
    const hasTrading = navigationService.resolveCapabilities(society.societyType ?? 'other', societyCapabilities, society.state, declaredActivities(societyActivities), society.activitiesCutoverEnabled).has('inventory_sales');
    const leaves = balanceSheetLeaves(tb, { closingStockPosted: tr.closingStockPosted, physicalClosingStock: tr.physicalClosingStock, netProfit: appPL.netProfit });
    // Overdue part of each loan's open accrued interest — the same loanInterestDue as the repay dialogs.
    const overdue = [...loans.map((l) => l.id), ...kccLoans.map((k) => k.id)]
      .reduce((t, id) => { const d = loanInterestDue(id, accruals, vouchers); return t + Math.min(d.reserve, d.receivable); }, 0);
    const bs = buildCasBalanceSheet({ assetLeaves: leaves.assetLeaves, capLiabLeaves: leaves.capLiabLeaves, unpostedStock: leaves.unpostedStock, netProfit: appPL.netProfit, overdueInterestReceivable: overdue });
    const pl = buildCasProfitLoss(tb, { hasTrading, grossProfit: tr.grossProfit });
    const trading = hasTrading ? buildCasTrading(tb, { openingStock: tr.totalOpeningStock, closingStock: tr.totalClosingStock }) : null;
    return { bs, pl, trading, appNet: appPL.netProfit, appGross: tr.grossProfit, leaves };
  }, [getTrialBalance, getProfitLoss, getTradingAccount, fyEnd, society.societyType, society.state, society.activitiesCutoverEnabled, societyCapabilities, societyActivities, loans, kccLoans, accruals, vouchers]);

  const { bs, pl, trading } = data;
  const bsTies = casBalanceSheetTies(bs, data.leaves);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900 dark:bg-indigo-900/20 dark:text-indigo-200">
        <span>
          {hi
            ? 'NABARD Common Accounting System (CAS) के प्रारूप — Annexure II (व्यापार खाता), III (लाभ-हानि), IV (तुलन पत्र)। यह रिपोर्ट आपकी पुस्तकों से बनती है; खाते नहीं बदलते। जो खाता किसी CAS पंक्ति से नहीं जुड़ा, वह "अन्य" में दिखता है — कोई रकम नहीं छूटती।'
            : 'NABARD Common Accounting System (CAS) formats — Annexure II (Trading), III (P&L), IV (Balance Sheet). Built from your books; no account changes. A head with no CAS line shows under "Others" — nothing is dropped.'}
        </span>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => generateCasPdf(society, bs, pl, trading, fyEnd)}>
          <Download className="h-4 w-4" />PDF
        </Button>
      </div>

      {trading && (
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base">{hi ? 'Annexure II — व्यापार खाता' : 'Annexure II — Trading Account'}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Sections sections={trading.debit} hi={hi} total={trading.debit.reduce((t, s) => t + s.total, 0)} totalLabel={hi ? 'योग (Dr)' : 'Total (Dr)'} />
            <Sections sections={trading.credit} hi={hi} total={trading.total} totalLabel={hi ? 'योग (Cr)' : 'Total (Cr)'} />
            <div className="md:col-span-2"><Tie ok={near(trading.grossProfit, data.appGross)} hi={hi} what={hi ? 'व्यापार खाते (सकल लाभ)' : 'Trading Account (gross profit)'} /></div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">{hi ? 'Annexure III — लाभ-हानि खाता' : 'Annexure III — Profit and Loss Account'}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Sections sections={pl.expenditure} hi={hi} total={pl.expenditure.reduce((t, s) => t + s.total, 0)} totalLabel={hi ? 'योग' : 'Total'} />
          <Sections sections={pl.income} hi={hi} total={pl.total} totalLabel={hi ? 'योग' : 'Total'} />
          <div className="md:col-span-2"><Tie ok={near(pl.netProfit, data.appNet)} hi={hi} what={hi ? 'लाभ-हानि (शुद्ध लाभ)' : 'P&L (net profit)'} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">{hi ? 'Annexure IV — तुलन पत्र (Balance Sheet)' : 'Annexure IV — Balance Sheet'}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Sections sections={bs.liabilities} hi={hi} total={bs.totalLiabilities} totalLabel={hi ? 'कुल देनदारियाँ' : 'Total Liabilities'} />
          <Sections sections={bs.assets} hi={hi} total={bs.totalAssets} totalLabel={hi ? 'कुल परिसंपत्तियाँ' : 'Total Assets'} />
          <div className="md:col-span-2 space-y-1">
            <Tie ok={bsTies} hi={hi} what={hi ? 'तुलन पत्र' : 'Balance Sheet'} />
            {bs.overdueInterestProvision > 0 && (
              <p className="text-xs text-muted-foreground">
                {hi
                  ? `अतिदेय ब्याज संचय (2211) ${fmt(bs.overdueInterestProvision)} CAS के अनुसार परिसंपत्ति पक्ष में "घटाएँ: अतिदेय ब्याज प्रावधान" के रूप में दिखाया गया है, इसलिए दोनों योग ऐप के तुलन पत्र से इतना कम हैं।`
                  : `Overdue Interest Reserve (2211) ${fmt(bs.overdueInterestProvision)} is shown as "Less: Provision for overdue interest" on the asset side (CAS), so both totals are that much lower than the app's Balance Sheet.`}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * NABARD CAS statements for PACS (Annexure II / III / IV) on screen. A reporting layer over the
 * society's own books: every figure comes from the pure builders in lib/cas/pacsCas.ts, fed by the
 * SAME trial balance / trading / P&L / balance-sheet rules the app's own statements use (RULE 2),
 * and each statement shows whether it ties to the app's own figure.
 */
import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { navigationService, declaredActivities } from '@/lib/navigation';
import { balanceSheetLeaves } from '@/lib/balanceSheetLeaves';
import { buildCasBalanceSheet, buildCasProfitLoss, buildCasTrading, buildCasTrialBalance, casBalanceSheetTies, type CasSection, type CasTbRow } from '@/lib/cas/pacsCas';
import { generateCasPdf } from '@/lib/cas/casPdf';
import { loanInterestDue, kccAccruables } from '@/lib/loans/interestAccrual';
import { averagePosition, misPosition, misRatios, overdueClassification, plFlows, subtractFlows, membersAt, principalAt, loanFlowsBetween, depositBalanceAt, xviBalances, type XviPoint } from '@/lib/cas/pacsMis';
import { depositLedger, kccLedgerInput, loanLedger, memberLoanLedgerInput } from '@/lib/registers/subsidiaryLedgers';
import { CasMis } from './CasMis';
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

/** The 12 months of the FY: [label, first day, last day]. */
function fyMonths(fy: string): { key: string; from: string; to: string; label: string }[] {
  const y0 = parseInt((fy || '').split('-')[0], 10);
  if (!y0) return [];
  return Array.from({ length: 12 }, (_, i) => {
    const y = i < 9 ? y0 : y0 + 1, m = ((i + 3) % 12) + 1;
    const mm = String(m).padStart(2, '0');
    const last = new Date(y, m, 0).getDate();
    return { key: `${y}-${mm}`, from: `${y}-${mm}-01`, to: `${y}-${mm}-${last}`, label: new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' }) };
  });
}
const dayBefore = (iso: string) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function TbTable({ rows, hi, total, title }: { rows: CasTbRow[]; hi: boolean; total: number; title: string }) {
  const cell = (n: number) => (Math.abs(n) < 0.005 ? '—' : fmt(n));
  return (
    <div className="overflow-x-auto">
      <p className="text-sm font-semibold mb-1">{title}</p>
      <Table>
        <TableBody>
          <TableRow className="bg-muted/40 text-xs">
            <TableCell>{hi ? 'खाता शीर्ष (CAS)' : 'Head of account (CAS)'}</TableCell>
            <TableCell className="text-right">{hi ? 'माह का प्रारंभिक शेष' : 'Opening (start of month)'}</TableCell>
            <TableCell className="text-right">{hi ? 'माह में नाम' : 'Debit in month'}</TableCell>
            <TableCell className="text-right">{hi ? 'माह में जमा' : 'Credit in month'}</TableCell>
            <TableCell className="text-right">{hi ? 'अंतिम शेष' : 'Closing'}</TableCell>
          </TableRow>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{hi ? r.labelHi : r.label}<span className="block text-[11px] text-muted-foreground">{r.heads.map((h) => h.id).join(', ')}</span></TableCell>
              <TableCell className="text-right whitespace-nowrap">{cell(r.opening)}</TableCell>
              <TableCell className="text-right whitespace-nowrap">{cell(r.debit)}</TableCell>
              <TableCell className="text-right whitespace-nowrap">{cell(r.credit)}</TableCell>
              <TableCell className="text-right whitespace-nowrap font-medium">{cell(r.closing)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="border-t-2"><TableCell colSpan={4} className="font-bold">{hi ? 'योग' : 'Total'}</TableCell><TableCell className="text-right font-bold whitespace-nowrap">{fmt(total)}</TableCell></TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function Tie({ ok, hi, what, detail }: { ok: boolean; hi: boolean; what: string; detail?: string }) {
  return ok
    ? <p className="flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="h-3.5 w-3.5" />{hi ? `ऐप के ${what} से मेल खाता है` : `Ties to the app's ${what}`}</p>
    : <p className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" />{hi ? `ऐप के ${what} से मेल नहीं — कृपया सूचित करें` : `Does not tie to the app's ${what} — please report`}{detail ? ` (${detail})` : ''}</p>;
}

export function CasStatements({ hi }: { hi: boolean }) {
  const { society, societyCapabilities, societyActivities, getTrialBalance, getProfitLoss, getTradingAccount, loans, kccLoans, vouchers, members, accounts, depositAccounts, getDepositTransactions } = useData();
  const { accruals } = useLoanAccruals();
  const fyEnd = `20${(society.financialYear || '').split('-')[1]}-03-31`;
  // Annexure I is monthly: default = the latest month of the FY that has started.
  const months = useMemo(() => fyMonths(society.financialYear), [society.financialYear]);
  const today = new Date().toISOString().slice(0, 10);
  const [tbMonth, setTbMonth] = useState(() => (months.filter((m) => m.from <= today).pop() ?? months[months.length - 1])?.key ?? '');

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
    // MIS (CAS-2b): month-end CAS Balance Sheets for the Annexure XVII averages — built by the SAME
    // leaves rule + builder as Annexure IV. The overdue-interest split does not move any XVII figure.
    const bsAt = (date: string) => {
      const t = getTrialBalance(date), p = getProfitLoss(date), r = getTradingAccount(date);
      const lv = balanceSheetLeaves(t, { closingStockPosted: r.closingStockPosted, physicalClosingStock: r.physicalClosingStock, netProfit: p.netProfit });
      return buildCasBalanceSheet({ assetLeaves: lv.assetLeaves, capLiabLeaves: lv.capLiabLeaves, unpostedStock: lv.unpostedStock, netProfit: p.netProfit, overdueInterestReceivable: 0 });
    };
    const misAsOf = today < fyEnd ? today : fyEnd;
    const monthBs = months.filter((m) => m.to <= misAsOf).map((m) => ({ to: m.to, bs: bsAt(m.to) }));
    const monthEnds = monthBs.map((x) => misPosition(x.bs));
    // Annexure XVI: counts and loan flows from the subsidiary ledgers (the SAME rows the Loan /
    // Deposit Ledger downloads show); money from the CAS Balance Sheet / P&L at each date.
    const isIncome = (id: string) => accounts.find((a) => a.id === id)?.type === 'income';
    const loanBooks = [
      ...loans.filter((l) => !l.isDeleted).map((l) => ({ memberId: l.memberId, rows: loanLedger(memberLoanLedgerInput(l), vouchers, accruals, isIncome).rows })),
      ...kccLoans.map((k) => ({ memberId: k.memberId, rows: loanLedger(kccLedgerInput(k), vouchers, accruals, isIncome).rows })),
    ];
    const depBooks = depositAccounts.map((d) => ({ memberId: d.memberId, rows: depositLedger(getDepositTransactions(d.id)).rows }));
    const fyBefore = months.length ? dayBefore(months[0].from) : null;
    const plAt = (date: string) => plFlows(buildCasProfitLoss(getTrialBalance(date), { hasTrading, grossProfit: getTradingAccount(date).grossProfit }));
    const avgAssets = (xs: { bs: { totalAssets: number } }[]) => (xs.length ? Math.round((xs.reduce((t, x) => t + x.bs.totalAssets, 0) / xs.length) * 100) / 100 : null);
    const pointAt = (date: string, after: string | null, sheet: typeof bs, flows: ReturnType<typeof plFlows>, monthsIn: typeof monthBs): XviPoint => {
      const lf = loanBooks.reduce((t, b) => { const f = loanFlowsBetween(b.rows, after, date); return { issued: t.issued + f.issued, recovered: t.recovered + f.recovered }; }, { issued: 0, recovered: 0 });
      return {
        members: membersAt(members, date),
        borrowers: new Set(loanBooks.filter((b) => principalAt(b.rows, date) > 0.005).map((b) => b.memberId)).size,
        depositors: new Set(depBooks.filter((b) => depositBalanceAt(b.rows, date) > 0.005).map((b) => b.memberId)).size,
        ...xviBalances(sheet),
        loansIssued: Math.round(lf.issued * 100) / 100, recovery: Math.round(lf.recovered * 100) / 100,
        flows, avgTotalAssets: avgAssets(monthsIn),
      };
    };
    const quarters = [2, 5, 8, 11].map((qi, n) => {
      const q = monthBs.find((x) => x.to === months[qi]?.to);
      if (!q) return null;
      const prevEnd = n === 0 ? null : months[qi - 3].to;
      return pointAt(q.to, prevEnd ?? fyBefore, q.bs, subtractFlows(plAt(q.to), prevEnd ? plAt(prevEnd) : null), monthBs.filter((x) => x.to > (prevEnd ?? '') && x.to <= q.to));
    });
    const xvi = { current: pointAt(misAsOf, fyBefore, bs, plFlows(pl), monthBs), quarters };
    const mis = {
      asOf: misAsOf,
      overdue: overdueClassification({ memberLoans: loans.filter((l) => !l.isDeleted), kcc: kccAccruables(kccLoans), asOf: misAsOf }),
      avgCurrent: averagePosition(monthEnds),
      monthsAveraged: monthEnds.length,
      ratios: misRatios(bs, appPL.netProfit),
      xvi,
    };
    const trading = hasTrading ? buildCasTrading(tb, { openingStock: tr.totalOpeningStock, closingStock: tr.totalClosingStock, procuredToStock: tr.procuredToStock, purchaseGrossUp: tr.legacyPurchaseGrossUp }) : null;
    const m = months.find((x) => x.key === tbMonth);
    const tbCas = m ? buildCasTrialBalance(getTrialBalance(m.to), getTrialBalance(dayBefore(m.from)), { hasTrading }) : null;
    return { bs, pl, trading, appNet: appPL.netProfit, appGross: tr.grossProfit, leaves, tbCas, tbLabel: m?.label ?? '', mis };
  }, [months, tbMonth, today, getTrialBalance, getProfitLoss, getTradingAccount, fyEnd, society.societyType, society.state, society.activitiesCutoverEnabled, societyCapabilities, societyActivities, loans, kccLoans, accruals, vouchers, members, accounts, depositAccounts, getDepositTransactions]);

  const { bs, pl, trading } = data;
  const bsTies = casBalanceSheetTies(bs, data.leaves);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900 dark:bg-indigo-900/20 dark:text-indigo-200">
        <span>
          {hi
            ? 'NABARD Common Accounting System (CAS) के प्रारूप — Annexure I (तलपट), II (व्यापार खाता), III (लाभ-हानि), IV (तुलन पत्र)। यह रिपोर्ट आपकी पुस्तकों से बनती है; खाते नहीं बदलते। जो खाता किसी CAS पंक्ति से नहीं जुड़ा, वह "अन्य" में दिखता है — कोई रकम नहीं छूटती।'
            : 'NABARD Common Accounting System (CAS) formats — Annexure I (Trial Balance), II (Trading), III (P&L), IV (Balance Sheet). Built from your books; no account changes. A head with no CAS line shows under "Others" — nothing is dropped.'}
        </span>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => generateCasPdf(society, bs, pl, trading, fyEnd, data.tbCas ? { tb: data.tbCas, month: data.tbLabel } : null)}>
          <Download className="h-4 w-4" />PDF
        </Button>
      </div>

      {data.tbCas && (
        <Card>
          <CardHeader className="py-3 flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">{hi ? 'Annexure I — तलपट (Trial Balance)' : 'Annexure I — Trial Balance'}</CardTitle>
            <select value={tbMonth} onChange={(e) => setTbMonth(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
              {months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </CardHeader>
          <CardContent className="space-y-4">
            <TbTable rows={data.tbCas.liabilitiesIncome} hi={hi} total={data.tbCas.totals.liabilitiesIncome} title={hi ? 'देनदारियाँ एवं आय' : 'Liabilities & Income'} />
            <TbTable rows={data.tbCas.assetsExpenditure} hi={hi} total={data.tbCas.totals.assetsExpenditure} title={hi ? 'परिसंपत्तियाँ एवं व्यय' : 'Assets & Expenditure'} />
            <Tie ok={near(data.tbCas.totals.liabilitiesIncome, data.tbCas.totals.assetsExpenditure)} hi={hi} what={hi ? 'तलपट (दोनों पक्ष बराबर)' : 'Trial Balance (both sides equal)'} />
          </CardContent>
        </Card>
      )}

      {trading && (
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base">{hi ? 'Annexure II — व्यापार खाता' : 'Annexure II — Trading Account'}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Sections sections={trading.debit} hi={hi} total={trading.debit.reduce((t, s) => t + s.total, 0)} totalLabel={hi ? 'योग (Dr)' : 'Total (Dr)'} />
            <Sections sections={trading.credit} hi={hi} total={trading.total} totalLabel={hi ? 'योग (Cr)' : 'Total (Cr)'} />
            <div className="md:col-span-2"><Tie ok={near(trading.grossProfit, data.appGross)} hi={hi} what={hi ? 'व्यापार खाते (सकल लाभ)' : 'Trading Account (gross profit)'} detail={`CAS ${fmt(trading.grossProfit)} · ${hi ? 'ऐप' : 'app'} ${fmt(data.appGross)}`} /></div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">{hi ? 'Annexure III — लाभ-हानि खाता' : 'Annexure III — Profit and Loss Account'}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Sections sections={pl.expenditure} hi={hi} total={pl.expenditure.reduce((t, s) => t + s.total, 0)} totalLabel={hi ? 'योग' : 'Total'} />
          <Sections sections={pl.income} hi={hi} total={pl.total} totalLabel={hi ? 'योग' : 'Total'} />
          <div className="md:col-span-2"><Tie ok={near(pl.netProfit, data.appNet)} hi={hi} what={hi ? 'लाभ-हानि (शुद्ध लाभ)' : 'P&L (net profit)'} detail={`CAS ${fmt(pl.netProfit)} · ${hi ? 'ऐप' : 'app'} ${fmt(data.appNet)}`} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">{hi ? 'Annexure IV — तुलन पत्र (Balance Sheet)' : 'Annexure IV — Balance Sheet'}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Sections sections={bs.liabilities} hi={hi} total={bs.totalLiabilities} totalLabel={hi ? 'कुल देनदारियाँ' : 'Total Liabilities'} />
          <Sections sections={bs.assets} hi={hi} total={bs.totalAssets} totalLabel={hi ? 'कुल परिसंपत्तियाँ' : 'Total Assets'} />
          <div className="md:col-span-2 space-y-1">
            <Tie ok={bsTies} hi={hi} what={hi ? 'तुलन पत्र' : 'Balance Sheet'}
              detail={near(data.leaves.totalAssets, data.leaves.totalLiabilities)
                ? `CAS ${fmt(bs.totalAssets)} / ${fmt(bs.totalLiabilities)}`
                : (hi
                  ? `ऐप का अपना तुलन पत्र भी संतुलित नहीं: परिसंपत्तियाँ ${fmt(data.leaves.totalAssets)}, देनदारियाँ ${fmt(data.leaves.totalLiabilities)}`
                  : `the app's own Balance Sheet is not balanced: assets ${fmt(data.leaves.totalAssets)}, liabilities ${fmt(data.leaves.totalLiabilities)}`)} />
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

      <CasMis hi={hi} {...data.mis} />
    </div>
  );
}

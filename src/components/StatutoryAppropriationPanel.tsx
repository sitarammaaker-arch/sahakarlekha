/**
 * Statutory appropriation panel (T-20 wiring, slice 4) — the year-end action that posts the net
 * surplus appropriation through the CANONICAL engine (effective-dated UCAS rates, exact paise, caps
 * enforced) as ONE balanced voucher. Flag-gated: renders only when society.statutoryAppropriation is
 * on, so the legacy ReserveFund / ProfitDistribution path is the default and this is additive.
 *
 * It shows the computed plan (reserve / education / dividend + carry-forward) for review BEFORE
 * posting, refuses an invalid plan (cap breach) with the reason, and posts via the DataContext's
 * addStatutoryAppropriation — which carries all the guards + ledger + rollback.
 */
import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Landmark, AlertTriangle } from 'lucide-react';
import { planSocietyAppropriation } from '@/lib/rules/societyAppropriation';
import type { AppropriationStep } from '@/lib/rules/ucas';

const fmt = (n: number) => 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/** Step labels — Hindi first (RULE 7). */
const STEP_LABELS: Record<AppropriationStep, { hi: string; en: string }> = {
  reserve_fund:     { hi: 'वैधानिक संचय निधि', en: 'Statutory Reserve Fund' },
  education_fund:   { hi: 'शिक्षा निधि', en: 'Education Fund' },
  bye_law_reserves: { hi: 'उप-नियम आरक्षित', en: 'Bye-law Reserves' },
  dividend:         { hi: 'लाभांश', en: 'Dividend' },
  patronage_bonus:  { hi: 'संरक्षण बोनस', en: 'Patronage Bonus' },
  charitable:       { hi: 'दान / लोकहित', en: 'Charitable' },
  carry_forward:    { hi: 'अग्रेनीत शेष', en: 'Carried Forward' },
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export const StatutoryAppropriationPanel: React.FC = () => {
  const { society, getProfitLoss, getShareCapitalReconciliation, addStatutoryAppropriation } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';

  const [date, setDate] = useState(todayISO);
  const [dividend, setDividend] = useState('');

  const netSurplus = getProfitLoss().netProfit;
  const shareCapital = getShareCapitalReconciliation().controlBalance;
  const dividendAmt = parseFloat(dividend) || 0;

  const appr = useMemo(
    () => planSocietyAppropriation({ netSurplus, shareCapital, state: society.state, asOf: date, discretionary: { dividend: dividendAmt } }),
    [netSurplus, shareCapital, society.state, date, dividendAmt],
  );

  // Flag-gated — additive; the legacy path stays the default until this society is flipped.
  if (!society.statutoryAppropriation) return null;

  const rows = appr.plan.lines.filter((l) => l.amountMinor > 0 || l.step === 'carry_forward');
  const nothingToPost = netSurplus <= 0;

  const handlePost = () => {
    addStatutoryAppropriation({ date, discretionary: { dividend: dividendAmt } });
  };

  return (
    <Card className="border-indigo-200 bg-indigo-50/40">
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Landmark className="h-5 w-5 text-indigo-700" />
          {hi ? 'वैधानिक लाभ-विनियोजन (UCAS)' : 'Statutory Appropriation (UCAS)'}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {hi
            ? 'शुद्ध अधिशेष को वैधानिक क्रम व दरों पर विनियोजित कर एक संतुलित वाउचर पोस्ट करें।'
            : 'Appropriate net surplus at the statutory order + rates, posted as one balanced voucher.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">{hi ? 'शुद्ध अधिशेष' : 'Net surplus'}</Label>
            <div className="font-semibold">{fmt(netSurplus)}</div>
          </div>
          <div>
            <Label htmlFor="appr-date" className="text-xs">{hi ? 'तारीख' : 'Date'}</Label>
            <Input id="appr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-40" />
          </div>
          <div>
            <Label htmlFor="appr-dividend" className="text-xs">{hi ? 'प्रस्तावित लाभांश (₹)' : 'Proposed dividend (₹)'}</Label>
            <Input id="appr-dividend" type="number" min="0" value={dividend} onChange={(e) => setDividend(e.target.value)} placeholder="0" className="h-8 w-40" />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{hi ? 'मद' : 'Appropriation'}</TableHead>
              <TableHead className="text-right">{hi ? 'दर' : 'Rate'}</TableHead>
              <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((l) => (
              <TableRow key={l.step} className={l.step === 'carry_forward' ? 'font-medium text-muted-foreground' : ''}>
                <TableCell>{hi ? STEP_LABELS[l.step].hi : STEP_LABELS[l.step].en}</TableCell>
                <TableCell className="text-right">{l.ratePct != null ? `${l.ratePct}%` : '—'}</TableCell>
                <TableCell className="text-right">{fmt(l.amountMinor / 100)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {!appr.ok && (
          <div className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/30 rounded text-destructive text-xs">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{appr.problems.join(' · ')}</span>
          </div>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" disabled={!appr.ok || nothingToPost}>
              {hi ? 'विनियोजन पोस्ट करें' : 'Post Appropriation'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{hi ? 'वैधानिक विनियोजन पोस्ट करें?' : 'Post statutory appropriation?'}</AlertDialogTitle>
              <AlertDialogDescription>
                {hi
                  ? `डेबिट शुद्ध अधिशेष (1208) ₹${appr.plan.totalAppropriatedMinor / 100}, प्रत्येक निधि क्रेडिट। यह एक संतुलित वाउचर बहीखाते में पोस्ट करेगा।`
                  : `Dr Net Surplus (1208) ₹${appr.plan.totalAppropriatedMinor / 100}, Cr each fund. This posts one balanced voucher to the ledger.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{hi ? 'रद्द' : 'Cancel'}</AlertDialogCancel>
              <AlertDialogAction onClick={handlePost}>{hi ? 'पोस्ट करें' : 'Post'}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

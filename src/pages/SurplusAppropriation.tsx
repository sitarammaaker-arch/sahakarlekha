/**
 * लाभ विनियोजन — the year-end surplus appropriation, one place, one order (founder 2026-10-10).
 *
 * It was split across the Reserve Fund page (fund transfers), the Profit Distribution page (dividend / bonus /
 * payment register) and a flag-gated statutory panel. This wizard puts the steps in order WITHOUT a new calculation
 * or posting path: step 2 IS the Reserve Fund page's panel, step 3 IS the Profit Distribution page's panel (both
 * exported from their pages and sharing the one appropriation rule in lib/distribution/dividendRuns — #748). The
 * statutory (T-20) panel stays out (off for every society). The summary at the top reads the same shared helpers.
 */
import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FundAppropriationPanel } from '@/pages/ReserveFund';
import { ProfitDistributionPanel } from '@/pages/ProfitDistribution';
import { appropriationFunds, appropriatedToFunds, postedAppropriation, ACC_NET_SURPLUS, ACC_DIVIDEND } from '@/lib/distribution/dividendRuns';
import { balanceSheetTallied, fyEndDate } from '@/lib/balanceSheetLeaves';

type Step = 1 | 2 | 3;

const SurplusAppropriation: React.FC = () => {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { society, accounts, vouchers, getProfitLoss, getTrialBalance, getTradingAccount, getShareCapitalReconciliation } = useData();
  const [step, setStep] = useState<Step>(1);
  const fy = society.financialYear;

  const s = useMemo(() => {
    const { netProfit } = getProfitLoss();
    const toFunds = appropriatedToFunds(vouchers, appropriationFunds(accounts).map(a => a.id), fy);
    const dividend = postedAppropriation(vouchers, ACC_NET_SURPLUS, ACC_DIVIDEND, fy)?.amount ?? 0;
    const fyEnd = fyEndDate(fy);
    const { physicalClosingStock, closingStockPosted } = getTradingAccount(fyEnd);
    const bsOk = balanceSheetTallied(getTrialBalance(fyEnd), { closingStockPosted, physicalClosingStock, netProfit });
    const shareOk = getShareCapitalReconciliation().reconciled;
    return { netProfit, toFunds, dividend, remaining: Math.round((netProfit - toFunds - dividend) * 100) / 100, bsOk, shareOk };
  }, [getProfitLoss, vouchers, accounts, fy, getTradingAccount, getTrialBalance, getShareCapitalReconciliation]);

  const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
  const steps: { n: Step; hi: string; en: string }[] = [
    { n: 1, hi: '1. शुद्ध लाभ व जाँच', en: '1. Surplus & checks' },
    { n: 2, hi: '2. फंडों में आवंटन', en: '2. Transfer to funds' },
    { n: 3, hi: '3. लाभांश, बोनस व भुगतान', en: '3. Dividend, bonus & payment' },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2 bg-yellow-100 rounded-lg"><Coins className="h-6 w-6 text-yellow-700" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{hi ? 'लाभ विनियोजन' : 'Surplus Appropriation'}</h1>
          <p className="text-sm text-gray-500">{society.name} · {hi ? 'वित्तीय वर्ष' : 'FY'} {fy} · {hi ? 'साल के अंत का पूरा काम, क्रम से' : 'the whole year-end, in order'}</p>
        </div>
      </div>

      {/* Always-visible summary (the same shared rules the steps post with) */}
      <Card>
        <CardContent className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><p className="text-xs text-muted-foreground">{hi ? 'शुद्ध लाभ' : 'Net surplus'}</p><p className="font-bold">{fmt(s.netProfit)}</p></div>
          <div><p className="text-xs text-muted-foreground">{hi ? 'फंडों में गया' : 'To funds'}</p><p className="font-bold">{fmt(s.toFunds)}</p></div>
          <div><p className="text-xs text-muted-foreground">{hi ? 'लाभांश' : 'Dividend'}</p><p className="font-bold">{fmt(s.dividend)}</p></div>
          <div><p className="text-xs text-muted-foreground">{hi ? 'बाकी' : 'Remaining'}</p><p className={cn('font-bold', s.remaining < 0 && 'text-destructive')}>{fmt(s.remaining)}</p></div>
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-wrap">
        {steps.map(st => (
          <Button key={st.n} size="sm" variant={step === st.n ? 'default' : 'outline'} onClick={() => setStep(st.n)}>
            {hi ? st.hi : st.en}
          </Button>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardContent className="pt-4 space-y-3 text-sm">
            <p>{hi ? 'विनियोजन से पहले ये जाँचें पूरी हों:' : 'Before appropriating, these checks should pass:'}</p>
            {[
              { ok: s.bsOk, hi: 'बैलेंस शीट संतुलित है', en: 'Balance Sheet tallies' },
              { ok: s.shareOk, hi: 'अंश पूँजी: सदस्य रजिस्टर = खाता', en: 'Share capital: members = ledger' },
              { ok: s.netProfit > 0, hi: 'इस वर्ष शुद्ध लाभ है', en: 'There is a net surplus this year' },
            ].map(c => (
              <p key={c.en} className={cn('flex items-center gap-2', c.ok ? 'text-success' : 'text-destructive')}>
                {c.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{hi ? c.hi : c.en}
              </p>
            ))}
            {!s.shareOk && (
              <p className="text-xs text-muted-foreground">{hi ? 'अंश पूँजी का मिलान न होने पर लाभांश (कदम 3) रुका रहेगा — पहले "अंश रजिस्टर" में मिलान करें।' : 'Dividend (step 3) stays blocked until share capital reconciles — fix it in the Share Register first.'}</p>
            )}
            <Button size="sm" onClick={() => setStep(2)}>{hi ? 'आगे: फंडों में आवंटन →' : 'Next: transfer to funds →'}</Button>
          </CardContent>
        </Card>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <FundAppropriationPanel embedded />
          <Button size="sm" onClick={() => setStep(3)}>{hi ? 'आगे: लाभांश, बोनस व भुगतान →' : 'Next: dividend, bonus & payment →'}</Button>
        </div>
      )}
      {step === 3 && <ProfitDistributionPanel embedded />}
    </div>
  );
};

export default SurplusAppropriation;

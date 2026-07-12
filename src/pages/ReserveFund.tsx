import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Shield, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { fmtDate } from '@/lib/dateUtils';
import { getVoucherLines } from '@/lib/voucherUtils';
import { appropriationWaterfall } from '@/lib/appropriation';
import { ucasReserveMinPct } from '@/lib/rules/ucas';
import { useToast } from '@/hooks/use-toast';

const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

// Net Surplus / (Deficit) — Dr when appropriating to any fund (Cr).
const ACC_NET_SURPLUS = '1208';
const RESERVES_GROUP  = '1200'; // parent group "Reserves & Surplus"

// Suggested default rates (editable — appropriation is OPTIONAL). A society may
// set any percentage or a flat amount per fund, or skip a fund entirely.
// Reserve Fund 1201 — the statutory minimum comes from the UCAS rule SSOT (T-16), not a local
// literal. National default resolves to 25% (value-identical to the prior hardcoded constant).
const DEFAULT_RESERVE_PCT = ucasReserveMinPct({ asOf: new Date().toISOString() });
const DEFAULT_EDUCATION_PCT = 1;  // Education Fund 1203

type Mode = 'pct' | 'amt';

const ReserveFund: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { vouchers, accounts, society, getProfitLoss, addVoucher } = useData();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fy = society.financialYear; // e.g. "2024-25"
  const hi = language === 'hi';

  const { netProfit } = useMemo(() => getProfitLoss(), [getProfitLoss]);

  // ── All appropriable funds = credit accounts under "Reserves & Surplus" ──────
  // (excludes the Net Surplus source 1208 and the debit-side Dividend/Patronage).
  const fundAccounts = useMemo(() =>
    accounts
      .filter(a => a.parentId === RESERVES_GROUP && !a.isGroup
        && a.id !== ACC_NET_SURPLUS && a.openingBalanceType === 'credit')
      .sort((a, b) => a.id.localeCompare(b.id)),
    [accounts]
  );

  const fundName = (a: { name: string; nameHi?: string }) => (hi && a.nameHi) ? a.nameHi : a.name;
  const defaultRate = (id: string): string =>
    id === '1201' ? String(society.reserveFundPct ?? DEFAULT_RESERVE_PCT)
    : id === '1203' ? String(DEFAULT_EDUCATION_PCT)
    : '0';

  // ── Per-fund editable input (% of net surplus OR flat ₹). Optional, default 0 ─
  const [fundInputs, setFundInputs] = useState<Record<string, { mode: Mode; value: string }>>({});
  const getInput = (id: string) => fundInputs[id] ?? { mode: 'pct' as Mode, value: defaultRate(id) };
  const setInput = (id: string, patch: Partial<{ mode: Mode; value: string }>) =>
    setFundInputs(prev => ({ ...prev, [id]: { ...getInput(id), ...patch } }));

  const inputAmount = (id: string) => {
    const { mode, value } = getInput(id);
    const v = parseFloat(value) || 0;
    const amt = mode === 'pct' ? (netProfit * v) / 100 : v;
    return Math.max(0, Math.round(amt * 100) / 100);
  };

  // ── Which funds are already posted for this FY (Dr 1208 / Cr fund) ───────────
  const postedMap = useMemo(() => {
    const m: Record<string, (typeof vouchers)[number] | undefined> = {};
    fundAccounts.forEach(f => {
      m[f.id] = vouchers.find(v =>
        !v.isDeleted &&
        getVoucherLines(v).some(l => l.accountId === ACC_NET_SURPLUS && l.type === 'Dr') &&
        getVoucherLines(v).some(l => l.accountId === f.id && l.type === 'Cr') &&
        v.narration.includes(fy)
      );
    });
    return m;
  }, [vouchers, fundAccounts, fy]);

  const effectiveAmount = (id: string) => postedMap[id]?.amount ?? inputAmount(id);

  const totalAppropriated = fundAccounts.reduce((s, f) => s + effectiveAmount(f.id), 0);
  const afterAppropriation = netProfit - totalAppropriated;

  const pendingFunds = fundAccounts.filter(f => !postedMap[f.id] && inputAmount(f.id) > 0);
  const canPost = netProfit > 0 && pendingFunds.length > 0;

  // ECR-10: suggested statutory appropriation waterfall (reserve ≥25% → education → residual).
  const plan = useMemo(() => appropriationWaterfall(netProfit, { reservePct: society.reserveFundPct }), [netProfit, society.reserveFundPct]);
  const applySuggested = () => plan.steps.forEach(s => setInput(s.accountId, { mode: 'pct', value: String(s.pct) }));
  const postedVouchers = fundAccounts.map(f => postedMap[f.id]).filter(Boolean) as (typeof vouchers)[number][];

  // ── Current ledger balance of any account ────────────────────────────────────
  const getBalance = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return 0;
    let bal = acc.openingBalanceType === 'credit' ? acc.openingBalance : -acc.openingBalance;
    vouchers.filter(v => !v.isDeleted).forEach(v => {
      getVoucherLines(v).forEach(l => {
        if (l.accountId !== id) return;
        if (l.type === 'Dr') bal -= l.amount;
        else bal += l.amount;
      });
    });
    return bal;
  };

  const handlePost = () => {
    const today = new Date().toISOString().split('T')[0];
    let posted = 0;
    pendingFunds.forEach(f => {
      const { mode, value } = getInput(f.id);
      addVoucher({
        type: 'journal',
        date: today,
        debitAccountId: ACC_NET_SURPLUS,
        creditAccountId: f.id,
        amount: inputAmount(f.id),
        narration: `${f.name} Appropriation ${mode === 'pct' ? `@ ${value}%` : '(fixed amount)'} — FY ${fy}`,
        createdBy: user?.name ?? 'System',
      });
      posted++;
    });
    setConfirmOpen(false);
    toast({
      title: hi
        ? `${posted} जर्नल एंट्रियाँ सफलतापूर्वक पोस्ट की गईं`
        : `${posted} journal entries posted successfully`,
    });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2 bg-green-100 rounded-lg">
          <Shield className="h-6 w-6 text-green-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {hi ? 'फंड आवंटन (सरप्लस से)' : 'Fund Appropriation (from Surplus)'}
          </h1>
          <p className="text-sm text-gray-500">{society.name} · {hi ? 'वित्तीय वर्ष' : 'FY'} {fy}</p>
        </div>
        {postedVouchers.length > 0 && pendingFunds.length === 0 && (
          <Badge className="ml-auto bg-green-100 text-green-800 border-green-300">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {hi ? 'इस वर्ष के लिए पोस्ट हो चुका है' : 'Posted for this FY'}
          </Badge>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {hi
            ? 'फंड आवंटन पूरी तरह वैकल्पिक है। नीचे हर फंड के लिए शुद्ध लाभ का % या एक निश्चित ₹ राशि चुनें (0 रखने पर वह फंड छूट जाएगी)। सामान्य सुझाव: रिज़र्व फंड 25%, शिक्षा फंड 1% — पर आप कुछ भी चुन सकते हैं।'
            : 'Fund appropriation is entirely optional. For each fund below, set a % of net surplus or a fixed ₹ amount (leave 0 to skip). Common suggestion: Reserve 25%, Education 1% — but you may choose anything.'}
        </span>
      </div>

      {/* Net surplus zero/negative */}
      {netProfit <= 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {hi ? 'नेट सरप्लस शून्य या ऋणात्मक है — आवंटन आवश्यक नहीं।' : 'Net surplus is zero or negative — no appropriation needed.'}
        </div>
      )}

      {/* ECR-10: Suggested statutory appropriation waterfall */}
      {netProfit > 0 && plan.steps.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader className="py-3">
            <CardTitle className="text-base">{hi ? 'सुझाई गई सांविधिक आवंटन (क्रमानुसार)' : 'Suggested statutory appropriation (in order)'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {plan.reserveBelowStatutory && (
              <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {hi ? `वैधानिक संचय ${society.reserveFundPct ?? 25}% है — न्यूनतम 25% होना चाहिए।` : `Statutory reserve is ${society.reserveFundPct ?? 25}% — minimum 25% required.`}
              </div>
            )}
            {plan.steps.map(s => (
              <div key={s.accountId} className="flex items-center justify-between">
                <span className="text-gray-700">{s.order}. {hi ? s.labelHi : s.label} <span className="text-muted-foreground">({s.pct}%)</span></span>
                <span className="font-medium">{fmt(s.amount)}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>{hi ? 'शेष (डिविडेंड/अग्रेनीत हेतु)' : 'Residual (dividend / carry-forward)'}</span>
              <span className={plan.residual >= 0 ? 'text-green-700' : 'text-red-600'}>{fmt(plan.residual)}</span>
            </div>
            <Button size="sm" variant="outline" className="w-full mt-1" onClick={applySuggested}>
              {hi ? 'सुझाव लागू करें (नीचे इनपुट भर जाएंगे)' : 'Apply suggested (fills the inputs below)'}
            </Button>
            <p className="text-[11px] text-muted-foreground">{hi ? 'लागू करने के बाद नीचे समीक्षा करें, फिर पोस्ट करें।' : 'Review below after applying, then post.'}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Fund appropriation inputs ── */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">{hi ? 'फंड आवंटन' : 'Fund Appropriation'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{hi ? 'नेट सरप्लस (P&L)' : 'Net Surplus (P&L)'}</span>
              <span className={`font-semibold ${netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {fmt(netProfit)}
              </span>
            </div>

            <div className="border-t pt-2 space-y-2">
              {fundAccounts.map(f => {
                const posted = postedMap[f.id];
                const inp = getInput(f.id);
                return (
                  <div key={f.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 min-w-0">
                      <span className="truncate">{fundName(f)}</span>
                      <span className="text-xs text-gray-400 shrink-0">({f.id})</span>
                      {posted && <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />}
                    </span>
                    {posted ? (
                      <span className="text-orange-600 font-medium shrink-0">{fmt(posted.amount)}</span>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <Input type="number" min="0" step="0.5" value={inp.value}
                          onChange={e => setInput(f.id, { value: e.target.value })}
                          className="h-8 w-20 text-right" disabled={netProfit <= 0} />
                        <select value={inp.mode}
                          onChange={e => setInput(f.id, { mode: e.target.value as Mode })}
                          className="h-8 rounded-md border border-input bg-background px-1 text-sm"
                          disabled={netProfit <= 0}>
                          <option value="pct">%</option>
                          <option value="amt">₹</option>
                        </select>
                        <span className="w-28 text-right text-orange-600 font-medium">{fmt(inputAmount(f.id))}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between border-t pt-2">
              <span className="text-gray-600">{hi ? 'कुल आवंटन' : 'Total Appropriated'}</span>
              <span className="font-medium text-orange-700">{fmt(totalAppropriated)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-2">
              <span>{hi ? 'वितरण योग्य सरप्लस' : 'Distributable Surplus'}</span>
              <span className={afterAppropriation >= 0 ? 'text-green-700' : 'text-red-600'}>
                {fmt(afterAppropriation)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ── Current balances + Post ── */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">{hi ? 'फंड वर्तमान शेष' : 'Current Fund Balances'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{hi ? 'नेट सरप्लस खाता (1208)' : 'Net Surplus Account (1208)'}</span>
              <span className="font-semibold">{fmt(getBalance(ACC_NET_SURPLUS))}</span>
            </div>
            {fundAccounts
              .filter(f => Math.abs(getBalance(f.id)) > 0.005 || effectiveAmount(f.id) > 0)
              .map(f => (
                <div key={f.id} className="flex justify-between">
                  <span className="text-gray-600 truncate">{fundName(f)} <span className="text-xs text-gray-400">({f.id})</span></span>
                  <span className="font-semibold text-green-700">{fmt(getBalance(f.id))}</span>
                </div>
              ))}
            <div className="border-t pt-2">
              {netProfit <= 0 ? (
                <div className="flex items-center gap-2 text-amber-700 text-xs">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {hi ? 'नेट सरप्लस शून्य या ऋणात्मक है — आवंटन आवश्यक नहीं' : 'Net surplus is zero or negative — no appropriation needed'}
                </div>
              ) : canPost ? (
                <Button onClick={() => setConfirmOpen(true)} className="w-full bg-green-700 hover:bg-green-800">
                  <Shield className="h-4 w-4 mr-2" />
                  {hi ? `आवंटन जर्नल पोस्ट करें (${pendingFunds.length})` : `Post Appropriation Journals (${pendingFunds.length})`}
                </Button>
              ) : postedVouchers.length > 0 ? (
                <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  {hi ? 'आवंटन पोस्ट हो चुका है' : 'Appropriation posted'}
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  {hi ? 'पोस्ट करने के लिए किसी फंड में राशि/% डालें।' : 'Enter a % or amount in a fund to post.'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Posted Vouchers */}
      {postedVouchers.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base text-green-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {hi ? 'पोस्ट की गई जर्नल एंट्रियाँ' : 'Posted Appropriation Journals'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'वाउचर नं.' : 'Voucher No.'}</TableHead>
                  <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                  <TableHead>{hi ? 'विवरण' : 'Description'}</TableHead>
                  <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {postedVouchers.map(v => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-sm">{v.voucherNo}</TableCell>
                    <TableCell className="text-sm">{fmtDate(v.date)}</TableCell>
                    <TableCell className="text-sm">{v.narration}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(v.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Confirm Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{hi ? 'फंड आवंटन पोस्ट करें?' : 'Post Fund Appropriation?'}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>{hi ? 'निम्नलिखित जर्नल एंट्रियाँ बनाई जाएंगी:' : 'The following journal entries will be created:'}</p>
                {pendingFunds.map(f => {
                  const inp = getInput(f.id);
                  return (
                    <div key={f.id} className="bg-gray-50 rounded p-2 font-mono text-xs">
                      Dr 1208 Net Surplus &nbsp;{fmt(inputAmount(f.id))}<br />
                      &nbsp;&nbsp;Cr {f.id} {f.name} &nbsp;{fmt(inputAmount(f.id))}<br />
                      <span className="text-gray-500">{inp.mode === 'pct' ? `@ ${inp.value}% of ${fmt(netProfit)}` : 'fixed amount'}</span>
                    </div>
                  );
                })}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{hi ? 'रद्द करें' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handlePost} className="bg-green-700 hover:bg-green-800">
              {hi ? 'पोस्ट करें' : 'Post'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReserveFund;

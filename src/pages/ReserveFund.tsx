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
import { useToast } from '@/hooks/use-toast';

const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

// Account IDs
const ACC_NET_SURPLUS   = '1208'; // Net Surplus / (Deficit) — Dr when appropriating
const ACC_RESERVE_FUND  = '1201'; // Statutory Reserve Fund  — Cr
const ACC_EDUCATION_FUND = '1203'; // Education Fund          — Cr

// Suggested default rates (editable — appropriation is optional). A society may
// set any percentage or a flat amount per fund, or skip a fund entirely.
const DEFAULT_RESERVE_PCT = 25;
const DEFAULT_EDUCATION_PCT = 1;

const ReserveFund: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { vouchers, accounts, society, getProfitLoss, addVoucher } = useData();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fy = society.financialYear; // e.g. "2024-25"
  const hi = language === 'hi';

  const { netProfit } = useMemo(() => getProfitLoss(), [getProfitLoss]);

  // ── Appropriation is OPTIONAL & fully editable ──────────────────────────────
  // Each fund: choose a % (of net surplus) OR a flat ₹ amount. Defaults are the
  // common statutory rates, but any value (incl. 0 = skip) is allowed.
  const [reserveMode, setReserveMode]   = useState<'pct' | 'amt'>('pct');
  const [reserveInput, setReserveInput] = useState(String(society.reserveFundPct ?? DEFAULT_RESERVE_PCT));
  const [eduMode, setEduMode]           = useState<'pct' | 'amt'>('pct');
  const [eduInput, setEduInput]         = useState(String(DEFAULT_EDUCATION_PCT));

  const calcAmt = (mode: 'pct' | 'amt', input: string) => {
    const v = parseFloat(input) || 0;
    const amt = mode === 'pct' ? (netProfit * v) / 100 : v;
    return Math.max(0, Math.round(amt * 100) / 100);
  };
  const reserveAmount   = calcAmt(reserveMode, reserveInput);
  const educationAmount = calcAmt(eduMode, eduInput);
  const afterAppropriation = netProfit - reserveAmount - educationAmount;

  // Check if already posted for this FY
  const existingReserveVoucher = useMemo(() =>
    vouchers.find(v =>
      !v.isDeleted &&
      getVoucherLines(v).some(l => l.accountId === ACC_NET_SURPLUS && l.type === 'Dr') &&
      getVoucherLines(v).some(l => l.accountId === ACC_RESERVE_FUND && l.type === 'Cr') &&
      v.narration.includes(fy)
    ),
    [vouchers, fy]
  );

  const existingEduVoucher = useMemo(() =>
    vouchers.find(v =>
      !v.isDeleted &&
      getVoucherLines(v).some(l => l.accountId === ACC_NET_SURPLUS && l.type === 'Dr') &&
      getVoucherLines(v).some(l => l.accountId === ACC_EDUCATION_FUND && l.type === 'Cr') &&
      v.narration.includes(fy)
    ),
    [vouchers, fy]
  );

  const reserveAlreadyPosted  = !!existingReserveVoucher;
  const educationAlreadyPosted = !!existingEduVoucher;
  const allPosted = reserveAlreadyPosted && educationAlreadyPosted;

  // Current fund balances
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

  const reserveFundBalance   = getBalance(ACC_RESERVE_FUND);
  const educationFundBalance = getBalance(ACC_EDUCATION_FUND);
  const netSurplusBalance    = getBalance(ACC_NET_SURPLUS);

  const handlePost = () => {
    const today = new Date().toISOString().split('T')[0];
    let posted = 0;

    if (!reserveAlreadyPosted && reserveAmount > 0) {
      addVoucher({
        type: 'journal',
        date: today,
        debitAccountId: ACC_NET_SURPLUS,
        creditAccountId: ACC_RESERVE_FUND,
        amount: reserveAmount,
        narration: `Reserve Fund Appropriation ${reserveMode === 'pct' ? `@ ${reserveInput}%` : '(fixed amount)'} — FY ${fy}`,
        createdBy: user?.name ?? 'System',
      });
      posted++;
    }

    if (!educationAlreadyPosted && educationAmount > 0) {
      addVoucher({
        type: 'journal',
        date: today,
        debitAccountId: ACC_NET_SURPLUS,
        creditAccountId: ACC_EDUCATION_FUND,
        amount: educationAmount,
        narration: `Education Fund Appropriation ${eduMode === 'pct' ? `@ ${eduInput}%` : '(fixed amount)'} — FY ${fy}`,
        createdBy: user?.name ?? 'System',
      });
      posted++;
    }

    setConfirmOpen(false);
    toast({
      title: language === 'hi'
        ? `${posted} जर्नल प्रविष्टियाँ सफलतापूर्वक पोस्ट की गईं`
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
            {language === 'hi' ? 'वैधानिक आवंटन (संचय निधि)' : 'Statutory Appropriation — Reserve Fund'}
          </h1>
          <p className="text-sm text-gray-500">{society.name} · {language === 'hi' ? 'वित्तीय वर्ष' : 'FY'} {fy}</p>
        </div>
        {allPosted && (
          <Badge className="ml-auto bg-green-100 text-green-800 border-green-300">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {language === 'hi' ? 'इस वर्ष के लिए पोस्ट हो चुका है' : 'Posted for this FY'}
          </Badge>
        )}
      </div>

      {/* Statutory info banner */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {hi
            ? 'सुझाव: सामान्यतः शुद्ध लाभ का 25% संचय निधि व 1% शिक्षा निधि में डाला जाता है — पर यह वैकल्पिक है। नीचे आप हर निधि के लिए % या निश्चित राशि स्वयं चुन सकते हैं (0 करने पर वह निधि छूट जाएगी)।'
            : 'Suggested: usually 25% of net surplus goes to Reserve Fund and 1% to Education Fund — but this is optional. Below you can set a % or a fixed ₹ amount per fund (set 0 to skip a fund).'}
        </span>
      </div>

      {/* Net Surplus + Calculation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">
              {language === 'hi' ? 'अधिशेष गणना' : 'Surplus Calculation'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{hi ? 'शुद्ध अधिशेष (P&L)' : 'Net Surplus (P&L)'}</span>
              <span className={`font-semibold ${netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {fmt(netProfit)}
              </span>
            </div>
            <div className="border-t pt-2 space-y-2">
              {/* Reserve Fund — editable % or ₹ (optional) */}
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1">
                  {hi ? 'संचय निधि' : 'Reserve Fund'} <span className="text-xs text-gray-400">(1201)</span>
                  {reserveAlreadyPosted && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                </span>
                {reserveAlreadyPosted ? (
                  <span className="text-orange-600 font-medium">{fmt(reserveAmount)}</span>
                ) : (
                  <div className="flex items-center gap-1">
                    <Input type="number" min="0" step="0.5" value={reserveInput}
                      onChange={e => setReserveInput(e.target.value)}
                      className="h-8 w-20 text-right" disabled={netProfit <= 0} />
                    <select value={reserveMode}
                      onChange={e => setReserveMode(e.target.value as 'pct' | 'amt')}
                      className="h-8 rounded-md border border-input bg-background px-1 text-sm"
                      disabled={netProfit <= 0}>
                      <option value="pct">%</option>
                      <option value="amt">₹</option>
                    </select>
                    <span className="w-28 text-right text-orange-600 font-medium">{fmt(reserveAmount)}</span>
                  </div>
                )}
              </div>
              {/* Education Fund — editable % or ₹ (optional) */}
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1">
                  {hi ? 'शिक्षा निधि' : 'Education Fund'} <span className="text-xs text-gray-400">(1203)</span>
                  {educationAlreadyPosted && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                </span>
                {educationAlreadyPosted ? (
                  <span className="text-orange-600 font-medium">{fmt(educationAmount)}</span>
                ) : (
                  <div className="flex items-center gap-1">
                    <Input type="number" min="0" step="0.5" value={eduInput}
                      onChange={e => setEduInput(e.target.value)}
                      className="h-8 w-20 text-right" disabled={netProfit <= 0} />
                    <select value={eduMode}
                      onChange={e => setEduMode(e.target.value as 'pct' | 'amt')}
                      className="h-8 rounded-md border border-input bg-background px-1 text-sm"
                      disabled={netProfit <= 0}>
                      <option value="pct">%</option>
                      <option value="amt">₹</option>
                    </select>
                    <span className="w-28 text-right text-orange-600 font-medium">{fmt(educationAmount)}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-2">
              <span>{hi ? 'वितरण योग्य अधिशेष' : 'Distributable Surplus'}</span>
              <span className={afterAppropriation >= 0 ? 'text-green-700' : 'text-red-600'}>
                {fmt(afterAppropriation)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">
              {language === 'hi' ? 'निधि वर्तमान शेष' : 'Current Fund Balances'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{language === 'hi' ? 'शुद्ध अधिशेष खाता' : 'Net Surplus Account (1208)'}</span>
              <span className="font-semibold">{fmt(netSurplusBalance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{language === 'hi' ? 'वैधानिक संचय निधि' : 'Statutory Reserve Fund (1201)'}</span>
              <span className="font-semibold text-green-700">{fmt(reserveFundBalance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{language === 'hi' ? 'शिक्षा निधि' : 'Education Fund (1203)'}</span>
              <span className="font-semibold text-blue-700">{fmt(educationFundBalance)}</span>
            </div>
            <div className="border-t pt-2">
              {netProfit <= 0 ? (
                <div className="flex items-center gap-2 text-amber-700 text-xs">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {language === 'hi'
                    ? 'शुद्ध अधिशेष शून्य या ऋणात्मक है — आवंटन आवश्यक नहीं'
                    : 'Net surplus is zero or negative — no appropriation needed'}
                </div>
              ) : !allPosted ? (
                <Button
                  onClick={() => setConfirmOpen(true)}
                  className="w-full bg-green-700 hover:bg-green-800"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  {language === 'hi' ? 'आवंटन जर्नल पोस्ट करें' : 'Post Appropriation Journals'}
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  {language === 'hi' ? 'आवंटन पूर्ण हो चुका है' : 'Appropriation already posted'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Posted Vouchers */}
      {(reserveAlreadyPosted || educationAlreadyPosted) && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base text-green-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {language === 'hi' ? 'पोस्ट की गई जर्नल प्रविष्टियाँ' : 'Posted Appropriation Journals'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'hi' ? 'वाउचर नं.' : 'Voucher No.'}</TableHead>
                  <TableHead>{language === 'hi' ? 'तिथि' : 'Date'}</TableHead>
                  <TableHead>{language === 'hi' ? 'विवरण' : 'Description'}</TableHead>
                  <TableHead className="text-right">{language === 'hi' ? 'राशि' : 'Amount'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[existingReserveVoucher, existingEduVoucher].filter(Boolean).map(v => v && (
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
            <AlertDialogTitle>
              {language === 'hi' ? 'वैधानिक आवंटन पोस्ट करें?' : 'Post Statutory Appropriation?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  {language === 'hi'
                    ? 'निम्नलिखित जर्नल प्रविष्टियाँ बनाई जाएंगी:'
                    : 'The following journal entries will be created:'}
                </p>
                {!reserveAlreadyPosted && (
                  <div className="bg-gray-50 rounded p-2 font-mono text-xs">
                    Dr 1208 Net Surplus &nbsp;{fmt(reserveAmount)}<br />
                    &nbsp;&nbsp;Cr 1201 Reserve Fund &nbsp;{fmt(reserveAmount)}<br />
                    <span className="text-gray-500">{reserveMode === 'pct' ? `@ ${reserveInput}% of ${fmt(netProfit)}` : `fixed amount`}</span>
                  </div>
                )}
                {!educationAlreadyPosted && (
                  <div className="bg-gray-50 rounded p-2 font-mono text-xs">
                    Dr 1208 Net Surplus &nbsp;{fmt(educationAmount)}<br />
                    &nbsp;&nbsp;Cr 1203 Education Fund &nbsp;{fmt(educationAmount)}<br />
                    <span className="text-gray-500">{eduMode === 'pct' ? `@ ${eduInput}% of ${fmt(netProfit)}` : `fixed amount`}</span>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'hi' ? 'रद्द करें' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handlePost} className="bg-green-700 hover:bg-green-800">
              {language === 'hi' ? 'पोस्ट करें' : 'Post'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReserveFund;

import React, { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { ACCOUNT_IDS } from '@/lib/storage';
import { StatCard } from '@/components/dashboard/StatCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { Wallet, Building2, Users, TrendingUp, TrendingDown, CheckCircle, XCircle, AlertTriangle, Lock, ShieldCheck, Lightbulb, AlertCircle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fmtDate } from '@/lib/dateUtils';
import { Badge } from '@/components/ui/badge';
import { getVoucherLines } from '@/lib/voucherUtils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';

const MONTHS_HI = ['अप्रैल', 'मई', 'जून', 'जुलाई', 'अग.', 'सित.', 'अक्टू.', 'नव.', 'दिस.', 'जन.', 'फर.', 'मार्च'];
const MONTHS_EN = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#84cc16'];

const Dashboard: React.FC = () => {
  const { t, language } = useLanguage();
  const { getAccountBalance, members, vouchers, getProfitLoss, loans, society, getTrialBalance, getTradingAccount, auditObjections } = useData();

  const fmt = (amount: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

  const fmtShort = (amount: number) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
    return `₹${amount}`;
  };

  const cashBalance = getAccountBalance(ACCOUNT_IDS.CASH);
  const bankBalance = getAccountBalance(ACCOUNT_IDS.BANK);
  const { netProfit, incomeItems, expenseItems, totalIncome, totalExpenses } = getProfitLoss();
  const activeMembers = members.filter(m => m.status === 'active').length;

  // P3-3 + P4-1/P4-2: Cooperative compliance checks, health score, advisories
  const complianceChecks = useMemo(() => {
    const fy = society.financialYear;
    const activeVouchers = vouchers.filter(v => !v.isDeleted);
    const tb = getTrialBalance();
    const { physicalClosingStock, closingStockPosted } = getTradingAccount();

    // 1. Reserve Fund posted (Sec 65)
    const reservePosted = activeVouchers.some(v =>
      getVoucherLines(v).some(l => l.accountId === '1208' && l.type === 'Dr') &&
      getVoucherLines(v).some(l => l.accountId === '1201' && l.type === 'Cr') &&
      v.narration.includes(fy)
    );

    // 2. Balance Sheet tally
    const totalAssets = tb.filter(b => b.account.type === 'asset' && !b.account.isGroup).reduce((s, b) => s + b.netBalance, 0);
    const capLiab = tb.filter(b => (b.account.type === 'equity' || b.account.type === 'liability') && !b.account.isGroup);
    const totalLiab = capLiab.reduce((s, b) => s + (-b.netBalance), 0) + netProfit;
    const bsTallied = Math.abs(totalAssets - totalLiab) < 1;

    // 3. Closing stock journalized
    const stockOk = physicalClosingStock === 0 || closingStockPosted;

    // 4. Sec 32 loan limit
    const shareCapital = tb.filter(b => b.account.parentId === '1100' && !b.account.isGroup).reduce((s, b) => s + Math.abs(b.netBalance), 0);
    const reserves = tb.filter(b => b.account.parentId === '1200' && !b.account.isGroup).reduce((s, b) => s + Math.abs(b.netBalance), 0);
    const loanBase = shareCapital + reserves;
    const loanLimit = loanBase * 10;
    const totalOutstandingLoans = loans.filter(l => l.status !== 'cleared').reduce((s, l) => s + (l.amount - l.repaidAmount), 0);
    const sec32Ok = loanLimit === 0 || totalOutstandingLoans <= loanLimit;
    const sec32Pct = loanLimit > 0 ? (totalOutstandingLoans / loanLimit) * 100 : 0;

    // 5. FY Lock status
    const fyLocked = !!society.fyLocked;

    // 6. Overdue & pending objections
    const overdueCount = loans.filter(l => l.status === 'overdue').length;
    const pendingObjections = auditObjections.filter(o => o.status === 'pending').length;

    // --- P4-1: Financial Health Score (0–100) ---
    let earned = 0;
    let maxPts = 0;
    if (netProfit > 0)       { maxPts += 25; if (reservePosted) earned += 25; }
    maxPts += 20;              if (bsTallied) earned += 20;
    if (physicalClosingStock > 0) { maxPts += 10; if (stockOk) earned += 10; }
    if (loans.length > 0)    { maxPts += 20; if (sec32Ok) earned += 20; }
    if (loans.length > 0)    { maxPts += 15; if (overdueCount === 0) earned += 15; }
    if (auditObjections.length > 0) { maxPts += 10; if (pendingObjections === 0) earned += 10; }
    const healthScore = maxPts > 0 ? Math.round((earned / maxPts) * 100) : 100;

    // --- P4-2: Smart Advisories ---
    type Advisory = { severity: 'critical' | 'warning' | 'info'; en: string; hi: string };
    const advisories: Advisory[] = [];

    if (netProfit > 0 && !reservePosted)
      advisories.push({ severity: 'critical', en: 'Post 25% Statutory Reserve Fund transfer before distributing profits (Sec 65, Haryana Co-op Act)', hi: '25% सांविधिक संचय निधि हस्तांतरण करें — लाभ वितरण से पूर्व अनिवार्य (धारा 65)' });
    if (!bsTallied)
      advisories.push({ severity: 'critical', en: 'Balance Sheet is not balanced — check for missing or duplicate journal entries', hi: 'तुलन पत्र असंतुलित है — अपूर्ण या दोहरी जर्नल प्रविष्टियां जांचें' });
    if (physicalClosingStock > 0 && !closingStockPosted)
      advisories.push({ severity: 'critical', en: `Journalize closing stock of ₹${physicalClosingStock.toLocaleString('en-IN')} before generating financial reports`, hi: `₹${physicalClosingStock.toLocaleString('en-IN')} का समापन माल जर्नल करें — रिपोर्ट से पूर्व आवश्यक` });
    if (!sec32Ok)
      advisories.push({ severity: 'critical', en: `Loan portfolio exceeds Sec 32 limit (${sec32Pct.toFixed(0)}% utilized) — pause new loans or increase member share capital`, hi: `ऋण पोर्टफोलियो धारा 32 सीमा से अधिक (${sec32Pct.toFixed(0)}% उपयोग) — नए ऋण रोकें या शेयर पूंजी बढ़ाएं` });
    else if (sec32Pct >= 80 && loanLimit > 0)
      advisories.push({ severity: 'warning', en: `Loan utilisation at ${sec32Pct.toFixed(0)}% of Sec 32 limit — approaching regulatory ceiling`, hi: `ऋण उपयोग धारा 32 सीमा का ${sec32Pct.toFixed(0)}% — नियामक सीमा के निकट` });
    if (overdueCount > 0)
      advisories.push({ severity: 'warning', en: `${overdueCount} overdue loan${overdueCount > 1 ? 's' : ''} — initiate recovery proceedings promptly`, hi: `${overdueCount} अतिदेय ऋण — तत्काल वसूली कार्यवाही प्रारंभ करें` });
    if (pendingObjections > 0)
      advisories.push({ severity: 'warning', en: `${pendingObjections} pending audit objection${pendingObjections > 1 ? 's' : ''} — resolve before locking the financial year`, hi: `${pendingObjections} लंबित ऑडिट आपत्तियां — वित्त वर्ष लॉक से पूर्व निराकरण करें` });
    if (!fyLocked) {
      const endYY = society.financialYear.split('-')[1];
      if (new Date() > new Date(`20${endYY}-03-31`))
        advisories.push({ severity: 'info', en: `FY ${society.financialYear} has ended — lock the financial year after audit completion`, hi: `वित्त वर्ष ${society.financialYear} समाप्त — ऑडिट के बाद वित्त वर्ष लॉक करें` });
    }
    if (netProfit > 0 && reservePosted) {
      const divPosted = activeVouchers.some(v =>
        getVoucherLines(v).some(l => l.accountId === '1208' && l.type === 'Dr') &&
        getVoucherLines(v).some(l => l.accountId === '3601' && l.type === 'Cr') &&
        v.narration.includes(fy)
      );
      if (!divPosted)
        advisories.push({ severity: 'info', en: `Net profit of ₹${netProfit.toLocaleString('en-IN')} is available — consider distributing dividend to members`, hi: `₹${netProfit.toLocaleString('en-IN')} शुद्ध लाभ उपलब्ध — सदस्यों को लाभांश वितरण पर विचार करें` });
    }
    if (advisories.length === 0)
      advisories.push({ severity: 'info', en: 'All compliance checks passed — cooperative is in good financial health', hi: 'सभी अनुपालन जांचें पास — सहकारी संस्था की वित्तीय स्थिति उत्तम है' });

    return { reservePosted, bsTallied, stockOk, sec32Ok, fyLocked, netProfit, healthScore, advisories, physicalClosingStock, sec32Pct };
  }, [vouchers, getTrialBalance, getTradingAccount, loans, society, netProfit, auditObjections]);

  const recentVouchers = [...vouchers.filter(v => !v.isDeleted)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  // Monthly cash flow — financial year starts April (month index 3)
  const monthlyData = useMemo(() => {
    const fyStart = parseInt(society.financialYear.split('-')[0]);
    // months: April(fyStart) to March(fyStart+1)
    const months = [
      { year: fyStart, month: 3 }, { year: fyStart, month: 4 },
      { year: fyStart, month: 5 }, { year: fyStart, month: 6 },
      { year: fyStart, month: 7 }, { year: fyStart, month: 8 },
      { year: fyStart, month: 9 }, { year: fyStart, month: 10 },
      { year: fyStart, month: 11 }, { year: fyStart + 1, month: 0 },
      { year: fyStart + 1, month: 1 }, { year: fyStart + 1, month: 2 },
    ];

    const activeV = vouchers.filter(v => !v.isDeleted);

    return months.map((m, i) => {
      const receipts = activeV
        .filter(v => v.type === 'receipt' && new Date(v.date).getFullYear() === m.year && new Date(v.date).getMonth() === m.month)
        .reduce((s, v) => s + v.amount, 0);
      const payments = activeV
        .filter(v => v.type === 'payment' && new Date(v.date).getFullYear() === m.year && new Date(v.date).getMonth() === m.month)
        .reduce((s, v) => s + v.amount, 0);
      return {
        name: language === 'hi' ? MONTHS_HI[i] : MONTHS_EN[i],
        [language === 'hi' ? 'प्राप्तियां' : 'Receipts']: receipts,
        [language === 'hi' ? 'भुगतान' : 'Payments']: payments,
      };
    });
  }, [vouchers, society.financialYear, language]);

  // Income pie data
  const incomePieData = incomeItems.filter(i => i.amount > 0).map(i => ({
    name: language === 'hi' ? i.nameHi : i.name,
    value: i.amount,
  }));

  // Expense pie data
  const expensePieData = expenseItems.filter(e => e.amount > 0).map(e => ({
    name: language === 'hi' ? e.nameHi : e.name,
    value: e.amount,
  }));

  // Loan summary
  const activeLoans = loans.filter(l => l.status === 'active');
  const overdueLoans = loans.filter(l => l.status === 'overdue');
  const clearedLoans = loans.filter(l => l.status === 'cleared');
  const totalOutstanding = loans.reduce((s, l) => s + (l.amount - l.repaidAmount), 0);

  const typeBadgeClass = (type: string) => {
    if (type === 'receipt') return 'bg-success/20 text-success border-success/30';
    if (type === 'payment') return 'bg-destructive/20 text-destructive border-destructive/30';
    return 'bg-info/20 text-info border-info/30';
  };

  const typeLabel = (type: string) => {
    if (type === 'receipt') return language === 'hi' ? 'रसीद' : 'Receipt';
    if (type === 'payment') return language === 'hi' ? 'भुगतान' : 'Payment';
    return language === 'hi' ? 'जर्नल' : 'Journal';
  };

  const hasMonthlyData = monthlyData.some(m => {
    const r = language === 'hi' ? m['प्राप्तियां'] : m['Receipts'];
    const p = language === 'hi' ? m['भुगतान'] : m['Payments'];
    return (r as number) > 0 || (p as number) > 0;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('dashboard')}</h1>
        <p className="text-muted-foreground">
          {language === 'hi' ? `वित्तीय वर्ष ${society.financialYear} | आज की तिथि:` : `Financial Year ${society.financialYear} | Today:`}{' '}
          {new Date().toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN')}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={t('totalCash')}
          value={fmt(cashBalance)}
          subtitle={language === 'hi' ? 'हाथ में नकद शेष' : 'Cash in hand'}
          icon={Wallet}
          variant="cash"
          trend={{ value: 0, isPositive: cashBalance >= 0 }}
        />
        <StatCard
          title={t('totalBank')}
          value={fmt(bankBalance)}
          subtitle={language === 'hi' ? 'बैंक खाता शेष' : 'Bank balance'}
          icon={Building2}
          variant="bank"
          trend={{ value: 0, isPositive: bankBalance >= 0 }}
        />
        <StatCard
          title={t('totalMembers')}
          value={String(members.length)}
          subtitle={`${activeMembers} ${language === 'hi' ? 'सक्रिय' : 'active'}`}
          icon={Users}
          variant="members"
          trend={{ value: 0, isPositive: true }}
        />
        <StatCard
          title={netProfit >= 0 ? (language === 'hi' ? 'शुद्ध लाभ' : 'Net Profit') : (language === 'hi' ? 'शुद्ध हानि' : 'Net Loss')}
          value={fmt(Math.abs(netProfit))}
          subtitle={netProfit >= 0 ? (language === 'hi' ? 'कुल आय − व्यय' : 'Total Income − Expenses') : (language === 'hi' ? 'कुल व्यय − आय' : 'Total Expenses − Income')}
          icon={netProfit >= 0 ? TrendingUp : TrendingDown}
          variant={netProfit >= 0 ? 'profit' : 'loss'}
          trend={{ value: 0, isPositive: netProfit >= 0 }}
        />
      </div>

      {/* Monthly Cash Flow Chart */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">
            {language === 'hi' ? 'मासिक नकद प्रवाह' : 'Monthly Cash Flow'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasMonthlyData ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} width={56} />
                <Tooltip formatter={(val: number) => fmt(val)} />
                <Legend />
                <Bar dataKey={language === 'hi' ? 'प्राप्तियां' : 'Receipts'} fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey={language === 'hi' ? 'भुगतान' : 'Payments'} fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-12">
              {language === 'hi' ? 'चार्ट के लिए वाउचर दर्ज करें' : 'Enter vouchers to see the chart'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Income vs Expense Pie + Loan Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Income Pie */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">
              {language === 'hi' ? 'आय स्रोत' : 'Income Sources'}
              <span className="ml-2 text-sm font-normal text-success">{fmt(totalIncome)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {incomePieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={incomePieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                      {incomePieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => fmt(val)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {incomePieData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="truncate max-w-[120px]">{d.name}</span>
                      </div>
                      <span className="font-medium">{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center text-muted-foreground py-10 text-sm">
                {language === 'hi' ? 'कोई आय नहीं' : 'No income yet'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Expense Pie */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">
              {language === 'hi' ? 'व्यय विवरण' : 'Expense Breakdown'}
              <span className="ml-2 text-sm font-normal text-destructive">{fmt(totalExpenses)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expensePieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={expensePieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                      {expensePieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => fmt(val)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {expensePieData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[(i + 2) % PIE_COLORS.length] }} />
                        <span className="truncate max-w-[120px]">{d.name}</span>
                      </div>
                      <span className="font-medium">{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center text-muted-foreground py-10 text-sm">
                {language === 'hi' ? 'कोई व्यय नहीं' : 'No expenses yet'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Loan Portfolio Summary */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">
              {language === 'hi' ? 'ऋण पोर्टफोलियो' : 'Loan Portfolio'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center py-2">
              <p className="text-2xl font-bold text-primary">{fmt(totalOutstanding)}</p>
              <p className="text-xs text-muted-foreground">{language === 'hi' ? 'कुल बकाया राशि' : 'Total Outstanding'}</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 rounded-lg bg-success/10">
                <span className="text-sm text-success font-medium">{language === 'hi' ? 'सक्रिय ऋण' : 'Active'}</span>
                <Badge className="bg-success/20 text-success border-success/30">{activeLoans.length}</Badge>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-destructive/10">
                <span className="text-sm text-destructive font-medium">{language === 'hi' ? 'अतिदेय ऋण' : 'Overdue'}</span>
                <Badge className="bg-destructive/20 text-destructive border-destructive/30">{overdueLoans.length}</Badge>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground font-medium">{language === 'hi' ? 'चुकाए गए' : 'Cleared'}</span>
                <Badge variant="outline">{clearedLoans.length}</Badge>
              </div>
            </div>
            {loans.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-4">
                {language === 'hi' ? 'कोई ऋण दर्ज नहीं' : 'No loans recorded'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Vouchers + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">{t('recentVouchers')}</CardTitle>
            </CardHeader>
            <CardContent>
              {recentVouchers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {language === 'hi' ? 'कोई वाउचर नहीं। पहला वाउचर बनाएं!' : 'No vouchers yet. Create your first voucher!'}
                </p>
              ) : (
                <div className="space-y-3">
                  {recentVouchers.map(v => (
                    <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={typeBadgeClass(v.type)}>{typeLabel(v.type)}</Badge>
                        <div>
                          <p className="font-medium text-sm font-mono">{v.voucherNo}</p>
                          <p className="text-xs text-muted-foreground">{fmtDate(v.date)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{fmt(v.amount)}</p>
                        {v.narration && <p className="text-xs text-muted-foreground truncate max-w-32">{v.narration}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <QuickActions />
        </div>
      </div>

      {/* P3-3 + P4-1: Cooperative Compliance Status + Health Score */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            {language === 'hi' ? 'सहकारी अनुपालन स्थिति' : 'Cooperative Compliance Status'}
            <span className="text-xs font-normal text-muted-foreground">
              {language === 'hi' ? `वित्त वर्ष ${society.financialYear}` : `FY ${society.financialYear}`}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{language === 'hi' ? 'स्वास्थ्य स्कोर' : 'Health Score'}</span>
              <span className={`text-lg font-bold tabular-nums ${complianceChecks.healthScore >= 80 ? 'text-success' : complianceChecks.healthScore >= 60 ? 'text-amber-500' : 'text-destructive'}`}>
                {complianceChecks.healthScore}
              </span>
              <span className="text-xs text-muted-foreground">/100</span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              {
                label: language === 'hi' ? '25% संचय निधि (धारा 65)' : '25% Reserve Fund (Sec 65)',
                ok: complianceChecks.netProfit <= 0 || complianceChecks.reservePosted,
                na: complianceChecks.netProfit <= 0,
              },
              {
                label: language === 'hi' ? 'तुलन पत्र संतुलित' : 'Balance Sheet Tallied',
                ok: complianceChecks.bsTallied,
                na: false,
              },
              {
                label: language === 'hi' ? 'समापन माल जर्नल' : 'Closing Stock Journalized',
                ok: complianceChecks.stockOk,
                na: false,
              },
              {
                label: language === 'hi' ? 'ऋण सीमा (धारा 32)' : 'Loan Limit (Sec 32)',
                ok: complianceChecks.sec32Ok,
                na: false,
              },
              {
                label: language === 'hi' ? 'ऑडिट लॉक' : 'Audit FY Lock',
                ok: complianceChecks.fyLocked,
                na: false,
                infoOnly: true,
              },
            ].map(({ label, ok, na, infoOnly }) => (
              <div key={label} className={`flex items-start gap-2 p-3 rounded-lg border ${na ? 'bg-muted/30 border-muted' : ok ? 'bg-success/5 border-success/20' : 'bg-destructive/5 border-destructive/20'}`}>
                {na ? (
                  <Badge variant="outline" className="mt-0.5 text-xs shrink-0">N/A</Badge>
                ) : ok ? (
                  <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                )}
                <span className={`text-xs font-medium ${na ? 'text-muted-foreground' : ok ? 'text-success' : 'text-destructive'}`}>
                  {label}
                  {infoOnly && ok && <span className="block font-normal text-muted-foreground">{language === 'hi' ? 'लॉक है' : 'Locked'}</span>}
                  {infoOnly && !ok && <span className="block font-normal text-muted-foreground">{language === 'hi' ? 'अनलॉक' : 'Unlocked'}</span>}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* P4-2: Smart Advisory Engine */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500 shrink-0" />
            {language === 'hi' ? 'स्मार्ट सलाहकार' : 'Smart Advisories'}
            <span className="text-xs font-normal text-muted-foreground ml-1">
              {language === 'hi' ? 'स्वचालित सुझाव' : 'Automated recommendations'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {complianceChecks.advisories.map((adv, i) => {
              const isCritical = adv.severity === 'critical';
              const isWarning = adv.severity === 'warning';
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${isCritical ? 'bg-destructive/5 border-destructive/20' : isWarning ? 'bg-amber-500/5 border-amber-500/20' : 'bg-success/5 border-success/20'}`}>
                  {isCritical ? (
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  ) : isWarning ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  ) : (
                    <Info className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  )}
                  <span className={isCritical ? 'text-destructive' : isWarning ? 'text-amber-600' : 'text-success'}>
                    {language === 'hi' ? adv.hi : adv.en}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;

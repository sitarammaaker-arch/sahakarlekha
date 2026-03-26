import React, { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { StatCard } from '@/components/dashboard/StatCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { Wallet, Building2, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';

const MONTHS_HI = ['अप्रैल', 'मई', 'जून', 'जुलाई', 'अग.', 'सित.', 'अक्टू.', 'नव.', 'दिस.', 'जन.', 'फर.', 'मार्च'];
const MONTHS_EN = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#84cc16'];

const Dashboard: React.FC = () => {
  const { t, language } = useLanguage();
  const { getAccountBalance, members, vouchers, getProfitLoss, loans, society } = useData();

  const fmt = (amount: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

  const fmtShort = (amount: number) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
    return `₹${amount}`;
  };

  const cashBalance = getAccountBalance('CASH');
  const bankBalance = getAccountBalance('BANK');
  const { netProfit, incomeItems, expenseItems, totalIncome, totalExpenses } = getProfitLoss();
  const activeMembers = members.filter(m => m.status === 'active').length;

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
                          <p className="text-xs text-muted-foreground">{new Date(v.date).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN')}</p>
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
    </div>
  );
};

export default Dashboard;

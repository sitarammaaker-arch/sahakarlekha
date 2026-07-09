/**
 * Analytics (ECR-24) — a BI dashboard with real trends, growth and ratios, going
 * beyond the snapshot cards on the main Dashboard. Read-only; recharts + pure
 * analyticsMetrics helpers. All figures come from the same selectors the statutory
 * reports use, so they tie out.
 */
import React, { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, ShoppingCart, PackagePlus, TrendingUp, Percent } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, Cell,
} from 'recharts';
import { monthlySeries, momGrowth, topN, ratios, type Dated } from '@/lib/analyticsMetrics';

const fmtShort = (n: number) => {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 10000000) return `${sign}₹${(a / 10000000).toFixed(1)}Cr`;
  if (a >= 100000) return `${sign}₹${(a / 100000).toFixed(1)}L`;
  if (a >= 1000) return `${sign}₹${(a / 1000).toFixed(0)}K`;
  return `${sign}₹${Math.round(a)}`;
};

const Analytics: React.FC = () => {
  const { language } = useLanguage();
  const { sales, purchases, society, getProfitLoss, getTradingAccount } = useData();
  const hi = language === 'hi';
  const fy = society.financialYear;
  const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const pl = useMemo(() => getProfitLoss(), [getProfitLoss]);
  const trading = useMemo(() => getTradingAccount(), [getTradingAccount]);

  // Monthly Sales vs Purchases (+ derived margin) across the FY.
  const monthly = useMemo(() => {
    const s: Dated[] = sales.filter(x => !(x as { isDeleted?: boolean }).isDeleted).map(x => ({ date: x.date, amount: x.netAmount || 0 }));
    const p: Dated[] = purchases.filter(x => !x.isDeleted).map(x => ({ date: x.date, amount: x.netAmount || 0 }));
    return monthlySeries(fy, { sales: s, purchases: p }).map(r => ({ ...r, margin: Math.round((r.sales - r.purchases) * 100) / 100 }));
  }, [sales, purchases, fy]);

  const salesGrowth = useMemo(() => momGrowth(monthly, 'sales'), [monthly]);
  const purchGrowth = useMemo(() => momGrowth(monthly, 'purchases'), [monthly]);
  const marginGrowth = useMemo(() => momGrowth(monthly, 'margin'), [monthly]);

  const totalSales = trading.totalSales || 0;
  const totalPurchases = trading.totalPurchases || 0;
  const grossProfit = trading.grossProfit || 0;

  const r = useMemo(() => ratios({ sales: totalSales, grossProfit, totalIncome: pl.totalIncome || 0, totalExpenses: pl.totalExpenses || 0 }), [totalSales, grossProfit, pl.totalIncome, pl.totalExpenses]);

  const topIncome = useMemo(() => topN((pl.incomeItems || []).map(i => ({ name: hi ? (i.nameHi || i.name) : i.name, amount: i.amount })), 5), [pl.incomeItems, hi]);
  const topExpense = useMemo(() => topN((pl.expenseItems || []).map(e => ({ name: hi ? (e.nameHi || e.name) : e.name, amount: e.amount })), 5), [pl.expenseItems, hi]);

  const hasMonthly = monthly.some(m => m.sales > 0 || m.purchases > 0);
  const L = {
    sales: hi ? 'बिक्री' : 'Sales', purchases: hi ? 'खरीद' : 'Purchases', margin: hi ? 'सकल मार्जिन' : 'Gross margin',
  };
  const INCOME_COLOR = '#10b981', EXPENSE_COLOR = '#ef4444';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg"><BarChart3 className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'विश्लेषण (Analytics)' : 'Analytics'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? `वित्तीय वर्ष ${fy} — रुझान, वृद्धि व अनुपात` : `FY ${fy} — trends, growth and ratios`}</p>
        </div>
      </div>

      {/* KPI cards with real MoM growth */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard variant="profit" icon={ShoppingCart} title={hi ? 'कुल बिक्री (FY)' : 'Total Sales (FY)'} value={fmt(totalSales)} trend={{ value: Math.abs(salesGrowth), isPositive: salesGrowth >= 0 }} subtitle={hi ? 'पिछले माह की तुलना में' : 'vs previous month'} />
        <StatCard variant="bank" icon={PackagePlus} title={hi ? 'कुल खरीद (FY)' : 'Total Purchases (FY)'} value={fmt(totalPurchases)} trend={{ value: Math.abs(purchGrowth), isPositive: purchGrowth <= 0 }} subtitle={hi ? 'पिछले माह की तुलना में' : 'vs previous month'} />
        <StatCard variant={grossProfit >= 0 ? 'cash' : 'loss'} icon={TrendingUp} title={hi ? 'सकल लाभ' : 'Gross Profit'} value={fmt(grossProfit)} trend={{ value: Math.abs(marginGrowth), isPositive: marginGrowth >= 0 }} subtitle={`${hi ? 'सकल मार्जिन' : 'Gross margin'} ${r.grossMarginPct}%`} />
        <StatCard variant={(pl.netProfit || 0) >= 0 ? 'members' : 'loss'} icon={Percent} title={hi ? 'शुद्ध अधिशेष' : 'Net Surplus'} value={fmt(pl.netProfit || 0)} subtitle={`${hi ? 'अधिशेष मार्जिन' : 'Surplus margin'} ${r.surplusMarginPct}%`} />
      </div>

      {/* Monthly trend */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />{hi ? 'मासिक रुझान — बिक्री बनाम खरीद' : 'Monthly trend — Sales vs Purchases'}</CardTitle></CardHeader>
        <CardContent>
          {hasMonthly ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} width={54} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Line type="monotone" dataKey="sales" name={L.sales} stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="purchases" name={L.purchases} stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="margin" name={L.margin} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">{hi ? 'इस वर्ष कोई बिक्री/खरीद नहीं।' : 'No sales/purchases this year.'}</div>
          )}
        </CardContent>
      </Card>

      {/* Top income / expense heads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{hi ? 'शीर्ष 5 आय शीर्ष' : 'Top 5 income heads'}</CardTitle></CardHeader>
          <CardContent>
            {topIncome.length ? (
              <ResponsiveContainer width="100%" height={Math.max(160, topIncome.length * 44)}>
                <BarChart data={topIncome} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}>{topIncome.map((_, i) => <Cell key={i} fill={INCOME_COLOR} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="py-8 text-center text-sm text-muted-foreground">{hi ? 'कोई आय नहीं।' : 'No income.'}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{hi ? 'शीर्ष 5 व्यय शीर्ष' : 'Top 5 expense heads'}</CardTitle></CardHeader>
          <CardContent>
            {topExpense.length ? (
              <ResponsiveContainer width="100%" height={Math.max(160, topExpense.length * 44)}>
                <BarChart data={topExpense} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}>{topExpense.map((_, i) => <Cell key={i} fill={EXPENSE_COLOR} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="py-8 text-center text-sm text-muted-foreground">{hi ? 'कोई व्यय नहीं।' : 'No expenses.'}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Financial ratios */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Percent className="h-4 w-4 text-primary" />{hi ? 'वित्तीय अनुपात' : 'Financial ratios'}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">{hi ? 'सकल मार्जिन' : 'Gross margin'}</div>
              <div className="text-2xl font-bold">{r.grossMarginPct}%</div>
              <div className="text-xs text-muted-foreground mt-1">{hi ? 'सकल लाभ ÷ बिक्री' : 'Gross profit ÷ sales'}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">{hi ? 'अधिशेष मार्जिन' : 'Surplus margin'}</div>
              <div className="text-2xl font-bold">{r.surplusMarginPct}%</div>
              <div className="text-xs text-muted-foreground mt-1">{hi ? 'शुद्ध अधिशेष ÷ आय' : 'Net surplus ÷ income'}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">{hi ? 'व्यय अनुपात' : 'Expense ratio'}</div>
              <div className="text-2xl font-bold">{r.expenseRatioPct}%</div>
              <div className="text-xs text-muted-foreground mt-1">{hi ? 'कुल व्यय ÷ आय' : 'Total expenses ÷ income'}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;

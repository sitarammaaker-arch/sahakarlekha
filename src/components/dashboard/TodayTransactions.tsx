import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  time: string;
  type: 'credit' | 'debit';
  description: string;
  amount: number;
  account: string;
}

const todayTransactions: Transaction[] = [
  {
    id: '1',
    time: '10:30',
    type: 'credit',
    description: 'सदस्य शेयर जमा',
    amount: 5000,
    account: 'नकद',
  },
  {
    id: '2',
    time: '11:45',
    type: 'debit',
    description: 'बिजली बिल भुगतान',
    amount: 2500,
    account: 'बैंक',
  },
  {
    id: '3',
    time: '14:20',
    type: 'credit',
    description: 'गेहूं कमीशन',
    amount: 8500,
    account: 'बैंक',
  },
  {
    id: '4',
    time: '15:00',
    type: 'debit',
    description: 'स्टेशनरी खरीद',
    amount: 450,
    account: 'नकद',
  },
];

export const TodayTransactions: React.FC = () => {
  const { t } = useLanguage();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const totalCredit = todayTransactions
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDebit = todayTransactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          {t('todayTransactions')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="flex gap-4 mb-4 pb-4 border-b border-border">
          <div className="flex-1 text-center p-3 rounded-lg bg-success/10">
            <TrendingUp className="h-5 w-5 text-success mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">जमा (Credit)</p>
            <p className="font-bold text-success">{formatCurrency(totalCredit)}</p>
          </div>
          <div className="flex-1 text-center p-3 rounded-lg bg-destructive/10">
            <TrendingDown className="h-5 w-5 text-destructive mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">नाम (Debit)</p>
            <p className="font-bold text-destructive">{formatCurrency(totalDebit)}</p>
          </div>
        </div>

        {/* Transaction List */}
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {todayTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between py-2"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center',
                    transaction.type === 'credit'
                      ? 'bg-success/20 text-success'
                      : 'bg-destructive/20 text-destructive'
                  )}
                >
                  {transaction.type === 'credit' ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{transaction.description}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {transaction.time}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {transaction.account}
                    </Badge>
                  </div>
                </div>
              </div>
              <span
                className={cn(
                  'font-semibold',
                  transaction.type === 'credit' ? 'text-success' : 'text-destructive'
                )}
              >
                {transaction.type === 'credit' ? '+' : '−'} {formatCurrency(transaction.amount)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtDate } from '@/lib/dateUtils';

interface Voucher {
  id: string;
  voucherNo: string;
  type: 'receipt' | 'payment' | 'journal';
  date: string;
  particulars: string;
  amount: number;
}

const demoVouchers: Voucher[] = [
  {
    id: '1',
    voucherNo: 'RV/2024/001',
    type: 'receipt',
    date: '2024-01-10',
    particulars: 'सदस्य अंश जमा - राम प्रसाद',
    amount: 5000,
  },
  {
    id: '2',
    voucherNo: 'PV/2024/015',
    type: 'payment',
    date: '2024-01-10',
    particulars: 'कार्यालय किराया - जनवरी',
    amount: 3500,
  },
  {
    id: '3',
    voucherNo: 'RV/2024/002',
    type: 'receipt',
    date: '2024-01-09',
    particulars: 'कमीशन आय - गेहूं विक्रय',
    amount: 12500,
  },
  {
    id: '4',
    voucherNo: 'JV/2024/003',
    type: 'journal',
    date: '2024-01-09',
    particulars: 'समायोजन प्रविष्टि',
    amount: 2000,
  },
  {
    id: '5',
    voucherNo: 'PV/2024/014',
    type: 'payment',
    date: '2024-01-08',
    particulars: 'वेतन भुगतान - लेखापाल',
    amount: 15000,
  },
];

const voucherTypeStyles = {
  receipt: { label: 'रसीद', variant: 'default' as const, className: 'bg-success text-success-foreground' },
  payment: { label: 'भुगतान', variant: 'destructive' as const, className: 'bg-destructive text-destructive-foreground' },
  journal: { label: 'जर्नल', variant: 'secondary' as const, className: 'bg-info text-info-foreground' },
};

export const RecentVouchers: React.FC = () => {
  const { t } = useLanguage();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => fmtDate(dateStr);

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          {t('recentVouchers')}
        </CardTitle>
        <Button variant="ghost" size="sm" className="gap-1 text-primary">
          सभी देखें
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {demoVouchers.map((voucher) => (
            <div
              key={voucher.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Badge className={cn('text-xs', voucherTypeStyles[voucher.type].className)}>
                  {voucherTypeStyles[voucher.type].label}
                </Badge>
                <div>
                  <p className="font-medium text-sm">{voucher.particulars}</p>
                  <p className="text-xs text-muted-foreground">
                    {voucher.voucherNo} • {formatDate(voucher.date)}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  'font-semibold',
                  voucher.type === 'receipt' ? 'text-success' : voucher.type === 'payment' ? 'text-destructive' : 'text-foreground'
                )}
              >
                {voucher.type === 'payment' ? '−' : '+'} {formatCurrency(voucher.amount)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAction {
  key: string;
  label: { hi: string; en: string };
  icon: React.ElementType;
  path: string;
  variant: 'primary' | 'success' | 'destructive' | 'info';
}

const quickActions: QuickAction[] = [
  {
    key: 'newReceipt',
    label: { hi: 'नई रसीद', en: 'New Receipt' },
    icon: ArrowDownLeft,
    path: '/vouchers?type=receipt',
    variant: 'success',
  },
  {
    key: 'newPayment',
    label: { hi: 'नया भुगतान', en: 'New Payment' },
    icon: ArrowUpRight,
    path: '/vouchers?type=payment',
    variant: 'destructive',
  },
  {
    key: 'cashEntry',
    label: { hi: 'नकद एंट्री', en: 'Cash Entry' },
    icon: Wallet,
    path: '/cash-book',
    variant: 'primary',
  },
  {
    key: 'addMember',
    label: { hi: 'नया सदस्य', en: 'New Member' },
    icon: Users,
    path: '/members?action=new',
    variant: 'info',
  },
];

const variantStyles = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  success: 'bg-success text-success-foreground hover:bg-success/90',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  info: 'bg-info text-info-foreground hover:bg-info/90',
};

export const QuickActions: React.FC = () => {
  const { t, language } = useLanguage();
  const hi = language === 'hi';
  const navigate = useNavigate();

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5 text-accent" />
          {t('quickActions')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.key}
                onClick={() => navigate(action.path)}
                className={cn(
                  'h-auto py-4 flex flex-col items-center gap-2',
                  variantStyles[action.variant]
                )}
              >
                <Icon className="h-6 w-6" />
                <span className="text-sm font-medium">{hi ? action.label.hi : action.label.en}</span>
              </Button>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => navigate('/reports')}
          >
            <FileText className="h-4 w-4" />
            {hi ? 'रिपोर्ट देखें' : 'View Reports'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

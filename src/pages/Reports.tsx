import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  Wallet,
  Building2,
  BookOpen,
  Users,
  Scale,
  TrendingUp,
  FileSpreadsheet,
  Download,
  FileText,
  TrendingDown,
  IndianRupee,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportCard {
  key: string;
  title: string;
  titleHi: string;
  description: string;
  descriptionHi: string;
  icon: React.ElementType;
  path: string;
  color: string;
  pdfFn?: () => void;
}

const Reports: React.FC = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { getProfitLoss, members, accounts, getAccountBalance } = useData();

  const { totalIncome, totalExpenses, netProfit } = getProfitLoss();
  const cashBalance = getAccountBalance('CASH');
  const bankBalance = getAccountBalance('BANK');
  const activeMembers = members.filter(m => m.status === 'active').length;

  const fmt = (n: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const reportCards: ReportCard[] = [
    {
      key: 'cashBook',
      title: 'Cash Book Report',
      titleHi: 'नकद बही रिपोर्ट',
      description: 'Daily cash transactions with opening and closing balance',
      descriptionHi: 'प्रारंभिक व अंतिम शेष के साथ दैनिक नकद लेनदेन',
      icon: Wallet,
      path: '/cash-book',
      color: 'text-card-cash bg-card-cash/10 border-card-cash/30',
    },
    {
      key: 'bankBook',
      title: 'Bank Book Report',
      titleHi: 'बैंक बही रिपोर्ट',
      description: 'Bank account statement with cheque details',
      descriptionHi: 'चेक विवरण के साथ बैंक खाता विवरण',
      icon: Building2,
      path: '/bank-book',
      color: 'text-card-bank bg-card-bank/10 border-card-bank/30',
    },
    {
      key: 'ledger',
      title: 'General Ledger',
      titleHi: 'खाता बही',
      description: 'Account-wise detailed transactions',
      descriptionHi: 'खाता-वार विस्तृत लेनदेन',
      icon: BookOpen,
      path: '/ledger',
      color: 'text-primary bg-primary/10 border-primary/30',
    },
    {
      key: 'members',
      title: 'Member Ledger',
      titleHi: 'सदस्य खाता',
      description: 'Member-wise balance and transactions',
      descriptionHi: 'सदस्य-वार शेष व लेनदेन',
      icon: Users,
      path: '/members',
      color: 'text-card-members bg-card-members/10 border-card-members/30',
    },
    {
      key: 'trialBalance',
      title: 'Trial Balance',
      titleHi: 'तलपट',
      description: 'Summary of all ledger balances',
      descriptionHi: 'सभी खातों के शेष का सारांश',
      icon: Scale,
      path: '/trial-balance',
      color: 'text-info bg-info/10 border-info/30',
    },
    {
      key: 'profitLoss',
      title: 'Income & Expenditure',
      titleHi: 'आय-व्यय खाता',
      description: 'Income and expenditure statement',
      descriptionHi: 'आय व व्यय विवरण',
      icon: TrendingUp,
      path: '/profit-loss',
      color: 'text-card-profit bg-card-profit/10 border-card-profit/30',
    },
    {
      key: 'receiptsPayments',
      title: 'Receipts & Payments',
      titleHi: 'प्राप्ति एवं भुगतान',
      description: 'Cash and bank receipts & payments summary',
      descriptionHi: 'नकद व बैंक प्राप्ति एवं भुगतान सारांश',
      icon: IndianRupee,
      path: '/receipts-payments',
      color: 'text-success bg-success/10 border-success/30',
    },
    {
      key: 'balanceSheet',
      title: 'Balance Sheet',
      titleHi: 'तुलन पत्र',
      description: 'Assets and liabilities statement',
      descriptionHi: 'संपत्ति व देयता विवरण',
      icon: FileSpreadsheet,
      path: '/balance-sheet',
      color: 'text-primary bg-primary/10 border-primary/30',
    },
  ];

  const auditLinks = [
    { labelEn: 'Balance Sheet', labelHi: 'तुलन पत्र', icon: FileSpreadsheet, path: '/balance-sheet' },
    { labelEn: 'Member List', labelHi: 'सदस्य सूची', icon: Users, path: '/members' },
    { labelEn: 'Audit Register', labelHi: 'ऑडिट रजिस्टर', icon: ShieldCheck, path: '/audit-register' },
    { labelEn: 'Trial Balance', labelHi: 'तलपट', icon: Scale, path: '/trial-balance' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-primary" />
          {t('reports')}
        </h1>
        <p className="text-muted-foreground">
          {language === 'hi' ? 'सभी वित्तीय रिपोर्ट एक स्थान पर' : 'All financial reports in one place'}
        </p>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-success/10 border-success/20">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-success" />
              <p className="text-xs text-muted-foreground">{language === 'hi' ? 'कुल आय' : 'Total Income'}</p>
            </div>
            <p className="text-xl font-bold text-success">{fmt(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <p className="text-xs text-muted-foreground">{language === 'hi' ? 'कुल व्यय' : 'Total Expenses'}</p>
            </div>
            <p className="text-xl font-bold text-destructive">{fmt(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card className={cn('border', netProfit >= 0 ? 'bg-primary/10 border-primary/20' : 'bg-orange-500/10 border-orange-500/20')}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <IndianRupee className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">{language === 'hi' ? 'अधिशेष' : 'Net Surplus'}</p>
            </div>
            <p className={cn('text-xl font-bold', netProfit >= 0 ? 'text-primary' : 'text-orange-500')}>{fmt(netProfit)}</p>
          </CardContent>
        </Card>
        <Card className="bg-info/10 border-info/20">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-info" />
              <p className="text-xs text-muted-foreground">{language === 'hi' ? 'नकद + बैंक' : 'Cash + Bank'}</p>
            </div>
            <p className="text-xl font-bold text-info">{fmt(cashBalance + bankBalance)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportCards.map((report) => {
          const Icon = report.icon;
          return (
            <Card
              key={report.key}
              className={cn(
                'cursor-pointer transition-all duration-200 hover:shadow-card-hover hover:-translate-y-1 border-2',
                report.color
              )}
              onClick={() => navigate(report.path)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 rounded-xl bg-background flex items-center justify-center">
                    <Icon className="h-6 w-6" />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={e => { e.stopPropagation(); navigate(report.path); }}
                    title={language === 'hi' ? 'रिपोर्ट देखें' : 'View Report'}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
                <CardTitle className="text-lg mt-4">
                  {language === 'hi' ? report.titleHi : report.title}
                </CardTitle>
                <CardDescription>
                  {language === 'hi' ? report.descriptionHi : report.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full gap-2" onClick={() => navigate(report.path)}>
                  <FileText className="h-4 w-4" />
                  {language === 'hi' ? 'रिपोर्ट देखें' : 'View Report'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Audit Reports Section */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {language === 'hi' ? 'लेखापरीक्षा रिपोर्ट' : 'Audit Reports'}
          </CardTitle>
          <CardDescription>
            {language === 'hi'
              ? 'सहकारी समिति अधिनियम के अनुसार वार्षिक रिपोर्ट'
              : 'Annual reports as per Cooperative Society Act'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {auditLinks.map(link => {
              const Icon = link.icon;
              return (
                <Button
                  key={link.path}
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => navigate(link.path)}
                >
                  <Icon className="h-6 w-6" />
                  <span>{language === 'hi' ? link.labelHi : link.labelEn}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;

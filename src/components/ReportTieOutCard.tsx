import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getBankAccountIds } from '@/lib/storage';
import { buildTieOut } from '@/lib/reports/tieOut';
import { Card, CardContent } from '@/components/ui/card';
import type { AccountBalance } from '@/types';

const inr = (n: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/** Read-only check that the Trial Balance, the Bank Books and Receipts & Payments agree on the bank balance. */
const ReportTieOutCard: React.FC<{ balances: AccountBalance[]; asOnDate: string; closingDr: number; closingCr: number }> = ({ balances, asOnDate, closingDr, closingCr }) => {
  const { accounts, getBankBookEntries, getReceiptsPayments } = useData();
  const { language } = useLanguage();

  const bankIds = getBankAccountIds(accounts);
  const tbBankClosing = balances.filter(b => bankIds.includes(b.account.id)).reduce((s, b) => s + b.netBalance, 0);
  const bankBooksClosing = bankIds.reduce((s, id) => {
    const rows = getBankBookEntries(undefined, asOnDate, id);
    if (rows.length > 0) return s + rows[rows.length - 1].runningBalance;
    const acc = accounts.find(a => a.id === id);
    return s + (acc ? (acc.openingBalanceType === 'debit' ? acc.openingBalance : -acc.openingBalance) : 0);
  }, 0);
  const rpClosingBank = getReceiptsPayments(asOnDate).closingBank;

  const rows = buildTieOut({ tbClosingDr: closingDr, tbClosingCr: closingCr, tbBankClosing, bankBooksClosing, rpClosingBank });
  const allOk = rows.every(r => r.ok);

  return (
    <Card className={allOk ? 'border-success/30' : 'border-warning/50'}>
      <CardContent className="pt-4 space-y-1 text-sm">
        <div className="flex items-center gap-2 font-medium">
          {allOk ? <CheckCircle className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-warning" />}
          {language === 'hi' ? 'रिपोर्ट मिलान जाँच' : 'Report tie-out'}
        </div>
        {rows.map(r => (
          <div key={r.key} className="flex flex-wrap justify-between gap-2">
            <span>{language === 'hi' ? r.labelHi : r.label}</span>
            <span className={r.ok ? 'text-success' : 'text-warning font-medium'}>
              {r.ok ? (language === 'hi' ? 'मिलान ठीक' : 'Agrees') : `${language === 'hi' ? 'अंतर' : 'Difference'} Rs. ${inr(Math.abs(r.diff))} (${inr(r.a)} vs ${inr(r.b)})`}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default ReportTieOutCard;

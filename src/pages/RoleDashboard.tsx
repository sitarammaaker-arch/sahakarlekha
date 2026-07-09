/**
 * Role Dashboard (ECR-18) — a role-adaptive KPI landing.
 *
 * Renders only the widgets relevant to the current user's role (roleDashboard.ts registry),
 * computed from existing getters. Additive — the general Dashboard is untouched.
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { LayoutDashboard } from 'lucide-react';
import { ACCOUNT_IDS, getBankAccountIds } from '@/lib/storage';
import { roleWidgets, type WidgetId } from '@/lib/roleDashboard';
import { buildComplianceCalendar, complianceNotifications } from '@/lib/complianceCalendar';

type Tone = 'ok' | 'warn' | 'bad' | 'neutral';
const TONE: Record<Tone, string> = {
  ok: 'text-emerald-600', warn: 'text-orange-600', bad: 'text-red-600', neutral: 'text-foreground',
};

const RoleDashboard: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const {
    getProfitLoss, getTrialBalance, getAccountBalance, getShareCapitalReconciliation,
    members, loans, vouchers, auditObjections, employees, society, accounts,
    stockItems, purchases,
  } = useData();
  const navigate = useNavigate();
  const hi = language === 'hi';
  const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const widgets = useMemo(() => roleWidgets(user?.role), [user?.role]);

  const data = useMemo(() => {
    const netProfit = getProfitLoss().netProfit;
    const tb = getTrialBalance();
    const tbDr = tb.reduce((s, r) => s + (r.totalDebit || 0), 0);
    const tbCr = tb.reduce((s, r) => s + (r.totalCredit || 0), 0);
    const tbBalanced = Math.abs(tbDr - tbCr) < 1;
    const activeMembers = members.filter(m => (!m.approvalStatus || m.approvalStatus === 'approved') && m.status === 'active').length;
    const loanOutstanding = loans.reduce((s, l) => s + Math.max(0, (l.amount || 0) - (l.repaidAmount || 0)), 0);
    const overdueLoans = loans.filter(l => l.status === 'overdue').length;
    const pendingVouchers = vouchers.filter(v => !v.isDeleted && v.approvalStatus === 'pending').length;
    const rejectedVouchers = vouchers.filter(v => !v.isDeleted && v.approvalStatus === 'rejected').length;
    const pendingObjections = auditObjections.filter(o => o.status === 'pending').length;
    const rec = getShareCapitalReconciliation();
    const cash = getAccountBalance(ACCOUNT_IDS.CASH);
    const bank = getBankAccountIds(accounts).reduce((s, id) => s + getAccountBalance(id), 0);
    const asOf = new Date().toISOString().split('T')[0];
    const complianceDue = complianceNotifications(buildComplianceCalendar(asOf, {
      hasEmployees: (employees || []).some(e => e.status === 'active'),
      tan: !!society.tan?.trim(), gstin: !!society.gstin?.trim(),
    })).length;
    const stockValue = (stockItems || []).reduce((s, it) => s + Math.max(0, it.currentStock || 0) * (it.purchaseRate || 0), 0);
    const outOfStock = (stockItems || []).filter(it => (it.currentStock || 0) <= 0).length;
    const purchasesCount = (purchases || []).filter(p => !p.isDeleted).length;
    return { netProfit, tbBalanced, activeMembers, loanOutstanding, overdueLoans, pendingVouchers, rejectedVouchers, pendingObjections, rec, cash, bank, complianceDue, stockValue, outOfStock, purchasesCount };
  }, [getProfitLoss, getTrialBalance, getAccountBalance, getShareCapitalReconciliation, members, loans, vouchers, auditObjections, employees, society, accounts, stockItems, purchases]);

  const widget = (id: WidgetId): { label: string; value: string; sub?: string; tone: Tone; route: string } => {
    switch (id) {
      case 'netProfit': return { label: hi ? 'शुद्ध लाभ' : 'Net Profit', value: fmt(data.netProfit), tone: data.netProfit >= 0 ? 'ok' : 'bad', route: '/profit-loss' };
      case 'bsStatus': return { label: hi ? 'बैलेंस शीट' : 'Balance Sheet', value: data.tbBalanced ? (hi ? 'संतुलित' : 'Balanced') : (hi ? 'असंतुलित' : 'Not balanced'), tone: data.tbBalanced ? 'ok' : 'bad', route: '/balance-sheet' };
      case 'trialBalance': return { label: hi ? 'ट्रायल बैलेंस' : 'Trial Balance', value: data.tbBalanced ? (hi ? 'मिला' : 'Tallied') : (hi ? 'अंतर' : 'Mismatch'), tone: data.tbBalanced ? 'ok' : 'bad', route: '/trial-balance' };
      case 'members': return { label: hi ? 'सक्रिय सदस्य' : 'Active Members', value: String(data.activeMembers), tone: 'neutral', route: '/members' };
      case 'loanPortfolio': return { label: hi ? 'ऋण बकाया' : 'Loan Outstanding', value: fmt(data.loanOutstanding), sub: data.overdueLoans > 0 ? (hi ? `${data.overdueLoans} अतिदेय` : `${data.overdueLoans} overdue`) : undefined, tone: data.overdueLoans > 0 ? 'warn' : 'neutral', route: '/loan-register' };
      case 'pendingApprovals': return { label: hi ? 'लंबित अनुमोदन' : 'Pending Approvals', value: String(data.pendingVouchers), tone: data.pendingVouchers > 0 ? 'warn' : 'ok', route: '/voucher-approval' };
      case 'unapprovedVouchers': return { label: hi ? 'बिना-अनुमोदित वाउचर' : 'Unapproved Vouchers', value: String(data.pendingVouchers + data.rejectedVouchers), sub: data.rejectedVouchers > 0 ? (hi ? `${data.rejectedVouchers} अस्वीकृत` : `${data.rejectedVouchers} rejected`) : undefined, tone: (data.pendingVouchers + data.rejectedVouchers) > 0 ? 'warn' : 'ok', route: '/voucher-approval' };
      case 'complianceDue': return { label: hi ? 'सांविधिक देय' : 'Compliance Due', value: String(data.complianceDue), tone: data.complianceDue > 0 ? 'warn' : 'ok', route: '/compliance-calendar' };
      case 'auditObjections': return { label: hi ? 'लंबित आपत्तियां' : 'Audit Objections', value: String(data.pendingObjections), tone: data.pendingObjections > 0 ? 'warn' : 'ok', route: '/audit-register' };
      case 'shareReconciliation': return { label: hi ? 'शेयर मिलान' : 'Share Reconciliation', value: data.rec.reconciled ? (hi ? 'मिला' : 'Reconciled') : (hi ? 'बेमेल' : 'Drift'), tone: data.rec.reconciled ? 'ok' : 'bad', route: '/share-register' };
      case 'cashBank': return { label: hi ? 'नकद + बैंक' : 'Cash + Bank', value: fmt(data.cash + data.bank), tone: 'neutral', route: '/cash-book' };
      case 'periodLock': return { label: hi ? 'अवधि लॉक' : 'Period Lock', value: society.periodLockDate || (hi ? 'नहीं' : 'None'), tone: society.periodLockDate ? 'ok' : 'neutral', route: '/society-setup' };
      case 'stockValue': return { label: hi ? 'स्टॉक मूल्य' : 'Stock Value', value: fmt(data.stockValue), tone: 'neutral', route: '/inventory' };
      case 'outOfStock': return { label: hi ? 'स्टॉक खत्म' : 'Out of Stock', value: String(data.outOfStock), sub: hi ? 'आइटम' : 'items', tone: data.outOfStock > 0 ? 'warn' : 'ok', route: '/inventory' };
      case 'purchasesCount': return { label: hi ? 'खरीद प्रविष्टियां' : 'Purchase Entries', value: String(data.purchasesCount), tone: 'neutral', route: '/purchases' };
      default: return { label: id, value: '—', tone: 'neutral', route: '/' };
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2 bg-primary/10 rounded-lg"><LayoutDashboard className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{hi ? 'मेरा डैशबोर्ड' : 'My Dashboard'}</h1>
          <p className="text-sm text-gray-500">
            {hi ? `${user?.name || ''} — आपकी भूमिका के अनुसार मुख्य आँकड़े` : `${user?.name || ''} — key metrics for your role`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {widgets.map(id => {
          const w = widget(id);
          return (
            <Card key={id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(w.route)}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{w.label}</p>
                <p className={`text-xl font-bold ${TONE[w.tone]}`}>{w.value}</p>
                {w.sub && <p className="text-[11px] text-muted-foreground mt-0.5">{w.sub}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {hi ? 'भूमिका के अनुसार दिखाया गया। कार्ड पर क्लिक कर विस्तृत पृष्ठ खोलें।' : 'Shown by role. Click a card to open the detailed page.'}
      </p>
    </div>
  );
};

export default RoleDashboard;

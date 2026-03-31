/**
 * Data Backup & Restore — Supabase-primary version
 * Exports data from DataContext (loaded from Supabase) as JSON.
 * Restore from file is not supported in cloud mode.
 */
import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DatabaseBackup, Download, CheckCircle2, Info, Shield, Cloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const BACKUP_VERSION = '3.0-supabase';

// ────────────────────────────────────────────────────────────────────────────
const BackupRestore: React.FC = () => {
  const { language } = useLanguage();
  const {
    society, vouchers, members, accounts, loans, assets,
    auditObjections, stockItems, stockMovements,
    sales, purchases, suppliers, customers,
    employees, salaryRecords, kccLoans,
  } = useData();
  const { toast } = useToast();

  const hi = language === 'hi';
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(
    () => localStorage.getItem('sahayata_last_backup')
  );

  // ── Summary stats ─────────────────────────────────────────────────────────
  const stats = {
    vouchers: vouchers.filter(v => !v.isDeleted).length,
    members: members.length,
    accounts: accounts.length,
    loans: loans.length,
    assets: assets.length,
    sales: sales.length,
    purchases: purchases.length,
    suppliers: suppliers.length,
    customers: customers.length,
    stockItems: stockItems.length,
    employees: employees.length,
    salaryRecords: salaryRecords.length,
    kccLoans: kccLoans.length,
    auditObjections: auditObjections.length,
  };

  // ── Backup ─────────────────────────────────────────────────────────────────
  const handleBackup = () => {
    const backup = {
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      societyName: society.name,
      financialYear: society.financialYear,
      source: 'supabase',
      data: {
        society,
        vouchers,
        members,
        accounts,
        loans,
        assets,
        auditObjections,
        stockItems,
        stockMovements,
        sales,
        purchases,
        suppliers,
        customers,
        employees,
        salaryRecords,
        kccLoans,
      },
      stats,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href     = url;
    a.download = `sahakarlekha-backup-${society.financialYear}-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);

    const now = new Date().toLocaleString('hi-IN');
    localStorage.setItem('sahayata_last_backup', now);
    setLastBackupTime(now);

    toast({
      title: hi ? 'बैकअप सफलतापूर्वक डाउनलोड हुआ' : 'Backup downloaded successfully',
      description: `${Object.values(stats).reduce((a, b) => a + b, 0)} ${hi ? 'रिकॉर्ड' : 'records'}`,
    });
  };

  const STAT_LABELS: Array<{ key: keyof typeof stats; hi: string; en: string; color: string }> = [
    { key: 'vouchers',       hi: 'वाउचर',          en: 'Vouchers',       color: 'text-blue-700' },
    { key: 'members',        hi: 'सदस्य',           en: 'Members',        color: 'text-green-700' },
    { key: 'accounts',       hi: 'खाता शीर्षक',     en: 'Accounts',       color: 'text-purple-700' },
    { key: 'loans',          hi: 'ऋण',              en: 'Loans',          color: 'text-orange-700' },
    { key: 'assets',         hi: 'संपत्ति',          en: 'Assets',         color: 'text-pink-700' },
    { key: 'sales',          hi: 'बिक्री',           en: 'Sales',          color: 'text-teal-700' },
    { key: 'purchases',      hi: 'खरीद',             en: 'Purchases',      color: 'text-indigo-700' },
    { key: 'suppliers',      hi: 'आपूर्तिकर्ता',    en: 'Suppliers',      color: 'text-gray-700' },
    { key: 'customers',      hi: 'ग्राहक',           en: 'Customers',      color: 'text-gray-700' },
    { key: 'stockItems',     hi: 'स्टॉक आइटम',      en: 'Stock Items',    color: 'text-amber-700' },
    { key: 'employees',      hi: 'कर्मचारी',         en: 'Employees',      color: 'text-red-700' },
    { key: 'salaryRecords',  hi: 'वेतन रिकॉर्ड',    en: 'Salary Records', color: 'text-red-600' },
    { key: 'kccLoans',       hi: 'KCC ऋण',           en: 'KCC Loans',      color: 'text-yellow-700' },
    { key: 'auditObjections',hi: 'ऑडिट आपत्तियाँ', en: 'Audit Items',    color: 'text-slate-700' },
  ];

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2 bg-slate-100 rounded-lg">
          <DatabaseBackup className="h-6 w-6 text-slate-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {hi ? 'डेटा बैकअप' : 'Data Backup'}
          </h1>
          <p className="text-sm text-gray-500">
            {society.name} · {hi ? 'वित्तीय वर्ष' : 'FY'} {society.financialYear}
          </p>
        </div>
      </div>

      {/* Cloud info */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <Cloud className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {hi
            ? 'आपका डेटा Supabase क्लाउड में सुरक्षित रूप से संग्रहीत है। यह बैकअप आपके Supabase डेटाबेस से सभी डेटा का JSON एक्सपोर्ट है — अतिरिक्त सुरक्षा के लिए नियमित रूप से डाउनलोड करें।'
            : 'Your data is stored securely in Supabase cloud. This backup is a JSON export of all your data from Supabase — download regularly for extra safety.'}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          [hi ? 'वाउचर' : 'Vouchers', stats.vouchers, 'text-blue-700'],
          [hi ? 'सदस्य' : 'Members',  stats.members,  'text-green-700'],
          [hi ? 'ऋण' : 'Loans',       stats.loans,    'text-orange-700'],
          [hi ? 'खाते' : 'Accounts',  stats.accounts, 'text-purple-700'],
        ].map(([label, count, cls]) => (
          <Card key={String(label)}>
            <CardContent className="p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className={`text-xl font-bold ${cls}`}>{count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Backup card */}
      <Card className="border-green-200">
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2 text-green-700">
            <Download className="h-4 w-4" />
            {hi ? 'बैकअप बनाएं' : 'Create Backup'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            {hi
              ? 'सभी मौजूदा डेटा (Supabase से) को JSON फ़ाइल में डाउनलोड करें।'
              : 'Download all current data (from Supabase) as a JSON file.'}
          </p>
          {lastBackupTime && (
            <div className="flex items-center gap-2 text-xs text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {hi ? 'अंतिम बैकअप:' : 'Last backup:'} {lastBackupTime}
            </div>
          )}
          <Button onClick={handleBackup} className="gap-2 bg-green-700 hover:bg-green-800">
            <Download className="h-4 w-4" />
            {hi ? 'अभी बैकअप करें' : 'Backup Now'}
          </Button>
        </CardContent>
      </Card>

      {/* Restore notice */}
      <Card className="border-slate-200 bg-slate-50">
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2 text-slate-600">
            <Cloud className="h-4 w-4" />
            {hi ? 'डेटा रीस्टोर' : 'Data Restore'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 p-2 bg-slate-100 border border-slate-200 rounded text-xs text-slate-700">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {hi
              ? 'चूँकि डेटा अब Supabase क्लाउड में संग्रहीत है, फ़ाइल से रीस्टोर उपलब्ध नहीं है। डेटा माइग्रेशन के लिए Supabase डैशबोर्ड या अपने व्यवस्थापक से संपर्क करें।'
              : 'Since data is now stored in Supabase cloud, file-based restore is not available. For data migration, contact your administrator or use the Supabase dashboard.'}
          </div>
        </CardContent>
      </Card>

      {/* Data inventory */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-gray-500" />
            {hi ? 'डेटा सूची (Supabase से)' : 'Data Inventory (from Supabase)'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {STAT_LABELS.map(({ key, hi: labelHi, en: labelEn, color }) => (
              <div key={key} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 text-sm">
                <span className="text-gray-600">{hi ? labelHi : labelEn}</span>
                <Badge variant="outline" className={`text-xs font-mono ${color}`}>{stats[key]}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupRestore;

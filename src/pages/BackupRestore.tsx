/**
 * Data Export — Supabase-primary version
 *
 * T-01 (ROADMAP-DATA-PORTABILITY): this page used to call itself "Backup & Restore"
 * and offered a Restore button. That was untrue and unsafe:
 *
 *   - The JSON covers 16 of ~93 persisted collections (no housing / dairy / marketing /
 *     consumer / labour / procurement / deposits / voucher_entries).
 *   - The old restore re-imported ONLY accounts + members and silently discarded the
 *     other 14 exported collections — every voucher, sale, purchase, loan and asset.
 *
 * A restore that recovers a chart of accounts and drops every transaction is worse than
 * no restore at all, because the user stops looking for their data. So the restore path
 * is removed and the word "backup" is gone until a real, round-trippable backup ships
 * (roadmap T-23…T-35). This page now claims exactly what it does: it exports JSON.
 *
 * FORMAT CONTRACT — DO NOT CHANGE. `MultiSocietyConsolidation.tsx` consumes these files
 * and reads { version, createdAt, societyName, financialYear, data, stats }.
 */
import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Info, Shield, Cloud, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/** Consumed by MultiSocietyConsolidation — do not bump without updating that reader. */
const BACKUP_VERSION = '3.0-supabase';

/** Collections included in this export. Total persisted collections in the app: ~93. */
const EXPORTED_COLLECTIONS = 16;
const TOTAL_COLLECTIONS = 93;

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

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
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
    a.download = `sahakarlekha-export-${society.financialYear}-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: hi ? 'एक्सपोर्ट डाउनलोड हुआ' : 'Export downloaded',
      description: hi
        ? `${Object.values(stats).reduce((a, b) => a + b, 0)} रिकॉर्ड। यह रिस्टोर करने योग्य बैकअप नहीं है।`
        : `${Object.values(stats).reduce((a, b) => a + b, 0)} records. This is not a restorable backup.`,
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
          <Download className="h-6 w-6 text-slate-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {hi ? 'डेटा एक्सपोर्ट' : 'Data Export'}
          </h1>
          <p className="text-sm text-gray-500">
            {society.name} · {hi ? 'वित्तीय वर्ष' : 'FY'} {society.financialYear}
          </p>
        </div>
      </div>

      {/* T-01: the honest warning. This is an export, not a backup. */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-900">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">
            {hi ? 'यह एक्सपोर्ट है, बैकअप नहीं।' : 'This is an export, not a backup.'}
          </p>
          <p>
            {hi
              ? `इस JSON फ़ाइल से डेटा वापस रिस्टोर नहीं किया जा सकता। इसमें ${EXPORTED_COLLECTIONS} सूचियाँ हैं, जबकि ऐप में कुल लगभग ${TOTAL_COLLECTIONS} हैं — हाउसिंग, डेयरी, मार्केटिंग, कंज़्यूमर, श्रमिक, खरीद (procurement) और जमा (deposits) का डेटा इसमें नहीं आता।`
              : `Data cannot be restored from this JSON file. It contains ${EXPORTED_COLLECTIONS} collections out of roughly ${TOTAL_COLLECTIONS} in the app — housing, dairy, marketing, consumer, labour, procurement and deposits data are not included.`}
          </p>
          <p>
            {hi
              ? 'आपका असली डेटा Supabase क्लाउड में सुरक्षित है। पूरा, रिस्टोर होने वाला बैकअप बनाया जा रहा है।'
              : 'Your actual data lives safely in Supabase cloud. A complete, restorable backup is being built.'}
          </p>
        </div>
      </div>

      {/* Cloud info */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <Cloud className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {hi
            ? 'यह फ़ाइल Supabase से पढ़े गए डेटा का JSON स्नैपशॉट है — रिकॉर्ड देखने, ऑडिटर को भेजने, या बहु-समिति समेकन में उपयोग के लिए।'
            : 'This file is a JSON snapshot of data read from Supabase — for inspecting records, sharing with an auditor, or use in Multi-Society Consolidation.'}
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

      {/* Export card */}
      <Card className="border-green-200">
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2 text-green-700">
            <Download className="h-4 w-4" />
            {hi ? 'JSON एक्सपोर्ट डाउनलोड करें' : 'Download JSON Export'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            {hi
              ? `नीचे दी गई ${EXPORTED_COLLECTIONS} सूचियों का मौजूदा डेटा एक JSON फ़ाइल में डाउनलोड करें।`
              : `Download the current data for the ${EXPORTED_COLLECTIONS} collections listed below as a JSON file.`}
          </p>
          <Button onClick={handleExport} className="gap-2 bg-green-700 hover:bg-green-800">
            <Download className="h-4 w-4" />
            {hi ? 'एक्सपोर्ट डाउनलोड करें' : 'Download Export'}
          </Button>
        </CardContent>
      </Card>

      {/* Restore — removed in T-01, explained rather than silently dropped */}
      <Card className="border-gray-200 bg-gray-50/60">
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2 text-gray-600">
            <Info className="h-4 w-4" />
            {hi ? 'रिस्टोर उपलब्ध नहीं है' : 'Restore is not available'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            {hi
              ? 'पहले यहाँ एक Restore बटन था, लेकिन वह सिर्फ़ खाता शीर्षक और सदस्य वापस लाता था — वाउचर, बिक्री, खरीद, ऋण और संपत्ति चुपचाप छूट जाते थे। ऐसा अधूरा रिस्टोर न होने से भी ज़्यादा ख़तरनाक है, क्योंकि यूज़र अपना असली डेटा ढूँढ़ना बंद कर देता है। इसलिए उसे हटा दिया गया है। पूरा बैकअप और रिस्टोर अलग से बनाया जा रहा है।'
              : 'A Restore button used to sit here, but it only brought back accounts and members — vouchers, sales, purchases, loans and assets were silently dropped. A partial restore is more dangerous than none, because it ends the search for the real data. It has been removed. A complete backup and restore is being built separately.'}
          </p>
        </CardContent>
      </Card>

      {/* Data inventory */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-gray-500" />
            {hi ? 'इस एक्सपोर्ट में शामिल डेटा' : 'Data included in this export'}
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

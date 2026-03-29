/**
 * Data Backup & Restore
 *
 * Full JSON export of all localStorage data + selective restore.
 * Backup file includes a version + timestamp so restores can validate.
 */
import React, { useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DatabaseBackup, Upload, Download, CheckCircle2, AlertTriangle, Info, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ── All localStorage keys managed by the app ─────────────────────────────────
const ALL_KEYS = [
  'sahayata_vouchers',
  'sahayata_members',
  'sahayata_accounts',
  'sahayata_society',
  'sahayata_counters',
  'sahayata_loans',
  'sahayata_assets',
  'sahayata_loan_counter',
  'sahayata_asset_counter',
  'sahayata_audit_objections',
  'sahayata_objection_counter',
  'sahayata_stock_items',
  'sahayata_stock_movements',
  'sahayata_item_counter',
  'sahayata_sales',
  'sahayata_sale_counter',
  'sahayata_purchases',
  'sahayata_purchase_counter',
  'sahayata_employees',
  'sahayata_emp_counter',
  'sahayata_salary_records',
  'sahayata_salary_counter',
  'sahayata_suppliers',
  'sahayata_supplier_counter',
  'sahayata_customers',
  'sahayata_customer_counter',
  // Meeting register (standalone localStorage)
  'sahayata_meetings',
];

const BACKUP_VERSION = '2.0';

interface BackupFile {
  version: string;
  createdAt: string;
  societyName: string;
  financialYear: string;
  data: Record<string, unknown>;
  stats: Record<string, number>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const readKey = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeKey = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.warn('Failed to write key:', key);
  }
};

const countItems = (val: unknown): number => {
  if (Array.isArray(val)) return val.length;
  if (val && typeof val === 'object') return Object.keys(val).length;
  return val != null ? 1 : 0;
};

// ── Label map ─────────────────────────────────────────────────────────────────
const KEY_LABELS: Record<string, { hi: string; en: string }> = {
  sahayata_vouchers:         { hi: 'वाउचर', en: 'Vouchers' },
  sahayata_members:          { hi: 'सदस्य', en: 'Members' },
  sahayata_accounts:         { hi: 'खाता शीर्षक', en: 'Ledger Accounts' },
  sahayata_society:          { hi: 'समिति सेटिंग', en: 'Society Settings' },
  sahayata_loans:            { hi: 'ऋण रजिस्टर', en: 'Loans' },
  sahayata_assets:           { hi: 'संपत्ति रजिस्टर', en: 'Assets' },
  sahayata_audit_objections: { hi: 'ऑडिट आपत्तियाँ', en: 'Audit Objections' },
  sahayata_stock_items:      { hi: 'स्टॉक आइटम', en: 'Stock Items' },
  sahayata_stock_movements:  { hi: 'स्टॉक मूवमेंट', en: 'Stock Movements' },
  sahayata_sales:            { hi: 'बिक्री', en: 'Sales' },
  sahayata_purchases:        { hi: 'खरीद', en: 'Purchases' },
  sahayata_employees:        { hi: 'कर्मचारी', en: 'Employees' },
  sahayata_salary_records:   { hi: 'वेतन रिकॉर्ड', en: 'Salary Records' },
  sahayata_suppliers:        { hi: 'आपूर्तिकर्ता', en: 'Suppliers' },
  sahayata_customers:        { hi: 'ग्राहक', en: 'Customers' },
  sahayata_meetings:         { hi: 'बैठक रजिस्टर', en: 'Meetings' },
};

// ────────────────────────────────────────────────────────────────────────────
const BackupRestore: React.FC = () => {
  const { language } = useLanguage();
  const { society } = useData();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hi = language === 'hi';

  const [restorePreview, setRestorePreview] = useState<BackupFile | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(
    () => localStorage.getItem('sahayata_last_backup')
  );

  // ── Current data summary ───────────────────────────────────────────────────
  const currentStats = ALL_KEYS.reduce<Record<string, number>>((acc, key) => {
    const val = readKey(key);
    acc[key] = countItems(val);
    return acc;
  }, {});

  const totalVouchers = currentStats['sahayata_vouchers'] ?? 0;
  const totalMembers  = currentStats['sahayata_members']  ?? 0;
  const totalLoans    = currentStats['sahayata_loans']    ?? 0;
  const totalAssets   = currentStats['sahayata_assets']   ?? 0;

  // ── Backup ─────────────────────────────────────────────────────────────────
  const handleBackup = () => {
    const data: Record<string, unknown> = {};
    const stats: Record<string, number> = {};

    for (const key of ALL_KEYS) {
      const val = readKey(key);
      if (val !== null) {
        data[key] = val;
        stats[key] = countItems(val);
      }
    }

    const backup: BackupFile = {
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      societyName: society.name,
      financialYear: society.financialYear,
      data,
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
      description: `${Object.keys(data).length} ${hi ? 'डेटा सेट' : 'data sets'}`,
    });
  };

  // ── File pick ──────────────────────────────────────────────────────────────
  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as BackupFile;
        if (!parsed.version || !parsed.data || !parsed.createdAt) {
          throw new Error('Invalid backup file format');
        }
        setRestorePreview(parsed);
        setRestoreConfirm(true);
      } catch {
        toast({
          title: hi ? 'अमान्य बैकअप फ़ाइल' : 'Invalid backup file',
          description: hi ? 'JSON फ़ाइल पहचानी नहीं गई' : 'Could not parse the backup JSON',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  // ── Restore ────────────────────────────────────────────────────────────────
  const handleRestore = () => {
    if (!restorePreview) return;

    for (const [key, value] of Object.entries(restorePreview.data)) {
      writeKey(key, value);
    }

    setRestoreConfirm(false);
    setRestorePreview(null);

    toast({
      title: hi ? 'डेटा पुनर्स्थापित हो गया — पृष्ठ रीलोड हो रहा है' : 'Data restored — reloading page',
    });

    // Reload to re-initialize all React contexts from fresh localStorage
    setTimeout(() => window.location.reload(), 1200);
  };

  // ── Format size ────────────────────────────────────────────────────────────
  const estimateSize = () => {
    let total = 0;
    for (const key of ALL_KEYS) {
      total += (localStorage.getItem(key) ?? '').length;
    }
    if (total < 1024) return `${total} B`;
    if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} KB`;
    return `${(total / 1024 / 1024).toFixed(2)} MB`;
  };

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
            {hi ? 'डेटा बैकअप और रीस्टोर' : 'Data Backup & Restore'}
          </h1>
          <p className="text-sm text-gray-500">
            {society.name} · {hi ? 'वित्तीय वर्ष' : 'FY'} {society.financialYear}
            {' · '}{hi ? 'संग्रहण:' : 'Storage:'} {estimateSize()}
          </p>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {hi
            ? 'सभी डेटा (वाउचर, सदस्य, खाते, ऋण, संपत्ति, बिक्री, खरीद) एक JSON फ़ाइल में सहेजा जाता है। रीस्टोर करने पर मौजूदा डेटा बदल जाएगा।'
            : 'All data (vouchers, members, accounts, loans, assets, sales, purchases) is saved in one JSON file. Restoring will overwrite existing data.'}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          [hi ? 'वाउचर' : 'Vouchers',  totalVouchers, 'text-blue-700'],
          [hi ? 'सदस्य' : 'Members',   totalMembers,  'text-green-700'],
          [hi ? 'ऋण' : 'Loans',        totalLoans,    'text-orange-700'],
          [hi ? 'संपत्ति' : 'Assets',   totalAssets,   'text-purple-700'],
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
              ? 'सभी मौजूदा डेटा को JSON फ़ाइल में डाउनलोड करें। इसे सुरक्षित स्थान पर रखें।'
              : 'Download all current data as a JSON file. Keep it in a safe location.'}
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

      {/* Restore card */}
      <Card className="border-orange-200">
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2 text-orange-700">
            <Upload className="h-4 w-4" />
            {hi ? 'बैकअप से रीस्टोर करें' : 'Restore from Backup'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {hi
              ? 'सावधान: रीस्टोर करने पर सभी मौजूदा डेटा बदल जाएगा। पहले बैकअप ज़रूर लें।'
              : 'Warning: Restoring will overwrite all current data. Take a backup first.'}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFilePick}
          />
          <Button
            variant="outline"
            className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {hi ? 'बैकअप फ़ाइल चुनें (.json)' : 'Select Backup File (.json)'}
          </Button>
        </CardContent>
      </Card>

      {/* Data inventory */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-gray-500" />
            {hi ? 'डेटा सूची (वर्तमान)' : 'Data Inventory (Current)'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(KEY_LABELS).map(([key, label]) => {
              const count = currentStats[key] ?? 0;
              return (
                <div key={key} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 text-sm">
                  <span className="text-gray-600">{label[hi ? 'hi' : 'en']}</span>
                  <Badge variant="outline" className="text-xs font-mono">{count}</Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Restore confirm dialog */}
      <AlertDialog open={restoreConfirm} onOpenChange={setRestoreConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-orange-700">
              {hi ? 'डेटा रीस्टोर करें?' : 'Restore Data?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {restorePreview && (
                  <>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-xs">
                      <p><strong>{hi ? 'समिति:' : 'Society:'}</strong> {restorePreview.societyName}</p>
                      <p><strong>{hi ? 'वित्तीय वर्ष:' : 'FY:'}</strong> {restorePreview.financialYear}</p>
                      <p><strong>{hi ? 'बनाया गया:' : 'Created:'}</strong> {new Date(restorePreview.createdAt).toLocaleString('hi-IN')}</p>
                      <p><strong>{hi ? 'संस्करण:' : 'Version:'}</strong> {restorePreview.version}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {Object.entries(restorePreview.stats)
                        .filter(([, v]) => v > 0)
                        .map(([k, v]) => (
                          <div key={k} className="flex justify-between px-2 py-1 bg-blue-50 rounded">
                            <span>{KEY_LABELS[k]?.[hi ? 'hi' : 'en'] ?? k}</span>
                            <span className="font-bold">{v}</span>
                          </div>
                        ))}
                    </div>
                    <p className="text-amber-700 font-medium text-xs">
                      {hi
                        ? '⚠️ यह क्रिया वर्तमान डेटा को पूरी तरह बदल देगी और पृष्ठ रीलोड होगा।'
                        : '⚠️ This will completely replace current data and reload the page.'}
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRestorePreview(null)}>
              {hi ? 'रद्द करें' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {hi ? 'रीस्टोर करें' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BackupRestore;

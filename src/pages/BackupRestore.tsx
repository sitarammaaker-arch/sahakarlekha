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
import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Download, Info, Shield, Cloud, AlertTriangle, History, EyeOff, Archive, Loader2, Lock, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  listExportHistory, describeExport, mayContainPii,
  type ExportHistoryEntry,
} from '@/lib/export/jobs';
import { triggerDownload } from '@/lib/exportUtils';
import { REGISTRY } from '@/lib/export/registry';
import { fetchEntityRows } from '@/lib/export/source';
import { runBackup } from '@/lib/backup/run';
import { planArchive } from '@/lib/backup/writer';

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
  const { user } = useAuth();

  const hi = language === 'hi';

  // ── Export history (T-15) ─────────────────────────────────────────────────
  // Read from audit_log's `export` events — see the deviation note in lib/export/jobs.ts
  // explaining why there is no separate export_jobs table yet. This page is already
  // gated on requiredRoles: ['admin'] in moduleCatalog, which is where the blueprint
  // wants the history surface (§8.2).
  // ── Full archive (T-24b) ──────────────────────────────────────────────────
  // Covers 87 of the 93 collections; the other six are secrets and cross-tenant
  // registries that never leave the database. Deliberately NOT called a backup — see
  // the card's copy. `planArchive` is pure, so the counts below are the real ones.
  const plan = planArchive(REGISTRY);
  const [archiving, setArchiving] = useState(false);
  const [archiveProgress, setArchiveProgress] = useState<{ done: number; total: number } | null>(null);

  // ── Encryption (T-26b) ────────────────────────────────────────────────────
  // NO ESCROW (decision D2). The passphrase never leaves this browser, is never stored,
  // and there is no master key. Lose it and the archive is unrecoverable, by anyone.
  // That is a product decision, so the UI makes the user type its consequence out.
  const [encrypt, setEncrypt] = useState(false);
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const MIN_PASSPHRASE = 12;
  /**
   * Either phrase is accepted. Demanding Devanagari would lock out anyone on an English
   * keyboard — and a confirmation nobody can type is a confirmation nobody reads.
   */
  const CONFIRM_HI = 'कोई recovery नहीं';
  const CONFIRM_EN = 'NO RECOVERY';
  const confirmed =
    confirmText.trim() === CONFIRM_HI ||
    confirmText.trim().toUpperCase() === CONFIRM_EN;

  const passTooShort = pass1.length > 0 && pass1.length < MIN_PASSPHRASE;
  const passMismatch = pass2.length > 0 && pass1 !== pass2;
  const encryptionReady = !encrypt || (
    pass1.length >= MIN_PASSPHRASE && pass1 === pass2 && confirmed
  );

  const [history, setHistory] = useState<ExportHistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    const societyId = user?.societyId;
    if (!societyId) return;
    let cancelled = false;
    listExportHistory(societyId, 50).then(({ entries, error }) => {
      if (cancelled) return;
      setHistory(entries);
      setHistoryError(error);
    });
    return () => { cancelled = true; };
  }, [user?.societyId]);

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

  /** T-24b: build and download the `.slbak` archive. The runner records before delivering. */
  async function handleArchive() {
    const societyId = user?.societyId;
    if (!societyId) return;
    setArchiving(true);
    setArchiveProgress({ done: 0, total: plan.written.length });
    try {
      const outcome = await runBackup({
        entities: REGISTRY,
        societyId,
        fetchRows: fetchEntityRows,
        deliver: (bytes, filename) => triggerDownload(new Blob([bytes as BlobPart], { type: 'application/zip' }), filename),
        appVersion: BACKUP_VERSION,
        schemaVersion: String(TOTAL_COLLECTIONS),
        societyName: society.name,
        registrationNo: society.registrationNo,
        financialYear: society.financialYear,
        createdAt: new Date().toISOString(),
        createdBy: { name: user.name, email: user.email, role: user.role },
        trigger: 'manual',
        auditContext: { societyId, actor: { name: user.name, email: user.email, role: user.role } },
        onProgress: (done, total) => setArchiveProgress({ done, total }),
        // Only when the user asked for it AND typed the consequence out.
        passphrase: encrypt && encryptionReady ? pass1 : undefined,
      });

      switch (outcome.status) {
        case 'created': {
          // Drop the passphrase from React state the moment it is no longer needed.
          // It still lives wherever the browser autofilled it; this is hygiene, not a
          // guarantee.
          setPass1(''); setPass2(''); setConfirmText('');
          const lock = outcome.encrypted
            ? (hi ? ' · एन्क्रिप्टेड' : ' · encrypted')
            : '';
          toast({
            title: hi ? 'पूर्ण आर्काइव डाउनलोड हुआ' : 'Full archive downloaded',
            description: (hi
              ? `${outcome.plan.written.length} सूचियाँ · ${outcome.manifest.totals.rowCount.toLocaleString('en-IN')} पंक्तियाँ · इतिहास में दर्ज`
              : `${outcome.plan.written.length} collections · ${outcome.manifest.totals.rowCount.toLocaleString('en-IN')} rows · recorded in the export history`) + lock,
          });
          break;
        }
        case 'incomplete':
          // No partial archives, ever. Naming the table is the whole value of this message.
          toast({
            title: hi ? 'आर्काइव नहीं बना — अधूरा रह जाता' : 'Archive not created — it would have been incomplete',
            description: hi
              ? `"${outcome.entityKey}" पूरी तरह पढ़ी नहीं जा सकी। अधूरी फ़ाइल देने के बजाय रोका गया।`
              : `"${outcome.entityKey}" could not be read in full. Stopped rather than hand you a partial file.`,
            variant: 'destructive',
            duration: 15000,
          });
          break;
        case 'audit-failed':
          toast({
            title: hi ? 'आर्काइव दर्ज नहीं हो सका' : 'Archive could not be recorded',
            description: hi
              ? 'ऑडिट लॉग में लिखा नहीं जा सका, इसलिए कोई फ़ाइल नहीं बनी। यह सुरक्षा है, ख़राबी नहीं।'
              : 'The audit trail could not be written, so no file was produced. That is the safeguard working.',
            variant: 'destructive',
            duration: 12000,
          });
          break;
        case 'failed':
          toast({ title: hi ? 'आर्काइव नहीं बना' : 'Archive failed', description: outcome.message, variant: 'destructive', duration: 12000 });
          break;
      }
    } finally {
      setArchiving(false);
      setArchiveProgress(null);
    }
  }

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

      {/* Full archive (T-24b) — .slbak, 87 of 93 collections, hashed and verifiable */}
      <Card className="border-blue-200">
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2 text-blue-800">
            <Archive className="h-4 w-4" />
            {hi ? 'पूर्ण डेटा आर्काइव (.slbak)' : 'Full Data Archive (.slbak)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            {hi
              ? `${TOTAL_COLLECTIONS} में से ${plan.written.length} सूचियाँ — हाउसिंग, डेयरी, मार्केटिंग, कंज़्यूमर, श्रमिक, खरीद, जमा, सब। हर टेबल की अलग फ़ाइल, हर फ़ाइल का SHA-256, और एक hashed manifest जिससे छेड़छाड़ पकड़ी जा सके।`
              : `${plan.written.length} of ${TOTAL_COLLECTIONS} collections — housing, dairy, marketing, consumer, labour, procurement, deposits, all of it. One file per table, a SHA-256 for each, and a hashed manifest so tampering is detectable.`}
          </p>

          <p className="text-xs text-gray-500">
            {hi
              ? `${plan.skipped.length} सूचियाँ जानबूझकर छोड़ी गई हैं: पासवर्ड, MFA सीक्रेट, और दूसरी समितियों की रजिस्ट्री। ये डेटाबेस से कभी बाहर नहीं जातीं।`
              : `${plan.skipped.length} collections are deliberately omitted: passwords, MFA secrets, and other societies' registries. Those never leave the database.`}
          </p>

          {/*
            THE HONEST LABEL. The blueprint requires this card not to claim "backup" until
            a restore exists and a rehearsal proves it works (T-32..T-35). Calling an
            unverified archive a backup is precisely the lie that started this whole
            workstream — see the warning above, and T-01.
          */}
          <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              {hi
                ? 'यह अब भी एक्सपोर्ट है, बैकअप नहीं। रिस्टोर अभी बना नहीं है, और जब तक कोई आर्काइव सचमुच रिस्टोर होकर न दिखे, उसे "बैकअप" कहना वही झूठ है जो पहले था।'
                : 'This is still an export, not a backup. Restore does not exist yet, and until an archive has actually been restored and verified, calling it a backup would be the same lie as before.'}
            </span>
          </div>

          {/* ── Encryption (T-26b) ────────────────────────────────────────── */}
          <div className="border-t pt-3 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <Switch checked={encrypt} onCheckedChange={setEncrypt} disabled={archiving} />
              <span className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                {hi ? 'पासवर्ड से सुरक्षित करें' : 'Protect with a passphrase'}
              </span>
            </label>

            {encrypt && (
              <div className="space-y-3 pl-1">
                {/*
                  THE WARNING THE BLUEPRINT REQUIRES, before the first encrypted archive.
                  It is not a footnote. There is no escrow and no master key, and a user who
                  learns that after losing the passphrase has been lied to by omission.
                */}
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-300 rounded-lg text-sm text-red-900">
                  <KeyRound className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold">
                      {hi ? 'पासवर्ड खो गया तो यह आर्काइव हमेशा के लिए बेकार है।' : 'If you lose this passphrase, the archive is useless forever.'}
                    </p>
                    <p>
                      {hi
                        ? 'SahakarLekha के पास कोई master key नहीं है। हम इसे खोल नहीं सकते। कोई recovery नहीं। पासवर्ड आपके ब्राउज़र से बाहर नहीं जाता और कहीं संग्रहीत नहीं होता।'
                        : 'SahakarLekha holds no master key. We cannot open it. There is no recovery. The passphrase never leaves your browser and is stored nowhere.'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-gray-500">{hi ? 'पासवर्ड' : 'Passphrase'}</label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={pass1}
                      onChange={e => setPass1(e.target.value)}
                      disabled={archiving}
                      placeholder={hi ? `कम से कम ${MIN_PASSPHRASE} अक्षर` : `at least ${MIN_PASSPHRASE} characters`}
                    />
                    {passTooShort && (
                      <p className="text-xs text-red-700 mt-1">
                        {hi ? `कम से कम ${MIN_PASSPHRASE} अक्षर चाहिए।` : `At least ${MIN_PASSPHRASE} characters.`}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">{hi ? 'पासवर्ड दोबारा' : 'Passphrase again'}</label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={pass2}
                      onChange={e => setPass2(e.target.value)}
                      disabled={archiving}
                    />
                    {passMismatch && (
                      <p className="text-xs text-red-700 mt-1">
                        {hi ? 'दोनों पासवर्ड अलग हैं।' : 'The two passphrases differ.'}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500">
                    {hi
                      ? <>पुष्टि के लिए टाइप करें: <span className="font-mono font-semibold text-gray-700">{CONFIRM_HI}</span> {' '}<span className="text-gray-400">(या {CONFIRM_EN})</span></>
                      : <>Type to confirm: <span className="font-mono font-semibold text-gray-700">{CONFIRM_EN}</span></>}
                  </label>
                  <Input
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value)}
                    disabled={archiving}
                    className={confirmed ? 'border-green-400' : undefined}
                  />
                </div>

                {/* The escape hatch. An unencrypted copy is one toggle away, always. */}
                <p className="text-xs text-gray-500">
                  {hi
                    ? 'सुरक्षित न रखना चाहें तो ऊपर का स्विच बंद कर दें — बिना एन्क्रिप्शन वाला आर्काइव भी उतना ही पूरा है।'
                    : 'Prefer no passphrase? Turn the switch off — the unencrypted archive is just as complete.'}
                </p>
              </div>
            )}
          </div>

          {archiving && archiveProgress && (
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {hi
                ? `${archiveProgress.done} / ${archiveProgress.total} सूचियाँ पढ़ी गईं…`
                : `read ${archiveProgress.done} / ${archiveProgress.total} collections…`}
            </p>
          )}

          <Button onClick={handleArchive} disabled={archiving || !encryptionReady} className="gap-2 bg-blue-700 hover:bg-blue-800">
            {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : encrypt ? <Lock className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            {archiving
              ? (hi ? 'आर्काइव बन रहा है…' : 'Building archive…')
              : encrypt
                ? (hi ? 'एन्क्रिप्टेड आर्काइव डाउनलोड करें' : 'Download encrypted archive')
                : (hi ? 'पूर्ण आर्काइव डाउनलोड करें' : 'Download full archive')}
          </Button>
        </CardContent>
      </Card>

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

      {/* Export history — the compliance surface (gap EXP-05) */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-gray-500" />
            {hi ? 'एक्सपोर्ट इतिहास' : 'Export History'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-3">
            {hi
              ? 'किसने, कब, कौन-सा डेटा बाहर निकाला — यह रिकॉर्ड बदला नहीं जा सकता।'
              : 'Who took what data, and when. This record cannot be altered.'}
          </p>

          {historyError && (
            <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {/* Never render a read failure as "no exports ever happened". */}
              {hi ? 'इतिहास पढ़ा नहीं जा सका: ' : 'Could not read the history: '}{historyError}
            </div>
          )}

          {!historyError && history === null && (
            <p className="text-sm text-gray-400">{hi ? 'लोड हो रहा है…' : 'Loading…'}</p>
          )}

          {!historyError && history?.length === 0 && (
            <p className="text-sm text-gray-500">
              {hi
                ? 'अभी तक कोई एक्सपोर्ट दर्ज नहीं। नए एक्सपोर्ट यहाँ अपने-आप दिखेंगे।'
                : 'No exports recorded yet. New exports will appear here automatically.'}
            </p>
          )}

          {!historyError && history && history.length > 0 && (
            <div className="space-y-2">
              {history.map(entry => (
                <div key={entry.id} className="flex items-start justify-between gap-3 px-3 py-2 rounded-lg bg-gray-50 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{describeExport(entry, hi)}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {entry.actorName || entry.actorEmail || (hi ? 'अज्ञात उपयोगकर्ता' : 'unknown user')}
                      {entry.actorRole ? ` · ${entry.actorRole}` : ''}
                      {entry.at ? ` · ${new Date(entry.at).toLocaleString(hi ? 'hi-IN' : 'en-IN')}` : ''}
                    </p>
                  </div>
                  {mayContainPii(entry) ? (
                    <Badge variant="outline" className="shrink-0 text-xs text-amber-700 border-amber-300">
                      {hi ? 'निजी डेटा' : 'personal data'}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 text-xs text-green-700 border-green-300 gap-1">
                      <EyeOff className="h-3 w-3" />
                      {hi ? 'रिडैक्टेड' : 'redacted'}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
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

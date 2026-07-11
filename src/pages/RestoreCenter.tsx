/**
 * Restore Center — gates, dry run, rehearsal, and the actual commit (T-32/T-33 / gap EXP-01, EXP-03).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THIS PAGE NOW WRITES — BUT ONLY THROUGH A WALL OF GATES.
 *
 * Up to T-33 this page deliberately could not write; the commit is now wired (EXP-01). The
 * write does NOT happen here, though: the page holds no `.insert(`/`.upsert(`/`.delete(` and
 * never imports the Supabase client. It calls `commitRestoreLive`, which wires the
 * society-scoped writer and the trail recorder into the saga. scripts/test-restore-archive.mjs
 * still asserts this file has no raw write call and no direct Supabase import, AND now asserts
 * the commit is GATED — the T-32 no-write guard moved onto the preconditions, as its own note
 * said it should.
 *
 * A restore is the one operation in this product that can destroy a society's books in a
 * single click, so the commit button is dead until EVERY gate holds:
 *
 *   1. Upload · Identify · Decrypt · Verify · Compatible   (the archive is sound and ours)
 *   2. Dry run              a clean preview for THIS mode — nothing blocked.
 *   3. Rehearsal PASSED     the backup provably reproduces today's books (T-35).
 *   4. Safety backup        a fresh, verified backup of the current society — the ONLY undo
 *                           (Merge/Replace; Fresh targets an empty society and needs none).
 *   5. Typed confirmation   the operator types the society's own name.
 *   6. FY not locked        RULE 6.
 *
 * Inside the saga, two more gates the UI cannot bypass: the dry run is re-run, and the replay
 * assertion must reproduce the archived ledger, or nothing is written.
 * ─────────────────────────────────────────────────────────────────────────────────────
 */
import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ShieldCheck, ShieldAlert, Upload, Loader2, KeyRound, FileWarning,
  Lock, ArrowRight, Building2, Ban, History, HeartPulse, Save, AlertTriangle,
} from 'lucide-react';

import { REGISTRY } from '@/lib/export/registry';
import { fetchEntityRows } from '@/lib/export/source';
import { triggerDownload } from '@/lib/exportUtils';
import { loadArchive, checkCompatibility, type Compatibility } from '@/lib/restore/archive';
import { planRestore } from '@/lib/restore/dag';
import { diffRestore, summarizeDiff, type RestoreDiff, type RestoreMode } from '@/lib/restore/diff';
import { decryptArchive, WrongPassphraseError, NotAnEncryptedArchiveError } from '@/lib/backup/crypto';
import { summarizeVerification, type VerifyReport } from '@/lib/backup/verify';
import { runBackup } from '@/lib/backup/run';
import { runRehearsal, summarizeRun, type RehearsalRunOutcome } from '@/lib/backup/rehearsalRun';
import { commitRestoreLive } from '@/lib/restore/commitLive';
import { summarizeOutcome, type RestoreOutcome } from '@/lib/restore/commit';
import { listRestoreHistory, describeRestoreEntry, wasClean, type RestoreHistoryEntry, type PreRestoreBackup } from '@/lib/restore/trail';
import type { Row } from '@/lib/restore/naturalKeys';

const BACKUP_VERSION = '3.0-supabase';
const TOTAL_COLLECTIONS = 93;

type Stage = 'idle' | 'encrypted' | 'verified' | 'dry-run';

const RestoreCenter: React.FC = () => {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { society } = useData();
  const { user } = useAuth();
  const { toast } = useToast();

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [report, setReport] = useState<VerifyReport | null>(null);
  const [rows, setRows] = useState<Record<string, Row[]>>({});
  const [derivedEntries, setDerivedEntries] = useState<Row[]>([]);
  const [loadProblems, setLoadProblems] = useState<string[]>([]);
  const [compat, setCompat] = useState<Compatibility | null>(null);

  const [passphrase, setPassphrase] = useState('');
  const [passError, setPassError] = useState<string | null>(null);

  const [mode, setMode] = useState<RestoreMode>('merge');
  const [diff, setDiff] = useState<RestoreDiff | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  // The live rows the dry run read — reused by the writer so preview and commit agree.
  const [currentRows, setCurrentRows] = useState<Record<string, Row[]> | null>(null);

  // Rehearsal: does this backup, if restored, reproduce today's books? Read-only.
  const [rehearsal, setRehearsal] = useState<RehearsalRunOutcome | null>(null);

  // Commit (EXP-01). Every one of these is a GATE the button checks before it will fire.
  const [preRestoreBackup, setPreRestoreBackup] = useState<PreRestoreBackup | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [committing, setCommitting] = useState(false);
  const [commitOutcome, setCommitOutcome] = useState<RestoreOutcome | null>(null);

  // T-34: past restore attempts — including the refused ones, which are the ones worth
  // seeing. Read-only; this reads audit_log through a helper and writes nothing.
  const [history, setHistory] = useState<RestoreHistoryEntry[]>([]);
  useEffect(() => {
    if (!user?.societyId) return;
    let alive = true;
    listRestoreHistory(user.societyId).then(({ entries }) => { if (alive) setHistory(entries); });
    return () => { alive = false; };
  }, [user?.societyId]);

  // Restore rewrites the books. The page hides itself from anyone who could not be trusted
  // to run it; T-33's saga will re-check server-side, because a hidden button is a courtesy
  // and an enforced role is a rule.
  if ((user?.role ?? 'viewer') !== 'admin') {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card className="border-red-200">
          <CardContent className="p-6 flex items-start gap-3">
            <Ban className="h-6 w-6 text-red-700 shrink-0" />
            <div>
              <p className="font-semibold text-red-800">
                {hi ? 'केवल व्यवस्थापक' : 'Administrators only'}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {hi
                  ? 'Restore पूरी संस्था की किताबें बदल सकता है। यह पृष्ठ केवल admin के लिए है।'
                  : 'A restore can rewrite the whole society\'s books. This page is for administrators only.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stage: Stage = diff ? 'dry-run'
    : report?.encrypted ? 'encrypted'
    : report?.ok ? 'verified'
    : 'idle';

  function reset() {
    setReport(null); setRows({}); setDerivedEntries([]); setLoadProblems([]); setCompat(null);
    setPassphrase(''); setPassError(null); setDiff(null); setDiffError(null); setCurrentRows(null);
    setRehearsal(null);
    setPreRestoreBackup(null); setConfirmText(''); setCommitOutcome(null);
  }

  /** Gate 1 + 2 + 4 + 5. Verification happens inside loadArchive, before any row is parsed. */
  async function ingest(raw: Uint8Array) {
    const loaded = await loadArchive(raw, REGISTRY);
    setReport(loaded.report);
    setRows(loaded.rows);
    setDerivedEntries(loaded.derivedEntries);
    setLoadProblems(loaded.problems);
    setCompat(
      loaded.report.manifest && user?.societyId
        ? checkCompatibility(loaded.report.manifest, {
            id: user.societyId,
            financialYear: society?.financialYear ?? '',
          })
        : null,
    );
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    reset();
    setFileName(file.name);
    try {
      const raw = new Uint8Array(await file.arrayBuffer());
      setBytes(raw);
      await ingest(raw);
    } finally {
      setBusy(false);
    }
  }

  /** Gate 3. Decryption is local; the passphrase never leaves the browser. */
  async function handleDecrypt() {
    if (!bytes || !passphrase) return;
    setBusy(true);
    setPassError(null);
    try {
      const plain = await decryptArchive(bytes, passphrase);
      setBytes(plain);
      setPassphrase('');
      await ingest(plain);
    } catch (err) {
      // A wrong passphrase, a flipped byte and an edited header are indistinguishable by
      // design. Saying which would be a decryption oracle.
      if (err instanceof WrongPassphraseError) {
        setPassError(hi ? 'पासवर्ड ग़लत है, या फ़ाइल से छेड़छाड़ हुई है।' : 'Wrong passphrase, or the file has been altered.');
      } else if (err instanceof NotAnEncryptedArchiveError) {
        setPassError(hi ? 'यह एन्क्रिप्टेड आर्काइव नहीं है।' : 'This is not an encrypted archive.');
      } else {
        setPassError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  }

  /**
   * The dry run. Reads the database — every restorable table — and diffs it against the
   * archive. Reads only.
   *
   * A truncated read aborts the whole dry run rather than reporting a plan built from a
   * partial picture of the database. Being shown "12 rows will be inserted" when the reader
   * could only see half the table is worse than being shown nothing (blueprint P7).
   */
  async function handleDryRun() {
    if (!user?.societyId || !report?.manifest) return;
    setBusy(true);
    setDiff(null);
    setDiffError(null);
    try {
      const plan = planRestore(REGISTRY);
      const current: Record<string, Row[]> = {};

      for (let i = 0; i < plan.insert.length; i++) {
        const entity = plan.insert[i];
        setProgress({ done: i, total: plan.insert.length, label: hi ? entity.labelHi : entity.label });

        const result = await fetchEntityRows(entity, user.societyId);
        if (result.error) {
          setDiffError(hi
            ? `${entity.labelHi} पढ़ा नहीं जा सका — ${result.error}`
            : `Could not read ${entity.label} — ${result.error}`);
          return;
        }
        if (result.truncated) {
          setDiffError(hi
            ? `${entity.labelHi} में इतनी पंक्तियाँ हैं कि एक बार में पढ़ी नहीं जा सकीं। अधूरी तुलना दिखाना ग़लत होगा।`
            : `${entity.label} holds more rows than could be read in one pass. Showing a partial comparison would be a lie.`);
          return;
        }
        current[entity.key] = result.rows as Row[];
      }

      // Keep the live rows: the writer reuses them so the preview and the commit cannot
      // disagree about what exists (and it avoids a second full read at commit time).
      setCurrentRows(current);
      setDiff(diffRestore(plan.insert, rows, current, mode));
    } catch (err) {
      setDiffError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  /**
   * The rehearsal. Proves this backup, if restored, would reproduce today's books — the
   * client-side realization of T-35, with no shadow society and no server. Read-only: it
   * verifies the archive, replays its ledger, reads the live rows, replays theirs, and
   * compares. The runner aborts on any partial live read.
   */
  async function handleRehearse() {
    if (!user?.societyId || !bytes || !report?.manifest) return;
    setBusy(true);
    setRehearsal(null);
    try {
      const outcome = await runRehearsal({
        bytes,
        societyId: user.societyId,
        entities: REGISTRY,
        loadArchive,
        // Adapt fetchEntityRows (which also returns `fetched`) to the runner's FetchRows.
        fetchRows: async (entity, societyId) => {
          const r = await fetchEntityRows(entity, societyId);
          return { rows: r.rows as Row[], truncated: r.truncated, error: r.error };
        },
        now: new Date().toISOString(),
        backupCreatedAt: report.manifest.createdAt,
      });
      setRehearsal(outcome);
    } finally {
      setBusy(false);
    }
  }

  /**
   * The mandatory pre-restore backup — the ONLY undo a restore has.
   *
   * A browser cannot wrap a restore in a transaction, so "rollback" means one thing:
   * restore the backup taken moments before. This runs a real, full, verified backup of the
   * current society, downloads it to the operator, and records its identity. The saga
   * refuses a Merge or Replace without it.
   */
  async function handleSafetyBackup() {
    if (!user?.societyId || !society) return;
    setBusy(true);
    setProgress({ done: 0, total: 1, label: hi ? 'सुरक्षा बैकअप' : 'safety backup' });
    try {
      const outcome = await runBackup({
        entities: REGISTRY,
        societyId: user.societyId,
        fetchRows: fetchEntityRows,
        deliver: (b, filename) => triggerDownload(new Blob([b as BlobPart], { type: 'application/zip' }), filename),
        appVersion: BACKUP_VERSION,
        schemaVersion: String(TOTAL_COLLECTIONS),
        societyName: society.name,
        registrationNo: society.registrationNo,
        financialYear: society.financialYear,
        createdAt: new Date().toISOString(),
        createdBy: { name: user.name, email: user.email, role: user.role },
        trigger: 'manual',
        auditContext: { societyId: user.societyId, actor: { name: user.name, email: user.email, role: user.role } },
        onProgress: (done, total) => setProgress({ done, total, label: hi ? 'सुरक्षा बैकअप' : 'safety backup' }),
      });
      if (outcome.status === 'created') {
        setPreRestoreBackup({
          filename: outcome.filename,
          bytes: outcome.bytes,
          createdAt: outcome.manifest.createdAt,
          manifestHash: outcome.manifest.manifestHash,
        });
        toast({
          title: hi ? 'सुरक्षा बैकअप बन गया' : 'Safety backup created',
          description: hi
            ? 'यह फ़ाइल संभालकर रखें — restore बिगड़ने पर यही एकमात्र वापसी है।'
            : 'Keep this file — it is the only way back if the restore goes wrong.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: hi ? 'सुरक्षा बैकअप नहीं बना' : 'Safety backup failed',
          description: 'message' in outcome ? outcome.message : (hi ? 'बैकअप विफल' : 'backup failed'),
        });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: hi ? 'सुरक्षा बैकअप त्रुटि' : 'Safety backup error', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  /**
   * THE COMMIT. The one action on this page that writes.
   *
   * It reaches commitRestoreLive, which wires the society-scoped writer and the trail
   * recorder into the saga. Every safety gate — FY-lock, the re-run dry run, the mandatory
   * backup, the replay assertion — is enforced inside the saga; this only fires once the
   * UI-side gates (rehearsal passed, backup taken, confirmation typed) are also satisfied.
   */
  async function handleCommit() {
    if (!user?.societyId || !report?.manifest || !currentRows || !canCommit) return;
    setCommitting(true);
    setCommitOutcome(null);
    try {
      const outcome = await commitRestoreLive({
        mode,
        fyLocked: !!society?.fyLocked,
        archiveRows: rows,
        currentRows,
        archivedEntries: derivedEntries,
        societyId: user.societyId,
        sourceManifestHash: report.manifest.manifestHash,
        preRestoreBackup: preRestoreBackup ?? undefined,
        auditContext: { societyId: user.societyId, actor: { name: user.name, email: user.email, role: user.role } },
        onProgress: (done, total, entityKey) => setProgress({ done, total, label: entityKey }),
      });
      setCommitOutcome(outcome);
      setConfirmText('');
      toast({
        variant: outcome.status === 'committed' ? 'default' : 'destructive',
        title: outcome.status === 'committed' ? (hi ? 'Restore पूरा' : 'Restore complete') : (hi ? 'Restore नहीं हुआ' : 'Restore did not complete'),
        description: summarizeOutcome(outcome, hi),
        duration: 12000,
      });
      // Refresh the trail — the attempt was just recorded.
      listRestoreHistory(user.societyId).then(({ entries }) => setHistory(entries));
    } finally {
      setProgress(null);
      setCommitting(false);
    }
  }

  const canDryRun = stage === 'verified' && !!compat?.safe && loadProblems.length === 0;
  const changed = diff?.entities.filter(e => e.insert || e.update || e.conflicts.length || e.orphan) ?? [];
  const healthColor = (s: string) => (s === 'green' ? 'border-green-300 text-green-800' : s === 'red' ? 'border-red-300 text-red-800' : 'border-amber-300 text-amber-900');

  // ── THE COMMIT GATES. The button is dead unless EVERY one of these holds. ──────
  const confirmPhrase = society?.name ?? '';
  const rehearsalPassed = rehearsal?.status === 'passed';
  const dryRunOkForMode = !!diff && diff.ok && diff.mode === mode;
  const backupReady = mode === 'fresh' ? true : !!preRestoreBackup;   // Fresh has nothing to undo
  const confirmOk = confirmText.trim() === confirmPhrase && confirmPhrase.length > 0;
  const canCommit =
    !!compat?.safe && loadProblems.length === 0 && !society?.fyLocked &&
    dryRunOkForMode && rehearsalPassed && backupReady && confirmOk;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-100 rounded-lg">
          <ShieldCheck className="h-6 w-6 text-slate-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{hi ? 'रिस्टोर सेंटर' : 'Restore Center'}</h1>
          <p className="text-sm text-gray-500">
            {hi
              ? 'एक .slbak आर्काइव जाँचें और देखें कि restore क्या-क्या बदलेगा।'
              : 'Check a .slbak archive and see exactly what a restore would change.'}
          </p>
        </div>
      </div>

      {/* The framing of the page: everything is read-only until the very last, gated step. */}
      <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-900 flex items-start gap-2">
        <Lock className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {hi
            ? 'ऊपर सब पढ़ने-भर का है — जाँच, dry-run और rehearsal कुछ नहीं लिखते। असल restore सबसे नीचे है, और तभी चलता है जब हर गेट पूरा हो और उससे पहले एक सुरक्षा-बैकअप बन चुका हो।'
            : 'Everything above is read-only — verify, dry run and rehearsal write nothing. The actual restore is at the very bottom, and runs only once every gate is met and a mandatory safety backup has been taken first.'}
        </span>
      </div>

      {society?.fyLocked && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
          {hi
            ? 'वित्तीय वर्ष ऑडिट-लॉक है। जाँच और dry run चल सकते हैं; restore तब भी नहीं चलेगा (RULE 6)।'
            : 'The financial year is audit-locked. Verification and dry runs still work; a restore will not (RULE 6).'}
        </div>
      )}

      {/* ── Gate 1 ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept=".slbak,.zip" className="hidden" onChange={handleFile} />
          <Button onClick={() => fileRef.current?.click()} disabled={busy} className="gap-2">
            {busy && !progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {hi ? '.slbak फ़ाइल चुनें' : 'Choose a .slbak file'}
          </Button>
          {fileName && <p className="text-xs text-gray-500">{fileName}</p>}
          <p className="text-xs text-gray-500">
            {hi
              ? 'फ़ाइल आपके ब्राउज़र से बाहर नहीं जाती।'
              : 'The file never leaves your browser.'}
          </p>
        </CardContent>
      </Card>

      {/* ── Gates 2 + 4: identify and verify ───────────────────────────────── */}
      {report && (
        <Card className={report.ok ? 'border-green-300' : report.encrypted ? 'border-amber-300' : 'border-red-300'}>
          <CardContent className="p-4 flex items-start gap-3">
            {report.ok
              ? <ShieldCheck className="h-6 w-6 text-green-700 shrink-0" />
              : <ShieldAlert className="h-6 w-6 text-amber-700 shrink-0" />}
            <div className="min-w-0">
              <p className={`font-semibold ${report.ok ? 'text-green-800' : 'text-amber-900'}`}>
                {summarizeVerification(report, hi)}
              </p>
              {(report.manifest || report.encryptedHeader) && (
                <p className="text-xs text-gray-500 mt-1">
                  {(report.manifest ?? report.encryptedHeader).societyName}
                  {' · '}{hi ? 'वित्तीय वर्ष' : 'FY'} {(report.manifest ?? report.encryptedHeader).financialYear}
                  {' · '}{new Date((report.manifest ?? report.encryptedHeader).createdAt).toLocaleString(hi ? 'hi-IN' : 'en-IN')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Gate 3: decrypt ────────────────────────────────────────────────── */}
      {stage === 'encrypted' && (
        <Card className="border-amber-300">
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-900">
              <KeyRound className="h-4 w-4" />{hi ? 'पासवर्ड चाहिए' : 'Passphrase required'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="password"
                autoComplete="off"
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleDecrypt(); }}
                placeholder={hi ? 'आर्काइव का पासवर्ड' : 'archive passphrase'}
                disabled={busy}
              />
              <Button onClick={handleDecrypt} disabled={busy || !passphrase} className="gap-2 shrink-0">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {hi ? 'खोलें' : 'Unlock'}
              </Button>
            </div>
            {passError && <p className="text-sm text-red-700">{passError}</p>}
            <p className="text-xs text-gray-500">
              {hi
                ? 'पासवर्ड इस पृष्ठ से बाहर नहीं जाता। खोलने में कुछ सेकंड लगते हैं — यही देरी पासवर्ड को अनुमान से बचाती है।'
                : 'The passphrase never leaves this page. Unlocking takes a few seconds — that delay is what protects it from guessing.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Verification and load problems, every one of them. */}
      {(report && !report.ok && !report.encrypted) || loadProblems.length > 0 ? (
        <Card className="border-red-200">
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-800">
              <FileWarning className="h-4 w-4" />
              {hi ? 'यह आर्काइव इस्तेमाल नहीं हो सकता' : 'This archive cannot be used'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-red-800 list-disc pl-5">
              {[...(report?.problems ?? []), ...loadProblems].map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Gate 5: compatibility ──────────────────────────────────────────── */}
      {compat && report?.ok && (
        <Card className={compat.safe ? '' : 'border-red-300'}>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />{hi ? 'क्या यह आर्काइव इसी संस्था का है?' : 'Does this archive belong here?'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {compat.status === 'different-society' && (
              <p className="text-red-800 font-medium">
                {hi
                  ? `यह आर्काइव "${compat.archiveSociety}" का है, इस संस्था का नहीं। इसे यहाँ restore करना किताबों में दूसरी संस्था का डेटा घोल देगा — ऑडिट तक किसी को पता नहीं चलेगा।`
                  : `This archive belongs to "${compat.archiveSociety}", not to this society. Restoring it here would mix another society's data into these books — and nobody would notice until an audit.`}
              </p>
            )}
            {compat.status === 'different-fy' && (
              <p className="text-amber-900">
                {hi
                  ? `यह ${compat.archiveFy} का आर्काइव है, और अभी ${society?.financialYear} चल रहा है। यह ग़लत नहीं है — पर मोड सोच-समझकर चुनें।`
                  : `This archive is from ${compat.archiveFy}, and the current year is ${society?.financialYear}. That is not wrong — but choose the mode deliberately.`}
              </p>
            )}
            {compat.status === 'same-society' && (
              <p className="text-green-800">
                {hi ? 'हाँ — वही संस्था, वही वित्तीय वर्ष।' : 'Yes — same society, same financial year.'}
              </p>
            )}

            {report.unplaceable.length > 0 && (
              <p className="text-red-800">
                {hi
                  ? `इस आर्काइव में ${report.unplaceable.length} ऐसी सूचियाँ हैं जिन्हें यह संस्करण नहीं पहचानता: ${report.unplaceable.join(', ')}`
                  : `This archive holds ${report.unplaceable.length} collection(s) this build cannot place: ${report.unplaceable.join(', ')}`}
              </p>
            )}
            {report.fingerprintMatches === false && report.unplaceable.length === 0 && (
              <p className="text-xs text-gray-500">
                {hi
                  ? 'यह आर्काइव किसी दूसरे संस्करण ने लिखा था, पर हर सूची पहचानी जा सकती है — यह ठीक है।'
                  : 'This archive was written by a different build, but every collection is recognised — that is fine.'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── The dry run ────────────────────────────────────────────────────── */}
      {report?.ok && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">{hi ? 'सूखा पूर्वाभ्यास (dry run)' : 'Dry run'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={mode} onValueChange={v => { setMode(v as RestoreMode); setDiff(null); setCommitOutcome(null); setConfirmText(''); }} disabled={busy || committing}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fresh">{hi ? 'Fresh — खाली संस्था में' : 'Fresh — into an empty society'}</SelectItem>
                  <SelectItem value="merge">{hi ? 'Merge — मौजूदा डेटा रखें' : 'Merge — keep what is there'}</SelectItem>
                  <SelectItem value="replace">{hi ? 'Replace — आर्काइव सर्वोपरि' : 'Replace — the archive wins'}</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleDryRun} disabled={busy || !canDryRun} className="gap-2">
                {busy && progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {hi ? 'दिखाएँ कि क्या बदलेगा' : 'Show what would change'}
              </Button>
            </div>

            {!canDryRun && compat && !compat.safe && (
              <p className="text-sm text-red-800">
                {hi ? 'दूसरी संस्था के आर्काइव पर dry run नहीं चलेगा।' : 'A dry run will not run against another society\'s archive.'}
              </p>
            )}

            {progress && (
              <p className="text-xs text-gray-500">
                {hi ? 'डेटाबेस पढ़ा जा रहा है' : 'Reading the database'} — {progress.done}/{progress.total} · {progress.label}
              </p>
            )}

            {diffError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">{diffError}</div>
            )}

            {diff && (
              <div className="space-y-3">
                <p className={`font-semibold ${diff.ok ? 'text-gray-900' : 'text-red-800'}`}>
                  {summarizeDiff(diff, hi)}
                </p>

                {diff.problems.length > 0 && (
                  <ul className="space-y-1 text-sm text-red-800 list-disc pl-5">
                    {diff.problems.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                )}

                {mode === 'replace' && diff.totals.orphan > 0 && (
                  <div className="p-3 bg-red-50 border border-red-300 rounded text-sm text-red-900">
                    {hi
                      ? `Replace मोड इस समय डेटाबेस में मौजूद ${diff.totals.orphan} पंक्तियाँ मिटा देगा, क्योंकि वे इस आर्काइव में नहीं हैं।`
                      : `Replace mode would DELETE ${diff.totals.orphan} row(s) that exist in the database today, because this archive does not contain them.`}
                  </div>
                )}

                {changed.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    {hi ? 'कुछ नहीं बदलेगा।' : 'Nothing would change.'}
                  </p>
                ) : (
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {changed.map(e => (
                      <div key={e.key} className="flex items-center justify-between gap-2 px-2 py-1 rounded text-sm bg-gray-50">
                        <span className="truncate">{e.key}</span>
                        <span className="flex gap-1 shrink-0">
                          {e.insert > 0 && <Badge variant="outline" className="text-[10px] text-green-700 border-green-300">+{e.insert}</Badge>}
                          {e.update > 0 && <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-300">~{e.update}</Badge>}
                          {e.conflicts.length > 0 && <Badge variant="outline" className="text-[10px] text-amber-800 border-amber-300">⚠ {e.conflicts.length}</Badge>}
                          {e.orphan > 0 && <Badge variant="outline" className="text-[10px] text-red-700 border-red-300">−{e.orphan}</Badge>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  {hi
                    ? 'यह सिर्फ़ पूर्वावलोकन है — यहाँ कुछ नहीं लिखा जाता। असल restore नीचे है, और उससे पहले एक सुरक्षा बैकअप अनिवार्य है।'
                    : 'This is a preview only — nothing is written here. The actual restore is below, and a safety backup is mandatory before it runs.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── T-35 (client-side): rehearsal — does this backup reproduce today's books? ── */}
      {report?.ok && (
        <Card className={rehearsal ? healthColor(rehearsal.status === 'passed' ? 'green' : rehearsal.status === 'failed' ? 'red' : 'amber') : ''}>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <HeartPulse className="h-4 w-4" />
              {hi ? 'बैकअप पूर्वाभ्यास (rehearsal)' : 'Backup rehearsal'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">
              {hi
                ? 'बिना कुछ लिखे परखता है कि यह बैकअप restore करने पर मौजूदा किताबें (trial balance + stock) हूबहू लौटेंगी या नहीं। यही वह जाँच है जो "बैकअप है" को "बैकअप काम करता है" बनाती है।'
                : 'Checks — writing nothing — whether restoring this backup would reproduce the current books (trial balance + stock) exactly. This is the check that turns "we have a backup" into "the backup works".'}
            </p>
            <Button onClick={handleRehearse} disabled={busy || !canDryRun} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartPulse className="h-4 w-4" />}
              {hi ? 'बैकअप को परखें' : 'Rehearse this backup'}
            </Button>

            {rehearsal && (
              <div className="space-y-2">
                <p className={`font-semibold ${rehearsal.status === 'passed' ? 'text-green-800' : rehearsal.status === 'failed' ? 'text-red-800' : 'text-amber-900'}`}>
                  {summarizeRun(rehearsal, hi)}
                </p>

                {(rehearsal.status === 'passed' || rehearsal.status === 'failed') && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${healthColor(rehearsal.health.status)}`}>
                      {hi ? 'बैकअप स्थिति' : 'backup health'}: {rehearsal.health.status}
                    </Badge>
                    {!rehearsal.live.balanced && (
                      <span className="text-xs text-red-700">
                        {hi ? 'चेतावनी: मौजूदा किताबें ही संतुलित नहीं (Dr ≠ Cr)।' : 'Warning: the live books do not balance (Dr ≠ Cr).'}
                      </span>
                    )}
                  </div>
                )}

                {rehearsal.status === 'failed' && (
                  <div className="text-sm text-red-800 space-y-1">
                    {rehearsal.verdict.accounts.length > 0 && (
                      <p>{hi ? 'मेल न खाने वाले खाते' : 'Accounts that differ'}: {rehearsal.verdict.accounts.slice(0, 8).join(', ')}{rehearsal.verdict.accounts.length > 8 ? ` +${rehearsal.verdict.accounts.length - 8}` : ''}</p>
                    )}
                    {rehearsal.verdict.items.length > 0 && (
                      <p>{hi ? 'मेल न खाने वाली मद' : 'Items that differ'}: {rehearsal.verdict.items.slice(0, 8).join(', ')}{rehearsal.verdict.items.length > 8 ? ` +${rehearsal.verdict.items.length - 8}` : ''}</p>
                    )}
                  </div>
                )}

                {rehearsal.status === 'archive-invalid' && (
                  <ul className="text-sm text-red-800 list-disc pl-5">
                    {rehearsal.problems.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── THE COMMIT (EXP-01). The one action on this page that writes. ──── */}
      {report?.ok && compat?.safe && (
        <Card className="border-red-300">
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              {hi ? 'असल restore — किताबें बदल देगा' : 'Actual restore — this rewrites the books'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-900">
              {hi
                ? 'यह वास्तव में डेटाबेस में लिखता है और इसे पलटा नहीं जा सकता — सिवाय नीचे बनने वाले सुरक्षा बैकअप से। पहली बार किसी असली संस्था पर चलाने से पहले एक ग़ैर-ज़रूरी/परीक्षण संस्था पर आज़माएँ।'
                : 'This actually writes to the database and cannot be undone — except by restoring the safety backup below. Before running it on a real society for the first time, try it on a throwaway/test society.'}
            </div>

            {society?.fyLocked && (
              <p className="text-sm text-blue-900">{hi ? 'वित्तीय वर्ष लॉक है — restore नहीं चलेगा (RULE 6)।' : 'The financial year is locked — a restore will not run (RULE 6).'}</p>
            )}

            {/* Step 1 — the mandatory safety backup (the only undo). Fresh needs none. */}
            {mode !== 'fresh' && (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={handleSafetyBackup} disabled={busy || committing} className="gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {hi ? '1. सुरक्षा बैकअप बनाएँ' : '1. Create safety backup'}
                </Button>
                {preRestoreBackup
                  ? <span className="text-xs text-green-700">✓ {preRestoreBackup.filename}</span>
                  : <span className="text-xs text-gray-500">{hi ? 'restore से पहले अनिवार्य' : 'required before restore'}</span>}
              </div>
            )}

            {/* Step 2 — type the society name to confirm. */}
            <div className="space-y-1">
              <p className="text-xs text-gray-600">
                {hi ? `पुष्टि के लिए संस्था का नाम टाइप करें: ` : `Type the society name to confirm: `}
                <span className="font-semibold">{confirmPhrase}</span>
              </p>
              <Input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={confirmPhrase}
                disabled={committing}
                className="max-w-sm"
              />
            </div>

            {/* Step 3 — the commit. Dead unless every gate holds; the list says what is missing. */}
            <Button onClick={handleCommit} disabled={!canCommit || committing} variant="destructive" className="gap-2">
              {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
              {hi ? `${mode.toUpperCase()} restore चलाएँ` : `Run ${mode.toUpperCase()} restore`}
            </Button>

            {!canCommit && !commitOutcome && (
              <ul className="text-xs text-gray-500 list-disc pl-5">
                {!dryRunOkForMode && <li>{hi ? 'पहले इसी mode पर dry run चलाएँ और वह साफ़ हो' : 'run a clean dry run for this mode first'}</li>}
                {!rehearsalPassed && <li>{hi ? 'rehearsal पास होना चाहिए' : 'the rehearsal must pass'}</li>}
                {!backupReady && <li>{hi ? 'सुरक्षा बैकअप बनाएँ' : 'create the safety backup'}</li>}
                {!confirmOk && <li>{hi ? 'संस्था का नाम सही टाइप करें' : 'type the society name exactly'}</li>}
                {!!society?.fyLocked && <li>{hi ? 'वित्तीय वर्ष लॉक है' : 'the financial year is locked'}</li>}
              </ul>
            )}

            {progress && committing && (
              <p className="text-xs text-gray-500">{hi ? 'लिखा जा रहा है' : 'Writing'} — {progress.done}/{progress.total} · {progress.label}</p>
            )}

            {commitOutcome && (
              <div className={`p-3 rounded text-sm ${commitOutcome.status === 'committed' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                <p className="font-semibold">{summarizeOutcome(commitOutcome, hi)}</p>
                {commitOutcome.status === 'partial' && (
                  <p className="mt-1">{hi
                    ? `"${commitOutcome.entityKey}" पर रुका। सुरक्षा बैकअप (${preRestoreBackup?.filename ?? ''}) से वापस लाएँ।`
                    : `Stopped at "${commitOutcome.entityKey}". Roll back with the safety backup (${preRestoreBackup?.filename ?? ''}).`}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── T-34: past restore attempts, refused ones included ─────────────── */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              {hi ? 'पिछले restore प्रयास' : 'Past restore attempts'} ({history.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {history.map(h => (
                <div key={h.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded text-sm bg-gray-50">
                  <span className="truncate">
                    {describeRestoreEntry(h, hi)}
                    <span className="text-xs text-gray-400"> · {new Date(h.at).toLocaleDateString(hi ? 'hi-IN' : 'en-IN')}</span>
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${wasClean(h.outcome)
                      ? 'text-green-700 border-green-300'
                      : 'text-red-700 border-red-300'}`}
                  >
                    {h.outcome}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RestoreCenter;

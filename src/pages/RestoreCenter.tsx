/**
 * Restore Center — gates 1 to 5 (T-32 / gap EXP-03).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THIS PAGE CANNOT WRITE. THAT IS THE FEATURE, NOT AN OVERSIGHT.
 *
 * There is no commit path here — no insert, no update, no delete, no upsert. It reads the
 * archive, reads the database, and shows an operator exactly what a restore WOULD do. The
 * commit saga arrives in T-33, behind this dry run.
 *
 * Shipping the gates before the writes is deliberate. A restore is the one operation in
 * this product that can destroy a society's books in a single click, and the only honest
 * way to earn that click is to make the operator read the consequences first.
 *
 * That claim is enforced, not merely stated: scripts/test-restore-archive.mjs asserts this
 * file contains no `.insert(`, `.update(`, `.delete(`, `.upsert(` or `.rpc(`. When T-33
 * lands its commit saga, that assertion must MOVE to guard the saga's preconditions —
 * a mandatory pre-restore backup and a replay assertion — not be deleted.
 *
 * THE FIVE GATES, EACH ABLE TO STOP THE REST
 *
 *   1. Upload      bytes, from the operator's disk. Nothing is sent anywhere.
 *   2. Identify    what society, what year, who made it — readable even when encrypted.
 *   3. Decrypt     in the browser. The passphrase never leaves this page.
 *   4. Verify      every digest, and that the archive contains ONLY what its manifest lists.
 *   5. Compatible  is this OUR archive? Can this build place every collection in it?
 *
 *   → then, mandatorily, the dry run. It cannot be skipped, because there is nothing to
 *     skip it to.
 * ─────────────────────────────────────────────────────────────────────────────────────
 */
import React, { useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ShieldCheck, ShieldAlert, Upload, Loader2, KeyRound, FileWarning,
  Lock, ArrowRight, Building2, Ban,
} from 'lucide-react';

import { REGISTRY } from '@/lib/export/registry';
import { fetchEntityRows } from '@/lib/export/source';
import { loadArchive, checkCompatibility, type Compatibility } from '@/lib/restore/archive';
import { planRestore } from '@/lib/restore/dag';
import { diffRestore, summarizeDiff, type RestoreDiff, type RestoreMode } from '@/lib/restore/diff';
import { decryptArchive, WrongPassphraseError, NotAnEncryptedArchiveError } from '@/lib/backup/crypto';
import { summarizeVerification, type VerifyReport } from '@/lib/backup/verify';
import type { Row } from '@/lib/restore/naturalKeys';

type Stage = 'idle' | 'encrypted' | 'verified' | 'dry-run';

const RestoreCenter: React.FC = () => {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { society } = useData();
  const { user } = useAuth();

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [report, setReport] = useState<VerifyReport | null>(null);
  const [rows, setRows] = useState<Record<string, Row[]>>({});
  const [loadProblems, setLoadProblems] = useState<string[]>([]);
  const [compat, setCompat] = useState<Compatibility | null>(null);

  const [passphrase, setPassphrase] = useState('');
  const [passError, setPassError] = useState<string | null>(null);

  const [mode, setMode] = useState<RestoreMode>('merge');
  const [diff, setDiff] = useState<RestoreDiff | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);

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
    setReport(null); setRows({}); setLoadProblems([]); setCompat(null);
    setPassphrase(''); setPassError(null); setDiff(null); setDiffError(null);
  }

  /** Gate 1 + 2 + 4 + 5. Verification happens inside loadArchive, before any row is parsed. */
  async function ingest(raw: Uint8Array) {
    const loaded = await loadArchive(raw, REGISTRY);
    setReport(loaded.report);
    setRows(loaded.rows);
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

      setDiff(diffRestore(plan.insert, rows, current, mode));
    } catch (err) {
      setDiffError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  const canDryRun = stage === 'verified' && !!compat?.safe && loadProblems.length === 0;
  const changed = diff?.entities.filter(e => e.insert || e.update || e.conflicts.length || e.orphan) ?? [];

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

      {/* The most important sentence on the page. */}
      <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-900 flex items-start gap-2">
        <Lock className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {hi
            ? 'यह पृष्ठ कुछ भी नहीं लिखता। यह केवल दिखाता है कि restore क्या करेगा। असल restore अभी उपलब्ध नहीं है।'
            : 'This page writes nothing. It only shows what a restore would do. The restore itself is not available yet.'}
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
              <Select value={mode} onValueChange={v => { setMode(v as RestoreMode); setDiff(null); }} disabled={busy}>
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
                    ? 'यहीं तक। लिखने वाला हिस्सा (T-33) अभी बना नहीं है — और जब बनेगा, तब भी उससे पहले एक बैकअप अनिवार्य होगा।'
                    : 'This is as far as it goes. The part that writes (T-33) does not exist yet — and when it does, a pre-restore backup will be mandatory before it runs.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RestoreCenter;

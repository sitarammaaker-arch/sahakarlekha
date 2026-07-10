/**
 * Archive verifier (T-25) — a PUBLIC page.
 *
 * An auditor, a registrar, or a member who has been handed a `.slbak` file must be able
 * to check it. Not "ask the society to check it". Not "log in first". Open the page, drop
 * the file, read the answer.
 *
 * That is why this route is deliberately NOT behind ProtectedRoute, and why nothing here
 * touches Supabase, the society, or the user. `verifyArchive` takes bytes and returns a
 * report. The file never leaves the browser.
 *
 * It answers four questions, and the fourth is the one a naive verifier forgets: does the
 * archive contain ONLY what its manifest lists? A smuggled extra file passes every hash
 * check, because no hash was ever recorded for it.
 */
import React, { useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldAlert, Upload, Loader2, FileWarning, KeyRound } from 'lucide-react';

import { verifyArchive, summarizeVerification, type VerifyReport } from '@/lib/backup/verify';
import { decryptArchive, WrongPassphraseError, NotAnEncryptedArchiveError } from '@/lib/backup/crypto';
import { REGISTRY } from '@/lib/export/registry';

const VerifyBackup: React.FC = () => {
  const { language } = useLanguage();
  const hi = language === 'hi';

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [report, setReport] = useState<VerifyReport | null>(null);

  // T-26b: an encrypted archive cannot be verified without its passphrase. We hold the
  // bytes so the user can try again without re-picking the file.
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [passError, setPassError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusy(true);
    setReport(null);
    setPassphrase('');
    setPassError(null);
    setFileName(file.name);
    try {
      const raw = new Uint8Array(await file.arrayBuffer());
      setBytes(raw);
      // The registry is passed so the report can name entities THIS build cannot place.
      // An encrypted archive comes back with `encrypted: true` and a readable header.
      setReport(await verifyArchive(raw, { entities: REGISTRY }));
    } finally {
      setBusy(false);
    }
  }

  /** Decrypt in the browser, then verify the plaintext archive exactly as usual. */
  async function handleDecrypt() {
    if (!bytes || !passphrase) return;
    setBusy(true);
    setPassError(null);
    try {
      const plain = await decryptArchive(bytes, passphrase);
      setReport(await verifyArchive(plain, { entities: REGISTRY }));
      setPassphrase('');
    } catch (err) {
      // A wrong passphrase, a flipped byte and an edited header are indistinguishable by
      // design — saying which would be a decryption oracle. A malformed container is not.
      if (err instanceof WrongPassphraseError) {
        setPassError(hi
          ? 'पासवर्ड ग़लत है, या फ़ाइल से छेड़छाड़ हुई है।'
          : 'Wrong passphrase, or the file has been altered.');
      } else if (err instanceof NotAnEncryptedArchiveError) {
        setPassError(hi ? 'यह एन्क्रिप्टेड आर्काइव नहीं है।' : 'This is not an encrypted archive.');
      } else {
        setPassError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  }

  const failed = report?.entities.filter(en => en.status !== 'ok') ?? [];

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-100 rounded-lg">
          <ShieldCheck className="h-6 w-6 text-slate-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {hi ? 'आर्काइव सत्यापन' : 'Verify an Archive'}
          </h1>
          <p className="text-sm text-gray-500">
            {hi
              ? 'किसी .slbak फ़ाइल की जाँच करें — बिना खाते के, बिना कुछ अपलोड किए।'
              : 'Check a .slbak file — no account needed, and nothing is uploaded.'}
          </p>
        </div>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        {hi
          ? 'फ़ाइल आपके ब्राउज़र से बाहर नहीं जाती। सत्यापन यहीं, आपकी मशीन पर होता है।'
          : 'The file never leaves your browser. Verification runs here, on your machine.'}
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept=".slbak,.zip" className="hidden" onChange={handleFile} />
          <Button onClick={() => fileRef.current?.click()} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy
              ? (hi ? 'जाँच हो रही है…' : 'Verifying…')
              : (hi ? '.slbak फ़ाइल चुनें' : 'Choose a .slbak file')}
          </Button>
          {fileName && <p className="text-xs text-gray-500">{fileName}</p>}
        </CardContent>
      </Card>

      {report && (
        <>
          {/* The verdict, in one line, before any detail. */}
          <Card className={report.ok ? 'border-green-300' : 'border-red-300'}>
            <CardContent className="p-4 flex items-start gap-3">
              {report.ok
                ? <ShieldCheck className="h-6 w-6 text-green-700 shrink-0" />
                : <ShieldAlert className="h-6 w-6 text-red-700 shrink-0" />}
              <div>
                <p className={`font-semibold ${report.ok ? 'text-green-800' : 'text-red-800'}`}>
                  {summarizeVerification(report, hi)}
                </p>
                {report.manifest && (
                  <p className="text-xs text-gray-500 mt-1">
                    {report.manifest.societyName} · {hi ? 'वित्तीय वर्ष' : 'FY'} {report.manifest.financialYear}
                    {' · '}{new Date(report.manifest.createdAt).toLocaleString(hi ? 'hi-IN' : 'en-IN')}
                    {report.manifest.createdBy?.name ? ` · ${report.manifest.createdBy.name}` : ''}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Encrypted: ask for the passphrase. Nothing is uploaded; decryption is local. */}
          {report.encrypted && (
            <Card className="border-amber-300">
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2 text-amber-900">
                  <KeyRound className="h-4 w-4" />
                  {hi ? 'पासवर्ड चाहिए' : 'Passphrase required'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.encryptedHeader && (
                  <p className="text-xs text-gray-500">
                    {/* The header identifies the archive without proving anything about it. */}
                    {report.encryptedHeader.societyName}
                    {' · '}{hi ? 'वित्तीय वर्ष' : 'FY'} {report.encryptedHeader.financialYear}
                    {' · '}{report.encryptedHeader.encryption.algo}
                    {' · '}{report.encryptedHeader.encryption.iterations.toLocaleString('en-IN')} {hi ? 'चक्र' : 'iterations'}
                  </p>
                )}
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
                    ? 'पासवर्ड इस पेज से बाहर नहीं जाता। खोलने में कुछ सेकंड लग सकते हैं — यही देरी पासवर्ड को अनुमान से बचाती है।'
                    : 'The passphrase never leaves this page. Unlocking takes a few seconds — that delay is what protects it from guessing.'}
                </p>
              </CardContent>
            </Card>
          )}

          {report.problems.length > 0 && !report.encrypted && (
            <Card className="border-red-200">
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2 text-red-800">
                  <FileWarning className="h-4 w-4" />
                  {hi ? `${report.problems.length} समस्याएँ` : `${report.problems.length} problem(s)`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Every problem, not just the first — an operator should not go round the loop. */}
                <ul className="space-y-1 text-sm text-red-800 list-disc pl-5">
                  {report.problems.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}

          {report.manifest && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">
                  {hi ? 'सूचियाँ' : 'Collections'} ({report.entities.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {failed.length > 0 && (
                  <p className="text-sm text-red-700 mb-2">
                    {hi ? `${failed.length} सूचियाँ सत्यापित नहीं हुईं।` : `${failed.length} collection(s) failed.`}
                  </p>
                )}
                <div className="grid gap-1 sm:grid-cols-2 max-h-96 overflow-y-auto">
                  {report.entities.map(en => (
                    <div key={en.key} className="flex items-center justify-between gap-2 px-2 py-1 rounded text-sm bg-gray-50">
                      <span className="truncate">
                        {en.key}
                        <span className="text-xs text-gray-400"> · {en.rowCount.toLocaleString('en-IN')}</span>
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${en.status === 'ok'
                          ? 'text-green-700 border-green-300'
                          : 'text-red-700 border-red-300'}`}
                      >
                        {en.status}
                      </Badge>
                    </div>
                  ))}
                </div>

                {report.fingerprintMatches === false && report.unplaceable.length === 0 && (
                  <p className="text-xs text-gray-500 mt-3">
                    {hi
                      ? 'इस आर्काइव को किसी दूसरे संस्करण ने लिखा था, पर हर सूची पहचानी जा सकती है — यह ठीक है।'
                      : 'This archive was written by a different build, but every collection is recognised — that is fine.'}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default VerifyBackup;

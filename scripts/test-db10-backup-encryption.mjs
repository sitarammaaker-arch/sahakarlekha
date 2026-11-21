// DB-10 (product audit 2026-11-17) — scheduled backups are sealed with the platform backup key before either copy
// (Supabase Storage, off-vendor S3/R2) is written, and the weekly rehearsal opens them with the current or previous key.
// Runs the COMMITTED edge bundles (what the Edge Functions import) end to end.
// Run: node scripts/test-db10-backup-encryption.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const B = await import(pathToFileURL(resolve(ROOT, 'supabase/functions/_shared/backup-core.mjs')).href);
const R = await import(pathToFileURL(resolve(ROOT, 'supabase/functions/_shared/rehearsal-core.mjs')).href);
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── the bundles: sealed by backup-core, opened by rehearsal-core ──
{
  ok(typeof B.encryptArchive === 'function' && typeof R.decryptArchive === 'function' && typeof R.isEncryptedArchive === 'function', 'backup-core exports encryptArchive; rehearsal-core exports decryptArchive + isEncryptedArchive');
  // A real archive from the real writer (one tiny entity), so the round trip is on the true format.
  const entities = B.REGISTRY.filter((e) => e.backupPolicy === 'full').slice(0, 1);
  const meta = { appVersion: B.BACKUP_FORMAT_VERSION, schemaVersion: '1', societyId: 'S1', societyName: 'Test Samiti', registrationNo: 'R-1', financialYear: '2025-26', createdAt: '2026-11-21T00:00:00.000Z', createdBy: { name: 'scheduled-backup', email: null, role: 'system' }, trigger: 'scheduled', encryption: null };
  const { archive } = await B.buildArchive({ entities, societyId: 'S1', fetchRows: async () => ({ rows: [], truncated: false, fetched: 0, error: null }), meta });
  const header = { formatVersion: B.BACKUP_FORMAT_VERSION, societyName: 'Test Samiti', registrationNo: 'R-1', financialYear: '2025-26', createdAt: meta.createdAt, trigger: 'scheduled' };
  const KEY = 'correct horse battery staple — platform key';
  const sealed = await B.encryptArchive(archive, KEY, header, { iterations: 2000 });
  ok(R.isEncryptedArchive(sealed) && !R.isEncryptedArchive(archive), 'a sealed archive is recognised; a plain zip is not');
  ok(!Buffer.from(sealed).includes(Buffer.from('manifest.json')) && Buffer.from(archive).includes(Buffer.from('manifest.json')), 'the sealed bytes do not reveal the zip contents (no file names in clear)');
  const opened = await R.decryptArchive(sealed, KEY);
  ok(Buffer.compare(Buffer.from(opened), Buffer.from(archive)) === 0, 'rehearsal-core opens it back to the exact archive bytes');
  const loaded = await R.loadArchive(opened, entities);
  ok(loaded.report.ok === true, 'the opened archive passes the same verifier the restore uses');
  let wrong = null;
  try { await R.decryptArchive(sealed, 'not the key'); } catch (e) { wrong = e; }
  ok(wrong && /passphrase/i.test(wrong.name + wrong.message), 'a wrong key is refused (no partial plaintext)');
}

// ── scheduled-backup ──
{
  const s = read('supabase/functions/scheduled-backup/index.ts');
  ok(s.includes("const ENC_PASSPHRASE = Deno.env.get('BACKUP_ENCRYPTION_PASSPHRASE') ?? '';"), 'the key comes from the BACKUP_ENCRYPTION_PASSPHRASE secret, never from code');
  ok(s.includes('? await encryptArchive(archive, ENC_PASSPHRASE, {') && s.includes(".upload(path, stored, { contentType: encrypted ? 'application/octet-stream' : 'application/zip', upsert: false });"), 'the archive is sealed BEFORE the Storage upload');
  ok(s.includes('const rep = await replicateOffVendor(path, stored);') && !s.includes('replicateOffVendor(path, archive)'), 'the off-vendor (R2/S3) copy gets the same sealed bytes');
  ok(s.includes('encrypted,   // DB-10 — never the key itself') && s.includes('byteSize: stored.length,'), 'the audit row says whether the copy is sealed (never the key) and its real size');
  ok(!/console\.(log|info|warn|error)\([^)]*ENC_PASSPHRASE/.test(s), 'the key is never logged');
}

// ── scheduled-rehearsal ──
{
  const r = read('supabase/functions/scheduled-rehearsal/index.ts');
  ok(r.includes("import { REGISTRY, loadArchive, runRehearsal, decryptArchive, isEncryptedArchive } from '../_shared/rehearsal-core.mjs';"), 'the rehearsal imports the decrypt from its bundle');
  ok(r.includes("[Deno.env.get('BACKUP_ENCRYPTION_PASSPHRASE'), Deno.env.get('BACKUP_ENCRYPTION_PASSPHRASE_PREVIOUS')]"), 'current key first, previous key during a rotation');
  ok(r.includes("reason: 'encrypted-no-key'") && r.includes("reason: 'encrypted-wrong-key'"), 'a sealed backup it cannot open is reported (no key / wrong key), never silently skipped');
  ok(r.indexOf('isEncryptedArchive(raw)') < r.indexOf('const outcome = await runRehearsal({'), 'it opens the archive before running the rehearsal');
}

console.log(`DB-10 backup encryption: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

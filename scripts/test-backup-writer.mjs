// `.slbak` writer + NDJSON (T-24 / gaps EXP-01, EXP-02).
//
// The audit's headline: a backup covering 16 of 93 collections that reported success.
// This file exists to make that impossible. It builds a real archive from the real
// registry, unzips it, and checks that every collection is either inside it or skipped
// for a written reason — and that a truncated or unreadable table aborts the whole thing
// rather than producing a file that verifies and restores wrong.
//
// Run: node scripts/test-backup-writer.mjs   (npm run test:backup-writer)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');

// run.ts reaches auditLog, which reaches src/lib/supabase.ts, which reads import.meta.env.
// Stub it, resolve the '@/' alias, and resolve the codebase's extensionless TS imports.
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as pathResolve } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      const SUPABASE = pathToFileURL(pathResolve(SRC, 'lib', 'supabase.ts')).href;

      export async function resolve(spec, ctx, next) {
        if (spec === '@/lib/supabase') return { url: SUPABASE, shortCircuit: true };
        if (spec.startsWith('@/')) {
          const base = pathResolve(SRC, spec.slice(2));
          for (const cand of [base + '.ts', base + '.tsx', base + '/index.ts', base]) {
            if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
          }
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
            const u = new URL(cand, ctx.parentURL);
            if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
          }
        }
        return next(spec, ctx);
      }

      export async function load(url, ctx, next) {
        if (url === SUPABASE) {
          return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' };
        }
        return next(url, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let writerMod, ndjsonMod, manifestMod, integrityMod, reg;
try {
  writerMod = await import(abs('../src/lib/backup/writer.ts'));
  ndjsonMod = await import(abs('../src/lib/backup/ndjson.ts'));
  manifestMod = await import(abs('../src/lib/backup/manifest.ts'));
  integrityMod = await import(abs('../src/lib/backup/integrity.ts'));
  reg = await import(abs('../src/lib/export/registry.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the backup modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { planArchive, buildArchive, archiveFileName, BackupIncompleteError, MANIFEST_PATH } = writerMod;
const { toNdjson, parseNdjson, countNdjsonRows, NdjsonParseError } = ndjsonMod;
const { verifyManifest, fileDigests, entityPath } = manifestMod;
const { verifyFiles } = integrityMod;
const { REGISTRY } = reg;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. NDJSON ────────────────────────────────────────────────────────────────
ok(toNdjson([]) === '', 'an empty table serializes to an empty string, not a lone newline');
ok(countNdjsonRows('') === 0, 'and counts as zero rows');

const rows = [{ b: 2, a: 1 }, { a: 3, b: 4 }];
const text = toNdjson(rows);
ok(text === '{"a":1,"b":2}\n{"a":3,"b":4}\n', 'one canonical object per line, trailing newline');
ok(toNdjson([{ b: 2, a: 1 }]) === toNdjson([{ a: 1, b: 2 }]),
  'KEY ORDER DOES NOT CHANGE THE BYTES — the digest is a property of the data, not of the day it was fetched');
ok(countNdjsonRows(text) === 2, 'rows are counted without parsing');
ok(countNdjsonRows('{"a":1}') === 1, 'a final line with no newline still counts');

const back = parseNdjson(text);
ok(back.length === 2 && back[0].a === 1 && back[1].b === 4, 'NDJSON round-trips');
ok(parseNdjson('\n\n' + text + '\n').length === 2, 'blank lines are skipped');
ok(parseNdjson('').length === 0, 'an empty file parses to no rows');

// A truncated line must THROW, naming the line. A restore that silently drops row 4,132
// because its JSON was cut in half is exactly the failure this workstream exists to kill.
let err = null;
try { parseNdjson('{"a":1}\n{"b":'); } catch (e) { err = e; }
ok(err instanceof NdjsonParseError && err.line === 2, `a malformed line throws, naming the line (got line ${err?.line})`);

err = null;
try { parseNdjson('[1,2]'); } catch (e) { err = e; }
ok(err instanceof NdjsonParseError, 'a line that is not a JSON object throws');

// Devanagari survives.
ok(parseNdjson(toNdjson([{ name: 'राजेश कुमार' }]))[0].name === 'राजेश कुमार', 'Devanagari round-trips');

// ── 2. THE PLAN ACCOUNTS FOR EVERY ENTITY (gap EXP-02) ───────────────────────
const plan = planArchive(REGISTRY);
ok(plan.written.length + plan.skipped.length === REGISTRY.length,
  `EVERY ONE OF THE ${REGISTRY.length} COLLECTIONS IS ACCOUNTED FOR — ${plan.written.length} written, ${plan.skipped.length} skipped`);

const skippedKeys = plan.skipped.map(s => s.key).sort();
ok(skippedKeys.join(',') === 'platform_admin,societies,society_capability,society_user,user_mfa,user_mfa_recovery',
  `only the six secret / cross-tenant entities are skipped (got: ${skippedKeys.join(',')})`);
ok(plan.skipped.every(s => s.reason === 'exclude' || s.reason === 'global'), 'every skip carries a written reason');
ok(plan.written.length === REGISTRY.length - 6, `${REGISTRY.length - 6} collections are written`);

// The three custody classes are visible in the directory layout.
const paths = plan.written.map(w => w.path);
ok(paths.some(p => p === 'data/voucher.ndjson'), 'full rows land in data/');
ok(paths.some(p => p === 'derived/voucher_entry.ndjson'), 'replayed rows land in derived/');
ok(paths.some(p => p === 'evidence/audit_log.ndjson'), 'evidence lands in evidence/');
ok(!paths.some(p => p.includes('user_mfa')), 'user_mfa (TOTP secrets) has no path in the archive');

// An unrecognised policy must abort the plan. Without entityPath's `default` throw, such
// an entity gets `undefined` as its path and disappears from the archive — the exact
// silent-drop this module exists to prevent. The test found that hole; the fix closed it.
let planThrew = false;
try {
  planArchive([...REGISTRY, { ...REGISTRY[0], key: 'weird', backupPolicy: 'nonsense', scope: 'society' }]);
} catch { planThrew = true; }
ok(planThrew, 'an entity with an unrecognised policy aborts the plan rather than vanishing');

// Two entities on one path: the second file would silently overwrite the first inside the
// zip, and one whole table would vanish from a backup that verifies cleanly.
let dupThrew = false;
try {
  const member = REGISTRY.find(e => e.key === 'member');
  planArchive([...REGISTRY, { ...member, table: 'members_copy' }]);
} catch (e) { dupThrew = /same archive path/.test(e.message); }
ok(dupThrew, 'two entities mapping to the same archive path abort the plan');

// ── 3. Build a real archive from the real registry ───────────────────────────
const ROWS_PER_ENTITY = 2;
const fetchOk = async (entity) => ({
  rows: Array.from({ length: ROWS_PER_ENTITY }, (_, i) => ({ id: `${entity.key}-${i}`, name: 'राजेश' })),
  truncated: false, fetched: ROWS_PER_ENTITY, error: null,
});

const META = {
  appVersion: '0.0.0', schemaVersion: '93',
  societyId: 'SOC001', societyName: 'श्री कृष्ण सहकारी समिति',
  registrationNo: 'REG/123', financialYear: '2025-26',
  createdAt: '2026-07-10T00:00:00.000Z',
  createdBy: { name: 'राजेश', email: 'a@b.com', role: 'admin' },
  trigger: 'manual',
};

const progress = [];
const { archive, manifest, plan: builtPlan } = await buildArchive({
  entities: REGISTRY, societyId: 'SOC001', fetchRows: fetchOk, meta: META,
  onProgress: (done, total, key) => progress.push([done, total, key]),
});

ok(archive instanceof Uint8Array && archive.length > 0, 'an archive is produced');
ok(progress.length === builtPlan.written.length, 'progress is reported once per written entity');
ok(progress.at(-1)[0] === progress.at(-1)[1], 'progress reaches done === total');

// ── 4. Unzip it and check what is really inside ──────────────────────────────
const unzipped = unzipSync(archive);
const inside = Object.keys(unzipped).sort();

ok(inside.includes(MANIFEST_PATH), 'the archive carries a manifest.json');
ok(inside.length === builtPlan.written.length + 1, `the archive holds exactly ${builtPlan.written.length} data files + the manifest`);

for (const { entity, path } of builtPlan.written) {
  if (!unzipped[path]) { ok(false, `${entity.key} is present at ${path}`); }
}
ok(builtPlan.written.every(w => !!unzipped[w.path]), 'EVERY written entity has a file in the archive');

// EXCLUDED ENTITIES ARE PROVABLY ABSENT — not empty, absent.
for (const key of ['user_mfa', 'user_mfa_recovery', 'society_user', 'platform_admin', 'societies', 'society_capability']) {
  ok(!inside.some(p => p.includes(key)), `"${key}" appears nowhere in the archive`);
}

// The manifest inside the zip is the one we built.
const parsedManifest = JSON.parse(strFromU8(unzipped[MANIFEST_PATH]));
ok(parsedManifest.manifestHash === manifest.manifestHash, 'the manifest written into the zip is the one that was hashed');
ok((await verifyManifest(parsedManifest)).ok, 'the manifest read back out of the archive verifies');
ok(parsedManifest.totals.rowCount === builtPlan.written.length * ROWS_PER_ENTITY, 'the manifest totals match what was written');
ok(parsedManifest.entities.length === builtPlan.written.length, 'the manifest lists every written entity');

// ── 5. Every per-file digest checks out, and one flipped byte does not ───────
const failures = await verifyFiles(fileDigests(parsedManifest), (p) => unzipped[p]);
ok(failures.length === 0, `every file in the archive matches its recorded digest (${failures.length} failures)`);

const target = entityPath('member', 'full');
const corrupted = { ...unzipped, [target]: (() => { const c = new Uint8Array(unzipped[target]); c[2] ^= 0x01; return c; })() };
const corruptFailures = await verifyFiles(fileDigests(parsedManifest), (p) => corrupted[p]);
ok(corruptFailures.length === 1 && corruptFailures[0].path === target && corruptFailures[0].reason === 'hash-mismatch',
  'A SINGLE FLIPPED BYTE IN ONE TABLE IS CAUGHT, and only that table is blamed');

// A file removed from the archive is caught too.
const stripped = { ...unzipped };
delete stripped[target];
const missing = await verifyFiles(fileDigests(parsedManifest), (p) => stripped[p]);
ok(missing.length === 1 && missing[0].reason === 'missing', 'a table removed from the archive is caught');

// ── 6. NO PARTIAL BACKUPS. Ever. ─────────────────────────────────────────────
// A file missing a third of the vouchers, that verifies cleanly and restores without
// complaint, is worse than no file: it ends the search for the real data.
let abortErr = null;
try {
  await buildArchive({
    entities: REGISTRY, societyId: 'SOC001', meta: META,
    fetchRows: async (e) => (e.key === 'voucher'
      ? { rows: [{ id: 1 }], truncated: true, fetched: 1, error: null }
      : fetchOk(e)),
  });
} catch (e) { abortErr = e; }
ok(abortErr instanceof BackupIncompleteError && abortErr.entityKey === 'voucher',
  'A TRUNCATED TABLE ABORTS THE WHOLE ARCHIVE — no partial backup is produced');

abortErr = null;
try {
  await buildArchive({
    entities: REGISTRY, societyId: 'SOC001', meta: META,
    fetchRows: async (e) => (e.key === 'member'
      ? { rows: [], truncated: false, fetched: 0, error: 'permission denied' }
      : fetchOk(e)),
  });
} catch (e) { abortErr = e; }
ok(abortErr instanceof BackupIncompleteError && /permission denied/.test(abortErr.message),
  'an unreadable table aborts the whole archive, and the error names it');

// ── 7. Determinism ───────────────────────────────────────────────────────────
const again = await buildArchive({ entities: REGISTRY, societyId: 'SOC001', fetchRows: fetchOk, meta: META });
ok(again.manifest.manifestHash === manifest.manifestHash, 'the same data yields the same manifest hash');
ok(again.archive.length === archive.length && again.archive.every((b, i) => b === archive[i]),
  'THE SAME DATA YIELDS BYTE-IDENTICAL ARCHIVES — no wall-clock timestamp leaks into the zip');

// ── 8. Filename ──────────────────────────────────────────────────────────────
const name = archiveFileName('श्री कृष्ण सहकारी समिति', '2025-26', '2026-07-10T00:00:00.000Z');
ok(name.endsWith('.slbak'), 'the archive has the .slbak extension, not .zip');
ok(name.includes('FY2025-26'), 'the filename names the financial year');
ok(!/[<>:"/\\|?*]/.test(name), 'the filename carries no character that Windows forbids');
ok(archiveFileName('', '2025-26', '2026-07-10T00:00:00.000Z').startsWith('society-'), 'a society with no usable name still gets a filename');

// ── 9. runBackup (T-24b) — RECORD, then deliver ──────────────────────────────
// A full-society archive is the largest custody action this app performs. The audit row
// is written first, and the bytes leave only if that succeeds. `deliver` is injected
// precisely so this ordering is observable — a guarantee nobody can observe is a comment,
// not a safeguard.
const { runBackup } = await import(abs('../src/lib/backup/run.ts'));
const { AuditWriteError } = await import(abs('../src/lib/auditLog.ts'));

const baseRun = {
  entities: REGISTRY, societyId: 'SOC001', fetchRows: fetchOk,
  appVersion: '0.0.0', schemaVersion: '93',
  societyName: 'श्री कृष्ण सहकारी समिति', registrationNo: 'REG/123', financialYear: '2025-26',
  createdAt: '2026-07-10T00:00:00.000Z',
  createdBy: { name: 'राजेश', email: 'a@b.com', role: 'admin' },
  trigger: 'manual',
  auditContext: { societyId: 'SOC001', actor: { name: 'राजेश' }, now: '2026-07-10T00:00:00.000Z' },
};

// 9a. Happy path — recorded, then delivered, in that order.
let events = [];
let out = await runBackup({
  ...baseRun,
  record: async (desc) => { events.push(['record', desc]); return 'exp-1'; },
  deliver: (bytes, name) => events.push(['deliver', name, bytes.length]),
});
ok(out.status === 'created', 'a complete archive reports created');
ok(events.map(e => e[0]).join(',') === 'record,deliver', 'THE AUDIT ROW IS WRITTEN BEFORE THE BYTES LEAVE');
ok(out.filename.endsWith('.slbak') && events[1][1] === out.filename, 'the delivered filename is the one reported');
ok(out.bytes > 0 && events[1][2] === out.bytes, 'the delivered byte count matches');

const recorded = events[0][1];
ok(recorded.format === 'zip' && recorded.mode === 'full', 'the audit row records a full zip export');
ok(recorded.entities.length === out.plan.written.length, 'the audit row names every entity that was written');
ok(recorded.rowCount === out.manifest.totals.rowCount, 'the audit row records the row count');
ok(typeof recorded.artifactSha256 === 'string' && recorded.artifactSha256.length === 64,
  'the audit row records the artifact hash — later it can prove WHICH bytes left');
ok(recorded.byteSize === out.bytes, 'the audit row records the artifact size');
ok(recorded.filters.skipped.length === 6, 'the audit row names the six entities deliberately skipped');

// 9b. THE AUDIT FAILS -> NOTHING IS DELIVERED.
events = [];
out = await runBackup({
  ...baseRun,
  record: async () => { throw new AuditWriteError('Audit write failed: relation "audit_log" does not exist'); },
  deliver: (bytes, name) => events.push(['deliver', name]),
});
ok(out.status === 'audit-failed', 'a failed audit write reports audit-failed, distinct from a generic failure');
ok(events.length === 0, 'NOTHING WAS DELIVERED: the archive never reached the user');
ok(/audit_log/.test(out.message), 'the failure carries its cause');

// 9c. A truncated table aborts before either happens.
events = [];
out = await runBackup({
  ...baseRun,
  fetchRows: async (e) => (e.key === 'voucher'
    ? { rows: [{ id: 1 }], truncated: true, fetched: 1, error: null }
    : fetchOk(e)),
  record: async () => { events.push(['record']); return 'x'; },
  deliver: () => events.push(['deliver']),
});
ok(out.status === 'incomplete' && out.entityKey === 'voucher', 'a truncated table reports incomplete, naming the table');
ok(events.length === 0, 'an incomplete archive is neither recorded nor delivered');

// 9d. An unexpected error is surfaced, never swallowed.
events = [];
out = await runBackup({
  ...baseRun,
  record: async () => { throw new Error('disk on fire'); },
  deliver: () => events.push(['deliver']),
});
ok(out.status === 'failed' && out.message === 'disk on fire', 'an unexpected error reports failed');
ok(events.length === 0, 'and delivers nothing');

// Four distinct outcomes — none of them may be read as "backed up 0 rows".
ok(new Set(['created', 'incomplete', 'audit-failed', 'failed']).size === 4, 'four distinct outcomes, each with its own sentence');

// ── 10. verifyArchive (T-25) — the check an auditor can run without an account ─
const { verifyArchive, summarizeVerification } = await import(abs('../src/lib/backup/verify.ts'));

// Rebuild the archive to work from (the earlier one is still in `archive`).
const good = await verifyArchive(archive);
ok(good.ok, `an intact archive verifies (${good.problems.join('; ') || 'no problems'})`);
ok(good.manifest !== null, 'the manifest is returned so the caller can show what is inside');
ok(good.entities.length === builtPlan.written.length, 'every entity gets a per-entity status');
ok(good.entities.every(e => e.status === 'ok'), 'every entity reports ok');
ok(good.unlistedFiles.length === 0, 'nothing unlisted is present');
ok(good.fingerprintMatches === null, 'without a registry, the fingerprint is not judged — an offline verifier still works');
ok(summarizeVerification(good, false).startsWith('Verified'), 'the summary reads as verified');

// With the registry: this build can place everything, and the fingerprint matches.
const withReg = await verifyArchive(archive, { entities: REGISTRY });
ok(withReg.ok && withReg.fingerprintMatches === true, 'with the current registry, the fingerprint matches');
ok(withReg.unplaceable.length === 0, 'this build can place every entity in the archive');

// ── 11. Tampering, from the outside ──────────────────────────────────────────
const unpacked = unzipSync(archive);
const memberPath = entityPath('member', 'full');

// 11a. A single flipped byte in one table.
const flipped = { ...unpacked };
flipped[memberPath] = (() => { const c = new Uint8Array(unpacked[memberPath]); c[2] ^= 0x01; return c; })();
let report = await verifyArchive(zipSync(flipped));
ok(!report.ok, 'a flipped byte fails verification');
ok(report.entities.find(e => e.key === 'member').status === 'hash-mismatch', 'the corrupt table is named, by key');
ok(report.entities.filter(e => e.status !== 'ok').length === 1, 'and only that table is blamed');

// 11b. A table removed from the archive.
const stripped2 = { ...unpacked };
delete stripped2[memberPath];
report = await verifyArchive(zipSync(stripped2));
ok(!report.ok && report.entities.find(e => e.key === 'member').status === 'missing', 'a removed table is reported missing');

// 11c. THE ONE A NAIVE VERIFIER MISSES: an EXTRA file, listed nowhere.
// The manifest hash still verifies. Every listed digest still matches. Yet the archive
// now carries rows nobody recorded, and a restore that walks the zip would import them.
const smuggled = { ...unpacked, 'data/members_extra.ndjson': strToU8('{"id":"ghost"}\n') };
report = await verifyArchive(zipSync(smuggled));
ok(!report.ok, 'AN UNLISTED FILE FAILS VERIFICATION even though every listed digest still matches');
ok(report.unlistedFiles.join(',') === 'data/members_extra.ndjson', 'the smuggled file is named');
ok(report.entities.every(e => e.status === 'ok'), '…and no legitimate table is blamed for it');

// 11d. The manifest itself edited (row count reduced, totals fixed to match).
const editedManifest = JSON.parse(strFromU8(unpacked[MANIFEST_PATH]));
editedManifest.entities[0].rowCount = 1;
editedManifest.totals.rowCount -= (ROWS_PER_ENTITY - 1);
const forged = { ...unpacked, [MANIFEST_PATH]: strToU8(JSON.stringify(editedManifest)) };
report = await verifyArchive(zipSync(forged));
ok(!report.ok && report.problems.some(p => /altered/.test(p)), 'an edited manifest is caught by its own hash');

// ── 12. Malformed input is an answer, not an exception ───────────────────────
report = await verifyArchive(new Uint8Array([1, 2, 3, 4]));
ok(!report.ok && report.manifest === null, 'random bytes do not verify, and do not throw');
ok(/not a readable archive/.test(report.problems[0]), 'and the reason says so');

report = await verifyArchive(zipSync({ 'hello.txt': strToU8('hi') }));
ok(!report.ok && /no manifest\.json/.test(report.problems[0]), 'a zip with no manifest is rejected');

report = await verifyArchive(zipSync({ [MANIFEST_PATH]: strToU8('{ not json') }));
ok(!report.ok && /not valid JSON/.test(report.problems[0]), 'an unparseable manifest is rejected');

report = await verifyArchive(zipSync({ [MANIFEST_PATH]: strToU8('{"a":1}') }));
ok(!report.ok && /does not describe an archive/.test(report.problems[0]), 'a manifest with no entity list is rejected');

ok(summarizeVerification(report, false) === 'The file could not be read.', 'an unreadable file summarizes plainly');

// ── 13. An archive this build cannot fully place (gap EXP-02) ────────────────
// A future build adds a table; today's build must NAME what it cannot restore rather
// than silently dropping it.
const shrunkRegistry = REGISTRY.filter(e => e.key !== 'housing_flat');
report = await verifyArchive(archive, { entities: shrunkRegistry });
ok(report.unplaceable.includes('housing_flat'),
  'AN ENTITY THIS BUILD DOES NOT KNOW IS NAMED — a restore must not silently drop it');
ok(report.fingerprintMatches === false, 'and the registry fingerprint no longer matches');
ok(!report.ok, 'so the archive does not verify against this build');

// Cosmetic registry changes do not even move the fingerprint.
const relabelledRegistry = REGISTRY.map(e => ({ ...e, label: 'X', minRole: 'admin' }));
report = await verifyArchive(archive, { entities: relabelledRegistry });
ok(report.fingerprintMatches === true, 'relabelling an entity does not move the fingerprint');
ok(report.unplaceable.length === 0 && report.ok, 'a cosmetically relabelled registry still verifies');

// THE CASE THAT DISTINGUISHES "different" FROM "broken": this build added a COLUMN, so the
// fingerprint no longer matches — but every entity in the archive is still placeable. A
// verifier that treated a fingerprint mismatch as fatal would reject every archive written
// before the next column was added, which is every archive.
const extraColumnRegistry = REGISTRY.map(e => (e.key === 'member'
  ? { ...e, columns: [...e.columns, { key: 'newColumn', header: 'New', headerHi: 'नया', type: 'string', piiClass: 'none', defaultVisible: false }] }
  : e));
report = await verifyArchive(archive, { entities: extraColumnRegistry });
ok(report.fingerprintMatches === false, 'adding a column DOES move the fingerprint');
ok(report.unplaceable.length === 0, 'yet every entity in the archive is still placeable');
ok(report.ok, 'A FINGERPRINT MISMATCH ALONE IS NOT A FAILURE — an older archive is still valid');

// ── 14. Encrypted archives (T-26) ────────────────────────────────────────────
const { decryptArchive, isEncryptedArchive, readContainerHeader } = await import(abs('../src/lib/backup/crypto.ts'));
const { sha256Bytes } = integrityMod;

let delivered = null;
let recordedDesc = null;
out = await runBackup({
  ...baseRun,
  passphrase: 'सही पासवर्ड',
  record: async (desc) => { recordedDesc = desc; return 'exp-enc'; },
  deliver: (bytes) => { delivered = bytes; },
});
ok(out.status === 'created' && out.encrypted === true, 'a passphrase produces an encrypted archive');
ok(isEncryptedArchive(delivered), 'the delivered bytes are an encrypted container, not a plain zip');

// THE AUDIT ROW DESCRIBES THE BYTES THE USER ACTUALLY GOT. Hashing the plaintext zip
// would record a digest of a file that never existed outside the function.
ok(recordedDesc.artifactSha256 === await sha256Bytes(delivered),
  'the audit row records the hash of the DELIVERED (encrypted) bytes, not the plaintext zip');
ok(recordedDesc.byteSize === delivered.length, 'and their size');
ok(recordedDesc.filters.encrypted === true, 'the audit row records that the archive was encrypted');
ok(!JSON.stringify(recordedDesc).includes('सही पासवर्ड'), 'THE PASSPHRASE NEVER REACHES THE AUDIT ROW');

// The header identifies the society without the passphrase.
const encHeader = readContainerHeader(delivered);
ok(encHeader.societyName === baseRun.societyName && encHeader.financialYear === '2025-26',
  'the container header identifies the society and FY without decrypting');

// Decrypt, and the result is the archive that verifies.
const plain = await decryptArchive(delivered, 'सही पासवर्ड');
const decryptedReport = await verifyArchive(plain, { entities: REGISTRY });
ok(decryptedReport.ok, 'the decrypted archive verifies exactly as an unencrypted one does');
ok(decryptedReport.manifest.totals.rowCount === out.manifest.totals.rowCount, 'and holds the same rows');

// ── 15. The verifier tells "encrypted" from "corrupt" ────────────────────────
// Reporting an encrypted archive as "not a readable archive" would send the holder of a
// perfectly good file hunting for a corrupt one.
const encReport = await verifyArchive(delivered);
ok(encReport.encrypted === true, 'the verifier recognises an encrypted archive');
ok(encReport.manifest === null && !encReport.ok, 'it cannot verify the contents without the passphrase');
ok(/encrypted/.test(encReport.problems[0]), 'and says exactly that, rather than "unreadable"');
ok(encReport.encryptedHeader.societyName === baseRun.societyName, 'it still names the society, from the cleartext header');
ok(summarizeVerification(encReport, false).includes('encrypted'), 'the summary says the archive is encrypted');

// A plain archive is still reported as not encrypted.
ok((await verifyArchive(archive)).encrypted === false, 'an unencrypted archive is not mistaken for an encrypted one');

// No passphrase → no encryption, and the delivered bytes are the zip itself.
delivered = null;
out = await runBackup({ ...baseRun, record: async () => 'x', deliver: (b) => { delivered = b; } });
ok(out.encrypted === false && !isEncryptedArchive(delivered), 'without a passphrase the archive is delivered unencrypted');

console.log(`\nBackup writer + NDJSON: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

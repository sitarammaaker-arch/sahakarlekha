// Archive reader for restore (T-32 / gap EXP-03).
//
// This module stands between "these bytes are intact" and "here are the rows a restore
// would write". The tests are about the ways it could hand over rows it should not:
//
//   * parsing a file whose digest never matched;
//   * reading `derived/` or `evidence/` — rows a restore must never insert;
//   * walking the ZIP instead of the manifest, and so opening a smuggled file;
//   * returning "the entities that parsed" when one of them did not;
//   * accepting a file whose row count is not the row count the manifest promised.
//
// Run: node scripts/test-restore-archive.mjs   (npm run test:restore-archive)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');

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

let archiveMod, writerMod, manifestMod, cryptoMod, ndjsonMod, integrityMod, reg;
try {
  archiveMod = await import(abs('../src/lib/restore/archive.ts'));
  writerMod = await import(abs('../src/lib/backup/writer.ts'));
  manifestMod = await import(abs('../src/lib/backup/manifest.ts'));
  cryptoMod = await import(abs('../src/lib/backup/crypto.ts'));
  ndjsonMod = await import(abs('../src/lib/backup/ndjson.ts'));
  integrityMod = await import(abs('../src/lib/backup/integrity.ts'));
  reg = await import(abs('../src/lib/export/registry.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the restore archive modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { loadArchive, checkCompatibility } = archiveMod;
const { buildArchive, MANIFEST_PATH } = writerMod;
const { buildManifest, registryFingerprint } = manifestMod;
const { encryptArchive } = cryptoMod;
const { toNdjson } = ndjsonMod;
const { sha256Bytes } = integrityMod;
const { REGISTRY } = reg;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── Build a real archive from the real registry ──────────────────────────────

const ROWS = 2;
const fetchOk = async (entity) => ({
  rows: Array.from({ length: ROWS }, (_, i) => ({ id: `${entity.key}-${i}`, name: 'राजेश' })),
  truncated: false, fetched: ROWS, error: null,
});

const META = {
  appVersion: '0.0.0', schemaVersion: '93',
  societyId: 'SOC001', societyName: 'श्री कृष्ण सहकारी समिति',
  registrationNo: 'REG/123', financialYear: '2025-26',
  createdAt: '2026-07-10T00:00:00.000Z',
  createdBy: { name: 'राजेश', email: 'a@b.com', role: 'admin' },
  trigger: 'manual',
};

const { archive } = await buildArchive({
  entities: REGISTRY, societyId: 'SOC001', fetchRows: fetchOk, meta: META,
});

// ── 1. The happy path ────────────────────────────────────────────────────────

const loaded = await loadArchive(archive, REGISTRY);
ok(loaded.report.ok === true, 'a freshly built archive verifies');
ok(loaded.problems.length === 0, 'and loads without problems');

const fullKeys = REGISTRY.filter(e => e.backupPolicy === 'full' && e.scope === 'society').map(e => e.key);
ok(Object.keys(loaded.rows).length === fullKeys.length,
  `exactly the ${fullKeys.length} restorable entities are read (got ${Object.keys(loaded.rows).length})`);
ok(loaded.rows.member?.length === ROWS, 'rows are parsed');
ok(loaded.rows.member[0].name === 'राजेश', 'Devanagari survives the round trip');

// The whole point of T-30's plan: these are in the archive, and are never handed to a restore.
ok(!('voucher_entry' in loaded.rows), 'derived/voucher_entry.ndjson is NEVER loaded — T-33 replays it');
ok(!('audit_log' in loaded.rows), 'evidence/audit_log.ndjson is NEVER loaded — it is WORM');
ok(!('guide_certificate' in loaded.rows), 'evidence/guide_certificate.ndjson is never loaded either');

// They ARE in the file. The reader chooses not to look.
const inside = Object.keys(unzipSync(archive));
ok(inside.includes('derived/voucher_entry.ndjson'), 'though voucher_entry IS present in the archive');
ok(inside.includes('evidence/audit_log.ndjson'), 'and so is audit_log');

// ── 2. Nothing is parsed until everything is verified ────────────────────────

/** Rewrite one file inside the archive, leaving the manifest's digest for it stale. */
function tamper(bytes, path, text) {
  const files = unzipSync(bytes);
  files[path] = strToU8(text);
  return zipSync(files, { mtime: Date.UTC(1980, 0, 1) });
}

// The edited file keeps the SAME ROW COUNT the manifest promised. That matters: if it did
// not, the rowCount check further down would refuse the archive for the wrong reason, and
// this assertion would pass even with verification switched off. (It did, until a sabotage
// run caught it.) With the count intact, the ONLY thing standing between these rows and the
// operator is the digest.
const edited = tamper(archive, 'data/member.ndjson', toNdjson([{ id: 'ghost', name: 'भूत' }, { id: 'ghost-2', name: 'भूत' }]));
const loadedEdited = await loadArchive(edited, REGISTRY);
ok(loadedEdited.report.ok === false, 'an edited row fails verification');
ok(loadedEdited.problems.length === 0, 'and is refused BY VERIFICATION, not by a later parse check');
ok(Object.keys(loadedEdited.rows).length === 0,
  'NOTHING is parsed — not even the entities whose digests still match');
ok(!loadedEdited.rows.member, 'the tampered entity certainly is not returned');

// A smuggled file passes every digest check, because no digest was ever recorded for it.
// verify.ts fails on it; the reader never opens it either, because it reads the manifest.
const smuggled = (() => {
  const files = unzipSync(archive);
  files['data/ghost.ndjson'] = strToU8(toNdjson([{ id: 'x' }]));
  return zipSync(files, { mtime: Date.UTC(1980, 0, 1) });
})();
const loadedSmuggled = await loadArchive(smuggled, REGISTRY);
ok(loadedSmuggled.report.ok === false, 'an unlisted file fails verification');
ok(!('ghost' in loadedSmuggled.rows), 'and the smuggled entity is never loaded');

// An encrypted archive must be decrypted first. It is not "corrupt".
const enc = await encryptArchive(archive, 'a very long passphrase', {
  formatVersion: '1.0', societyName: META.societyName, registrationNo: META.registrationNo,
  financialYear: META.financialYear, createdAt: META.createdAt, trigger: 'manual',
});
const loadedEnc = await loadArchive(enc, REGISTRY);
ok(loadedEnc.report.encrypted === true, 'an encrypted archive is reported as encrypted, not unreadable');
ok(Object.keys(loadedEnc.rows).length === 0, 'and yields no rows without the passphrase');

// Garbage.
const loadedJunk = await loadArchive(new Uint8Array([1, 2, 3, 4]), REGISTRY);
ok(loadedJunk.report.ok === false && Object.keys(loadedJunk.rows).length === 0, 'garbage yields no rows');

// ── 3. A manifest that lies about its own row count ──────────────────────────
//
// The digest covers the FILE. `rowCount` is a separate field, and `manifestHash` covers it,
// so a hand-built manifest can be internally consistent and still promise 3 rows for a file
// holding 2. Every hash checks out; the archive is still wrong. A restore that trusted it
// would insert a different number of rows than the operator was shown.

async function craftArchive({ rowCountLie = 0 } = {}) {
  const member = REGISTRY.find(e => e.key === 'member');
  const text = toNdjson([{ id: 'm-1' }, { id: 'm-2' }]);
  const bytes = strToU8(text);
  const manifest = await buildManifest({
    ...META,
    encryption: null,
    registryFingerprint: await registryFingerprint(REGISTRY),
    entities: [{
      key: 'member', table: member.table, policy: 'full',
      rowCount: 2 + rowCountLie,                       // the lie
      bytes: bytes.length,
      sha256: await sha256Bytes(bytes),                // the truth
      columns: member.columns.map(c => c.key),
    }],
  });
  return zipSync({
    [MANIFEST_PATH]: strToU8(JSON.stringify(manifest)),
    'data/member.ndjson': bytes,
  }, { mtime: Date.UTC(1980, 0, 1) });
}

const honest = await loadArchive(await craftArchive(), REGISTRY);
ok(honest.report.ok === true, 'the hand-crafted archive is well-formed (the test harness works)');
ok(honest.rows.member.length === 2, 'and its two rows are read');

const liar = await loadArchive(await craftArchive({ rowCountLie: 1 }), REGISTRY);
ok(liar.report.ok === true, 'a manifest that lies about rowCount still passes every DIGEST check');
ok(liar.problems.length === 1 && liar.problems[0].includes('promised 3 row(s)'),
  'but the reader catches it — the manifest promised 3 rows, the file holds 2');
ok(Object.keys(liar.rows).length === 0,
  'and one parse problem invalidates the WHOLE load — never "the entities that worked"');

// ── 4. Compatibility ─────────────────────────────────────────────────────────

const mf = { societyId: 'SOC001', societyName: 'क', financialYear: '2025-26' };

const same = checkCompatibility(mf, { id: 'SOC001', financialYear: '2025-26' });
ok(same.status === 'same-society' && same.safe, 'the same society and year is safe');

// The dangerous one. Restoring society A's members into society B is not a mistake anyone
// notices until an audit.
const other = checkCompatibility(mf, { id: 'SOC999', financialYear: '2025-26' });
ok(other.status === 'different-society' && other.safe === false,
  'an archive from ANOTHER society is never silently safe');
ok(other.archiveSociety === 'क', 'and the archive names the society it came from');

// A different FY is legitimate — an auditor restores last year's books. The mode decides.
const oldFy = checkCompatibility(mf, { id: 'SOC001', financialYear: '2026-27' });
ok(oldFy.status === 'different-fy' && oldFy.safe === true,
  'a different financial year is reported, but is not unsafe on its own');
ok(oldFy.archiveFy === '2025-26', 'and the archive names its year');

// ── 5. Purity of the compatibility check ─────────────────────────────────────

const source = readFileSync(pathResolve(SRC, 'lib', 'restore', 'archive.ts'), 'utf8');
for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random', '.insert(', '.update(', '.delete(']) {
  ok(!source.includes(forbidden), `archive.ts reads and never writes (found "${forbidden}")`);
}
ok(source.includes('verifyArchive(bytes'), 'archive.ts verifies before it parses');

// ── 6. The Restore Center cannot write ───────────────────────────────────────
//
// T-32 ships the gates BEFORE the writes, on purpose: a restore is the one operation that
// can destroy a society's books in a single click. The page's claim to write nothing is
// only worth what enforces it. This is what enforces it. When T-33 lands a commit saga,
// this assertion must be moved to guard the saga's preconditions — not deleted.

/**
 * Comments are stripped before scanning. The first version of this guard failed on a clean
 * file, because the doc comment explaining the guard quoted the very tokens it forbids. A
 * check that cannot survive being described is a check that will be deleted the first time
 * someone writes a comment.
 */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const page = stripComments(readFileSync(pathResolve(SRC, 'pages', 'RestoreCenter.tsx'), 'utf8'));
ok(!/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/.test(page),
  'RestoreCenter.tsx has NO commit path — no insert, update, delete, upsert or rpc call');
// Prove the stripper does not simply blank the file, or the assertion above is vacuous.
ok(page.includes('handleDryRun') && page.length > 2000, 'the guard is scanning real code, not an empty string');
ok(page.includes('fetchEntityRows'), 'it reads the database');
ok(page.includes('planRestore') && page.includes('diffRestore'), 'and diffs the archive against it');
ok(!/from ['"]@\/lib\/supabase['"]/.test(page), 'it never imports the Supabase client directly');

console.log(`\nRestore archive: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

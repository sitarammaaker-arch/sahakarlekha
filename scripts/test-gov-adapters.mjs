// Government adapters — shared substrate (T-27 / API Constitution Art. VI; IRR-9, API-P8, API-P9).
//
// Proves the spec-independent core every government adapter shares:
//   • external-code mapping is fail-CLOSED and point-in-time — no internal enum/guess ever reaches
//     the government, and an inbound code is mapped back or refused (IRR-9/API-P7);
//   • a statutory return is PREPARED but filed only under HUMAN authority + SoD (API-P8/RULE 6);
//   • filing is idempotent — re-filing the same return is a replay, never a double-file (API-P9).
//
// The code VALUES here are illustrative fixtures — the module fabricates no statutory codes.
//
// Run: node scripts/test-gov-adapters.mjs   (npm run test:gov-adapters)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let C, S;
try {
  C = await import(abs('../src/lib/api/gov/codeMap.ts'));
  S = await import(abs('../src/lib/api/gov/submission.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the gov-adapter modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { mapToExternal, mapFromExternal } = C;
const { prepareSubmission, authorizeFiling, fileSubmission, submissionKey } = S;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. EXTERNAL-CODE MAPPING — fail-closed + point-in-time (IRR-9) ───────────
// Illustrative TRACES TDS-section map, versioned: '194A' rekeyed on 2024-04-01 (fixture, not a real code list).
const entries = [
  { scheme: 'TRACES_SECTION', canonical: 'tds_interest', external: '194A', effectiveFrom: '2020-04-01', effectiveTo: '2024-04-01' },
  { scheme: 'TRACES_SECTION', canonical: 'tds_interest', external: '194A-N', effectiveFrom: '2024-04-01' },
  { scheme: 'NCD', canonical: 'reserve_fund', external: 'RF01', effectiveFrom: '2020-04-01' },
];
ok(mapToExternal('tds_interest', 'TRACES_SECTION', '2022-06-01', entries).code === '194A',
  'a canonical head maps to the external code in force at the date');
ok(mapToExternal('tds_interest', 'TRACES_SECTION', '2025-06-01', entries).code === '194A-N',
  'after the scheme change the later effective-dated code wins (point-in-time, VER-4/VER-6)');
const unmapped = mapToExternal('tds_dividend', 'TRACES_SECTION', '2025-06-01', entries);
ok(!unmapped.ok && /no TRACES_SECTION external code/.test(unmapped.reason),
  'an unmapped canonical code is REFUSED — no internal enum/guess is sent to the government (fail-closed, IE-4)');
ok(!mapToExternal('reserve_fund', 'NCD', '2019-01-01', entries).ok,
  'a code not yet effective is refused (point-in-time)');
// reverse (inbound, untrusted)
ok(mapFromExternal('RF01', 'NCD', '2021-01-01', entries).code === 'reserve_fund', 'an inbound external code maps back to canonical');
ok(!mapFromExternal('ZZ99', 'NCD', '2021-01-01', entries).ok, 'an unrecognized inbound code is refused, never coerced (API-P7)');

// ── 2. PREPARE — a return starts prepared, never auto-filed (API-P8/RULE 6) ──
const sub = prepareSubmission({
  id: 'sub-1', scheme: 'GSTN', tenantId: 'SOC-1', jurisdiction: 'Haryana',
  idempotencyKey: 'GSTR3B-2026-04', preparedBy: 'accountant-1', payload: { taxable: 100000 },
});
ok(sub.status === 'prepared' && sub.schemaVersion === 1, 'a prepared return is in "prepared", versioned, not filed');
let threw = false;
try { prepareSubmission({ id: '', scheme: 'GSTN', tenantId: 'S', jurisdiction: 'H', idempotencyKey: 'k', preparedBy: 'p', payload: {} }); }
catch { threw = true; }
ok(threw, 'a malformed submission (missing id) is rejected at construction');

// ── 3. AUTHORIZE — human authority + SoD (API-P8/RULE 6/AUTH-6) ───────────────
const noAuth = fileSubmission(sub, new Set());
ok(!noAuth.ok && /only an authorized submission/.test(noAuth.reason), 'a prepared-but-unauthorized return cannot be filed — never autonomous');
const selfAuth = authorizeFiling(sub, { id: 'accountant-1', isHuman: true });
ok(!selfAuth.ok && /separation of duties/.test(selfAuth.reason), 'the preparer cannot authorize the filing (SoD)');
const botAuth = authorizeFiling(sub, { id: 'bot-1', isHuman: false });
ok(!botAuth.ok && /human authorized officer/.test(botAuth.reason), 'a non-human cannot authorize a statutory filing (API-P8)');
const authd = authorizeFiling(sub, { id: 'secretary-1', isHuman: true });
ok(authd.ok && authd.submission.status === 'authorized' && authd.submission.authorizedBy === 'secretary-1',
  'an independent human officer authorizes the filing');

// ── 4. FILE — idempotent, no double-file (API-P9) ────────────────────────────
const filed = fileSubmission(authd.submission, new Set());
ok(filed.ok && filed.submission.status === 'filed' && filed.replayed === false, 'an authorized return files once');
// re-filing the same key is a REPLAY, not a second filing.
const filedKeys = new Set([submissionKey(authd.submission)]);
const again = fileSubmission(authd.submission, filedKeys);
ok(again.ok && again.replayed === true, 're-filing the same (scheme, key) is a replay — never a double-file');
ok(fileSubmission(filed.submission, new Set()).replayed === true, 'an already-filed submission re-files as a replay');
ok(submissionKey(authd.submission) === 'GSTN::GSTR3B-2026-04', 'the idempotency identity is scheme::key');

// ── 5. PURITY ────────────────────────────────────────────────────────────────
for (const [file, sub2] of [['codeMap.ts', 'codeMap'], ['submission.ts', 'submission']]) {
  const code = readFileSync(pathResolve(SRC, 'lib', 'api', 'gov', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
    ok(!code.includes(forbidden), `gov/${sub2} is pure & does no I/O (no "${forbidden}")`);
  }
}

console.log(`\nGovernment adapters — shared substrate: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

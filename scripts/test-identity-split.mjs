// Identity & PII separation (T-17 / ADR-0007; CL-6; IRR-3; DPDP).
//
// Proves the split that keeps PII out of financial rows:
//   • splitIdentity moves every PII field to the identity side; the financial side carries only
//     identityRef + non-PII financial fields (CL-6);
//   • the write-guard (piiLeaks / isFinancialClean) rejects a financial row that leaks PII;
//   • tombstoning erases the PII but keeps the identityRef, so the financial history that
//     references it is INTACT — erasure and statutory retention reconciled (IRR-3).
//
// Run: node scripts/test-identity-split.mjs   (npm run test:identity-split)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let mod;
try {
  mod = await import(abs('../src/lib/identity/identity.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the identity module.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { splitIdentity, piiLeaks, isFinancialClean, tombstoneIdentity, PII_FIELDS } = mod;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// A member as it exists today — financial fields AND inline PII (the CA-04 / IRR-3 problem).
const member = {
  memberNo: 'M001', shareCapital: 500000, shareCount: 100, joinDate: '2025-04-01', status: 'active',
  name: 'Rajesh Kumar', fatherName: 'Suresh Kumar', address: 'Village Rampur', phone: '9999900000',
  nomineeName: 'Sita Devi', nomineeRelation: 'wife', nomineePhone: '8888800000',
};

// ── 1. SPLIT — PII to identity, identityRef to financial ─────────────────────
const { financial, identity } = splitIdentity(member, 'id-abc-123');
ok(financial.identityRef === 'id-abc-123', 'the financial record carries the pseudonymous identityRef');
ok(financial.memberNo === 'M001' && financial.shareCapital === 500000 && financial.joinDate === '2025-04-01',
  'the financial (non-PII) fields stay on the financial record');
ok(financial.name === undefined && financial.phone === undefined && financial.nomineeName === undefined,
  'NO PII field remains on the financial record (CL-6)');
ok(identity.attributes.name === 'Rajesh Kumar' && identity.attributes.phone === '9999900000' && identity.attributes.nomineeName === 'Sita Devi',
  'the PII moves to the identity record');
ok(identity.identityRef === financial.identityRef && identity.status === 'active',
  'the identity is joined to the financial record by the same ref, and starts active');

// ── 2. WRITE-GUARD — reject a financial row that leaks PII ────────────────────
ok(isFinancialClean(financial), 'the split financial record is clean (no PII)');
ok(!isFinancialClean(member), 'the original member record is NOT clean — it embeds PII');
const leaks = piiLeaks(member);
ok(leaks.includes('name') && leaks.includes('phone') && leaks.includes('nomineePhone'),
  'piiLeaks names every leaking field (name, phone, nomineePhone, …)');
ok(piiLeaks({ memberNo: 'M001', identityRef: 'id-abc-123', shareCapital: 500000 }).length === 0,
  'a record with only financial fields + identityRef has no leaks');
// A null PII field is not a leak (absent data).
ok(piiLeaks({ name: null, memberNo: 'M002' }).length === 0, 'a null PII field is not a leak');

// ── 3. ERASURE vs RETENTION — tombstone keeps the ref (IRR-3) ─────────────────
const erased = tombstoneIdentity(identity);
ok(erased.status === 'tombstoned' && Object.keys(erased.attributes).length === 0, 'tombstoning drops every PII attribute');
ok(erased.identityRef === identity.identityRef, 'the identityRef survives tombstoning');
ok(financial.identityRef === erased.identityRef,
  'the financial record still resolves to the (now tombstoned) identity — history intact, PII erased (erasure vs retention)');

// ── 4. DETERMINISM + SANITY ──────────────────────────────────────────────────
ok(JSON.stringify(splitIdentity(member, 'id-abc-123')) === JSON.stringify({ financial, identity }), 'the split is deterministic');
ok(PII_FIELDS.has('name') && PII_FIELDS.has('aadhaar') && !PII_FIELDS.has('memberNo') && !PII_FIELDS.has('shareCapital'),
  'PII_FIELDS covers personal fields but NOT financial identifiers');

// ── 5. PURITY ────────────────────────────────────────────────────────────────
const code = readFileSync(pathResolve(SRC, 'lib', 'identity', 'identity.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random', 'crypto.randomUUID']) {
  ok(!code.includes(forbidden), `identity.ts is pure & holds no I/O (no "${forbidden}")`);
}

console.log(`\nIdentity & PII separation: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

// Founder decisions 2026-10-09 ("go with your suggestion"):
//   • Dashboard health score counts only provable book-keeping facts (src/lib/healthScore)
//   • member phone is optional, but a given one must be a real 10-digit mobile (no 9999999999)
//   • the login page makes no usage / uptime claims it cannot back
// Imports the REAL src/lib/healthScore.ts; wiring checked in the source (house style).
//
// Run: node scripts/test-health-score.mjs   (npm run test:health-score)
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src');
const { healthScore, healthChecks } = await import(pathToFileURL(resolve(SRC, 'lib', 'healthScore.ts')).href);
const read = (p) => readFileSync(resolve(SRC, p), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const clean = { bsTallied: true, shareReconciled: true, shareApplies: true, assetReconciled: true, assetApplies: true, loanCount: 3, overdueLoans: 0, objectionCount: 2, pendingObjections: 0 };

// 1. The rule
ok(healthScore(clean) === 100, 'everything in order → 100');
ok(healthChecks(clean).reduce((s, c) => s + c.points, 0) === 100, 'the five checks weigh 100 in all');
ok(healthScore({ ...clean, bsTallied: false }) === 75, 'Balance Sheet not tallied → −25');
ok(healthScore({ ...clean, shareReconciled: false }) === 80, 'share-capital mismatch now COSTS points (it used to be ignored)');
ok(healthScore({ ...clean, assetReconciled: false }) === 85, 'asset-register mismatch costs points');
ok(healthScore({ ...clean, overdueLoans: 1 }) === 80 && healthScore({ ...clean, pendingObjections: 1 }) === 80, 'an overdue loan / a pending objection costs points');
ok(healthScore({ ...clean, loanCount: 0, overdueLoans: 0 }) === 100 && healthScore({ ...clean, loanCount: 0, objectionCount: 0, shareApplies: false, assetApplies: false }) === 100, 'a check that does not apply neither helps nor hurts');
ok(healthScore({ ...clean, loanCount: 0, objectionCount: 0, shareApplies: false, assetApplies: false, bsTallied: false }) === 0, 'only the BS applies and fails → 0 (no free points)');
ok(!('reserve' in Object.fromEntries(healthChecks(clean).map(c => [c.key, 1]))) && healthChecks(clean).length === 5, 'reserve fund / 10× ceiling / stock are not scored');

// 2. Dashboard uses it
const dash = read('pages/Dashboard.tsx');
ok(/scoreHealth\(healthInputs\)/.test(dash) && /complianceChecks\.checks\.map/.test(dash), 'Dashboard scores + shows tiles from src/lib/healthScore');
ok(!/maxPts|earned \+=/.test(dash), 'the old point table is gone');
ok(!/reserveFundPct \?\? 25/.test(dash) && !/stockOk,\s*\n\s*na: false/.test(dash), 'no "25% reserve fund" / always-pass stock tile on the Dashboard');
ok(/स्कोर में गिना जाता है/.test(dash), 'the card says what the score counts');

// 3. Member phone
const mem = read('pages/Members.tsx');
ok(!/if \(!form\.name \|\| !form\.phone\)/.test(mem) && !/placeholder="9876543210" required/.test(mem), 'phone no longer mandatory');
const mv = read('lib/memberValidation.ts');
ok(/memberPhoneError\(phone, hi\)/.test(mem) && /MOBILE_RE\.test\(v\)/.test(mv) && /\/\^\(\\d\)\\1\{9\}\$\//.test(mv), 'a given phone must be a 10-digit mobile, and not one digit ×10 (shared lib/memberValidation)');
const app = read('pages/MemberApplication.tsx');
ok(/memberPhoneError\(form\.phone, hiLang\)/.test(app) && /memberNomineeError\(form\.nomineeName/.test(app), 'the Member Application form enforces the same phone + nominee rules');
ok(/\(m\.phone \|\| ''\)\.includes\(searchQuery\)/.test(mem), 'search survives a member without a phone');
ok(/form\.phone \|\| ''\)\.trim\(\) !== \(editMember\.phone/.test(mem), 'edit checks the phone only when it changed (old numbers never block an edit)');

// 4. Login claims
const login = read('pages/Login.tsx');
ok(!/500\+|10,000\+|99\.9%/.test(login), 'login page: no "500+ समितियां / 10,000+ सदस्य / 99.9% अपटाइम"');
ok(!/सहकारी विपणन समितियों के लिए/.test(login), 'tagline is for all cooperative societies, not only marketing');

console.log(`Health score + founder decisions: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

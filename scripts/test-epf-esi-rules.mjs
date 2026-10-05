// PF / ESI statutory parameters as effective-dated data (lib/rules/epfEsi.ts). What this guards:
//  - the structure is the discipline (dated rows, newest first, no overlap, never defaulted to today);
//  - nothing is marked verified without a cited URL — `verified` is a claim about a PERSON, so no row may flip it quietly;
//  - the carried-over values are exactly what the code used before (this change moved numbers, it did not decide any);
//  - the REPORTED ₹25,000 PF ceiling is NOT in the table (its primary text was never read) — and adding it later is
//    a data row, not a code change (proved below).
//
// Run: node scripts/test-epf-esi-rules.mjs   (npm run test:epf-esi-rules)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let R;
try { R = await import(abs('../src/lib/rules/epfEsi.ts')); } catch (e) { console.error('import failed:', e.message); process.exit(1); }

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.error('  ✗ FAIL:', m); } };
const keys = Object.keys(R.PARAMS);

console.log('\n1. the carried-over values are EXACTLY what the code used before (this moved numbers, it decided none)');
{
  const b = R.resolveStatutory('2026-10-01');
  ok(b.pfWageCeiling === 15000, 'PF wage ceiling ₹15,000');
  ok(b.pfEmployeeRate === 12 && b.pfEmployerRate === 13, 'PF employee 12%, employer 13% (12% + 1% admin/EDLI)');
  ok(b.esiWageLimit === 21000, 'ESI limit ₹21,000');
  ok(b.esiEmployeeRate === 0.75 && b.esiEmployerRate === 3.25, 'ESI employee 0.75%, employer 3.25%');
  ok(R.resolveParam('epf.employerRate', '2026-10-01').value === 12, 'Payroll seed: employer EPF 12%');
  ok(R.resolveParam('eps.rate', '2026-10-01').value === 8.33, 'Payroll seed: EPS 8.33%');
  ok(R.resolveParam('edli.rate', '2026-10-01').value === 0.5, 'Payroll seed: EDLI 0.5%');
  ok(R.resolveParam('pf.wageCeiling', '2026-10-01').value !== 25000, 'the REPORTED ₹25,000 ceiling is NOT entered (primary text never read)');
}

console.log('\n2. nothing is verified without a cited URL (verified is a claim about a PERSON)');
{
  let bad = [];
  for (const k of keys) for (const row of R.PARAMS[k]) {
    if (row.verified && !/https?:\/\//.test(row.cite)) bad.push(k);
    if (!row.cite || row.cite.trim().length < 20) bad.push(k + ' (no cite)');
  }
  ok(bad.length === 0, 'every row has a cite, and a verified row cites a URL' + (bad.length ? ' — offenders: ' + bad.join(', ') : ''));
  ok(keys.every((k) => R.PARAMS[k].every((r) => r.verified === false)), 'TODAY no row is verified (nobody has signed any off)');
  const b = R.resolveStatutory('2026-10-01');
  ok(b.unverified.length === keys.length, `resolveStatutory reports all ${keys.length} parameters as unverified`);
}

console.log('\n3. structure invariants (dated rows, newest first, never overwritten)');
{
  for (const k of keys) {
    const rows = R.PARAMS[k];
    const desc = rows.every((r, i) => i === 0 || Date.parse(rows[i - 1].effectiveFrom) > Date.parse(r.effectiveFrom));
    ok(desc, `${k}: rows are strictly newest-first`);
    ok(rows.every((r) => !Number.isNaN(Date.parse(r.effectiveFrom)) && Number.isFinite(r.value) && r.value >= 0), `${k}: valid dates, finite non-negative values`);
  }
}

console.log('\n4. the date is REQUIRED and never defaulted — before the oldest row the answer is flagged stale, not invented');
{
  ok(R.resolveParam('esi.wageLimit', '2016-12-31').stale === true, 'ESI limit before 2017-01-01 (its established start) ⇒ stale');
  ok(R.resolveParam('esi.wageLimit', '2017-01-01').stale === false, 'ESI limit on 2017-01-01 ⇒ in force');
  ok(R.resolveParam('pf.wageCeiling', 'not-a-date').stale === true, 'an unreadable date ⇒ stale (never silently today)');
  ok(R.resolveStatutory('2016-01-01').stale.includes('esi.wageLimit'), 'resolveStatutory lists the stale key');
  ok(R.resolveStatutory('2026-10-01').stale.length === 0, 'an ordinary month has nothing stale');
  ok(R.resolveParam('pf.wageCeiling', '2000-01-01').stale === false, 'carried-over rows start 1970-01-01, so no realistic month is stale');
}

console.log('\n5. a law change is a DATA row, not a code change (shown on a copy — the real table is not touched)');
{
  const real = R.PARAMS['pf.wageCeiling'];
  const before = real.length;
  // what appending the notification would do — on a throw-away copy, through the REAL resolver (resolveRows)
  const withNew = [{ value: 25000, effectiveFrom: '2026-09-17', verified: false, cite: 'EXAMPLE ONLY — not a real entry' }, ...real];
  const at = (asOf) => R.resolveRows(withNew, asOf).value;
  ok(at('2026-09-16') === 15000, 'a slip for 2026-09-16 would still be priced on ₹15,000');
  ok(at('2026-09-17') === 25000 && at('2026-10-01') === 25000, 'from the new date the new row applies');
  ok(R.resolveRows(withNew, '2026-10-01').row.cite.startsWith('EXAMPLE ONLY'), 'and it reports the new row\'s own cite');
  ok(R.PARAMS['pf.wageCeiling'].length === before, 'the real table was not modified');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

// PF / ESI statutory parameters as effective-dated data (lib/rules/epfEsi.ts). What this guards:
//  - the structure is the discipline (dated rows, newest first, no overlap, never defaulted to today);
//  - nothing is marked verified without a cited URL — `verified` is a claim about a PERSON, so no row may flip it quietly;
//  - the carried-over values are exactly what the code used before (this change moved numbers, it did not decide any);
//  - the EPFO ceiling revision (S.O. 5109(E), ₹15,000 → ₹25,000 from 2026-09-17) is a DATED ROW with the document it was read
//    from — still `verified: false` until a person confirms it against the Gazette text; a change inside a month is split by days.
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
  ok(R.resolveStatutory('2026-08-01').pfWageCeiling === 15000, 'PF wage ceiling ₹15,000 for a month before the EPFO revision (2026-08)');
  ok(b.pfWageCeiling === 25000, 'PF wage ceiling ₹25,000 from the revision (2026-10), per EPFO FAQ on S.O. 5109(E)');
  ok(b.pfEmployeeRate === 12 && b.pfEmployerRate === 13, 'PF employee 12%, employer 13% (12% + 1% admin/EDLI)');
  ok(b.esiWageLimit === 21000, 'ESI limit ₹21,000');
  ok(b.esiEmployeeRate === 0.75 && b.esiEmployerRate === 3.25, 'ESI employee 0.75%, employer 3.25%');
  ok(R.resolveParam('epf.employerRate', '2026-10-01').value === 12, 'Payroll seed: employer EPF 12%');
  ok(R.resolveParam('eps.rate', '2026-10-01').value === 8.33, 'Payroll seed: EPS 8.33%');
  ok(R.resolveParam('edli.rate', '2026-10-01').value === 0.5, 'Payroll seed: EDLI 0.5%');
  const row = R.PARAMS['pf.wageCeiling'][0];
  ok(row.value === 25000 && row.effectiveFrom === '2026-09-17', 'the ₹25,000 row takes effect on 2026-09-17');
  ok(row.verified === false, 'it is still NOT marked verified (the Gazette text of S.O. 5109(E) has not been read by a person)');
  ok(/S\.O\. 5109\(E\)/.test(row.cite) && /sha256 12e6074f/.test(row.cite) && /Gazette text/.test(row.cite), 'its cite names the notification, the exact file read (sha256) and what is still unread');
  ok(R.PARAMS['pf.wageCeiling'].length === 2 && R.PARAMS['pf.wageCeiling'][1].value === 15000, 'the old ₹15,000 row is kept — a slip for an older month still gets its own law');
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
  ok(b.unverified.length === keys.length && keys.length === 10, `resolveStatutory reports all ${keys.length} parameters as unverified`);
  ok(R.PARAMS['esi.employeeRate'][0].cite.includes('sha256 f63e11d8') && /see esi.employeeRate/.test(R.PARAMS['esi.employerRate'][0].cite) && R.PARAMS['esi.dailyWageExempt'][0].value === 176, 'the ESI rows cite the ESIC guide (sha256) and the ₹176 daily-wage exemption is recorded');
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
  // a hypothetical NEXT revision, appended to a throw-away copy and resolved by the REAL resolver (resolveRows)
  const withNext = [{ value: 30000, effectiveFrom: '2027-04-01', verified: false, cite: 'EXAMPLE ONLY — not a real entry' }, ...real];
  const at = (asOf) => R.resolveRows(withNext, asOf).value;
  ok(at('2027-03-31') === 25000, 'a slip for 2027-03 would still be priced on ₹25,000');
  ok(at('2027-04-01') === 30000 && at('2028-01-01') === 30000, 'from the new date the new row applies');
  ok(at('2026-08-01') === 15000, 'and a slip for 2026-08 is still on ₹15,000');
  ok(R.resolveRows(withNext, '2027-06-01').row.cite.startsWith('EXAMPLE ONLY'), "and it reports the new row's own cite");
  ok(R.PARAMS['pf.wageCeiling'].length === before, 'the real table was not modified');
}

console.log('\n6. a change INSIDE a month is split by days (EPFO, 17 September 2026)');
{
  const seg = R.resolveMonthSegments('pf.wageCeiling', '2026-09-01');
  ok(seg.length === 2, 'September 2026 has two periods');
  ok(seg[0].from === '2026-09-01' && seg[0].to === '2026-09-16' && seg[0].days === 16 && seg[0].value === 15000, '1–16 September: 16 days on ₹15,000');
  ok(seg[1].from === '2026-09-17' && seg[1].to === '2026-09-30' && seg[1].days === 14 && seg[1].value === 25000, '17–30 September: 14 days on ₹25,000');
  ok(seg.reduce((n, g) => n + g.days, 0) === 30, 'the periods add up to the 30 days of September');
  for (const m of ['2026-08-01', '2026-10-01', '2027-01-01']) ok(R.resolveMonthSegments('pf.wageCeiling', m).length === 1, `${m}: one period (nothing changes inside it)`);
  ok(R.resolveMonthSegments('esi.wageLimit', '2026-09-01').length === 1, 'a parameter that did not change that month is a single period');
  ok(R.resolveMonthSegments('pf.wageCeiling', 'garbage')[0].stale === true && R.resolveMonthSegments('pf.wageCeiling', undefined)[0].stale === true, 'an unreadable or missing month is one stale period — it never throws and never becomes today');
  ok(R.daysInMonthOf('2028-02-01') === 29 && R.daysInMonthOf('2026-02-01') === 28 && Number.isNaN(R.daysInMonthOf('x')), 'days in month: leap year, ordinary February, unreadable');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

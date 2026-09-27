// Audit Schedules — statutory section notes and limits must match the Act / Rules TEXT.
// Haryana Co-operative Societies Act 1984: s.87(1)(a) reserve fund + bad & doubtful debt fund
// (at least 10% each), s.87(1)(b) co-operative education fund (≤5%); s.65 is "Limitation of
// interest", not the reserve fund. The limits line is ONE function for screen and PDF (RULE 2).
// Run: node scripts/test-audit-schedule-cites.mjs
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const F = await imp('src/lib/stateAuditFormats.ts');
const L = await imp('src/lib/rules/statutoryLimits.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const items = (fmt) => fmt.schedules.flatMap((s) => s.lineItems);
const hr = F.getStateAuditFormat('hr');
const note = (id) => items(hr).find((i) => i.id === id)?.note;
ok(note('II-1') === 'Sec 87(1)(a)' && note('II-5') === 'Sec 87(1)(a)', 'Haryana: reserve fund and bad debt fund → s.87(1)(a)');
ok(note('II-3') === 'Sec 87(1)(b)', 'Haryana: education fund → s.87(1)(b)');
ok(!items(hr).some((i) => /Sec 65/.test(i.note || '')), 'no line cites s.65 (Limitation of interest) as a fund section');
ok(note('II-9') === undefined, 'Cooperative Dev Fund: no unsourced section note');
const pb = F.getStateAuditFormat('pb');
ok(pb.actName.startsWith('Punjab') && !items(pb).some((i) => i.note), 'Punjab reuses the line items but shows NO Haryana section numbers');
ok(items(pb).length === items(hr).length && note('II-1') === 'Sec 87(1)(a)', 'Haryana schedule not mutated by the Punjab copy');

const today = '2026-09-27';
const hrLine = L.scheduleLimitsLine({ reserveFundPct: 25 }, L.statutoryLimits('hr', today), hr, false, ' | ');
ok(hrLine === 'Reserve Fund: 25% | Minimum reserve 10% | Bad & doubtful debt fund at least 10% | Education Fund at most 2%', `Haryana limits line = the checked figures (${hrLine})`);
ok(!/Coop Dev/.test(hrLine), 'Haryana: the unsourced "Coop Dev Fund 3%" is not shown');
const hrHi = L.scheduleLimitsLine({}, L.statutoryLimits('hr', today), hr, true);
ok(/न्यूनतम संचय 10%/.test(hrHi) && /शिक्षा फंड अधिकतम 2%/.test(hrHi) && /रिज़र्व फंड: 25%/.test(hrHi), 'Hindi line (society reserve % defaults to 25)');
const other = L.statutoryLimits('mh', today);
if (!L.hasVerifiedLimits(other)) {
  const mh = L.scheduleLimitsLine({ reserveFundPct: 25 }, other, F.getStateAuditFormat('mh'), false);
  ok(/Education Fund: \d+%/.test(mh) && /Coop Dev Fund: \d+%/.test(mh), 'a state without checked figures keeps its format defaults, as before');
} else ok(true, 'mh has checked figures');

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
ok(/scheduleLimitsLine\(society, limits, format, hi\)/.test(read('src/pages/AuditSchedules.tsx')), 'screen uses the shared line');
ok(/scheduleLimitsLine\(society, statutoryLimits\(society\.state, /.test(read('src/lib/pdf.ts')) && !/Coop Dev Fund: \$\{format\.coopDevFundPct\}/.test(read('src/lib/pdf.ts')), 'PDF uses the same line (no hard-coded percentages)');

console.log(`Audit schedule cites: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

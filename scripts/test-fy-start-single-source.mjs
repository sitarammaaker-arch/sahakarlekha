#!/usr/bin/env node
// FY start has ONE source: societyFyStart() in src/lib/fyPeriod.ts.
// society_settings."financialYearStart" held two meanings — an ISO date (Register) and the WORD 'april'
// (Society Setup's old "वर्ष प्रारंभ" select; 8 of 32 prod societies on 2026-10-20). Reading it raw made
// '2026-05-01' < 'april' and every voucher toasted "date outside FY", default "from" dates became 'april'.
// Run: node scripts/test-fy-start-single-source.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

// 1. Every known read site goes through the helper.
const SITES = [
  'src/contexts/DataContext.tsx',
  'src/pages/DayBook.tsx',
  'src/pages/AgingAnalysis.tsx',
  'src/pages/consumer/Patronage.tsx',
  'src/pages/dairy/DairyDistribution.tsx',
  'src/pages/KachiAaratRegister.tsx',
  'src/pages/RecoverablesRegister.tsx',
  'src/pages/SocietySetup.tsx',
];
for (const f of SITES) {
  const src = read(f);
  ok(`${f} imports societyFyStart from lib/fyPeriod`, /import\s*\{[^}]*\bsocietyFyStart\b[^}]*\}\s*from\s*'@\/lib\/fyPeriod'/.test(src));
  ok(`${f} calls societyFyStart(`, /\bsocietyFyStart\(/.test(stripComments(src).replace(/import[^\n]*\n/g, '')));
}
const dc = stripComments(read('src/contexts/DataContext.tsx'));
ok('addVoucher FY-range warning uses societyFyStart', /const fyStart = societyFyStart\(society\);/.test(dc));

// 2. Nowhere in src/ reads .financialYearStart raw — except inside a societyFyStart(...) call or a hook deps array.
//    UniversalImporter is PR #793's file (it derives the start from the label itself); switch it to the helper there.
const ALLOW_FILES = new Set(['src/lib/fyPeriod.ts', 'src/pages/UniversalImporter.tsx']);
const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
});
const offenders = [];
for (const abs of walk(resolve(root, 'src'))) {
  const rel = relative(root, abs).replace(/\\/g, '/');
  if (ALLOW_FILES.has(rel)) continue;
  stripComments(readFileSync(abs, 'utf8')).split('\n').forEach((line, i) => {
    if (!/\.financialYearStart\b/.test(line)) return;
    if (/societyFyStart\(/.test(line)) return;          // passed to the helper
    if (/^\s*\}?\s*,?\s*\[[^\]]*\]\s*\)?;?\s*$/.test(line) || /\}\)?, \[/.test(line)) return; // useMemo/useEffect deps
    offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
  });
}
ok(`no raw .financialYearStart reads in src/ (found: ${offenders.join(' | ') || 'none'})`, offenders.length === 0);

// 3. The writer: Society Setup stores an ISO date derived from the label, never a month word.
const setup = read('src/pages/SocietySetup.tsx');
ok('Setup has no "april" / "january" option any more', !/value="april"|value="january"/.test(setup));
ok('Setup FY save writes financialYearStart from fyStartFromLabel', /const financialYearStart = fyStartFromLabel\(fyForm\.financialYear\);/.test(setup)
  && /updateSociety\(\{ financialYear: fyForm\.financialYear, financialYearStart \}/.test(setup));
ok('Register still writes an ISO 1 April', /financialYearStart: financialYear\.split\('-'\)\[0\] \+ '-04-01'/.test(read('src/pages/Register.tsx')));

console.log(`\nfy-start-single-source: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

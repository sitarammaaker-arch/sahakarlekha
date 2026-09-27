// Professional Tax by state (ECR-14) — imports the REAL src/lib/professionalTax.ts (via the '@/'
// loader) so this validates the actual code. (Was a self-contained mirror before.)
// Run: node scripts/test-professional-tax.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const { resolveStateKey, professionalTax, professionalTaxForState, ptAutoFill, PT_SLAB_SOURCES } = await import(abs('../src/lib/professionalTax.ts'));
const { INDIAN_STATES } = await import(abs('../src/lib/constants.ts'));
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. State resolution (English + Hindi + case/space tolerant).
ok(resolveStateKey('Maharashtra') === 'maharashtra', 'English state resolves');
ok(resolveStateKey('महाराष्ट्र') === 'maharashtra', 'Hindi state resolves');
ok(resolveStateKey('  west BENGAL ') === 'westbengal', 'case/space tolerant');
ok(resolveStateKey('Haryana') === 'none' && resolveStateKey('राजस्थान') === 'none', 'no-PT states → none');
ok(resolveStateKey(undefined) === 'none', 'undefined → none');

// 2. Maharashtra slabs.
ok(professionalTax(7000, 'maharashtra') === 0, 'MH ≤7500 → 0');
ok(professionalTax(9000, 'maharashtra') === 175, 'MH 7501-10000 → 175');
ok(professionalTax(20000, 'maharashtra') === 200, 'MH >10000 → 200');

// 3. Karnataka: nil below 25000, else 200.
ok(professionalTax(24000, 'karnataka') === 0 && professionalTax(30000, 'karnataka') === 200, 'Karnataka slab');

// 4. West Bengal graduated slabs.
ok(professionalTax(9000, 'westbengal') === 0, 'WB ≤10000 → 0');
ok(professionalTax(12000, 'westbengal') === 110 && professionalTax(20000, 'westbengal') === 130 && professionalTax(50000, 'westbengal') === 200, 'WB graduated');

// 5. No-PT state → always 0.
ok(professionalTaxForState(100000, 'Haryana') === 0, 'no-PT state → 0 regardless of salary');

// 6. End-to-end via state string.
ok(professionalTaxForState(20000, 'Maharashtra') === 200, 'end-to-end MH');
ok(professionalTaxForState(20000, 'गुजरात') === 200 && professionalTaxForState(9000, 'गुजरात') === 0, 'Gujarat via Hindi');

// 7. RM-22 — society_settings.state is the INDIAN_STATES CODE ('mh'), not the name.
const CODE_KEYS = { mh: 'maharashtra', ka: 'karnataka', wb: 'westbengal', mp: 'madhyapradesh', gj: 'gujarat', ap: 'andhra', tg: 'telangana', tn: 'tamilnadu' };
for (const { value } of INDIAN_STATES) {
  const want = CODE_KEYS[value] || 'none';
  ok(resolveStateKey(value) === want, `state code '${value}' → ${want}`);
}
ok(resolveStateKey(' MH ') === 'maharashtra', 'code is case/space tolerant');
ok(resolveStateKey('hr') === 'none', "Haryana code 'hr' → none");

// 8. RM-22 decision A — only a SOURCED slab auto-fills.
ok(Object.keys(PT_SLAB_SOURCES).length === 0, 'no slab is marked sourced yet');
const mh = ptAutoFill(20000, 'mh');
ok(mh.stateKey === 'maharashtra' && mh.levies && !mh.verified && mh.amount === 0, 'unsourced PT state → levies, unverified, auto-fills ₹0');
const hr = ptAutoFill(20000, 'hr');
ok(!hr.levies && !hr.verified && hr.amount === 0, 'no-PT state → no notice, ₹0');
PT_SLAB_SOURCES.maharashtra = 'https://example.test/mh-pt-act';
const mhSourced = ptAutoFill(20000, 'mh');
ok(mhSourced.verified && mhSourced.amount === 200, 'once a source is recorded, the slab auto-fills');
delete PT_SLAB_SOURCES.maharashtra;

// 9. SalaryManagement starts rows from ptAutoFill (never the raw unsourced slab) and warns.
const sm = readFileSync(pathResolve(HERE, '../src/pages/SalaryManagement.tsx'), 'utf8');
ok(/pt: ptAutoFill\(emp\.basicSalary, society\.state\)\.amount/.test(sm), 'salary rows start PT from ptAutoFill');
ok(!/professionalTaxForState\(/.test(sm), 'SalaryManagement no longer auto-fills the raw slab');
ok(/const ptNotice = ptState\.levies && !ptState\.verified/.test(sm) && /\{ptNotice && \(/.test(sm), 'unverified-PT notice is shown');

console.log(`\nProfessional tax (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

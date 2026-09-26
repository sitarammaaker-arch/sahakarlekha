// Member distribution engine (patronage / dividend) — step 1 of "patronage for all societies".
// Consumer and dairy now delegate to lib/distribution/engine.ts. This proves the move changed
// NOTHING: every exported function is compared against a VERBATIM copy of the pre-engine code
// (scripts/fixtures/legacy-*.ts) on hand cases + thousands of randomised fixtures, including
// awkward values (3-decimal amounts, negative net purchases, exited members, rejected milk).
// Run: node scripts/test-distribution-engine.mjs
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const SRC = pathResolve(ROOT, 'src');
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
const imp = (rel) => import(pathToFileURL(pathResolve(ROOT, rel)).href);
const newC = await imp('src/lib/consumer/patronage.ts');
const newD = await imp('src/lib/dairy/distribution.ts');
const oldC = await imp('scripts/fixtures/legacy-consumer-patronage.ts');
const oldD = await imp('scripts/fixtures/legacy-dairy-distribution.ts');
const engine = await imp('src/lib/distribution/engine.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── Randomised parity ──
let seed = 20260926;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const money = () => pick([0, 0.005, 0.1, 1.234, 99.999, 1000, 2500.555, Math.round(rnd() * 1e6) / 1000]);
const names = ['राम', 'Sita', 'mohan', 'Zed', 'आशा', 'Bina', 'bina'];
const statuses = [undefined, 'active', 'inactive', 'resigned', 'expelled', 'deceased'];
const dates = ['2026-03-31', '2026-04-01', '2026-06-15', '2026-12-31', '2027-03-31', '2027-04-01'];

let diverged = 0;
const N = 1500;
for (let t = 0; t < N; t++) {
  const members = Array.from({ length: 1 + Math.floor(rnd() * 6) }, (_, i) => ({ id: `m${i}`, name: pick(names), status: pick(statuses), shareCapital: rnd() < 0.2 ? undefined : money() }));
  const ids = [...members.map((m) => m.id), 'ghost', undefined];
  const sales = Array.from({ length: Math.floor(rnd() * 10) }, () => ({ memberId: pick(ids), date: pick(dates), grandTotal: rnd() < 0.3 ? 0 : money(), netAmount: money() }));
  const returns = Array.from({ length: Math.floor(rnd() * 4) }, () => ({ memberId: pick(ids), date: pick(dates), grandTotal: money() * 3, isDeleted: rnd() < 0.2 }));
  const args = { from: '2026-04-01', to: '2027-03-31', ratePct: pick([0, 1, 2.5, 7.333, 12, -1]) };
  const entries = Array.from({ length: Math.floor(rnd() * 12) }, () => ({ date: pick(dates), memberId: pick(members.map((m) => m.id)), memberName: pick(names), qty: money(), amount: money(), qualityDecision: pick([undefined, 'accepted', 'rejected']) }));
  const basis = pick(['per_litre', 'per_value']);
  const rate = pick([0, 0.5, 1.25, 0.033, 2]);
  const checks = [
    ['consumer patronage', newC.computePatronageLines(sales, members, args, returns), oldC.computePatronageLines(sales, members, args, returns)],
    ['consumer dividend', newC.computeDividendLines(members, args.ratePct), oldC.computeDividendLines(members, args.ratePct)],
    ['dairy bonus', newD.computeBonusLines(entries, args.from, args.to, basis, rate), oldD.computeBonusLines(entries, args.from, args.to, basis, rate)],
    ['dairy dividend', newD.computeDividendLines(members, args.ratePct), oldD.computeDividendLines(members, args.ratePct)],
  ];
  for (const [name, a, b] of checks) {
    if (!same(a, b)) { diverged++; if (diverged <= 3) ok(false, `fixture #${t} ${name}: new ${JSON.stringify(a).slice(0, 160)} ≠ legacy ${JSON.stringify(b).slice(0, 160)}`); }
    // totals + legs + outstanding on the same lines
    if (!same(newC.patronageTotal(a), oldC.patronageTotal(b)) || !same(newD.distributionTotal(a), oldD.distributionTotal(b))) { diverged++; ok(false, `fixture #${t} ${name}: totals differ`); }
  }
  const total = money() * 10, paid = money() * 5;
  for (const [x, y] of [['A', 'B'], ['', 'B'], ['A', '']]) {
    if (!same(newC.patronageLegs(total, x, y), oldC.patronageLegs(total, x, y)) || !same(newD.distributionLegs(total, x, y), oldD.distributionLegs(total, x, y))) { diverged++; ok(false, `fixture #${t}: legs differ`); }
  }
  if (newC.patronageOutstanding(total, paid) !== oldC.patronageOutstanding(total, paid) || newD.distributionOutstanding(total, paid) !== oldD.distributionOutstanding(total, paid)) { diverged++; ok(false, `fixture #${t}: outstanding differs`); }
}
ok(diverged === 0, `${N} randomised fixtures × 4 line functions + totals + legs + outstanding: identical to the pre-engine code`);

// ── The two engines kept their (different) rounding choices ──
const odd = [{ id: 'm1', name: 'A', shareCapital: 100.005 }];
ok(same(newC.computeDividendLines(odd, 10), oldC.computeDividendLines(odd, 10)) && same(newD.computeDividendLines(odd, 10), oldD.computeDividendLines(odd, 10)), 'sub-paise share capital: each vertical keeps its own rounding (no silent change)');

// ── Engine primitives ──
ok(engine.activeMembers([{ status: 'active' }, {}, { status: 'resigned' }, { status: 'inactive' }]).length === 2, 'activeMembers: no status or active only');
ok(same(engine.linesFromBases([{ memberId: 'b', memberName: 'B', base: 2 }, { memberId: 'a', memberName: 'A', base: 1 }, { memberId: 'z', memberName: 'Z', base: 0 }], (x) => x * 10), [{ memberId: 'a', memberName: 'A', base: 1, amount: 10 }, { memberId: 'b', memberName: 'B', base: 2, amount: 20 }]), 'linesFromBases: rounds, drops zero lines, sorts by name');
ok(same(engine.appropriationLegs(0, 'A', 'B'), []) && engine.appropriationLegs(10.005, 'A', 'B')[0].amount === 10.01, 'appropriationLegs: [] for zero; rounded total');

// ── Static: verticals hold only their basis; no duplicated line logic left ──
const strip = (f) => readFileSync(pathResolve(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
for (const f of ['src/lib/consumer/patronage.ts', 'src/lib/dairy/distribution.ts']) {
  const s = strip(f);
  ok(/from '\.\.\/distribution\/engine'/.test(s), `${f} delegates to the shared engine`);
  ok(!/\.filter\(l => l\.amount > 0\)/.test(s) && !/localeCompare/.test(s) && !/type: 'Dr'/.test(s), `${f} has no duplicated line/sort/legs logic`);
}

console.log(`distribution engine: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

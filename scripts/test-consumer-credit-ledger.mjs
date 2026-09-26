// Consumer member credit LEDGER — one function (memberCreditLedger) for the staff Member Credit page
// and the member portal. The bug it fixes: the staff page hand-built its ledger from sales +
// recoveries only, so a credit-adjusted sales return made the ledger end ₹49 above Outstanding
// (₹200 vs ₹151 for M001 Sumit, Demo Consumer Society, 2026-09-26). RULE 2: the ledger's last
// balance must equal memberOutstanding whenever the member is not over-recovered.
// Run: node scripts/test-consumer-credit-ledger.mjs
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
const { memberCreditLedger, memberOutstanding } = await imp('src/lib/consumer/credit.ts');
const { buildVerticalViews } = await imp('src/lib/memberPortalVerticals.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const M = 'm1';

// ── The real case: sale 245, recovery 45, credit-adjusted return 49 ⇒ 151 ──
const sales = [{ id: 's1', saleNo: 'SL/2026-27/002', memberId: M, paymentMode: 'credit', date: '2026-07-04', grandTotal: 245, netAmount: 230 }];
const recs = [{ id: 'r1', date: '2026-07-04', ref: 'RV/2026/27/396', memberId: M, amount: 45 }];
const rets = [{ id: 'x1', date: '2026-07-10', ref: 'SR/1', memberId: M, grandTotal: 49, refundMode: 'credit-adjust' }];
const led = memberCreditLedger(sales, recs, rets, M);
ok(led.length === 3, 'sale + recovery + return rows');
ok(led.map((r) => r.kind).join() === 'sale,recovery,return', 'chronological; same-day sale before recovery');
ok(led.map((r) => r.balance).join() === '245,200,151', `running balance 245 → 200 → 151 (got ${led.map((r) => r.balance)})`);
ok(led[2].balance === memberOutstanding(sales, recs, M, rets), 'final balance === memberOutstanding (the page\'s Outstanding card)');
ok(led[1].recoveryId === 'r1' && led[0].recoveryId === undefined && led[2].recoveryId === undefined, 'only recovery rows carry recoveryId (reversible on the staff page)');

// ── Exclusions mirror memberOutstanding exactly ──
const noise = memberCreditLedger(
  [...sales, { id: 's2', memberId: M, paymentMode: 'cash', date: '2026-07-05', grandTotal: 999, netAmount: 999 }, { id: 's3', memberId: 'other', paymentMode: 'credit', date: '2026-07-05', grandTotal: 500, netAmount: 500 }],
  [...recs, { id: 'r2', date: '2026-07-06', memberId: M, amount: 20, isDeleted: true }, { id: 'r3', date: '2026-07-06', memberId: 'other', amount: 20 }],
  [...rets, { id: 'x2', date: '2026-07-11', memberId: M, grandTotal: 10, refundMode: 'cash' }, { id: 'x3', date: '2026-07-11', memberId: M, grandTotal: 10, refundMode: 'credit-adjust', isDeleted: true }],
  M,
);
ok(noise.length === 3 && noise[2].balance === 151, 'cash sales, other members, deleted recoveries, cash-refund and deleted returns all excluded');
ok(memberCreditLedger([{ id: 'z', memberId: M, paymentMode: 'credit', date: '2026-01-01', grandTotal: 0, netAmount: 80 }], [], [], M)[0].dr === 80, 'grandTotal 0 falls back to netAmount (same saleTotal rule)');

// ── Randomised parity: last balance === memberOutstanding whenever not over-recovered ──
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rnd() * a.length)];
let checked = 0;
for (let t = 0; t < 400; t++) {
  const d = () => `2026-0${1 + Math.floor(rnd() * 9)}-1${Math.floor(rnd() * 9)}`;
  const S = Array.from({ length: Math.floor(rnd() * 6) }, (_, i) => ({ id: `s${i}`, saleNo: `S${i}`, memberId: pick([M, 'o']), paymentMode: pick(['credit', 'credit', 'cash']), date: d(), grandTotal: Math.round(rnd() * 100000) / 100, netAmount: Math.round(rnd() * 90000) / 100 }));
  const R = Array.from({ length: Math.floor(rnd() * 4) }, (_, i) => ({ id: `r${i}`, date: d(), memberId: pick([M, 'o']), amount: Math.round(rnd() * 30000) / 100, isDeleted: rnd() < 0.2 }));
  const X = Array.from({ length: Math.floor(rnd() * 3) }, (_, i) => ({ id: `x${i}`, date: d(), memberId: pick([M, 'o']), grandTotal: Math.round(rnd() * 20000) / 100, refundMode: pick(['credit-adjust', 'cash']), isDeleted: rnd() < 0.2 }));
  const L = memberCreditLedger(S, R, X, M);
  const out = memberOutstanding(S, R, M, X);
  const last = L.length ? L[L.length - 1].balance : 0;
  if (last >= 0) { checked++; if (Math.abs(last - out) > 0.005) { ok(false, `fixture #${t}: ledger ${last} ≠ outstanding ${out}`); break; } }
  else ok(out === 0, `over-recovered fixture #${t}: outstanding clamps to 0`);
}
ok(checked > 200, `randomised parity held on ${checked} fixtures`);

// ── The portal shows the SAME ledger ──
const view = buildVerticalViews(M, {
  creditSales: sales.map((s) => ({ ...s, grandTotal: String(s.grandTotal), netAmount: String(s.netAmount) })),
  creditRecoveries: [{ id: 'r1', voucherNo: 'RV/2026/27/396', date: '2026-07-04', memberId: M, amount: '45' }],
  creditReturns: [{ id: 'x1', returnNo: 'SR/1', date: '2026-07-10', memberId: M, grandTotal: '49', refundMode: 'credit-adjust' }],
}, '2026-09-26');
ok(JSON.stringify(view.consumer.ledger) === JSON.stringify(led), 'portal ledger === staff ledger for the same rows (incl. string numerics)');
ok(view.consumer.outstanding === 151 && view.consumer.ledger.at(-1).balance === 151, 'portal: ledger ends at the Outstanding figure');

// ── Static guards ──
const strip = (f) => readFileSync(pathResolve(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const page = strip('src/pages/consumer/MemberCredit.tsx');
ok(/memberCreditLedger\(/.test(page) && /salesReturns\.map/.test(page), 'staff Member Credit page uses memberCreditLedger incl. returns');
ok(!/rows\.push\(/.test(page), 'no hand-built ledger left on the staff page');
const ui = strip('src/components/member-portal/PortalVerticals.tsx');
ok(/consumer\.ledger\.map/.test(ui), 'portal renders the shared ledger');
ok(/'Patronage rebate'/.test(ui) && /'दुकान से बँटवारा — छूट \/ लाभांश \(स्वीकृत\)'/.test(ui), 'consumer heading + English patronage label');
const portal = strip('src/components/member-portal/MemberAccountView.tsx'); // shared by portal + staff Member-360
ok(/addEventListener\('beforeprint'/.test(portal) && /addEventListener\('afterprint'/.test(portal), 'print opens collapsed sections and restores them (shared MemberAccountView)');

console.log(`consumer credit ledger: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

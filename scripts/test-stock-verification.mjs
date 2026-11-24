// Physical stock verification (HAFED Accounts Manual 1976, para 10.20, Annexure XV/1).
// Imports the REAL src/lib/stockVerification.ts via the "@/" loader.
// Run: node scripts/test-stock-verification.mjs
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

const L = await import(abs('../src/lib/stockVerification.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const item = (id, o = {}) => ({ id, itemCode: id, name: `Item ${id}`, nameHi: `वस्तु ${id}`, unit: 'bag', openingStock: 0, purchaseRate: 0, isActive: true, ...o });
const items = [item('A', { openingStock: 10, purchaseRate: 100 }), item('B'), item('C', { isActive: false }), item('D', { isActive: false, openingStock: 2, purchaseRate: 50 })];
const mv = (o) => ({ id: Math.random().toString(36), date: '2026-05-01', referenceNo: '', narration: '', createdAt: '', rate: 0, amount: 0, ...o });
const reconciled = [
  mv({ itemId: 'A', type: 'purchase', qty: 10, rate: 120, amount: 1200, godownId: 'G1' }),
  mv({ itemId: 'A', type: 'sale', qty: 4, godownId: 'G1' }),
  mv({ itemId: 'B', type: 'purchase', qty: 5, rate: 40, amount: 200, godownId: 'G2' }),
];

// ── count sheet ──
const all = L.buildCountSheet({ items, reconciled });
ok(all.length === 3, `active items + inactive with stock (got ${all.map(r => r.itemId)})`);
ok(!all.some(r => r.itemId === 'C'), 'inactive item with no stock left out');
const a = all.find(r => r.itemId === 'A');
ok(a.bookQty === 16, `whole-society book = 10 opening + 10 − 4 = 16 (got ${a.bookQty})`);
ok(a.rate === 110, `average cost (10×100 + 10×120)/20 = 110 (got ${a.rate})`);
ok(all[0].bookQty > 0, 'items with stock listed first');
const g1 = L.buildCountSheet({ items, reconciled, godownId: 'G1' });
ok(g1.find(r => r.itemId === 'A').bookQty === 6, 'godown G1 book = 10 − 4 (opening sits unassigned)');
ok(g1.find(r => r.itemId === 'B').bookQty === 0, 'item B has nothing in G1');
ok(L.buildCountSheet({ items, reconciled, hi: true })[0].itemName.startsWith('वस्तु'), 'Hindi names');

// ── lines ──
const l1 = L.countLine(a, 15, 'shortageRecoverable', 'Ram');
ok(l1.diff === -1 && l1.value === 110 && l1.reason === 'shortageRecoverable' && l1.person === 'Ram', 'short by 1 at 110');
const l2 = L.countLine(a, 16, 'damage', 'Ram');
ok(l2.diff === 0 && l2.reason === undefined && l2.person === undefined, 'no difference → no reason or person kept');
const l3 = L.countLine(a, 17.5, 'excess', 'Ram');
ok(l3.diff === 1.5 && l3.value === 165 && l3.person === undefined, 'excess 1.5; person only for a recoverable shortage');

// ── validation ──
ok(L.validateCount({ verifiedBy: '', date: '2026-05-10', lines: [l2] }, false).length === 1, 'verifier required');
ok(L.validateCount({ verifiedBy: 'M', date: '2026-05-10', lines: [] }, false).length === 1, 'at least one line');
ok(L.validateCount({ verifiedBy: 'M', date: '2026-05-10', lines: [l1, l2, l3] }, false).length === 0, 'valid count');
ok(L.validateCount({ verifiedBy: 'M', date: '2026-05-10', lines: [L.countLine(a, 15)] }, false).length === 1, 'a difference needs a reason');
ok(L.validateCount({ verifiedBy: 'M', date: '2026-05-10', lines: [L.countLine(a, 15, 'excess')] }, false).length === 1, 'reason must fit the sign');
ok(L.validateCount({ verifiedBy: 'M', date: '2026-05-10', lines: [L.countLine(a, 15, 'shortageRecoverable', '')] }, false).length === 1, 'recoverable needs a person');
ok(L.validateCount({ verifiedBy: 'M', date: '2026-05-10', lines: [{ ...l2, physicalQty: -1 }] }, false).length === 1, 'negative count refused');

// ── numbering, status, certificate ──
ok(L.nextVerificationNo([]) === 'PV/1' && L.nextVerificationNo([{ verificationNo: 'PV/3' }, { verificationNo: 'PV/12' }]) === 'PV/13', 'numbering');
ok(L.statusAfterPosting([l2, { ...l1, posted: true }]) === 'complete', 'complete when every difference posted');
ok(L.statusAfterPosting([{ ...l1, posted: true }, { ...l3, posted: false }]) === 'partial', 'partial when one did not post');
const cert = L.certificateText({ verifiedBy: 'Ramesh', designation: 'Manager', date: '10/05/2026', place: 'Main godown', differences: 2 }, true);
ok(cert.includes('Ramesh (Manager)') && cert.includes('Main godown') && cert.includes('2 वस्तुओं'), 'Hindi certificate');
ok(L.certificateText({ verifiedBy: 'R', date: 'd', place: 'p', differences: 0 }, false).includes('agree'), 'no-difference certificate');
ok(cert.includes('Main godown के स्टॉक') && !cert.includes('godown गोदाम'), 'a name that already says godown is not doubled');
ok(L.certificateText({ verifiedBy: 'R', date: 'd', place: 'Sirsa', differences: 0 }, true).includes('Sirsa गोदाम के स्टॉक'), 'a bare name gets "गोदाम"');
const whole = L.certificateText({ verifiedBy: 'R', date: 'd', differences: 0 }, true);
ok(whole.includes('समिति के पूरे स्टॉक का') && !whole.includes('स्टॉक के स्टॉक'), 'whole-stock certificate reads "समिति के पूरे स्टॉक का"');
ok(L.certificateText({ verifiedBy: 'R', date: 'd', differences: 0 }, false).includes("the society's whole stock"), 'English whole-stock wording');

// ── overdue ──
const od = L.overdueCounts({
  verifications: [{ date: '2026-05-01', godownId: 'G1' }, { date: '2026-05-20', godownId: 'G1' }, { date: '2026-04-01', godownId: 'G2' }],
  places: [{ id: 'G1', name: 'One' }, { id: 'G2', name: 'Two' }, { id: 'G3', name: 'Three' }],
  today: '2026-05-25',
});
ok(od.length === 2 && od.find(p => p.id === 'G2').daysSince === 54 && od.find(p => p.id === 'G3').lastDate === null, 'G1 counted 5 days ago is fine; G2 old; G3 never');
ok(L.overdueCounts({ verifications: [{ date: '2026-05-20' }], places: [{ id: L.ALL_STOCK, name: 'All' }], today: '2026-05-25' }).length === 0, 'whole-society count (no godownId) matches ALL_STOCK');

const t = L.countTotals([l1, l2, l3]);
ok(t.counted === 3 && t.differing === 2 && t.shortValue === 110 && t.excessValue === 165, 'totals');

console.log(`\nStock verification: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

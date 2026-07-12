// Reversing corrections (T-08 / ADR-0001; CL-2, CL-9; RULE 3).
//
// Proves the correction model by REPLAYING the resulting events through the T-07 projections:
//   • cancel  → every account of the voucher nets to zero, original retained;
//   • edit    → the ledger nets to the CORRECTED figures (reverse + repost), original retained;
//   • cascade → a parent AND its dependents net out together (no ghost balance / orphan);
//   • immutability → no function mutates an original; the log only GROWS.
//
// Run: node scripts/test-ledger-correction.mjs   (npm run test:ledger-correction)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as pathResolve } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const base = pathResolve(SRC, spec.slice(2));
          for (const cand of [base + '.ts', base + '.tsx', base + '/index.ts', base]) {
            if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
          }
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
            const u = new URL(cand, ctx.parentURL);
            if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
          }
        }
        return next(spec, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let ev, co, pj;
try {
  ev = await import(abs('../src/lib/ledger/event.ts'));
  co = await import(abs('../src/lib/ledger/correction.ts'));
  pj = await import(abs('../src/lib/ledger/projections.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the ledger modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { buildEvent, isReversal } = ev;
const { reverseVoucher, cancelVoucher, editVoucher, cascadeReversal } = co;
const { projectTrialBalance } = pj;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const HUMAN = { kind: 'human', id: 'u1' };
const line = (accountId, drCr, amountMinor) => ({ accountId, drCr, amountMinor });
const voucher = (id, seq, at, lines) => buildEvent(
  { eventType: 'voucher.posted', tenantId: 'SOC001', jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: id, sequence: seq, producer: HUMAN, payload: { lines } },
  { eventId: id + '#' + seq, occurredAt: at },
);
const ctx = (id, at) => ({ eventId: id, occurredAt: at });
const netZero = (tb) => tb.lines.every((l) => l.netMinor === 0);

// ── 1. CANCEL — reverse only; nets to zero; original retained (CL-2) ─────────
const v1 = voucher('V1', 1, '2026-04-01T00:00:00Z', [line('1001', 'Dr', 100000), line('4101', 'Cr', 100000)]);
const cancel = cancelVoucher(v1, ctx('V1r', '2026-04-02T00:00:00Z'), { sequence: 2, producer: HUMAN, reason: 'duplicate' });
ok(isReversal(cancel) && cancel.reversalOf === 'V1#1', 'the cancellation references the original event');
ok(cancel.payload.lines[0].drCr === 'Cr' && cancel.payload.lines[1].drCr === 'Dr', 'the reversal flips every Dr/Cr');
ok(cancel.payload.reason === 'duplicate', 'the reversal records WHY (CL-7)');
const afterCancel = projectTrialBalance([v1, cancel]);
ok(netZero(afterCancel) && afterCancel.balanced && afterCancel.eventCount === 2,
  'cancel: every account nets to zero, still balanced, and the original is still in the log');

// original is untouched (no mutation)
ok(v1.payload.lines[0].drCr === 'Dr', 'reverseVoucher did NOT mutate the original event');

// ── 2. EDIT = reverse + repost → the ledger nets to the CORRECTED figures ─────
// Original ₹1000 sale; corrected to ₹1200.
const [rev, repost] = editVoucher(v1, [line('1001', 'Dr', 120000), line('4101', 'Cr', 120000)], {
  reverse: { ctx: ctx('V1e-rev', '2026-04-03T00:00:00Z'), sequence: 2 },
  repost:  { ctx: ctx('V1e-post', '2026-04-03T00:00:01Z'), sequence: 3 },
  producer: HUMAN, reason: 'amount corrected',
});
const edited = projectTrialBalance([v1, rev, repost]);
const corrected = projectTrialBalance([voucher('C', 1, '2026-04-03T00:00:00Z', [line('1001', 'Dr', 120000), line('4101', 'Cr', 120000)])]);
// The NET effect per account is what matters — gross totals differ (the log has 3 postings).
const netOf = (tb) => Object.fromEntries(tb.lines.map((l) => [l.accountId, l.netMinor]));
ok(JSON.stringify(netOf(edited)) === JSON.stringify(netOf(corrected)) && netOf(edited)['1001'] === 120000,
  'edit: the per-account NET effect equals the CORRECTED voucher (₹1200), not the original (₹1000)');
ok(edited.eventCount === 3 && edited.balanced, 'edit history is [posted, reversed, posted] — three events, still balanced');
ok(repost.eventType === 'voucher.posted' && !isReversal(repost), 'the repost is a normal posted event on the same voucher');

// ── 3. CASCADE — parent + dependents net out together (RULE 3 / CL-9) ─────────
// A sale voucher and its GST voucher (a dependent). Reversing the sale must reverse both.
const sale = voucher('S1', 1, '2026-05-01T00:00:00Z', [line('1001', 'Dr', 118000), line('4101', 'Cr', 100000), line('2200', 'Cr', 18000)]);
const gst = voucher('G1', 1, '2026-05-01T00:00:00Z', [line('2200', 'Dr', 18000), line('2201', 'Cr', 18000)]);
const reversals = cascadeReversal([
  { original: sale, ctx: ctx('S1r', '2026-05-02T00:00:00Z'), sequence: 2 },
  { original: gst,  ctx: ctx('G1r', '2026-05-02T00:00:00Z'), sequence: 2 },
], HUMAN, 'sale cancelled');
ok(reversals.length === 2 && reversals.every(isReversal), 'cascade produces a reversal for the parent AND the dependent');
const afterCascade = projectTrialBalance([sale, gst, ...reversals]);
ok(netZero(afterCascade), 'cascade: parent + dependent net EVERY account to zero (no ghost balance / orphan)');

// Reversing ONLY the parent leaves the dependent's ghost balance — the bug cascade prevents.
const partial = projectTrialBalance([sale, gst, reversals[0]]);
ok(!netZero(partial), 'reversing only the parent would leave a ghost balance — which is exactly why cascade reverses dependents too');

// ── 4. PURITY ────────────────────────────────────────────────────────────────
const code = readFileSync(pathResolve(SRC, 'lib', 'ledger', 'correction.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
  ok(!code.includes(forbidden), `correction.ts is pure & deterministic (no "${forbidden}")`);
}

console.log(`\nReversing corrections: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

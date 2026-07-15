// Genesis backfill planner (T-06) — imports the REAL planGenesisEvents via the '@/' loader and
// proves it seeds one replay-faithful voucher.posted event per ACTIVE voucher, skips deleted/pending/
// empty, uses deterministic (idempotent) ids, and reconstructs the trial balance on replay.
// Run: node scripts/test-ledger-genesis.mjs
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

const { planGenesisEvents, genesisEventId, planOpeningEvents, openingEventId, planOpeningDelta, OPENING_EVENT_DATE } = await import(abs('../src/lib/ledger/genesis.ts'));
const { projectTrialBalance } = await import(abs('../src/lib/ledger/projections.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const v = (id, over = {}) => ({ id, type: 'journal', date: '2025-04-01', debitAccountId: '1001', creditAccountId: '4101', amount: 1000, ...over });
const inp = (voucher, tenantId = 'SOC001', jurisdiction = 'hr') => ({ voucher, tenantId, jurisdiction });

// 1. One event per active, approved voucher.
const plan = planGenesisEvents([inp(v('a')), inp(v('b')), inp(v('c'))]);
ok(plan.seeded === 3 && plan.events.length === 3, 'one event per active voucher');
ok(plan.events.every((e) => e.eventType === 'voucher.posted' && e.sequence === 1), 'each is a voucher.posted at sequence 1');
ok(plan.events[0].producer.kind === 'import', 'default producer is the import principal (a backfill, not a human)');
ok(plan.events[0].occurredAt === '2025-04-01T00:00:00.000Z', 'occurredAt is the voucher date (as-of-date replay works)');
ok(plan.events[0].tenantId === 'SOC001' && plan.events[0].jurisdiction === 'hr', 'tenant + jurisdiction stamped');

// 2. Deterministic, idempotent ids.
ok(plan.events[0].eventId === genesisEventId('a'), 'event id is deterministic (genesis-<voucherId>)');
const rerun = planGenesisEvents([inp(v('a'))]);
ok(rerun.events[0].eventId === plan.events[0].eventId, 're-run yields the SAME id (idempotent under upsert)');

// 3. Skips — deleted, pending, and empty (no legs / no date) with counted reasons.
const skips = planGenesisEvents([
  inp(v('del', { isDeleted: true })),
  inp(v('pend', { approvalStatus: 'pending' })),
  inp(v('nolegs', { debitAccountId: undefined, creditAccountId: undefined, amount: 0 })),
  inp(v('nodate', { date: '' })),
  inp(v('notenant'), ''),
  inp(v('ok')),
]);
ok(skips.seeded === 1, 'only the one clean voucher is seeded');
ok(skips.skippedDeleted === 1 && skips.skippedPending === 1 && skips.skippedEmpty === 3, 'skip reasons counted (deleted / pending / empty×3)');

// 4. REPLAY-FAITHFUL — projectTrialBalance over the genesis events reconstructs the balances.
const tb = projectTrialBalance(planGenesisEvents([inp(v('a')), inp(v('b'))]).events);
ok(tb.balanced, 'genesis trial balance is balanced');
ok(tb.lines.find((l) => l.accountId === '1001').drMinor === 200000, 'cash Dr 200000 (two ₹1000 vouchers) reconstructed');
ok(tb.lines.find((l) => l.accountId === '4101').crMinor === 200000, 'income Cr 200000 reconstructed');

// 5. Multi-line vouchers seed faithfully too.
const ml = planGenesisEvents([inp(v('m', { lines: [
  { id: 'x', accountId: '1001', type: 'Dr', amount: 60 },
  { id: 'y', accountId: '1002', type: 'Dr', amount: 40 },
  { id: 'z', accountId: '4101', type: 'Cr', amount: 100 },
], debitAccountId: undefined, creditAccountId: undefined, amount: 100 }))]);
const tbM = projectTrialBalance(ml.events);
ok(tbM.balanced && tbM.totalDrMinor === 10000, 'multi-line voucher seeds a balanced 3-leg event');

// 6. Opening-balance events — one account.opening per account with a non-zero balance, correct side.
const openings = planOpeningEvents(
  [
    { id: '1001', openingBalance: 5000, openingBalanceType: 'debit' },
    { id: '2001', openingBalance: 5000, openingBalanceType: 'credit' },
    { id: '3001', openingBalance: 0, openingBalanceType: 'debit' },   // zero → skipped
  ],
  'SOC001',
  { openingDate: '2000-01-01', jurisdiction: 'hr' },
);
ok(openings.length === 2, 'one opening event per account with a non-zero balance (zero skipped)');
ok(openings[0].eventType === 'account.opening' && openings[0].aggregateType === 'account' && openings[0].eventId === openingEventId('1001'), 'account.opening event, deterministic id');
ok(openings[0].payload.lines[0].drCr === 'Dr' && openings[0].payload.lines[0].amountMinor === 500000, 'debit opening → Dr leg in paise');
ok(openings[1].payload.lines[0].drCr === 'Cr', 'credit opening → Cr leg');
ok(openings[0].occurredAt === '2000-01-01T00:00:00.000Z', 'opening dated before all vouchers');

// 7. Openings + a voucher replay into the FULL trial balance (opening + posting).
const tbFull = projectTrialBalance([...openings, planGenesisEvents([inp(v('a'))]).events[0]]);
ok(tbFull.balanced, 'openings + voucher journal is balanced');
ok(tbFull.lines.find((l) => l.accountId === '1001').drMinor === 500000 + 100000, 'account 1001 = opening 5000 + voucher 1000 (Dr 600000)');

// 8. planOpeningDelta (T-09 live auto-cutover) — the WORM-safe counterpart of planOpeningEvents:
//    an opening CHANGE appends a signed delta so the account's opening events always sum to current.
const acc = (over = {}) => ({ id: '1001', openingBalance: 5000, openingBalanceType: 'debit', ...over });

// 8a. Brand-new account (prev 0) → a full-value Dr delta at seq 1.
const d1 = planOpeningDelta(acc(), 0, 1, 'SOC001', { jurisdiction: 'hr' });
ok(d1 && d1.eventType === 'account.opening' && d1.aggregateType === 'account', 'delta: account.opening event');
ok(d1.payload.lines[0].drCr === 'Dr' && d1.payload.lines[0].amountMinor === 500000, 'delta: new debit account → Dr 500000');
ok(d1.eventId === `${openingEventId('1001')}-1` && d1.sequence === 1, 'delta: id is opening-<id>-<seq>, distinct from the genesis opening');
ok(d1.occurredAt === `${OPENING_EVENT_DATE}T00:00:00.000Z`, 'delta dated at the opening date (before all vouchers)');
ok(d1.producer.kind === 'human', 'delta: default producer is human (a live edit, not a backfill)');

// 8b. Raise 5000 → 8000 (prev signed +500000) → a +300000 Dr delta.
const d2 = planOpeningDelta(acc({ openingBalance: 8000 }), 500000, 2, 'SOC001');
ok(d2.payload.lines[0].drCr === 'Dr' && d2.payload.lines[0].amountMinor === 300000, 'delta: 5000→8000 raise → +3000 Dr');

// 8c. Lower 5000 → 2000 → a Cr delta (opening reduced).
const d3 = planOpeningDelta(acc({ openingBalance: 2000 }), 500000, 2, 'SOC001');
ok(d3.payload.lines[0].drCr === 'Cr' && d3.payload.lines[0].amountMinor === 300000, 'delta: 5000→2000 cut → Cr 3000 (reduces the Dr opening)');

// 8d. Flip debit 5000 → credit 3000: signed goes +500000 → −300000, delta −800000 (Cr).
const d4 = planOpeningDelta(acc({ openingBalance: 3000, openingBalanceType: 'credit' }), 500000, 2, 'SOC001');
ok(d4.payload.lines[0].drCr === 'Cr' && d4.payload.lines[0].amountMinor === 800000, 'delta: debit 5000 → credit 3000 → Cr 8000 (crosses zero correctly)');

// 8e. No change → no event; delete (new opening 0, prev +500000) → a full Cr delta that nets to zero.
ok(planOpeningDelta(acc(), 500000, 2, 'SOC001') === null, 'delta: unchanged opening → no event');
const dDel = planOpeningDelta(acc({ openingBalance: 0 }), 500000, 2, 'SOC001');
ok(dDel.payload.lines[0].drCr === 'Cr' && dDel.payload.lines[0].amountMinor === 500000, 'delta: delete (→0) → Cr 5000 nets the opening to zero');

// 8f. The genesis opening + a live delta SUM to the new opening in the trial balance (the invariant).
const genesisOpening = planOpeningEvents([acc()], 'SOC001', { openingDate: OPENING_EVENT_DATE })[0]; // Dr 500000
const raise = planOpeningDelta(acc({ openingBalance: 8000 }), 500000, 2, 'SOC001');                  // +Dr 300000
const tbOpen = projectTrialBalance([genesisOpening, raise]);
ok(tbOpen.lines.find((l) => l.accountId === '1001').drMinor === 800000, 'opening + delta sum to the current opening (Dr 800000)');

console.log(`\nGenesis backfill planner (T-06): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

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

const { planGenesisEvents, genesisEventId } = await import(abs('../src/lib/ledger/genesis.ts'));
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

console.log(`\nGenesis backfill planner (T-06): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

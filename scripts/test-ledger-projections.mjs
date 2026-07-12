// Projections — reports derived from the event log (T-07 / ADR-0001; CL-4, CL-1).
//
// Proves the projection engine: the trial balance and account ledger are computed by folding
// events, are exact (integer paise, T-02), balance (Σ Dr === Σ Cr), reproduce AS-OF any date,
// net out a reversal without deleting the original (CL-2), and are deterministic / rebuildable
// (CL-4) — the ONE canonical formula (RULE 2) so state, page and aggregator cannot disagree.
//
// Run: node scripts/test-ledger-projections.mjs   (npm run test:ledger-projections)

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

let ev, pj;
try {
  ev = await import(abs('../src/lib/ledger/event.ts'));
  pj = await import(abs('../src/lib/ledger/projections.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the projection modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { buildEvent, reverseEvent } = ev;
const { projectTrialBalance, projectAccountLedger } = pj;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const HUMAN = { kind: 'human', id: 'u1' };

// A voucher event whose payload carries balanced lines (T-05 shape), at a given time.
const voucher = (id, seq, at, lines) => buildEvent(
  { eventType: 'voucher.posted', tenantId: 'SOC001', jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: id, sequence: seq, producer: HUMAN, payload: { lines } },
  { eventId: id, occurredAt: at },
);
const line = (accountId, drCr, amountMinor) => ({ accountId, drCr, amountMinor });

// ── 1. TRIAL BALANCE — exact, balanced, per-account ──────────────────────────
const v1 = voucher('v1', 1, '2026-04-01T00:00:00Z', [line('1001', 'Dr', 100000), line('4101', 'Cr', 100000)]); // ₹1000 cash sale
const tb1 = projectTrialBalance([v1]);
ok(tb1.balanced && tb1.totalDrMinor === 100000 && tb1.totalCrMinor === 100000, 'a balanced voucher → a balanced trial balance (Σ Dr === Σ Cr, CL-1)');
const cash = tb1.lines.find((l) => l.accountId === '1001');
ok(cash.drMinor === 100000 && cash.crMinor === 0 && cash.netMinor === 100000, 'per-account Dr/Cr/net is exact');
ok(tb1.lines.map((l) => l.accountId).join(',') === '1001,4101', 'lines are sorted by accountId (canonical serialisation)');

// Exact paise: three legs that drift as floats tie exactly (₹100 split 33.33/33.33/33.34).
const split = voucher('v2', 1, '2026-04-02T00:00:00Z', [line('1001', 'Dr', 10000), line('4101', 'Cr', 3333), line('4102', 'Cr', 3333), line('4103', 'Cr', 3334)]);
ok(projectTrialBalance([split]).balanced, 'a three-way split balances exactly (integer paise, T-02)');

// ── 2. AS-OF-DATE — replay only what had occurred (CL-4) ─────────────────────
const v3 = voucher('v3', 1, '2026-06-15T00:00:00Z', [line('1001', 'Dr', 50000), line('4101', 'Cr', 50000)]);
const all = [v1, v3];
ok(projectTrialBalance(all, '2026-05-01T00:00:00Z').totalDrMinor === 100000, 'as-of May: only the April voucher is included');
ok(projectTrialBalance(all, '2026-07-01T00:00:00Z').totalDrMinor === 150000, 'as-of July: both vouchers are included');
ok(projectTrialBalance(all).totalDrMinor === 150000, 'no cutoff → the whole log');
ok(projectTrialBalance(all, '2026-06-15T00:00:00Z').totalDrMinor === 150000, 'the cutoff is inclusive of same-instant events');

// ── 3. REVERSAL nets out — original NEVER deleted (CL-2) ─────────────────────
const rev = reverseEvent(v1, { eventId: 'v1r', occurredAt: '2026-04-05T00:00:00Z' }, {
  sequence: 2, producer: HUMAN, payload: { lines: [line('1001', 'Cr', 100000), line('4101', 'Dr', 100000)] }, reason: 'error',
});
const tbRev = projectTrialBalance([v1, rev]);
ok(tbRev.lines.every((l) => l.netMinor === 0) && tbRev.balanced, 'a voucher + its reversal net every account to zero — and stay balanced');
ok(tbRev.eventCount === 2, 'both events are still counted in the log (append-only, not deleted)');

// ── 4. DETERMINISM / REBUILD ─────────────────────────────────────────────────
ok(JSON.stringify(projectTrialBalance(all)) === JSON.stringify(projectTrialBalance([...all].reverse())),
  'projection is order-independent in input (deterministic, rebuildable — CL-4)');
ok(JSON.stringify(projectTrialBalance([])) === JSON.stringify({ asOf: null, lines: [], totalDrMinor: 0, totalCrMinor: 0, balanced: true, eventCount: 0 }),
  'an empty log projects to an empty, balanced trial balance');

// ── 5. ACCOUNT LEDGER — running balance, as-of ───────────────────────────────
const led = projectAccountLedger([v1, v3], '1001');
ok(led.entries.length === 2 && led.closingMinor === 150000, 'the account ledger folds a running balance to the closing figure');
ok(led.entries[0].runningMinor === 100000 && led.entries[1].runningMinor === 150000, 'the running balance is correct and ordered by time');
ok(projectAccountLedger([v1, v3], '1001', '2026-05-01T00:00:00Z').closingMinor === 100000, 'the account ledger honours as-of-date too');
ok(projectAccountLedger([v1, rev], '1001').closingMinor === 0, 'a reversal nets the account ledger to zero as well');

// ── 6. PURITY ────────────────────────────────────────────────────────────────
const code = readFileSync(pathResolve(SRC, 'lib', 'ledger', 'projections.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
  ok(!code.includes(forbidden), `projections.ts is pure & deterministic (no "${forbidden}")`);
}

console.log(`\nLedger projections: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

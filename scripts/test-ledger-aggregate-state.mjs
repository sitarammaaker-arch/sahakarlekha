// Current-voucher resolution (T-09) — imports the REAL resolveCurrentVouchers via the '@/' loader and
// proves the shared basis for the ledger transaction projections: cancelled dropped, edited → reposted
// legs, else posted; non-voucher aggregates ignored; payload meta extracted. Run: node scripts/test-ledger-aggregate-state.mjs
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

const { resolveCurrentVouchers, currentPostingEventId } = await import(abs('../src/lib/ledger/aggregateState.ts'));
const { buildEvent } = await import(abs('../src/lib/ledger/event.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const HUMAN = { kind: 'human', id: 't' };
const leg = (a, d, m) => ({ accountId: a, drCr: d, amountMinor: m });
const ev = (id, eventType, lines, meta = {}, seq = 1, aggregateType = 'voucher') =>
  buildEvent({ eventType, tenantId: 'SOC001', aggregateType, aggregateId: id, sequence: seq, producer: HUMAN, payload: { lines, voucherNo: meta.voucherNo ?? id, narration: meta.narration ?? '', createdAt: meta.createdAt ?? '', date: meta.date ?? '2025-06-01', memberId: meta.memberId ?? '', amount: meta.amount ?? 0 } }, { eventId: `e-${id}-${seq}-${eventType}`, occurredAt: '2025-06-01T00:00:00Z' });
const by = (rows, id) => rows.find((r) => r.id === id);

// 1. A plain posted voucher resolves with its legs + metadata.
const r1 = resolveCurrentVouchers([ev('p', 'voucher.posted', [leg('1001', 'Dr', 100000)], { voucherNo: 'JV-1', narration: 'n', createdAt: 'c', memberId: 'M1', amount: 1000 })]);
ok(r1.length === 1 && by(r1, 'p').legs[0].amountMinor === 100000, 'posted voucher resolved with legs');
ok(by(r1, 'p').voucherNo === 'JV-1' && by(r1, 'p').narration === 'n' && by(r1, 'p').createdAt === 'c' && by(r1, 'p').memberId === 'M1' && by(r1, 'p').amount === 1000, 'payload metadata extracted');

// 2. A cancelled voucher is dropped.
ok(resolveCurrentVouchers([ev('c', 'voucher.posted', [leg('1001', 'Dr', 999)]), ev('c', 'voucher.cancelled', [leg('1001', 'Cr', 999)], {}, 2)]).length === 0, 'cancelled aggregate dropped');

// 3. An edited voucher resolves to the LATEST reposted legs (not posted/reversed).
const r3 = resolveCurrentVouchers([
  ev('e', 'voucher.posted', [leg('1001', 'Dr', 100000)]),
  ev('e', 'voucher.reversed', [leg('1001', 'Cr', 100000)], {}, 2),
  ev('e', 'voucher.reposted', [leg('1001', 'Dr', 150000)], { narration: 'edited' }, 3),
]);
ok(r3.length === 1 && r3[0].legs[0].amountMinor === 150000 && r3[0].narration === 'edited', 'edited → latest reposted legs + meta');

// 4. Non-voucher aggregates (account.opening) are ignored.
ok(resolveCurrentVouchers([ev('1001', 'account.opening', [leg('1001', 'Dr', 500000)], {}, 1, 'account')]).length === 0, 'account.opening (non-voucher) ignored');

// 5. Multiple independent vouchers all resolve.
ok(resolveCurrentVouchers([ev('a', 'voucher.posted', [leg('1', 'Dr', 1)]), ev('b', 'voucher.posted', [leg('2', 'Dr', 2)])]).length === 2, 'independent vouchers each resolve');

// 6. currentPostingEventId — the reversalOf target a cancel/edit-reversed event should point at.
// ev builds ids as `e-<id>-<seq>-<eventType>`.
ok(currentPostingEventId([ev('p', 'voucher.posted', [leg('1', 'Dr', 1)])], 'p') === 'e-p-1-voucher.posted',
   'plain posted → its posted eventId (what a cancel reverses)');
const edited = [
  ev('e', 'voucher.posted', [leg('1', 'Dr', 1)]),
  ev('e', 'voucher.reversed', [leg('1', 'Cr', 1)], {}, 2),
  ev('e', 'voucher.reposted', [leg('1', 'Dr', 2)], {}, 3),
];
ok(currentPostingEventId(edited, 'e') === 'e-e-3-voucher.reposted',
   'edited → the LATEST reposted eventId (not the original posted)');
ok(currentPostingEventId([], 'x') === undefined && currentPostingEventId([ev('p', 'voucher.posted', [leg('1','Dr',1)])], 'other') === undefined,
   'unknown aggregate → undefined');

console.log(`\nCurrent-voucher resolution (T-09): ${pass} passed, ${fail} failed`);
// Set exitCode + let node drain naturally — an immediate process.exit() on this very light script
// races the '@/' loader cleanup on Windows (libuv UV_HANDLE_CLOSING assertion).
process.exitCode = fail > 0 ? 1 : 0;

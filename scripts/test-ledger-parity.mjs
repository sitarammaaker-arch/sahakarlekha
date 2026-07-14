// Ledger parity (T-07) — imports the REAL ledgerParity via the '@/' loader and proves the journal
// replays to the SAME per-account balances as the current vouchers (the empty-diff gate for the T-09
// cut): matches for post/cancel/edit, and reports a diff when the journal and vouchers disagree.
// Run: node scripts/test-ledger-parity.mjs
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

const { ledgerParity, balancesFromVouchers } = await import(abs('../src/lib/ledger/parity.ts'));
const { planGenesisEvents } = await import(abs('../src/lib/ledger/genesis.ts'));
const { buildEvent } = await import(abs('../src/lib/ledger/event.ts'));
const { voucherPostingLines, voucherReversalLines } = await import(abs('../src/lib/ledger/voucherEvent.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const v = (id, over = {}) => ({ id, type: 'journal', date: '2025-04-01', debitAccountId: '1001', creditAccountId: '4101', amount: 1000, ...over });
const inp = (voucher) => ({ voucher, tenantId: 'SOC001', jurisdiction: 'hr' });
const HUMAN = { kind: 'human', id: 't' };
const ev = (id, seq, eventType, lines, at = '2025-04-02T00:00:00Z') =>
  buildEvent({ eventType, tenantId: 'SOC001', jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: id, sequence: seq, producer: HUMAN, payload: { lines } }, { eventId: `e-${id}-${seq}`, occurredAt: at });

// 1. Genesis of the active vouchers matches them exactly (the canonical clean cutover).
const vouchers1 = [v('a'), v('b')];
const journal1 = planGenesisEvents(vouchers1.map(inp)).events;
const p1 = ledgerParity(journal1, vouchers1);
ok(p1.matches && p1.diffs.length === 0, 'genesis of active vouchers → journal matches vouchers (empty-diff)');
ok(p1.accountsChecked === 2, 'both accounts (1001, 4101) checked');

// 2. A cancelled voucher: journal has posted + cancelled (nets zero); the voucher is isDeleted, so the
//    vouchers side excludes it. Both sides agree (zero).
const vouchers2 = [v('a'), v('c', { isDeleted: true })];
const journal2 = [
  ...planGenesisEvents([inp(v('a'))]).events,              // c is deleted → genesis skips it
  ev('c', 1, 'voucher.posted', voucherPostingLines(v('c'))),
  ev('c', 2, 'voucher.cancelled', voucherReversalLines(v('c'))),
];
ok(ledgerParity(journal2, vouchers2).matches, 'cancelled voucher: posted+cancelled nets to zero, matches the excluded (deleted) voucher');

// 3. An edited voucher: journal has posted(old) + reversed(old) + reposted(new); the voucher now holds
//    the NEW amount. Both net to the new value.
const dNew = v('d', { amount: 1500 });
const vouchers3 = [dNew];
const journal3 = [
  ev('d', 1, 'voucher.posted', voucherPostingLines(v('d', { amount: 1000 }))),
  ev('d', 2, 'voucher.reversed', voucherReversalLines(v('d', { amount: 1000 }))),
  ev('d', 3, 'voucher.reposted', voucherPostingLines(dNew)),
];
ok(ledgerParity(journal3, vouchers3).matches, 'edited voucher: reverse-old + repost-new matches the new voucher');

// 4. MISMATCH — an active voucher with NO event in the journal is a diff (the gate must catch it).
const p4 = ledgerParity([], [v('e')]);
ok(!p4.matches && p4.diffs.length === 2, 'active voucher missing from journal → parity fails, diffs reported');
ok(p4.diffs.find((d) => d.accountId === '1001').expected === 100000 && p4.diffs.find((d) => d.accountId === '1001').actual === 0, 'diff shows expected (voucher) vs actual (journal=0)');

// 5. MISMATCH — a stray journal event with no matching active voucher is a diff.
const p5 = ledgerParity(planGenesisEvents([inp(v('f'))]).events, []);
ok(!p5.matches && p5.diffs.length === 2, 'journal event with no live voucher → parity fails');

// 6. balancesFromVouchers skips deleted + pending (matches the seeded population).
const bal = balancesFromVouchers([v('a'), v('x', { isDeleted: true }), v('y', { approvalStatus: 'pending' })]);
ok(bal['1001'] === 100000 && Object.keys(bal).length === 2, 'balancesFromVouchers counts only active, approved vouchers');

console.log(`\nLedger parity (T-07): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

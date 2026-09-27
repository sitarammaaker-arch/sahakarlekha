// Account merge must move the JOURNAL, not just the vouchers table (T-09 / ADR-0001).
//
// After the T-09 cutover every statement reads ledger_events. The old mergeAccounts re-pointed the
// vouchers table only, so the postings stayed on the removed account in the journal. This pins:
//   A. planAccountMerge (pure) — live posted vouchers get voucher.reversed + voucher.reposted, the
//      removed account nets to exactly zero in the projected trial balance, the kept account takes
//      its postings, sequences never collide, reversalOf points at the CURRENT posting (the latest
//      repost for an edited voucher), pending / cancelled vouchers get no event;
//   B. DataContext.mergeAccounts (source) — guards first and resolve null, table writes → atomic
//      journal batch → account delete, in that order, with compensation on failure.
// Run: node scripts/test-account-merge-journal.mjs (exit 1 on any failure).
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

// Resolve the app's '@/…' alias (and extensionless relative imports) for Node's native TS loading.
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC_DIR)};
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

const { buildEvent } = await import(abs('../src/lib/ledger/event.ts'));
const { voucherPostingLines, voucherReversalLines, voucherEventMeta } = await import(abs('../src/lib/ledger/voucherEvent.ts'));
const { projectTrialBalance } = await import(abs('../src/lib/ledger/projections.ts'));
const { resolveCurrentVouchers } = await import(abs('../src/lib/ledger/aggregateState.ts'));
const { planAccountMerge, repointVoucher } = await import(abs('../src/lib/ledger/accountMerge.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const KEEP = 'acc-keep', REMOVE = 'acc-remove', CASH = '3101', BANK = '3102';
let n = 0;
const id = () => `ev-${++n}`;
const AT = '2026-09-27T10:00:00.000Z';
const ev = (eventType, v, sequence, lines, reversalOf) => buildEvent(
  { eventType, tenantId: 'SOC1', jurisdiction: 'HR', aggregateType: 'voucher', aggregateId: v.id, sequence, producer: { kind: 'human', id: 't' }, reversalOf, payload: { lines, ...voucherEventMeta(v) } },
  { eventId: id(), occurredAt: AT },
);
const V = (o) => ({ voucherNo: o.id.toUpperCase(), type: 'journal', date: '2026-05-01', narration: '', createdAt: AT, createdBy: 't', amount: 0, debitAccountId: '', creditAccountId: '', ...o });

// v1 — simple legacy voucher, Dr cash / Cr REMOVE ₹100, posted once.
const v1 = V({ id: 'v1', amount: 100, debitAccountId: CASH, creditAccountId: REMOVE });
// v2 — multi-line, EDITED earlier: posted (old legs on BANK) → reversed → reposted (legs on REMOVE).
const v2 = V({ id: 'v2', amount: 50, lines: [
  { id: 'l1', accountId: REMOVE, type: 'Dr', amount: 50 },
  { id: 'l2', accountId: CASH, type: 'Cr', amount: 30 },
  { id: 'l3', accountId: KEEP, type: 'Cr', amount: 20 },
] });
const v2old = V({ id: 'v2', amount: 50, debitAccountId: BANK, creditAccountId: CASH });
// v3 — pending approval, touches REMOVE, never posted.
const v3 = V({ id: 'v3', amount: 70, debitAccountId: REMOVE, creditAccountId: CASH, approvalStatus: 'pending' });
// v4 — cancelled (isDeleted), posted + cancelled.
const v4 = V({ id: 'v4', amount: 40, debitAccountId: REMOVE, creditAccountId: BANK, isDeleted: true });
// v5 — unrelated.
const v5 = V({ id: 'v5', amount: 10, debitAccountId: CASH, creditAccountId: BANK });
// v6 — journal DRIFTED from the table: journal posted ₹90 on REMOVE, table says ₹95.
const v6 = V({ id: 'v6', amount: 95, debitAccountId: BANK, creditAccountId: REMOVE });

const e1 = ev('voucher.posted', v1, 1, voucherPostingLines(v1));
const e2a = ev('voucher.posted', v2old, 1, voucherPostingLines(v2old));
const e2b = ev('voucher.reversed', v2old, 2, voucherReversalLines(v2old), e2a.eventId);
const e2c = ev('voucher.reposted', v2, 3, voucherPostingLines(v2));
const e4a = ev('voucher.posted', v4, 1, voucherPostingLines(v4));
const e4b = ev('voucher.cancelled', v4, 2, voucherReversalLines(v4), e4a.eventId);
const e5 = ev('voucher.posted', v5, 1, voucherPostingLines(v5));
const e6 = ev('voucher.posted', v6, 1, [{ accountId: BANK, drCr: 'Dr', amountMinor: 9000 }, { accountId: REMOVE, drCr: 'Cr', amountMinor: 9000 }]);
const journal = [e1, e2a, e2b, e2c, e4a, e4b, e5, e6];
const vouchers = [v1, v2, v3, v4, v5, v6];

const plan = planAccountMerge({ vouchers, events: journal, keepId: KEEP, removeId: REMOVE, tenantId: 'SOC1', jurisdiction: 'HR', producerId: 't', occurredAt: AT, newEventId: id });

// ── A1. which vouchers change / get events ─────────────────────────────────────────────
ok(plan.changed.map(c => c.after.id).join(',') === 'v1,v2,v3,v4,v6', 'every voucher referencing REMOVE is re-pointed (incl. pending + cancelled), unrelated untouched');
ok(plan.changed.every(c => !JSON.stringify(c.after).includes(REMOVE)), 'no re-pointed voucher still references REMOVE');
ok(plan.journaledCount === 3 && plan.events.length === 6, `3 live posted vouchers journaled as 3 pairs (got ${plan.journaledCount} / ${plan.events.length})`);
const byAgg = (vid) => plan.events.filter(e => e.aggregateId === vid);
ok(byAgg('v3').length === 0, 'pending voucher gets NO event (would post an unapproved voucher)');
ok(byAgg('v4').length === 0, 'cancelled voucher gets NO event (would resurrect it)');
ok(byAgg('v5').length === 0, 'unrelated voucher gets no event');
for (const vid of ['v1', 'v2', 'v6']) {
  const [r, p] = byAgg(vid);
  ok(r?.eventType === 'voucher.reversed' && p?.eventType === 'voucher.reposted', `${vid}: reversed then reposted`);
}

// ── A2. lineage + sequences ───────────────────────────────────────────────────────────
ok(byAgg('v1')[0].reversalOf === e1.eventId, 'v1 reversal points at its posted event');
ok(byAgg('v2')[0].reversalOf === e2c.eventId, 'v2 (edited) reversal points at the LATEST repost, not the original post');
ok(byAgg('v2')[0].sequence === 4 && byAgg('v2')[1].sequence === 5, 'v2 sequences continue after 3 (4, 5)');
ok(byAgg('v1')[0].sequence === 2 && byAgg('v1')[1].sequence === 3, 'v1 sequences are 2, 3');
const keys = [...journal, ...plan.events].map(e => `${e.aggregateType}|${e.aggregateId}|${e.sequence}`);
ok(new Set(keys).size === keys.length, 'no (aggregate, sequence) collision on the WORM unique index');
ok(new Set(plan.events.map(e => e.eventId)).size === plan.events.length, 'event ids unique');

// ── A3. every event balanced; journal moves exactly ───────────────────────────────────
for (const e of plan.events) {
  const dr = e.payload.lines.filter(l => l.drCr === 'Dr').reduce((s, l) => s + l.amountMinor, 0);
  const cr = e.payload.lines.filter(l => l.drCr === 'Cr').reduce((s, l) => s + l.amountMinor, 0);
  ok(dr === cr && dr > 0, `${e.aggregateId} ${e.eventType} balanced (Dr ${dr} = Cr ${cr})`);
}
const net = (tb, a) => tb.lines.find(l => l.accountId === a)?.netMinor ?? 0;
const before = projectTrialBalance(journal);
const after = projectTrialBalance([...journal, ...plan.events]);
ok(net(before, REMOVE) !== 0, 'precondition: REMOVE carries postings before the merge');
ok(net(after, REMOVE) === 0, `after the merge REMOVE nets to exactly 0 in the journal (got ${net(after, REMOVE)})`);
// v6 drift: the reversal cancels the JOURNAL's ₹90, the repost books the table's ₹95 — so KEEP takes
// the journal's REMOVE balance plus the ₹5 drift being healed.
ok(net(after, KEEP) === net(before, KEEP) + net(before, REMOVE) - 500, `KEEP takes REMOVE's journal balance (+ healed v6 drift) (got ${net(after, KEEP)})`);
ok(after.balanced, 'trial balance still balanced after the merge');
const v6rev = byAgg('v6')[0].payload.lines;
ok(v6rev.every(l => l.amountMinor === 9000), 'a drifted voucher reverses the JOURNAL posting it points at (₹90), not the table amount');
ok(net(after, CASH) === net(before, CASH), 'CASH untouched by the merge');

const cur = resolveCurrentVouchers([...journal, ...plan.events]);
ok(!cur.some(c => c.legs.some(l => l.accountId === REMOVE)), 'no current voucher leg on REMOVE in the resolved journal');
ok(!cur.some(c => c.id === 'v4') && !cur.some(c => c.id === 'v3'), 'cancelled + pending stay out of the resolved journal');
ok(JSON.stringify(cur.find(c => c.id === 'v2').legs) === JSON.stringify(voucherPostingLines(plan.changed.find(c => c.after.id === 'v2').after)), 'journal legs of v2 equal the re-pointed table voucher');

// ── A4. repointVoucher + guards on input ──────────────────────────────────────────────
ok(repointVoucher(v5, KEEP, REMOVE) === null, 'repointVoucher: null when nothing references REMOVE');
ok(repointVoucher(v2, KEEP, REMOVE).lines.map(l => l.id).join() === 'l1,l2,l3', 'repointVoucher keeps line ids (voucher_entries upsert overwrites in place)');
let threw = false;
try { planAccountMerge({ vouchers, events: journal, keepId: KEEP, removeId: KEEP, tenantId: 'SOC1', producerId: null, occurredAt: AT, newEventId: id }); } catch { threw = true; }
ok(threw, 'planAccountMerge refuses keepId === removeId');

// ── B. DataContext.mergeAccounts wiring (source) ──────────────────────────────────────
const DC = readFileSync(pathResolve(HERE, '../src/contexts/DataContext.tsx'), 'utf8');
const start = DC.indexOf('const mergeAccounts = useCallback(async');
const end = DC.indexOf('const resetAccounts = useCallback(');
const M = start > 0 && end > start ? DC.slice(start, end) : '';
ok(M !== '', 'mergeAccounts found (async)');
ok(/mergeAccounts: \(keepId: string, removeId: string\) => Promise<AccountMergeResult \| null>/.test(DC), 'interface: resolves AccountMergeResult | null');
const at = (re) => { const m = M.match(re); return m ? m.index : -1; };
const iPerm = at(/guardPermission\('delete'/), iFy = at(/guardFYLocked\(\)/);
const iOpening = at(/Math\.abs\(remove\.openingBalance \|\| 0\) >= 0\.005/);
const iSystem = at(/remove\.isSystem/), iType = at(/keep\.type !== remove\.type/);
const iStock = at(/s\.salesAccountId === removeId \|\| s\.purchaseAccountId === removeId/);
const iEngine = at(/isEngineVoucher\(v\)/), iPeriod = at(/guardPeriodLock\(/), iJournal = at(/!journalLoadedRef\.current/);
const iPlan = at(/planAccountMerge\(/), iApply = at(/setVouchersState\(vouchersRef\.current\)/);
const iWrites = at(/await Promise\.all\(writes\.map\(w => w\.run\(\)\)\)/);
const iAppend = at(/await persistEventsAuthoritative\(allEvents, ledgerAppendIO\)/);
const iDelete = at(/from\('accounts'\)\.delete\(\)\.eq\('id', removeId\)/);
ok([iPerm, iFy, iOpening, iSystem, iType, iStock, iEngine, iPeriod, iJournal].every(i => i >= 0), 'all guards present (permission, FY, opening, system, type, stock routing, engine, period, journal-loaded)');
ok([iPerm, iFy, iOpening, iSystem, iType, iStock, iEngine, iPeriod, iJournal].every(i => i < iPlan && i < iApply), 'every guard runs before any planning or optimistic change');
ok(iPerm < iFy && iPerm === at(/guardPermission/), 'permission is the first check');
ok(iApply < iWrites && iWrites < iAppend && iAppend < iDelete, 'order: optimistic apply → table writes → atomic journal batch → account delete');
ok(/if \(firstErr\) return failMerge\(/.test(M) && /if \(!appended\.ok\) return failMerge\(/.test(M), 'table or journal failure → failMerge (rollback)');
const FM = M.slice(at(/const failMerge = async/), iWrites);
ok(/results\[i\] === null \? w\.undo\(\)/.test(FM), 'failMerge compensates only the writes that landed');
ok(/ledgerEventsRef\.current = ledgerEventsRef\.current\.filter\(e => !eventIds\.has/.test(FM), 'failMerge drops the planned events from the in-memory journal');
ok(/vouchersRef\.current = voucherSnapshot/.test(FM) && /suppliersRef\.current = supplierSnapshot/.test(FM) && /customersRef\.current = customerSnapshot/.test(FM), 'failMerge restores vouchers, suppliers and customers');
ok(/variant: 'destructive'/.test(FM) && /return null;/.test(FM), 'failMerge shows a destructive toast and resolves null');
ok(/buildOpeningDelta\(\{ \.\.\.remove, openingBalance: 0 \}\)/.test(M), 'removed account journal opening is zeroed in the same batch');
const DEL = M.slice(iDelete);
ok(/if \(delErr\)/.test(DEL) && /toastRef\.current\(\{[\s\S]*?variant: 'destructive'[\s\S]*?accountDeleted: false/.test(DEL) && /accountDeleted: false/.test(DEL), 'account-delete failure is surfaced with a destructive toast (not only reportError)');
ok(!/return 0;/.test(M), 'no ambiguous numeric return — blocked resolves null');
ok(!/persistLedgerEvent\(/.test(M), 'no best-effort event persist inside merge (the batch is authoritative)');

console.log(`account-merge-journal: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

// Paging must have a TOTAL order, or the books lie (T-09).
//
// `fetchAllPaged` walks a table in 1000-row LIMIT/OFFSET pages. LIMIT/OFFSET only returns a
// coherent whole if the ORDER BY is total — i.e. it ends in a UNIQUE column. Rows that TIE on
// the order columns have no defined order between them, and nothing obliges the server to break
// that tie the same way twice: Postgres may take a top-N heapsort for `OFFSET 0` and a full sort
// for `OFFSET 1000` (ledger_events has no index on occurred_at, so it must sort). When the tie
// group straddles a page boundary, a row can land on BOTH pages or on NEITHER — silent
// duplication and silent loss, with a 200 and no error.
//
// This is not hypothetical for ledger_events. genesis.ts stamps every backfilled voucher at
// `${v.date}T00:00:00.000Z` — MIDNIGHT of the voucher date — so a year of vouchers collapses onto
// ~365 distinct occurred_at values, hundreds of rows deep each. Every account's opening event
// shares a single OPENING_EVENT_DATE. Ties are the rule here, not the exception. Since the T-09
// cutover every statement (cash book, trial balance) is computed from this journal, so one
// duplicated event is a confidently wrong statutory number about someone's money.
//
// The fake below is the adversary the real server is allowed to be: it sorts by the columns the
// query actually asked for, and reorders each TIE GROUP as a function of the offset. A total order
// has no tie groups, so the same fake returns the book intact — that asymmetry IS the test.
//
// Run: node scripts/test-supabase-paging.mjs   (npm run test:supabase-paging)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');

// src/lib/supabase.ts reads import.meta.env (Vite-only) and builds a real client at import time.
// Stub it to a bare object; the test assigns `.from` per case. supabasePaging imports the same
// module instance, so mutating it here is what the code under test sees.
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as pathResolve } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      const SUPABASE = pathToFileURL(pathResolve(SRC, 'lib', 'supabase.ts')).href;

      export async function resolve(spec, ctx, next) {
        if (spec === '@/lib/supabase') return { url: SUPABASE, shortCircuit: true };
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

      export async function load(url, ctx, next) {
        if (url === SUPABASE) return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' };
        return next(url, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let paging, stub;
try {
  stub = await import(abs('../src/lib/supabase.ts'));
  paging = await import(abs('../src/lib/supabasePaging.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import src/lib/supabasePaging.ts');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}
const { fetchAllPaged } = paging;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

/**
 * A PostgREST that is hostile in exactly the way the real one is ALLOWED to be.
 *
 * Rows tying on every ordered column form a tie group with no defined internal order. This fake
 * reverses each tie group when `from > 0`, standing in for the server picking a different sort
 * strategy once the offset grows. It is deterministic, and it is legal server behaviour — an
 * ORDER BY that does not name a unique column simply does not promise otherwise.
 */
function fakeClient(rows, { key = 'id' } = {}) {
  const queries = [];
  return {
    queries,
    from(table) {
      const q = { table, eq: [], order: [], range: null };
      queries.push(q);
      // Mirrors supabase-js: every filter/modifier returns the builder, and the builder is a
      // thenable that runs the query on await. The real code calls .range() BEFORE .order(),
      // which only works because nothing executes until it is awaited.
      const b = {
        select() { return b; },
        eq(k, v) { q.eq.push([k, v]); return b; },
        order(c) { q.order.push(c); return b; },
        range(from, to) { q.range = [from, to]; return b; },
        then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
      };
      const run = () => {
        const [from, to] = q.range;
        const scoped = rows.filter((r) => q.eq.every(([k, v]) => r[k] === v));

        // Stable sort on the columns the caller actually ordered by.
        const sorted = scoped
          .map((r, i) => [r, i])
          .sort((a, bb) => {
            for (const c of q.order) {
              if (a[0][c] < bb[0][c]) return -1;
              if (a[0][c] > bb[0][c]) return 1;
            }
            return a[1] - bb[1];
          })
          .map(([r]) => r);

        // Reorder tie groups as a function of the offset — the freedom a non-total ORDER BY leaves.
        const sameKey = (x, y) => q.order.every((c) => x[c] === y[c]);
        const out = [];
        for (let i = 0; i < sorted.length; ) {
          let j = i;
          while (j < sorted.length && sameKey(sorted[i], sorted[j])) j++;
          const group = sorted.slice(i, j); // size 1 under a total order ⇒ nothing to reorder
          out.push(...(from > 0 ? group.reverse() : group));
          i = j;
        }
        // No ORDER BY at all ⇒ one big tie group ⇒ arbitrary. That is the same hazard.
        return { data: out.slice(from, to + 1), error: null };
      };
      return b;
    },
    key,
  };
}

const ids = (rs, k) => rs.map((r) => r[k]);
const dupsOf = (xs) => xs.filter((x, i) => xs.indexOf(x) !== i);

// ── The journal, shaped like the real one: midnight-stamped, deeply tied ─────
// 1200 events over 3 dates, 400 per date — so the 1000-row page boundary falls INSIDE the
// third date's 400-row tie group, exactly as a 1212-event book does in production.
const DATES = ['2026-04-01', '2026-04-02', '2026-04-03'];
const journal = [];
for (let d = 0; d < DATES.length; d++) {
  for (let i = 0; i < 400; i++) {
    journal.push({
      event_id: `genesis-v${String(d * 400 + i).padStart(4, '0')}`,
      occurred_at: `${DATES[d]}T00:00:00.000Z`, // genesis.ts truncates the clock to midnight
      society_id: 'SOC-A',
    });
  }
}
const expected = journal.map((r) => r.event_id).sort();

// ── 1. The bug, demonstrated: occurred_at alone is NOT a total order ─────────
stub.supabase.from = fakeClient(journal).from;
let res = await fetchAllPaged('ledger_events', 'SOC-A', ['occurred_at']);
let got = ids(res.data, 'event_id');
ok(res.error === null, 'the truncated read reports NO error — this is why it went unnoticed');
ok(
  got.length !== expected.length || String([...got].sort()) !== String(expected),
  'occurred_at alone corrupts the journal across pages (if this ever passes, the fake stopped modelling a legal server)',
);
const lost = expected.filter((e) => !got.includes(e));
const dup = dupsOf(got);
ok(dup.length > 0, `rows come back TWICE — ${dup.length} duplicated (a double-counted voucher)`);
ok(lost.length > 0, `rows never come back at all — ${lost.length} lost (a missing transaction)`);

// ── 2. The fix: event_id makes the order total ───────────────────────────────
stub.supabase.from = fakeClient(journal).from;
res = await fetchAllPaged('ledger_events', 'SOC-A', ['occurred_at', 'event_id']);
got = ids(res.data, 'event_id');
ok(got.length === 1200, 'with the event_id tie-break the whole 1200-event book comes back');
ok(String([...got].sort()) === String(expected), 'every event exactly once — no duplicate, none lost');
ok(dupsOf(got).length === 0, 'no event is double-counted');

// ── 3. The tie-break must not disturb the primary sort ───────────────────────
const byDate = got.map((e) => journal.find((r) => r.event_id === e).occurred_at);
ok(String(byDate) === String([...byDate].sort()), 'occurred_at still leads: the journal stays oldest-first');

// ── 4. The query the fix actually builds ─────────────────────────────────────
let c = fakeClient(journal);
stub.supabase.from = c.from;
await fetchAllPaged('ledger_events', 'SOC-A', ['occurred_at', 'event_id']);
ok(String(c.queries[0].order) === 'occurred_at,event_id', 'orders by occurred_at THEN event_id — unique column last');
ok(Object.fromEntries(c.queries[0].eq).society_id === 'SOC-A', 'every page stays scoped to one society');
ok(String(c.queries[0].range) === '0,999', 'pages in 1000-row windows');

// ── 5. The default: no ORDER BY at all was the same hazard ───────────────────
// Most callers (members, accounts, suppliers…) passed no order column. An unordered LIMIT/OFFSET
// is one unbounded tie group — the worst case. The default is now the primary key.
const members = [];
for (let i = 0; i < 1200; i++) members.push({ id: `m${String(i).padStart(4, '0')}`, society_id: 'SOC-A' });
c = fakeClient(members);
stub.supabase.from = c.from;
res = await fetchAllPaged('members', 'SOC-A');
ok(String(c.queries[0].order) === 'id', 'a caller that names no order still gets a total one — the id primary key');
ok(res.data.length === 1200, 'all 1200 members load');
ok(
  String(ids(res.data, 'id')) === String(members.map((m) => m.id)),
  'every member exactly once, in key order',
);

// ── 6. Tenant scoping survives paging ────────────────────────────────────────
const mixed = [
  ...members,
  ...Array.from({ length: 50 }, (_, i) => ({ id: `x${i}`, society_id: 'SOC-B' })),
];
stub.supabase.from = fakeClient(mixed).from;
res = await fetchAllPaged('members', 'SOC-A');
ok(res.data.length === 1200 && res.data.every((r) => r.society_id === 'SOC-A'), "another society's rows never leak in");

console.log(`\nSupabase paging (total order): ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

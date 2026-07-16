// Rebuild parity check (journal-first-write slice 7 pre-flight) — READ-ONLY diagnostic. Reports, per
// society, whether rebuilding the vouchers table FROM THE JOURNAL (vouchersFromJournal) reproduces the
// live table over the journal-owned field set. This is the pre-flight for the WRITE flip: a tenant is
// only safe to make journal-first-write once it shows ✓ (mirrors check-ledger-parity for the read
// flip). Never writes anything. PURE decision in src/lib/ledger/rebuildParity.ts.
//
// Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (preferred; reads every tenant) or SUPABASE_ANON_KEY.
//   node scripts/check-rebuild-parity.mjs
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
        if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
        return next(spec, ctx);
      }
    `),
);

const env = process.env;
const URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.error('Missing env. Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY.');
  process.exit(2);
}
const USING_SERVICE = !!env.SUPABASE_SERVICE_ROLE_KEY;

const { rebuildParity } = await import(abs('../src/lib/ledger/rebuildParity.ts'));
const { createClient } = await import('@supabase/supabase-js');
const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const fail = (msg, err) => { console.error(`✗ ${msg}${err ? ': ' + (err.message || err) : ''}`); process.exit(1); };

async function readAll(table, cols) {
  const rows = []; const size = 1000; let from = 0;
  for (;;) {
    const { data, error } = await db.from(table).select(cols).range(from, from + size - 1);
    if (error) fail(`read ${table}`, error);
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
    from += size;
  }
  return rows;
}

// Every journal-owned field the rebuild reconstructs, so the comparison is meaningful.
const vouchers = await readAll('vouchers', 'id, "voucherNo", type, date, "debitAccountId", "creditAccountId", amount, lines, narration, "createdAt", "createdBy", "memberId", "branchId", "isDeleted", society_id');
const eventRows = await readAll('ledger_events', 'event_type, aggregate_type, aggregate_id, sequence, occurred_at, society_id, payload, producer_kind, producer_id');

const toEvent = (r) => ({
  eventType: r.event_type, aggregateType: r.aggregate_type, aggregateId: r.aggregate_id,
  sequence: r.sequence, occurredAt: r.occurred_at, tenantId: r.society_id, payload: r.payload,
  producer: { kind: r.producer_kind, id: r.producer_id ?? null },
});

const groupBy = (rows, key) => { const m = new Map(); for (const r of rows) { const k = r[key]; (m.get(k) ?? m.set(k, []).get(k)).push(r); } return m; };
const vBySoc = groupBy(vouchers, 'society_id');
const eBySoc = groupBy(eventRows, 'society_id');
const societies = new Set([...vBySoc.keys(), ...eBySoc.keys()]);

console.log(`\nRebuild parity check (READ-ONLY) — key: ${USING_SERVICE ? 'service-role' : 'anon'}`);
console.log(`  vouchers: ${vouchers.length}   journal events: ${eventRows.length}   societies: ${societies.size}\n`);

const count = (diffs, kind) => diffs.filter((d) => d.kind === kind).length;
let okCount = 0, mismatchCount = 0;
for (const sid of [...societies].sort()) {
  const evs = (eBySoc.get(sid) ?? []).map(toEvent);
  const vs = vBySoc.get(sid) ?? [];
  const p = rebuildParity(evs, vs);
  if (p.matches) { okCount++; console.log(`  ✓ ${sid}  — ${p.activeCount} live vouchers rebuild exactly`); continue; }
  mismatchCount++;
  const miss = count(p.diffs, 'missing-in-journal'), extra = count(p.diffs, 'extra-in-journal'), fld = count(p.diffs, 'field-mismatch');
  console.log(`  ✗ ${sid}  — ${p.diffs.length} diff(s): ${miss} missing-in-journal, ${extra} extra-in-journal, ${fld} field-mismatch  (active ${p.activeCount} / rebuilt ${p.rebuiltCount})`);
  for (const d of p.diffs.slice(0, 8)) {
    const detail = d.kind === 'field-mismatch' ? ` [${d.fields.map((f) => f.field).join(', ')}]` : '';
    console.log(`       ${d.kind}: ${d.voucherNo || d.voucherId}${detail}`);
  }
  if (p.diffs.length > 8) console.log(`       … and ${p.diffs.length - 8} more`);
}

console.log(`\n${okCount} societ${okCount === 1 ? 'y' : 'ies'} ✓ rebuild-ready, ${mismatchCount} with diffs.`);
console.log(mismatchCount === 0
  ? 'All societies rebuild exactly — the vouchers table is a faithful projection of the journal. Safe to flip journalFirstWrites per tenant.'
  : 'Some societies differ — a missing-in-journal voucher needs a genesis re-seed; field-mismatch/extra-in-journal must be investigated (diagnose) before flipping those tenants.');
process.exit(0);

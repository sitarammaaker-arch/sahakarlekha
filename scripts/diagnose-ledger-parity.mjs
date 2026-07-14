// Ledger parity DIAGNOSTIC (T-07) — READ-ONLY. For ONE society, pinpoints WHY its journal and
// vouchers disagree: stale journal aggregates (an event exists but the voucher is deleted/missing)
// and vouchers whose journal legs differ from their current legs (edited before lifecycle events).
// Never writes. Run: node scripts/diagnose-ledger-parity.mjs <societyId>
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

const SID = process.argv[2];
if (!SID) { console.error('Usage: node scripts/diagnose-ledger-parity.mjs <societyId>'); process.exit(2); }
const env = process.env;
const URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
if (!URL || !KEY) { console.error('Missing env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or ANON).'); process.exit(2); }

const { voucherPostingLines } = await import(abs('../src/lib/ledger/voucherEvent.ts'));
const { projectTrialBalance } = await import(abs('../src/lib/ledger/projections.ts'));
const { toRupees } = await import(abs('../src/lib/money.ts'));
const { createClient } = await import('@supabase/supabase-js');
const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const fail = (m, e) => { console.error(`✗ ${m}${e ? ': ' + (e.message || e) : ''}`); process.exit(1); };

async function readAll(table, cols, eqCol, eqVal) {
  const rows = []; const size = 1000; let from = 0;
  for (;;) {
    let q = db.from(table).select(cols).eq(eqCol, eqVal).range(from, from + size - 1);
    const { data, error } = await q;
    if (error) fail(`read ${table}`, error);
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
    from += size;
  }
  return rows;
}

const vouchers = await readAll('vouchers', 'id, date, "debitAccountId", "creditAccountId", amount, lines, "isDeleted", "approvalStatus", "voucherNo"', 'society_id', SID);
const eventRows = await readAll('ledger_events', 'event_id, event_type, aggregate_id, sequence, occurred_at, payload', 'society_id', SID);

const vById = new Map(vouchers.map((v) => [v.id, v]));
const activeIds = new Set(vouchers.filter((v) => !v.isDeleted && v.approvalStatus !== 'pending').map((v) => v.id));

console.log(`\nDiagnose ${SID}\n  vouchers: ${vouchers.length} (active ${activeIds.size})   journal events: ${eventRows.length}\n`);

// 1. STALE journal aggregates — an event whose voucher is deleted or missing (over-counts the journal).
// Only voucher-aggregate events matter here; account.opening events are per-account, not vouchers.
const voucherEventRows = eventRows.filter((e) => e.event_type !== 'account.opening');
const eventsByAgg = new Map();
for (const e of voucherEventRows) { (eventsByAgg.get(e.aggregate_id) ?? eventsByAgg.set(e.aggregate_id, []).get(e.aggregate_id)).push(e); }
const stale = [];
for (const [aggId, evs] of eventsByAgg) {
  if (activeIds.has(aggId)) continue;               // backed by an active voucher — fine
  const v = vById.get(aggId);
  const net = projectTrialBalance(evs);             // this aggregate's journal contribution
  const nonZero = net.lines.filter((l) => l.netMinor !== 0);
  if (nonZero.length === 0) continue;               // already nets to zero (e.g. posted+cancelled) — fine
  stale.push({ aggId, reason: v ? (v.isDeleted ? 'voucher DELETED' : 'voucher pending') : 'voucher MISSING', voucherNo: v?.voucherNo ?? '—', events: evs.map((e) => e.event_type).join('+'), lines: nonZero });
}
console.log(`STALE journal aggregates (event present, but not an active voucher, and not self-netting): ${stale.length}`);
for (const s of stale.slice(0, 25)) {
  console.log(`  • ${s.aggId} [${s.reason}] voucher ${s.voucherNo} — events ${s.events}`);
  for (const l of s.lines) console.log(`      ${l.accountId}: ${l.drMinor ? 'Dr ₹' + toRupees(l.drMinor) : ''}${l.crMinor ? 'Cr ₹' + toRupees(l.crMinor) : ''} (net ₹${toRupees(l.netMinor)})`);
}
if (stale.length > 25) console.log(`  … and ${stale.length - 25} more`);

// 2. ACTIVE vouchers whose journal legs differ from their CURRENT legs (edited before lifecycle events).
const drifted = [];
for (const id of activeIds) {
  const evs = eventsByAgg.get(id);
  if (!evs) continue;                                // not journaled (genesis would have seeded) — not a drift
  const journalNet = projectTrialBalance(evs).lines.reduce((m, l) => { m[l.accountId] = l.netMinor; return m; }, {});
  const voucherNet = {};
  for (const l of voucherPostingLines(vById.get(id))) voucherNet[l.accountId] = (voucherNet[l.accountId] ?? 0) + (l.drCr === 'Dr' ? l.amountMinor : -l.amountMinor);
  const accts = new Set([...Object.keys(journalNet), ...Object.keys(voucherNet)]);
  const bad = [...accts].filter((a) => (journalNet[a] ?? 0) !== (voucherNet[a] ?? 0));
  if (bad.length) drifted.push({ id, voucherNo: vById.get(id).voucherNo, accts: bad });
}
console.log(`\nACTIVE vouchers whose journal ≠ current legs (edited before lifecycle events): ${drifted.length}`);
for (const d of drifted.slice(0, 25)) console.log(`  • ${d.id} (voucher ${d.voucherNo}) — accounts ${d.accts.join(', ')}`);

console.log(`\nFix: these stale/drifted aggregates are dormant shadow rows. Re-baseline this society — delete its`);
console.log(`ledger_events and re-run genesis (seeds cleanly from current active vouchers), then re-check parity.`);
process.exit(0);

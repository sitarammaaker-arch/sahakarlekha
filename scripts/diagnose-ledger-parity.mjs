// Ledger parity DIAGNOSTIC (T-07) — READ-ONLY. Pinpoints WHY a journal and its vouchers disagree:
// stale journal aggregates (an event exists but the voucher is deleted/missing) and vouchers whose
// journal legs differ from their current legs (edited before lifecycle events reached the journal).
// Never writes.
//   node scripts/diagnose-ledger-parity.mjs <societyId>   # one society, full detail
//   node scripts/diagnose-ledger-parity.mjs               # sweep EVERY society, list only the affected
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

const SID = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
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

// Page past the 1000-row cap; optionally scope to one society.
async function readAll(table, cols) {
  const rows = []; const size = 1000; let from = 0;
  for (;;) {
    let q = db.from(table).select(cols).range(from, from + size - 1);
    // `societies` is keyed by `id` (no society_id column) — never scope IT by society_id (it is only a
    // best-effort name label); vouchers/ledger_events do carry society_id and ARE scoped when SID given.
    if (SID && table !== 'societies') q = q.eq('society_id', SID);
    const { data, error } = await q;
    if (error) fail(`read ${table}`, error);
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
    from += size;
  }
  return rows;
}

const allVouchers = await readAll('vouchers', 'id, society_id, date, "debitAccountId", "creditAccountId", amount, lines, "isDeleted", "approvalStatus", "voucherNo"');
const allEvents = await readAll('ledger_events', 'event_id, society_id, event_type, aggregate_id, sequence, occurred_at, payload');
// Society names are a best-effort label (may be blocked by RLS on an anon key — the id still prints).
let names = new Map();
try { names = new Map((await readAll('societies', 'id, name')).map((s) => [String(s.id), s.name])); } catch { /* ignore */ }

// PURE — the stale + drifted analysis for ONE society's vouchers and events.
function analyze(vouchers, eventRows) {
  const vById = new Map(vouchers.map((v) => [v.id, v]));
  const activeIds = new Set(vouchers.filter((v) => !v.isDeleted && v.approvalStatus !== 'pending').map((v) => v.id));

  // Only voucher-aggregate events matter here; account.opening events are per-account, not vouchers.
  const eventsByAgg = new Map();
  for (const e of eventRows) { if (e.event_type === 'account.opening') continue; (eventsByAgg.get(e.aggregate_id) ?? eventsByAgg.set(e.aggregate_id, []).get(e.aggregate_id)).push(e); }

  // 1. STALE — an event whose voucher is deleted/missing/pending and whose legs don't self-net to zero.
  const stale = [];
  for (const [aggId, evs] of eventsByAgg) {
    if (activeIds.has(aggId)) continue;
    const v = vById.get(aggId);
    const nonZero = projectTrialBalance(evs).lines.filter((l) => l.netMinor !== 0);
    if (nonZero.length === 0) continue;
    stale.push({ aggId, reason: v ? (v.isDeleted ? 'voucher DELETED' : 'voucher pending') : 'voucher MISSING', voucherNo: v?.voucherNo ?? '—', events: evs.map((e) => e.event_type).join('+'), lines: nonZero });
  }

  // 2. DRIFTED — an active voucher whose journal legs differ from its CURRENT legs.
  const drifted = [];
  for (const id of activeIds) {
    const evs = eventsByAgg.get(id);
    if (!evs) continue;   // not journaled — not a drift (genesis would seed it)
    const journalNet = projectTrialBalance(evs).lines.reduce((m, l) => { m[l.accountId] = l.netMinor; return m; }, {});
    const voucherNet = {};
    for (const l of voucherPostingLines(vById.get(id))) voucherNet[l.accountId] = (voucherNet[l.accountId] ?? 0) + (l.drCr === 'Dr' ? l.amountMinor : -l.amountMinor);
    const accts = new Set([...Object.keys(journalNet), ...Object.keys(voucherNet)]);
    const bad = [...accts].filter((a) => (journalNet[a] ?? 0) !== (voucherNet[a] ?? 0))
      .map((a) => ({ accountId: a, journal: journalNet[a] ?? 0, voucher: voucherNet[a] ?? 0 }));
    if (bad.length) drifted.push({ id, voucherNo: vById.get(id).voucherNo, events: evs.map((e) => e.event_type).join('+'), bad });
  }
  return { stale, drifted, vouchers: vouchers.length, active: activeIds.size, events: eventRows.length };
}

function printSociety(sid, r) {
  const label = names.get(String(sid)) ? `${sid}  (${names.get(String(sid))})` : sid;
  console.log(`\n─ ${label}\n  vouchers: ${r.vouchers} (active ${r.active})   journal events: ${r.events}`);
  console.log(`  STALE journal aggregates: ${r.stale.length}`);
  for (const s of r.stale.slice(0, 25)) {
    console.log(`    • ${s.aggId} [${s.reason}] voucher ${s.voucherNo} — events ${s.events}`);
    for (const l of s.lines) console.log(`        ${l.accountId}: ${l.drMinor ? 'Dr ₹' + toRupees(l.drMinor) : ''}${l.crMinor ? 'Cr ₹' + toRupees(l.crMinor) : ''} (net ₹${toRupees(l.netMinor)})`);
  }
  if (r.stale.length > 25) console.log(`    … and ${r.stale.length - 25} more`);
  console.log(`  DRIFTED active vouchers (journal legs ≠ current legs): ${r.drifted.length}`);
  for (const d of r.drifted.slice(0, 25)) {
    console.log(`    • ${d.id} (voucher ${d.voucherNo}) — events ${d.events}`);
    for (const b of d.bad) console.log(`        ${b.accountId}: journal ₹${toRupees(b.journal)} ≠ voucher ₹${toRupees(b.voucher)}`);
  }
  if (r.drifted.length > 25) console.log(`    … and ${r.drifted.length - 25} more`);
}

// Group by society (one group when scoped).
const bySoc = new Map();
for (const v of allVouchers) { const k = String(v.society_id); (bySoc.get(k) ?? bySoc.set(k, { vouchers: [], events: [] }).get(k)).vouchers.push(v); }
for (const e of allEvents) { const k = String(e.society_id); (bySoc.get(k) ?? bySoc.set(k, { vouchers: [], events: [] }).get(k)).events.push(e); }

console.log(`\nDiagnose ledger parity ${SID ? `— society ${SID}` : '— sweep ALL societies'}  (READ-ONLY)`);
let affected = 0;
const summary = [];
for (const [sid, { vouchers, events }] of bySoc) {
  const r = analyze(vouchers, events);
  const bad = r.stale.length + r.drifted.length;
  summary.push({ sid, name: names.get(sid) ?? '', stale: r.stale.length, drifted: r.drifted.length });
  if (SID || bad > 0) { printSociety(sid, r); if (bad > 0) affected++; }
}

if (!SID) {
  console.log(`\n══ SWEEP SUMMARY ── ${bySoc.size} societies scanned, ${affected} with drift ──`);
  for (const s of summary.filter((x) => x.stale + x.drifted > 0).sort((a, b) => (b.stale + b.drifted) - (a.stale + a.drifted))) {
    console.log(`  ${s.sid}${s.name ? '  (' + s.name + ')' : ''} — stale ${s.stale}, drifted ${s.drifted}`);
  }
  if (affected === 0) console.log('  ✓ No society has a stale or drifted voucher aggregate.');
}

console.log(`\nThese are dormant shadow rows — the parity gate already falls back to voucher-state, so live reports are correct.`);
console.log(`Fix (per affected society): reverse/cancel or re-post the culprit through the app so the journal gets a`);
console.log(`lifecycle event, OR re-baseline (delete that society's ledger_events + re-run genesis), then re-check parity.`);
process.exit(0);

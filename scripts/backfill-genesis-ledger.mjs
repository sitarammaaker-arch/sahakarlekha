// Genesis ledger backfill (T-06 / ADR-0001) — seed `ledger_events` from the CURRENT vouchers so the
// journal reproduces the EXISTING trial balance (the prerequisite for T-07 parity and the T-09 cut).
// PURE decisions live in src/lib/ledger/genesis.ts (planGenesisEvents); this does the Supabase I/O.
//
// SAFE BY DESIGN:
//   • DRY-RUN by default — prints the plan (per society, balance check) and writes nothing. --commit writes.
//   • Skips vouchers that ALREADY have a voucher.posted event in the journal (live-path emitted one),
//     so genesis only fills the historical gap — never double-counts a balance.
//   • Deterministic event ids (genesis-<voucherId>) + upsert on conflict → idempotent re-runs.
//   • Writing rows is DORMANT: the journal is not authoritative until the T-09 cut. Never flips a flag.
//
// Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (preferred; reads every tenant) or SUPABASE_ANON_KEY.
//   node scripts/backfill-genesis-ledger.mjs                     # dry-run (report only)
//   node scripts/backfill-genesis-ledger.mjs --commit            # write the events
//   node scripts/backfill-genesis-ledger.mjs --reseed            # + report stale payloads (dry-run)
//   node scripts/backfill-genesis-ledger.mjs --reseed --commit   # + refresh stale payloads in place
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

const COMMIT = process.argv.includes('--commit');
// --reseed: also refresh STALE payloads on events that already exist (see reseedPayloads at the
// bottom). Seeding alone can never fix them — it only adds events for vouchers not yet journaled.
const RESEED = process.argv.includes('--reseed');
const env = process.env;
const URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.error('Missing env. Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY.');
  process.exit(2);
}
const USING_SERVICE = !!env.SUPABASE_SERVICE_ROLE_KEY;

const { planGenesisEvents, planOpeningEvents } = await import(abs('../src/lib/ledger/genesis.ts'));
const { projectTrialBalance } = await import(abs('../src/lib/ledger/projections.ts'));
const { voucherEventMeta, voucherPostingLines } = await import(abs('../src/lib/ledger/voucherEvent.ts'));
const { createClient } = await import('@supabase/supabase-js');
const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const fail = (msg, err) => { console.error(`✗ ${msg}${err ? ': ' + (err.message || err) : ''}`); process.exit(1); };

// Page past the 1000-row cap.
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

// narration / createdAt / memberId are part of the event payload (voucherEventMeta) — the ledger
// reads need them (cash-book particulars, the same-date sort key, the member ledger's filter). They
// were missing from this select, so every genesis event was seeded with empty metadata.
const vouchers = await readAll('vouchers', 'id, type, date, "debitAccountId", "creditAccountId", amount, lines, "isDeleted", "approvalStatus", "voucherNo", narration, "createdAt", "memberId", society_id, jurisdiction');
const accounts = await readAll('accounts', 'id, "openingBalance", "openingBalanceType", society_id, jurisdiction');
const existingEvents = await readAll('ledger_events', 'aggregate_id, event_type');

// Skip aggregates that already have a posted event (live-path) — genesis fills only the gap.
const alreadyPosted = new Set(existingEvents.filter((e) => e.event_type === 'voucher.posted').map((e) => e.aggregate_id));
const inputs = vouchers
  .filter((v) => !alreadyPosted.has(v.id))
  .map((v) => ({ voucher: v, tenantId: v.society_id, jurisdiction: v.jurisdiction ?? undefined }));

const plan = planGenesisEvents(inputs);

// Opening-balance events (T-06): getTrialBalance = openings + voucher postings, so the journal needs
// the openings too. One account.opening event per account with a non-zero opening balance, dated
// before all vouchers. Skip accounts that already have one (idempotent). Grouped by society.
const alreadyOpened = new Set(existingEvents.filter((e) => e.event_type === 'account.opening').map((e) => e.aggregate_id));
const acctsBySoc = new Map();
for (const a of accounts) { if (alreadyOpened.has(a.id)) continue; (acctsBySoc.get(a.society_id) ?? acctsBySoc.set(a.society_id, []).get(a.society_id)).push(a); }
const openingEvents = [];
for (const [sid, accts] of acctsBySoc) {
  if (!sid) continue;
  openingEvents.push(...planOpeningEvents(accts, sid, { openingDate: '2000-01-01', jurisdiction: accts[0]?.jurisdiction ?? undefined }));
}
plan.events.push(...openingEvents);

// Map a LedgerEvent onto the ledger_events columns (identical to DataContext.persistLedgerEvent).
const toRow = (e) => ({
  event_id: e.eventId, event_type: e.eventType, schema_version: e.schemaVersion,
  society_id: e.tenantId, jurisdiction: e.jurisdiction || null,
  aggregate_type: e.aggregateType, aggregate_id: e.aggregateId, sequence: e.sequence,
  occurred_at: e.occurredAt, producer_kind: e.producer.kind, producer_id: e.producer.id ?? null,
  on_behalf_of: e.producer.onBehalfOf ?? null, reversal_of: e.reversalOf ?? null, payload: e.payload,
});

// Per-society balance sanity: replay of each society's genesis events must balance (Dr === Cr).
const bySociety = new Map();
for (const e of plan.events) { const k = e.tenantId; (bySociety.get(k) ?? bySociety.set(k, []).get(k)).push(e); }
let unbalanced = 0;
for (const [sid, evs] of bySociety) { const tb = projectTrialBalance(evs); if (!tb.balanced) { unbalanced++; console.log(`   ⚠ ${sid}: genesis TB NOT balanced (Dr ${tb.totalDrMinor} ≠ Cr ${tb.totalCrMinor})`); } }

console.log(`\nGenesis ledger backfill ${COMMIT ? '(COMMIT)' : '(DRY-RUN)'} — key: ${USING_SERVICE ? 'service-role' : 'anon'}`);
console.log(`  vouchers read:              ${vouchers.length}`);
console.log(`  already journaled (skip):   ${vouchers.length - inputs.length}`);
console.log(`  to seed (voucher events):   ${plan.seeded}  across ${bySociety.size} societ${bySociety.size === 1 ? 'y' : 'ies'}`);
console.log(`  to seed (opening events):   ${openingEvents.length}`);
console.log(`  skipped deleted:            ${plan.skippedDeleted}`);
console.log(`  skipped pending:            ${plan.skippedPending}`);
console.log(`  skipped empty (no legs):    ${plan.skippedEmpty}`);
console.log(`  societies with unbalanced genesis TB: ${unbalanced}${unbalanced ? '  ⚠ REVIEW before commit' : '  ✓'}`);

if (!COMMIT) {
  console.log('\nDRY-RUN — nothing written. Re-run with --commit to seed the events above.');
  console.log('Note: seeding is DORMANT — the journal is not authoritative until the T-09 cut.');
  await reseedPayloads();
  process.exit(0);
}
if (plan.events.length === 0) { console.log('\nNothing to seed.'); await reseedPayloads(); process.exit(0); }
if (unbalanced > 0) { console.log('\n✗ Refusing to commit: some societies have an unbalanced genesis TB (see ⚠ above). Fix the data first.'); process.exit(1); }

// Upsert in batches on the deterministic event_id (idempotent). Never touches any flag.
const rows = plan.events.map(toRow);
const BATCH = 500;
let written = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const { error } = await db.from('ledger_events').upsert(chunk, { onConflict: 'event_id' });
  if (error) fail(`write ledger_events (batch @${i})`, error);
  written += chunk.length;
}
console.log(`\n✓ Seeded ${written} genesis events into ledger_events (dormant — journal not yet authoritative).`);
await reseedPayloads();
process.exit(0);

// ── --reseed: refresh STALE event payloads in place ──────────────────────────────────────────────
// Seeding only ever ADDS events for vouchers the journal has never seen, so an event written before
// the payload was enriched (narration + createdAt + memberId — the fields the cash book, the running
// balance's sort key and the member ledger need) keeps its old, thin payload forever. This refreshes
// those payloads on the aggregate's CURRENT effective event (the latest repost, else the post),
// leaving the posting legs and the event's identity untouched: same event_id, same sequence, same
// occurred_at. It is a payload correction, not a rewrite of history — no event is ever deleted.
//
// Legs are NOT auto-fixed. If an event's legs no longer match its voucher (a voucher edited before
// the lifecycle events existed), that is real drift the balances will disagree on — it is reported
// here and belongs to scripts/diagnose-ledger-parity.mjs, not to a silent overwrite.
//
//   node scripts/backfill-genesis-ledger.mjs --reseed            # dry-run: what would be refreshed
//   node scripts/backfill-genesis-ledger.mjs --reseed --commit   # write the refreshed payloads
async function reseedPayloads() {
  if (!RESEED) return;

  const events = await readAll('ledger_events', '*');
  const byAggregate = new Map();
  for (const e of events) {
    if (e.aggregate_type !== 'voucher') continue;
    (byAggregate.get(e.aggregate_id) ?? byAggregate.set(e.aggregate_id, []).get(e.aggregate_id)).push(e);
  }

  const META_KEYS = ['voucherNo', 'type', 'amount', 'date', 'narration', 'createdAt', 'memberId'];
  const sameLegs = (have, want) =>
    Array.isArray(have) && have.length === want.length &&
    want.every((l, i) => have[i]?.accountId === l.accountId && have[i]?.drCr === l.drCr && have[i]?.amountMinor === l.amountMinor);

  const refreshed = [];
  let drifted = 0, cancelled = 0, unjournaled = 0, fresh = 0;
  for (const v of vouchers) {
    if (v.isDeleted || v.approvalStatus === 'pending') continue;
    const evs = byAggregate.get(v.id);
    if (!evs) { unjournaled++; continue; }
    if (evs.some((e) => e.event_type === 'voucher.cancelled')) { cancelled++; continue; }

    // The aggregate's current effective event — what every transaction projection reads.
    const reposts = evs.filter((e) => e.event_type === 'voucher.reposted').sort((a, b) => a.sequence - b.sequence);
    const eff = reposts.length ? reposts[reposts.length - 1] : evs.find((e) => e.event_type === 'voucher.posted');
    if (!eff) { unjournaled++; continue; }

    const payload = eff.payload ?? {};
    if (!sameLegs(payload.lines, voucherPostingLines(v))) { drifted++; continue; }

    const meta = voucherEventMeta(v);
    if (!META_KEYS.some((k) => (payload[k] ?? '') !== (meta[k] ?? ''))) { fresh++; continue; }
    refreshed.push({ ...eff, payload: { ...payload, ...meta } });
  }

  console.log(`\nPayload re-seed ${COMMIT ? '(COMMIT)' : '(DRY-RUN)'}`);
  console.log(`  events read:                 ${events.length}`);
  console.log(`  payloads to refresh:         ${refreshed.length}`);
  console.log(`  already current:             ${fresh}`);
  console.log(`  cancelled (skip):            ${cancelled}`);
  console.log(`  not journaled (skip):        ${unjournaled}`);
  console.log(`  LEGS DRIFTED (not touched):  ${drifted}${drifted ? '  ⚠ balances disagree — run diagnose-ledger-parity.mjs' : '  ✓'}`);

  if (!refreshed.length) { console.log('  nothing to refresh.'); return; }
  if (!COMMIT) { console.log('\nDRY-RUN — no payload written. Re-run with --reseed --commit.'); return; }

  const BATCH = 500;
  let n = 0;
  for (let i = 0; i < refreshed.length; i += BATCH) {
    const chunk = refreshed.slice(i, i + BATCH);
    const { error } = await db.from('ledger_events').upsert(chunk, { onConflict: 'event_id' });
    if (error) fail(`refresh ledger_events payloads (batch @${i})`, error);
    n += chunk.length;
  }
  console.log(`\n✓ Refreshed ${n} event payloads in place (same event_id / sequence / occurred_at — legs untouched).`);
}

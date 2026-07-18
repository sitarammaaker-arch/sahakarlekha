// Cancelled-voucher ledger RECONCILE (T-09 / ADR-0001) — repair the WORM journal where a DELETED
// voucher's events do NOT net to zero, in EITHER direction, WITHOUT deleting a single event.
//
// WHY THIS EXISTS
//   A cancelled voucher should book TWO events — voucher.posted (original legs) + voucher.cancelled
//   (reversing legs) — which net to zero, so a deleted voucher contributes nothing to the trial
//   balance. Two drifts break that, and this script repairs both by APPENDING the missing half:
//
//   (1) ORPHAN CANCEL (cancel, no posting). The live cancel path (DataContext.cancelVoucher) appended a
//       reversing event even when the journal never held a posting for that voucher (posted BEFORE the
//       journal/genesis existed; genesis SKIPS deleted vouchers so it never seeded the posting either).
//       The reversal's legs then sit with nothing to cancel — a per-account drift (Rania: CV/2026/27/320
//       + /329 → 3301 +₹25,000, bank −₹25,000). Fix: append the missing voucher.posted (the legs genesis
//       would have seeded). posted + cancelled net to zero.
//
//   (2) ORPHAN POSTING (posting, no cancel). The SAME live cancel path appends the reversing event ONLY
//       when the voucher's posting is already in the in-memory journal. For a tenant whose full journal
//       wasn't loaded at cancel time (ledgerReads off, or a failed/in-flight/truncated load), the guard
//       saw no posting and appended nothing — so a cancelled voucher keeps a LIVE voucher.posted that
//       over-counts every raw-journal read (the ₹52L D-lane over-count; founder society
//       d5e007f0-fef0-48dd-b5dc-7230ce0aa82c). Fix: append the missing voucher.cancelled (reversing
//       legs), reversalOf → the live posting. posted + cancelled net to zero. (The live path is now
//       hardened via ensureVoucherCancelEvent, so new cancels don't drift; this repairs the historical.)
//
//   In BOTH cases the appended event yields exactly the shape a normally-cancelled voucher has, which
//   every projection already handles (that is why the bank book stayed green while the trial balance drifted).
//
// SAFE BY DESIGN
//   • DRY-RUN by default — prints every repair and the posting it would append; writes nothing. --commit writes.
//   • APPEND-ONLY — never deletes or edits an event. The appended posting uses the deterministic
//     genesis id (genesis-<voucherId>) → idempotent under upsert.
//   • VERIFIED — a repair is only planned if, after appending the posting, the aggregate provably nets
//     to ZERO on every account. Anything that does not (missing voucher row, edited legs, odd shape) is
//     reported for MANUAL review and never auto-touched.
//   • Optional <societyId> scopes to one tenant; omit to sweep every society.
//
// Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (preferred; every tenant) or SUPABASE_ANON_KEY.
//   node scripts/reconcile-cancelled-ledger.mjs <societyId>            # dry-run, one society
//   node scripts/reconcile-cancelled-ledger.mjs <societyId> --commit   # append the missing postings
//   node scripts/reconcile-cancelled-ledger.mjs                        # dry-run, ALL societies (sweep)
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

const argv = process.argv.slice(2);
const COMMIT = argv.includes('--commit');
const SID = argv.find((a) => !a.startsWith('--')) || null;
const env = process.env;
const URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.error('Missing env. Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY.');
  process.exit(2);
}
const USING_SERVICE = !!env.SUPABASE_SERVICE_ROLE_KEY;

const { buildEvent } = await import(abs('../src/lib/ledger/event.ts'));
const { genesisEventId } = await import(abs('../src/lib/ledger/genesis.ts'));
const { voucherPostingLines, voucherReversalLines, voucherEventMeta } = await import(abs('../src/lib/ledger/voucherEvent.ts'));
const { projectTrialBalance } = await import(abs('../src/lib/ledger/projections.ts'));
const { toRupees } = await import(abs('../src/lib/money.ts'));
const { createClient } = await import('@supabase/supabase-js');
const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const fail = (msg, err) => { console.error(`✗ ${msg}${err ? ': ' + (err.message || err) : ''}`); process.exit(1); };

async function readAll(table, cols) {
  const rows = []; const size = 1000; let from = 0;
  for (;;) {
    let q = db.from(table).select(cols).range(from, from + size - 1);
    if (SID) q = q.eq('society_id', SID);
    const { data, error } = await q;
    if (error) fail(`read ${table}`, error);
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
    from += size;
  }
  return rows;
}

const vouchers = await readAll('vouchers', 'id, society_id, type, date, "debitAccountId", "creditAccountId", amount, lines, "isDeleted", "deletedAt", "deletedReason", "approvalStatus", "voucherNo", narration, "createdAt", "memberId", jurisdiction');
const events = await readAll('ledger_events', 'event_id, society_id, jurisdiction, event_type, aggregate_id, sequence, occurred_at, payload');
let names = new Map();
try { names = new Map((await readAll('societies', 'id, name')).map((s) => [String(s.id), s.name])); } catch { /* ignore */ }

const vById = new Map(vouchers.map((v) => [v.id, v]));
const eventsByAgg = new Map();
for (const e of events) {
  if (e.event_type === 'account.opening') continue;
  (eventsByAgg.get(e.aggregate_id) ?? eventsByAgg.set(e.aggregate_id, []).get(e.aggregate_id)).push(e);
}

// Project a set of raw event rows to per-account net (minor) — same shape the parity gate uses.
const netOf = (evs) => projectTrialBalance(evs.map((e) => ({ eventType: e.event_type, payload: e.payload }))).lines.filter((l) => l.netMinor !== 0);

const fixes = [];    // { sid, voucherId, voucherNo, postedEvent, lines }
const manual = [];   // { sid, voucherId, voucherNo, reason }
let inSync = 0;      // deleted vouchers that already self-net (normal posted+cancelled)
let activeSkipped = 0;

for (const [aggId, evs] of eventsByAgg) {
  const v = vById.get(aggId);
  const sid = String(evs[0].society_id);
  const label = v?.voucherNo ?? '—';

  // Only DELETED / PENDING / MISSING voucher aggregates are SUPPOSED to net to zero in the journal.
  // An ACTIVE voucher's journal net is its live postings — non-zero by design, NOT a problem. (Drift
  // where an active voucher's journal legs ≠ its current legs is a different check — that belongs to
  // diagnose-ledger-parity, which compares against the voucher's legs; here we'd have no basis to
  // "repair" it.) Skip active vouchers entirely so healthy balances are never misreported.
  const shouldNetZero = !v || v.isDeleted || v.approvalStatus === 'pending';
  if (!shouldNetZero) { activeSkipped++; continue; }

  const nonZero = netOf(evs);
  if (nonZero.length === 0) { inSync++; continue; }        // self-netting (normal posted+cancelled) — fine

  // Auto-repair the two CONFIRMED reconcilable shapes of a DELETED voucher whose journal does NOT
  // net to zero:
  //   (1) orphan CANCEL  — a voucher.cancelled but NO posting → append the missing voucher.posted (the
  //       legs genesis would have seeded). posted + cancelled then net to zero.
  //   (2) orphan POSTING — a posting but NO voucher.cancelled → append the missing voucher.cancelled
  //       (reversing legs). This is the drift the LIVE cancel path left when the journal wasn't loaded
  //       at cancel time: the voucher.posted stays LIVE and over-counts every raw-journal read.
  // Missing rows / pending / both-present-yet-still-nonzero (edited legs) → MANUAL, never touched.
  if (!v) { manual.push({ sid, voucherId: aggId, voucherNo: label, reason: 'no voucher row (MISSING) — cannot rebuild legs' }); continue; }
  if (!v.isDeleted) { manual.push({ sid, voucherId: aggId, voucherNo: label, reason: `pending voucher with non-zero journal (${evs.map((e) => e.event_type).join('+')}) — review` }); continue; }

  const hasPosting = evs.some((e) => e.event_type === 'voucher.posted' || e.event_type === 'voucher.reposted');
  const hasCancel = evs.some((e) => e.event_type === 'voucher.cancelled');
  const maxSeq = evs.reduce((m, e) => Math.max(m, e.sequence || 0), 0);
  let appendEvent = null;   // the ONE event this repair appends
  let kind = null;          // 'posting' | 'cancel' — for reporting

  if (!hasPosting && hasCancel) {
    // (1) rebuild the original posting at a fresh sequence (the lone cancel already occupies its
    // sequence — the unique index forbids reuse), dated at the voucher date so it sorts before the cancel.
    const lines = voucherPostingLines(v);
    if (lines.length === 0) { manual.push({ sid, voucherId: aggId, voucherNo: label, reason: 'voucher has no posting legs to rebuild' }); continue; }
    appendEvent = buildEvent(
      {
        eventType: 'voucher.posted', tenantId: sid, jurisdiction: v.jurisdiction ?? undefined,
        aggregateType: 'voucher', aggregateId: aggId, sequence: maxSeq + 1,
        producer: { kind: 'import', id: 'cancelled-reconcile' },
        payload: { lines, ...voucherEventMeta(v), genesis: true, reconciledPosting: true },
      },
      { eventId: genesisEventId(aggId), occurredAt: `${v.date}T00:00:00.000Z` },
    );
    kind = 'posting';
  } else if (hasPosting && !hasCancel) {
    // (2) append the missing reversing cancel. reversalOf → the CURRENT posting (latest reposted, else
    // posted). Reversing legs come from the voucher itself; dated at deletedAt (else just after the
    // posting) so it sorts after. Deterministic id in a distinct namespace from genesis → idempotent.
    let postedId, repostId, repostSeq = -1;
    for (const e of evs) {
      if (e.event_type === 'voucher.posted') postedId = e.event_id;
      else if (e.event_type === 'voucher.reposted' && (e.sequence || 0) > repostSeq) { repostSeq = e.sequence || 0; repostId = e.event_id; }
    }
    const postingId = repostId ?? postedId;
    const lines = voucherReversalLines(v);
    if (lines.length === 0) { manual.push({ sid, voucherId: aggId, voucherNo: label, reason: 'voucher has no legs to reverse' }); continue; }
    appendEvent = buildEvent(
      {
        eventType: 'voucher.cancelled', tenantId: sid, jurisdiction: v.jurisdiction ?? undefined,
        aggregateType: 'voucher', aggregateId: aggId, sequence: maxSeq + 1, reversalOf: postingId,
        producer: { kind: 'import', id: 'cancelled-reconcile' },
        payload: { lines, ...voucherEventMeta(v), reconciledCancel: true, reason: v.deletedReason || 'reconcile: missing cancel for deleted voucher' },
      },
      { eventId: `reconcile-cancel-${aggId}`, occurredAt: v.deletedAt || `${v.date}T00:00:01.000Z` },
    );
    kind = 'cancel';
  } else {
    // both present yet still non-zero (edited legs), or neither (some other non-zero event). Manual.
    manual.push({ sid, voucherId: aggId, voucherNo: label, reason: `deleted voucher with non-netting event shape (${evs.map((e) => e.event_type).join('+')}) — review` });
    continue;
  }

  // VERIFY: after appending, the aggregate must net to ZERO on every account. Else leave it for manual.
  const after = netOf([...evs, { event_type: appendEvent.eventType, payload: appendEvent.payload }]);
  if (after.length !== 0) {
    manual.push({ sid, voucherId: aggId, voucherNo: label, reason: `appended ${kind} does not net to zero (legs changed?) — residual ${after.map((l) => l.accountId + ':₹' + toRupees(l.netMinor)).join(', ')}` });
    continue;
  }
  fixes.push({ sid, voucherId: aggId, voucherNo: label, appendEvent, kind, lines: nonZero });
}

const toRow = (e) => ({
  event_id: e.eventId, event_type: e.eventType, schema_version: e.schemaVersion,
  society_id: e.tenantId, jurisdiction: e.jurisdiction || null,
  aggregate_type: e.aggregateType, aggregate_id: e.aggregateId, sequence: e.sequence,
  occurred_at: e.occurredAt, producer_kind: e.producer.kind, producer_id: e.producer.id ?? null,
  on_behalf_of: e.producer.onBehalfOf ?? null, reversal_of: e.reversalOf ?? null, payload: e.payload,
});

const bySoc = new Map();
for (const f of fixes) (bySoc.get(f.sid) ?? bySoc.set(f.sid, []).get(f.sid)).push(f);

console.log(`\nCancelled-voucher reconcile ${COMMIT ? '(COMMIT)' : '(DRY-RUN)'} — key: ${USING_SERVICE ? 'service-role' : 'anon'}${SID ? `  society: ${SID}` : '  (all societies)'}`);
console.log(`  voucher aggregates in journal:   ${eventsByAgg.size}`);
console.log(`  active vouchers (out of scope):  ${activeSkipped}`);
console.log(`  deleted & self-netting (fine):   ${inSync}`);
const nPostFix = fixes.filter((f) => f.kind === 'posting').length;
const nCancelFix = fixes.filter((f) => f.kind === 'cancel').length;
console.log(`  REPAIRABLE (append 1 event):     ${fixes.length}  (${nPostFix} missing-posting, ${nCancelFix} missing-cancel)  across ${bySoc.size} societ${bySoc.size === 1 ? 'y' : 'ies'}`);
console.log(`  MANUAL review (not auto-fixed):   ${manual.length}`);

for (const [sid, fs] of bySoc) {
  console.log(`\n  society ${sid}${names.get(sid) ? '  (' + names.get(sid) + ')' : ''} — ${fs.length} repair(s):`);
  for (const f of fs) {
    console.log(`    • voucher ${f.voucherNo} (${f.voucherId}) — append ${f.appendEvent.eventType} ${f.appendEvent.eventId}`);
    for (const l of f.lines) console.log(`        nets out ${l.accountId}: ${l.drMinor ? 'Dr ₹' + toRupees(l.drMinor) : ''}${l.crMinor ? 'Cr ₹' + toRupees(l.crMinor) : ''} (was net ₹${toRupees(l.netMinor)} → 0)`);
  }
}
if (manual.length) {
  console.log(`\n  MANUAL review — these are NOT auto-fixed:`);
  for (const m of manual.slice(0, 50)) console.log(`    • ${m.voucherNo} (${m.voucherId}) [${m.sid}] — ${m.reason}`);
  if (manual.length > 50) console.log(`    … and ${manual.length - 50} more`);
}

if (!fixes.length) { console.log('\n✓ No repairable orphan (posting-only / cancel-only) aggregates found.'); process.exit(0); }
if (!COMMIT) {
  console.log('\nDRY-RUN — nothing written. Re-run with --commit to append the missing events above.');
  console.log('Append-only: no event is deleted; posted + cancelled will then net to zero (a normal cancelled voucher).');
  process.exit(0);
}

const rows = fixes.map((f) => toRow(f.appendEvent));
const BATCH = 500;
let written = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const { error } = await db.from('ledger_events').upsert(chunk, { onConflict: 'event_id' });
  if (error) fail(`write ledger_events (batch @${i})`, error);
  written += chunk.length;
}
console.log(`\n✓ Appended ${written} missing event(s) (${nPostFix} posting, ${nCancelFix} cancel). Re-run the parity check — trialBalance should now be green.`);
process.exit(0);

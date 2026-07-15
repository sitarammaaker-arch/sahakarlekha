// Opening-balance ledger RECONCILE (T-09 / ADR-0001) — bring the WORM journal's `account.opening`
// balances back in step with each account's CURRENT opening, WITHOUT deleting a single event.
//
// WHY THIS EXISTS
//   getTrialBalance = account openings + voucher postings. The journal carries the openings as
//   `account.opening` events. When an opening balance is EDITED, the live path is supposed to append a
//   signed DELTA event (planOpeningDelta) so the account's opening events keep summing to the current
//   opening. If that delta was never appended — the edit happened before the T-09 live-delta wiring, or
//   while the journal was not paged into memory (buildOpeningDelta no-ops on !journalLoaded), or via a
//   path that bypasses it (resetAccounts) — the journal's opening freezes at its old value while the
//   voucher-state trial balance moves. Result: the trialBalance parity gate reports a per-account drift
//   (e.g. `account 3301: journal 25000 ≠ vouchers 0`) even though every transaction report is green,
//   because the break is in the OPENING, not the transactions.
//
//   Genesis re-seed does NOT fix this: backfill-genesis-ledger.mjs SKIPS any account that already has an
//   opening event, so a stale one is never re-based. Only a full delete+reseed would — but that throws
//   away the WORM history a cut-over tenant is actively serving reads from. This script instead APPENDS
//   one corrective delta per drifted account: the journal's opening events then sum to the current
//   opening, parity goes green, and the correction is itself an auditable event (lineage preserved).
//
// SAFE BY DESIGN
//   • DRY-RUN by default — prints every drift and the delta it would append; writes nothing. --commit writes.
//   • APPEND-ONLY — never deletes or rewrites an event. Deltas use planOpeningDelta (the same pure
//     function the live path uses), dated at the opening epoch so replay order is unchanged.
//   • Idempotent — a second run finds journal == current for every account and appends nothing.
//   • Optional <societyId> scopes to one tenant; omit to sweep every society.
//
// Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (preferred; every tenant) or SUPABASE_ANON_KEY.
//   node scripts/reconcile-opening-ledger.mjs <societyId>            # dry-run, one society
//   node scripts/reconcile-opening-ledger.mjs <societyId> --commit   # append the deltas
//   node scripts/reconcile-opening-ledger.mjs                        # dry-run, ALL societies (sweep)
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
const SID = argv.find((a) => !a.startsWith('--')) || null;   // optional society scope
const env = process.env;
const URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.error('Missing env. Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY.');
  process.exit(2);
}
const USING_SERVICE = !!env.SUPABASE_SERVICE_ROLE_KEY;

const { planOpeningDelta } = await import(abs('../src/lib/ledger/genesis.ts'));
const { toMinor, toRupees } = await import(abs('../src/lib/money.ts'));
const { createClient } = await import('@supabase/supabase-js');
const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const fail = (msg, err) => { console.error(`✗ ${msg}${err ? ': ' + (err.message || err) : ''}`); process.exit(1); };

// Page past the 1000-row cap; optionally scope to one society.
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

const accounts = await readAll('accounts', 'id, "openingBalance", "openingBalanceType", society_id, jurisdiction');
const openingEvents = await readAll('ledger_events', 'event_id, society_id, jurisdiction, aggregate_id, event_type, sequence, payload')
  .then((rows) => rows.filter((e) => e.event_type === 'account.opening'));

// The journal's current signed opening (Dr − Cr, paise) and the highest sequence, per (society, account).
const key = (sid, aid) => `${sid}::${aid}`;
const journalOpening = new Map();   // key → { signedMinor, maxSeq, jurisdiction }
for (const e of openingEvents) {
  const k = key(e.society_id, e.aggregate_id);
  const cur = journalOpening.get(k) ?? { signedMinor: 0, maxSeq: 0, jurisdiction: e.jurisdiction ?? undefined };
  const lines = (e.payload && e.payload.lines) || [];
  for (const l of lines) cur.signedMinor += l.drCr === 'Dr' ? l.amountMinor : -l.amountMinor;
  if (e.sequence > cur.maxSeq) cur.maxSeq = e.sequence;
  journalOpening.set(k, cur);
}

// An account's CURRENT signed opening (Dr positive), in paise — the value the journal must reproduce.
const currentSigned = (a) => {
  const amt = toMinor(Number(a.openingBalance) || 0);
  return a.openingBalanceType === 'debit' ? amt : -amt;
};

// Reconcile every (society, account) that appears on EITHER side: live accounts, plus accounts that
// only survive as journal openings (deleted without a zeroing delta — their opening must net to 0).
const acctById = new Map(accounts.map((a) => [key(a.society_id, a.id), a]));
const allKeys = new Set([...acctById.keys(), ...journalOpening.keys()]);

const deltas = [];      // { sid, accountId, prevSigned, curSigned, event }
let inSync = 0, deletedZeroing = 0;
for (const k of allKeys) {
  const [sid, aid] = k.split('::');
  const jrn = journalOpening.get(k) ?? { signedMinor: 0, maxSeq: 0, jurisdiction: undefined };
  const acct = acctById.get(k);
  // Live account → target = its current opening. Deleted (journal-only) account → target = 0.
  const target = acct ? currentSigned(acct) : 0;
  if (jrn.signedMinor === target) { inSync++; continue; }

  // planOpeningDelta computes (new − prev) and emits a signed leg. For a deleted account we feed a
  // zeroed account so the delta nets the journal opening to 0.
  const forDelta = acct
    ? { id: aid, openingBalance: acct.openingBalance, openingBalanceType: acct.openingBalanceType }
    : { id: aid, openingBalance: 0, openingBalanceType: 'credit' };
  const jurisdiction = acct?.jurisdiction ?? jrn.jurisdiction ?? undefined;
  const event = planOpeningDelta(forDelta, jrn.signedMinor, jrn.maxSeq + 1, sid, {
    jurisdiction,
    producer: { kind: 'import', id: 'opening-reconcile' },
  });
  if (!event) { inSync++; continue; }   // no net change (shouldn't happen given the guard above)
  if (!acct) deletedZeroing++;
  deltas.push({ sid, accountId: aid, prevSigned: jrn.signedMinor, curSigned: target, deleted: !acct, event });
}

// Map a LedgerEvent onto the ledger_events columns (identical to DataContext.persistLedgerEvent).
const toRow = (e) => ({
  event_id: e.eventId, event_type: e.eventType, schema_version: e.schemaVersion,
  society_id: e.tenantId, jurisdiction: e.jurisdiction || null,
  aggregate_type: e.aggregateType, aggregate_id: e.aggregateId, sequence: e.sequence,
  occurred_at: e.occurredAt, producer_kind: e.producer.kind, producer_id: e.producer.id ?? null,
  on_behalf_of: e.producer.onBehalfOf ?? null, reversal_of: e.reversalOf ?? null, payload: e.payload,
});

const bySoc = new Map();
for (const d of deltas) (bySoc.get(d.sid) ?? bySoc.set(d.sid, []).get(d.sid)).push(d);

console.log(`\nOpening-balance reconcile ${COMMIT ? '(COMMIT)' : '(DRY-RUN)'} — key: ${USING_SERVICE ? 'service-role' : 'anon'}${SID ? `  society: ${SID}` : '  (all societies)'}`);
console.log(`  accounts read:              ${accounts.length}`);
console.log(`  account.opening events:     ${openingEvents.length}`);
console.log(`  in sync (no delta):         ${inSync}`);
console.log(`  DRIFTED (delta to append):  ${deltas.length}  across ${bySoc.size} societ${bySoc.size === 1 ? 'y' : 'ies'}`);
console.log(`    of which deleted-account zeroing: ${deletedZeroing}`);

for (const [sid, ds] of bySoc) {
  console.log(`\n  society ${sid} — ${ds.length} drift(s):`);
  for (const d of ds.slice(0, 50)) {
    const arrow = `journal ₹${toRupees(d.prevSigned)} → current ₹${toRupees(d.curSigned)}`;
    console.log(`    • ${d.accountId}${d.deleted ? ' [deleted → zero]' : ''}: ${arrow}  (delta event ${d.event.eventId})`);
  }
  if (ds.length > 50) console.log(`    … and ${ds.length - 50} more`);
}

if (!deltas.length) { console.log('\n✓ Every account opening already matches the journal — nothing to reconcile.'); process.exit(0); }
if (!COMMIT) {
  console.log('\nDRY-RUN — nothing written. Re-run with --commit to append the corrective delta events above.');
  console.log('Append-only: no event is deleted; the journal openings will then sum to the current opening.');
  process.exit(0);
}

// Upsert on the deterministic event_id (idempotent). Never touches any flag or existing event.
const rows = deltas.map((d) => toRow(d.event));
const BATCH = 500;
let written = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const { error } = await db.from('ledger_events').upsert(chunk, { onConflict: 'event_id' });
  if (error) fail(`write ledger_events (batch @${i})`, error);
  written += chunk.length;
}
console.log(`\n✓ Appended ${written} corrective account.opening delta event(s). Re-run the parity check — trialBalance should now be green.`);
process.exit(0);

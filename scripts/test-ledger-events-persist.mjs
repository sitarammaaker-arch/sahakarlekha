// Ledger-event persistence mapping (T-06 wiring) — DataContext.persistLedgerEvent → ledger_events.
//
// Verifies the shadow ledger append persists correctly to the EXISTING ledger_events table:
//   • every column the insert writes is a real ledger_events column (no typos / drift);
//   • every NOT-NULL, no-default column is provided (the insert can't fail on a missing required col);
//   • a real buildEvent() output maps onto those columns with the right value shapes.
//
// It parses the authoritative schema (supabase-tables.sql) and the actual insert (DataContext.tsx),
// so it fails if either side drifts. Run: node scripts/test-ledger-events-persist.mjs
//   (npm run test:ledger-events-persist)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let ev;
try {
  const mod = await import(abs('../src/lib/ledger/event.ts'));
  // A representative posted-voucher event, exactly as addVoucher builds it.
  ev = mod.buildEvent({
    eventType: 'voucher.posted',
    tenantId: 'SOC001',
    jurisdiction: 'Haryana',
    aggregateType: 'voucher',
    aggregateId: 'v-123',
    sequence: 1,
    producer: { kind: 'human', id: 'Secretary' },
    payload: { voucherNo: 'RV/2025/26/001', type: 'receipt', amount: 5000, date: '2026-07-12' },
  }, { eventId: 'evt-1', occurredAt: '2026-07-12T06:30:00Z' });
} catch (e) {
  console.error('\nFAIL    Could not import buildEvent / build a sample event.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── Parse the authoritative ledger_events schema ─────────────────────────────
const sql = readFileSync(pathResolve(ROOT, 'supabase-tables.sql'), 'utf8');
const block = sql.slice(sql.indexOf('create table if not exists ledger_events ('));
const body = block.slice(block.indexOf('(') + 1, block.indexOf('\n);'));
const columns = new Map(); // name -> { notNull, hasDefault }
for (const line of body.split('\n')) {
  const m = /^\s*([a-z_]+)\s+(.+?),?\s*$/.exec(line);
  if (!m) continue;
  const name = m[1];
  const rest = m[2].toLowerCase();
  if (['create', 'primary', 'unique', 'constraint', 'foreign'].includes(name)) continue;
  columns.set(name, { notNull: /not null|primary key/.test(rest), hasDefault: /default/.test(rest) });
}
ok(columns.has('event_id') && columns.has('payload') && columns.has('sequence'), 'parsed the ledger_events columns from supabase-tables.sql');

// ── Parse the actual insert keys from DataContext ────────────────────────────
// The LedgerEvent → ledger_events column mapping lives in ONE named helper (toLedgerEventRow),
// shared by the best-effort shadow append and the journal-first authoritative append (RULE 2).
// Parse that object literal — it is the single source of the persisted column set.
const dc = readFileSync(pathResolve(ROOT, 'src', 'contexts', 'DataContext.tsx'), 'utf8');
ok(dc.includes(".from('ledger_events').insert(toLedgerEventRow("), 'DataContext persists to ledger_events via the toLedgerEventRow mapping');
const mapIdx = dc.indexOf('toLedgerEventRow = (ev: LedgerEvent) => ({');
ok(mapIdx > -1, 'the toLedgerEventRow column mapping exists');
const insBlock = dc.slice(mapIdx, dc.indexOf('});', mapIdx));
const insertKeys = [...insBlock.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);

// ── 1. Every inserted key is a real column (no typo / drift) ──────────────────
for (const k of insertKeys) {
  ok(columns.has(k), `inserted column "${k}" exists in the ledger_events table`);
}

// ── 2. Every NOT-NULL, no-default column is provided ─────────────────────────
for (const [name, meta] of columns) {
  if (name === 'created_at') continue; // db-defaulted timestamp
  if (meta.notNull && !meta.hasDefault) {
    ok(insertKeys.includes(name), `required column "${name}" (NOT NULL, no default) is provided by the insert`);
  }
}

// ── 3. A real buildEvent() output maps onto the columns with correct shapes ──
const row = {
  event_id: ev.eventId,
  event_type: ev.eventType,
  schema_version: ev.schemaVersion,
  society_id: ev.tenantId,
  jurisdiction: ev.jurisdiction || null,
  aggregate_type: ev.aggregateType,
  aggregate_id: ev.aggregateId,
  sequence: ev.sequence,
  occurred_at: ev.occurredAt,
  producer_kind: ev.producer.kind,
  producer_id: ev.producer.id ?? null,
  on_behalf_of: ev.producer.onBehalfOf ?? null,
  reversal_of: ev.reversalOf ?? null,
  payload: ev.payload,
};
// the mapped row's keys must match the insert's keys exactly (mapping stays in sync).
ok(JSON.stringify([...insertKeys].sort()) === JSON.stringify(Object.keys(row).sort()),
  'the test mapping and the DataContext insert write the SAME column set (in sync)');
ok(row.event_id === 'evt-1' && row.event_type === 'voucher.posted' && row.aggregate_id === 'v-123', 'core identifiers map through');
ok(typeof row.sequence === 'number' && row.sequence >= 1, 'sequence is a positive number (bigint column)');
ok(row.payload && typeof row.payload === 'object' && row.payload.voucherNo === 'RV/2025/26/001', 'payload is the jsonb contract object');
ok(row.society_id === 'SOC001' && row.producer_kind === 'human' && row.producer_id === 'Secretary', 'tenant + producer attribution map through');
ok(row.reversal_of === null, 'a non-reversing event maps reversal_of to null');

console.log(`\nLedger-event persistence mapping: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

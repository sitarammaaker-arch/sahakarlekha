#!/usr/bin/env node
// Heal the DERIVED rows a live voucher should have but lacks — its voucher_entries and its
// voucher.posted journal event — for vouchers created after a cut-off.
//
// Two write bugs (fixed in PR #555) left recent vouchers incomplete: syncEntries sent a column that
// does not exist (every voucher_entries upsert was rejected, hidden until RM-01 removed the load-time
// backfill), and member joining receipts never emitted voucher.posted. This rebuilds exactly those
// rows with the app's own builders (buildVoucherEntries, buildEvent/voucherPostingLines) — it never
// edits a voucher. Pre-journal history (vouchers that pre-date the journal) is out of scope: use the
// genesis / reconcile tooling for that.
//
// READS only (read-only transaction on the linked project, or the local db-harness) and writes:
//   <out>.sql       one self-checking transaction; logs every inserted id to data_fix_log first
//   <out>.undo.sql  deletes exactly the logged rows
//
// Usage: node scripts/heal-voucher-derived.mjs --since '<createdAt>' --out <path-without-ext>
//          [--society <id>] [--source linked|harness] [--workdir <linked checkout>]
// The SQL holds society and voucher ids — keep it out of git (this repo is public).

import { register } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)}; const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }`));

export const FIX = 'heal-voucher-derived';
const q = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const j = (o) => { const s = JSON.stringify(o); if (s.includes('$fx$')) throw new Error('payload contains the dollar-quote tag'); return `$fx$${s}$fx$::jsonb`; };

/** PURE. Which live, approved vouchers lack entries and/or a posting event. */
export function planHeal(vouchers, entryVoucherIds, eventsByVoucher) {
  const needEntries = [];
  const needPosting = [];
  for (const v of vouchers) {
    if (v.isDeleted || v.approvalStatus === 'pending') continue;
    if (!entryVoucherIds.has(v.id)) needEntries.push(v);
    const evs = eventsByVoucher.get(v.id) || [];
    const hasPosting = evs.some((e) => e.event_type === 'voucher.posted' || e.event_type === 'voucher.reposted');
    const hasCancel = evs.some((e) => e.event_type === 'voucher.cancelled');
    if (!hasPosting && !hasCancel) needPosting.push(v);
  }
  return { needEntries, needPosting };
}

/** PURE. Forward SQL: check nothing changed since the plan, log, insert, verify. */
export function buildHealSql({ runAt, entries, events }) {
  const nE = entries.length, nV = events.length;
  const entryRows = entries.map((e) => `(${[q(e.id), q(e.voucherId), q(e.accountId), e.dr, e.cr, q(e.narration ?? null), q(e.society_id), q(e.workOrderId ?? null), q(e.costCentreId ?? null), q(e.jurisdiction ?? null)].join(', ')})`).join(',\n');
  const evRows = events.map((e) => `(${[q(e.eventId), q(e.eventType), e.schemaVersion, q(e.tenantId), q(e.jurisdiction || null), q(e.aggregateType), q(e.aggregateId), e.sequence, q(e.occurredAt), q(e.producer.kind), q(e.producer.id ?? null), q(e.producer.onBehalfOf ?? null), q(e.reversalOf ?? null), j(e.payload)].join(', ')})`).join(',\n');
  const logRows = [
    ...entries.map((e) => `(${q(FIX)}, ${q(e.society_id)}, 'voucher_entry', ${q(e.id)}, ${j({ inserted: true, voucherId: e.voucherId })})`),
    ...events.map((e) => `(${q(FIX)}, ${q(e.tenantId)}, 'ledger_event', ${q(e.eventId)}, ${j({ inserted: true, voucherId: e.aggregateId })})`),
  ].join(',\n');
  const entryIds = entries.map((e) => q(e.id)).join(', ') || "''";
  const eventVoucherIds = events.map((e) => q(e.aggregateId)).join(', ') || "''";
  return `-- ${FIX} · FORWARD · ${nE} voucher_entries + ${nV} voucher.posted events · generated ${runAt}
-- Inserts derived rows only; never edits a voucher. ONE transaction; any failed check aborts with nothing changed.
begin;

create table if not exists public.data_fix_log (
  id bigserial primary key, fix text not null, society_id text not null, entity text not null,
  entity_id text not null, old_row jsonb not null, logged_at timestamptz not null default now()
);
alter table public.data_fix_log enable row level security;
revoke all on public.data_fix_log from anon, authenticated;

do $chk$
declare n int;
begin
  select count(*) into n from public.voucher_entries where id in (${entryIds});
  if n > 0 then raise exception '${FIX}: % of the planned entries already exist — re-plan; nothing changed', n; end if;
  select count(*) into n from public.ledger_events where aggregate_id in (${eventVoucherIds}) and event_type in ('voucher.posted', 'voucher.reposted', 'voucher.cancelled');
  if n > 0 then raise exception '${FIX}: % planned vouchers already have journal events — re-plan; nothing changed', n; end if;
end $chk$;
${logRows ? `
insert into public.data_fix_log (fix, society_id, entity, entity_id, old_row) values
${logRows};
` : ''}${nE ? `
insert into public.voucher_entries (id, "voucherId", "accountId", dr, cr, narration, society_id, "workOrderId", "costCentreId", jurisdiction) values
${entryRows};
` : ''}${nV ? `
insert into public.ledger_events
  (event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type, aggregate_id, sequence, occurred_at,
   producer_kind, producer_id, on_behalf_of, reversal_of, payload)
values
${evRows};
` : ''}
do $chk$
declare ne int; nv int;
begin
  select count(*) into ne from public.voucher_entries where id in (${entryIds});
  select count(*) into nv from public.ledger_events where aggregate_id in (${eventVoucherIds}) and event_id like '${FIX}-%';
  if ne <> ${nE} or nv <> ${nV} then raise exception '${FIX}: post-check failed (entries %, events %) — rolled back', ne, nv; end if;
end $chk$;

commit;
`;
}

export function buildHealUndoSql({ runAt }) {
  return `-- ${FIX} · UNDO · for the forward fix generated ${runAt}
begin;
delete from public.voucher_entries where id in (select entity_id from public.data_fix_log where fix = ${q(FIX)} and entity = 'voucher_entry');
delete from public.ledger_events where event_id in (select entity_id from public.data_fix_log where fix = ${q(FIX)} and entity = 'ledger_event');
delete from public.data_fix_log where fix = ${q(FIX)};
commit;
`;
}

async function read(sql, source, workdir) {
  if (source === 'harness') {
    const { harnessClient } = await import('./db-harness/lib.mjs');
    const c = harnessClient(); await c.connect();
    try { await c.query('begin transaction read only'); const r = (await c.query(sql)).rows; await c.query('rollback'); return r; } finally { await c.end(); }
  }
  const { runReadOnlyQuery } = await import('./rm02-diagnostics.mjs');
  return runReadOnlyQuery(sql, workdir);
}

async function main() {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const since = arg('--since'); const out = arg('--out'); const source = arg('--source', 'linked'); const soc = arg('--society');
  if (!since || !out) { console.error('usage: --since <createdAt> --out <path> [--society <id>] [--source linked|harness] [--workdir <dir>]'); process.exit(2); }
  const esc = (s) => s.replace(/'/g, "''");
  const socFilter = soc ? ` and v.society_id::text = '${esc(soc)}'` : '';
  const vouchers = (await read(`select to_jsonb(v) as r from vouchers v where v."createdAt" > '${esc(since)}' and not coalesce(v."isDeleted", false)${socFilter}`, source, arg('--workdir'))).map((x) => x.r);
  const ids = vouchers.map((v) => `'${esc(v.id)}'`).join(',') || "''";
  const entryVoucherIds = new Set((await read(`select distinct "voucherId" as id from voucher_entries where "voucherId" in (${ids})`, source, arg('--workdir'))).map((x) => x.id));
  const evRows = (await read(`select aggregate_id, event_type, sequence from ledger_events where aggregate_type = 'voucher' and aggregate_id in (${ids})`, source, arg('--workdir')));
  const eventsByVoucher = new Map();
  for (const e of evRows) (eventsByVoucher.get(e.aggregate_id) ?? eventsByVoucher.set(e.aggregate_id, []).get(e.aggregate_id)).push(e);

  const { buildVoucherEntries } = await import(pathToFileURL(pathResolve(SRC, 'lib/voucherUtils.ts')).href);
  const { buildEvent } = await import(pathToFileURL(pathResolve(SRC, 'lib/ledger/event.ts')).href);
  const { voucherPostingLines, voucherEventMeta } = await import(pathToFileURL(pathResolve(SRC, 'lib/ledger/voucherEvent.ts')).href);

  const { needEntries, needPosting } = planHeal(vouchers, entryVoucherIds, eventsByVoucher);
  const entries = needEntries.flatMap((v) => buildVoucherEntries(v, String(v.society_id))
    .map(({ societyId: _s, ...e }) => ({ ...e, society_id: String(v.society_id), jurisdiction: v.jurisdiction ?? null })));
  const events = needPosting.map((v) => buildEvent({
    eventType: 'voucher.posted', tenantId: String(v.society_id), jurisdiction: v.jurisdiction ?? undefined,
    aggregateType: 'voucher', aggregateId: v.id, sequence: 1,
    producer: { kind: 'import', id: FIX },
    payload: { lines: voucherPostingLines(v), ...voucherEventMeta(v), healedPosting: true },
  }, { eventId: `${FIX}-${v.id}`, occurredAt: new Date(v.createdAt || Date.now()).toISOString() }));

  const runAt = new Date().toISOString();
  console.log(`${FIX}: ${vouchers.length} live vouchers since ${since}${soc ? ` (society ${soc})` : ''} (${source})`);
  console.log(`  need voucher_entries: ${needEntries.length} vouchers → ${entries.length} rows  [${needEntries.map((v) => v.voucherNo).join(', ')}]`);
  console.log(`  need voucher.posted:  ${needPosting.length}  [${needPosting.map((v) => v.voucherNo).join(', ')}]`);
  if (!entries.length && !events.length) { console.log('  nothing to heal — no SQL written'); return; }
  writeFileSync(`${out}.sql`, buildHealSql({ runAt, entries, events }));
  writeFileSync(`${out}.undo.sql`, buildHealUndoSql({ runAt }));
  console.log(`  wrote ${out}.sql and ${out}.undo.sql`);
}

if (process.argv[1] && pathResolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}

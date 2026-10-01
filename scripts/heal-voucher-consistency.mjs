#!/usr/bin/env node
// S3-d-3 · make each voucher's DERIVED rows agree with the voucher itself (approved 2026-09-29).
//
// The old multi-call edit/cancel left three kinds of drift (all fixed at the root by migration 078
// for the posting-service path; this heals what already happened):
//   • a CANCELLED voucher still holding voucher_entries                      → delete the entries
//   • a cancelled voucher whose journal posting was never reversed           → append voucher.cancelled
//   • a LIVE voucher whose voucher_entries / journal kept a pre-edit amount  → rebuild the entries from
//     the voucher (buildVoucherEntries) and, if the journal's current posting differs, append
//     voucher.reversed + voucher.reposted (or one voucher.posted when the journal holds none)
//   • a LIVE voucher with NO journal event at all (S3-e-4: Assandh's appends failed 07-16 → 08-19)
//                                                                              → append voucher.posted
//   • (B2, 2026-10-01) a REJECTED voucher still holding a live posting / entries — a rejected voucher
//     never counts, exactly like a cancelled one → append voucher.cancelled, delete the entries
//   • (B2) a LIVE voucher whose entries carry the right TOTAL on the wrong account / side (edits saved
//     while syncEntries was rejecting every write) — the candidate query now compares per account
//   • (2026-10-01) a cancelled / rejected voucher whose voucher_lines are still 'posted' → 'reversed'
//     (what cancel_voucher does); the old status is logged and restored by the undo
// The VOUCHER ROW is the truth; it is never edited. Rows are built with the app's own builders (RULE 2).
//
// READS only (read-only transaction on the linked project, or the local db-harness) and writes:
//   <out>.sql       one self-checking transaction; logs every deleted row (full old row) and every
//                   inserted id to data_fix_log first
//   <out>.undo.sql  deletes exactly the inserted rows and re-inserts exactly the deleted ones
//
// Usage: node scripts/heal-voucher-consistency.mjs --out <path-without-ext> [--fix <id>] [--source linked|harness] [--workdir <dir>]
//   --fix names this run in data_fix_log (default s3d3-voucher-consistency); each run gets its own id so
//   its undo touches only its rows and a re-apply of THAT run is refused.
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
const imp = (p) => import(pathToFileURL(pathResolve(SRC, p)).href);
const { buildVoucherEntries } = await imp('lib/voucherUtils.ts');
const { buildEvent } = await imp('lib/ledger/event.ts');
const { voucherPostingLines, voucherEventMeta, voucherReversalLines } = await imp('lib/ledger/voucherEvent.ts');

export let FIX = 's3d3-voucher-consistency';
/** Name this run (data_fix_log.fix, event ids, producer). */
export function setFix(id) { if (!/^[a-z0-9-]+$/.test(id)) throw new Error('fix id: lowercase letters, digits and dashes only'); FIX = id; }
/** The DB row's timestamp has no zone ('2026-07-20T09:09:53.886'); the app's createdAt is ISO with 'Z'
 *  (voucherEventMeta's same-date sort key) — the column is UTC, so append the 'Z'. */
const isoZ = (t) => (typeof t === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(t) ? `${t}Z` : t);
const q = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const j = (o) => { const s = JSON.stringify(o); if (s.includes('$fx$')) throw new Error('payload contains the dollar-quote tag'); return `$fx$${s}$fx$::jsonb`; };
const legKey = (ls) => JSON.stringify((ls || []).map((l) => [l.accountId, l.drCr, Number(l.amountMinor)]));
const flip = (ls) => (ls || []).map((l) => ({ accountId: l.accountId, drCr: l.drCr === 'Dr' ? 'Cr' : 'Dr', amountMinor: Number(l.amountMinor) }));
const minorOf = (x) => Math.round(Number(x) * 100);

/** The journal's current posting for a voucher: latest reposted, else posted (as aggregateState). */
export function currentPosting(evs) {
  const reposts = evs.filter((e) => e.event_type === 'voucher.reposted').sort((a, b) => b.sequence - a.sequence);
  return reposts[0] ?? evs.find((e) => e.event_type === 'voucher.posted') ?? null;
}

/**
 * PURE. For each voucher (with its entries rows and journal events) decide what to delete / insert so
 * that: entries = the voucher's legs (none when cancelled) and the journal's net = the same.
 * Returns { actions: [{ voucher, kind, deleteEntries, insertEntries, events }] } — only vouchers that change.
 */
export function planConsistency(vouchers, entriesByVoucher, eventsByVoucher, runAt, postedLinesByVoucher = new Map()) {
  const actions = [];
  for (const v of vouchers) {
    const sid = String(v.society_id);
    const ents = entriesByVoucher.get(v.id) || [];
    const evs = (eventsByVoucher.get(v.id) || []).slice().sort((a, b) => a.sequence - b.sequence);
    const maxSeq = evs.reduce((m, e) => Math.max(m, e.sequence), 0);
    const posting = currentPosting(evs);
    const cancelled = evs.some((e) => e.event_type === 'voucher.cancelled');
    const base = { tenantId: sid, jurisdiction: v.jurisdiction ?? undefined, aggregateType: 'voucher', aggregateId: v.id, producer: { kind: 'import', id: FIX } };
    const events = [];
    let insertEntries = [];
    let kind;
    // A rejected voucher never counts — same target state as a cancelled one (no posting, no entries).
    const voided = v.isDeleted || v.approvalStatus === 'rejected';
    if (voided) {
      if (posting && !cancelled) {
        events.push(buildEvent({ ...base, eventType: 'voucher.cancelled', sequence: maxSeq + 1, reversalOf: posting.event_id,
          payload: { ...(posting.payload || {}), lines: flip(posting.payload?.lines), reason: v.isDeleted ? 'heal: cancel never journaled' : 'heal: rejected voucher was journaled', healed: true } },
          { eventId: `${FIX}-${v.id}-c${maxSeq + 1}`, occurredAt: runAt }));
      }
      const reverseLines = postedLinesByVoucher.get(v.id) || [];
      if (!ents.length && !events.length && !reverseLines.length) continue;
      kind = (v.isDeleted ? 'cancelled-' : 'rejected-') + (events.length ? 'journal' : ents.length ? 'entries' : 'lines');
      actions.push({ voucher: v, kind, deleteEntries: ents, insertEntries, events, reverseLines });
      continue;
    } else {
      if (v.approvalStatus === 'pending') continue;
      insertEntries = buildVoucherEntries(v, sid).map(({ societyId: _s, ...e }) => ({ ...e, society_id: sid, jurisdiction: v.jurisdiction ?? null }));
      const want = voucherPostingLines(v);
      const entryKey = (rows) => JSON.stringify(rows.map((e) => [e.id, e.accountId, minorOf(e.dr), minorOf(e.cr)]).sort());
      const entriesOk = entryKey(ents) === entryKey(insertEntries);
      if (!posting) {
        events.push(buildEvent({ ...base, eventType: 'voucher.posted', sequence: maxSeq + 1, payload: { lines: want, ...voucherEventMeta({ ...v, createdAt: isoZ(v.createdAt) }), healed: true } },
          { eventId: `${FIX}-${v.id}-p${maxSeq + 1}`, occurredAt: runAt }));
      } else if (legKey(posting.payload?.lines) !== legKey(want)) {
        events.push(buildEvent({ ...base, eventType: 'voucher.reversed', sequence: maxSeq + 1, reversalOf: posting.event_id,
          payload: { ...(posting.payload || {}), lines: flip(posting.payload?.lines), reason: 'heal: edit never journaled', healed: true } },
          { eventId: `${FIX}-${v.id}-r${maxSeq + 1}`, occurredAt: runAt }));
        // Keep the posting's createdAt string (the same-date sort key) — the DB row's timestamp loses the 'Z'.
        const meta = { ...voucherEventMeta(v), createdAt: posting.payload?.createdAt ?? isoZ(v.createdAt) };
        events.push(buildEvent({ ...base, eventType: 'voucher.reposted', sequence: maxSeq + 2, payload: { lines: want, ...meta, healed: true } },
          { eventId: `${FIX}-${v.id}-r${maxSeq + 2}`, occurredAt: runAt }));
      }
      if (entriesOk && !events.length) continue;
      if (entriesOk) insertEntries = [];
      kind = events.length ? 'live-journal+entries' : 'live-entries';
      // Mismatched entries are ALWAYS removed (even when the voucher's legs produce no rows).
      actions.push({ voucher: v, kind, deleteEntries: entriesOk ? [] : ents, insertEntries, events });
      continue;
    }
  }
  return { actions };
}
// voucherReversalLines is the app's flip of a voucher's OWN legs; the heal flips the journal's posting
// instead (that is what must net out). Kept imported so a rename in the app breaks this script loudly.
void voucherReversalLines;

/** PURE. Forward SQL: re-check the plan still holds, log, delete, insert, verify — one transaction. */
export function buildConsistencySql({ runAt, actions }) {
  const del = actions.flatMap((a) => a.deleteEntries);
  const ins = actions.flatMap((a) => a.insertEntries);
  const evs = actions.flatMap((a) => a.events);
  const revLines = actions.flatMap((a) => (a.reverseLines || []).map((id) => ({ id, society_id: String(a.voucher.society_id) })));
  const revIds = revLines.map((l) => q(l.id)).join(', ') || "''";
  const vids = actions.map((a) => q(a.voucher.id)).join(', ') || "''";
  const delIds = del.map((e) => q(e.id)).join(', ') || "''";
  const insIds = ins.map((e) => q(e.id)).join(', ') || "''";
  const seqChecks = actions.map((a) => {
    const max = a.events.length ? Math.min(...a.events.map((e) => e.sequence)) - 1 : null;
    return max === null ? '' : `  select coalesce(max(sequence), 0) into n from public.ledger_events where aggregate_type = 'voucher' and aggregate_id = ${q(a.voucher.id)};
  if n <> ${max} then raise exception '${FIX}: journal of ${a.voucher.voucherNo} changed since the plan — re-plan; nothing changed'; end if;`;
  }).filter(Boolean).join('\n');
  const rowChecks = actions.map((a) => `  select count(*) into n from public.vouchers where id = ${q(a.voucher.id)} and coalesce("isDeleted", false) = ${a.voucher.isDeleted ? 'true' : 'false'}
    and coalesce("approvalStatus", '') = ${q(a.voucher.approvalStatus ?? '')}
    and round(amount * 100) = ${minorOf(a.voucher.amount)} and lines is not distinct from ${a.voucher.lines == null ? 'null::jsonb' : j(a.voucher.lines)};
  if n <> 1 then raise exception '${FIX}: voucher ${a.voucher.voucherNo} changed since the plan — re-plan; nothing changed'; end if;`).join('\n');
  const log = [
    ...del.map((e) => `(${q(FIX)}, ${q(e.society_id)}, 'voucher_entry_deleted', ${q(e.id)}, ${j(e)})`),
    ...ins.map((e) => `(${q(FIX)}, ${q(e.society_id)}, 'voucher_entry', ${q(e.id)}, ${j({ inserted: true, voucherId: e.voucherId })})`),
    ...evs.map((e) => `(${q(FIX)}, ${q(e.tenantId)}, 'ledger_event', ${q(e.eventId)}, ${j({ inserted: true, voucherId: e.aggregateId, eventType: e.eventType })})`),
    ...revLines.map((l) => `(${q(FIX)}, ${q(l.society_id)}, 'voucher_line_status', ${q(l.id)}, ${j({ status: 'posted' })})`),
  ].join(',\n');
  const insRows = ins.map((e) => `(${[q(e.id), q(e.voucherId), q(e.accountId), e.dr, e.cr, q(e.narration ?? null), q(e.society_id), q(e.workOrderId ?? null), q(e.costCentreId ?? null), q(e.jurisdiction ?? null)].join(', ')})`).join(',\n');
  const evRows = evs.map((e) => `(${[q(e.eventId), q(e.eventType), e.schemaVersion, q(e.tenantId), q(e.jurisdiction || null), q(e.aggregateType), q(e.aggregateId), e.sequence, q(e.occurredAt), q(e.producer.kind), q(e.producer.id ?? null), q(e.producer.onBehalfOf ?? null), q(e.reversalOf ?? null), j(e.payload)].join(', ')})`).join(',\n');
  const summary = actions.map((a) => `--   ${a.voucher.voucherNo} (${String(a.voucher.society_id).slice(0, 8)}) ${a.kind}: -${a.deleteEntries.length} +${a.insertEntries.length} entries, ${(a.reverseLines || []).length} lines reversed, events [${a.events.map((e) => e.eventType).join(', ')}]`).join('\n');
  return `-- ${FIX} · FORWARD · ${actions.length} vouchers · ${del.length} entries deleted, ${ins.length} inserted, ${evs.length} journal events · generated ${runAt}
-- The voucher row is the truth and is never edited. ONE transaction; any failed check aborts with nothing changed.
${summary}
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
  select count(*) into n from public.data_fix_log where fix = ${q(FIX)};
  if n > 0 then raise exception '${FIX}: already applied — nothing changed'; end if;
  select count(*) into n from public.voucher_entries where id in (${delIds});
  if n <> ${del.length} then raise exception '${FIX}: % of ${del.length} entries to delete still exist — re-plan; nothing changed', n; end if;
  select count(*) into n from public.voucher_lines where id in (${revIds}) and status = 'posted';
  if n <> ${revLines.length} then raise exception '${FIX}: % of ${revLines.length} posted lines to reverse still posted — re-plan; nothing changed', n; end if;
${rowChecks}
${seqChecks}
end $chk$;
${log ? `
insert into public.data_fix_log (fix, society_id, entity, entity_id, old_row) values
${log};
` : ''}${del.length ? `
delete from public.voucher_entries where id in (${delIds});
` : ''}${ins.length ? `
insert into public.voucher_entries (id, "voucherId", "accountId", dr, cr, narration, society_id, "workOrderId", "costCentreId", jurisdiction) values
${insRows};
` : ''}${revLines.length ? `
update public.voucher_lines set status = 'reversed' where id in (${revIds}) and status = 'posted';
` : ''}${evs.length ? `
insert into public.ledger_events
  (event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type, aggregate_id, sequence, occurred_at,
   producer_kind, producer_id, on_behalf_of, reversal_of, payload)
values
${evRows};
` : ''}
-- Post-check: for every healed voucher, voucher_entries and the journal's net both equal its legs
-- (zero for a cancelled voucher), per account, to the paisa.
do $chk$
declare bad text;
begin
  with v as (select id, "voucherNo" no, (coalesce("isDeleted", false) or "approvalStatus" = 'rejected') del from public.vouchers where id in (${vids})),
  j as (select e.aggregate_id vid, l ->> 'accountId' acc, sum(case when l ->> 'drCr' = 'Dr' then 1 else -1 end * (l ->> 'amountMinor')::bigint) net
        from public.ledger_events e, jsonb_array_elements(e.payload -> 'lines') l where e.aggregate_id in (${vids}) group by 1, 2),
  n as (select "voucherId" vid, "accountId" acc, round(sum(dr - cr) * 100)::bigint net from public.voucher_entries where "voucherId" in (${vids}) group by 1, 2),
  a as (select vid, acc from j union select vid, acc from n)
  select string_agg(distinct v.no, ', ') into bad
  from v left join a on a.vid = v.id left join j on j.vid = a.vid and j.acc = a.acc left join n on n.vid = a.vid and n.acc = a.acc
  where coalesce(j.net, 0) <> coalesce(n.net, 0) or (v.del and (coalesce(j.net, 0) <> 0 or exists (select 1 from public.voucher_entries x where x."voucherId" = v.id)));
  if bad is not null then raise exception '${FIX}: post-check failed for % — rolled back', bad; end if;
  if (select count(*) from public.voucher_entries where id in (${insIds})) <> ${ins.length} then raise exception '${FIX}: inserted entries missing — rolled back'; end if;
  if exists (select 1 from public.voucher_lines l join public.vouchers v on v.id = l.voucher_id
              where v.id in (${vids}) and (coalesce(v."isDeleted", false) or v."approvalStatus" = 'rejected') and l.status = 'posted') then
    raise exception '${FIX}: a cancelled/rejected voucher still has posted lines — rolled back'; end if;
end $chk$;

commit;
`;
}

export function buildConsistencyUndoSql({ runAt }) {
  return `-- ${FIX} · UNDO · for the forward fix generated ${runAt}
begin;
delete from public.ledger_events where event_id in (select entity_id from public.data_fix_log where fix = ${q(FIX)} and entity = 'ledger_event');
delete from public.voucher_entries where id in (select entity_id from public.data_fix_log where fix = ${q(FIX)} and entity = 'voucher_entry');
insert into public.voucher_entries select (jsonb_populate_record(null::public.voucher_entries, old_row)).*
  from public.data_fix_log where fix = ${q(FIX)} and entity = 'voucher_entry_deleted';
update public.voucher_lines set status = 'posted'
 where id in (select entity_id from public.data_fix_log where fix = ${q(FIX)} and entity = 'voucher_line_status');
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

// The approved sets (2026-09-29): S3-d-3 — cancelled vouchers still holding entries, and live vouchers
// whose entries' Dr total differs from their own legs; S3-e-4 — live vouchers with no journal event at
// all, and cancelled vouchers whose journal posting was never reversed.
const LEGS_SQL = `case when jsonb_typeof(v.lines) = 'array' and jsonb_array_length(v.lines) > 0
            then (select coalesce(jsonb_agg(jsonb_build_object('acc', x ->> 'accountId', 'n', round((case when x ->> 'type' = 'Dr' then 1 else -1 end) * (x ->> 'amount')::numeric * 100))), '[]'::jsonb) from jsonb_array_elements(v.lines) x)
            else jsonb_build_array(jsonb_build_object('acc', v."debitAccountId", 'n', round(v.amount * 100)), jsonb_build_object('acc', v."creditAccountId", 'n', -round(v.amount * 100))) end`;
const CANDIDATES = `
with e as (select "voucherId" vid, round(sum(dr), 2) dr from public.voucher_entries group by 1)
select to_jsonb(v) as r from public.vouchers v left join e on e.vid = v.id
where (e.vid is not null and (coalesce(v."isDeleted", false)
   or e.dr <> case when jsonb_typeof(v.lines) = 'array' and jsonb_array_length(v.lines) > 0
                   then (select round(sum((x ->> 'amount')::numeric), 2) from jsonb_array_elements(v.lines) x where x ->> 'type' = 'Dr')
                   else round(v.amount, 2) end))
   or (not coalesce(v."isDeleted", false) and coalesce(v."approvalStatus", '') not in ('pending', 'rejected')
       and not exists (select 1 from public.ledger_events x where x.aggregate_type = 'voucher' and x.aggregate_id = v.id))
   or (coalesce(v."isDeleted", false)
       and exists (select 1 from public.ledger_events x where x.aggregate_type = 'voucher' and x.aggregate_id = v.id and x.event_type in ('voucher.posted', 'voucher.reposted'))
       and not exists (select 1 from public.ledger_events x where x.aggregate_type = 'voucher' and x.aggregate_id = v.id and x.event_type = 'voucher.cancelled'))
   -- B2: a rejected voucher holding entries, or a posting that was never cancelled
   or (not coalesce(v."isDeleted", false) and v."approvalStatus" = 'rejected'
       and (e.vid is not null
            or (exists (select 1 from public.ledger_events x where x.aggregate_type = 'voucher' and x.aggregate_id = v.id and x.event_type in ('voucher.posted', 'voucher.reposted'))
                and not exists (select 1 from public.ledger_events x where x.aggregate_type = 'voucher' and x.aggregate_id = v.id and x.event_type = 'voucher.cancelled'))))
   -- 2026-10-01: a cancelled / rejected voucher whose voucher_lines are still posted
   or ((coalesce(v."isDeleted", false) or v."approvalStatus" = 'rejected')
       and exists (select 1 from public.voucher_lines l where l.voucher_id = v.id and l.status = 'posted'))
   -- B2: a live voucher whose entries differ from its legs on any ACCOUNT (right total, wrong account/side)
   or (not coalesce(v."isDeleted", false) and coalesce(v."approvalStatus", '') not in ('pending', 'rejected')
       and exists (
         select 1 from (select ve."accountId" acc, sum(round((ve.dr - ve.cr) * 100)) n from public.voucher_entries ve where ve."voucherId" = v.id group by 1) en
         full join (select l ->> 'acc' acc, sum((l ->> 'n')::numeric) n from jsonb_array_elements(${LEGS_SQL}) l group by 1) lg using (acc)
         where coalesce(en.n, 0) <> coalesce(lg.n, 0)))`;

async function main() {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const out = arg('--out'); const source = arg('--source', 'linked'); const wd = arg('--workdir');
  if (arg('--fix')) setFix(arg('--fix'));
  if (!out) { console.error('usage: --out <path> [--source linked|harness] [--workdir <dir>]'); process.exit(2); }
  const vouchers = (await read(CANDIDATES, source, wd)).map((x) => x.r);
  const ids = vouchers.map((v) => q(v.id)).join(',') || "''";
  const entriesByVoucher = new Map(); const eventsByVoucher = new Map();
  for (const e of (await read(`select to_jsonb(x) as r from public.voucher_entries x where "voucherId" in (${ids})`, source, wd)).map((x) => x.r)) {
    (entriesByVoucher.get(e.voucherId) ?? entriesByVoucher.set(e.voucherId, []).get(e.voucherId)).push(e);
  }
  for (const e of await read(`select aggregate_id, event_id, event_type, sequence, payload from public.ledger_events where aggregate_type = 'voucher' and aggregate_id in (${ids})`, source, wd)) {
    (eventsByVoucher.get(e.aggregate_id) ?? eventsByVoucher.set(e.aggregate_id, []).get(e.aggregate_id)).push(e);
  }
  const postedLinesByVoucher = new Map();
  for (const l of await read(`select voucher_id, id from public.voucher_lines where status = 'posted' and voucher_id in (${ids})`, source, wd)) {
    (postedLinesByVoucher.get(l.voucher_id) ?? postedLinesByVoucher.set(l.voucher_id, []).get(l.voucher_id)).push(l.id);
  }
  const runAt = new Date().toISOString();
  const { actions } = planConsistency(vouchers, entriesByVoucher, eventsByVoucher, runAt, postedLinesByVoucher);
  console.log(`${FIX}: ${vouchers.length} candidates (${source}) → ${actions.length} to heal`);
  const byKind = {};
  for (const a of actions) (byKind[a.kind] ??= []).push(`${a.voucher.voucherNo}@${String(a.voucher.society_id).slice(0, 8)}`);
  for (const [k, list] of Object.entries(byKind)) console.log(`  ${k}: ${list.length}  [${list.join(', ')}]`);
  if (!actions.length) { console.log('  nothing to heal — no SQL written'); return; }
  writeFileSync(`${out}.sql`, buildConsistencySql({ runAt, actions }));
  writeFileSync(`${out}.undo.sql`, buildConsistencyUndoSql({ runAt }));
  console.log(`  wrote ${out}.sql and ${out}.undo.sql`);
}

if (process.argv[1] && pathResolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}

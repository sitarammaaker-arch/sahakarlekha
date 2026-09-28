#!/usr/bin/env node
// RM-01 follow-up · cancel the load-loop's DUPLICATE member vouchers (founder decision A, 2026-09-28).
//
// The removed load loop (RM-01) posted "Share Capital / Admission Fee received from <name>" Cash
// receipts (createdBy 'System') for members who ALREADY had that receipt. This finds the exact
// duplicates for one society and writes a reviewed SQL file that cancels them the way the app's
// cancelVoucher does — soft-delete the voucher, remove its voucher_entries, append a reversing
// `voucher.cancelled` journal event (append-only; the original posting stays) — plus audit rows.
// The app's own cancel path refuses member receipts, so this cannot be done from the UI.
//
// A voucher is a DUPLICATE only if an OLDER live, non-loop voucher exists for the same member,
// credit account, amount and date. Loop vouchers WITHOUT such a twin are the member's only record
// and are never touched. Nothing is written to any database by this script: it READS (read-only
// transaction on the linked project, or the local db-harness) and writes two files:
//   <out>.sql       forward fix (one transaction, self-checking, aborts with nothing changed on any surprise)
//   <out>.undo.sql  exact undo, from the data_fix_log rows the forward fix writes first
//
// Usage:
//   node scripts/rm01-phantom-cancel.mjs --society <id> --out <path-without-ext> [--source linked|harness] [--workdir <linked checkout>]
// The SQL holds society and voucher ids — keep it out of git (this repo is public).

import { register } from 'node:module';
import { writeFileSync } from 'node:fs';
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

export const FIX = 'rm01-phantom-cancel';
export const AUTO_SHARE = 'Share Capital received from ';
export const AUTO_ADMISSION = 'Admission Fee received from ';
const MEMBER_ACCOUNTS = new Set(['1102', '4407']);

const isLoopVoucher = (v) => v.createdBy === 'System' && !!v.memberId
  && (String(v.narration || '').startsWith(AUTO_SHARE) || String(v.narration || '').startsWith(AUTO_ADMISSION));
const isLegacyTwoLeg = (v) => !Array.isArray(v.lines) || v.lines.length === 0;
const amountOf = (v) => Number(v.amount) || 0;
const live = (v) => !v.isDeleted;

/**
 * PURE. Splits one society's vouchers into the loop's duplicates (to cancel) and its solo vouchers
 * (the member's only record — keep). `twinOf` maps each duplicate id to the older voucher it duplicates.
 */
export function classifyLoopVouchers(vouchers) {
  const liveV = vouchers.filter(live);
  const others = liveV.filter((v) => !isLoopVoucher(v) && MEMBER_ACCOUNTS.has(v.creditAccountId));
  const duplicates = [];
  const solo = [];
  const twinOf = new Map();
  for (const v of liveV) {
    if (!isLoopVoucher(v) || !MEMBER_ACCOUNTS.has(v.creditAccountId) || !isLegacyTwoLeg(v)) continue;
    const twin = others.find((o) => o.memberId === v.memberId && o.creditAccountId === v.creditAccountId
      && amountOf(o) === amountOf(v) && String(o.date) === String(v.date)
      && String(o.createdAt || '') < String(v.createdAt || ''));
    if (twin) { duplicates.push(v); twinOf.set(v.id, twin.id); } else solo.push(v);
  }
  return { duplicates, solo, twinOf };
}

const q = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const j = (o) => {
  const s = JSON.stringify(o);
  if (s.includes('$fx$')) throw new Error('payload contains the dollar-quote tag');
  return `$fx$${s}$fx$::jsonb`;
};

/** PURE. The forward SQL: one transaction, self-checking; logs everything it changes before changing it. */
export function buildForwardSql({ societyId, duplicates, events, runAt, actor, reason }) {
  const ids = duplicates.map((v) => v.id);
  const n = ids.length;
  const idList = ids.map((id) => `(${q(id)})`).join(',\n  ');
  const evRows = events.map((e) => `(${[
    q(e.eventId), q(e.eventType), e.schemaVersion, q(e.tenantId), q(e.jurisdiction || null), q(e.aggregateType),
    q(e.aggregateId), e.sequence, q(e.occurredAt), q(e.producer.kind), q(e.producer.id ?? null),
    q(e.producer.onBehalfOf ?? null), q(e.reversalOf ?? null), j(e.payload)].join(', ')})`).join(',\n');
  const auditRows = duplicates.map((v) => `(gen_random_uuid(), ${q(societyId)}, ${q(actor)}, null, 'system', 'voucher', ${q(v.id)}, 'cancel', `
    + `${j({ voucherNo: v.voucherNo, amount: v.amount, creditAccountId: v.creditAccountId, memberId: v.memberId, isDeleted: false })}, `
    + `${j({ isDeleted: true })}, ${q(reason)}, ${q(FIX)}, ${q(runAt)})`).join(',\n');
  return `-- ${FIX} · FORWARD · society ${societyId} · ${n} duplicate loop vouchers · generated ${runAt}
-- Review before running. Runs as ONE transaction; any check that fails aborts with NOTHING changed.
begin;

create table if not exists public.data_fix_log (
  id          bigserial primary key,
  fix         text not null,
  society_id  text not null,
  entity      text not null,
  entity_id   text not null,
  old_row     jsonb not null,
  logged_at   timestamptz not null default now()
);
alter table public.data_fix_log enable row level security;
revoke all on public.data_fix_log from anon, authenticated;

create temporary table fx_targets (id text primary key) on commit drop;
insert into fx_targets (id) values
  ${idList};

do $chk$
declare n_live int; n_done int;
begin
  select count(*) into n_done from public.data_fix_log where fix = ${q(FIX)} and society_id = ${q(societyId)};
  if n_done > 0 then raise exception '${FIX}: already applied for this society (% log rows) — nothing changed', n_done; end if;
  select count(*) into n_live from public.vouchers v join fx_targets t on t.id = v.id
   where v.society_id::text = ${q(societyId)} and not coalesce(v."isDeleted", false) and v."createdBy" = 'System'
     and v."creditAccountId" in ('1102', '4407');
  if n_live <> ${n} then raise exception '${FIX}: expected ${n} live target vouchers, found % — data changed since the plan; nothing changed', n_live; end if;
end $chk$;

insert into public.data_fix_log (fix, society_id, entity, entity_id, old_row)
select ${q(FIX)}, ${q(societyId)}, 'voucher', v.id, to_jsonb(v)
from public.vouchers v join fx_targets t on t.id = v.id where v.society_id::text = ${q(societyId)};

insert into public.data_fix_log (fix, society_id, entity, entity_id, old_row)
select ${q(FIX)}, ${q(societyId)}, 'voucher_entry', e.id, to_jsonb(e)
from public.voucher_entries e join fx_targets t on t.id = e."voucherId" where e.society_id::text = ${q(societyId)};

update public.vouchers v
set "isDeleted" = true, "deletedAt" = ${q(runAt)}, "deletedBy" = ${q(actor)}, "deletedReason" = ${q(reason)}
from fx_targets t
where t.id = v.id and v.society_id::text = ${q(societyId)};

delete from public.voucher_entries e using fx_targets t
where e."voucherId" = t.id and e.society_id::text = ${q(societyId)};

insert into public.ledger_events
  (event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type, aggregate_id, sequence, occurred_at,
   producer_kind, producer_id, on_behalf_of, reversal_of, payload)
values
${evRows};

insert into public.audit_log
  (id, society_id, actor_name, actor_email, actor_role, entity_type, entity_id, action, before, after, reason, source, created_at)
values
${auditRows};

do $chk$
declare n_del int; n_ev int;
begin
  select count(*) into n_del from public.vouchers v join fx_targets t on t.id = v.id
   where v.society_id::text = ${q(societyId)} and v."isDeleted" and v."deletedReason" = ${q(reason)};
  select count(*) into n_ev from public.ledger_events e join fx_targets t on t.id = e.aggregate_id
   where e.event_id like '${FIX}-%' and e.event_type = 'voucher.cancelled';
  if n_del <> ${n} or n_ev <> ${n} then raise exception '${FIX}: post-check failed (cancelled %, events %) — rolled back', n_del, n_ev; end if;
end $chk$;

commit;
`;
}

/** PURE. The exact undo: restores voucher flags and voucher_entries from data_fix_log, removes this fix's events. */
export function buildUndoSql({ societyId, runAt }) {
  return `-- ${FIX} · UNDO · society ${societyId} · for the forward fix generated ${runAt}
begin;

update public.vouchers v
set "isDeleted"     = coalesce((l.old_row->>'isDeleted')::boolean, false),
    "deletedAt"     = l.old_row->>'deletedAt',
    "deletedBy"     = l.old_row->>'deletedBy',
    "deletedReason" = l.old_row->>'deletedReason'
from public.data_fix_log l
where l.fix = ${q(FIX)} and l.society_id = ${q(societyId)} and l.entity = 'voucher'
  and v.id = l.entity_id and v.society_id::text = ${q(societyId)};

insert into public.voucher_entries
select (jsonb_populate_record(null::public.voucher_entries, l.old_row)).*
from public.data_fix_log l
where l.fix = ${q(FIX)} and l.society_id = ${q(societyId)} and l.entity = 'voucher_entry'
on conflict do nothing;

delete from public.ledger_events
where event_id like '${FIX}-%' and society_id::text = ${q(societyId)}
  and aggregate_id in (select entity_id from public.data_fix_log where fix = ${q(FIX)} and society_id = ${q(societyId)} and entity = 'voucher');

insert into public.audit_log (id, society_id, actor_name, entity_type, entity_id, action, reason, source, created_at)
select gen_random_uuid(), ${q(societyId)}, 'data-fix undo', 'voucher', entity_id, 'restore', 'undo ${FIX}', ${q(FIX)}, now()
from public.data_fix_log where fix = ${q(FIX)} and society_id = ${q(societyId)} and entity = 'voucher';

delete from public.data_fix_log where fix = ${q(FIX)} and society_id = ${q(societyId)};

commit;
`;
}

async function readInputs(societyId, source, workdir) {
  const vSql = `select to_jsonb(v) as r from vouchers v where v.society_id::text = '${societyId.replace(/'/g, "''")}'`;
  const eSql = `select to_jsonb(e) as r from ledger_events e where e.society_id::text = '${societyId.replace(/'/g, "''")}' and e.aggregate_type = 'voucher'`;
  if (source === 'harness') {
    const { harnessClient } = await import('./db-harness/lib.mjs');
    const c = harnessClient(); await c.connect();
    try {
      await c.query('begin transaction read only');
      const vouchers = (await c.query(vSql)).rows.map((x) => x.r);
      const events = (await c.query(eSql)).rows.map((x) => x.r);
      await c.query('rollback');
      return { vouchers, events };
    } finally { await c.end(); }
  }
  const { runReadOnlyQuery } = await import('./rm02-diagnostics.mjs');
  return {
    vouchers: runReadOnlyQuery(vSql, workdir).map((x) => x.r),
    events: runReadOnlyQuery(eSql, workdir).map((x) => x.r),
  };
}

async function main() {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const societyId = arg('--society');
  const out = arg('--out');
  const source = arg('--source', 'linked');
  if (!societyId || !out) { console.error('usage: --society <id> --out <path-without-ext> [--source linked|harness] [--workdir <dir>]'); process.exit(2); }

  const { buildEvent } = await import(abs('../src/lib/ledger/event.ts'));
  const { voucherReversalLines, voucherEventMeta } = await import(abs('../src/lib/ledger/voucherEvent.ts'));
  const { projectTrialBalance } = await import(abs('../src/lib/ledger/projections.ts'));

  const { vouchers, events } = await readInputs(societyId, source, arg('--workdir'));
  const { duplicates, solo } = classifyLoopVouchers(vouchers);
  const runAt = new Date().toISOString();
  const actor = 'RM-01 phantom cleanup (founder-approved 2026-09-28)';
  const reason = 'RM-01: duplicate of an older receipt, posted by the removed load-time loop';

  const evByAgg = new Map();
  for (const e of events) (evByAgg.get(e.aggregate_id) ?? evByAgg.set(e.aggregate_id, []).get(e.aggregate_id)).push(e);
  const netOf = (evs) => projectTrialBalance(evs.map((e) => ({ eventType: e.event_type, payload: e.payload }))).lines.filter((l) => l.netMinor !== 0);

  const planned = [];
  const problems = [];
  for (const v of duplicates) {
    const evs = evByAgg.get(v.id) || [];
    if (evs.some((e) => e.event_type === 'voucher.cancelled')) { problems.push(`${v.voucherNo}: already has a cancel event`); continue; }
    let posting = null, postSeq = -1;
    for (const e of evs) {
      if ((e.event_type === 'voucher.posted' || e.event_type === 'voucher.reposted') && (e.sequence || 0) > postSeq) { postSeq = e.sequence || 0; posting = e.event_id; }
    }
    if (!posting) { problems.push(`${v.voucherNo}: no posting in the journal`); continue; }
    const maxSeq = evs.reduce((m, e) => Math.max(m, e.sequence || 0), 0);
    const ev = buildEvent({
      eventType: 'voucher.cancelled', tenantId: societyId, jurisdiction: v.jurisdiction ?? undefined,
      aggregateType: 'voucher', aggregateId: v.id, sequence: maxSeq + 1, reversalOf: posting,
      producer: { kind: 'import', id: FIX },
      payload: { lines: voucherReversalLines(v), ...voucherEventMeta(v), reason },
    }, { eventId: `${FIX}-${v.id}`, occurredAt: runAt });
    const after = netOf([...evs, { event_type: ev.eventType, payload: ev.payload }]);
    if (after.length) { problems.push(`${v.voucherNo}: cancel would not net the voucher to zero`); continue; }
    planned.push({ v, ev });
  }

  const sum = (acc) => duplicates.filter((v) => v.creditAccountId === acc).reduce((s, v) => s + amountOf(v), 0);
  console.log(`${FIX}: society ${societyId} (${source})`);
  console.log(`  duplicates to cancel: ${duplicates.length}  (share ₹${sum('1102')}, admission ₹${sum('4407')}, total ₹${sum('1102') + sum('4407')})`);
  console.log(`  solo loop vouchers kept: ${solo.length}  (₹${solo.reduce((s, v) => s + amountOf(v), 0)})`);
  if (problems.length) {
    console.log(`  PROBLEMS (${problems.length}) — no SQL written:`); for (const p of problems.slice(0, 20)) console.log(`    • ${p}`);
    process.exit(1);
  }
  writeFileSync(`${out}.sql`, buildForwardSql({ societyId, duplicates: planned.map((p) => p.v), events: planned.map((p) => p.ev), runAt, actor, reason }));
  writeFileSync(`${out}.undo.sql`, buildUndoSql({ societyId, runAt }));
  console.log(`  wrote ${out}.sql and ${out}.undo.sql`);
}

if (process.argv[1] && pathResolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}

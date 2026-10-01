#!/usr/bin/env node
// B2 · switch the posting service ON for every READY / EMPTY society in ONE transaction.
//
// Reads the readiness table (posting-readiness.mjs, read-only) and writes:
//   <out>.sql       one transaction: re-runs the readiness check INSIDE the transaction and aborts if any
//                   target society is no longer ready (drift appeared, FY ended, flag changed); logs the
//                   prior society_flags row of every target to data_fix_log; upserts posting_service = true
//   <out>.undo.sql  restores exactly the logged prior state (deletes rows that did not exist before)
//
// No per-society work: the same rule decides for 26 societies or 50,000. The SQL holds society ids —
// keep it out of git (this repo is public).
//
// Usage: node scripts/posting-flag-batch.mjs --out <path-without-ext> [--fix <id>] [--source linked|harness] [--workdir <linked checkout>]

import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const { READINESS_SQL, classifyReadiness } = await import(pathToFileURL(pathResolve(HERE, 'posting-readiness.mjs')).href);

export let FIX = 'b2-posting-flag-batch';
export function setFix(id) { if (!/^[a-z0-9-]+$/.test(id)) throw new Error('fix id: lowercase letters, digits and dashes only'); FIX = id; }
const q = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);

/** PURE. Societies the batch switches on. */
export function selectTargets(rows, today) {
  return rows.filter((r) => ['READY', 'EMPTY'].includes(classifyReadiness(r, today))).map((r) => r.sid);
}

/** PURE. Forward SQL. The readiness query re-runs in the transaction; every target must still qualify. */
export function buildFlagSql({ targets, runAt, actor }) {
  const ids = targets.map(q).join(', ');
  return `-- ${FIX} · FORWARD · posting_service ON for ${targets.length} societies · generated ${runAt}
begin;

create table if not exists public.data_fix_log (
  id bigserial primary key, fix text not null, society_id text not null, entity text not null,
  entity_id text not null, old_row jsonb not null, logged_at timestamptz not null default now()
);
alter table public.data_fix_log enable row level security;
revoke all on public.data_fix_log from anon, authenticated;

do $chk$
declare n int; bad text;
begin
  select count(*) into n from public.data_fix_log where fix = ${q(FIX)};
  if n > 0 then raise exception '${FIX}: already applied — nothing changed'; end if;
  -- Re-check readiness NOW (same query as the planner): flag off, settings + open FY not ended, not
  -- FY-locked, no voucher after the FY, zero journal / entries drift.
  with r as (${READINESS_SQL.trim()})
  select string_agg(left(sid, 8), ', ') into bad from r
   where sid in (${ids})
     and (flag or not has_settings or fy_locked or open_fy_end is null or open_fy_end::date < current_date
          or (last_date is not null and last_date::date > open_fy_end::date)
          or journal_accounts > 0 or entries_accounts > 0);
  if bad is not null then raise exception '${FIX}: no longer ready: % — re-plan; nothing changed', bad; end if;
  select count(*) into n from public.societies where id::text in (${ids});
  if n <> ${targets.length} then raise exception '${FIX}: expected ${targets.length} societies, found % — nothing changed', n; end if;
end $chk$;

insert into public.data_fix_log (fix, society_id, entity, entity_id, old_row)
select ${q(FIX)}, s.id::text, 'society_flags', s.id::text,
       coalesce((select to_jsonb(f) from public.society_flags f where f.society_id::text = s.id::text), jsonb_build_object('absent', true))
  from public.societies s where s.id::text in (${ids});

insert into public.society_flags (society_id, posting_service, updated_at, updated_by)
select s.id, true, now(), ${q(actor)} from public.societies s where s.id::text in (${ids})
on conflict (society_id) do update set posting_service = true, updated_at = now(), updated_by = excluded.updated_by;

do $chk$
declare n int;
begin
  select count(*) into n from public.society_flags where society_id::text in (${ids}) and posting_service;
  if n <> ${targets.length} then raise exception '${FIX}: post-check % of ${targets.length} on — rolled back', n; end if;
end $chk$;

commit;
`;
}

export function buildFlagUndoSql({ runAt }) {
  return `-- ${FIX} · UNDO · restores society_flags exactly as logged by the forward run generated ${runAt}
begin;
delete from public.society_flags f using public.data_fix_log l
 where l.fix = ${q(FIX)} and l.entity = 'society_flags' and l.entity_id = f.society_id::text and l.old_row ? 'absent';
update public.society_flags f set posting_service = coalesce((l.old_row ->> 'posting_service')::boolean, false),
       updated_at = (l.old_row ->> 'updated_at')::timestamptz, updated_by = l.old_row ->> 'updated_by'
  from public.data_fix_log l
 where l.fix = ${q(FIX)} and l.entity = 'society_flags' and l.entity_id = f.society_id::text and not (l.old_row ? 'absent');
delete from public.data_fix_log where fix = ${q(FIX)};
commit;
`;
}

async function main() {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const out = arg('--out');
  if (!out) { console.error('usage: --out <path-without-ext> [--fix <id>] [--workdir <dir>]'); process.exit(2); }
  if (arg('--fix')) setFix(arg('--fix'));
  let rows;
  if (arg('--source', 'linked') === 'harness') {
    const { harnessClient } = await import('./db-harness/lib.mjs');
    const c = harnessClient(); await c.connect();
    try { await c.query('begin transaction read only'); rows = (await c.query(READINESS_SQL)).rows; await c.query('rollback'); } finally { await c.end(); }
  } else {
    const { runReadOnlyQuery } = await import('./rm02-diagnostics.mjs');
    rows = runReadOnlyQuery(READINESS_SQL, arg('--workdir'));
  }
  const today = new Date().toISOString().slice(0, 10);
  const targets = selectTargets(rows, today);
  const runAt = new Date().toISOString();
  console.log(`${FIX}: ${rows.length} societies → ${targets.length} to switch on`);
  if (!targets.length) return;
  writeFileSync(`${out}.sql`, buildFlagSql({ targets, runAt, actor: 'B2 batch (founder-approved)' }));
  writeFileSync(`${out}.undo.sql`, buildFlagUndoSql({ runAt }));
  console.log(`  wrote ${out}.sql and ${out}.undo.sql`);
}

if (process.argv[1] && pathResolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}

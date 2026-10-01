#!/usr/bin/env node
// B2 · posting-service readiness for EVERY society in one read-only pass (no per-society work).
//
// For each society it measures what the server posting path (post_voucher & co.) needs and whether the
// three copies of the books already agree:
//   • settings     — a society_settings row exists (post_voucher reads the FY / period locks from it)
//   • fyLocked     — an audit-locked FY refuses every post (fine — but the society cannot post anyway)
//   • openFy       — an OPEN financial_years row exists; post_voucher needs one containing the VOUCHER date
//   • fyEnded      — that open FY ended before today: the society is still finishing an old year and
//                    will roll over soon — with no server-side rollover yet (Phase C) every post would
//                    then be refused, so it waits
//   • lateVouchers — LIVE (not cancelled / rejected) vouchers dated AFTER the open FY would be refused
//   • parity       — per account: vouchers (truth: live, non-pending legs) = journal (all voucher events)
//                    = voucher_entries (rows of live, non-pending vouchers). Any account off by ≥ 1 paisa is drift.
//   • flag         — society_flags.posting_service today
// and classifies each society:
//   ON        flag already on
//   READY     settings + open FY + all three copies agree → can be switched on as part of the batch
//   HEAL      prerequisites fine, books drift → run heal-voucher-consistency first, then switch on
//   WAIT-FY   books fine, but the open FY has ended and server-side rollover (090) is not live yet
//   BLOCKED   no settings row, no open FY, FY locked, or vouchers after the open FY → own fix first
//   EMPTY     no vouchers at all → READY by definition (new / unused society)
//
// READ-ONLY (a read-only transaction on the linked project). Prints counts and short ids only; the
// full per-society table goes to --out (a scratch file — never commit it, the repo is public).
//
// Usage: node scripts/posting-readiness.mjs [--out <file.json>] [--workdir <linked checkout>]

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve as pathResolve } from 'node:path';

/** Per-society facts. Legs are counted in paise; a voucher's truth is its `lines` (else Dr/Cr/amount). */
export const READINESS_SQL = `
with legs as (
  select v.society_id::text sid, l ->> 'accountId' acc,
         round((case when l ->> 'type' = 'Dr' then 1 else -1 end) * (l ->> 'amount')::numeric * 100)::bigint net
    from public.vouchers v, jsonb_array_elements(case when jsonb_typeof(v.lines) = 'array' and jsonb_array_length(v.lines) > 0 then v.lines else '[]'::jsonb end) l
   where not coalesce(v."isDeleted", false) and coalesce(v."approvalStatus", '') not in ('pending', 'rejected')
  union all
  select v.society_id::text, x.acc, x.net
    from public.vouchers v
    cross join lateral (values (v."debitAccountId", round(v.amount * 100)::bigint), (v."creditAccountId", -round(v.amount * 100)::bigint)) x(acc, net)
   where not coalesce(v."isDeleted", false) and coalesce(v."approvalStatus", '') not in ('pending', 'rejected')
     and coalesce(jsonb_array_length(case when jsonb_typeof(v.lines) = 'array' then v.lines end), 0) = 0   -- NULL lines too
),
truth as (select sid, acc, sum(net) net from legs group by 1, 2),
-- The journal read exactly as every statement reads it (resolveCurrentVouchers): a cancelled voucher
-- counts nothing; otherwise its latest voucher.reposted, else its voucher.posted. (A raw sum over-counts
-- an old edit that appended a repost without its reversal — the statements never did.) Same rule as
-- ledger_drift() (migration 092) and close_financial_year (091).
ev as (select e.society_id::text sid, e.aggregate_id, e.event_type, e.sequence, e.payload from public.ledger_events e where e.aggregate_type = 'voucher'),
cur as (
  select distinct on (aggregate_id) sid, aggregate_id, payload from ev
   where event_type in ('voucher.posted', 'voucher.reposted')
     and aggregate_id not in (select aggregate_id from ev where event_type = 'voucher.cancelled')
   order by aggregate_id, (event_type = 'voucher.reposted') desc, sequence desc
),
journal as (
  select cur.sid, l ->> 'accountId' acc,
         sum((case when l ->> 'drCr' = 'Dr' then 1 else -1 end) * (l ->> 'amountMinor')::bigint) net
    from cur, jsonb_array_elements(coalesce(cur.payload -> 'lines', '[]'::jsonb)) l
   group by 1, 2
),
entries as (
  select ve.society_id::text sid, ve."accountId" acc, sum(round((ve.dr - ve.cr) * 100))::bigint net
    from public.voucher_entries ve join public.vouchers v on v.id = ve."voucherId"
   where not coalesce(v."isDeleted", false) and coalesce(v."approvalStatus", '') not in ('pending', 'rejected')
   group by 1, 2
),
accs as (select sid, acc from truth union select sid, acc from journal union select sid, acc from entries),
drift as (
  select a.sid,
         count(*) filter (where coalesce(t.net, 0) <> coalesce(j.net, 0)) journal_accounts,
         sum(abs(coalesce(t.net, 0) - coalesce(j.net, 0))) journal_abs_minor,
         count(*) filter (where coalesce(t.net, 0) <> coalesce(e.net, 0)) entries_accounts,
         sum(abs(coalesce(t.net, 0) - coalesce(e.net, 0))) entries_abs_minor
    from accs a left join truth t using (sid, acc) left join journal j using (sid, acc) left join entries e using (sid, acc)
   group by 1
),
vc as (
  select society_id::text sid, count(*) filter (where not coalesce("isDeleted", false)) live,
         max(date) filter (where not coalesce("isDeleted", false) and coalesce("approvalStatus", '') <> 'rejected') last_date
    from public.vouchers group by 1
)
select s.id::text sid,
       (ss.society_id is not null) has_settings,
       coalesce(ss."fyLocked", false) fy_locked,
       (select f.end_date from public.financial_years f where f.society_id = s.id::text and f.status = 'open' limit 1)::text open_fy_end,
       coalesce(sf.posting_service, false) flag,
       exists (select 1 from public.app_migrations m where m.version = '090') rollover_live,
       coalesce(vc.live, 0) live_vouchers, vc.last_date,
       coalesce(d.journal_accounts, 0) journal_accounts, coalesce(d.journal_abs_minor, 0) journal_abs_minor,
       coalesce(d.entries_accounts, 0) entries_accounts, coalesce(d.entries_abs_minor, 0) entries_abs_minor
  from public.societies s
  left join public.society_settings ss on ss.society_id::text = s.id::text
  left join public.society_flags sf on sf.society_id::text = s.id::text
  left join vc on vc.sid = s.id::text
  left join drift d on d.sid = s.id::text
 order by coalesce(vc.live, 0) desc`;

/** PURE. One status per society (see header). */
export function classifyReadiness(row, today = new Date().toISOString().slice(0, 10)) {
  // An ON society is still checked: drift there means a heal is due (the nightly job reports it too).
  if (row.flag) return Number(row.journal_accounts) > 0 || Number(row.entries_accounts) > 0 ? 'ON-DRIFT' : 'ON';
  if (blockReasons(row).length) return 'BLOCKED';
  // Before 090 a society whose open year has ended would stop posting at its rollover; with 090 live the
  // rollover opens the next year on the server, so it is ready like any other.
  if (row.open_fy_end < today && !row.rollover_live) return 'WAIT-FY';
  if (Number(row.live_vouchers) === 0) return 'EMPTY';
  if (Number(row.journal_accounts) > 0 || Number(row.entries_accounts) > 0) return 'HEAL';
  return 'READY';
}

/** PURE. Why a society is BLOCKED (empty array otherwise). */
export function blockReasons(row) {
  const r = [];
  if (!row.has_settings) r.push('no society_settings row');
  if (!row.open_fy_end) r.push('no open FY');
  else if (row.last_date && String(row.last_date).slice(0, 10) > row.open_fy_end) r.push(`vouchers dated after the open FY (ends ${row.open_fy_end})`);
  if (row.fy_locked) r.push('FY audit-locked');
  return r;
}

async function main() {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const { runReadOnlyQuery } = await import('./rm02-diagnostics.mjs');
  const rows = runReadOnlyQuery(READINESS_SQL, arg('--workdir'));
  const out = rows.map((r) => ({ ...r, status: classifyReadiness(r), blocked: blockReasons(r) }));
  const by = {};
  for (const r of out) (by[r.status] ??= []).push(r);
  console.log(`posting readiness — ${out.length} societies`);
  for (const k of ['ON', 'ON-DRIFT', 'READY', 'EMPTY', 'HEAL', 'WAIT-FY', 'BLOCKED']) {
    const list = by[k] || [];
    console.log(`  ${k.padEnd(8)} ${String(list.length).padStart(4)}`);
    for (const r of list.filter(() => ['ON-DRIFT', 'HEAL', 'WAIT-FY', 'BLOCKED'].includes(k))) {
      console.log(`    ${r.sid.slice(0, 8)}  vouchers ${r.live_vouchers}  journal drift ${r.journal_accounts} acc / ₹${(Number(r.journal_abs_minor) / 100).toFixed(2)}  entries drift ${r.entries_accounts} acc / ₹${(Number(r.entries_abs_minor) / 100).toFixed(2)}${r.blocked.length ? `  — ${r.blocked.join(', ')}` : k === 'WAIT-FY' ? `  — open FY ended ${r.open_fy_end}` : ''}`);
    }
  }
  if (arg('--out')) { writeFileSync(arg('--out'), JSON.stringify(out, null, 2)); console.log(`  full table → ${arg('--out')}`); }
}

if (process.argv[1] && pathResolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}

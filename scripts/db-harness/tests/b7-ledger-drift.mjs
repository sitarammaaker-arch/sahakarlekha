#!/usr/bin/env node
// Phase-2 B7 · migration 092: ledger_drift() / log_ledger_drift() on the restored backup, and the SAME
// verdict as the readiness tool (RULE 2 — one rule in two places). Injected drift (an entry deleted, an
// edit repost without its reversal, a cancelled voucher's posting left live) must be caught; an old
// repost-without-reversal on a CANCELLED voucher must NOT be (the statements never count it).
// Precondition: harness up with 092 applied. Everything runs in one rolled-back transaction.
//
// Run: node scripts/db-harness/tests/b7-ledger-drift.mjs

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { inRollback } from '../lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const { READINESS_SQL } = await import(pathToFileURL(pathResolve(HERE, '../../posting-readiness.mjs')).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); } };

await inRollback(async (tx) => {
  const drift = async () => Object.fromEntries((await tx.query('select * from public.ledger_drift(null)')).rows.map((r) => [r.society_id, r]));
  const readiness = async () => Object.fromEntries((await tx.query(READINESS_SQL)).rows
    .filter((r) => Number(r.journal_accounts) > 0 || Number(r.entries_accounts) > 0).map((r) => [r.sid, r]));
  const same = (a, b) => JSON.stringify(Object.keys(a).sort()) === JSON.stringify(Object.keys(b).sort())
    && Object.keys(a).every((k) => Number(a[k].journal_accounts) === Number(b[k].journal_accounts) && Number(a[k].entries_accounts) === Number(b[k].entries_accounts));

  const d0 = await drift();
  ok('today\'s books: ledger_drift and readiness agree', same(d0, await readiness()), `${Object.keys(d0).length} drifting`);
  ok('today\'s books: no society drifts (incl. Rania\'s old repost history)', Object.keys(d0).length === 0, Object.keys(d0).join());

  // 1. An entry removed from a live voucher of society A.
  const [{ id: vid, sid: A }] = (await tx.query(`select v.id, v.society_id::text sid from public.vouchers v join public.voucher_entries e on e."voucherId" = v.id
      where not coalesce(v."isDeleted", false) and coalesce(v."approvalStatus", '') not in ('pending', 'rejected') limit 1`)).rows;
  await tx.query('delete from public.voucher_entries where ctid = (select ctid from public.voucher_entries where "voucherId" = $1 limit 1)', [vid]);
  // 2. A live voucher of society B whose journal got a repost with different legs and NO reversal.
  const [{ id: v2, sid: B }] = (await tx.query(`select v.id, v.society_id::text sid from public.vouchers v
      where not coalesce(v."isDeleted", false) and v.society_id::text <> $1 and coalesce(v."approvalStatus", '') not in ('pending', 'rejected')
        and exists (select 1 from public.ledger_events e where e.aggregate_id = v.id and e.event_type = 'voucher.posted')
        and not exists (select 1 from public.ledger_events e where e.aggregate_id = v.id and e.event_type <> 'voucher.posted') limit 1`, [A])).rows;
  await tx.query(`insert into public.ledger_events (event_id, event_type, schema_version, society_id, aggregate_type, aggregate_id, sequence, occurred_at, producer_kind, payload)
      select gen_random_uuid()::text, 'voucher.reposted', 1, society_id, 'voucher', aggregate_id, 2, now(), 'import',
             jsonb_set(payload, '{lines}', (select jsonb_agg(jsonb_set(l, '{amountMinor}', to_jsonb((l ->> 'amountMinor')::bigint + 100))) from jsonb_array_elements(payload -> 'lines') l))
        from public.ledger_events where aggregate_id = $1 and event_type = 'voucher.posted'`, [v2]);
  const d1 = await drift();
  ok('a missing entry is caught (entries drift in A)', Number(d1[A]?.entries_accounts) > 0);
  ok('a repost the voucher does not match is caught (journal drift in B)', Number(d1[B]?.journal_accounts) > 0);
  ok('ledger_drift and readiness still agree', same(d1, await readiness()));

  // 3. A cancelled voucher's repost-without-reversal is history the statements ignore → not drift.
  await tx.query(`insert into public.ledger_events (event_id, event_type, schema_version, society_id, aggregate_type, aggregate_id, sequence, occurred_at, producer_kind, payload)
      select gen_random_uuid()::text, 'voucher.cancelled', 1, society_id, 'voucher', aggregate_id, 3, now(), 'import',
             jsonb_set(payload, '{lines}', (select jsonb_agg(jsonb_set(l, '{drCr}', to_jsonb(case when l ->> 'drCr' = 'Dr' then 'Cr' else 'Dr' end))) from jsonb_array_elements(payload -> 'lines') l))
        from public.ledger_events where aggregate_id = $1 and event_type = 'voucher.posted'`, [v2]);
  await tx.query(`update public.vouchers set "isDeleted" = true where id = $1`, [v2]);
  await tx.query(`delete from public.voucher_entries where "voucherId" = $1`, [v2]);
  const d2 = await drift();
  ok('once that voucher is cancelled its odd repost no longer counts (B clean)', !d2[B], JSON.stringify(d2[B]));

  // log_ledger_drift writes one row per drifting society.
  const before = Number((await tx.query(`select count(*) n from public.error_log where source = 'ledger-drift'`)).rows[0].n);
  const n = Number((await tx.query('select public.log_ledger_drift() n')).rows[0].n);
  const after = Number((await tx.query(`select count(*) n from public.error_log where source = 'ledger-drift'`)).rows[0].n);
  ok('log_ledger_drift logs one error_log row per drifting society', n === Object.keys(d2).length && after - before === n, `${n} / ${after - before}`);
  const row = (await tx.query(`select society_id, message, context from public.error_log where source = 'ledger-drift' and society_id = $1 order by created_at desc limit 1`, [A])).rows[0];
  ok('the row names the society and the drift (Hindi message + context)', row && /हिसाब में अंतर/.test(row.message) && Number(row.context.entriesAccounts) > 0);

  await tx.as({ email: 'x@y.z', user_role: 'admin' });
  ok('clients cannot call ledger_drift / log_ledger_drift', !(await tx.attempt('select * from public.ledger_drift(null)')).ok && !(await tx.attempt('select public.log_ledger_drift()')).ok);
});

console.log(`\nB7 ledger drift (092): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

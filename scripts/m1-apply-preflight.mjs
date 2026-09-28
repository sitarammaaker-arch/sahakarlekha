#!/usr/bin/env node
// M1 production-apply PRE-FLIGHT (migrations 072 → 075). READ-ONLY.
//
// One command to run on the apply day: reads the linked production project inside a read-only
// transaction and says, gate by gate, whether it is safe to run 072 → 073 → 074 → 075 now.
//
//   G1  RM-01 week clean  — no load-loop member voucher since the RM-01 deploy (a legitimate joining
//                           receipt is created with its member; a loop voucher appeared long after).
//   G2  not applied yet   — none of app_migrations / financial_years / account_roles /
//                           accounts.report_class / account_reclass_log exists (or say which do).
//   G3  074 prerequisite  — accounts primary key is (id, society_id).
//   G4  073 prerequisite  — btree_gist is available; one society_settings row per society.
//   G5  075 guard         — no 4406/4407 row to reclassify carries an opening balance.
//   G6  FY labels (warn)  — societies whose label FY does not contain their latest voucher, or whose
//                           previous FY equals the current one (fix in Society Settings before 073).
//
// Usage (from a `supabase link`ed checkout, or pass --workdir):
//   node scripts/m1-apply-preflight.mjs [--workdir <dir>] [--rm01-deployed-at '2026-09-27 07:06:00']

export const RM01_DEPLOYED_AT = '2026-09-27 07:06:00';

export function preflightSql(rm01At = RM01_DEPLOYED_AT) {
  const at = rm01At.replace(/'/g, "''");
  return `
with loop_v as (
  select v.society_id::text sid, v."voucherNo" vno, v."createdAt" vca, m."createdAt" mca
  from vouchers v join members m on m.id = v."memberId"
  where not coalesce(v."isDeleted", false) and v."createdBy" = 'System'
    and (v.narration like 'Share Capital received from%' or v.narration like 'Admission Fee received from%')
    and v."createdAt" > '${at}'
),
fy as (
  select s.society_id::text sid, coalesce(s."name", '') nm, s."financialYear" fy, s."previousFinancialYear" pfy,
         (select max(v.date::text) from vouchers v where v.society_id::text = s.society_id::text and not coalesce(v."isDeleted", false)) last_date
  from society_settings s
)
select
  (select count(*) from loop_v where vca > mca + interval '10 minutes') as loop_after_rm01,
  (select count(*) from loop_v where vca <= mca + interval '10 minutes') as joining_receipts_after_rm01,
  (select string_agg(vno, ', ') from (select vno from loop_v where vca > mca + interval '10 minutes' limit 10) x) as loop_sample,
  to_regclass('public.app_migrations') is not null as has_app_migrations,
  to_regclass('public.financial_years') is not null as has_financial_years,
  to_regclass('public.account_roles') is not null as has_account_roles,
  to_regclass('public.account_reclass_log') is not null as has_account_reclass_log,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'accounts' and column_name = 'report_class') as has_report_class,
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.accounts'::regclass and contype = 'p') as accounts_pk,
  exists (select 1 from pg_available_extensions where name = 'btree_gist') as btree_gist_available,
  (select count(*) from (select society_id from society_settings group by society_id having count(*) > 1) d) as settings_dup_societies,
  (select count(*) from accounts a where (a.id = '4407' and (a.type, a."parentId", a.subtype, a."openingBalanceType", a."isSystem") is distinct from ('income', '4400', 'other_income', 'credit', false))
                                   or (a.id = '4406' and (a.type, a."parentId", a.subtype, a."openingBalanceType") is distinct from ('equity', '1200', 'reserve', 'debit'))) as reclass_rows,
  (select count(*) from accounts a where ((a.id = '4407' and (a.type, a."parentId", a.subtype, a."openingBalanceType", a."isSystem") is distinct from ('income', '4400', 'other_income', 'credit', false))
                                   or (a.id = '4406' and (a.type, a."parentId", a.subtype, a."openingBalanceType") is distinct from ('equity', '1200', 'reserve', 'debit')))
                                   and coalesce(a."openingBalance", 0) <> 0) as reclass_rows_with_opening,
  (select coalesce(json_agg(json_build_object('society', nm, 'fy', fy, 'prev', pfy, 'last_voucher', last_date)), '[]'::json) from fy
    where fy ~ '^\\d{4}-\\d{2}$' and (
      (last_date is not null and (last_date < substr(fy, 1, 4) || '-04-01' or last_date > (substr(fy, 1, 4)::int + 1)::text || '-03-31'))
      or (pfy is not null and pfy = fy))) as fy_label_issues
`;
}

/** PURE. Gate verdicts from the one preflight row. */
export function evaluateGates(r) {
  const n = (x) => Number(x) || 0;
  const applied = ['has_app_migrations', 'has_financial_years', 'has_account_roles', 'has_account_reclass_log', 'has_report_class'].filter((k) => r[k] === true);
  const fyIssues = Array.isArray(r.fy_label_issues) ? r.fy_label_issues : JSON.parse(r.fy_label_issues || '[]');
  const gates = [
    { id: 'G1', name: 'RM-01 week clean', ok: n(r.loop_after_rm01) === 0,
      detail: `${n(r.loop_after_rm01)} load-loop vouchers since the RM-01 deploy${r.loop_sample ? ` (${r.loop_sample})` : ''}; ${n(r.joining_receipts_after_rm01)} legitimate joining receipts` },
    { id: 'G2', name: 'migrations not applied yet', ok: applied.length === 0, detail: applied.length ? `already present: ${applied.join(', ')}` : 'none of 072–075 present' },
    { id: 'G3', name: 'accounts PK (id, society_id)', ok: /PRIMARY KEY \(id, society_id\)/.test(String(r.accounts_pk || '')), detail: String(r.accounts_pk || 'missing') },
    { id: 'G4', name: '073 prerequisites', ok: r.btree_gist_available === true && n(r.settings_dup_societies) === 0,
      detail: `btree_gist ${r.btree_gist_available ? 'available' : 'MISSING'}; ${n(r.settings_dup_societies)} societies with >1 settings row` },
    { id: 'G5', name: '075 guard', ok: n(r.reclass_rows_with_opening) === 0, detail: `${n(r.reclass_rows)} 4406/4407 rows to reclassify, ${n(r.reclass_rows_with_opening)} with an opening balance` },
    { id: 'G6', name: 'FY labels (warning)', ok: fyIssues.length === 0, warnOnly: true,
      detail: fyIssues.length ? fyIssues.map((f) => `${f.society}: ${f.fy}${f.prev === f.fy ? ' (prev = current)' : ''}, last voucher ${f.last_voucher}`).join(' · ') : 'all labels contain their latest voucher' },
  ];
  const blocking = gates.filter((g) => !g.ok && !g.warnOnly);
  return { gates, go: blocking.length === 0 };
}

async function main() {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const { runReadOnlyQuery } = await import('./rm02-diagnostics.mjs');
  const [row] = runReadOnlyQuery(preflightSql(arg('--rm01-deployed-at', RM01_DEPLOYED_AT)), arg('--workdir'));
  const { gates, go } = evaluateGates(row);
  console.log('M1 apply pre-flight (read-only)');
  for (const g of gates) console.log(`  ${g.ok ? '✓' : g.warnOnly ? '!' : '✗'} ${g.id} ${g.name} — ${g.detail}`);
  console.log(go ? '\nGO — safe to apply 072 → 073 → 074 → 075 (fix any ! warnings first).' : '\nNO-GO — resolve the ✗ gates above first.');
  process.exit(go ? 0 : 1);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/m1-apply-preflight.mjs')) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}

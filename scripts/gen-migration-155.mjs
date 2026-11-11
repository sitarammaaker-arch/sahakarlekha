// Generates supabase/migrations/155_chart_fact_corrections.sql (+ down + preview) FROM the code's own
// ACCOUNTS_TO_ADD_155 list and CHART_CORRECTIONS_155 (src/lib/storage.ts), so the SQL can never drift from what
// the app shows on screen.
//   node scripts/gen-migration-155.mjs          → writes the three files
// test:migration-155 re-runs buildFiles() and fails if a committed file differs.
import { register } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const S = await import(pathToFileURL(path.join(SRC, 'lib/storage.ts')).href);

const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const b = (v) => (v ? 'true' : 'false');
const C = S.CHART_CORRECTIONS_155;

export function valuesBlock() {
  return S.ACCOUNTS_TO_ADD_155.map((a, i) =>
    `    (${q(a.id)}, ${q(a.name)}, ${q(a.nameHi)}, ${q(a.type)}, ${q(a.openingBalanceType)}, ${b(a.isSystem)}, ${b(a.isGroup)}, ${q(a.parentId)}, ${q(a.subtype)}, ${i})`
  ).join(',\n');
}

// (1) ADD — same rule as storage.migrateAccounts and migrations 115 / 154.
const missing = `
  from (select distinct society_id from public.accounts) s
 cross join (values
${valuesBlock()}
  ) as v(id, name, "nameHi", type, "openingBalanceType", "isSystem", "isGroup", "parentId", subtype, ord)
 where not exists (select 1 from public.accounts a where a.society_id = s.society_id and a.id = v.id)
   and not exists (select 1 from public.accounts a where a.society_id = s.society_id and a.code = v.id)
   and not exists (select 1 from public.accounts a where a.society_id = s.society_id and lower(trim(a.name)) = lower(trim(v.name)) and a.type = v.type)
   and exists (select 1 from public.accounts p where p.society_id = s.society_id and p.id = v."parentId")`;

// "Nothing was ever posted to it": no opening balance and no line in either voucher-line table.
const unused = `coalesce(a."openingBalance", 0) = 0
   and not exists (select 1 from public.voucher_lines l where l.society_id::text = a.society_id::text and l.account_id = a.id)
   and not exists (select 1 from public.voucher_entries l where l.society_id::text = a.society_id::text and l."accountId" = a.id)`;

// Every place a record can point at one of the removed heads by id (prod, 2026-11-11: none did).
const SOFT_REFS = [
  ['account_roles', 'account_id'], ['procurement_deduction_rules', '"accountId"'], ['procurement_agencies', '"commissionIncomeAccountId"'],
  ['procurement_agencies', '"ledgerAccountId"'], ['stock_items', '"salesAccountId"'], ['stock_items', '"purchaseAccountId"'],
  ['vouchers', '"debitAccountId"'], ['vouchers', '"creditAccountId"'], ['marketing_scheme_claims', '"creditAccountId"'],
];
const unreferenced = SOFT_REFS.map(([t, c]) =>
  `   and not exists (select 1 from public.${t} r where r.society_id::text = a.society_id::text and r.${c} = a.id)`).join('\n')
  + `\n   and not exists (select 1 from public.accounts c where c.society_id = a.society_id and c."parentId" = a.id)`;

const isHead = (r) => `a.id = ${q(r.id)} and a.name = ${q(r.whenName)} and a.type = ${q(r.whenType)}`;
// (2) RECLASSIFY — the row keeps its id. 5311 follows the app's own ACCOUNT_PATCHES (applied on every load).
// The new parent group must exist.
const reclassWhere = (r) => `${isHead(r)}
   and exists (select 1 from public.accounts p where p.society_id = a.society_id and p.id = ${q(r.to.parentId)})${r.onlyIfUnused ? `\n   and ${unused}` : ''}`;
// (3) REMOVE — an income head with no valid use, only where nothing was posted to it and nothing points at it.
const removable = `${unused}\n${unreferenced}`;
const removeWhere = (r) => `${isHead(r)}\n   and ${removable}`;

const log = (where) => `insert into public.account_reclass_log (migration, society_id, account_id, old_row)
select '155', a.society_id::text, a.id, to_jsonb(a)
  from public.accounts a
 where ${where};`;

export function buildFiles() {
  const reclassSql = C.reclass.map((r) => `${log(reclassWhere(r))}

update public.accounts a
   set type = ${q(r.to.type)}, "parentId" = ${q(r.to.parentId)}, subtype = ${q(r.to.subtype)}, "openingBalanceType" = ${q(r.to.openingBalanceType)},
       name = ${q(r.to.name)}, "nameHi" = ${q(r.to.nameHi)}
 where ${reclassWhere(r)};`).join('\n\n');

  const removeSql = C.remove.map((r) => `${log(removeWhere(r))}

delete from public.accounts a
 where ${removeWhere(r)};`).join('\n\n');

  const openingGuard = C.reclass.filter((r) => !r.onlyIfUnused).map((r) => `(${isHead(r)})`).join(' or ');

  const migration = `-- 155 · Chart corrections from the 2026-11-11 comparison with the official texts.
-- GENERATED by scripts/gen-migration-155.mjs from src/lib/storage.ts (ACCOUNTS_TO_ADD_155, CHART_CORRECTIONS_155)
-- — do not edit by hand.
--
-- WHAT (in one transaction):
--   1. ADD two heads every society lacks: 2295 Labour Welfare Fund Payable, 5299 Labour Welfare Fund Contribution.
--   2. RECLASSIFY 5311 Education Fund Contribution from an admin expense to an appropriation of profit under 1200
--      (Haryana Act 1984 s.87(1)(b); MSCS Act s.63(1)(b)) — the app already shows it this way on every load
--      (storage.ts ACCOUNT_PATCHES); this makes the database say the same.
--   3. REMOVE the income heads 4202 Market Fee and 4204 HRDF — levies collected for the Market Committee and the
--      HRDF Board, held in 2296 Market Fee Payable / 2205 HRDF Payable — only where nothing was ever posted to
--      them and no record points at them. A society that has used one keeps it untouched.
--
-- NOT touched: any amount, opening balance, voucher, voucher line or ledger event. On 2026-11-11 (read-only check
-- of production) no society had posted to 5311 or 4204, and one society had two lines on 4202
-- (it keeps that head), so no statement of any past year changes.
--
-- SAFETY: the previous values of every changed or removed row go to account_reclass_log first; the down restores
-- exactly those. Aborts if a 5311 row carries an opening balance. Re-running is harmless (a fixed row no longer
-- matches). Run supabase/diagnostics/preview_155_chart_fact_corrections.sql first.
-- NO temp tables — the SQL Editor's "Run and enable RLS" splits statements. Use plain "Run".

begin;

create table if not exists public.account_reclass_log (
  id          bigserial primary key,
  migration   text not null,
  society_id  text not null,
  account_id  text not null,
  old_row     jsonb not null,
  logged_at   timestamptz not null default now()
);
alter table public.account_reclass_log enable row level security;
revoke all on public.account_reclass_log from anon, authenticated;

do $$
begin
  if exists (select 1 from public.accounts a where (${openingGuard}) and coalesce(a."openingBalance", 0) <> 0) then
    raise exception '155: an account to be reclassified carries a non-zero opening balance — review it first; nothing was changed';
  end if;
end $$;

insert into public.accounts (id, society_id, name, "nameHi", type, "openingBalance", "openingBalanceType", "isSystem", "isGroup", "parentId", subtype, jurisdiction)
select v.id, s.society_id, v.name, v."nameHi", v.type, 0, v."openingBalanceType", v."isSystem", v."isGroup", v."parentId", v.subtype,
       (select a.jurisdiction from public.accounts a where a.society_id = s.society_id and a.jurisdiction is not null limit 1)${missing}
on conflict do nothing;

${reclassSql}

${removeSql}

insert into public.app_migrations (version, name) values ('155', 'chart_fact_corrections')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';
`;

  const preview = `-- preview for 155 · READ-ONLY. GENERATED by scripts/gen-migration-155.mjs. Run BEFORE migration 155.
-- One row per account migration 155 will add, reclassify or remove — or keep because it is in use. Nothing is written.
select 'add' as action, s.society_id::text as society_id, v.id as account_id, v.name${missing}
${C.reclass.map((r) => `union all
select 'reclassify', a.society_id::text, a.id, a.name
  from public.accounts a
 where ${reclassWhere(r)}`).join('\n')}
${C.remove.map((r) => `union all
select 'remove', a.society_id::text, a.id, a.name
  from public.accounts a
 where ${removeWhere(r)}
union all
select 'keep (in use)', a.society_id::text, a.id, a.name
  from public.accounts a
 where ${isHead(r)}
   and not (${removable})`).join('\n')}
 order by 1, 3, 2;
`;

  const down = `-- 155 down · restore every row migration 155 reclassified or removed (from account_reclass_log) and remove
-- the two heads it added, where nothing references them. The app's own ACCOUNT_PATCHES still shows 5311 as an
-- appropriation on screen — revert the code as well if that is the intent.
begin;
update public.accounts a
   set type = l.old_row->>'type', "parentId" = l.old_row->>'parentId', subtype = l.old_row->>'subtype',
       "openingBalanceType" = l.old_row->>'openingBalanceType', name = l.old_row->>'name', "nameHi" = l.old_row->>'nameHi'
  from public.account_reclass_log l
 where l.migration = '155' and a.society_id::text = l.society_id and a.id = l.account_id;
insert into public.accounts
select (jsonb_populate_record(null::public.accounts, l.old_row)).*
  from public.account_reclass_log l
 where l.migration = '155'
   and not exists (select 1 from public.accounts a where a.society_id::text = l.society_id and a.id = l.account_id);
delete from public.accounts a
 where a.id in (${S.ACCOUNTS_TO_ADD_155.map((x) => q(x.id)).join(', ')})
   and a.name in (${S.ACCOUNTS_TO_ADD_155.map((x) => q(x.name)).join(', ')})
   and coalesce(a."openingBalance", 0) = 0
   and not exists (select 1 from public.voucher_lines l where l.society_id::text = a.society_id::text and l.account_id = a.id)
   and not exists (select 1 from public.voucher_entries l where l.society_id::text = a.society_id::text and l."accountId" = a.id)
   and not exists (select 1 from public.account_roles r where r.society_id::text = a.society_id::text and r.account_id = a.id);
delete from public.account_reclass_log where migration = '155';
delete from public.app_migrations where version = '155';
commit;
notify pgrst, 'reload schema';
`;
  return {
    'supabase/migrations/155_chart_fact_corrections.sql': migration,
    'supabase/migrations/155_chart_fact_corrections_down.sql': down,
    'supabase/diagnostics/preview_155_chart_fact_corrections.sql': preview,
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  for (const [f, text] of Object.entries(buildFiles())) { writeFileSync(path.join(ROOT, f), text, 'utf8'); console.log('wrote', f); }
}

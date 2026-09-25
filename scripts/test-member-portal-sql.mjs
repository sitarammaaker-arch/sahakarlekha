// Member Portal S1 · 064_member_portal.sql — STATIC security guard (no DB). Pins the properties the
// portal's safety rests on: the link table is unreachable from the client, the snapshot RPC takes no
// parameters (identity from auth.uid() only), runs SECURITY DEFINER with a pinned search_path, is not
// executable by anon, scopes every read to the linked society + member, filters soft-deleted rows,
// masks KYC, exposes only share-capital vouchers, and applies the founder's plan gate.
// Run: node scripts/test-member-portal-sql.mjs
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const read = (p) => readFileSync(pathResolve(ROOT, p), 'utf8');
const stripComments = (sql) => sql.replace(/--[^\n]*/g, '');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const up = stripComments(read('supabase/migrations/064_member_portal.sql'));
const down = stripComments(read('supabase/migrations/064_member_portal_down.sql'));

// ── link table ──
ok(/begin;[\s\S]*commit;/.test(up), 'runs in a transaction');
ok(/create table if not exists public\.member_portal_users/.test(up), 'creates member_portal_users');
ok(/auth_user_id uuid primary key references auth\.users\(id\) on delete cascade/.test(up), 'keyed on auth user, cascades on auth delete');
ok(/unique \(society_id, member_id\)/.test(up), 'one login per member');
ok(/alter table public\.member_portal_users enable row level security/.test(up), 'RLS enabled on link table');
ok(!/create policy/i.test(up), 'NO policy created (deny-all to clients)');
ok(/revoke all on public\.member_portal_users from anon, authenticated/.test(up), 'table privileges revoked from anon + authenticated');

// ── snapshot RPC ──
ok(/create or replace function public\.member_portal_snapshot\(\)\s*returns jsonb/.test(up), 'RPC takes ZERO parameters');
ok(/security definer/.test(up) && /set search_path = ''/.test(up), 'SECURITY DEFINER with pinned empty search_path');
ok(/v_uid\s+uuid := auth\.uid\(\)/.test(up), 'identity comes from auth.uid()');
ok(/where auth_user_id = v_uid/.test(up), 'link resolved by auth uid only');
ok(/not v_link\.is_active/.test(up), 'revoked logins denied');
ok(/'resigned', 'expelled', 'deceased'/.test(up), 'exited members denied');
ok(/coalesce\("isDeleted", false\) = false/.test(up), 'archived member denied');
ok(/revoke all on function public\.member_portal_snapshot\(\) from public, anon/.test(up), 'anon/public cannot execute');
ok(/grant execute on function public\.member_portal_snapshot\(\) to authenticated/.test(up), 'authenticated can execute');

// Every table read is scoped to the linked society (+ member where applicable).
for (const [alias, table] of [['v', 'vouchers'], ['l', 'loans'], ['d', 'deposit_accounts'], ['t', 'deposit_transactions'], ['k', 'kcc_loans']]) {
  ok(new RegExp(`from public\\.${table} ${alias}[\\s\\S]*?where ${alias}\\.society_id = v_link\\.society_id`).test(up), `${table} scoped to linked society`);
}
for (const alias of ['v', 'l', 'd', 'k']) ok(new RegExp(`${alias}\\."memberId" = v_member\\.id`).test(up), `alias ${alias} scoped to the member`);
ok(/d\."memberId" = v_member\.id[\s\S]*kcc_loans/.test(up), 'deposit transactions scoped via the member\'s accounts');
ok(/where id = v_link\.member_id and society_id = v_link\.society_id/.test(up), 'member row scoped to link');
ok(/society_settings s where s\.society_id = v_link\.society_id/.test(up), 'society name scoped to link');

// RULE 5 + data minimisation.
ok(/coalesce\(v\."isDeleted", false\) = false/.test(up), 'soft-deleted vouchers excluded');
ok(/coalesce\(l\."isDeleted", false\) = false/.test(up), 'soft-deleted loans excluded');
ok(/v\."creditAccountId" = '1102' or v\."debitAccountId" = '1102'/.test(up), 'only share-capital (1102) vouchers exposed');
ok(/'aadhaarMasked'/.test(up) && /'panMasked'/.test(up), 'KYC masked');
ok(!/'aadhaar', v_member\.aadhaar/.test(up) && !/'pan', v_member\.pan/.test(up), 'raw aadhaar/pan never returned');

// Plan gate — mirrors useSubscription (missing row ⇒ legacy/active).
ok(/v_plan := coalesce\(v_plan, 'legacy'\)/.test(up) && /v_status := coalesce\(v_status, 'active'\)/.test(up), 'missing subscription = legacy/active');
ok(/v_plan not in \('plus', 'pro', 'enterprise', 'legacy', 'trial'\)/.test(up), 'starter excluded');
ok(/v_status not in \('active', 'trialing', 'grace'\)/.test(up), 'expired excluded');

// ── down ──
ok(/drop function if exists public\.member_portal_snapshot\(\)/.test(down), 'down drops the RPC');
ok(/drop table if exists public\.member_portal_users/.test(down), 'down drops the link table');

console.log(`member-portal SQL (064): ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

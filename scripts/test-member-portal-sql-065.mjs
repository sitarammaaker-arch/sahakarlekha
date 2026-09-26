// Member Portal S4a · 065_member_portal_verticals.sql — STATIC guard (no DB).
// 065 REPLACES member_portal_snapshot(), so every 064 security property is re-asserted on it, then
// the S4 additions: each vertical read is scoped to the linked society AND this member, soft-deleted
// rows excluded, distributions limited to APPROVED runs and to the member's OWN line, milk windowed
// (dues are not), and the down migration restores the 064 function byte-for-byte.
// Run: node scripts/test-member-portal-sql-065.mjs
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const read = (p) => readFileSync(pathResolve(ROOT, p), 'utf8');
const stripComments = (sql) => sql.replace(/--[^\n]*/g, '');
const fnOf = (sql) => sql.slice(sql.indexOf('create or replace function public.member_portal_snapshot()'), sql.indexOf('$$;', sql.indexOf('create or replace function public.member_portal_snapshot()')) + 3);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const raw064 = read('supabase/migrations/064_member_portal.sql');
const up = stripComments(read('supabase/migrations/065_member_portal_verticals.sql'));
const down = read('supabase/migrations/065_member_portal_verticals_down.sql');

// ── 064 invariants still hold on the replaced function ──
ok(/begin;[\s\S]*commit;/.test(up), 'runs in a transaction');
ok(!/create policy|create table|drop table|alter table/i.test(up), 'function-only change: no table/policy DDL');
ok(/create or replace function public\.member_portal_snapshot\(\)\s*returns jsonb/.test(up), 'RPC still takes ZERO parameters');
ok(/security definer/.test(up) && /set search_path = ''/.test(up), 'SECURITY DEFINER + pinned empty search_path');
ok(/v_uid\s+uuid := auth\.uid\(\)/.test(up) && /where auth_user_id = v_uid/.test(up), 'identity from auth.uid() only');
ok(/not v_link\.is_active/.test(up) && /'resigned', 'expelled', 'deceased'/.test(up), 'revoked logins + exited members denied');
ok(/v_plan not in \('plus', 'pro', 'enterprise', 'legacy', 'trial'\)/.test(up) && /v_status not in \('active', 'trialing', 'grace'\)/.test(up), 'plan gate unchanged');
ok(/revoke all on function public\.member_portal_snapshot\(\) from public, anon/.test(up), 'anon/public cannot execute');
ok(/grant execute on function public\.member_portal_snapshot\(\) to authenticated/.test(up), 'authenticated can execute');
ok(/'aadhaarMasked'/.test(up) && !/'aadhaar', v_member\.aadhaar/.test(up), 'KYC still masked');
ok(/v\."creditAccountId" = '1102' or v\."debitAccountId" = '1102'/.test(up), 'share vouchers still 1102-only');
for (const key of ['shareVouchers', 'loans', 'deposits', 'depositTransactions', 'kccLoans']) ok(up.includes(`'${key}'`), `064 key kept: ${key}`);
// Everything the 064 function returned before the new keys is byte-identical (additive change).
const f064 = stripComments(fnOf(raw064));
const f065 = fnOf(up);
const pre064 = f064.slice(f064.indexOf("'ok', true"), f064.indexOf("'kccLoans'"));
ok(pre064.length > 1000, 'payload slice found');
ok(f065.includes(pre064), '064 profile/share/loan/deposit payload is byte-identical in 065');

// ── S4: every vertical read scoped to the linked society + this member ──
const scoped = [
  ['e', 'milk_entries'], ['d', 'dairy_settlements'], ['i', 'dairy_input_issues'], ['b', 'maintenance_bills'],
  ['f', 'housing_flats'], ['s', 'sales'], ['r', 'sales_returns'],
];
for (const [a, t] of scoped) {
  ok(new RegExp(`from public\\.${t} ${a}\\s[\\s\\S]*?where ${a}\\.society_id = v_link\\.society_id and ${a}\\."memberId" = v_member\\.id`).test(up), `${t}: society + member scoped`);
}
ok(/'creditRecoveries'[\s\S]*?where v\.society_id = v_link\.society_id and v\."memberId" = v_member\.id[\s\S]*?'consumer\.member\.recovery'/.test(up), 'recovery vouchers: society + member + refType scoped');
ok(/'maintenanceVouchers'[\s\S]*?where v\.society_id = v_link\.society_id[\s\S]*?v\."refId" in \(select b\.id from public\.maintenance_bills b[\s\S]*?b\."memberId" = v_member\.id/.test(up), 'maintenance vouchers limited to THIS member\'s bills');
ok(/'dairyInputAccounts'[\s\S]*?where a\.society_id = v_link\.society_id/.test(up), 'input account lookup society-scoped');
ok(/a\.id = '3305'/.test(up) && /सदस्य आदान प्राप्य/.test(up) && /member input receivable/.test(up), 'input account matches resolveMemberInputReceivableAccountId (id 3305 + its names)');

// RULE 5 — soft-deleted excluded wherever the table has the column (milk_entries has none).
for (const a of ['d', 'i', 'b', 'f', 's', 'r']) ok(new RegExp(`coalesce\\(${a}\\."isDeleted", false\\) = false`).test(up), `alias ${a}: isDeleted excluded`);
ok(!/e\."isDeleted"/.test(up), 'milk_entries.isDeleted NOT referenced (column does not exist)');

// Distributions: approved only, own line only.
for (const t of ['dairy_distributions', 'consumer_patronage_runs']) {
  const block = up.slice(up.indexOf(`from public.${t} r`), up.indexOf(`from public.${t} r`) + 500);
  ok(/r\.society_id = v_link\.society_id/.test(block), `${t}: society scoped`);
  ok(/r\.status = 'approved'/.test(block), `${t}: approved runs only`);
  ok(/coalesce\(r\."isDeleted", false\) = false/.test(block), `${t}: deleted runs excluded`);
  ok(/ln\.value ->> 'memberId' = v_member\.id/.test(block), `${t}: only the member's own line`);
}
ok(!/'lines', r\.lines/.test(up), 'full lines arrays (other members) never returned');

// Consumer inputs limited to what memberOutstanding counts.
ok(/s\."paymentMode" = 'credit'/.test(up), 'only credit sales');
ok(/r\."refundMode" = 'credit-adjust'/.test(up), 'only credit-adjusted returns');

// Milk window (founder decision) — and dues are NOT windowed.
ok(/e\.date >= v_milk_from/.test(up), 'milk entries windowed');
ok(/make_date\([\s\S]*?, 4, 1\) - interval '1 month'/.test(up), 'window = FY start (1 April) minus one month');
const settleBlock = up.slice(up.indexOf("'dairySettlements'"), up.indexOf("'dairyInputIssues'"));
ok(!/v_milk_from/.test(settleBlock), 'settlements (dues) are the full history');

// ── down restores the 064 function exactly ──
ok(fnOf(down) === fnOf(raw064), 'down restores the 064 function byte-for-byte');
ok(/revoke all on function public\.member_portal_snapshot\(\) from public, anon/.test(down) && /grant execute on function public\.member_portal_snapshot\(\) to authenticated/.test(down), 'down keeps the grants');

console.log(`member-portal SQL (065): ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

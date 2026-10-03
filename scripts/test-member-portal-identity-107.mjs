// Migration 107 re-issues member_portal_snapshot() from 070. The ONLY allowed difference is where the
// masked PAN/Aadhaar come from. This test proves it: apply the known substitutions to 070's function and
// the result must equal 107's function byte for byte — so nothing else in the 380-line function drifted.
// Run: node scripts/test-member-portal-identity-107.mjs
import fs from 'node:fs';
const rd = (f) => fs.readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const fnOf = (sql) => sql.slice(sql.indexOf('create or replace function public.member_portal_snapshot()'), sql.indexOf('\n$$;') + 4);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const m070 = rd('070_member_portal_loan_interest.sql');
const up = rd('107_member_portal_identity.sql');
const down = rd('107_member_portal_identity_down.sql');

let expected = fnOf(m070)
  .replace("  v_milk_from text;\nbegin", "  v_milk_from text;\n  v_aadhaar text;\n  v_pan     text;\nbegin")
  .replace("  select plan, status into v_plan, v_status from public.subscriptions where society_id = v_link.society_id;",
`  -- 107: PAN/Aadhaar live in member_identity; fall back to the legacy members columns until they are blanked.
  select i.aadhaar, i.pan into v_aadhaar, v_pan
  from public.member_identity i
  where i.society_id = v_link.society_id and i.member_id = v_member.id;
  v_aadhaar := coalesce(nullif(v_aadhaar, ''), v_member.aadhaar);
  v_pan     := coalesce(nullif(v_pan, ''), v_member.pan);

  select plan, status into v_plan, v_status from public.subscriptions where society_id = v_link.society_id;`)
  .replace("coalesce(v_member.aadhaar, '') = ''", "coalesce(v_aadhaar, '') = ''")
  .replace("regexp_replace(v_member.aadhaar,", "regexp_replace(v_aadhaar,")
  .replace("coalesce(v_member.pan, '') = ''", "coalesce(v_pan, '') = ''")
  .replace("right(v_member.pan, 5)", "right(v_pan, 5)");
ok(fnOf(up) === expected, '107 function == 070 function + exactly the identity substitutions');
ok(/to_regclass\('public\.member_identity'\) is null[\s\S]*107 needs 106/.test(up), '107 refuses to run before 106');
ok(/security definer\s+set search_path = ''/.test(fnOf(up)) && /public\.member_identity/.test(fnOf(up)), 'still SECURITY DEFINER, search_path empty, table schema-qualified');
ok(/revoke execute on function public\.member_portal_snapshot\(\) from public, anon;/.test(up) && /grant execute on function public\.member_portal_snapshot\(\) to authenticated;/.test(up), 'anon still cannot execute');
ok(/insert into public\.app_migrations \(version, name\) values \('107', 'member_portal_identity'\)/.test(up), 'recorded in app_migrations');
ok(fnOf(down) === fnOf(m070), 'down restores 070 function exactly');
ok(/delete from public\.app_migrations where version = '107'/.test(down), 'down removes the app_migrations row');
ok(!/v_member\.aadhaar, ''\) = ''/.test(fnOf(up)), 'no mask expression still reads members.aadhaar directly');

console.log(`\nMigration 107 (portal identity): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

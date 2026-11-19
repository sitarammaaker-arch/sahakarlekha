// SEC-06 (product audit 2026-11-17) — maker-checker enforced by the server, migration 183.
// Before: self-approval compared free-text NAMES, createdBy came from the browser ('' / 'system' skipped the check),
// approvedBy was whatever the browser sent, any writer could approve, and post_voucher ignored the approval rules.
// The SQL was run end to end on Postgres (PGlite) on the production function bodies while building. Before 183: a maker
// whose browser sent a different createdBy approved their own voucher, a blank maker was approved by an accountant,
// and a voucher over the threshold posted straight. After 183: the maker (even as admin) and any later editor got
// self_approval, an accountant got not_an_approver, another login approved and approvedBy came from the token, manual
// vouchers over the threshold / of a held type / under "all manual" got needs_approval while auto ones and
// societies with no rules still posted, a pre-183 pending voucher kept the name check, a re-run was clean, and the down
// file restored the old bodies and dropped the column.
// Run: node scripts/test-sec06-maker-checker.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const m = read('supabase/migrations/183_maker_checker_server.sql');
const d = read('supabase/migrations/183_maker_checker_server_down.sql');
const fn = (sql, name) => {
  const i = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  return i < 0 ? '' : sql.slice(i, sql.indexOf('$function$\n;', i));
};

ok(/alter table public\.vouchers add column if not exists "makerEmails" text\[\];/.test(m), 'vouchers."makerEmails" is added (server-only; the browser never sends it)');

// ── save_pending_voucher ──
{
  const f = fn(m, 'save_pending_voucher');
  ok(f.includes(`v_email      text := lower(nullif(trim(auth.jwt() ->> 'email'), ''));`) && f.includes(`raise exception 'post_voucher:no_email_claim'`), 'the maker is the token email; no email, no save');
  ok(f.includes(`(p_voucher - 'makerEmails') || jsonb_build_object(`) && f.includes(`'createdBy', coalesce(v_name, v_email), 'makerEmails', jsonb_build_array(v_email)`), 'a new held voucher: createdBy and makerEmails come from the token, not the JSON');
  ok(f.includes(`- 'createdBy' - 'makerEmails');`), 'an edit cannot rewrite createdBy / makerEmails from the JSON');
  ok(f.includes(`"makerEmails" = (select array_agg(distinct e order by e) from unnest(coalesce(t."makerEmails", '{}'::text[]) || v_email) e)`), 'whoever edits a held voucher joins its makers');
}

// ── approve_voucher ──
{
  const f = fn(m, 'approve_voucher');
  ok(f.includes(`if v_role not in ('admin', 'societyAdmin', 'manager', 'procurementOfficer', 'boardMember', 'chairman', 'secretary') then raise exception 'post_voucher:not_an_approver'`), 'only rbac approve roles approve');
  for (const r of ['accountant', 'cashier', 'dataEntry', 'employee', 'storeKeeper', 'salesOperator']) {
    ok(!f.slice(f.indexOf('not_an_approver') - 160, f.indexOf('not_an_approver')).includes(`'${r}'`), `${r} cannot approve`);
  }
  ok(f.includes(`if v_email = any(v_cur."makerEmails") then raise exception 'post_voucher:self_approval'`), 'maker ≠ checker by email');
  ok(!f.includes('p_approved_by, v_me') && !/coalesce\(p_approved_by/.test(f) && (f.match(/coalesce\(v_me, v_email\)/g) || []).length === 4, 'approvedBy and the journal producer come from the token (4 places), never p_approved_by');
  ok(/elsif lower\(trim\(coalesce\(v_cur\."createdBy", ''\)\)\) not in/.test(f), 'only a pre-183 held voucher (no makerEmails) falls back to the name check');
}

// ── reject_voucher ──
{
  const f = fn(m, 'reject_voucher');
  ok(f.includes(`not in ('admin', 'societyAdmin', 'manager', 'boardMember', 'chairman', 'secretary') then raise exception 'post_voucher:not_an_approver'`), 'only rbac reject roles reject (procurementOfficer has approve but not reject)');
  ok(f.includes(`"approvedBy" = coalesce(v_me, v_email),`) && !f.includes('"approvedBy" = p_rejected_by'), 'who rejected comes from the token');
}

// ── post_voucher ──
{
  const f = fn(m, 'post_voucher');
  ok(f.includes(`if coalesce(p_voucher ->> 'origin', '') = 'manual' then`) && f.includes(`raise exception 'post_voucher:needs_approval'`), 'a manual voucher the rules hold cannot be posted straight');
  ok(f.includes(`coalesce(v_appr_all, false)`) && f.includes(`(coalesce(v_appr_min, 0) > 0 and v_amount >= v_appr_min)`) && f.includes(`(jsonb_typeof(v_appr_types) = 'array' and v_appr_types ? coalesce(p_voucher ->> 'type', ''))`), 'same three rules as src/lib/approvalMatrix.ts');
  const mx = read('src/lib/approvalMatrix.ts');
  ok(mx.includes('if (opts.approvalRequired) return true;') && mx.includes('(amount || 0) >= opts.threshold') && mx.includes('opts.types.includes(type)'), 'the client matrix still has the same three rules (all-manual, ≥ threshold, type)');
  ok(f.includes(`if coalesce(p_voucher ->> 'approvalStatus', '') = 'pending' then raise exception 'post_voucher:pending_not_supported'`), 'post_voucher still refuses a pending voucher');
}

// ── only marked lines changed; down restores production ──
{
  for (const name of ['save_pending_voucher', 'approve_voucher', 'reject_voucher', 'post_voucher']) {
    ok(fn(m, name) && fn(d, name), `${name} is in both files`);
    ok(!fn(d, name).includes('183 / SEC-06'), `down's ${name} is the pre-183 body`);
  }
  ok(fn(d, 'approve_voucher').includes('coalesce(p_approved_by, v_me)') && /alter table public\.vouchers drop column if exists "makerEmails";/.test(d), 'down = production bodies + drops the column');
  ok(/^begin;/m.test(m) && /^commit;/m.test(m) && /values \('183', 'maker_checker_server'\)/.test(m), '183 is one transaction and registers itself');
}

// ── client messages ──
{
  const msg = read('src/lib/ledger/postVoucherMessages.ts');
  for (const c of ['needs_approval', 'not_an_approver', 'no_email_claim']) ok((msg.match(new RegExp(`\\b${c}:`, 'g')) || []).length === 2, `${c} has a Hindi and an English message`);
}

console.log(`SEC-06 maker-checker (183): ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

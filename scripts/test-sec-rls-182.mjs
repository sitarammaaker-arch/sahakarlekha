// SEC-04 + SEC-03 (product audit 2026-11-17, both confirmed in production) — migration 182.
//   SEC-04  jwt_can_write() / jwt_can_delete() passed a token with NO role claim (fail-open) → no claim, no write.
//   SEC-03  71 tables' write policies checked only the society, so a viewer / auditor / CA login could write and
//           hard-delete them through the REST API → every PERMISSIVE write policy there also requires jwt_can_write().
// The SQL was run end to end on Postgres (PGlite) with real RLS while building: before 182 a viewer, an auditor and a
// claim-less token all inserted / updated / deleted loans, document numbers and journal events; after it every one of
// those was refused while an accountant's writes all went through, the auditor could still file an objection, another
// society stayed refused, a re-run changed nothing, and the down file restored every original policy.
// Run: node scripts/test-sec-rls-182.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const m = read('supabase/migrations/182_role_gate_fail_closed_and_table_writes.sql');
const d = read('supabase/migrations/182_role_gate_fail_closed_and_table_writes_down.sql');
const code = m.replace(/--.*$/gm, '');
const fn = (name) => code.slice(code.indexOf(`create or replace function public.${name}()`), code.indexOf('$$;', code.indexOf(`create or replace function public.${name}()`)));

// ── SEC-04 ──
{
  const w = fn('jwt_can_write'), del = fn('jwt_can_delete');
  ok(!/is null/.test(w) && !/is null/.test(del), 'neither helper lets a token without a role claim through');
  ok(/select coalesce\(auth\.jwt\(\) ->> 'user_role', ''\) in \(/.test(w) && /select coalesce\(auth\.jwt\(\) ->> 'user_role', ''\) in \('admin', 'societyAdmin', 'secretary'\)/.test(del), 'a missing claim compares as "" — in no list');
  for (const r of ['admin', 'accountant', 'societyAdmin', 'manager', 'cashier', 'storeKeeper', 'procurementOfficer', 'salesOperator', 'secretary', 'employee', 'dataEntry', 'boardMember', 'chairman']) {
    ok(w.includes(`'${r}'`), `jwt_can_write keeps writer role ${r} (045's list unchanged)`);
  }
  for (const r of ['viewer', 'auditor', 'internalAuditor', 'externalCA', 'readOnly']) ok(!w.includes(`'${r}'`), `jwt_can_write never admits read-only role ${r}`);
}

// ── SEC-03 ──
{
  const list = [...(code.match(/tbls text\[\] := array\[([\s\S]*?)\];/) || [, ''])[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
  ok(list.length === 71 && new Set(list).size === 71, `71 tables, each once (found ${list.length})`);
  for (const t of ['loans', 'kcc_loans', 'assets', 'salary_records', 'employees', 'tds_entries', 'tds_challans', 'suppliers', 'customers', 'voucher_entries', 'ledger_events', 'document_sequences']) {
    ok(list.includes(t), `${t} is gated`);
  }
  for (const t of ['audit_objections', 'audit_log', 'error_log', 'feedback', 'leads', 'societies', 'society_settings', 'society_capabilities', 'society_users', 'members', 'vouchers', 'sales', 'purchases']) {
    ok(!list.includes(t), `${t} is left alone (auditor note / own-action log / public form / admin-gated / already role-scoped)`);
  }
  ok(/and permissive = 'PERMISSIVE' and cmd in \('ALL', 'INSERT', 'UPDATE', 'DELETE'\)/.test(code), 'only PERMISSIVE write policies are touched (the RESTRICTIVE branch layer stays)');
  ok(/coalesce\(qual, ''\) !~\* 'jwt_can_\(write\|delete\)' and coalesce\(with_check, ''\) !~\* 'jwt_can_\(write\|delete\)'/.test(code), 'an already-gated policy is skipped (idempotent)');
  ok((code.match(/and public\.jwt_can_write\(\)\)/g) || []).length >= 7 && !/jwt_can_delete\(\)\)', n_del/.test(code), 'every write command — DELETE included — requires jwt_can_write()');
  ok(/for delete to %s using \(\(%s\) and public\.jwt_can_write\(\)\)/.test(code), 'DELETE uses jwt_can_write, so writer roles\' ordinary hard deletes keep working');
  ok(/create policy %I on public\.%I as permissive for select to %s using \(%s\)', p\.policyname/.test(code), 'an ALL policy keeps its exact read rule as the select policy');
  ok(/string_agg\(quote_ident\(r\), ', '\) into to_roles from unnest\(p\.roles\) r/.test(code), 'each policy keeps its own roles');
  ok(/create table if not exists public\._rls_182_backup/.test(code) && /revoke all on table public\._rls_182_backup from public, anon, authenticated;/.test(code), 'the originals are kept, closed to clients');
}

// ── down + registry ──
{
  ok(/is null\s*or auth\.jwt\(\) ->> 'user_role' in \(/.test(d), 'down restores 045\'s helpers');
  ok(/for b in select \* from public\._rls_182_backup loop/.test(d) && /drop table if exists public\._rls_182_backup;/.test(d), 'down recreates every original policy from the backup');
  ok(/^begin;/m.test(m) && /^commit;/m.test(m) && /values \('182', 'role_gate_fail_closed_and_table_writes'\)/.test(m), '182 runs in one transaction and registers itself');
}

console.log(`SEC-04/03 migration 182: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

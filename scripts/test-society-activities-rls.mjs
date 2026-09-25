// 063 · society_activities tenant RLS — STATIC guard (no DB). Fails if the cross-tenant `allow_all`
// hole can come back: 063 must drop every permissive policy (snapshotting it), create the four
// tenant-scoped policies with the same role gates as 030/031, and the master schema file must not
// recreate a permissive policy on re-run. Run: node scripts/test-society-activities-rls.mjs
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const read = (p) => readFileSync(pathResolve(ROOT, p), 'utf8');
const stripComments = (sql) => sql.replace(/--[^\n]*/g, '');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const up = stripComments(read('supabase/migrations/063_society_activities_tenant_rls.sql'));
const down = stripComments(read('supabase/migrations/063_society_activities_tenant_rls_down.sql'));
const master = stripComments(read('supabase-tables.sql'));

// ── up migration ──
ok(/begin;[\s\S]*commit;/.test(up), 'up runs in a transaction');
ok(/coalesce\(qual, ''\) = 'true' or coalesce\(with_check, ''\) = 'true'/.test(up), 'up finds permissive policies by qual/with_check = true');
ok(/insert into public\.rls_policy_backup/.test(up), 'up snapshots dropped policies into rls_policy_backup');
ok(/drop policy %I on public\.society_activities/.test(up), 'up drops the permissive policies');
ok(!/using\s*\(\s*true\s*\)/i.test(up) && !/with check\s*\(\s*true\s*\)/i.test(up), 'up creates NO permissive policy');

const policy = (name) => {
  const m = up.match(new RegExp(`create policy ${name} on public\\.society_activities([\\s\\S]*?);`));
  return m ? m[1] : '';
};
const TENANT = 'society_id::text = get_current_society_id()';
const sel = policy('society_activities_tenant_select');
const ins = policy('society_activities_tenant_insert');
const upd = policy('society_activities_tenant_update');
const del = policy('society_activities_tenant_delete');
ok(/for select/.test(sel) && sel.includes(TENANT), 'SELECT is tenant-scoped');
ok(/for insert/.test(ins) && ins.includes(TENANT) && ins.includes('jwt_can_write()'), 'INSERT is tenant-scoped + jwt_can_write');
ok(/for update/.test(upd) && (upd.match(/get_current_society_id\(\)/g) || []).length === 2 && (upd.match(/jwt_can_write\(\)/g) || []).length === 2, 'UPDATE using + with check both tenant-scoped + jwt_can_write');
ok(/for delete/.test(del) && del.includes(TENANT) && del.includes('jwt_can_delete()'), 'DELETE is tenant-scoped + jwt_can_delete');
ok(!/for all/i.test(up), 'no FOR ALL policy');

// ── down migration is faithful ──
for (const n of ['select', 'insert', 'update', 'delete']) ok(down.includes(`drop policy if exists society_activities_tenant_${n}`), `down drops tenant_${n}`);
ok(/create policy "allow_all" on public\.society_activities/.test(down), 'down restores the pre-063 allow_all');
ok(/delete from public\.rls_policy_backup/.test(down), 'down clears its backup snapshot');

// ── master schema must not recreate the hole ──
const block = master.slice(master.indexOf('create table if not exists society_activities'), master.indexOf('idx_society_activities_society'));
ok(block.length > 0, 'master file has the society_activities block');
ok(!/create policy/i.test(block), 'master file creates no policy on society_activities (063 owns them)');

console.log(`society-activities RLS (063): ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

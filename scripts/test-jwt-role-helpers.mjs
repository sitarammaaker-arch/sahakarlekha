// Drift guard: the role lists inside migration 045 (jwt_can_write / jwt_can_delete) must stay
// derived from the REAL PERMISSION_MATRIX (src/lib/rbac.ts). If the matrix gains/loses a
// role-permission, this goes red until the SQL (a follow-up migration) is updated to match.
//
// Derivation rules (mirrors the migration's header comment):
//   write  = roles with UPDATE or APPROVE, minus superAdmin, plus legacy 'admin'/'accountant'.
//            (APPROVE counts because approve/reject is an UPDATE on the vouchers row.)
//   delete = roles with DELETE, minus superAdmin, plus legacy 'admin'.
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const { PERMISSION_MATRIX, ROLES } = await import(abs('../src/lib/rbac.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── expected sets, derived from the matrix ───────────────────────────────────
const expectWrite = new Set(['admin', 'accountant']);
for (const r of ROLES) {
  if (r === 'superAdmin') continue; // platform admin has no society JWT
  const p = PERMISSION_MATRIX[r];
  if (p.has('update') || p.has('approve')) expectWrite.add(r);
}
const expectDelete = new Set(['admin']);
for (const r of ROLES) {
  if (r === 'superAdmin') continue;
  if (PERMISSION_MATRIX[r].has('delete')) expectDelete.add(r);
}

// ── actual sets, parsed from the migration SQL ───────────────────────────────
const sql = readFileSync(pathResolve(HERE, '..', 'supabase', 'migrations', '045_jwt_role_helpers_17roles.sql'), 'utf8');
function rolesOf(fnName) {
  const start = sql.indexOf(`function public.${fnName}()`);
  const end = sql.indexOf('$$;', start);
  const body = sql.slice(start, end);
  return new Set([...body.matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]).filter((s) => s !== 'user_role'));
}
const sqlWrite = rolesOf('jwt_can_write');
const sqlDelete = rolesOf('jwt_can_delete');

const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const show = (s) => [...s].sort().join(',');

ok(same(sqlWrite, expectWrite), `jwt_can_write matches the matrix derivation\n    sql:      ${show(sqlWrite)}\n    expected: ${show(expectWrite)}`);
ok(same(sqlDelete, expectDelete), `jwt_can_delete matches the matrix derivation\n    sql:      ${show(sqlDelete)}\n    expected: ${show(expectDelete)}`);

// Sanity: the roles the runbook deliberately EXCLUDES from write never creep in.
for (const r of ['auditor', 'internalAuditor', 'externalCA', 'readOnly', 'superAdmin', 'viewer']) {
  ok(!sqlWrite.has(r), `${r} stays out of jwt_can_write`);
}
ok(!sqlDelete.has('accountant') && !sqlDelete.has('manager'), 'delete stays admin/societyAdmin/secretary only');

console.log(`JWT role helpers (mig 045 ↔ PERMISSION_MATRIX): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

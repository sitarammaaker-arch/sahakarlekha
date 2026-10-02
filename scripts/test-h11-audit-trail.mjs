#!/usr/bin/env node
// H11 · governance trail. Prod audit_log (2026-10-02) had no row for any sale/purchase EDIT and none for
// account / salary-slip / supplier / customer deletes: those functions "audited" with console.info only,
// which dies in the browser. Every one now writes a durable audit_log row via emitAudit.
// Run: node scripts/test-h11-audit-trail.mjs
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };
const dc = readFileSync(resolve(root, 'src/contexts/DataContext.tsx'), 'utf8');
const fnBody = (name) => { const s = dc.indexOf(`  const ${name} = useCallback(`); return s < 0 ? '' : dc.slice(s, dc.indexOf('\n  }, [', s)); };

for (const [fn, type, action] of [['updateSale', 'sale', 'update'], ['updatePurchase', 'purchase', 'update'], ['deleteAccount', 'account', 'delete'],
  ['deleteSalaryRecord', 'salaryRecord', 'delete'], ['deleteSupplier', 'supplier', 'delete'], ['deleteCustomer', 'customer', 'delete']]) {
  ok(`${fn} writes an audit_log row (${type} ${action})`, fnBody(fn).includes(`emitAudit({ entityType: '${type}', entityId: id, action: '${action}'`));
}
for (const fn of ['updateSale', 'updatePurchase']) {
  const b = fnBody(fn);
  const at = b.indexOf("action: 'update'"), srv = b.indexOf('const srv =');
  ok(`${fn} audits BEFORE the server/legacy split (both paths record the edit)`, at > 0 && srv > 0 && at < srv);
}
ok('no console-only edit audit remains', !dc.includes('[AUDIT-EDIT]'));

// Every remaining console "[AUDIT-DELETE]" stub must sit in a function that ALSO writes a real row.
const stubs = [...dc.matchAll(/\[AUDIT-DELETE\] (\w+) id=/g)];
const bad = stubs.filter(m => {
  const head = dc.lastIndexOf('\n  const ', m.index);
  return !dc.slice(head, m.index).includes('emitAudit(');
}).map(m => m[1]);
ok(`every remaining console audit stub is backed by emitAudit${bad.length ? ' (missing: ' + bad.join(', ') + ')' : ''}`, bad.length === 0);

console.log(`\nH11 audit trail: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

// Detailed Audit Trail — one list from the vouchers' own history + the append-only audit_log,
// with before → after, no event shown twice, and never a partial trail passed off as complete.
// Run: node scripts/test-audit-trail.mjs
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const A = await imp('src/lib/auditTrail.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const accName = (id) => ({ '3301': 'Cash', '3302': 'Bank', '5301': 'Salary' }[id] ?? id);
const v1 = {
  id: 'v1', voucherNo: 'PV/1', type: 'payment', date: '2026-05-01', amount: 1200, narration: 'Salary May', debitAccountId: '5301', creditAccountId: '3302',
  createdAt: '2026-05-01T10:00:00Z', createdBy: 'Ram',
  // Two edits: first changed amount 1000→1100 and bank←cash; second 1100→1200.
  editHistory: [
    { editedAt: '2026-05-02T09:00:00Z', editedBy: 'Shyam', before: { amount: 1000, creditAccountId: '3301', narration: 'Salary May' } },
    { editedAt: '2026-05-03T09:00:00Z', editedBy: 'Ram', before: { amount: 1100, creditAccountId: '3302', narration: 'Salary May' } },
  ],
  isDeleted: true, deletedAt: '2026-05-04T09:00:00Z', deletedBy: 'Admin', deletedReason: 'Duplicate',
  approvalStatus: 'approved', approvedAt: '2026-05-01T12:00:00Z', approvedBy: 'Chairman',
};
const ve = A.voucherEvents([v1], accName);
ok(ve.filter((e) => e.action === 'create').length === 1 && ve[0].actor === 'Ram' && ve[0].ref === 'PV/1', 'creation from createdAt / createdBy');
const edits = ve.filter((e) => e.action === 'update');
ok(edits.length === 2, 'one event per edit');
ok(edits[0].details === 'creditAccountId: Cash → Bank; amount: 1000 → 1100' && edits[0].actor === 'Shyam', `edit 1: before → the next snapshot, account names resolved (${edits[0].details})`);
ok(edits[1].details === 'amount: 1100 → 1200', `edit 2: before → the live voucher; unchanged fields omitted (${edits[1].details})`);
ok(ve.some((e) => e.action === 'approve' && e.actor === 'Chairman') && ve.some((e) => e.action === 'cancel' && e.reason === 'Duplicate'), 'approval and cancellation from the voucher row');

// audit_log: a cancel for v1 (richer: role) + a member edit.
const rows = [
  { created_at: '2026-05-04T09:00:01Z', actor_name: 'Admin', actor_role: 'admin', entity_type: 'voucher', entity_id: 'v1', action: 'cancel', reason: 'Duplicate' },
  { created_at: '2026-06-01T08:00:00Z', actor_name: 'Clerk', actor_role: 'accountant', entity_type: 'member', entity_id: 'm1', action: 'update', before: { phone: '***', address: 'Old' }, after: { phone: '***', address: 'New' } },
];
const le = A.auditRowEvents(rows, (t, id) => (t === 'member' ? 'Sita' : id));
ok(le[1].details === 'address: Old → New' && le[1].ref === 'Sita' && le[1].role === 'accountant', 'audit_log row: changed fields only (redacted PII unchanged ⇒ not shown), ref resolved');
const merged = A.mergeTrail(ve, le);
ok(merged.filter((e) => e.entityId === 'v1' && e.action === 'cancel').length === 1 && merged.find((e) => e.entityId === 'v1' && e.action === 'cancel').source === 'audit_log', 'a cancel in the log is not repeated from the voucher row (log wins — it has the role)');
ok(merged.filter((e) => e.entityId === 'v1' && e.action === 'approve').length === 1, 'an approval NOT in the log still appears (from the voucher row)');
ok(merged.every((e, i) => i === 0 || (merged[i - 1].at || '') >= (e.at || '')), 'newest first');

const f = A.filterTrail(merged, { from: '2026-05-02', to: '2026-05-31' });
ok(f.length === 3 && f.every((e) => e.at.slice(0, 10) >= '2026-05-02'), `date window (${f.length})`);
ok(A.filterTrail(merged, { entityType: 'member' }).length === 1 && A.filterTrail(merged, { actor: 'Ram' }).length === 2, 'filters: record type, user');
ok(A.filterTrail(merged, { q: 'duplicate' }).length === 1, 'search matches the reason');
ok(A.actionLabel('cancel', true) === 'रद्द किया' && A.entityLabel('voucher', true) === 'वाउचर' && A.actionLabel('weird', true) === 'weird', 'labels (unknown passes through)');
ok(A.diffSummary({ a: 1 }, { a: 1, b: 2 }) === 'b: 2' && A.diffSummary({ a: 1 }, {}) === 'a: 1 → —', 'added / removed fields');

// ── Wiring ──
const read = (f2) => fs.readFileSync(path.join(ROOT, f2), 'utf8');
const hook = read('src/hooks/useAuditLogRows.ts');
ok(/\.range\(off, off \+ PAGE - 1\)/.test(hook) && /setTruncated\(hitCeiling\)/.test(hook), 'audit_log read is paged (PostgREST 1000-row cap) and a hit ceiling is reported, never silent');
ok(/\.eq\('society_id', societyId\)/.test(hook), 'scoped to the society (RLS also enforces it)');
const page = read('src/pages/AuditTrail.tsx');
ok(/mergeTrail\(voucherEvents\(vouchers, accName\), auditRowEvents\(rows, refOf\)\)/.test(page), 'page shows the merged trail');
ok(/Could not read the audit log/.test(page) && /20,000/.test(page), 'read error / truncation are shown to the user');
ok(/id: 'auditTrail'.*route: '\/audit-trail'.*requiredRoles: \['admin', 'auditor'\]/.test(read('src/lib/navigation/moduleCatalog.ts')), 'nav: admin + auditor (legacy); assurance roles via the registers domain');
ok(/path="\/audit-trail"/.test(read('src/App.tsx')), 'route registered');

console.log(`Audit trail: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

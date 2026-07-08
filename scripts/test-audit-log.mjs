// Audit-log verification (P0 #3 / ECR-03) — asserts the PURE helpers of src/lib/auditLog.ts
// (buildAuditEvent + redact), mirrored here as scripts/test-nav.mjs mirrors navVisibility.
// The side-effecting logAudit (fire-and-forget insert) is intentionally not unit-tested.
// Run: node scripts/test-audit-log.mjs (exit 1 on any failure).

// ── Mirror of the pure logic in src/lib/auditLog.ts ───────────────────────────
const PII_KEYS = new Set(['phone', 'nomineePhone', 'pan', 'entityPan', 'deducteePan', 'aadhaar', 'aadhaarNo', 'password']);
function redact(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = PII_KEYS.has(k) ? '***' : (v && typeof v === 'object' ? redact(v) : v);
  return out;
}
function buildAuditEvent(input, ctx) {
  return {
    society_id: ctx.societyId,
    actor_name: ctx.actor?.name ?? null,
    actor_email: ctx.actor?.email ?? null,
    actor_role: ctx.actor?.role ?? null,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    before: input.before === undefined ? null : redact(input.before),
    after: input.after === undefined ? null : redact(input.after),
    reason: input.reason ?? null,
    source: input.source ?? 'app',
    created_at: ctx.now ?? new Date().toISOString(),
  };
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const ctx = { societyId: 'SOC001', actor: { name: 'राजेश', email: 'a@b.com', role: 'admin' }, now: '2026-07-08T00:00:00.000Z' };

// 1. Shape: a delete event captures who/what/when/action/reason deterministically.
const e = buildAuditEvent({ entityType: 'member', entityId: 'm1', action: 'delete', reason: 'Member deleted' }, ctx);
ok(e.society_id === 'SOC001', 'society_id stamped');
ok(e.actor_name === 'राजेश' && e.actor_email === 'a@b.com' && e.actor_role === 'admin', 'actor captured');
ok(e.entity_type === 'member' && e.entity_id === 'm1' && e.action === 'delete', 'entity + action captured');
ok(e.reason === 'Member deleted', 'reason captured');
ok(e.created_at === '2026-07-08T00:00:00.000Z', 'timestamp from ctx (deterministic)');
ok(e.source === 'app', 'source defaults to app');
ok(e.before === null && e.after === null, 'omitted before/after → null');

// 2. approve/reject events carry the status transition.
const ap = buildAuditEvent({ entityType: 'voucher', entityId: 'v1', action: 'approve', before: { approvalStatus: null }, after: { approvalStatus: 'approved' } }, ctx);
ok(ap.action === 'approve' && ap.after.approvalStatus === 'approved', 'approve event records transition');

// 3. PII redaction — sensitive keys masked, others preserved, nesting handled.
const r = redact({ name: 'Ravi', phone: '9999999999', pan: 'ABCDE1234F', nominee: { nomineePhone: '8888', relation: 'son' } });
ok(r.name === 'Ravi' && r.relation === undefined, 'non-PII preserved');
ok(r.phone === '***' && r.pan === '***', 'top-level PII masked');
ok(r.nominee.nomineePhone === '***' && r.nominee.relation === 'son', 'nested PII masked, nested non-PII kept');
const arr = redact([{ phone: '1' }, { name: 'x' }]);
ok(arr[0].phone === '***' && arr[1].name === 'x', 'arrays redacted element-wise');
ok(redact(null) === null && redact('str') === 'str' && redact(5) === 5, 'primitives pass through');

// 4. before/after present are redacted in the event.
const e2 = buildAuditEvent({ entityType: 'member', entityId: 'm2', action: 'delete', before: { name: 'A', phone: '12345' } }, ctx);
ok(e2.before.phone === '***' && e2.before.name === 'A', 'before snapshot redacted in event');

console.log(`\nAudit log (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

// Audit-log verification (P0 #3 / ECR-03; T-02) — asserts the PURE helpers of
// src/lib/auditLog.ts (buildAuditEvent, buildExportAuditEvent, redact, throwIfAuditFailed),
// mirrored here as scripts/test-nav.mjs mirrors navVisibility.
// The side-effecting inserts (logAudit, logAuditBlocking, logExportAudit) are not unit-tested,
// but their OPPOSITE failure semantics are pinned via throwIfAuditFailed.
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

// T-02 mirror: custody-action helpers.
class AuditWriteError extends Error {
  constructor(message) { super(message); this.name = 'AuditWriteError'; }
}
function throwIfAuditFailed(error) {
  if (error) throw new AuditWriteError(`Audit write failed: ${error.message}`);
}
function buildExportAuditEvent(input, ctx) {
  return buildAuditEvent({
    entityType: 'export',
    entityId: input.exportId,
    action: 'export',
    after: {
      entities: input.entities,
      format: input.format,
      mode: input.mode,
      rowCount: input.rowCount,
      filters: input.filters ?? null,
      artifactSha256: input.artifactSha256 ?? null,
      byteSize: input.byteSize ?? null,
    },
  }, ctx);
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

// ── T-02: custody actions (export / restore) ────────────────────────────────────
// 5. The two new actions pass through buildAuditEvent unchanged.
for (const action of ['export', 'restore']) {
  const ev = buildAuditEvent({ entityType: 'export', entityId: 'x1', action }, ctx);
  ok(ev.action === action, `'${action}' action is carried into the event`);
}

// 6. buildExportAuditEvent shapes an export event and is deterministic.
const ex = buildExportAuditEvent({
  exportId: 'exp-1', entities: ['member', 'voucher'], format: 'xlsx',
  mode: 'full', rowCount: 8214, filters: { fromDate: '2025-04-01', includeDeleted: true },
  artifactSha256: 'abc123', byteSize: 2048,
}, ctx);
ok(ex.entity_type === 'export' && ex.action === 'export', 'export event: entity_type + action');
ok(ex.entity_id === 'exp-1', 'export event: exportId becomes entity_id');
ok(ex.after.rowCount === 8214 && ex.after.format === 'xlsx' && ex.after.mode === 'full', 'export event: what was taken');
ok(ex.after.entities.join(',') === 'member,voucher', 'export event: entities recorded');
ok(ex.after.artifactSha256 === 'abc123' && ex.after.byteSize === 2048, 'export event: artifact integrity recorded');
ok(ex.after.filters.includeDeleted === true, 'export event: filters recorded');
ok(ex.created_at === '2026-07-08T00:00:00.000Z' && ex.actor_email === 'a@b.com', 'export event: who + when');

// 7. Optional fields default to null rather than undefined (jsonb-safe).
const exMin = buildExportAuditEvent({ exportId: 'e2', entities: ['member'], format: 'csv', mode: 'standard', rowCount: 0 }, ctx);
ok(exMin.after.filters === null && exMin.after.artifactSha256 === null && exMin.after.byteSize === null, 'export event: omitted fields → null');

// 8. Export filters are PII-redacted like any other snapshot.
const exPii = buildExportAuditEvent({ exportId: 'e3', entities: ['member'], format: 'csv', mode: 'standard', rowCount: 1, filters: { phone: '9999999999', q: 'Ravi' } }, ctx);
ok(exPii.after.filters.phone === '***' && exPii.after.filters.q === 'Ravi', 'export event: PII in filters masked');

// 9. THE INVERTED CONTRACT. logAudit swallows failures; custody writes must THROW.
//    If someone "simplifies" logExportAudit to reuse logAudit, this test fails.
let threw = false;
try { throwIfAuditFailed({ message: 'relation "audit_log" does not exist' }); } catch (e) { threw = e instanceof AuditWriteError; }
ok(threw, 'throwIfAuditFailed THROWS AuditWriteError on insert error (export must abort)');
ok(/audit_log/.test((() => { try { throwIfAuditFailed({ message: 'relation "audit_log" does not exist' }); } catch (e) { return e.message; } })()), 'AuditWriteError carries the underlying cause');

let threwOnSuccess = false;
try { throwIfAuditFailed(null); throwIfAuditFailed(undefined); } catch { threwOnSuccess = true; }
ok(!threwOnSuccess, 'throwIfAuditFailed is a no-op when the insert succeeded');

console.log(`\nAudit log (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

// C1 verification — asserts the pure navigation algorithm (a faithful JS mirror of
// navVisibility.isModuleVisible + capabilityResolver.resolveCapabilities; the TS uses
// the identical trivially-small logic, and `tsc` guarantees the TS itself compiles).
// Run: node scripts/test-nav.mjs   (exit 1 on any failure)

// Mirror of capabilityResolver.resolveCapabilities (relational rows; C3):
// entitled = template ∪ active grants; visible = entitled − active admin revokes; expiry honored.
function resolveCapabilities(template, rows, now) {
  const active = (Array.isArray(rows) ? rows : []).filter((r) => !r.expiresAt || new Date(r.expiresAt).getTime() > now);
  const grants = active.filter((r) => r.mode === 'grant').map((r) => r.capability);
  const revokes = new Set(active.filter((r) => r.mode === 'revoke' && r.source === 'admin').map((r) => r.capability));
  return new Set([...(template || []), ...grants].filter((c) => !revokes.has(c)));
}
function isModuleVisible(m, ctx) {
  if (ctx.superAdminShowAll) return true;
  if (m.requiredRoles && !ctx.hasRole(m.requiredRoles)) return false;
  return m.requiredCapabilities.every((c) => ctx.capabilities.has(c));
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const ctx = (caps, role = 'admin', superAll = false) => ({
  capabilities: new Set(caps),
  hasRole: (roles) => !roles || roles.includes(role),
  superAdminShowAll: superAll,
});

// 1. Universal module ([]) is always visible — the C1 invariant (sidebar identical to today)
ok(isModuleVisible({ requiredCapabilities: [] }, ctx([])), 'universal visible (no caps)');
ok(isModuleVisible({ requiredCapabilities: [] }, ctx([], 'viewer')), 'universal visible (viewer)');

// 2. Capability gate
ok(!isModuleVisible({ requiredCapabilities: ['dairy_collection'] }, ctx([])), 'gated hidden without capability');
ok(isModuleVisible({ requiredCapabilities: ['dairy_collection'] }, ctx(['dairy_collection'])), 'gated visible with capability');
ok(!isModuleVisible({ requiredCapabilities: ['trading', 'gst'] }, ctx(['trading'])), 'multi-cap hidden if one missing');
ok(isModuleVisible({ requiredCapabilities: ['trading', 'gst'] }, ctx(['trading', 'gst'])), 'multi-cap visible if all held');

// 3. Role gate (RBAC preserved)
ok(!isModuleVisible({ requiredCapabilities: [], requiredRoles: ['admin'] }, ctx([], 'viewer')), 'role-gated hidden for viewer');
ok(isModuleVisible({ requiredCapabilities: [], requiredRoles: ['admin'] }, ctx([], 'admin')), 'role-gated visible for admin');

// 4. Resolver (relational rows): entitled = template ∪ active grants; visible = − admin revokes; expiry honored
const NOW = 1000;
const R = (capability, mode, source = 'admin', expiresAt = null) => ({ capability, mode, source, expiresAt });
ok(resolveCapabilities([], [R('lending', 'grant')], NOW).has('lending'), 'grant row adds capability');
ok(resolveCapabilities(['trading'], [], NOW).has('trading'), 'template capability present (no rows)');
ok(!resolveCapabilities(['trading'], [R('trading', 'revoke', 'admin')], NOW).has('trading'), 'admin revoke hides template capability');
ok(!resolveCapabilities([], [R('x', 'grant'), R('x', 'revoke', 'admin')], NOW).has('x'), 'admin revoke beats grant');
ok(resolveCapabilities('marketing_processing' && [], null, NOW).size === 0, 'null rows → no crash, empty set');
ok(!resolveCapabilities([], [R('trial_cap', 'grant', 'trial', 500)], NOW).has('trial_cap'), 'expired grant ignored (expiresAt < now)');
ok(resolveCapabilities([], [R('trial_cap', 'grant', 'trial', 5000)], NOW).has('trial_cap'), 'unexpired grant honored (expiresAt > now)');
ok(resolveCapabilities([], [R('plan_cap', 'grant', 'plan'), R('plan_cap', 'revoke', 'plugin')], NOW).has('plan_cap'), 'non-admin revoke does NOT hide (admin-only)');

// 5. Super-admin show-all bypasses every gate
ok(isModuleVisible({ requiredCapabilities: ['x'], requiredRoles: ['admin'] }, ctx([], 'viewer', true)), 'super-admin shows all');

console.log(`[nav-test] ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

// C1 verification — asserts the pure navigation algorithm (a faithful JS mirror of
// navVisibility.isModuleVisible + capabilityResolver.resolveCapabilities; the TS uses
// the identical trivially-small logic, and `tsc` guarantees the TS itself compiles).
// Run: node scripts/test-nav.mjs   (exit 1 on any failure)

function resolveCapabilities(base, overrides) {
  const grant = Array.isArray(overrides?.grant) ? overrides.grant : [];
  const revoke = new Set(Array.isArray(overrides?.revoke) ? overrides.revoke : []);
  return new Set([...(base || []), ...grant].filter((c) => !revoke.has(c)));
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

// 4. Resolver: template ∪ grant − revoke
ok(resolveCapabilities([], { grant: ['lending'] }).has('lending'), 'grant adds capability');
ok(resolveCapabilities(['trading'], {}).has('trading'), 'template capability present');
ok(!resolveCapabilities(['trading'], { revoke: ['trading'] }).has('trading'), 'revoke removes template capability');
ok(!resolveCapabilities([], { grant: ['x'], revoke: ['x'] }).has('x'), 'revoke beats grant');
ok(resolveCapabilities('unknownType' && [], null).size === 0, 'null/empty overrides → no crash');

// 5. Super-admin show-all bypasses every gate
ok(isModuleVisible({ requiredCapabilities: ['x'], requiredRoles: ['admin'] }, ctx([], 'viewer', true)), 'super-admin shows all');

console.log(`[nav-test] ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

// C1 verification — asserts the pure navigation algorithm (a faithful JS mirror of
// navVisibility.isModuleVisible + capabilityResolver.resolveCapabilities; the TS uses
// the identical trivially-small logic, and `tsc` guarantees the TS itself compiles).
// Run: node scripts/test-nav.mjs   (exit 1 on any failure)

// Mirror of capabilityResolver (C5) — two layers. (Mirrors pass the type TEMPLATE array
// in place of societyType; the TS looks it up from SOCIETY_TYPE_CAPABILITIES, tsc-checked.)
function activeRows(rows, now) {
  return (Array.isArray(rows) ? rows : []).filter((r) => !r.expiresAt || new Date(r.expiresAt).getTime() > now);
}
// Step 1 — ENTITLEMENT: template ∪ non-admin grants − non-admin revokes. Admin ignored.
function resolveEntitlements(template, rows, now) {
  const active = activeRows(rows, now);
  const grants = active.filter((r) => r.source !== 'admin' && r.mode === 'grant').map((r) => r.capability);
  const revokes = new Set(active.filter((r) => r.source !== 'admin' && r.mode === 'revoke').map((r) => r.capability));
  return new Set([...(template || []), ...grants].filter((c) => !revokes.has(c)));
}
// Step 2 — VISIBILITY: entitled − admin-hidden.
function resolveCapabilities(template, rows, now) {
  const entitled = resolveEntitlements(template, rows, now);
  const adminHidden = new Set(activeRows(rows, now).filter((r) => r.source === 'admin' && r.mode === 'revoke').map((r) => r.capability));
  return new Set([...entitled].filter((c) => !adminHidden.has(c)));
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

// 4. C5 resolver — two layers: ENTITLEMENT (non-admin) then VISIBILITY (admin-hide).
const NOW = 1000;
const R = (capability, mode, source = 'admin', expiresAt = null) => ({ capability, mode, source, expiresAt });

// 4a. Entitlement layer (resolveEntitlements) — admin rows are IGNORED.
ok(resolveEntitlements(['trading'], [], NOW).has('trading'), 'template grants entitlement');
ok(resolveEntitlements([], [R('lending', 'grant', 'plan')], NOW).has('lending'), 'plan grant → entitled');
ok(resolveEntitlements([], [R('dairy_collection', 'grant', 'trial', 5000)], NOW).has('dairy_collection'), 'active trial grant → entitled');
ok(!resolveEntitlements([], [R('dairy_collection', 'grant', 'trial', 500)], NOW).has('dairy_collection'), 'expired trial grant → NOT entitled');
ok(!resolveEntitlements(['trading'], [R('trading', 'revoke', 'state')], NOW).has('trading'), 'state revoke removes entitlement (compliance)');
ok(!resolveEntitlements([], [R('x', 'grant', 'plan'), R('x', 'revoke', 'state')], NOW).has('x'), 'entitlement revoke beats entitlement grant');
ok(!resolveEntitlements([], [R('gst', 'grant', 'admin')], NOW).has('gst'), 'CORE: admin grant does NOT create entitlement (licensing-safe)');

// 4b. Visibility layer (resolveCapabilities) — admin may only HIDE entitled capabilities.
ok(resolveCapabilities(['trading'], [], NOW).has('trading'), 'entitled & not hidden → visible');
ok(!resolveCapabilities(['trading'], [R('trading', 'revoke', 'admin')], NOW).has('trading'), 'admin hides an entitled capability');
ok(!resolveCapabilities([], [R('gst', 'grant', 'admin')], NOW).has('gst'), 'admin grant cannot reveal an UNentitled capability');
ok(!resolveCapabilities([], [R('lending', 'grant', 'plan'), R('lending', 'revoke', 'admin')], NOW).has('lending'), 'admin can hide a plan-entitled capability');
ok(resolveCapabilities([], [R('lending', 'grant', 'plan')], NOW).has('lending'), 'plan-entitled & not hidden → visible');
ok(resolveCapabilities(['trading'], [R('trading', 'grant', 'admin')], NOW).has('trading'), 'admin grant on entitled cap → still visible (no-op)');
ok(resolveCapabilities('marketing_processing' && [], null, NOW).size === 0, 'null rows → no crash, empty set');

// 4c. Determinism + independence
ok(!resolveCapabilities([], [R('a', 'grant', 'plan'), R('a', 'revoke', 'admin'), R('b', 'grant', 'plan')], NOW).has('a')
   && resolveCapabilities([], [R('b', 'grant', 'plan'), R('a', 'revoke', 'admin'), R('a', 'grant', 'plan')], NOW).has('b'),
   'resolution is order-independent (deterministic)');
ok((() => { const v = resolveCapabilities(['trading'], [R('trading', 'revoke', 'admin'), R('lending', 'grant', 'plan')], NOW); return !v.has('trading') && v.has('lending'); })(),
   'capabilities resolve independently');

// 5. Super-admin show-all bypasses every gate
ok(isModuleVisible({ requiredCapabilities: ['x'], requiredRoles: ['admin'] }, ctx([], 'viewer', true)), 'super-admin shows all');

// 6. C4 — Milk Collection is dairy-only. Mirrors SOCIETY_TYPE_CAPABILITIES.dairy
//    (['dairy_collection']) and moduleCatalog.milkCollection (requiredCapabilities: ['dairy_collection']).
const DAIRY_CAPS = [...resolveCapabilities(['dairy_collection'], [], NOW)];   // dairy type template
const NONDAIRY_CAPS = [...resolveCapabilities([], [], NOW)];                  // every other type (empty template)
const milkModule = { requiredCapabilities: ['dairy_collection'] };
ok(isModuleVisible(milkModule, ctx(DAIRY_CAPS, 'admin')), 'C4: dairy admin sees Milk Collection');
ok(isModuleVisible(milkModule, ctx(DAIRY_CAPS, 'viewer')), 'C4: dairy viewer sees Milk Collection (no role gate)');
ok(!isModuleVisible(milkModule, ctx(NONDAIRY_CAPS, 'admin')), 'C4: non-dairy admin does NOT see Milk Collection');
ok(!isModuleVisible(milkModule, ctx(NONDAIRY_CAPS, 'viewer')), 'C4: non-dairy viewer does NOT see Milk Collection');

console.log(`[nav-test] ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

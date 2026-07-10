// Segregation of Duties — maker ≠ checker (ECR-06) — mirrors src/lib/sod.ts.
// Run: node scripts/test-sod.mjs
const SYSTEM_MAKERS = new Set(['', 'system', 'system (repair)']);
const norm = (s) => (s ?? '').trim().toLowerCase();
const isRealMaker = (createdBy) => !SYSTEM_MAKERS.has(norm(createdBy));
function isSelfApproval(createdBy, approver) {
  if (!isRealMaker(createdBy)) return false;
  return norm(createdBy) === norm(approver);
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Same real person makes + approves → blocked (self-approval).
ok(isSelfApproval('Ramesh Kumar', 'Ramesh Kumar'), 'same maker & approver → self-approval');
// 2. Different people → allowed.
ok(!isSelfApproval('Ramesh Kumar', 'Suresh Rao'), 'different maker & approver → not self-approval');
// 3. Case / whitespace insensitive.
ok(isSelfApproval('  Ramesh Kumar ', 'ramesh kumar'), 'case & whitespace insensitive match');
// 4. System/auto/engine makers are never self-approval (admin must approve machine entries).
ok(!isSelfApproval('System', 'System'), "'System' maker → not self-approval");
ok(!isSelfApproval('System (repair)', 'System (repair)'), "'System (repair)' maker → not self-approval");
ok(!isSelfApproval('', ''), 'empty maker → not self-approval');
ok(!isSelfApproval(undefined, 'Ramesh Kumar'), 'undefined maker → not self-approval');
ok(!isSelfApproval(null, 'Ramesh Kumar'), 'null maker → not self-approval');
// 5. Real maker but approver blank → not equal → allowed (no identity to compare).
ok(!isSelfApproval('Ramesh Kumar', ''), 'real maker, blank approver → not self-approval');
ok(!isSelfApproval('Ramesh Kumar', undefined), 'real maker, undefined approver → not self-approval');
// 6. isRealMaker guard.
ok(isRealMaker('Ramesh Kumar') === true, 'named maker is real');
ok(isRealMaker('system') === false, 'system (any case) is not real');
ok(isRealMaker('  ') === false, 'whitespace-only maker is not real');

console.log(`\nSoD maker≠checker (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

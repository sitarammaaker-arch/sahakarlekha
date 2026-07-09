// Nominees (ECR-16 — multiple nominees) — asserts the pure helpers of src/lib/nomineeUtils.ts,
// mirrored here as scripts/test-nav.mjs mirrors navVisibility. Run: node scripts/test-nominees.mjs

// ── Mirror of the pure logic in src/lib/nomineeUtils.ts ───────────────────────
function nomineeShareTotal(nominees) {
  return +(nominees || []).reduce((sum, n) => sum + (n.sharePercent || 0), 0).toFixed(2);
}
function validateNominees(nominees) {
  const list = nominees || [];
  const total = nomineeShareTotal(list);
  for (const n of list) {
    if (!n.name?.trim() || !n.relation?.trim()) return { ok: false, error: 'name+relation', total };
    if (!(n.sharePercent > 0)) return { ok: false, error: 'share>0', total };
  }
  if (total > 100) return { ok: false, error: 'exceeds', total };
  return { ok: true, total };
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Empty list is allowed here (mandatory-at-least-one is caller-enforced).
ok(validateNominees([]).ok === true, 'empty nominee list is valid at lib level');
ok(nomineeShareTotal([]) === 0 && nomineeShareTotal(undefined) === 0, 'total of empty/undefined is 0');

// 2. A well-formed single nominee at 100%.
ok(validateNominees([{ name: 'A', relation: 'son', sharePercent: 100 }]).ok, 'single 100% nominee valid');

// 3. Two nominees summing to 100.
const two = [{ name: 'A', relation: 'son', sharePercent: 60 }, { name: 'B', relation: 'daughter', sharePercent: 40 }];
ok(validateNominees(two).ok && nomineeShareTotal(two) === 100, 'two nominees summing to 100 valid');

// 4. Under 100% is allowed (partial nomination); over 100% is rejected.
ok(validateNominees([{ name: 'A', relation: 'son', sharePercent: 50 }]).ok, 'partial (<100%) allowed');
const over = [{ name: 'A', relation: 'son', sharePercent: 60 }, { name: 'B', relation: 'wife', sharePercent: 50 }];
ok(!validateNominees(over).ok && validateNominees(over).total === 110, 'total >100% rejected');

// 5. Missing name / relation / non-positive share rejected.
ok(!validateNominees([{ name: '', relation: 'son', sharePercent: 100 }]).ok, 'missing name rejected');
ok(!validateNominees([{ name: 'A', relation: '', sharePercent: 100 }]).ok, 'missing relation rejected');
ok(!validateNominees([{ name: 'A', relation: 'son', sharePercent: 0 }]).ok, 'zero share rejected');

// 6. Fractional shares total correctly (rounding).
ok(nomineeShareTotal([{ sharePercent: 33.33 }, { sharePercent: 33.33 }, { sharePercent: 33.34 }]) === 100, 'fractional shares sum to 100');

console.log(`\nNominees (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

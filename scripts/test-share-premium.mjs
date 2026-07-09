// Share-transfer premium cap (ECR-16 / MS-11) — asserts the pure cap logic mirrored from
// DataContext.transferShareCapital + the ShareRegister UI. Run: node scripts/test-share-premium.mjs

// ── Mirror of the pure cap logic ──────────────────────────────────────────────
// premium is allowed only up to maxPct% of the face-value amount transferred.
const premiumCap = (faceAmount, maxPct) => Math.round((faceAmount * (maxPct || 0) / 100) * 100) / 100;
// The guard in transferShareCapital: a premium is accepted only when a cap is set (>0)
// AND premium ≤ cap. premium === 0 always passes (plain face-value transfer).
function premiumAllowed(premium, faceAmount, maxPct) {
  const prem = Math.round(Math.max(0, premium || 0) * 100) / 100;
  if (prem === 0) return true;
  const cap = premiumCap(faceAmount, maxPct);
  return (maxPct > 0) && prem <= cap;
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. No premium → always allowed (existing behaviour unchanged, cap irrelevant).
ok(premiumAllowed(0, 1000, 0), 'zero premium allowed even with 0% cap');
ok(premiumAllowed(0, 1000, 10), 'zero premium allowed with a cap set');

// 2. Cap 0 / undefined → any premium blocked (statutory default).
ok(!premiumAllowed(1, 1000, 0), 'premium blocked when cap is 0%');
ok(!premiumAllowed(100, 1000, undefined), 'premium blocked when cap undefined');

// 3. Cap value → premium allowed up to the cap, blocked above.
ok(premiumCap(1000, 10) === 100, '10% of ₹1000 = ₹100 cap');
ok(premiumAllowed(100, 1000, 10), 'premium exactly at cap allowed');
ok(premiumAllowed(50, 1000, 10), 'premium below cap allowed');
ok(!premiumAllowed(150, 1000, 10), 'premium above cap blocked');

// 4. Cap scales with the face amount.
ok(premiumCap(2000, 5) === 100, '5% of ₹2000 = ₹100');
ok(premiumAllowed(100, 2000, 5) && !premiumAllowed(101, 2000, 5), 'cap tracks face amount');

// 5. Fractional cap rounds to 2dp.
ok(premiumCap(333.33, 7.5) === 25, '7.5% of 333.33 ≈ ₹25.00 (2dp)');

console.log(`\nShare-transfer premium cap (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

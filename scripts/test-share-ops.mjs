// Share operations (ECR-16 / MS-02) — asserts the pure posting map + validation mirrored
// from src/lib/shareOps.ts. Run: node scripts/test-share-ops.mjs

// ── Mirror of the pure logic in src/lib/shareOps.ts ───────────────────────────
function shareOpPosting(type, acc) {
  switch (type) {
    case 'bonus':     return { debitAccountId: acc.reserve,  creditAccountId: acc.shareCap, sign: 1,  usesCash: false };
    case 'forfeit':   return { debitAccountId: acc.shareCap, creditAccountId: acc.reserve,  sign: -1, usesCash: false };
    case 'redeem':    return { debitAccountId: acc.shareCap, creditAccountId: acc.payout,   sign: -1, usesCash: true };
    case 'surrender': return { debitAccountId: acc.shareCap, creditAccountId: acc.payout,   sign: -1, usesCash: true };
  }
}
function validateShareOp(type, amount, cap) {
  if (!(amount > 0)) return { ok: false, error: 'amt' };
  if (type !== 'bonus' && amount > cap) return { ok: false, error: 'overcap' };
  return { ok: true };
}
function applyShareOp(type, cap, amount) {
  const sign = type === 'bonus' ? 1 : -1;
  return Math.round((cap + sign * amount) * 100) / 100;
}

const ACC = { shareCap: '1102', payout: '3301', reserve: '1201' };
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Bonus: Dr reserve / Cr share cap, increases, no cash.
const b = shareOpPosting('bonus', ACC);
ok(b.debitAccountId === '1201' && b.creditAccountId === '1102' && b.sign === 1 && !b.usesCash, 'bonus posting Dr reserve / Cr 1102 (+)');

// 2. Forfeit: Dr share cap / Cr reserve, decreases, no cash.
const f = shareOpPosting('forfeit', ACC);
ok(f.debitAccountId === '1102' && f.creditAccountId === '1201' && f.sign === -1 && !f.usesCash, 'forfeit posting Dr 1102 / Cr reserve (−)');

// 3. Redeem + Surrender: Dr share cap / Cr cash-bank, decreases, cash.
for (const t of ['redeem', 'surrender']) {
  const p = shareOpPosting(t, ACC);
  ok(p.debitAccountId === '1102' && p.creditAccountId === '3301' && p.sign === -1 && p.usesCash, `${t} posting Dr 1102 / Cr payout (−, cash)`);
}

// 4. Every posting is a balanced single Dr/Cr pair (distinct accounts).
for (const t of ['bonus', 'forfeit', 'redeem', 'surrender']) {
  const p = shareOpPosting(t, ACC);
  ok(p.debitAccountId !== p.creditAccountId && p.debitAccountId && p.creditAccountId, `${t} debits ≠ credits`);
  ok(p.debitAccountId === '1102' || p.creditAccountId === '1102', `${t} always touches SHARE_CAP 1102`);
}

// 5. Validation: positive amount; decrease ops bounded by current capital; bonus unbounded.
ok(!validateShareOp('forfeit', 0, 1000).ok, 'zero amount rejected');
ok(!validateShareOp('redeem', 1500, 1000).ok, 'over-capital decrease rejected');
ok(validateShareOp('surrender', 1000, 1000).ok, 'decrease equal to capital allowed');
ok(validateShareOp('bonus', 5000, 1000).ok, 'bonus can exceed current capital (issued from reserves)');

// 6. applyShareOp moves the scalar the right way.
ok(applyShareOp('bonus', 1000, 500) === 1500, 'bonus adds to scalar');
ok(applyShareOp('forfeit', 1000, 400) === 600, 'forfeit subtracts');
ok(applyShareOp('redeem', 1000, 1000) === 0, 'full redeem → 0');
ok(applyShareOp('surrender', 1000.5, 0.25) === 1000.25, 'rounding preserved to 2dp');

console.log(`\nShare operations (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

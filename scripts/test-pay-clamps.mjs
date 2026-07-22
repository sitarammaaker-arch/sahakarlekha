// Statutory floor/ceiling clamps (Phase-7 §3/§8). Proves clamp-up to floor, clamp-down to ceiling,
// inclusive bounds, the floor>ceiling defect, and the Minor convenience. Imports real .ts.
//
// Run: node scripts/test-pay-clamps.mjs   (npm run test:pay-clamps)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let m;
try {
  m = await import(abs('../src/lib/pay/resolve/clamps.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { applyClamp, clampMinor } = m;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (fn, re, msg) => { try { fn(); fail++; console.error('  ✗ (did not throw)', msg); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', msg, '::', e.message); } } };

// 1. within band → unchanged
let r = applyClamp(1500, { floor: 1000, ceiling: 2000 });
ok(r.value === 1500 && r.clamped === 'none', 'within [floor,ceiling] → unchanged');

// 2. below floor → raised
r = applyClamp(800, { floor: 1000, ceiling: 2000 });
ok(r.value === 1000 && r.clamped === 'floor', 'below floor → raised to floor (statutory minimum inviolable)');

// 3. above ceiling → lowered
r = applyClamp(2500, { floor: 1000, ceiling: 2000 });
ok(r.value === 2000 && r.clamped === 'ceiling', 'above ceiling → lowered to ceiling');

// 4. only floor / only ceiling / no bounds
ok(applyClamp(500, { floor: 1000 }).value === 1000, 'only floor raises');
ok(applyClamp(500, { floor: 1000 }).clamped === 'floor', 'only floor records clamp');
ok(applyClamp(3000, { ceiling: 2000 }).value === 2000, 'only ceiling lowers');
ok(applyClamp(1500, {}).clamped === 'none' && applyClamp(1500, {}).value === 1500, 'no bounds → unchanged');
ok(applyClamp(1500, { floor: null, ceiling: null }).clamped === 'none', 'null bounds ignored');

// 5. inclusive bounds
ok(applyClamp(1000, { floor: 1000, ceiling: 2000 }).clamped === 'none', 'value === floor is within (inclusive)');
ok(applyClamp(2000, { floor: 1000, ceiling: 2000 }).clamped === 'none', 'value === ceiling is within (inclusive)');

// 6. floor > ceiling defect
throws(() => applyClamp(1500, { floor: 2000, ceiling: 1000 }), /PAY-CMP-CLAMP/, 'floor > ceiling is a defect');

// 7. non-finite value
throws(() => applyClamp(Number.NaN, { floor: 0 }), /must be a finite number/, 'NaN value refused');

// 8. clampMinor convenience
const cm = clampMinor(80000, { floorMinor: 100000, ceilingMinor: 2100000 });
ok(cm.value === 100000 && cm.clamped === 'floor', 'clampMinor raises paise to the floor');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay clamps — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

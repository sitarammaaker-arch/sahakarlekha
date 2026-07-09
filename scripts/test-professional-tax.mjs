// Professional Tax by state (ECR-14) — mirrors src/lib/professionalTax.ts.
// Run: node scripts/test-professional-tax.mjs

function resolveStateKey(state) {
  const s = (state || '').toLowerCase().replace(/\s+/g, '');
  const has = (...keys) => keys.some(k => s.includes(k));
  if (has('maharashtra', 'महाराष्ट्र')) return 'maharashtra';
  if (has('karnataka', 'कर्नाटक')) return 'karnataka';
  if (has('westbengal', 'बंगाल')) return 'westbengal';
  if (has('madhyapradesh', 'मध्यप्रदेश')) return 'madhyapradesh';
  if (has('gujarat', 'गुजरात')) return 'gujarat';
  if (has('telangana', 'तेलंगाना', 'तेलंगान')) return 'telangana';
  if (has('andhra', 'आंध्र')) return 'andhra';
  if (has('tamilnadu', 'तमिलनाडु')) return 'tamilnadu';
  return 'none';
}
function professionalTax(gross, k) {
  const g = Math.max(0, gross || 0);
  switch (k) {
    case 'maharashtra':   return g <= 7500 ? 0 : g <= 10000 ? 175 : 200;
    case 'karnataka':     return g < 25000 ? 0 : 200;
    case 'westbengal':    return g <= 10000 ? 0 : g <= 15000 ? 110 : g <= 25000 ? 130 : g <= 40000 ? 150 : 200;
    case 'madhyapradesh': return g <= 18750 ? 0 : g <= 25000 ? 125 : g <= 33333 ? 167 : 208;
    case 'gujarat':       return g < 12000 ? 0 : 200;
    case 'andhra': case 'telangana': return g <= 15000 ? 0 : g <= 20000 ? 150 : 200;
    case 'tamilnadu':     return g <= 21000 ? 0 : g <= 30000 ? 100 : g <= 45000 ? 235 : 500;
    default:              return 0;
  }
}
const professionalTaxForState = (g, state) => professionalTax(g, resolveStateKey(state));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. State resolution (English + Hindi + case/space tolerant).
ok(resolveStateKey('Maharashtra') === 'maharashtra', 'English state resolves');
ok(resolveStateKey('महाराष्ट्र') === 'maharashtra', 'Hindi state resolves');
ok(resolveStateKey('  west BENGAL ') === 'westbengal', 'case/space tolerant');
ok(resolveStateKey('Haryana') === 'none' && resolveStateKey('राजस्थान') === 'none', 'no-PT states → none');
ok(resolveStateKey(undefined) === 'none', 'undefined → none');

// 2. Maharashtra slabs.
ok(professionalTax(7000, 'maharashtra') === 0, 'MH ≤7500 → 0');
ok(professionalTax(9000, 'maharashtra') === 175, 'MH 7501-10000 → 175');
ok(professionalTax(20000, 'maharashtra') === 200, 'MH >10000 → 200');

// 3. Karnataka: nil below 25000, else 200.
ok(professionalTax(24000, 'karnataka') === 0 && professionalTax(30000, 'karnataka') === 200, 'Karnataka slab');

// 4. West Bengal graduated slabs.
ok(professionalTax(9000, 'westbengal') === 0, 'WB ≤10000 → 0');
ok(professionalTax(12000, 'westbengal') === 110 && professionalTax(20000, 'westbengal') === 130 && professionalTax(50000, 'westbengal') === 200, 'WB graduated');

// 5. No-PT state → always 0.
ok(professionalTaxForState(100000, 'Haryana') === 0, 'no-PT state → 0 regardless of salary');

// 6. End-to-end via state string.
ok(professionalTaxForState(20000, 'Maharashtra') === 200, 'end-to-end MH');
ok(professionalTaxForState(20000, 'गुजरात') === 200 && professionalTaxForState(9000, 'गुजरात') === 0, 'Gujarat via Hindi');

console.log(`\nProfessional tax (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

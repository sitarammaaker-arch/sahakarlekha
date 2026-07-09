// Farmer-payment credit resolution — mirrors src/lib/procurement/farmerPaymentMode.ts.
// Run: node scripts/test-farmer-payment-mode.mjs
function resolveFarmerPaymentCredit(mode, ids) {
  if (mode === 'cash') return ids.cash || null;
  if (mode === 'bank') return ids.bank || null;
  if (mode === 'agency') return ids.agency || null;
  return null;
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const ids = { cash: '3301', bank: '3302', agency: 'hafed-ctrl' };

ok(resolveFarmerPaymentCredit('cash', ids) === '3301', 'cash → cash account');
ok(resolveFarmerPaymentCredit('bank', ids) === '3302', 'bank → chosen bank account');
ok(resolveFarmerPaymentCredit('agency', ids) === 'hafed-ctrl', 'agency → agency receivable account');
ok(resolveFarmerPaymentCredit('agency', { cash: '3301', bank: '3302' }) === null, 'agency without an account → null (block the post)');
ok(resolveFarmerPaymentCredit('cash', { cash: '', bank: '3302', agency: 'x' }) === null, 'missing cash account → null');
ok(resolveFarmerPaymentCredit('bank', { cash: '3301', bank: '', agency: 'x' }) === null, 'missing bank account → null');

console.log(`\nFarmer payment mode (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

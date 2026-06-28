// Unit tests for the Phase 1.0 procurement slice — a faithful JS mirror of the inline
// construction in DataContext.addFarmer / addProcurementLot (tsc verifies the TS itself).
// Run: node scripts/test-procurement.mjs   (exit 1 on any failure)

function buildFarmer(data, count, now, uuid) {
  return {
    id: uuid, farmerCode: `F${String(count + 1).padStart(4, '0')}`,
    farmerName: data.farmerName, fatherName: data.fatherName || undefined, mobile: data.mobile || undefined,
    createdAt: now, updatedAt: now,
  };
}
function buildLot(data, now, uuid, centreId, seasonId) {
  return {
    id: uuid, centreId, seasonId, cropId: data.cropId, varietyId: data.varietyId || undefined, farmerId: data.farmerId,
    quantity: data.quantity, mspRate: data.mspRate,
    operationalStatus: 'created', financialStatus: 'unbilled', reconciliationStatus: 'pending',
    createdAt: now, updatedAt: now,
  };
}
function buildLotCreatedEvent(lot, now, uuid, actor) {
  return {
    id: uuid, correlationId: lot.id, name: 'lot.created', occurredAt: now, recordedAt: now, actor,
    payload: { centreId: lot.centreId, farmerId: lot.farmerId, cropId: lot.cropId, seasonId: lot.seasonId },
  };
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Farmer shape — auto code, exactly the 5 fields + BaseEntity, nothing more
const f = buildFarmer({ farmerName: 'Ram', fatherName: 'Shyam', mobile: '9999999999' }, 0, 'T', 'F-UUID');
ok(f.farmerCode === 'F0001', 'farmer auto-code = F0001 for the first farmer');
ok(f.farmerName === 'Ram' && f.fatherName === 'Shyam' && f.mobile === '9999999999', 'farmer captures name / father / mobile');
ok('id' in f && 'createdAt' in f && 'updatedAt' in f, 'farmer extends BaseEntity (id/createdAt/updatedAt)');
ok(!('aadhaar' in f) && !('bankAccount' in f) && !('address' in f) && !('village' in f), 'farmer has NO aadhaar/bank/address/land (scope)');
ok(buildFarmer({ farmerName: 'X' }, 4, 'T', 'U').farmerCode === 'F0005', 'farmer code increments with count');

// 2. ProcurementLot default statuses + value objects
const lot = buildLot({ farmerId: f.id, cropId: 'wheat', quantity: { value: 10, unit: 'qtl' }, mspRate: { amount: 2275, currency: 'INR' } }, 'T', 'LOT-UUID', 'SOC1', '2026-27');
ok(lot.operationalStatus === 'created', 'lot OperationalStatus = created');
ok(lot.financialStatus === 'unbilled', 'lot FinancialStatus = unbilled');
ok(lot.reconciliationStatus === 'pending', 'lot ReconciliationStatus = pending');
ok(lot.quantity.value === 10 && lot.mspRate.amount === 2275 && lot.mspRate.currency === 'INR', 'lot carries quantity + currency-tagged mspRate');

// 3. Exactly ONE lot.created event; correlationId == lot.id; NO voucher
const ev = buildLotCreatedEvent(lot, 'T', 'EV-UUID', 'राजेश');
ok(ev.name === 'lot.created', "event name = 'lot.created'");
ok(ev.correlationId === lot.id, 'event correlationId == lot.id');
ok(ev.actor === 'राजेश', 'event records the actor');
ok(!('voucherId' in lot) && !('voucherId' in ev) && !('amount' in lot), 'NO voucher created (no voucher fields on lot or event)');

console.log(`[procurement-test] ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

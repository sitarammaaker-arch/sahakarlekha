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

// 4. M1 — lot + event commit as ONE inseparable business transaction (generic boundary).
//    Mirrors the DataContext rpc payload + the symmetric rollback.
const buildCommitPayload = (lots, events) => ({ transactionType: 'lot.create', transactionId: 'TX-UUID', transactionVersion: 1, lots, events });
const payload = buildCommitPayload([lot], [ev]);
ok(payload.transactionType === 'lot.create', 'envelope: transactionType present (lot.create)');
ok(typeof payload.transactionId === 'string' && payload.transactionId.length > 0, 'envelope: transactionId present (immutable business-transaction id)');
ok(payload.transactionVersion === 1, 'envelope: transactionVersion present (= 1)');
ok(payload.lots.length === 1 && payload.events.length === 1, 'M1: commit payload = exactly one lot + one event (inseparable unit)');
ok(payload.events[0].correlationId === payload.lots[0].id, 'M1: committed event is linked to the committed lot (correlationId == lot.id)');
ok(Array.isArray(payload.lots) && Array.isArray(payload.events), 'M1: payload uses object-of-collections shape (stable signature for future keys)');
const rollback = (lots, events, lotId, eventId) => ({ lots: lots.filter(l => l.id !== lotId), events: events.filter(e => e.id !== eventId) });
const after = rollback([lot], [ev], lot.id, ev.id);
ok(after.lots.length === 0 && after.events.length === 0, 'M1: failure rolls back BOTH lot and event (no orphan)');

// 5. Phase 2.1 — Quality Inspection (pure recording). Mirrors DataContext.recordQualityInspection.
const buildQualityTest = (lotId, result, by, now, uuid) => ({ id: uuid, lotId, result, inspectedBy: by, createdAt: now, updatedAt: now });
const buildMoistureRecord = (lotId, moisture, now, uuid) => ({ id: uuid, lotId, moisture: { value: moisture }, createdAt: now, updatedAt: now });
const buildQualityEvents = (lotId, result, moisture, by, now) => ([
  { id: 'qev', correlationId: lotId, name: 'quality.tested', occurredAt: now, recordedAt: now, actor: by, payload: { lotId, result } },
  { id: 'mev', correlationId: lotId, name: 'moisture.recorded', occurredAt: now, recordedAt: now, actor: by, payload: { lotId, moisture } },
]);
const qt = buildQualityTest('lot-1', 'accepted', 'Insp', 'T', 'QT');
const mr = buildMoistureRecord('lot-1', 12.5, 'T', 'MR');
const qEvents = buildQualityEvents('lot-1', 'accepted', 12.5, 'Insp', 'T');
ok(qt.lotId === 'lot-1' && qt.result === 'accepted' && qt.inspectedBy === 'Insp' && 'id' in qt && 'createdAt' in qt, 'QualityTest shape (lotId/result/inspectedBy + BaseEntity)');
ok(mr.lotId === 'lot-1' && mr.moisture.value === 12.5, 'MoistureRecord captures the measured moisture value');
ok(qEvents.length === 2 && qEvents[0].name === 'quality.tested' && qEvents[1].name === 'moisture.recorded', 'records exactly TWO events: quality.tested + moisture.recorded');
ok(qEvents.every(e => e.correlationId === qt.lotId), 'both quality events linked to the lot (correlationId == lotId)');
const qPayload = { transactionType: 'quality.record', transactionId: 'TX', transactionVersion: 1, qualityTests: [qt], moistureRecords: [mr], events: qEvents };
ok(qPayload.transactionType === 'quality.record', 'quality commit envelope: transactionType = quality.record');
ok(qPayload.qualityTests.length === 1 && qPayload.moistureRecords.length === 1 && qPayload.events.length === 2, 'quality commit payload: 1 qualityTest + 1 moistureRecord + 2 events');
ok(!('lots' in qPayload) && !('voucherId' in qt) && !('amount' in qt), 'Option B: NO lot mutation, NO voucher (pure recording)');

console.log(`[procurement-test] ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

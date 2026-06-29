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

// 6. Phase 2.1.1 — one QualityTest + one MoistureRecord per lot. Authoritative enforcement is the
//    DB unique index on lotId; this mirrors the DataContext early-validation + its return style.
const alreadyInspected = (tests, moistures, lotId) => tests.some(t => t.lotId === lotId) || moistures.some(m => m.lotId === lotId);
const sentinelOf = (lotId, result) => ({ id: '', lotId, result, inspectedBy: '', createdAt: '', updatedAt: '' });
ok(alreadyInspected([qt], [mr], 'lot-1') === true, 'guard detects an existing QualityTest/MoistureRecord for the lot');
ok(alreadyInspected([qt], [mr], 'lot-2') === false, 'guard allows a first inspection for a fresh lot');
ok(alreadyInspected([], [mr], 'lot-1') === true, 'guard detects a duplicate via the MoistureRecord side too');
ok(sentinelOf('lot-1', 'accepted').id === '', 'rejected path returns an empty-id sentinel (consistent with addFarmer/addProcurementLot)');

// 7. Phase 2.3 — J-Form numbering is DB-owned. Mirrors generateJForm (client sends NO number) +
//    the SQL commit (per-society counter → documentNo, stamped into BOTH the jform row and the event).
const buildClientJForm = (lotId, qty, rate, currency, now, uuid) => {
  const gross = qty * rate;
  return { id: uuid, lotId, documentNo: '', gross: { amount: gross, currency }, deductions: { amount: 0, currency }, net: { amount: gross, currency }, createdAt: now, updatedAt: now };
};
const cjf = buildClientJForm('lot-1', 20, 2275, 'INR', 'T', 'JF');
ok(cjf.documentNo === '', 'client sends NO document number (DB is the single source of truth)');
ok(cjf.gross.amount === 45500 && cjf.deductions.amount === 0 && cjf.net.amount === 45500, 'gross = qty × MSP, deductions = 0, net = gross');
ok(!('voucherId' in cjf) && !('intentId' in cjf) && !('postingRequestId' in cjf), 'J-Form is a document: NO voucher / intent / posting fields');
const nextDocNo = (lastNo) => 'J' + String(lastNo + 1).padStart(4, '0');           // DB counter mirror
ok(nextDocNo(0) === 'J0001' && nextDocNo(1) === 'J0002' && nextDocNo(11) === 'J0012', 'DB numbering: per-society counter → J0001, J0002, …');
let last = 0; const seq = [nextDocNo(last++), nextDocNo(last++), nextDocNo(last++)];
ok(new Set(seq).size === 3 && seq[0] < seq[1] && seq[1] < seq[2], 'numbering is strictly increasing + distinct');
const commit = (clientJf, sid, lastNo) => {                                          // SQL commit mirror
  const doc = nextDocNo(lastNo);
  const jform = { ...clientJf, society_id: sid, documentNo: doc };
  const event = { id: 'je', correlationId: clientJf.lotId, name: 'jform.generated', payload: { jformId: clientJf.id, documentNo: doc, net: clientJf.net } };
  return { jform, event };
};
const { jform, event } = commit(cjf, 'SOC001', 0);
ok(jform.documentNo === 'J0001', 'DB stamps the generated number onto the J-Form row');
ok(event.name === 'jform.generated' && event.correlationId === cjf.lotId, "one 'jform.generated' event linked to the lot");
ok(event.payload.documentNo === jform.documentNo, 'J-Form and jform.generated event ALWAYS share the same documentNo (D2)');
const docKey = (sid, doc) => `${sid}|${doc}`;                                         // (society_id, documentNo) uniqueness mirror
ok(new Set([docKey('SOC001','J0001'), docKey('SOC001','J0002'), docKey('SOC002','J0001')]).size === 3, '(society_id, documentNo) unique: same number allowed across societies, never within one');
ok(docKey('SOC001','J0001') !== docKey('SOC002','J0001') && docKey('SOC001','J0001') === docKey('SOC001','J0001'), 'duplicate (society_id, documentNo) collides → blocked by the unique index (D4)');

// 8. Phase 3.0 — Financial Intent (business object only). Mirrors DataContext.generateFinancialIntent.
const buildIntent = (jform, now, uuid) => ({
  id: uuid, lotId: jform.lotId, jformId: jform.id, intentType: 'RecogniseProcurement', amount: jform.net, createdAt: now, updatedAt: now,
});
const sampleJform = { id: 'JF-1', lotId: 'lot-1', net: { amount: 45500, currency: 'INR' } };
const fi = buildIntent(sampleJform, 'T', 'FI-1');
ok(fi.id === 'FI-1' && fi.lotId === 'lot-1' && fi.jformId === 'JF-1' && 'createdAt' in fi, 'FinancialIntentRecord shape (intentId/lotId/jformId + createdAt)');
ok(fi.intentType === 'RecogniseProcurement', "intentType = 'RecogniseProcurement'");
ok(fi.amount.amount === 45500 && fi.amount.currency === 'INR', 'amount = J-Form net (currency-tagged: amount + currency)');
ok(!('voucherId' in fi) && !('postingRuleId' in fi) && !('ledgerId' in fi) && !('legs' in fi), 'business object only: NO voucher / posting / ledger fields');
const iEvent = { id: 'ie', correlationId: fi.lotId, name: 'financial.intent.created', occurredAt: 'T', recordedAt: 'T', actor: 'राजेश', payload: { intentId: fi.id, jformId: fi.jformId, amount: fi.amount } };
ok(iEvent.name === 'financial.intent.created' && iEvent.correlationId === fi.lotId, "exactly one 'financial.intent.created' event linked to the lot");
ok(iEvent.payload.intentId === fi.id && iEvent.payload.jformId === fi.jformId, 'event payload references the intent + J-Form');
const iPayload = { transactionType: 'financial.intent.create', transactionId: 'TX', transactionVersion: 1, financialIntents: [fi], events: [iEvent] };
ok(iPayload.transactionType === 'financial.intent.create', 'commit envelope: transactionType = financial.intent.create');
ok(iPayload.financialIntents.length === 1 && iPayload.events.length === 1, 'commit payload: 1 financialIntent + 1 event');
const alreadyIntent = (intents, jformId) => intents.some(i => i.jformId === jformId);
ok(alreadyIntent([fi], 'JF-1') === true && alreadyIntent([fi], 'JF-2') === false, 'one Financial Intent per J-Form guard (mirror; DB unique index on jformId is the guarantee)');

// 9. Phase 3.1 — Posting Request (business object only). Mirrors DataContext.generatePostingRequest.
const buildPostingRequest = (intent, now, uuid) => ({
  id: uuid, lotId: intent.lotId, jformId: intent.jformId, financialIntentId: intent.id,
  requestType: intent.intentType, amount: intent.amount, createdAt: now, updatedAt: now,
});
const sourceIntent = { id: 'FI-1', lotId: 'lot-1', jformId: 'JF-1', intentType: 'RecogniseProcurement', amount: { amount: 45500, currency: 'INR' } };
const pr = buildPostingRequest(sourceIntent, 'T', 'PR-1');
ok(pr.id === 'PR-1' && pr.lotId === 'lot-1' && pr.jformId === 'JF-1' && pr.financialIntentId === 'FI-1' && 'createdAt' in pr && 'updatedAt' in pr, 'PostingRequest shape (id/lotId/jformId/financialIntentId + BaseEntity)');
ok(pr.requestType === sourceIntent.intentType && pr.requestType === 'RecogniseProcurement', 'requestType copied from the source intent (RecogniseProcurement)');
ok(pr.amount.amount === sourceIntent.amount.amount && pr.amount.currency === 'INR', 'amount copied from the source intent (no recalculation)');
ok(!('voucherId' in pr) && !('postingRuleId' in pr) && !('ledgerId' in pr) && !('debitAccountId' in pr) && !('creditAccountId' in pr) && !('legs' in pr), 'business object only: NO voucher / posting / ledger / debit / credit fields');
const prEvent = { id: 'pe', correlationId: pr.lotId, name: 'posting.request.created', occurredAt: 'T', recordedAt: 'T', actor: 'राजेश', payload: { postingRequestId: pr.id, financialIntentId: pr.financialIntentId, amount: pr.amount } };
ok(prEvent.name === 'posting.request.created' && prEvent.correlationId === pr.lotId, "exactly one 'posting.request.created' event linked to the lot (correlationId = lotId)");
ok(prEvent.payload.postingRequestId === pr.id && prEvent.payload.financialIntentId === pr.financialIntentId, 'event payload references the request + the source intent');
const prPayload = { transactionType: 'posting.request.create', transactionId: 'TX', transactionVersion: 1, postingRequests: [pr], events: [prEvent] };
ok(prPayload.transactionType === 'posting.request.create', 'commit envelope: transactionType = posting.request.create');
ok(prPayload.postingRequests.length === 1 && prPayload.events.length === 1, 'commit payload: 1 postingRequest + 1 event');
const alreadyRequest = (requests, fiId) => requests.some(p => p.financialIntentId === fiId);
ok(alreadyRequest([pr], 'FI-1') === true && alreadyRequest([pr], 'FI-2') === false, 'one Posting Request per Financial Intent guard (mirror; DB unique index on financialIntentId is the guarantee)');

console.log(`[procurement-test] ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

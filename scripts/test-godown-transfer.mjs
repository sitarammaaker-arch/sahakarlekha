// Inter-godown transfer (ECR-20) — mirrors src/lib/godownTransfer.ts + the qtyDelta rule.
// Run: node scripts/test-godown-transfer.mjs
function validateTransfer(input) {
  if (!input.fromGodownId || !input.toGodownId) return { ok: false, error: 'स्रोत और गंतव्य गोदाम चुनें।' };
  if (input.fromGodownId === input.toGodownId) return { ok: false, error: 'स्रोत और गंतव्य गोदाम अलग होने चाहिए।' };
  if (!(input.qty > 0)) return { ok: false, error: 'मात्रा 0 से अधिक होनी चाहिए।' };
  if (input.qty > input.availableQty) return { ok: false, error: `स्रोत गोदाम में केवल ${input.availableQty} उपलब्ध है।` };
  return { ok: true };
}
function buildTransferLegs(input) {
  const q = Math.abs(input.qty);
  const to = input.toLabel || input.toGodownId, from = input.fromLabel || input.fromGodownId;
  const common = { date: input.date, itemId: input.itemId, type: 'adjustment', rate: input.rate, amount: q * input.rate, referenceNo: input.transferNo };
  const out = { ...common, qty: -q, godownId: input.fromGodownId, narration: `गोदाम स्थानांतरण (जावक) → ${to}` };
  const inn = { ...common, qty: q, godownId: input.toGodownId, narration: `गोदाम स्थानांतरण (आवक) ← ${from}` };
  return [out, inn];
}
// Canonical stock delta (RULE-2) — proves the legs move the right way under the real formula.
const qtyDelta = (type, qty) => (type === 'purchase' || type === 'opening' || (type === 'adjustment' && qty > 0)) ? qty : -Math.abs(qty);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Validation.
ok(!validateTransfer({ fromGodownId: 'G1', toGodownId: 'G1', qty: 5, availableQty: 10 }).ok, 'same godown rejected');
ok(!validateTransfer({ fromGodownId: '', toGodownId: 'G2', qty: 5, availableQty: 10 }).ok, 'missing source rejected');
ok(!validateTransfer({ fromGodownId: 'G1', toGodownId: 'G2', qty: 0, availableQty: 10 }).ok, 'zero qty rejected');
ok(!validateTransfer({ fromGodownId: 'G1', toGodownId: 'G2', qty: -3, availableQty: 10 }).ok, 'negative qty rejected');
ok(!validateTransfer({ fromGodownId: 'G1', toGodownId: 'G2', qty: 15, availableQty: 10 }).ok, 'over-available rejected');
ok(validateTransfer({ fromGodownId: 'G1', toGodownId: 'G2', qty: 10, availableQty: 10 }).ok, 'exactly available allowed');
ok(validateTransfer({ fromGodownId: 'G1', toGodownId: 'G2', qty: 4, availableQty: 10 }).ok, 'within available allowed');

// 2. Legs — signs, godowns, shared ref, both adjustment.
const [out, inn] = buildTransferLegs({ itemId: 'A', fromGodownId: 'G1', toGodownId: 'G2', qty: 30, rate: 50, date: '2026-04-10', transferNo: 'TRF/1', fromLabel: 'मुख्य', toLabel: 'शाखा' });
ok(out.type === 'adjustment' && inn.type === 'adjustment', 'both legs are adjustments (no formula change)');
ok(out.qty === -30 && out.godownId === 'G1', 'OUT leg: -30 @ source');
ok(inn.qty === 30 && inn.godownId === 'G2', 'IN leg: +30 @ destination');
ok(out.referenceNo === 'TRF/1' && inn.referenceNo === 'TRF/1', 'shared TRF reference');
ok(out.amount === 1500 && inn.amount === 1500, 'value = qty × rate on both legs');
ok(inn.narration.includes('मुख्य') && out.narration.includes('शाखा'), 'narration carries godown labels');

// 3. Under the canonical formula the pair nets to zero society-wide but shifts per godown.
const societyDelta = qtyDelta(out.type, out.qty) + qtyDelta(inn.type, inn.qty);
ok(societyDelta === 0, 'society-wide net delta = 0 (total stock unchanged)');
ok(qtyDelta(out.type, out.qty) === -30, 'source godown -30');
ok(qtyDelta(inn.type, inn.qty) === 30, 'destination godown +30');

console.log(`\nGodown transfer (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

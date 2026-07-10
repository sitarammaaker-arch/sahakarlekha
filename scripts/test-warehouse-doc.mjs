// Warehouse documents (ECR-20) — mirrors src/lib/warehouseDoc.ts.
// Run: node scripts/test-warehouse-doc.mjs
function warehouseDocKind(movementType, qty) {
  const inward = movementType === 'purchase' || movementType === 'opening' || (movementType === 'adjustment' && qty > 0);
  return inward ? 'WHR' : 'GatePass';
}
function buildWarehouseDoc(input) {
  const kind = warehouseDocKind(input.movementType, input.qty);
  const qtyStr = `${Math.abs(input.qty)}${input.itemUnit ? ' ' + input.itemUnit : ''}`;
  const common = [
    { label: 'दिनांक (Date)', value: input.date || '' },
    { label: 'वस्तु (Item)', value: input.itemName },
    { label: 'मात्रा (Qty)', value: qtyStr },
    { label: 'गोदाम (Godown)', value: input.godownName },
    { label: 'संदर्भ (Ref)', value: input.referenceNo || '—' },
  ];
  if (kind === 'WHR') return { kind, title: 'गोदाम रसीद (Warehouse Receipt)', docNo: input.docNo, societyName: input.societyName, fields: common, manualFields: ['जमाकर्ता (Depositor)', 'श्रेणी/किस्म (Grade)', 'बोरे/पैकेट (Bags)', 'भंडारण शुल्क (Storage charge)', 'प्राप्तकर्ता के हस्ताक्षर (Received by)'] };
  return { kind, title: 'निकासी पर्ची (Gate Pass)', docNo: input.docNo, societyName: input.societyName, fields: common, manualFields: ['प्राप्तकर्ता (Issued to)', 'वाहन संख्या (Vehicle no.)', 'गंतव्य (Destination)', 'चालक (Driver)', 'अधिकृत हस्ताक्षर (Authorised by)'] };
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Kind by direction.
ok(warehouseDocKind('purchase', 100) === 'WHR', 'purchase → WHR');
ok(warehouseDocKind('opening', 50) === 'WHR', 'opening → WHR');
ok(warehouseDocKind('adjustment', 5) === 'WHR', 'positive adjustment → WHR');
ok(warehouseDocKind('sale', 30) === 'GatePass', 'sale → Gate Pass');
ok(warehouseDocKind('adjustment', -5) === 'GatePass', 'negative adjustment → Gate Pass');

// 2. WHR document content.
{
  const d = buildWarehouseDoc({ movementType: 'purchase', qty: 100, date: '2026-04-01', referenceNo: 'PUR/1', docNo: 'WHR/1', societyName: 'ग्राम सेवा', godownName: 'मुख्य गोदाम', itemName: 'गेहूँ', itemUnit: 'क्विंटल' });
  ok(d.kind === 'WHR' && d.title.includes('गोदाम रसीद'), 'WHR title');
  ok(d.fields.find(f => f.label.includes('मात्रा')).value === '100 क्विंटल', 'qty with unit');
  ok(d.fields.find(f => f.label.includes('वस्तु')).value === 'गेहूँ', 'item name');
  ok(d.manualFields.includes('जमाकर्ता (Depositor)'), 'WHR has depositor blank');
}

// 3. Gate pass document content — outward qty shown as magnitude.
{
  const d = buildWarehouseDoc({ movementType: 'adjustment', qty: -30, date: '2026-04-10', referenceNo: 'TRF/1', docNo: 'GP/1', societyName: 'ग्राम सेवा', godownName: 'शाखा', itemName: 'चावल' });
  ok(d.kind === 'GatePass' && d.title.includes('निकासी'), 'Gate pass title');
  ok(d.fields.find(f => f.label.includes('मात्रा')).value === '30', 'outward qty as magnitude (30, no unit)');
  ok(d.manualFields.includes('वाहन संख्या (Vehicle no.)'), 'gate pass has vehicle blank');
  ok(d.docNo === 'GP/1' && d.societyName === 'ग्राम सेवा', 'docNo + society carried');
}

// 4. Missing date → blank (fill by hand).
{
  const d = buildWarehouseDoc({ movementType: 'purchase', qty: 10, docNo: 'WHR/2', societyName: 'S', godownName: 'G', itemName: 'I' });
  ok(d.fields.find(f => f.label.includes('दिनांक')).value === '', 'missing date → blank');
  ok(d.fields.find(f => f.label.includes('संदर्भ')).value === '—', 'missing ref → dash');
}

console.log(`\nWarehouse doc (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

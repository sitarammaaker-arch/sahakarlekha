// Report leftovers after RPT batch B (2026-11-21):
//  • Form 16A listed only TDS on purchases, grouped deductees by NAME and showed no challan → lib/tax/form16aRows.
//  • GSTR-1 had no B2CL (Table 5) → lib/gst/b2cl, threshold SOURCED from Notification 12/2024–Central Tax.
// Run: node scripts/test-report-leftovers.mjs
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

// ── 1. Form 16A rows ──
const F = await import(pathToFileURL(join(ROOT, 'src/lib/tax/form16aRows.ts')).href);
{
  const purchases = [
    { id: 'p1', date: '2026-05-10', purchaseNo: 'PUR/1', supplierId: 's1', supplierName: 'Ram Traders', netAmount: 100000, tdsPct: 0.1, tdsAmount: 100 },
    { id: 'p2', date: '2026-06-10', purchaseNo: 'PUR/2', supplierId: 's2', supplierName: 'Ram Traders', netAmount: 50000, tdsPct: 0.1, tdsAmount: 50 },
    { id: 'p3', date: '2025-12-01', supplierId: 's1', supplierName: 'Ram Traders', netAmount: 9, tdsPct: 1, tdsAmount: 1 },        // last FY
    { id: 'p4', date: '2026-07-01', supplierId: 's1', supplierName: 'Ram Traders', netAmount: 9, tdsPct: 1, tdsAmount: 1, isDeleted: true },
    { id: 'p5', date: '2026-07-02', supplierId: 's1', supplierName: 'Ram Traders', netAmount: 9, tdsPct: 0, tdsAmount: 0 },          // no TDS
  ];
  const party = { s1: { section: '194Q', deducteePan: 'AAAPR1234A' }, s2: { section: '194Q', deducteePan: '' } };
  const manual = [
    { id: 'm1', date: '2026-08-01', deducteeName: 'Shyam Contractor', deducteePan: 'bbbps1234b', section: '194C', natureOfPayment: 'Repair work', grossAmount: 40000, tdsRate: 1, tdsAmount: 400 },
    { id: 'm2', date: '2026-08-02', deducteeName: 'Clerk', deducteePan: 'CCCPC1234C', section: '192', grossAmount: 300000, tdsRate: 5, tdsAmount: 15000 },  // salary → Form 16
    { id: 'm3', date: '2026-08-03', deducteeName: 'X', section: '194C', grossAmount: 1, tdsRate: 1, tdsAmount: 1, isDeleted: true },
    { id: 'm4', date: '2026-05-10', deducteeName: 'Ram Traders', section: '194Q', grossAmount: 100000, tdsRate: 0.1, tdsAmount: 100, purchaseId: 'p1' },  // mirror of p1
  ];
  const challans = [{ id: 'c1', bsrCode: '0510308', challanDate: '2026-06-07', challanSerial: '00012' }, { id: 'c2', bsrCode: '9999999', challanDate: '2026-09-07', challanSerial: '1', isDeleted: true }];
  const links = [{ entryId: 'pur-p1', challanId: 'c1' }, { entryId: 'm1', challanId: 'c2' }];
  const rows = F.buildForm16aRows({ purchases, partyOf: (p) => party[p.supplierId], manual, challans, links, from: '2026-04-01', to: '2027-03-31' });
  ok(rows.length === 3, `purchases + manual of the year; salary (192), deleted, zero-TDS, other-year and the manual mirror of a purchase are out (${rows.length})`);
  ok(rows.some((r) => r.entryId === 'm1' && r.source === 'manual' && r.deducteePan === 'BBBPS1234B' && r.docNo === 'Repair work'), 'a manual register entry is in Form 16A (PAN upper-cased, nature as the document)');
  ok(!rows.some((r) => r.section === '192'), 'salary TDS (192) never appears — it belongs to Form 16');
  const p1 = rows.find((r) => r.entryId === 'pur-p1');
  ok(p1.challan && p1.challan.bsrCode === '0510308' && p1.challan.challanSerial === '00012', 'a purchase row carries its challan (BSR · date · serial) through the pur-<id> link');
  ok(rows.find((r) => r.entryId === 'm1').challan === null, 'a link to a DELETED challan is shown as not linked');
  const groups = F.groupForm16a(rows);
  ok(groups.length === 3 && groups.filter((g) => g.name === 'Ram Traders').length === 2, 'two suppliers with the SAME NAME stay two deductees (grouped by id, not name)');
  ok(F.deducteeKeyOf(undefined, 'aaapr1234a', 'x') === 'pan:AAAPR1234A' && F.deducteeKeyOf(undefined, 'bad', 'Some One') === 'name:some one' && F.deducteeKeyOf('s9', 'AAAPR1234A', 'x') === 'id:s9', 'key: supplier id, else a valid PAN, else the name');
  const g1 = groups.find((g) => g.key === 'id:s1');
  ok(g1.gross === 100000 && g1.tds === 100 && g1.pan === 'AAAPR1234A', 'group totals and PAN');
  ok(F.challanLabel(null) === 'Not linked to a challan' && F.challanLabel(p1.challan).startsWith('BSR 0510308'), 'challan label');
}

// ── 2. B2CL threshold (sourced) and classification ──
const B = await import(pathToFileURL(join(ROOT, 'src/lib/gst/b2cl.ts')).href);
{
  ok(B.b2clThreshold('2024-07-31') === 250000 && B.b2clThreshold('2024-08-01') === 100000 && B.b2clThreshold('2026-11-21') === 100000, '₹2.5 lakh before 1 Aug 2024, ₹1 lakh from that day (Notification 12/2024–CT, rule 59(4))');
  ok(!B.isB2CL({ date: '2026-05-01', grandTotal: 100000, igstAmount: 18000 }), 'exactly ₹1,00,000 is NOT B2CL — the rule says "more than one lakh rupees"');
  ok(B.isB2CL({ date: '2026-05-01', grandTotal: 100000.01, igstAmount: 18000 }), 'above ₹1 lakh, inter-State: B2CL');
  ok(!B.isB2CL({ date: '2026-05-01', grandTotal: 500000, igstAmount: 0 }), 'intra-State (no IGST) is never B2CL, whatever the value');
  ok(!B.isB2CL({ date: '2024-07-15', grandTotal: 200000, igstAmount: 36000 }) && B.isB2CL({ date: '2024-07-15', grandTotal: 260000, igstAmount: 36000 }), 'an invoice dated before 1 Aug 2024 uses the old ₹2.5 lakh limit');
  const sec = B.buildB2clSection([
    { id: 'a', saleNo: 'S1', date: '2026-05-01', grandTotal: 118000, netAmount: 100000, cgstPct: 0, sgstPct: 0, igstPct: 18, igstAmount: 18000, cgstAmount: 0, sgstAmount: 0, pos: '07' },
    { id: 'b', saleNo: 'S2', date: '2026-05-02', grandTotal: 236000, netAmount: 200000, cgstPct: 0, sgstPct: 0, igstPct: 18, igstAmount: 36000, cgstAmount: 0, sgstAmount: 0, pos: '07' },
    { id: 'c', saleNo: 'S3', date: '2026-05-03', grandTotal: 112000, netAmount: 100000, cgstPct: 0, sgstPct: 0, igstPct: 12, igstAmount: 12000, cgstAmount: 0, sgstAmount: 0, pos: '03' },
  ], (s) => s.pos);
  ok(sec.length === 2 && sec[0].pos === '03' && sec[1].inv.length === 2, 'grouped by place of supply, one entry per invoice');
  ok(JSON.stringify(sec[1].inv[0].itms[0].itm_det) === '{"rt":18,"txval":100000,"iamt":18000,"csamt":0}', 'item detail carries rate, taxable value and IGST (no CGST/SGST on an inter-State invoice)');
  const src = read('src/lib/gst/b2cl.ts');
  ok(src.includes('Notification No. 12/2024–Central Tax') && src.includes('central-tax-12-2024-11072024.pdf') && src.includes('"with effect from 1st day of August, 2024'), 'the threshold names its primary source and quotes it (statutory values need sources)');
}

// ── 3. wiring ──
{
  const g = read('src/pages/GstSummary.tsx');
  ok(g.includes('const b2clSales = useMemo(() => activeSales.filter(s => !b2bIds.has(s.id) && isB2CL(s)), [activeSales, b2bIds]);'), 'GSTR-1: B2CL picked from non-B2B sales');
  ok(g.includes('if (b2bIds.has(s.id) || b2clIds.has(s.id)) continue;'), 'a B2CL invoice is NOT also summed into B2CS (no double reporting)');
  ok(g.includes('...(b2clArr.length > 0 ? { b2cl: b2clArr } : {}),'), 'the GSTR-1 JSON carries a b2cl section when there are such invoices');
  ok(g.includes("'5 — B2CL: Inter-State to Unregistered, invoice value above the limit'"), 'the GSTR-1 PDF lists them too');
  const f = read('src/pages/TdsForm16A.tsx');
  ok(f.includes('buildForm16aRows({') && f.includes("fetchAllPaged<ManualTdsEntry>('tds_entries', user.societyId)") && f.includes("fetchAllPaged<TdsChallanLink>('tds_challan_links', user.societyId, ['entryId'])"), 'Form 16A loads the manual entries, challans and links like the TDS Register');
  ok(f.includes("'Challan BSR', 'Challan Date', 'Challan Serial'") && f.includes("challanLabel(e.challan)"), 'challan details in the export and the per-deductee PDF');
  ok(f.includes('<SelectItem key={g.key} value={g.key}>') && !f.includes('supplierMap'), 'the deductee filter is by key, not by name');
  ok(f.includes('Statement of TDS deducted (non-salary) — NOT the TRACES certificate'), 'the summary keeps the honest label (now non-salary, not purchases-only)');
}

console.log(`Report leftovers (Form 16A + B2CL): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

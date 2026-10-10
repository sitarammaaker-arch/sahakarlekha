// Units = GST UQC codes (2026-10-10) — the pickers offer the full sourced list; GST outputs send the code.
//   • lib/units holds the 46 codes from the GSTN-authorised IRP master (source URL + date recorded)
//   • old stored keys / import spellings read through toUqc (kg → KGS, M.T → MTS, QTL. → QTL, ft → OTH)
//   • GSTR-1 HSN summary + e-way bill JSON send the UQC (the stored 'kg' / 'quintal' used to go as-is)
//   • Inventory + the quick "new item" dialog pick from the same list (common first, then all)
// Run: node scripts/test-gst-uqc-units.mjs   (npm run test:gst-uqc-units)
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const { UQC_LIST, UQC_SOURCE, COMMON_UQC, toUqc, unitLabel, unitOptions, isKnownUnit } = await import(pathToFileURL(resolve(SRC, 'lib', 'units.ts')).href);
const read = (p) => readFileSync(resolve(SRC, p), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. The sourced list
ok(UQC_LIST.length === 46 && new Set(UQC_LIST.map(u => u.code)).size === 46, "46 distinct UQC codes (the IRP master lists 46)");
ok(UQC_LIST.every(u => /^[A-Z]{3}$/.test(u.code) && u.en && u.hi), 'every code is 3 capitals with an English + Hindi name');
ok(['KGS', 'QTL', 'MTS', 'TON', 'LTR', 'MLT', 'NOS', 'PCS', 'BAG', 'BOX', 'BTL', 'DOZ', 'OTH'].every(c => UQC_LIST.some(u => u.code === c)), 'the units a cooperative needs are all there');
ok(UQC_SOURCE.url === 'https://einvoice6.gst.gov.in/masters-code' && UQC_SOURCE.read === '2026-10-10', 'source URL + read date recorded');
ok(COMMON_UQC.every(c => UQC_LIST.some(u => u.code === c)), 'the common shortlist only uses real codes');
const g = unitOptions();
ok(g.common.length + g.rest.length === 46 && !g.rest.some(u => COMMON_UQC.includes(u.code)), 'picker groups cover every code once');

// 2. Old values read correctly (prod 2026-10-10: bag, piece, kg, other, quintal, MT, M.T, Kg, QTL., ft)
const map = { bag: 'BAG', piece: 'PCS', kg: 'KGS', other: 'OTH', quintal: 'QTL', MT: 'MTS', 'M.T': 'MTS', Kg: 'KGS', 'QTL.': 'QTL', liter: 'LTR' };
ok(Object.entries(map).every(([k, v]) => toUqc(k) === v), 'every value in prod maps to its UQC');
ok(toUqc('ft') === 'OTH' && toUqc('') === 'OTH' && toUqc(undefined) === 'OTH', 'no code for feet / blank → OTH');
ok(toUqc('KGS') === 'KGS' && toUqc('kgs') === 'KGS' && toUqc('ltr') === 'LTR', 'a code (any case) stays itself');
ok(unitLabel('kg', true) === 'किलोग्राम (KGS)' && unitLabel('QTL', false) === 'Quintal (QTL)', 'labels show the name + code');
ok(unitLabel('ft', true) === 'ft' && !isKnownUnit('ft'), 'an unrecognised unit keeps its own text on screen');

// 3. Wiring
ok(/uqc: toUqc\(item\.unit\)/.test(read('pages/GstSummary.tsx')) && !/uqc: item\.unit \|\| 'NOS'/.test(read('pages/GstSummary.tsx')), 'GSTR-1 HSN summary sends the UQC');
ok(/unit: toUqc\(item\.unit\)/.test(read('pages/EWayBill.tsx')), 'e-way bill JSON sends the UQC');
const inv = read('pages/Inventory.tsx');
ok(/const UNIT_GROUPS = unitOptions\(\);/.test(inv) && /UNIT_GROUPS\.common\.map/.test(inv) && /UNIT_GROUPS\.rest\.map/.test(inv) && !/'kg' \| 'quintal' \| 'liter'/.test(inv), 'Inventory picks from the full UQC list (common first)');
ok(/unit: item\.unit \? toUqc\(item\.unit\) : 'KGS'/.test(inv) && /toUqc\(item\.unit\) === unitFilter/.test(inv), 'Inventory: an old item opens / filters by its UQC');
const qid = read('components/QuickItemDialog.tsx');
ok(/const UNIT_GROUPS = unitOptions\(\);/.test(qid) && /<optgroup/.test(qid), 'quick "new item" dialog uses the same list');

console.log(`GST UQC units: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

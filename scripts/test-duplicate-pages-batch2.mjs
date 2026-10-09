// Duplicate-page audit, batch 2 (2026-10-09).
//   • Receive / Make Payment retired into the Vouchers bill-wise panel (same component) — old links redirect
//   • the statutory registers stay (Nomination, Advance, Wage) — their real defects fixed instead:
//       – a flat-only nominee edit keeps nominees[] primary in step (no two different "primary" nominees)
//       – the Nomination Register counts multi-nominee members as nominated
//       – the labour entry pages link to their printable register
//   • the Member Application enforces the same phone + nominee rules as the Members form (checked in test:health-score)
// Behaviour checked through the REAL lib; wiring in the source (house style).
//
// Run: node scripts/test-duplicate-pages-batch2.mjs   (npm run test:duplicate-pages-batch2)
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src');
const { syncPrimaryNominee } = await import(pathToFileURL(resolve(SRC, 'lib', 'nomineeUtils.ts')).href);
const read = (p) => readFileSync(resolve(SRC, p), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Receive / Make Payment → Vouchers bill-wise
const app = read('App.tsx');
ok(/path="\/receive-payment" element=\{<Navigate to="\/vouchers\?billwise=receive" replace \/>\}/.test(app) && /path="\/make-payment" element=\{<Navigate to="\/vouchers\?billwise=pay" replace \/>\}/.test(app), 'old routes redirect to the Vouchers bill-wise panel');
ok(!/pages\/ReceivePayment|pages\/MakePayment/.test(app), 'the two shell pages are gone');
const cat = read('lib/navigation/moduleCatalog.ts');
ok(!/id: 'receivePayment'|id: 'makePayment'/.test(cat), 'no menu entries');
ok(!/receivePayment|makePayment/.test(read('lib/navigation/roleAccess.ts')), 'no role still lists the retired ids');
const v = read('pages/Vouchers.tsx');
ok(/const bw = searchParams\.get\('billwise'\);\s*if \(bw === 'receive' \|\| bw === 'pay'\) \{ setActiveTab\('entry'\); setBillWiseMode\(bw\); \}/.test(v), 'Vouchers opens the panel from ?billwise=');
const content = ['content/help/index.ts', 'content/cookbook/index.ts'].map(read).join('\n');
ok(!/route: '\/(receive|make)-payment'/.test(content), 'help / cookbook deep links point at the new place');
ok(!/मेन्यू में \*\*संचालन\*\* के अंदर \*\*\\"भुगतान (रसीद|करें)\\"\*\*/.test(read('content/help/extras.ts')), 'help steps no longer send users to the old menu items');

// 2. Nominee sync
const legacy = [{ id: 'n1', name: 'Sita', relation: 'Wife', sharePercent: 100 }];
ok(syncPrimaryNominee(legacy, { nomineeName: 'Gita' }) === legacy, 'legacy list (no role) is left untouched — never a duplicate');
ok(syncPrimaryNominee(undefined, { nomineeName: 'Gita' }) === undefined, 'no list → nothing invented');
const withPrimary = [{ id: 'p', role: 'primary', name: 'Sita', relation: 'Wife', phone: '9876543210', sharePercent: 0, age: 40 }, { id: 'a', role: 'additional', name: 'Ravi', relation: 'Son', sharePercent: 50 }];
const moved = syncPrimaryNominee(withPrimary, { nomineeName: 'Gita', nomineeRelation: 'Daughter', nomineePhone: '9123456780' });
ok(moved[0].name === 'Gita' && moved[0].relation === 'Daughter' && moved[0].phone === '9123456780' && moved[0].age === 40, 'primary entry follows the flat edit, keeps its other details');
ok(moved[1].name === 'Ravi', 'additional nominees untouched');
ok(syncPrimaryNominee(withPrimary, { nomineeName: '' }).every(n => n.role !== 'primary') && syncPrimaryNominee(withPrimary, { nomineeName: '' }).length === 1, 'clearing the flat nominee removes the primary entry only');
const dc = read('contexts/DataContext.tsx');
ok(/if \(!\('nominees' in data\) && \('nomineeName' in data \|\| 'nomineeRelation' in data \|\| 'nomineePhone' in data\)\) \{\s*updatedMember\.nominees = syncPrimaryNominee\(/.test(dc), 'updateMember syncs on a flat-only nominee edit (Nomination / Share Register, importer)');

// 3. Nomination Register counts multi-nominee members
const nr = read('pages/NominationRegister.tsx');
ok(/const hasNominee = \(m: Member\) => !!m\.nomineeName\?\.trim\(\) \|\| \(m\.nominees \?\? \[\]\)\.some\(n => n\.name\?\.trim\(\)\);/.test(nr) && !/m\.nomineeName \? 'Nominated'/.test(nr), 'a member with only list nominees is "nominated", not "pending"');

// 4. Labour registers kept + linked
ok(/to="\/advance-register"/.test(read('pages/WorkerAdvances.tsx')) && /to="\/wage-register"/.test(read('pages/MusterRoll.tsx')), 'entry pages link to their printable register');
ok(/id: 'advanceRegister'/.test(cat) && /id: 'wageRegister'/.test(cat) && /id: 'nominationRegister'/.test(cat), 'the statutory registers stay in the menu');

console.log(`Duplicate pages batch 2: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

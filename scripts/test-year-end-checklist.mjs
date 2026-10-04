// Year-end checklist: automatic rows follow the figures, manual rows are always manual, every row cites its CAS step.
// Run: node scripts/test-year-end-checklist.mjs   (npm run test:year-end-checklist)
import { buildYearEndChecklist } from '../src/lib/reports/yearEndChecklist.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  x', m); } };

const good = { tbBalanced: true, bsBalanced: true, bankTiesToBooks: true, bankTiesToRP: true, share: { reconciled: true, difference: 0 }, asset: { reconciled: true, difference: 0 } };
let items = buildYearEndChecklist(good);
const auto = (x) => x.filter(i => i.status !== 'manual');
const manual = (x) => x.filter(i => i.status === 'manual');
ok(auto(items).length === 6 && auto(items).every(i => i.status === 'ok'), 'all six automatic rows are ok when everything agrees');
ok(manual(items).length === 7, 'seven steps need a person');
ok(items.every(i => /^NABARD CAS, Annexure VI, step /.test(i.cite)), 'every row cites its CAS Annexure VI step');
ok(items.every(i => i.en && i.hi && /[ऀ-ॿ]/.test(i.hi)), 'every row has English and Hindi text');

items = buildYearEndChecklist({ ...good, bankTiesToBooks: false });
ok(items.find(i => i.key === 'bank-books').status === 'warn' && /reconcile/.test(items.find(i => i.key === 'bank-books').detail), 'Bank Book vs Trial Balance mismatch warns (the Assandh case)');
ok(items.find(i => i.key === 'bank-rp').status === 'ok', 'only the row that disagrees warns');

items = buildYearEndChecklist({ ...good, share: { reconciled: false, difference: -1234.5 } });
ok(/1,234\.50/.test(items.find(i => i.key === 'share').detail), 'a mismatch carries its figure');

items = buildYearEndChecklist({ ...good, tbBalanced: false, bsBalanced: false });
ok(items.filter(i => i.status === 'warn').length === 2, 'TB and BS rows warn independently');
ok(manual(items).every(i => i.status === 'manual'), 'manual rows never change status');

console.log(`year-end-checklist: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

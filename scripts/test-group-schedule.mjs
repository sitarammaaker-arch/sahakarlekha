// Group Schedule / समूह अनुसूची (2026-10-16) + the two Ledger Heads form fixes shipped with it.
//   • every figure is a Trial Balance row; the grand total equals the TB's own group subtotal (groupWithSubtotals)
//   • one section for direct ledgers + one per immediate sub-group; a deeper group is a sub-heading (not double-counted)
//   • a ledger is hidden only when opening, debit, credit AND closing are all zero
//   • a Dr party in a creditor group keeps Dr; gross Dr / Cr + net for opening and closing
//   • Ledger Heads: an empty Radix onValueChange never clears parentId; the Add form's balance side follows the type
// Run: node scripts/test-group-schedule.mjs   (npm run test:group-schedule)
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts']) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(u)) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const G = await import(pathToFileURL(resolve(SRC, 'lib', 'reports', 'groupSchedule.ts')).href);
const read = (p) => readFileSync(resolve(SRC, p), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const near = (a, b) => Math.abs(a - b) < 0.01;

// ── chart: Liabilities › Sundry Creditors › Market Supplier › Local (3 levels) + an asset head ──
const grp = (id, name, type, parentId, nameHi) => ({ id, name, nameHi, type, parentId, isGroup: true });
const led = (id, name, type, parentId, nameHi) => ({ id, name, nameHi, type, parentId, isGroup: false });
const accounts = [
  grp('2000', 'Liabilities', 'liability', undefined),
  grp('2100', 'Sundry Creditors', 'liability', '2000', 'विविध लेनदार'),
  grp('2110', 'Market Supplier', 'liability', '2100', 'बाज़ार सप्लायर'),
  grp('2111', 'Local', 'liability', '2110'),
  grp('2120', 'Empty Sub', 'liability', '2100'),
  led('C2', 'Zeta Traders', 'liability', '2100'),
  led('C1', 'Alpha Agro', 'liability', '2100', 'अल्फा एग्रो'),
  led('CD', 'Dr Party', 'liability', '2100'),
  led('CZ', 'Zero Party', 'liability', '2100'),
  led('CM', 'Mover', 'liability', '2100'),
  led('M1', 'Supplier One', 'liability', '2110'),
  led('L1', 'Local One', 'liability', '2111'),
  led('E1', 'Empty One', 'liability', '2120'),
  grp('1000', 'Assets', 'asset', undefined),
  grp('1100', 'Cash & Bank', 'asset', '1000'),
  led('K1', 'Cash', 'asset', '1100'),
  grp('9000', 'Suspense Root', 'liability', undefined),
  led('S1', 'Suspense', 'liability', '9000'),
];
const byId = new Map(accounts.map((a) => [a.id, a]));
// [opening Dr, opening Cr, period Dr, period Cr] → net = oDr − oCr + Dr − Cr (the TB's own formula)
const tbRow = (id, oDr, oCr, dr, cr) => ({ account: byId.get(id), openingDebit: oDr, openingCredit: oCr, transactionDebit: dr, transactionCredit: cr, netBalance: oDr - oCr + dr - cr });
const tb = [
  tbRow('C1', 0, 1000, 200, 500),      // Cr 1,300
  tbRow('C2', 0, 400.5, 0, 0),         // Cr 400.50
  tbRow('CD', 300, 0, 0, 0),           // a Dr party in a creditor group
  tbRow('CZ', 0, 0, 0, 0),             // all four zero → hidden
  tbRow('CM', 0, 0, 100, 100),         // zero opening & closing but moved → shown
  tbRow('M1', 0, 50, 0, 0),
  tbRow('L1', 0, 0, 0, 70),
  tbRow('E1', 0, 0, 0, 0),
  tbRow('K1', 5000, 0, 1000, 200),
  tbRow('S1', 0, 10, 0, 0),
];

const s = G.buildGroupSchedule(tb, accounts, '2100');
ok(s.titleEn === 'Sundry Creditors' && s.titleHi === 'विविध लेनदार', 'title en + hi');
ok(s.sections.length === 2, `2 sections (direct + Market Supplier; Empty Sub dropped) — got ${s.sections.length}`);
const [direct, market] = s.sections;
ok(direct.titleEn === 'Sundry Creditors — direct ledgers', 'direct section labelled when sub-groups follow');
ok(direct.rows.map((r) => r.accountId).join() === 'C1,CD,CM,C2', `direct ledgers sorted by name, zero party hidden — got ${direct.rows.map((r) => r.accountId)}`);
ok(direct.rows.map((r) => r.serial).join() === '1,2,3,4', 'serials 1..n in the section');
ok(!s.sections.flatMap((x) => x.rows).some((r) => r.accountId === 'CZ' || r.accountId === 'E1'), 'all-zero ledgers hidden');
ok(direct.rows.find((r) => r.accountId === 'CD').closing === 300, 'Dr party keeps its Dr side (+300)');
ok(direct.rows.find((r) => r.accountId === 'C1').closing === -1300, 'creditor closing Cr 1,300');
ok(near(direct.total.closing, -1300 + 300 + 0 - 400.5), 'direct section total net');

ok(market.titleEn === 'Market Supplier' && market.titleHi === 'बाज़ार सप्लायर', 'sub-group section titled');
const sub = market.rows.find((r) => r.kind === 'subhead');
ok(sub && sub.accountId === '2111' && sub.closing === -70 && sub.credit === 70, 'third level = sub-heading with its subtotal');
ok(market.rows.map((r) => r.kind + ':' + r.accountId).join() === 'ledger:M1,subhead:2111,ledger:L1', 'sub-heading precedes its ledgers');
ok(near(market.total.closing, -120), `sub-heading not double-counted (−50 −70 = −120) — got ${market.total.closing}`);
ok(market.rows.find((r) => r.accountId === 'L1').depth === 1, 'deeper ledger indented');

const t = G.trialBalanceGroupTotals(tb, accounts, '2100');
ok(t && near(s.grand.closing, t.closing) && near(s.grand.opening, t.opening) && near(s.grand.debit, t.debit) && near(s.grand.credit, t.credit),
  `grand total = the Trial Balance group subtotal — sched ${JSON.stringify(s.grand)} vs TB ${JSON.stringify(t)}`);
ok(near(s.grand.closing, -1520.5), `grand closing net Cr 1,520.50 — got ${s.grand.closing}`);
ok(near(s.grand.closingDr, 300) && near(s.grand.closingCr, 1820.5), 'gross Dr 300 / gross Cr 1,820.50');
ok(near(s.grand.openingDr, 300) && near(s.grand.openingCr, 1450.5), 'opening gross Dr / Cr');
ok(s.ledgerCount === 6, `ledgerCount 6 — got ${s.ledgerCount}`);

// Only one section → no "direct ledgers" suffix; a group with nothing to list is empty, not an error.
const cash = G.buildGroupSchedule(tb, accounts, '1100');
ok(cash.sections.length === 1 && cash.sections[0].titleEn === 'Cash & Bank' && cash.grand.closing === 5800, 'single-section schedule');
ok(G.buildGroupSchedule(tb, accounts, '2120').ledgerCount === 0, 'all-zero group lists nothing');

// Balance Sheet heads: groups under the standard roots + a non-standard root BS group; "all" skips empty heads.
const heads = G.balanceSheetHeads(accounts).map((a) => a.id);
ok(heads.join() === '2100,1100,9000', `BS heads — got ${heads}`);
const all = G.allBalanceSheetSchedules(tb, accounts);
ok(all.map((x) => x.groupId).join() === '2100,1100,9000', 'all schedules = every head with ledgers');

// Excel rows: section headings, totals, grand total + gross lines; amounts unsigned with a Dr/Cr column.
const rows = G.scheduleSheetRows(s);
ok(rows.every((r) => r.length === G.SCHEDULE_HEADERS.length), 'every sheet row has every column');
const cdRow = rows.find((r) => r[1] === 'Dr Party');
ok(cdRow && cdRow[7] === 300 && cdRow[8] === 'Dr', 'Excel: Dr party shows 300 Dr');
const grandRow = rows.find((r) => String(r[1]).startsWith('GRAND TOTAL'));
ok(grandRow && grandRow[7] === 1520.5 && grandRow[8] === 'Cr', 'Excel: grand total 1,520.50 Cr');
ok(rows.some((r) => r[1] === 'Local (sub-total)') && rows.some((r) => r[1] === '  Local One'), 'Excel: sub-heading row, its ledgers indented');

// ── wiring (static) ──
const app = read('App.tsx');
ok(/path="\/group-schedule"[^\n]*<ProtectedRoute><GroupSchedule \/>/.test(app), 'route /group-schedule is protected');
ok(/id: 'groupSchedule'[^\n]*route: '\/group-schedule'[^\n]*requiredRoles: \['admin', 'accountant', 'auditor'\]/.test(read('lib/navigation/moduleCatalog.ts')), 'catalog entry, audit roles');
ok(read('lib/navigation/hubs.ts').includes("'auditSchedules', 'groupSchedule'"), 'in the Audit section of the registers hub');
ok(read('contexts/LanguageContext.tsx').includes("groupSchedule: { hi: 'समूह अनुसूची', en: 'Group Schedule' }"), 'nav label');
const pdf = read('lib/pdf.ts');
ok(/export function generateGroupSchedulePDF\(/.test(pdf) && pdf.includes('LIST OF ${') && pdf.includes('doc.addPage'), 'PDF: LIST OF … AS ON, a page per head');
const page = read('pages/GroupSchedule.tsx');
ok(page.includes("can('export')") && page.includes('trialBalanceGroupTotals') && page.includes('allBalanceSheetSchedules'), 'page: export-gated, tie-out, all schedules');
ok(page.includes('getTrialBalance(asOn)') && page.includes('fyStartOf(asOn)'), 'page: TB as on the date, period from the FY start');

// ── Ledger Heads form fixes ──
const lh = read('pages/LedgerHeads.tsx');
const parentHandlers = lh.match(/onValueChange=\{val => \{ if \(!val\) return; setForm\(f => \(\{ \.\.\.f, parentId: val === '__none__' \? '' : val \}\)\); \}\}/g) || [];
ok(parentHandlers.length === 2, `both Parent Group selects ignore an empty value — got ${parentHandlers.length}`);
ok(!/onValueChange=\{val => setForm\(f => \(\{ \.\.\.f, parentId:/.test(lh), 'no unguarded parent handler left');
ok(/<Select key=\{editAccount\?\.id \?\? 'none'\} value=\{form\.parentId \|\| '__none__'\}/.test(lh), 'Edit parent Select remounts per ledger');
ok(/type: val as AccountType, parentId: '', openingBalanceType: naturalOpeningSide\(val\)/.test(lh), 'Add form: balance side follows the account type');
ok(lh.includes("openingBalanceType: acc.openingBalanceType ?? naturalOpeningSide(acc.type)"), 'Edit: missing side defaults to the natural side');
ok((lh.match(/if \(val !== 'debit' && val !== 'credit'\) return;/g) || []).length === 2, 'balance-type selects ignore empty values');
const { naturalOpeningSide } = await import(pathToFileURL(resolve(SRC, 'lib', 'accountRoles.ts')).href);
ok(naturalOpeningSide('equity') === 'credit' && naturalOpeningSide('liability') === 'credit' && naturalOpeningSide('income') === 'credit'
  && naturalOpeningSide('asset') === 'debit' && naturalOpeningSide('expense') === 'debit', 'natural sides');

console.log(`group-schedule: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

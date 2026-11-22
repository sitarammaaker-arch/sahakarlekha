// BKP-05 + IMP-01 (product audit 2026-11-17).
//   IMP-01  parseFloat('1,20,000') = 1 — an import validated, previewed the raw text and saved one rupee →
//           parseImportNumber reads "1,20,000" / "₹ 5,000.50" / "Rs. 2500" / "300/-" and refuses anything else.
//   BKP-05  a Replace restore from an older archive deleted every live row of a table the archive did not carry →
//           a table absent from the archive is left untouched (diff preview and the writes agree).
// Run: node scripts/test-bkp05-imp01.mjs
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = pathResolve(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { resolve as pathResolve } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
  const SUPABASE = pathToFileURL(pathResolve(SRC, 'lib', 'supabase.ts')).href;
  export async function resolve(spec, ctx, next) {
    if (spec === '@/lib/supabase') return { url: SUPABASE, shortCircuit: true };
    if (spec.startsWith('@/')) { const base = pathResolve(SRC, spec.slice(2)); for (const c of [base + '.ts', base + '.tsx', base + '/index.ts', base]) if (existsSync(c)) return { url: pathToFileURL(c).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const c of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) { const u = new URL(c, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
  export async function load(url, ctx, next) {
    if (url === SUPABASE) return { format: 'module', shortCircuit: true, source: 'export const supabase = {}; export const supabaseLoose = supabase;' };
    return next(url, ctx);
  }
`));
const imp = (rel) => import(pathToFileURL(pathResolve(ROOT, rel)).href);
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── IMP-01 ──
{
  const T = await imp('src/lib/importTemplates.ts');
  const n = T.parseImportNumber;
  ok(n('1,20,000') === 120000 && n('1,200,000') === 1200000, 'Indian and Western thousands commas');
  ok(n('₹ 5,000.50') === 5000.5 && n('Rs. 2500') === 2500 && n('INR 99') === 99 && n('300/-') === 300 && n(' 42 ') === 42, 'rupee sign, Rs / INR, "/-" and spaces');
  ok(n(1500) === 1500 && n('-250') === -250, 'a numeric cell and a negative figure');
  ok([n(''), n('12a'), n('1.2.3'), n('abc'), n(undefined), n(null)].every(Number.isNaN), 'anything else is NaN (refused, never a wrong figure)');
  const accounts = [{ id: '3301', name: 'Cash in Hand', type: 'asset', isGroup: false }, { id: '4401', name: 'Interest', type: 'income', isGroup: false }];
  const row = { date: '2026-06-01', voucher_type: 'receipt', debit_account: '3301', credit_account: '4401', amount: '1,20,000', narration: 'x' };
  const errs = T.validateVoucherRow(row, accounts, '2026-04-01', '2027-03-31', 2);
  ok(!errs.some((e) => e.field === 'amount'), 'a voucher row with "1,20,000" validates');
  ok(T.validateVoucherRow({ ...row, amount: '1,2O,000' }, accounts, '2026-04-01', '2027-03-31', 2).some((e) => e.field === 'amount'), 'a mistyped amount ("O" for zero) is refused');
  ok(!T.validateAccountRow({ account_name: 'Bank', account_type: 'Asset', opening_balance: '2,50,000', balance_type: 'Debit' }, 2).some((e) => e.field === 'opening_balance'), 'an opening balance with commas validates');
  const src = read('src/lib/importTemplates.ts');
  ok(!/parseFloat\(row\./.test(src), 'no validator parses a cell with parseFloat');
  const ui = read('src/pages/UniversalImporter.tsx');
  ok(!ui.includes('parseFloat(') && (ui.match(/parseImportNumber\(/g) || []).length >= 8 && ui.includes('  parseImportNumber,\n} from \'@/lib/importTemplates\';'), 'the importer SAVES with the same parser it validated with');
}

// ── BKP-05 ──
{
  const D = await imp('src/lib/restore/diff.ts');
  const entity = { key: 'loan', table: 'loans', naturalKey: ['loanNo'] };
  const live = [{ loanNo: 'L1' }, { loanNo: 'L2' }];
  ok(D.diffEntity(entity, null, live, 'replace').orphan === 0, 'Replace from an archive WITHOUT the table deletes none of its rows');
  ok(D.diffEntity(entity, [{ loanNo: 'L1' }], live, 'replace').orphan === 1, 'a table the archive carries is still authoritative (L2 goes)');
  ok(D.diffEntity(entity, [], live, 'replace').orphan === 2, 'an archive that carries the table EMPTY still empties it');
  ok(D.diffEntity(entity, null, live, 'replace').absentFromArchive === true, 'the preview marks the table as absent from the archive');
  const c = read('src/lib/restore/commit.ts');
  ok(c.includes("if (input.mode === 'replace' && !Object.prototype.hasOwnProperty.call(input.archiveRows, entity.key)) continue;"), 'the writes skip it the same way');
  ok(c.indexOf('hasOwnProperty.call(input.archiveRows, entity.key)) continue;') < c.indexOf('await input.applyWrites(entity, rows, input.mode)'), '…before planning any write');
  const a = read('src/lib/restore/archive.ts');
  ok(a.includes('for (const listed of report.manifest.entities) {') && a.includes('rows[listed.key] = parseNdjson('), 'archive rows exist only for the tables the archive lists (absent = no key)');
}

console.log(`BKP-05 / IMP-01: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

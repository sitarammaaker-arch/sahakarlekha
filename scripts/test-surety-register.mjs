// Loan sureties + surety register (2026-11-16) — imports the REAL helpers via the '@/' loader.
//
// Guards:
//   - a list is cleaned before saving (trim, drop empty rows and repeats); the borrower can never be their own
//     surety, the same member never twice;
//   - the register covers LIVE loans only (not deleted, not cleared, something outstanding); a live loan with no
//     surety is listed and counted, not hidden;
//   - loan-wise totals are the loans' totals even when a loan has several sureties;
//   - surety-wise exposure adds each loan's outstanding under every one of its sureties;
//   - a member standing surety for a live loan blocks that member's delete; a cleared or deleted loan does not;
//   - RULE 1: `sureties` (column 169) is never in the base loan upsert — it is saved in a second step, and a
//     failed second step takes the sureties back off the screen and says so;
//   - the migration, the table file and the export registry all know the column.
//
// Run: node scripts/test-surety-register.mjs   (npm run test:surety-register)
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;
const read = (rel) => readFileSync(pathResolve(HERE, '..', rel), 'utf8').replace(/\r\n/g, '\n');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const S = await import(abs('../src/lib/loans/sureties.ts'));
const EL = await import(abs('../src/lib/entityLinks.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 1. Reading and cleaning.
ok(same(S.loanSureties({}), []) && same(S.loanSureties({ sureties: null }), []) && same(S.loanSureties({ sureties: 'x' }), []), 'no column / null / junk → no sureties');
ok(S.loanSureties({ sureties: [{ name: '' }, { memberId: 'm2', name: '' }, { name: 'Ram' }] }).length === 2, 'empty rows are not sureties');
ok(same(S.normalizeSureties([{ memberId: ' m2 ', name: ' x ' }, { name: '  Ram Lal ', phone: ' 98 ', address: '' }, { name: '' }, { memberId: 'm2', name: '' }, { name: 'ram lal' }]),
  [{ name: 'x', memberId: 'm2' }, { name: 'Ram Lal', phone: '98' }]), 'trimmed; empty rows and repeats (same member, same outside name) dropped');
ok(same(S.normalizeSureties(undefined), []) && same(S.normalizeSureties(null), []), 'nothing in → empty list');

// 2. Problems.
ok(S.suretyProblem('m1', [{ memberId: 'm2', name: '' }, { name: 'Ram' }]) === null, 'a member and an outsider are fine');
ok(S.suretyProblem('m1', [{ memberId: 'm1', name: '' }]) === 'self', 'the borrower cannot be their own surety');
ok(S.suretyProblem('m1', [{ memberId: 'm2', name: '' }, { memberId: 'm2', name: '' }]) === 'duplicate', 'the same member twice is refused');
ok(S.suretyProblem('m1', [{ name: '', phone: '98' }]) === 'noName', 'an outside surety needs a name');
ok(S.suretyProblem('m1', [{ name: '' }]) === null && S.suretyProblem('m1', []) === null && S.suretyProblem('m1', undefined) === null, 'an untouched empty row, or no sureties at all, is allowed');

// 3. Live loans, exposure, registers.
const L = (o) => ({ id: o.loanNo, memberId: 'm1', amount: 10000, repaidAmount: 0, status: 'active', ...o });
const loans = [
  L({ loanNo: 'L/001', sureties: [{ memberId: 'm2', name: '' }, { name: 'Ram Lal' }] }),                  // out 10,000
  L({ loanNo: 'L/002', memberId: 'm3', amount: 6000, repaidAmount: 1000, sureties: [{ memberId: 'm2', name: '' }] }),   // out 5,000
  L({ loanNo: 'L/003', memberId: 'm4', amount: 4000 }),                                                // live, no surety
  L({ loanNo: 'L/004', status: 'cleared', repaidAmount: 10000, sureties: [{ memberId: 'm2', name: '' }] }),
  L({ loanNo: 'L/005', isDeleted: true, sureties: [{ memberId: 'm5', name: '' }] }),
  L({ loanNo: 'L/006', repaidAmount: 10000, sureties: [{ memberId: 'm5', name: '' }] }),                 // fully repaid, status not updated
];
ok(loans.filter(S.isLiveLoan).map((l) => l.loanNo).join() === 'L/001,L/002,L/003', 'live = not deleted, not cleared, something outstanding');
ok(S.liveLoansGuaranteedBy(loans, 'm2') === 2 && S.liveLoansGuaranteedBy(loans, 'm5') === 0 && S.liveLoansGuaranteedBy(loans, 'm1') === 0, 'm2 guarantees two live loans; cleared / deleted / repaid loans do not count');

const ex = S.suretyExposure(loans);
ok(ex.length === 2 && ex[0].memberId === 'm2' && ex[0].loans === 2 && ex[0].outstanding === 15000 && ex[0].loanNos.join() === 'L/001,L/002', 'm2: two loans, 15,000 outstanding guaranteed');
ok(ex[1].name === 'Ram Lal' && !ex[1].memberId && ex[1].loans === 1 && ex[1].outstanding === 10000, 'the outside surety is listed by name');

const members = { m1: { memberNo: 'M001', name: 'One' }, m2: { memberNo: 'M002', name: 'Two' }, m3: { memberNo: 'M003', name: 'Three' }, m4: { memberNo: 'M004', name: 'Four' } };
const memberOf = (id) => members[id];
const t = S.suretyRegisterTable(loans, memberOf);
ok(t.rowsEn.length === 4, 'loan-wise: L/001 two lines, L/002 one, L/003 one');
ok(same(t.rowsEn[0], ['L/001', 'M001', 'One', 10000, 10000, 'M002', 'Two']), 'first surety line carries the loan and its amounts');
ok(same(t.rowsEn[1], ['', '', '', '', '', 'Non-member', 'Ram Lal']), 'second surety line repeats nothing — amounts are not doubled');
ok(t.rowsEn[3][0] === 'L/003' && /no surety recorded/.test(t.rowsEn[3][6]), 'a live loan without a surety is shown, not hidden');
ok(t.totals[3] === 20000 && t.totals[4] === 19000, 'totals are the live loans, not loans × sureties');
const colSum = t.rowsEn.reduce((s, r) => s + (typeof r[4] === 'number' ? r[4] : 0), 0);
ok(colSum === t.totals[4], 'the outstanding column adds up to its total');
ok(/3 live loan\(s\) · 1 without a surety/.test(t.subtitle), 'subtitle counts live loans and those without a surety');
ok(t.notes.some((n) => /bye-laws/.test(n.en) && /उपविधि/.test(n.hi)), 'says the number of sureties comes from the bye-laws');

const e = S.suretyExposureTable(loans, memberOf);
ok(e.rowsEn.length === 2 && same(e.rowsEn[0], [1, 'M002', 'Two', 2, 'L/001, L/002', 15000]), 'surety-wise: member resolved to number and name');
ok(same(e.rowsEn[1], [2, 'Non-member', 'Ram Lal', 1, 'L/001', 10000]), 'surety-wise: outsider by name');
ok(e.totals.every((v) => v === ''), 'no money total surety-wise (a loan with two sureties is under both)');
ok(e.notes.some((n) => /does not add up/.test(n.en)), 'and the note says why');
ok(same(S.suretySummary(loans), { liveLoans: 3, withoutSurety: 1, sureties: 2 }) && same(S.suretySummary([]), { liveLoans: 0, withoutSurety: 0, sureties: 0 }), 'summary counts match the two registers');
ok(S.suretyRegisterTable([], memberOf).rowsEn.length === 0 && S.suretyExposureTable([], memberOf).rowsEn.length === 0, 'no loans → empty registers');

// 4. Member delete pre-check.
const base = { vouchers: [], loans, sales: [], purchases: [], stockMovements: [], salaryRecords: [], suppliers: [], customers: [], assets: [], depositAccounts: [], kccLoans: [] };
const linksOf = (id) => EL.computeEntityLinks('member', id, base);
const m2 = linksOf('m2');
ok(m2.some((l) => l.blocking && /Surety for 2 loan/.test(l.labelEn) && /ज़मानतदार/.test(l.labelHi)), 'a surety on live loans blocks the member delete, with the count');
ok(!linksOf('m5').some((l) => /Surety/.test(l.labelEn)), 'a surety only on deleted / repaid loans is not blocked');

// 5. RULE 1 wiring in the data layer.
const dc = read('src/contexts/DataContext.tsx');
const add = dc.slice(dc.indexOf('const addLoan = useCallback('), dc.indexOf('// M16: Create disbursement voucher'));
ok(/const \{ sureties: loanSuretiesToSave, \.\.\.loanBase \} = loanToSave;/.test(add) && /upsert\(withSoc\(loanBase\)\)/.test(add) && !/upsert\(withSoc\(loanToSave\)\)/.test(add), 'addLoan: sureties are not in the base upsert');
ok(/if \(!error && loanSuretiesToSave && loanSuretiesToSave\.length > 0\) saveLoanSureties\(newLoan\.id, loanSuretiesToSave, \[\]\);/.test(add), 'addLoan: sureties saved in step 2, only after the row exists');
ok(/if \(refuseBadSureties\(data\.memberId, data\.sureties\)\) return/.test(add) && add.indexOf('refuseBadSureties(') < add.indexOf('crypto.randomUUID()'), 'addLoan: a bad surety list is refused before anything is created');
const upd = dc.slice(dc.indexOf('const updateLoan = useCallback('), dc.indexOf('const deleteLoan = useCallback('));
ok(/const \{ sureties: updatedSureties, \.\.\.updatedBase \} = updated;/.test(upd) && /upsert\(withSoc\(updatedBase\)\)/.test(upd) && !/upsert\(withSoc\(updated\)\)/.test(upd), 'updateLoan: sureties are not in the base upsert');
ok(/if \(!error && suretiesChanged\) saveLoanSureties\(id, updatedSureties \?\? \[\], before\.sureties\);/.test(upd), 'updateLoan: step 2 only when the sureties were part of the change (a repayment does not rewrite them)');
const sv = dc.slice(dc.indexOf('const saveLoanSureties ='), dc.indexOf('const addLoan = useCallback('));
ok(/\.update\(\{ sureties \}\)\.eq\('id', loanId\)\.eq\('society_id', societyIdRef\.current\)/.test(sv), 'step 2 updates this society\'s loan only');
ok(/setLoansState\(prev => prev\.map\(l => l\.id === loanId \? \{ \.\.\.l, sureties: restore \} : l\)\)/.test(sv) && /variant: 'destructive', duration: 15000/.test(sv) && /migration 169/.test(sv), 'a failed step 2 restores the screen and says so loudly, naming the migration');
ok(/if \(guardFYLocked\(\)\) return;/.test(upd) && /if \(guardFYLocked\(\)\) return \{ \.\.\.data, id: '' \}/.test(add), 'FY-lock guard still first on both');

// 6. The column exists everywhere it must.
const mig = read('supabase/migrations/169_loan_sureties.sql');
ok(/alter table public\.loans add column if not exists sureties jsonb default '\[\]'::jsonb;/.test(mig) && /^begin;/m.test(mig) && /^commit;/m.test(mig), 'migration 169 adds the column, idempotently, in a transaction');
ok(/alter table public\.loans drop column if exists sureties;/.test(read('supabase/migrations/169_loan_sureties_down.sql')), 'down migration removes it');
ok(/alter table loans add column if not exists sureties jsonb/.test(read('supabase-tables.sql')), 'supabase-tables.sql has the column');
ok(/internal\('sureties', 'Sureties', 'ज़मानतदार', \{ type: 'json', piiClass: 'contact' \}\)/.test(read('src/lib/export/entities/lending.ts')), 'export registry carries the column (so a backup keeps sureties), marked as contact data');
ok(/sureties\?: LoanSurety\[\];/.test(read('src/types/index.ts')), 'Loan type has the optional field');

// 7. Screen.
const lr = read('src/pages/LoanRegister.tsx');
ok(/sureties: normalizeSureties\(form\.sureties\),/.test(lr) && (lr.match(/if \(suretyError\(form\.memberId, form\.sureties\)\) return;/g) || []).length === 2, 'add and edit both check and pass the sureties');
ok(/sureties: loanSureties\(l\),/.test(lr), 'the edit form loads the loan\'s sureties');
ok(/members\.filter\(m => m\.id !== form\.memberId\)\.map\(/.test(lr), 'the borrower is not offered as their own surety');
ok(/suretyRegisterTable\(loans, memberOf\) : suretyExposureTable\(loans, memberOf\)/.test(lr) && /ledgerPdf\(society, \[suretyTable\], 'SUR'/.test(lr), 'register on screen and in the PDF come from the same table');

console.log(`\nsurety-register: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

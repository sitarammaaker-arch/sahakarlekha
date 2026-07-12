// Banking adapters — prepare-only (T-28 / API Constitution Art. VII; API-P7, API-P8, BANK-1/2).
//
// Proves: SahakarLekha reconciles and prepares; rails and humans move money.
//   • a bank statement is untrusted — validated & normalized to exact money, or refused (API-P7);
//   • auto-match candidates are PROPOSALS with exact minor-unit amounts (no silent tolerance,
//     BANK-2); nothing is applied — a human confirms (Art. VII);
//   • a payment is PREPARED and authorized under human authority + SoD; there is NO execute path —
//     money never moves in this system (BANK-1/API-P8).
//
// Run: node scripts/test-bank-adapters.mjs   (npm run test:bank-adapters)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

// statement.ts / payment.ts import '../../money' (relative, no ext) — resolve it.
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath } from 'node:url';
  const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
      for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
        const u = new URL(cand, ctx.parentURL);
        if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
      }
    }
    return next(spec, ctx);
  }
`));

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let ST, PAY;
try {
  ST = await import(abs('../src/lib/api/bank/statement.ts'));
  PAY = await import(abs('../src/lib/api/bank/payment.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the bank-adapter modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { normalizeStatementLine, proposeMatches } = ST;
const { preparePaymentInstruction, authorizePayment } = PAY;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. STATEMENT INGEST — untrusted → exact money, or refused (API-P7) ───────
const credit = normalizeStatementLine({ date: '2026-04-10', description: 'NEFT IN', credit: '1,250.50' });
ok(credit.ok && credit.line.amountMinor === 125050 && credit.line.direction === 'credit', 'a credit line is normalized to exact minor units');
const debit = normalizeStatementLine({ date: '2026-04-11', debit: 500 });
ok(debit.ok && debit.line.amountMinor === 50000 && debit.line.direction === 'debit', 'a debit line is normalized');
ok(!normalizeStatementLine({ date: 'not-a-date', credit: 100 }).ok, 'a line with no valid date is refused');
ok(!normalizeStatementLine({ date: '2026-04-10', debit: 100, credit: 100 }).ok, 'a line that is BOTH debit and credit is refused (never guessed)');
ok(!normalizeStatementLine({ date: '2026-04-10' }).ok, 'a line with neither debit nor credit is refused');
ok(!normalizeStatementLine({ date: '2026-04-10', credit: 'abc' }).ok, 'a non-numeric amount is refused');

// ── 2. AUTO-MATCH — exact-amount PROPOSALS only, nothing applied (BANK-2) ─────
const statement = [
  { date: '2026-04-10', description: 'a', amountMinor: 125050, direction: 'credit' },
  { date: '2026-04-11', description: 'b', amountMinor: 50000, direction: 'debit' },
  { date: '2026-04-12', description: 'c', amountMinor: 99999, direction: 'debit' }, // no book match
];
const book = [
  { id: 'V1', date: '2026-04-10', amountMinor: 125050, direction: 'credit' },  // exact + same day
  { id: 'V2', date: '2026-04-13', amountMinor: 50000, direction: 'debit' },     // exact, 2 days later
  { id: 'V3', date: '2026-04-11', amountMinor: 50000, direction: 'credit' },    // amount matches but WRONG direction
];
const proposals = proposeMatches(statement, book, { dateWindowDays: 3 });
ok(proposals.length === 2, 'only exact amount+direction candidates within the window are proposed');
ok(proposals[0].bookEntryId === 'V1' && proposals[0].confidence === 1, 'a same-day exact match has full confidence');
const v2 = proposals.find((p) => p.bookEntryId === 'V2');
ok(v2 && v2.confidence < 1 && v2.confidence > 0, 'a later-but-in-window match has partial confidence');
ok(!proposals.some((p) => p.bookEntryId === 'V3'), 'a same-amount but wrong-direction entry is NOT proposed (no silent match)');
// exact-amount discipline: a 1-paisa difference is not a match (no silent tolerance, BANK-2).
ok(proposeMatches([{ date: '2026-04-10', description: '', amountMinor: 125049, direction: 'credit' }], book, { dateWindowDays: 3 }).length === 0,
  'a 1-paisa mismatch is not proposed — reconciliation is exact, tolerance would be an explicit rule (BANK-2)');
// each book entry proposed at most once.
const dupStmt = [
  { date: '2026-04-10', description: '', amountMinor: 125050, direction: 'credit' },
  { date: '2026-04-10', description: '', amountMinor: 125050, direction: 'credit' },
];
ok(proposeMatches(dupStmt, book, { dateWindowDays: 3 }).length === 1, 'a book entry is proposed to at most one statement line');

// ── 3. PAYMENT — prepared, human+SoD authorized, NEVER executed (API-P8) ─────
const instr = preparePaymentInstruction({ id: 'p1', tenantId: 'SOC-1', rail: 'NEFT', amountMinor: 250000, beneficiaryRef: 'mandate-xyz', preparedBy: 'clerk-1' });
ok(instr.status === 'prepared' && instr.currency === 'INR' && instr.amountMinor === 250000, 'a payment is prepared with exact money + explicit currency');
let threw = false;
try { preparePaymentInstruction({ id: 'p2', tenantId: 'SOC-1', rail: 'CHEQUE', amountMinor: 100, beneficiaryRef: 'b', preparedBy: 'c' }); } catch { threw = true; }
ok(threw, 'an unknown rail is rejected');
let threw2 = false;
try { preparePaymentInstruction({ id: 'p3', tenantId: 'SOC-1', rail: 'UPI', amountMinor: 0, beneficiaryRef: 'b', preparedBy: 'c' }); } catch { threw2 = true; }
ok(threw2, 'a non-positive amount is rejected');
const selfAuth = authorizePayment(instr, { id: 'clerk-1', isHuman: true });
ok(!selfAuth.ok && /separation of duties/.test(selfAuth.reason), 'the preparer cannot authorize the payment (SoD)');
const botAuth = authorizePayment(instr, { id: 'bot-1', isHuman: false });
ok(!botAuth.ok && /never autonomous/.test(botAuth.reason), 'a non-human cannot authorize a payment — never autonomous (API-P8)');
const authd = authorizePayment(instr, { id: 'manager-1', isHuman: true });
ok(authd.ok && authd.instruction.status === 'authorized' && authd.instruction.authorizedBy === 'manager-1', 'an independent human authorizes the payment');
// there is NO execute path — money never moves in this system.
ok(PAY.executePayment === undefined && PAY.settlePayment === undefined,
  'there is deliberately no execute/settle export — SahakarLekha is not a PSP/custodian (BANK-1)');

// ── 4. PURITY ────────────────────────────────────────────────────────────────
for (const [file, sub] of [['statement.ts', 'statement'], ['payment.ts', 'payment']]) {
  const code = readFileSync(pathResolve(SRC, 'lib', 'api', 'bank', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
    ok(!code.includes(forbidden), `bank/${sub} is pure & does no I/O (no "${forbidden}")`);
  }
}

console.log(`\nBanking adapters — prepare-only: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

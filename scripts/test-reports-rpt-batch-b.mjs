// RPT-09/12/14/15/16 (product audit 2026-11-17) — reports batch B.
// Run: node scripts/test-reports-rpt-batch-b.mjs
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
    if (url === SUPABASE) return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' };
    return next(url, ctx);
  }
`));
const imp = (rel) => import(pathToFileURL(pathResolve(ROOT, rel)).href);
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── RPT-16: schedule placement by subtype ──
{
  const s = read('src/lib/auditScheduleTie.ts');
  ok(s.includes("'sch-I': (a, under) => a.subtype === 'share_capital' ||") && s.includes("'sch-II': (a, under) => RESERVE_SUBTYPES.has(a.subtype || '') ||") && s.includes("'sch-III': (a, under) => a.subtype === 'long_term_loan' ||"), 'share capital / reserves / borrowings are placed by subtype first, group id only as fallback');
  ok(s.includes('return s.accountIds.includes(a.id) || s.accountIds.some((id) => underOf(a)(id));'), 'an account line covers its sub-ledgers too');
}

// ── RPT-12: challan TDS part ──
{
  const C = await imp('src/lib/tax/challanPosting.ts');
  ok(C.challanTdsPart({ amount: 5120, interestAmount: 100, otherAmount: 20 }) === 5000 && C.challanTdsPart({ amount: 5000 }) === 5000 && C.challanTdsPart({ amount: 50, interestAmount: 80 }) === 0, 'TDS deposited = total − interest − late fee (never below 0)');
  const tr = read('src/pages/TdsRegister.tsx');
  ok(tr.includes('reduce((s, c) => s + challanTdsPart(c) * 100, 0)') && !tr.includes('.reduce((s, c) => s + c.amount, 0)'), 'the register\'s "Deposited" card counts only the TDS part');
  ok(tr.includes('interestAmount: challanInterest || 0,') && tr.includes("const { interestAmount, otherAmount, ...baseChallan } = challan;") && tr.includes(".update({ interestAmount, otherAmount }).eq('id', challanId)"), 'interest / other are saved on the challan in a second update (RULE 1: the base row saves before migration 190)');
  const m = read('supabase/migrations/190_tds_challan_interest_other.sql');
  ok(m.includes('alter table public.tds_challans add column if not exists "interestAmount" numeric not null default 0;') && m.includes('"otherAmount" numeric not null default 0') && /values \('190', /.test(m), 'migration 190 adds the two columns and registers itself');
  ok(read('src/types/index.ts').includes('interestAmount?: number;\n  otherAmount?: number;\n  bankName: string;'), 'TdsChallan carries them');
}

// ── RPT-14: no-PAN rate ──
{
  const N = await imp('src/lib/rules/noPanRate.ts');
  ok(N.noPanRatePct('194Q', 0.1, '2026-06-01') === 5 && N.noPanRatePct('194C', 2, '2026-06-01') === 20 && N.noPanRatePct('194J', 30, '2026-06-01') === 30, 'higher of the section rate and 5% (Table 8(ii) — 194Q) or 20% (other cases)');
  ok(N.noPanRatePct('194Q', 0.1, '2025-12-01') === null, 'before 01-04-2026 there is no sourced value — no guess');
  ok(N.isValidPan('ABCDE1234F') && !N.isValidPan('') && !N.isValidPan('ABCD1234F'), 'PAN shape check');
  ok(N.NO_PAN_CITE.includes('s.397(2)(b)(i)') && N.NO_PAN_CITE.includes('incometaxindia.gov.in/web/guest/w/section-397-5') && N.NO_PAN_CITE.includes('2026-11-14'), 'the rate carries its source (the same reading as the partner payouts)');
  const adv = read('src/lib/tax/purchaseTdsAdvice.ts');
  ok(adv.includes("noPanRatePct('194Q', a.ratePct, args.bill.date)") && adv.includes('billTdsMinor: Math.round((billTdsMinor * npRate) / a.ratePct) as Minor'), 'the 194Q advice shows the no-PAN rate and this bill\'s TDS at it');
  const pm = read('src/pages/PurchaseManagement.tsx');
  ok(pm.includes('supplierPan: supplierId ? supplierPan(suppliers.find(s => s.id === supplierId)) : undefined,') && pm.includes('tdsAdvice.noPan.ratePct'), 'the purchase form passes the supplier PAN and warns');
}

// ── RPT-15: Form 16A ──
{
  const f = read('src/pages/TdsForm16A.tsx');
  ok(f.includes("useState(society.entityPan || '')") && f.includes("useState(society.tan || '')"), 'deductor PAN / TAN prefilled from the society');
  ok(f.includes('fyOptions.map(fy =>') && !f.includes("['2022-23', '2023-24', '2024-25', '2025-26']"), 'the FY list follows the society year (current FY selectable)');
  ok(f.includes('const party = purchaseTdsParty(suppliers.find(x => x.id === p.supplierId));') && f.includes("'Bill No.', 'Deductee', 'PAN', 'Section'"), 'each entry shows bill no., deductee PAN and section');
  ok(f.includes('const rows = filtered.map(rowOf);') && !f.includes('const rows = tdsEntries.map('), 'CSV / Excel honour the supplier filter');
  ok(f.includes('NOT the TRACES certificate') && !f.includes('Section 203 of Income Tax Act, 1961'), 'labelled honestly — a statement, not the TRACES certificate');
}

// ── RPT-09: tax head vs place of supply ──
{
  const G = await imp('src/lib/gstStates.ts');
  ok(G.taxHeadMismatch(G.isInterState('06', '27AAAAA0000A1Z5'), { cgst: 9, sgst: 9 }) === true, 'Haryana society, Maharashtra customer, CGST+SGST typed → flagged');
  ok(G.taxHeadMismatch(G.isInterState('06', '06AAAAA0000A1Z5'), { cgst: 9, sgst: 9 }) === false, 'same state, CGST+SGST → fine');
  for (const p of ['src/pages/SaleManagement.tsx', 'src/pages/PurchaseManagement.tsx']) {
    const s = read(p);
    ok(s.includes('const inter = isInterState(sc, party?.gstin || party?.gstNo, party?.state || party?.placeOfSupply);') && s.includes('taxHeadMismatch(inter, { cgst: cgstPct, sgst: sgstPct, igst: igstPct })'), `${p}: warns when the typed tax head disagrees with the place of supply`);
  }
  ok(read('src/pages/GstSummary.tsx').includes("sply_ty: r.igst > 0.005 ? 'INTER' : 'INTRA',"), 'GSTR-1 B2CS rows carry their own supply type (was always INTRA)');
}

console.log(`Reports RPT batch B: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

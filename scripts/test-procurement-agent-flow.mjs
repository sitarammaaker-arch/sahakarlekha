// MSP agent flow (lot → J-Form → post → settle → pay → commission → agency receipt). Imports the REAL
// src/lib/procurement/{accounts,agentFlow,postingRules}.ts and src/lib/domainAccounts/provisioning.ts
// via the '@/' loader.
// Run: node scripts/test-procurement-agent-flow.mjs   (exit 1 on any failure)
process.env.TZ = 'Asia/Kolkata';   // business-date tests are about the IST day
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const A = await import(abs('../src/lib/procurement/accounts.ts'));
const F = await import(abs('../src/lib/procurement/agentFlow.ts'));
const { resolvePostingLegs } = await import(abs('../src/lib/procurement/postingRules.ts'));
const P = await import(abs('../src/lib/domainAccounts/provisioning.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const acc = (id, name, type, extra = {}) => ({ id, name, nameHi: '', type, openingBalance: 0, openingBalanceType: type === 'asset' || type === 'expense' ? 'debit' : 'credit', isGroup: false, ...extra });
const grp = (id, name, type) => acc(id, name, type, { isGroup: true });
const money = (n) => ({ amount: n, currency: 'INR' });

// Charts. CMS carries the MSP ledgers; PACS has none; sugar has no 4200 group and its 2205 is a cess.
const GROUPS = [grp('2100', 'Current Liabilities', 'liability'), grp('3300', 'Current Assets', 'asset'), grp('4000', 'Income', 'income'), grp('4400', 'Other Income', 'income')];
const CMS = [...GROUPS, grp('4200', 'Commission Income', 'income'),
  acc('3308', 'MSP Receivable', 'asset'), acc('2105', 'MSP Payable to Farmers', 'liability'),
  acc('3314', 'Commission Receivable', 'asset'), acc('4206', 'Procurement Commission', 'income'),
  acc('2202', 'TDS Payable', 'liability'), acc('2205', 'HRDF Payable', 'liability'), acc('2102', 'Expenses Payable', 'liability'),
  acc('4202', 'Market Fee', 'income'), acc('4203', 'Labor Charges', 'income')];
const PACS = [...GROUPS, grp('4200', 'Commission / Service Income', 'income'), acc('3301', 'Cash in Hand', 'asset')];
const SUGAR = [...GROUPS, acc('2205', 'Cane Development Cess', 'liability'), acc('3301', 'Cash in Hand', 'asset')];
const MSP = new Set(['procurement_msp']);

// ── 1. Finding 1 — MSP ledgers resolve per chart; PACS/sugar can be provisioned ────────────────
{
  ok(A.resolveProcurementAccountId(CMS, 'agencyReceivable') === '3308', 'CMS: agency receivable = 3308');
  ok(A.resolveProcurementAccountId(CMS, 'farmerPayable') === '2105', 'CMS: farmer payable = 2105');
  ok(A.resolveProcurementAccountId(CMS, 'commissionIncome') === '4206', 'CMS: commission income = 4206');
  ok(A.resolveProcurementAccountId(PACS, 'agencyReceivable') === null, 'PACS: no MSP receivable (the reported failure)');
  ok(Object.keys(A.procurementPostingBinding(PACS)).length === 0, 'PACS: empty binding → posting refuses with a clear message');
  ok(resolvePostingLegs('RecogniseProcurement', money(1000), 'agency', A.procurementPostingBinding(PACS), PACS).length === 0, 'PACS before provisioning: no legs (blocked, not mis-posted)');
  ok(A.missingProcurementRoles(PACS, ['agencyReceivable', 'farmerPayable']).join() === 'agencyReceivable,farmerPayable', 'missing roles named precisely');

  // Same id, wrong meaning → never matched (type-checked).
  const clash = [acc('3308', 'Something Else', 'liability')];
  ok(A.resolveProcurementAccountId(clash, 'agencyReceivable') === null, 'template id with the wrong type is NOT the MSP receivable');
  // Hand-made / UUID ledger is honoured by name.
  const uuid = [acc('u-1', 'MSP Receivable (HAFED)', 'asset'), acc('u-2', 'किसानों को देय MSP', 'liability', { nameHi: 'किसानों को देय MSP' })];
  ok(A.resolveProcurementAccountId(uuid, 'agencyReceivable') === 'u-1', 'name hint resolves a UUID ledger');
  ok(A.resolveProcurementAccountId(uuid, 'farmerPayable') === 'u-2', 'Hindi name hint resolves a UUID ledger');
  ok(A.resolveProcurementAccountId([grp('3308', 'MSP Receivable', 'asset')], 'agencyReceivable') === null, 'a group account never resolves');
  const legs = resolvePostingLegs('RecogniseProcurement', money(1000), 'agency', A.procurementPostingBinding(uuid), uuid);
  ok(legs.length === 2 && legs[0].resolvedAccountId === 'u-1' && legs[1].resolvedAccountId === 'u-2', 'posting uses the society-resolved ledgers (Dr receivable / Cr payable)');

  // Provisioning (Ledger Hygiene → "डोमेन खाते बनाएँ").
  const specs = P.DOMAIN_ACCOUNT_SPECS.filter(s => s.capability === 'procurement_msp');
  ok(specs.length === 4, '4 MSP specs');
  ok(P.planMissingDomainAccounts(CMS, MSP).length === 0, 'CMS chart: nothing to create');
  ok(P.planMissingDomainAccounts(PACS, new Set()).length === 0, 'no procurement_msp capability → nothing planned');
  const plan = P.planMissingDomainAccounts(PACS, MSP);
  ok(plan.length === 4, 'PACS: all 4 MSP ledgers planned');
  const made = plan.map(s => P.materialiseDomainAccount(s, PACS));
  ok(made.map(m => m.id).join() === '3308,2105,3314,4206', 'PACS: created with the conventional ids (fixed-id reports tie out)');
  const pacsAfter = [...PACS, ...made.map(m => ({ ...m.template, id: m.id }))];
  ok(P.planMissingDomainAccounts(pacsAfter, MSP).length === 0, 'idempotent: nothing left to plan after provisioning');
  const legs2 = resolvePostingLegs('RecogniseProcurement', money(500), 'agency', A.procurementPostingBinding(pacsAfter), pacsAfter);
  ok(legs2.length === 2 && legs2[0].resolvedAccountId === '3308' && legs2[1].resolvedAccountId === '2105', 'PACS after provisioning posts Dr 3308 / Cr 2105');

  const sugarPlan = P.planMissingDomainAccounts(SUGAR, MSP);
  const inc = sugarPlan.find(s => s.key === 'procurement.commissionIncome');
  ok(P.materialiseDomainAccount(inc, SUGAR).template.parentId === '4400', 'sugar (no 4200 group): commission income re-homed under 4400');
  const taken = [...PACS, acc('3308', 'Old suspense', 'liability')];
  const recvSpec = P.planMissingDomainAccounts(taken, MSP).find(s => s.key === 'procurement.agencyReceivable');
  ok(P.materialiseDomainAccount(recvSpec, taken).id === undefined, 'id already used by another ledger → fresh UUID, never overwrite');
  const diag = P.diagnoseDomainAccounts(PACS, [], MSP);
  ok(diag.filter(r => r.capability === 'procurement_msp' && r.status === 'missing').length === 4, 'Ledger Hygiene card lists the 4 missing MSP ledgers');
}

// ── 2. Finding 2 — deduction accounts: liabilities suggested, income flagged ───────────────────
{
  ok(F.suggestDeductionAccountId('tds', CMS) === '2202', 'TDS → TDS Payable');
  ok(F.suggestDeductionAccountId('hrdf', CMS) === '2205', 'HRDF → HRDF Payable (by name)');
  ok(F.suggestDeductionAccountId('market_fee', CMS) === '2102', 'मंडी शुल्क → Expenses Payable (no dedicated payable) — not 4202 income');
  ok(F.suggestDeductionAccountId('labour', CMS) === '2102', 'हमाली → Expenses Payable — not 4203 income');
  ok(F.suggestDeductionAccountId('hrdf', SUGAR) === null, 'sugar 2205 is Cane Development Cess → NOT suggested for HRDF');
  const ded = [...CMS, acc('u-mf', 'Market Fee Payable', 'liability')];
  ok(F.suggestDeductionAccountId('market_fee', ded) === 'u-mf', 'a dedicated Market Fee Payable wins');
  ok(F.suggestDeductionAccountId('bardana', CMS) === null, 'no suggestion for bases that are not third-party');
  ok(F.deductionAccountWarning('market_fee', { type: 'income' }) === 'income_for_third_party', 'मंडी शुल्क → income account is flagged');
  ok(F.deductionAccountWarning('labour', { type: 'income' }) === 'income_for_third_party', 'हमाली → income account is flagged');
  ok(F.deductionAccountWarning('hrdf', { type: 'asset' }) === 'not_liability', 'HRDF → asset account is flagged');
  ok(F.deductionAccountWarning('market_fee', { type: 'liability' }) === null, 'payable is fine');
  ok(F.deductionAccountWarning('commission', { type: 'income' }) === null, 'commission (आढ़त) as income is NOT flagged');
  ok(F.deductionAccountWarning(undefined, { type: 'income' }) === null, 'no basis → no warning');
}

// ── 3. Finding 3 — business date = J-Form (IST) day, not the click day ─────────────────────────
{
  ok(F.localDateOf('2026-03-31T20:00:00.000Z') === '2026-04-01', 'IST day of a late-UTC timestamp (01:30 IST, 1 April)');
  ok(F.localDateOf('2026-03-31T10:00:00.000Z') === '2026-03-31', 'same-day timestamp');
  ok(F.procurementBusinessDate('2026-03-20T05:00:00.000Z', '2026-03-19T05:00:00.000Z', '2026-04-04') === '2026-03-20', 'J-Form date wins over today (March J-Form stays in March / old FY)');
  ok(F.procurementBusinessDate(undefined, '2026-03-19T05:00:00.000Z', '2026-04-04') === '2026-03-19', 'falls back to the lot date');
  ok(F.procurementBusinessDate(undefined, undefined, '2026-04-04') === '2026-04-04', 'falls back to today');
  ok(F.localDateOf('garbage') === null, 'bad timestamp → null');
}

// ── 4. Finding 4 + 7 — rejected lots and the stage badge ─────────────────────────────────────
{
  ok(F.isRejectedQuality('rejected') && !F.isRejectedQuality('accepted') && !F.isRejectedQuality('accepted_with_cut') && !F.isRejectedQuality(undefined), 'only "rejected" blocks');
  const st = (x) => F.deriveLotStage({ hasJForm: false, hasPosting: false, ...x });
  ok(st({}) === 'new', 'stage: new');
  ok(st({ qualityResult: 'accepted' }) === 'inspected', 'stage: inspected');
  ok(st({ qualityResult: 'rejected', hasJForm: true, hasPosting: true }) === 'rejected', 'stage: rejected wins over everything');
  ok(st({ hasJForm: true }) === 'jform', 'stage: J-Form');
  ok(st({ hasJForm: true, hasPosting: true }) === 'posted', 'stage: posted');
  ok(st({ hasPosting: true, settlementStatus: 'draft' }) === 'settlementDraft', 'stage: settlement draft');
  ok(st({ hasPosting: true, settlementStatus: 'approved', outstanding: 10 }) === 'approved', 'stage: payment due');
  ok(st({ hasPosting: true, settlementStatus: 'approved', outstanding: 0 }) === 'paid', 'stage: paid');
  ok(Object.values(F.LOT_STAGE_LABEL).every(l => l.hi && l.en) && !Object.values(F.LOT_STAGE_LABEL).some(l => l.hi === 'created'), 'every stage has a Hindi label (no raw "created")');
}

// ── 5. Finding 5 — per-agency receivables + over-receipt cap ──────────────────────────────────
{
  const v = (id, refType, refId, accountId, side, amount, extra = {}) => ({ id, refType, refId, amount, debitAccountId: '', creditAccountId: '', lines: [{ id: id + 'l', accountId, type: side, amount }], ...extra });
  const results = [{ id: 'R-A', lotId: 'L-A' }, { id: 'R-B', lotId: 'L-B' }, { id: 'R-C', lotId: 'L-C' }];
  const lots = [{ id: 'L-A', centreId: 'C-1' }, { id: 'L-B', centreId: 'C-2' }, { id: 'L-C', centreId: 'SOC-STUB' }];
  const centres = [{ id: 'C-1', agencyId: 'AG-1' }, { id: 'C-2', agencyId: 'AG-2' }];
  const agencyIds = new Set(['AG-1', 'AG-2']);
  const vouchers = [
    v('EV-A', 'posting.rule.result', 'R-A', '3308', 'Dr', 1000),
    v('EV-B', 'posting.rule.result', 'R-B', '3308', 'Dr', 500),
    v('EV-C', 'posting.rule.result', 'R-C', '3308', 'Dr', 200),             // lot without a centre
    v('PAY-A', 'farmer.payment', 'EV-A', '3308', 'Cr', 300),                 // agency paid farmer directly
    v('RC-1', F.AGENCY_RECEIPT_REF_TYPE, 'AG-1', '3308', 'Cr', 400),
    v('RC-OLD', F.AGENCY_RECEIPT_REF_TYPE, undefined, '3308', 'Cr', 100),    // receipt before agencies were named
    v('RC-DEL', F.AGENCY_RECEIPT_REF_TYPE, 'AG-2', '3308', 'Cr', 999, { isDeleted: true }),
    v('RC-REJ', F.AGENCY_RECEIPT_REF_TYPE, 'AG-2', '3308', 'Cr', 999, { approvalStatus: 'rejected' }),
    v('CM-A', F.COMMISSION_ACCRUAL_REF_TYPE, 'L-A', '3314', 'Dr', 50),
    v('CR-A', F.COMMISSION_RECEIPT_REF_TYPE, 'AG-1', '3314', 'Cr', 20),
  ];
  const b = F.agencyBalances({ vouchers, accountId: '3308', postingRuleResults: results, lots, centres, agencyIds });
  ok(b.byAgency['AG-1'] === 300, 'AG-1 MSP = 1000 − 300 paid directly − 400 received');
  ok(b.byAgency['AG-2'] === 500, 'AG-2 MSP = 500 (deleted / rejected receipts ignored)');
  ok(b.unallocated === 100, 'unallocated = centre-less lot 200 − legacy receipt 100');
  ok(b.total === 900, 'total MSP receivable = 900');
  ok(F.receiptCap(b, 'AG-1') === 300, 'AG-1 cannot receive more than 300');
  ok(F.receiptCap(b, 'AG-2') === 500, 'AG-2 cap 500');
  ok(F.receiptCap(b) === 900, 'no agency → capped at the society total');
  ok(F.receiptCap({ total: 250, byAgency: { 'AG-2': 500 }, unallocated: -250 }, 'AG-2') === 250, 'agency share capped by the society total (legacy receipts)');
  ok(F.receiptCap({ total: -5, byAgency: {}, unallocated: -5 }) === 0, 'over-received already → cap 0, never negative');
  const c = F.agencyBalances({ vouchers, accountId: '3314', postingRuleResults: results, lots, centres, agencyIds });
  ok(c.byAgency['AG-1'] === 30 && c.total === 30, 'commission receivable now has a receipt path: 50 accrued − 20 received');
  const unknown = F.agencyBalances({ vouchers: [v('X', F.AGENCY_RECEIPT_REF_TYPE, 'AG-GONE', '3308', 'Cr', 10)], accountId: '3308', postingRuleResults: [], lots: [], centres: [], agencyIds });
  ok(unknown.unallocated === -10 && Object.keys(unknown.byAgency).length === 0, 'a receipt naming a deleted agency is unallocated');
  const sv = [v('EV-A', 'posting.rule.result', 'R-A', '3308', 'Dr', 1000), v('SD', 'farmer.settlement', 'S-1', '3308', 'Cr', 10)];
  const sb = F.agencyBalances({ vouchers: sv, accountId: '3308', postingRuleResults: results, settlements: [{ id: 'S-1', engineVoucherId: 'EV-A' }], lots, centres, agencyIds });
  ok(sb.byAgency['AG-1'] === 990, 'settlement voucher traced through its engine voucher');
}

// ── 6. Finding 7 — farmer code from the server counter, never a duplicate ──────────────────────
{
  const seq = (ns) => { const q = [...ns]; return async () => (q.length ? q.shift() : null); };
  ok(F.formatFarmerCode(7) === 'F0007', 'format F0007');
  ok(await F.allocateFarmerCode(seq([1]), new Set()) === 'F0001', 'fresh society → F0001');
  ok(await F.allocateFarmerCode(seq([1, 2, 3]), new Set(['F0001', 'F0002'])) === 'F0003', 'codes issued by older clients are skipped');
  ok(await F.allocateFarmerCode(seq([5]), new Set(['F0001', 'F0002'])) === 'F0005', 'a counter already ahead is used as-is');
  ok(await F.allocateFarmerCode(seq([null]), new Set()) === null, 'counter unavailable → null (no farmer, no duplicate)');
  ok(await F.allocateFarmerCode(seq([1, 1, 1]), new Set(['F0001']), 3) === null, 'bounded retries');
  // Two devices with the same stale list: the counter hands them different numbers.
  let n = 2; const shared = async () => ++n;
  const [d1, d2] = await Promise.all([F.allocateFarmerCode(shared, new Set(['F0001', 'F0002'])), F.allocateFarmerCode(shared, new Set(['F0001', 'F0002']))]);
  ok(d1 && d2 && d1 !== d2, 'two devices never get the same code');
}

console.log(`[procurement-agent-flow] ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

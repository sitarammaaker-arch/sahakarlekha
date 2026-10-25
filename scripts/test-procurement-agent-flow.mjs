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

// ── 7. Batch A (P0-1) — farmer amount paid is DERIVED from the payment vouchers ────────────────────
{
  const pay = (id, ev, amount, extra = {}) => ({ id, refType: F.FARMER_PAYMENT_REF_TYPE, refId: ev, amount, ...extra });
  const vs = [
    pay('P1', 'EV-1', 1000.10), pay('P2', 'EV-1', 500.20),
    pay('P3', 'EV-1', 999, { isDeleted: true }),                 // cancelled → not paid
    pay('P4', 'EV-1', 777, { approvalStatus: 'rejected' }),     // rejected → not paid
    pay('P5', 'EV-1', 100, { approvalStatus: 'pending' }),      // held → counts (blocks a second payment)
    pay('P6', 'EV-2', 250),
    { id: 'X', refType: 'farmer.settlement', refId: 'EV-1', amount: 50 },   // not a payment
  ];
  const m = F.farmerPaidByEngineVoucher(vs);
  ok(m.get('EV-1') === 1600.3, 'paid = Σ live payments, paise-exact (1000.10 + 500.20 + 100 pending)');
  ok(m.get('EV-2') === 250 && !m.has('EV-3'), 'per engine voucher; none → absent');
  // The F5 double-payment case: the stored cache never advanced (its write failed) but the voucher exists.
  const stale = [{ id: 'S1', engineVoucherId: 'EV-1', netPayable: { amount: 1600.3, currency: 'INR' }, amountPaid: { amount: 0, currency: 'INR' } }];
  const view = F.withDerivedAmountPaid(stale, m);
  ok(view[0].amountPaid.amount === 1600.3, 'stale cache 0 → derived 1600.30: outstanding is 0, no second payment');
  const same = [{ id: 'S2', engineVoucherId: 'EV-2', amountPaid: { amount: 250, currency: 'INR' } }];
  ok(F.withDerivedAmountPaid(same, m)[0] === same[0], 'cache already right → same object (no re-render churn)');
  ok(F.withDerivedAmountPaid([{ id: 'S3', engineVoucherId: 'EV-9', amountPaid: { amount: 40, currency: 'INR' } }], m)[0].amountPaid.amount === 0, 'payment voucher cancelled → paid drops back to 0');
}

// ── 8. Batch A (P1-3) — quality only BEFORE the J-Form ───────────────────────────────────────────
{
  ok(F.canRecordQuality({ hasQualityTest: false, hasJForm: false }) === true, 'new lot → quality allowed');
  ok(F.canRecordQuality({ hasQualityTest: false, hasJForm: true }) === false, 'J-Form issued → quality locked (no stranded posted lot)');
  ok(F.canRecordQuality({ hasQualityTest: true, hasJForm: false }) === false, 'already tested → no second test');
}

// ── 9. Batch A — "agency paid directly" credits only the agency receivable ──────────────────────────
{
  const accs = [
    { id: '3301', type: 'asset' }, { id: '3403', type: 'asset' }, { id: '3101', type: 'asset' },
    { id: '3308', type: 'asset' }, { id: 'AG-HSWC', type: 'asset', parentId: '3308' },
    { id: 'GRP', type: 'asset', parentId: '3308', isGroup: true },
  ];
  const ids = F.agencyDirectAccounts(accs, '3308').map(a => a.id);
  ok(ids.join(',') === '3308,AG-HSWC', 'receivable + ledgers under it only (no cash / stock / fixed asset / group)');
  ok(F.agencyDirectAccounts(accs, null).length === 0, 'no receivable in the chart → nothing to pick');
}

// ── 10. Batch A — source guards on DataContext (no runnable harness for the context) ──────────────
{
  const { readFileSync } = await import('node:fs');
  const dc = readFileSync(pathResolve(SRC, 'contexts', 'DataContext.tsx'), 'utf8');
  const body = (name) => { const i = dc.indexOf(`const ${name} = useCallback(`); return i < 0 ? '' : dc.slice(i, dc.indexOf('\n  }, [', i)); };
  // P1-1: each posting step looks its input up in the synchronous ref, never in render-time state.
  ok(/procurementIntentsRef\.current\.find\(/.test(body('generatePostingRequest')), 'Posting Request reads the intent from the ref');
  ok(/procurementRequestsRef\.current\.find\(/.test(body('generatePostingRuleResult')), 'Rule Result reads the request from the ref');
  ok(/procurementRuleResultsRef\.current\.find\(/.test(body('generateEngineVoucher')), 'Engine Voucher reads the result from the ref');
  ok(!/procurementFinancialIntents\.find\(/.test(body('generatePostingRequest')), 'no stale-state lookup left in generatePostingRequest');
  for (const g of ['generateFinancialIntent', 'generatePostingRequest', 'generatePostingRuleResult']) {
    ok(/opts\?\.onCommitted\?\.\(/.test(body(g)) && /opts\?\.onFailed\?\.\(/.test(body(g)), `${g} reports commit / failure to the chain`);
  }
  // P0-1: outstanding before a payment comes from the vouchers, not the stored cache.
  const pay = body('recordFarmerPayment');
  ok(/farmerPaidByEngineVoucher\(vouchersRef\.current\)/.test(pay), 'payment outstanding derived from the payment vouchers');
  ok(!/toMinor\(stl\.amountPaid\.amount\)/.test(pay), 'payment never trusts the stored amountPaid');
  // P0-2: approval is committed only after its deduction voucher saved; a failed voucher reverts to draft.
  const appr = body('approveFarmerSettlement');
  ok(/onSaved: \(\) => commitApproval\(\)/.test(appr) && /onFailed: \(\) => \{\s*revertLocal\(\)/.test(appr), 'approval waits for the voucher save; failure reverts to draft');
  ok(/cancelVoucher\(settlementVoucherId, .*\{ viaParent: true \}\)/.test(appr), 'auto-rollback cancel passes the owner check');
  // P1-4: the approved settlement owns its deduction voucher.
  ok(/registerVoucherOwner\('procurement'/.test(dc), 'procurement voucher owner registered');
  // P1-3: quality refused once the J-Form exists.
  ok(/canRecordQuality\(/.test(body('recordQualityInspection')), 'quality inspection checks the J-Form gate');
  // Context hands pages the voucher-derived settlements.
  ok(/procurementSettlements: procurementSettlementsView/.test(dc), 'context exposes the derived settlement view');
}

// ── 11. Batch B — lot business date + lot cancellation ────────────────────────────────────────────
{
  ok(F.procurementBusinessDate('2026-04-10T05:00:00Z', '2026-04-09T05:00:00Z', '2026-05-01', '2026-03-28') === '2026-03-28', 'lotDate wins (back-dated purchase)');
  ok(F.procurementBusinessDate('2026-04-10T05:00:00Z', null, '2026-05-01', null) === '2026-04-10', 'no lotDate → J-Form day (unchanged)');
  ok(F.procurementBusinessDate(null, null, '2026-05-01', 'garbage') === '2026-05-01', 'malformed lotDate ignored');
  ok(F.deriveLotStage({ cancelled: true, qualityResult: 'accepted', hasJForm: true, hasPosting: true, settlementStatus: 'approved', outstanding: 0 }) === 'cancelled', 'cancelled stage wins over every other');
  ok(F.isLotCancelled({ cancelledAt: '2026-10-25T10:00:00Z' }) && !F.isLotCancelled({}) && !F.isLotCancelled(null), 'isLotCancelled');
  const base = { cancelled: false, reason: 'गलत मात्रा', farmerPaid: 0, postedAmount: 48500, mspReceivable: 48500, commissionAccrued: 970, commissionReceivable: 970 };
  ok(F.lotCancelBlockers(base).length === 0, 'nothing moved → cancel allowed');
  ok(F.lotCancelBlockers({ ...base, reason: '  ' }).includes('no_reason'), 'reason required');
  ok(F.lotCancelBlockers({ ...base, farmerPaid: 100 }).includes('farmer_paid'), 'farmer already paid → blocked');
  ok(F.lotCancelBlockers({ ...base, mspReceivable: 10000 }).includes('agency_receipts'), 'agency money received beyond what stays → blocked');
  ok(F.lotCancelBlockers({ ...base, mspReceivable: 60000 }).length === 0, 'receivable still covers the lot → allowed');
  ok(F.lotCancelBlockers({ ...base, commissionReceivable: 0 }).includes('commission_received'), 'commission already received → blocked');
  ok(F.lotCancelBlockers({ ...base, postedAmount: 0, mspReceivable: 0, commissionAccrued: 0, commissionReceivable: 0 }).length === 0, 'unposted lot → allowed');
  ok(F.lotCancelBlockers({ ...base, cancelled: true }).join() === 'already_cancelled', 'already cancelled');
  for (const k of ['already_cancelled', 'no_reason', 'farmer_paid', 'agency_receipts', 'commission_received']) ok(!!F.LOT_CANCEL_BLOCKER_TEXT[k], `Hindi text for ${k}`);
  // The engine reversal is traced to the lot's agency, so the per-agency balance nets to zero.
  const vv = (id, refType, refId, acc, type, amt) => ({ id, refType, refId, amount: amt, lines: [{ id: id + 'l', accountId: acc, type, amount: amt }] });
  const b = F.agencyBalances({
    vouchers: [vv('EV', 'posting.rule.result', 'R1', '3308', 'Dr', 48500), vv('REV', F.ENGINE_REVERSAL_REF_TYPE, 'R1', '3308', 'Cr', 48500)],
    accountId: '3308', postingRuleResults: [{ id: 'R1', lotId: 'L1' }], lots: [{ id: 'L1', centreId: 'C1' }], centres: [{ id: 'C1', agencyId: 'AG' }], agencyIds: new Set(['AG']),
  });
  ok(b.total === 0 && (b.byAgency.AG ?? 0) === 0 && b.unallocated === 0, 'reversal nets the agency to 0 (not "unallocated")');
}

// ── 12. Batch B — source guards on the cancel cascade ─────────────────────────────────────────────
{
  const { readFileSync } = await import('node:fs');
  const dc = readFileSync(pathResolve(SRC, 'contexts', 'DataContext.tsx'), 'utf8');
  const i = dc.indexOf('const cancelProcurementLot = useCallback(');
  const cancel = dc.slice(i, dc.indexOf('\n  }, [', i));
  const at = (re) => cancel.search(re);
  ok(i > 0 && /guardFYLocked\(\)/.test(cancel) && /guardPermission\('delete'/.test(cancel), 'cancel: FY lock + delete permission');
  ok(at(/lotCancelBlockers\(/) < at(/from\('procurement_lots'\)/), 'blockers checked before anything is written');
  const lotWrite = at(/from\('procurement_lots'\)/);
  ok(lotWrite > 0 && lotWrite < at(/cancelVoucher\(/) && lotWrite < at(/reverseVoucher\(/), 'lot row (the authority) written BEFORE the cascade');
  ok(/\.select\('id'\)/.test(cancel) && /!saved\?\.length/.test(cancel), 'a 0-row lot update (RLS / missing) is treated as failure');
  ok(/reverseVoucher\(ev\.id, [^\n]*\{ engine: \{ refType: ENGINE_REVERSAL_REF_TYPE, refId: rr\.id \} \}\)/.test(cancel), 'engine voucher corrected only by an engine reversal');
  ok(/isEngineVoucher\(current\) && !opts\?\.engine/.test(dc), 'reverseVoucher still blocks engine vouchers without the engine option');
  ok(!/reverseVoucher: \(id: string, reason: string, opts/.test(dc), 'the engine option is NOT exposed to pages');
  ok((dc.match(/if \(lotBlocked\(/g) || []).length >= 7, 'every chain step refuses a cancelled / rejected lot');
  ok(/if \(lot\.lotDate\) extras\.lotDate = lot\.lotDate;/.test(dc) && /from\('procurement_lots'\)\.update\(extras\)/.test(dc), 'lotDate written as a step-2 update (frozen RPC unchanged)');
  ok(/procurementBusinessDate\(jf\?\.createdAt, lot\?\.createdAt, todayStr\(\), lot\?\.lotDate\)/.test(dc), 'engine voucher dated with the lot date');
  const sql = readFileSync(pathResolve(SRC, '..', 'supabase', 'migrations', '135_procurement_lot_date_cancel.sql'), 'utf8');
  for (const col of ['lotDate', 'cancelledAt', 'cancelledBy', 'cancelReason']) ok(sql.includes(`add column if not exists "${col}"`), `migration 135 adds ${col}`);
}

// ── 13. D1 — agency ledger, 5116 route, commission basis, quality spec ─────────────────────────────
{
  const chart = [{ id: '3308', name: 'MSP Receivable' }, { id: '2105', name: 'MSP Payable to Farmers' }, { id: '5116', name: 'Govt Procurement Purchase' }, { id: 'HSWC', name: 'HSWC Sirsa' }];
  const amt = { amount: 1641725, currency: 'INR' };
  const plain = resolvePostingLegs('RecogniseProcurement', amt, 'agency', { 'agency.receivable': 'HSWC', 'farmer.payable': '2105' }, chart);
  ok(plain.length === 2 && plain[0].resolvedAccountId === 'HSWC' && plain[1].resolvedAccountId === '2105', 'agency ledger replaces 3308 (Dr HSWC / Cr 2105)');
  const via = resolvePostingLegs('RecogniseProcurement', amt, 'agency', { 'agency.receivable': 'HSWC', 'farmer.payable': '2105', 'procurement.via': '5116' }, chart, { via: true });
  ok(via.map(l => `${l.side} ${l.resolvedAccountId}`).join(',') === 'Dr 5116,Cr 2105,Dr HSWC,Cr 5116', '5116 route = Bacher\'s books (Dr 5116/Cr 2105 + Dr HSWC/Cr 5116)');
  ok(resolvePostingLegs('RecogniseProcurement', amt, 'agency', { 'agency.receivable': 'HSWC', 'farmer.payable': '2105' }, chart, { via: true }).length === 0, 'via asked but 5116 unbound → refuse ([])');
  const lines = (legs) => ({ amount: legs.filter(l => l.side === 'Dr').reduce((t, l) => t + l.amount.amount, 0), debitAccountId: '', creditAccountId: '', lines: legs.map((l, i) => ({ id: 'x' + i, accountId: l.resolvedAccountId, type: l.side, amount: l.amount.amount })) });
  const pv = F.procurementLegsOf(lines(via));
  ok(pv.value === 1641725 && pv.receivableAccountId === 'HSWC' && pv.payableAccountId === '2105', 'net legs: value = procurement value (not the doubled total), receivable HSWC, payable 2105');
  const pp = F.procurementLegsOf(lines(plain));
  ok(pp.value === 1641725 && pp.receivableAccountId === 'HSWC', 'net legs on a plain posting');
  // Commission
  ok(F.commissionAmount({ commissionRate: 55, commissionBasis: 'perQtl' }, { quantity: { value: 677 } }, 1641725) === 37235, 'dami ₹55/qtl × 677 qtl = 37,235');
  ok(F.commissionAmount({ commissionRate: 2.5 }, { quantity: { value: 677 } }, 1641725) === 41043.13, '2.5% of 16,41,725 = 41,043.13 (paise-rounded)');
  ok(F.commissionAmount({ commissionRate: 0 }, { quantity: { value: 1 } }, 100) === 0 && F.commissionAmount({}, {}, 100) === 0, 'no rate → no commission');
  // Quality spec
  const specs = [{ cropId: 'wheat', seasonId: 'rabi', parameter: 'Moisture', maxLimit: 12 }, { cropId: 'paddy', seasonId: 'x', parameter: 'नमी', maxLimit: 17 }, { cropId: 'wheat', seasonId: 'rabi', parameter: 'Foreign matter', maxLimit: 0.75 }];
  ok(F.moistureLimitFor(specs, 'wheat', 'rabi') === 12, 'moisture limit by crop + season');
  ok(F.moistureLimitFor(specs, 'paddy', 'other') === 17, 'falls back to any season of the crop (Hindi "नमी" matched)');
  ok(F.moistureLimitFor(specs, 'gram', 'rabi') === null, 'no spec → no limit');
  ok(F.qualityResultAllowed('accepted', 13, 12) === false, 'above the limit: plain "accepted" refused');
  ok(F.qualityResultAllowed('accepted_with_cut', 13, 12) && F.qualityResultAllowed('rejected', 13, 12), 'above the limit: with-cut / rejected allowed');
  ok(F.qualityResultAllowed('accepted', 13, null) && F.qualityResultAllowed('accepted', 11, 12), 'no limit, or within it → accepted ok');
  // Agency-direct payment accounts include agencies' own ledgers
  const accs = [{ id: '3308' }, { id: 'HSWC' }, { id: '3301' }];
  ok(F.agencyDirectAccounts(accs, '3308', ['HSWC', undefined]).map(a => a.id).join() === '3308,HSWC', 'own agency ledger offered, cash not');
}

// ── 14. D1 — source guards ───────────────────────────────────────────────────────────────────────
{
  const { readFileSync } = await import('node:fs');
  const rd = (...p) => readFileSync(pathResolve(SRC, ...p), 'utf8');
  const dc = rd('contexts', 'DataContext.tsx');
  const body = (name) => { const i = dc.indexOf(`const ${name} = useCallback(`); return i < 0 ? '' : dc.slice(i, dc.indexOf('\n  }, [', i)); };
  ok(/procurementQualityTests\.some\(q => q\.lotId === data\.lotId\)/.test(body('generateJForm')), 'J-Form refused without a quality test');
  ok(/binding\['agency\.receivable'\] = own\.id/.test(body('generatePostingRuleResult')) && /binding\['procurement\.via'\] = viaAcc\.id/.test(body('generatePostingRuleResult')), 'rule result binds the agency ledger and the 5116 route');
  ok(/onSaved: opts\.onSaved/.test(body('generateEngineVoucher')), 'engine voucher exposes onSaved');
  ok(/procurementLegsOf\(ev\)\.value/.test(body('createFarmerSettlement')), 'settlement gross = procurement value (net legs)');
  ok((body('approveFarmerSettlement') + body('recordFarmerPayment')).match(/procurementLegsOf\(ev\)\.payableAccountId/g)?.length === 2, 'payable found by net legs in approve + pay');
  const page = rd('pages', 'ProcurementLots.tsx');
  ok(/generateEngineVoucher\(\{ postingRuleResultId: rrId \}, \{ onSaved: autoCommission \}\)/.test(page), 'commission accrued automatically after the posting voucher saves');
  ok(/qualityResultAllowed\(qualityResult, m, qualityLimit\)/.test(page), 'quality dialog enforces the spec limit');
  const mk = rd('contexts', 'MarketingDataContext.tsx');
  ok(/upsert\(withSoc\(agencyBase\(agency\)\)\)/.test(mk) && /persistAgencyExtras\(agency\)/.test(mk), 'agency D1 columns are a step-2 write (RULE 1)');
  const sql = readFileSync(pathResolve(SRC, '..', 'supabase', 'migrations', '136_procurement_agency_ledger.sql'), 'utf8');
  for (const col of ['ledgerAccountId', 'commissionBasis', 'commissionIncomeAccountId', 'procurementVia5116']) ok(sql.includes(`"${col}"`), `migration 136 adds ${col}`);
}

// ── 15. D2a — deductions by unit, weighment, source guards ────────────────────────────────────────
{
  const x = { gross: 242500, qty: 100, bags: 200 };
  ok(F.deductionRuleAmount({ rate: { value: 2 } }, x) === 4850, '% rule: 2% of 2,42,500 = 4,850');
  ok(F.deductionRuleAmount({ rate: { value: 10.5 }, basisUnit: 'perQtl' }, x) === 1050, '₹10.50/qtl × 100 qtl = 1,050 (hamali)');
  ok(F.deductionRuleAmount({ rate: { value: 3.333 }, basisUnit: 'perBag' }, x) === 666.6, '₹3.333/bag × 200 bags = 666.60 (paise-rounded)');
  ok(F.deductionRuleAmount({ rate: { value: 5 }, basisUnit: 'perBag' }, { gross: 1000 }) === 0, 'per-bag rule on a lot with no bag count → 0 (page refuses)');
  ok(F.deductionRuleLabel({ rate: { value: 10 }, basisUnit: 'perQtl' }) === '₹10/qtl' && F.deductionRuleLabel({ rate: { value: 2 } }) === '2%', 'labels');
  ok(F.netWeight(101.25, 1.25) === 100 && F.netWeight(10, 10) === null && F.netWeight(null, 1) === null && F.netWeight(5, -1) === null, 'net = gross − tare; invalid → null');
  const { readFileSync } = await import('node:fs');
  const mk = readFileSync(pathResolve(SRC, 'contexts', 'MarketingDataContext.tsx'), 'utf8');
  ok(/const \{ basisUnit: _unit, \.\.\.recBase \} = rec;/.test(mk) && /persistRuleUnit\(rec, /.test(mk), 'deduction unit is a step-2 write');
  ok(/rollback\(\);\s*\n\s*toastRef\.current\(\{ title: 'कटौती नियम सेव नहीं हुआ'/.test(mk), 'a per-unit rule whose unit did not save is rolled back (never read as %)');
  const dc = readFileSync(pathResolve(SRC, 'contexts', 'DataContext.tsx'), 'utf8');
  ok(/if \(lot\.bags != null\) extras\.bags = lot\.bags;/.test(dc), 'weighment / bags are step-2 lot columns');
}

// ── 16. D2b — farmer bank details, bulk payment, prints ──────────────────────────────────────────
{
  ok(F.isValidIfsc('SBIN0001234') && F.isValidIfsc('sbin0001234') && F.isValidIfsc('') && F.isValidIfsc(undefined), 'IFSC valid (case-insensitive; empty allowed)');
  ok(!F.isValidIfsc('SBIN1001234') && !F.isValidIfsc('SBI0001234') && !F.isValidIfsc('SBIN000123'), 'IFSC: 5th char must be 0, 11 chars');
  ok(F.isValidBankAccount('123456') && F.isValidBankAccount('123456789012345678') && !F.isValidBankAccount('12345') && !F.isValidBankAccount('12A456'), 'account 6–18 digits');
  ok(F.maskAccount('30123456789') === 'XXXX6789' && F.maskAccount('') === '', 'account masked to last 4');
  const plan = F.planBulkPayment([{ engineVoucherId: 'A', outstanding: 1000.10 }, { engineVoucherId: 'B', outstanding: 0 }, { engineVoucherId: 'C', outstanding: 2500.20 }]);
  ok(plan.pay.length === 2 && plan.total === 3500.3, 'bulk: settled rows skipped, paise-exact total 3,500.30');
  ok(/^BULK-\d{8}-\d{4}$/.test(F.bulkBatchRef(new Date(2026, 9, 25, 9, 5))) && F.bulkBatchRef(new Date(2026, 9, 25, 9, 5)) === 'BULK-20261025-0905', 'batch reference format');
  const P = await import(abs('../src/lib/procurement/print.ts'));
  const farmer = { name: 'राम <b>', code: 'F0001', bankName: 'SBI', bankAccountMasked: 'XXXX6789', ifsc: 'SBIN0001234' };
  const jf = P.jformSlipHTML({ hi: true, societyName: 'Test Society', documentNo: 'J0007', date: '2026-04-15', farmer, crop: 'गेहूँ', quantity: 100, rate: 2425, value: 242500, bags: 200, grossWeight: 101, tareWeight: 1 });
  ok(jf.includes('J0007') && jf.includes('₹2,42,500.00') && jf.includes('XXXX6789') && jf.includes('200'), 'J-Form slip carries number, value, masked account, bags');
  ok(!jf.includes('राम <b>') && jf.includes('राम &lt;b&gt;'), 'J-Form slip escapes HTML');
  ok(/राज्य पोर्टल का निर्धारित J-Form/.test(jf), 'J-Form slip says it is the society\'s own slip, not the prescribed form');
  const ps = P.paymentSlipHTML({ hi: false, societyName: 'S', farmer, settlementNo: 'STL000003', gross: 242500, deductions: [{ label: 'Market fee', amount: 4850 }], netPayable: 237650, payments: [{ date: '2026-04-20', voucherNo: 'PV/9', amount: 200000, reference: 'BULK-1' }], outstanding: 37650 });
  ok(ps.includes('STL000003') && ps.includes('₹2,37,650.00') && ps.includes('BULK-1') && ps.includes('₹37,650.00'), 'payment slip: net, payment with batch ref, outstanding');
  const { readFileSync } = await import('node:fs');
  const dc = readFileSync(pathResolve(SRC, 'contexts', 'DataContext.tsx'), 'utf8');
  ok(/upsert\(withSoc\(farmerBase\(newFarmer\)\)\)/.test(dc) && /persistFarmerExtras\(newFarmer\)/.test(dc), 'farmer bank columns are a step-2 write');
  ok(/const updateFarmer = useCallback/.test(dc) && /setProcurementFarmersState\(prev => \{ const u = prev\.map\(f => f\.id === id \? before : f\)/.test(dc), 'farmer edit rolls back on a failed save');
  const page = readFileSync(pathResolve(SRC, 'pages', 'ProcurementLots.tsx'), 'utf8');
  ok(/for \(const r of bulkPlan\.pay\)[\s\S]{0,400}recordFarmerPayment\(\{ engineVoucherId: r\.engineVoucherId/.test(page) && /reference: bulkRef\.trim\(\)/.test(page), 'bulk = one recordFarmerPayment per farmer with the shared batch ref');
}

// ── 17. D3 — source guards (shortage / bill vouchers owned + rolled back) ──────────────────────────
{
  const { readFileSync } = await import('node:fs');
  const mk = readFileSync(pathResolve(SRC, 'contexts', 'MarketingDataContext.tsx'), 'utf8');
  ok(/registerVoucherOwner\('marketing-agency'/.test(mk), 'dispatch / bill own their vouchers (no stray cancel from the Vouchers page)');
  ok(/refType: DISPATCH_SHORTAGE_REF_TYPE, refId: d\.agencyId/.test(mk) && /onSaved: \(sv\) => saveRow\(\{ \.\.\.next, shortageVoucherId: sv\.id \}, \(\) => cancelVoucher\(sv\.id/.test(mk), 'shortage voucher first; a row that fails cancels it');
  ok(/refType: AGENCY_BILL_REF_TYPE, refId: b\.agencyId/.test(mk) && /onSaved: \(sv\) => saveApproved\(sv\.id, \(\) => cancelVoucher\(sv\.id/.test(mk), 'bill incidentals voucher first; a row that fails cancels it');
  ok(/if \(agencyBills\.some\(b => !b\.isDeleted && b\.dispatchIds\.includes\(id\)\)\)/.test(mk), 'a billed dispatch cannot be deleted');
  ok(/billMatching\.byBill\[b\.id\]\?\.received \?\? 0\) > 0\.005/.test(mk), 'a bill with receipts applied cannot be deleted');
  const flow = readFileSync(pathResolve(SRC, 'lib', 'procurement', 'agentFlow.ts'), 'utf8');
  ok(/'procurement\.dispatch\.shortage' \|\| v\.refType === 'procurement\.agency\.bill'/.test(flow), 'shortage / bill vouchers traced to their agency in balances');
  const page = readFileSync(pathResolve(SRC, 'pages', 'ProcurementLots.tsx'), 'utf8');
  ok(/const disp = dispatches\.find\(d => !d\.isDeleted && d\.lotIds\.includes\(lotId\)\)/.test(page), 'a dispatched lot is not cancelled directly');
}

// ── 18. E1 — source guards ───────────────────────────────────────────────────────────────────────
{
  const { readFileSync } = await import('node:fs');
  const mk = readFileSync(pathResolve(SRC, 'contexts', 'MarketingDataContext.tsx'), 'utf8');
  ok(/registerVoucherOwner\('marketing-scheme'/.test(mk), 'scheme claim owns its claim voucher');
  ok(/refType: SCHEME_CLAIM_REF_TYPE, refId: rec\.id/.test(mk) && /cancelVoucher\(sv\.id, 'Scheme claim row not saved \(auto-rollback\)'/.test(mk), 'claim voucher first; a row that fails cancels it');
  ok(/amt > outstanding \+ 0\.005/.test(mk), 'a receipt larger than the claim outstanding is refused');
  const cat = readFileSync(pathResolve(SRC, 'lib', 'navigation', 'moduleCatalog.ts'), 'utf8');
  ok(/id: 'purchaseOrders'[^\n]*requiredCapabilities: \['inventory_sales'\]/.test(cat), 'Purchase Order open to every buying-selling society (not only pos_billing)');
  ok(/id: 'dealerCompliance'[^\n]*route: '\/dealer-compliance'/.test(cat), 'dealer compliance module registered');
  const inv = readFileSync(pathResolve(SRC, 'pages', 'Inventory.tsx'), 'utf8');
  ok(/<LicenceExpiryBanner hi=\{hi\} \/>/.test(inv), 'Inventory shows the licence expiry banner');
}

// ── 19. E2 — source guards ───────────────────────────────────────────────────────────────────────
{
  const { readFileSync } = await import('node:fs');
  const mk = readFileSync(pathResolve(SRC, 'contexts', 'MarketingDataContext.tsx'), 'utf8');
  ok(/registerVoucherOwner\('marketing-trips'/.test(mk), 'hired trips own their freight voucher');
  ok(/Hired trip row not saved \(auto-rollback\)/.test(mk), 'trip row failure cancels the freight voucher (RULE 1)');
  ok(/const \{ outstanding \} = tripBalance\(t, tripPayments\)/.test(mk) && /amt > outstanding \+ 0\.005/.test(mk), 'trip payment capped at the outstanding freight');
  ok(/HIRED_TRIP_PAYMENT_REF_TYPE/.test(mk), 'payments are derived by refType');
  const cat = readFileSync(pathResolve(SRC, 'lib', 'navigation', 'moduleCatalog.ts'), 'utf8');
  ok(/id: 'kachiAarat'[^\n]*requiredCapabilities: \['procurement_msp'\]/.test(cat), 'Kachi Aarat open to every procurement society (not Haryana-only)');
  ok(/id: 'recoverables'[^\n]*haryana_compliance/.test(cat), 'recoverables stay Haryana');
  const ka = readFileSync(pathResolve(SRC, 'pages', 'KachiAaratRegister.tsx'), 'utf8');
  ok(/isHaryanaPack\s*\?\s*\(hi \? 'HAFED Proforma 8/.test(ka), 'HAFED Proforma 8 named only for the Haryana pack');
  ok(/reconcileDami\(/.test(ka) && !/addVoucher/.test(ka), 'dami reconciliation shown, nothing posted from the page');
}

console.log(`[procurement-agent-flow] ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

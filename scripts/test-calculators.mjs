// Calculator Engine formula tests — runs the REAL pure functions (no test runner / deps).
// Covers: formula correctness, validation/guards, and boundary cases. Exit 1 on any failure.
// Run:  node scripts/test-calculators.mjs   (or: npm run test:calc)
import {
  depreciation, simpleInterest, compoundInterest, shareCapital, gst, tds, emi,
  cashDifference, percentage, workingCapital,
} from '../src/lib/calculators/formulas.js';

let pass = 0;
const fails = [];
const ok = (name, cond) => { if (cond) pass++; else fails.push(name); };
const near = (a, b, eps = 0.05) => Math.abs(a - b) <= eps;

/* 1. Depreciation */
const slm = depreciation('slm', 100000, 10, 5);
ok('SLM total dep = 50000', near(slm.totalDep, 50000));
ok('SLM closing = 50000', near(slm.closingValue, 50000));
ok('SLM schedule length 5', slm.schedule.length === 5);
ok('SLM year1 dep = 10000', near(slm.schedule[0].depreciation, 10000));
const wdv = depreciation('wdv', 100000, 10, 2);
ok('WDV y1 dep = 10000', near(wdv.schedule[0].depreciation, 10000));
ok('WDV y2 dep = 9000', near(wdv.schedule[1].depreciation, 9000));
ok('WDV total = 19000', near(wdv.totalDep, 19000));
ok('Depreciation guard (cost<=0)', depreciation('slm', -1, 10, 5).schedule.length === 0);

/* 2. Simple interest */
const si = simpleInterest(50000, 8, 2);
ok('SI interest = 8000', near(si.interest, 8000));
ok('SI total = 58000', near(si.total, 58000));
ok('SI guard (p<=0)', simpleInterest(0, 8, 2).interest === 0);

/* 3. Compound interest */
const ci = compoundInterest(50000, 8, 3, 1);
ok('CI total ~ 62985.6', near(ci.total, 62985.6, 0.5));
ok('CI interest ~ 12985.6', near(ci.interest, 12985.6, 0.5));
ok('CI schedule length 3', ci.schedule.length === 3);
const ciQ = compoundInterest(50000, 8, 1, 4);
ok('CI quarterly > annual', ciQ.total > compoundInterest(50000, 8, 1, 1).total);

/* 4. Share capital */
const sc = shareCapital(100, 6000, 90, 10000);
ok('SC issued = 600000', near(sc.issued, 600000));
ok('SC paidUp = 540000', near(sc.paidUp, 540000));
ok('SC authorised = 1000000', near(sc.authorised, 1000000));
ok('SC subscribed = issued', near(sc.subscribed, 600000));
ok('SC authorised null when no auth shares', shareCapital(100, 6000, 100).authorised === null);

/* 5. GST */
const gEx = gst(10000, 18, 'exclusive');
ok('GST excl amount = 1800', near(gEx.gst, 1800));
ok('GST excl total = 11800', near(gEx.total, 11800));
ok('GST excl cgst = 900', near(gEx.cgst, 900));
const gIn = gst(11800, 18, 'inclusive');
ok('GST incl base = 10000', near(gIn.base, 10000));
ok('GST incl gst = 1800', near(gIn.gst, 1800));
ok('GST incl total = 11800', near(gIn.total, 11800));
ok('GST guard (amount<=0)', gst(0, 18).gst === 0);

/* 6. TDS */
const t = tds(50000, 10);
ok('TDS = 5000', near(t.tds, 5000));
ok('TDS net = 45000', near(t.net, 45000));
ok('TDS guard', tds(0, 10).tds === 0);

/* 7. EMI */
const e = emi(300000, 9, 36);
ok('EMI > 0', e.emi > 0);
ok('EMI total = emi*36 (approx)', near(e.total, e.emi * 36, 1));
ok('EMI interest = total - principal', near(e.interest, e.total - 300000, 1));
ok('EMI yearly rows present', e.yearly.length >= 3);
ok('EMI last balance ~ 0', near(e.yearly[e.yearly.length - 1].balance, 0, 1));
const e0 = emi(120000, 0, 12);
ok('EMI zero-rate = 10000', near(e0.emi, 10000));
ok('EMI zero-rate interest = 0', near(e0.interest, 0, 1));
ok('EMI guard (months<=0)', emi(100000, 9, 0).emi === 0);

/* 8. Cash difference */
ok('Cash short', cashDifference(12000, 11800).status === 'short' && near(cashDifference(12000, 11800).difference, 200));
ok('Cash excess', cashDifference(12000, 12500).status === 'excess');
ok('Cash match', cashDifference(12000, 12000).status === 'match');

/* 9. Percentage */
ok('Pct increase 1000+10% = 1100', near(percentage('increase', 1000, 10).result, 1100));
ok('Pct decrease 1000-10% = 900', near(percentage('decrease', 1000, 10).result, 900));
ok('Pct difference 800->1000 = 25%', near(percentage('difference', 800, 1000).result, 25));
ok('Pct difference guard (a=0)', percentage('difference', 0, 100).result === 0);

/* 10. Working capital */
const wc = workingCapital(500000, 300000);
ok('WC = 200000', near(wc.workingCapital, 200000));
ok('WC ratio = 1.67', near(wc.currentRatio, 1.67, 0.01));
ok('WC ratio null when CL=0', workingCapital(100, 0).currentRatio === null);
ok('WC negative supported', workingCapital(100, 300).workingCapital === -200);

/* boundary: non-finite inputs never throw, return safe */
ok('NaN-safe SI', simpleInterest(NaN, 8, 2).interest === 0);
ok('NaN-safe WC', workingCapital(NaN, 1).workingCapital === 0);

console.log(`[calc-tests] ${pass} passed, ${fails.length} failed.`);
if (fails.length) {
  console.error('FAILED:\n  - ' + fails.join('\n  - '));
  process.exit(1);
}
console.log('[calc-tests] ✓ all formula, validation & boundary tests passed.');

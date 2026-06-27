/**
 * Pure calculator formulas for the SahakarLekha Calculator Engine.
 *
 * Plain ESM (JSDoc-typed) so the SAME functions run in the app AND in a dependency-free
 * node test (scripts/test-calculators.mjs). No statutory rates are hardcoded anywhere —
 * every rate is a caller-supplied input. Functions are pure: numbers in, numbers out.
 */

/* ---------- formatters ---------- */

/** Indian-rupee formatting, 2 decimals by default. */
export function inr(n, dp = 2) {
  if (!isFinite(n)) return '—';
  return new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: dp, maximumFractionDigits: dp }).format(n);
}
/** Plain number with Indian grouping. */
export function num(n, dp = 2) {
  if (!isFinite(n)) return '—';
  return new Intl.NumberFormat('hi-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(n);
}
export function pct(n, dp = 2) {
  if (!isFinite(n)) return '—';
  return num(n, dp) + '%';
}
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const pos = (n) => (isFinite(n) && n > 0);
const nonNeg = (n) => (isFinite(n) && n >= 0);

/* ---------- 1. Depreciation (SLM / WDV) — user enters the rate ---------- */
/**
 * @param {'slm'|'wdv'} method
 * @param {number} cost  asset cost
 * @param {number} ratePct  depreciation rate % (user-entered; NO statutory default)
 * @param {number} years  number of years to schedule
 * @param {number} [salvage]  residual/salvage value (SLM floor)
 */
export function depreciation(method, cost, ratePct, years, salvage = 0) {
  if (!pos(cost) || !nonNeg(ratePct) || !pos(years)) return { schedule: [], totalDep: 0 };
  const n = Math.min(Math.floor(years), 100);
  const sched = [];
  let opening = cost;
  let totalDep = 0;
  for (let y = 1; y <= n; y++) {
    let dep;
    if (method === 'wdv') {
      dep = opening * (ratePct / 100);
    } else {
      dep = cost * (ratePct / 100); // SLM: on original cost
      // don't depreciate below salvage
      if (opening - dep < salvage) dep = Math.max(0, opening - salvage);
    }
    dep = r2(dep);
    const closing = r2(opening - dep);
    sched.push({ year: y, opening: r2(opening), depreciation: dep, closing });
    totalDep = r2(totalDep + dep);
    opening = closing;
  }
  return { schedule: sched, totalDep, closingValue: r2(opening) };
}

/* ---------- 2. Simple Interest ---------- */
export function simpleInterest(principal, ratePct, years) {
  if (!pos(principal) || !nonNeg(ratePct) || !nonNeg(years)) return { interest: 0, total: principal || 0 };
  const interest = r2((principal * ratePct * years) / 100);
  return { interest, total: r2(principal + interest) };
}

/* ---------- 3. Compound Interest ---------- */
/** @param {1|2|4|12} freq  compounding per year */
export function compoundInterest(principal, ratePct, years, freq = 1) {
  if (!pos(principal) || !nonNeg(ratePct) || !pos(years) || !pos(freq)) {
    return { interest: 0, total: principal || 0, schedule: [] };
  }
  const i = ratePct / 100 / freq;
  const total = r2(principal * Math.pow(1 + i, freq * years));
  const interest = r2(total - principal);
  // yearly growth table
  const schedule = [];
  for (let y = 1; y <= Math.min(Math.floor(years), 100); y++) {
    const amt = r2(principal * Math.pow(1 + i, freq * y));
    schedule.push({ year: y, amount: amt, interest: r2(amt - principal) });
  }
  return { interest, total, schedule };
}

/* ---------- 4. Share Capital (educational) ---------- */
/**
 * @param {number} faceValue per-share face value
 * @param {number} numShares issued/subscribed shares
 * @param {number} paidPct paid-up percentage (0–100)
 * @param {number} [authorisedShares] optional authorised share count
 */
export function shareCapital(faceValue, numShares, paidPct, authorisedShares) {
  if (!pos(faceValue) || !pos(numShares) || !nonNeg(paidPct)) {
    return { authorised: null, issued: 0, subscribed: 0, paidUp: 0 };
  }
  const issued = r2(faceValue * numShares);
  const subscribed = issued; // educational: subscribed = issued for typical societies
  const paidUp = r2(issued * (paidPct / 100));
  const authorised = pos(authorisedShares) ? r2(faceValue * authorisedShares) : null;
  return { authorised, issued, subscribed, paidUp };
}

/* ---------- 5. GST — exclusive / inclusive, user-defined rate ---------- */
/** @param {'exclusive'|'inclusive'} mode */
export function gst(amount, ratePct, mode = 'exclusive') {
  if (!pos(amount) || !nonNeg(ratePct)) return { base: amount || 0, gst: 0, total: amount || 0, cgst: 0, sgst: 0 };
  let base, gstAmt, total;
  if (mode === 'inclusive') {
    base = r2((amount * 100) / (100 + ratePct));
    gstAmt = r2(amount - base);
    total = r2(amount);
  } else {
    base = r2(amount);
    gstAmt = r2((amount * ratePct) / 100);
    total = r2(amount + gstAmt);
  }
  return { base, gst: gstAmt, total, cgst: r2(gstAmt / 2), sgst: r2(gstAmt / 2) };
}

/* ---------- 6. TDS — user enters rate, no legal default ---------- */
export function tds(amount, ratePct) {
  if (!pos(amount) || !nonNeg(ratePct)) return { tds: 0, net: amount || 0 };
  const t = r2((amount * ratePct) / 100);
  return { tds: t, net: r2(amount - t) };
}

/* ---------- 7. Loan EMI + amortization ---------- */
export function emi(principal, annualRatePct, months) {
  if (!pos(principal) || !nonNeg(annualRatePct) || !pos(months)) {
    return { emi: 0, interest: 0, total: principal || 0, schedule: [], yearly: [] };
  }
  const n = Math.floor(months);
  const mr = annualRatePct / 12 / 100;
  let e;
  if (mr === 0) e = principal / n;
  else e = (principal * mr * Math.pow(1 + mr, n)) / (Math.pow(1 + mr, n) - 1);
  e = r2(e);
  const total = r2(e * n);
  const interest = r2(total - principal);
  // monthly schedule (for accuracy) → summarised yearly for compact display
  let bal = principal;
  const schedule = [];
  const yearly = [];
  let yPrin = 0, yInt = 0;
  for (let m = 1; m <= n; m++) {
    const intM = r2(bal * mr);
    let prinM = r2(e - intM);
    if (m === n) prinM = r2(bal); // clear rounding on last
    bal = r2(bal - prinM);
    schedule.push({ month: m, principal: prinM, interest: intM, balance: Math.max(0, bal) });
    yPrin = r2(yPrin + prinM); yInt = r2(yInt + intM);
    if (m % 12 === 0 || m === n) {
      yearly.push({ year: Math.ceil(m / 12), principal: yPrin, interest: yInt, balance: Math.max(0, bal) });
      yPrin = 0; yInt = 0;
    }
  }
  return { emi: e, interest, total, schedule, yearly };
}

/* ---------- 8. Cash difference (book vs physical) ---------- */
export function cashDifference(bookBalance, physicalCash) {
  if (!isFinite(bookBalance) || !isFinite(physicalCash)) return { difference: 0, status: 'match' };
  const diff = r2(physicalCash - bookBalance);
  const status = diff > 0 ? 'excess' : diff < 0 ? 'short' : 'match';
  return { difference: Math.abs(diff), signed: diff, status };
}

/* ---------- 9. Percentage (increase / decrease / difference) ---------- */
/** @param {'increase'|'decrease'|'difference'} mode */
export function percentage(mode, a, b) {
  if (!isFinite(a) || !isFinite(b)) return { result: 0, change: 0 };
  if (mode === 'increase') {
    const change = r2((a * b) / 100);
    return { result: r2(a + change), change };
  }
  if (mode === 'decrease') {
    const change = r2((a * b) / 100);
    return { result: r2(a - change), change };
  }
  // difference: % change from a to b
  if (a === 0) return { result: 0, change: r2(b - a) };
  return { result: r2(((b - a) / Math.abs(a)) * 100), change: r2(b - a) };
}

/* ---------- 10. Working capital + current ratio (educational) ---------- */
export function workingCapital(currentAssets, currentLiabilities) {
  if (!isFinite(currentAssets) || !isFinite(currentLiabilities)) return { workingCapital: 0, currentRatio: null };
  const wc = r2(currentAssets - currentLiabilities);
  const cr = currentLiabilities > 0 ? r2(currentAssets / currentLiabilities) : null;
  return { workingCapital: wc, currentRatio: cr };
}

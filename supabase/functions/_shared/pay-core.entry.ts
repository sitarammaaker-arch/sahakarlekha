// Entry for esbuild → _shared/pay-core.mjs (the Deno Edge Function's pure payroll core).
// Bundles the pure pipeline so the pay-run function can compute exactly as the Node tests do.
export { freezeViews } from '@/lib/pay/resolve/freeze.ts';
export { mapCatalog } from '@/lib/pay/orchestrator/mapCatalog.ts';
export { assembleRun } from '@/lib/pay/orchestrator/assembleRun.ts';
export { makeMoney } from '@/lib/pay/formula/evaluator.ts';
export { canTransition, stateAfterEvent } from '@/lib/pay/runtime/runState.ts';
// P1 — ledger posting: the pure builders + the hand-off to public.post_voucher, and the shared Hindi-first refusal messages.
export { buildRunAccrual, buildRunPayment, makePostVoucherPayload, headsFromRoles, payrollDocIds, PAYROLL_ROLES } from '@/lib/pay/posting/runPosting.ts';
export { postVoucherErrorCode, postVoucherMessage } from '@/lib/ledger/postVoucherMessages.ts';
// P2 — salary TDS: the whitelisted tds_192 function over the Salary page's CA-confirmed cumulative rule, the five TDS
// formulas, the verified-law gate, and the financial-year helpers the year-to-date needs.
export { makeTds192, assertVerifiedLaw, TDS_FORMULAS, TDS_192_SIG, TDS_192_NAME, TDS_YTD_HEAD, isTdsCode } from '@/lib/pay/tax/salaryTds.ts';
export { makePfWage, PF_WAGE_NAME, PF_WAGE_SIG } from '@/lib/pay/statutory/pfWage.ts';
export { makeEsiEmployee, ESI_EMPLOYEE_NAME, ESI_EMPLOYEE_SIG, ESI_FORMULAS, ESI_CODE_BY_TYPE, isEsiCode } from '@/lib/pay/statutory/esiWage.ts';
export { monthsLeftInFy, fyBounds } from '@/lib/payroll/cumulativeTds.ts';
// PF / ESI parameters as dated, flagged-unverified data (the one place to change them): the seed defaults read it.
export { resolveParam, resolveStatutory } from '@/lib/rules/epfEsi.ts';
export { makeEsiEmployer, ESI_EMPLOYER_NAME, ESI_EMPLOYER_SIG, ER_FORMULAS, ER_ESI_CODE_BY_TYPE, ER_PF_CODE, ER_PF_RATE_VAR, isErCode } from '@/lib/pay/statutory/employerShare.ts';

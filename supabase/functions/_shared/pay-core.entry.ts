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

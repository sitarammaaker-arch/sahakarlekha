// Entry for esbuild → _shared/pay-core.mjs (the Deno Edge Function's pure payroll core).
// Bundles the pure pipeline so the pay-run function can compute exactly as the Node tests do.
export { freezeViews } from '@/lib/pay/resolve/freeze.ts';
export { mapCatalog } from '@/lib/pay/orchestrator/mapCatalog.ts';
export { assembleRun } from '@/lib/pay/orchestrator/assembleRun.ts';
export { makeMoney } from '@/lib/pay/formula/evaluator.ts';
export { canTransition, stateAfterEvent } from '@/lib/pay/runtime/runState.ts';

/**
 * Procurement Phase 3.3 — Financial Engine mapper.
 *
 * The mapper is a generic accounting primitive (frozen legs → voucher line specs) and now
 * lives in the shared posting core. This module re-exports it so existing procurement imports
 * (`import { buildEngineVoucherLines } from './engine'`) keep working unchanged. Behaviour is
 * identical — no procurement business rule lives here.
 */
export { buildEngineVoucherLines } from '@/lib/posting/engineVoucher';
export type { EngineVoucherLineSpec } from '@/lib/posting/engineVoucher';

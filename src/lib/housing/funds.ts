/**
 * Housing fund statement — moved to the generic src/lib/funds.ts (ECR-27) so all
 * society types can use it, not just housing. This file re-exports for back-compat;
 * existing housing imports keep working unchanged.
 */
export { isFundAccount, buildFundStatement } from '@/lib/funds';
export type { FundRowKind, FundStatementRow, FundStatement } from '@/lib/funds';

/**
 * Statement selection — which financial statements a society renders (T-21 / UCAS Part D).
 *
 * PURE. UCAS defines the full statement set once; WHICH statements a given society produces is
 * driven by its CAPABILITIES, not its type (ADR-0002) — a trading society gets a Trading A/c, a
 * service society gets Income & Expenditure, a credit society gets a DCB, and a Multipurpose
 * society gets several at once. Only Tier-3 STATUTORY returns gate on the legal type (the one
 * legitimate type read). Every statement is a projection over the immutable ledger (CL-4).
 *
 * This registry is the SSOT for that selection; the Reports page reads it (like the module
 * catalog reads capabilities). Adding a statement is a data row here, never a branch in a page.
 */
import type { Capability } from '../navigation/capabilities';
import type { SocietyType } from '@/types';

export type StatementTier =
  | 'universal'            // every society (Trial Balance, Receipts & Payments, Appropriation, Balance Sheet)
  | 'capability'           // shown iff the society HAS `requiredCapability`
  | 'negative_capability'  // shown iff the society LACKS `absentCapability` (e.g. I&E for non-trading)
  | 'statutory';           // shown iff the legal type matches — the one Tier-3 type gate

export interface StatementDef {
  code: string;
  label: string;
  /** Hindi-first (RULE 7). */
  labelHi: string;
  tier: StatementTier;
  requiredCapability?: Capability;
  absentCapability?: Capability;
  requiredLegalTypes?: SocietyType[];
}

/** UCAS Part D — the statement set and its selection drivers. */
export const STATEMENT_REGISTRY: readonly StatementDef[] = [
  // Universal (FS-1/5/6 + trial balance)
  { code: 'trial_balance',        label: 'Trial Balance',              labelHi: 'तलपट',                    tier: 'universal' },
  { code: 'receipts_payments',    label: 'Receipts & Payments A/c',    labelHi: 'प्राप्ति एवं भुगतान खाता', tier: 'universal' },
  { code: 'pl_appropriation',     label: 'P&L Appropriation A/c',      labelHi: 'लाभ-हानि विनियोजन खाता',   tier: 'universal' },
  { code: 'balance_sheet',        label: 'Balance Sheet',              labelHi: 'तुलन-पत्र',                tier: 'universal' },

  // Trading vs service — mutually exclusive on inventory_sales (FS-2/3/4)
  { code: 'trading_ac',           label: 'Trading A/c',                labelHi: 'व्यापार खाता',             tier: 'capability',          requiredCapability: 'inventory_sales' },
  { code: 'profit_loss',          label: 'Profit & Loss A/c',          labelHi: 'लाभ-हानि खाता',            tier: 'capability',          requiredCapability: 'inventory_sales' },
  { code: 'income_expenditure',   label: 'Income & Expenditure A/c',   labelHi: 'आय-व्यय खाता',             tier: 'negative_capability', absentCapability: 'inventory_sales' },

  // Capability-specific registers
  { code: 'dcb',                  label: 'Demand-Collection-Balance',  labelHi: 'माँग-वसूली-शेष (DCB)',     tier: 'capability',          requiredCapability: 'lending' },
  { code: 'deposit_statement',    label: 'Deposit Statement',          labelHi: 'जमा विवरण',                tier: 'capability',          requiredCapability: 'deposit_ledger' },
  { code: 'milk_payment_sheet',   label: 'Milk Payment Sheet',         labelHi: 'दूध भुगतान पत्रक',         tier: 'capability',          requiredCapability: 'dairy_collection' },
  { code: 'maintenance_dues',     label: 'Maintenance Dues',           labelHi: 'रखरखाव बकाया',             tier: 'capability',          requiredCapability: 'housing' },
  { code: 'wage_register',        label: 'Wage Register',              labelHi: 'मजदूरी रजिस्टर',           tier: 'capability',          requiredCapability: 'labour' },
  { code: 'subsidy_claim',        label: 'Subsidy Claim Statement',    labelHi: 'सब्सिडी दावा विवरण',       tier: 'capability',          requiredCapability: 'subsidy_reconciliation' },
  { code: 'stock_summary',        label: 'Stock Summary',              labelHi: 'स्टॉक सारांश',             tier: 'capability',          requiredCapability: 'inventory_sales' },

  // Statutory (Tier-3) — the ONE legitimate legal-type gate
  { code: 'nabard_return',        label: 'NABARD / RCS Return',        labelHi: 'NABARD / RCS विवरणी',      tier: 'statutory',           requiredLegalTypes: ['pacs'] },
];

export interface StatementContext {
  capabilities: ReadonlySet<Capability>;
  legalType: SocietyType;
}

/**
 * PURE — the statements a society renders (UCAS Part D). Universal always; capability iff
 * present; negative_capability iff absent; statutory iff the legal type matches. A Multipurpose
 * society (many capabilities) naturally selects several at once.
 */
export function selectStatements(ctx: StatementContext): StatementDef[] {
  return STATEMENT_REGISTRY.filter((s) => {
    switch (s.tier) {
      case 'universal': return true;
      case 'capability': return !!s.requiredCapability && ctx.capabilities.has(s.requiredCapability);
      case 'negative_capability': return !!s.absentCapability && !ctx.capabilities.has(s.absentCapability);
      case 'statutory': return !!s.requiredLegalTypes && s.requiredLegalTypes.includes(ctx.legalType);
      default: return false;
    }
  });
}

/** PURE — convenience: just the statement codes a society renders. */
export function selectStatementCodes(ctx: StatementContext): string[] {
  return selectStatements(ctx).map((s) => s.code);
}

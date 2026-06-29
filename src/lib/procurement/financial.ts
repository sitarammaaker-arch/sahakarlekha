/**
 * Procurement Phase-0.2 — Financial Intent / Posting Rule / Engine PORT contracts.
 * Interfaces ONLY — no posting logic, no implementation, no engine. Reuses the existing Voucher type.
 */
import type { Money } from './shared';
import type { PostingLeg } from '@/lib/posting/types';
import type { ProcurementEvent } from './events';
import type { Voucher } from '@/types';

// Re-export the generic PostingLeg so existing procurement imports keep working unchanged.
export type { PostingLeg };

export type FinancialIntentName =
  | 'RecogniseProcurement' | 'CreateFarmerPayable' | 'AccrueLevyLiability' | 'AccrueCommission'
  | 'SettleFarmer' | 'ReverseFarmerSettlement' | 'ReceiveAgencyFunds' | 'DrawFinancing'
  | 'AccrueInterestExpense' | 'AccrueSubventionIncome' | 'AccrueIncidentalExpense'
  | 'CrystalliseClaim' | 'ReceiveSettlement' | 'RecogniseIncidentalIncome'
  | 'RaiseRecoverable' | 'RecoverAmount' | 'WriteOffRecoverable'
  | 'RecogniseShortageLoss' | 'RecogniseStorageGain' | 'RecogniseRejectionLoss'
  | 'RecogniseInsurance' | 'RecogniseFarmerBonus' | 'RecognisePriceDifference'
  | 'RecogniseBardanaScrapIncome' | 'ApplyTax';

export type AccountingProfile = 'agency' | 'principal';

export interface FinancialIntent {
  name: FinancialIntentName;
  amount: Money;
  dimensions?: Record<string, string>;   // lot / party / levy — for posting-rule resolution
}


export interface PostingRule {
  intent: FinancialIntentName;
  profile: AccountingProfile;
  legs: PostingLeg[];
}

/**
 * Port — translates business events into double-entry vouchers (engine-owned, immutable,
 * reversal-only). Method SIGNATURES only; Phase 1 supplies the implementation.
 */
export interface FinancialEventEngine {
  interpret(event: ProcurementEvent): FinancialIntent[];
  resolvePostings(intents: FinancialIntent[], profile: AccountingProfile): PostingLeg[];
  post(event: ProcurementEvent): Voucher[];
  reverse(voucherId: string): Voucher;
}

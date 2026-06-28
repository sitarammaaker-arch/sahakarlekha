/**
 * Procurement Phase-0.2 — Financial Intent / Posting Rule / Engine PORT contracts.
 * Interfaces ONLY — no posting logic, no implementation, no engine. Reuses the existing Voucher type.
 */
import type { Money } from './shared';
import type { ProcurementEvent } from './events';
import type { Voucher } from '@/types';

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

export interface PostingLeg {
  side: 'Dr' | 'Cr';
  accountSelector: string;
  amount: Money;
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

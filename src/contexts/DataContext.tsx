import { tr, uiLanguage } from '@/lib/uiLang';
import {
  findShortageGroup, findPersonLedger, findSalesByShortage, findWriteOffAccount, currentAssetsParent, tradingIncomeParent, directExpenseParent,
  shortageAmount, validateAdjustment, SHORTAGE_GROUP, SALES_BY_SHORTAGE, WRITE_OFF_HEAD, REF_SHORTAGE, REF_SHORTAGE_WRITEOFF,
} from '@/lib/godownShortage';
import { asDbArgs, asDbRow, dbRowAs, type LooseRow } from '@/lib/dbRow';
import { systemOwnedVoucherKind, systemOwnedVoucherMessage } from '@/lib/systemOwnedVoucher';
import { isMemberShareVoucher } from '@/lib/members/memberShareVoucher';
import { loanRepaymentPrincipal, REF_LOAN_REPAYMENT, REF_LOAN_INTEREST_RELEASE } from '@/lib/loans/interestAccrual';
import { voucherRefusedToast } from '@/lib/voucherRefused';
import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type {
  Voucher, VoucherEditSnapshot, VoucherLine, VoucherType, Member, MemberStatus, LedgerAccount, SocietySettings, BillAllocation,
  AccountBalance, CashBookEntry, BankBookEntry, MemberLedgerEntry, ReceiptsPaymentsData,
  Loan, Asset, AuditObjection, Recoverable, KachiAaratEntry, P7Entry,
  DepositAccount, DepositTransaction, DepositType, DepositTxnType, ComplianceFiling,
  StockItem, StockMovement,
  Sale, Purchase,
  Employee, SalaryRecord, PaymentMode,
  Supplier, Customer,
  KccLoan,
  VoucherEntry,
  EntityLink,
  WorkOrder,
  MusterEntry,
  Branch,
  Godown,
} from '@/types';
import { matchesBranch, branchToStamp, resolveActiveBranch, unbranchedInScope, ALL_BRANCHES } from '@/lib/branchScope';
import { buildInterBranchTransfer, INTER_BRANCH_CONTROL_ID } from '@/lib/interBranch';
import { getVoucherLines, buildVoucherEntries, splitNetByAccount } from '@/lib/voucherUtils';
import { goodsBase, adjustmentLines } from '@/lib/invoiceAdjustments';
import { nextAccountCode, planMissingCodes } from '@/lib/accountCode';
import { isFundAccount, buildFundStatement } from '@/lib/funds';
import { resolveFarmerPaymentCredit } from '@/lib/procurement/farmerPaymentMode';
import { toMinor, toRupees, addMinor, subMinor, sumMinor, type Minor } from '@/lib/money';
import { salaryAccrualLines, salaryAccrualChanged } from '@/lib/payroll/accrualLines';
import { CORE_PARTS, setLoadFailures, refuseIfWriteBlocked } from '@/lib/connectivity/writeBlock';
import { findVoucherOwner, figureAfterCancel, type VoucherOwnerCheck, type VoucherCancelFollower } from '@/lib/voucherOwnership';
import { buildMemberShareLedger } from '@/lib/memberSnapshot';
import { reportError } from '@/lib/errorReporting';
import { syncPrimaryNominee } from '@/lib/nomineeUtils';
import { localOnlyAccountsReport } from '@/lib/accounting/localOnlyAccounts';
import { gstLedgerLegs, usesCombinedGst, gstLegLabel, rcmPayableAccountId, type GstSide, type GstLeg } from '@/lib/accounting/gstLedgers';
import { rcmPurchaseTerms } from '@/lib/rcm';
import { settlementTypedColumns, hydrateSettlement, hydrateJForm, hydrateAmount } from '@/lib/typedMoney';
import { issueOfficialNumber } from '@/lib/numbering';
import { billTerms, resolveLateFeeRule } from '@/lib/lateFee';
import { buildPostVoucherPayload, buildEditVoucherPayload, buildStockDocumentPayload, buildPendingVoucherPayload, postVoucherErrorCode, postVoucherMessage } from '@/lib/ledger/postVoucherClient';
import { reverseEntryLines, isEditLocked } from '@/lib/voucherReversal';
import { fyStartOf, fyStartFromLabel, societyFyStart } from '@/lib/fyPeriod';
import { canReadMemberPii, stripMemberPII, applyMemberIdentity, isMissingIdentityTable, identityRowFor, type IdentityRow } from '@/lib/memberIdentity';
import { applyPartyIdentity, canReadPartyPii, isMissingPartyIdentityTable, partyIdentityRowFor, partyPIIChanged, pickPartyPII, stripPartyPII, PARTY_PII_FIELDS, type PartyType, type PartyIdentityRow } from '@/lib/partyIdentity';
import { computeTrialBalance } from '@/lib/reports/trialBalance';
import { computeTradingAccount, computeProfitLoss } from '@/lib/reports/tradingAndProfitLoss';
import { computeReceiptsPayments } from '@/lib/reports/receiptsPayments';
import { computeCashBook, computeBankBook } from '@/lib/reports/accountBook';
import { computeEntityLinks, type MemberDomainLinkSources } from '@/lib/entityLinks';
import { fetchSubscriptionRow, type SubRow } from '@/lib/subscriptionRow';
import { effectiveStatus, planAllows, minPlanFor, PLAN_FEATURE_LABEL, type PlanFeature } from '@/lib/plans';
import { canTransitionMember } from '@/lib/memberLifecycle';
import { computeStock, computeStockValue, computeStockCostRate, reconcileMovements } from '@/lib/stockUtils';
import { computeGodownStock, godownMovementsWithOpening, UNASSIGNED_GODOWN } from '@/lib/godownStock';
import { validateTransfer, buildTransferLegs } from '@/lib/godownTransfer';
import * as storage from '@/lib/storage';
import { ACCOUNT_IDS, CMS_SOCIETY_ACCOUNTS, getBankAccountIds, defaultBankAccountId, defaultDebtorsAccountId, defaultCreditorsAccountId } from '@/lib/storage';
import { isUniqueViolation, isMissingBranchColumn, payloadWithoutMissingColumn, MAX_RENUMBER_RETRIES } from '@/lib/dbRetry';
import { voucherLinesBalance, snapSubRupeeResidual } from '@/lib/validation';
import { supabase, supabaseLoose } from '@/lib/supabase';
import { patchRow } from '@/lib/rowPatch';
import type { SocietyCapabilityRow, Capability, SocietyActivityRow } from '@/lib/navigation';
import { navigationService, declaredActivities } from '@/lib/navigation';
import { clearedKeysAsNull } from '@/lib/settingsPayload';
import { isEngineVoucher, ENGINE_VOUCHER_BLOCK } from '@/lib/accounting/voucherImmutability';
import { unknownItemLines, UNKNOWN_ITEM_MESSAGE, CLOSING_STOCK_CONTRA_ID } from '@/lib/itemAccountRouting';
import { withTradingParents } from '@/lib/tradingAccount';
import { logAudit, type AuditInput } from '@/lib/auditLog';
import { resolveJurisdiction, stampTenant } from '@/lib/jurisdiction';
import { isPeriodLocked as isDateInLockedPeriod } from '@/lib/periodLock';
import { buildEvent, type LedgerEvent } from '@/lib/ledger/event';
import { mapLedgerEventRows } from '@/lib/ledger/rows';
import { planOpeningDelta } from '@/lib/ledger/genesis';
import { voucherPostingLines, voucherReversalLines, voucherEventMeta } from '@/lib/ledger/voucherEvent';
import { currentPostingEventId } from '@/lib/ledger/aggregateState';
import { planAccountMerge, repointVoucher, isJournaledForMerge } from '@/lib/ledger/accountMerge';
import { persistEventsAuthoritative } from '@/lib/ledger/persist';
import { planSocietyAppropriation, appropriationVoucherContent } from '@/lib/rules/societyAppropriation';
import { resolveRebatePayableAccountId } from '@/lib/consumer/accounts';
import { authorizeFinalization, type AuthorityAttestation } from '@/lib/governance/authority';
import { ledgerTrialBalance } from '@/lib/ledger/trialBalance';
import { ledgerParity, balancesFromJournal } from '@/lib/ledger/parity';
import { ledgerCashBookEntries, ledgerBankBookEntries, ledgerMemberLedgerEntries, ledgerReceiptsPaymentsData } from '@/lib/ledger/reports';
import { cashBookParity, bankBookParity, memberLedgerParity, receiptsPaymentsParity, type ReportParityResult, type LedgerParityReport, type LedgerParitySnapshot } from '@/lib/ledger/reportParity';
import { snapshotDeletedMovements } from '@/lib/movementArchive';
import { isSelfApproval } from '@/lib/sod';
import { requiresApproval } from '@/lib/approvalMatrix';
import { canApprovalTransition } from '@/lib/approvalTransition';
import { sumActiveMemberShareCapital, reconcileShareCapital, type ShareCapitalReconciliation } from '@/lib/shareReconciliation';
import { premiumCap as sharePremiumCap, premiumAllowed as isSharePremiumAllowed } from '@/lib/sharePremium';
import { sumActiveAssetCost, reconcileAssetRegister, type AssetReconciliation } from '@/lib/assetReconciliation';
import { can as rbacCan, type Permission } from '@/lib/rbac';
import { splitVoucherExtras, extrasFailureToast } from '@/lib/voucherPersistence';
import { shareOpPosting, validateShareOp, applyShareOp, withShareCapital, type ShareOpType } from '@/lib/shareOps';
import { resolveDepositLiabilityAccount, depositPosting, depositVoucherType, applyDepositTxn, validateDepositTxn } from '@/lib/depositEngine';
import { hasActiveCompulsoryDeposit } from '@/lib/compulsoryDeposit';
import { normalizeSureties, suretyProblem } from '@/lib/loans/sureties';
import { professionalTaxAccountId, shareRefundPayableAccountId, MISSING_HEAD_TOAST, missingDepositHeadToast } from '@/lib/accounting/headResolve';
import { buildShareRefundApproval, buildShareRefundPayment, shareRefundOutstanding, SHARE_REFUND_APPROVE_REF, SHARE_REFUND_PAY_REF, SHARE_REFUND_MESSAGE } from '@/lib/shares/refundPayable';
import type { FarmerInput } from '@/lib/procurement/agentFlow';
import type { Farmer, ProcurementLot, ProcurementEvent, QualityTest, MoistureRecord, JForm, FinancialIntentRecord, PostingRequest, PostingRuleResult, AccountingProfile, Quantity, Money, FarmerSettlement, SettlementDeductionLine } from '@/lib/procurement';
import { resolvePostingLegs, buildEngineVoucherLines } from '@/lib/procurement';
import { procurementPostingBinding, missingProcurementRoles, PROCUREMENT_ROLE_LABEL_HI, PROCUREMENT_ROLE_LABEL_EN, resolveProcurementAccountId } from '@/lib/procurement/accounts';
import { isRejectedQuality, procurementBusinessDate, allocateFarmerCode, canRecordQuality, farmerPaidByEngineVoucher, withDerivedAmountPaid, FARMER_PAYMENT_REF_TYPE, agencyDirectAccounts, isLotCancelled, lotCancelBlockers, LOT_CANCEL_BLOCKER_TEXT, ENGINE_REVERSAL_REF_TYPE, COMMISSION_ACCRUAL_REF_TYPE, procurementLegsOf, isValidIfsc, isValidBankAccount } from '@/lib/procurement/agentFlow';
import { todayStr } from '@/lib/dateUtils';
import { calcDepForFY, DEP_ACCOUNTS, parseFY, wdvAccumulatedBefore, fyOfDate, nextFY } from '@/lib/depreciation';
import { assetDisposalPosting, assetAcquisitionPosting, ASSET_ACCOUNTS, disposalGainAccountId } from '@/lib/assetDisposal';
import { resolveAssetHead, resolveAssetHeads, missingAssetHeadsText, type AssetHeadKind } from '@/lib/assetHeads';
import { fetchAllPaged as fetchAllPagedFor } from '@/lib/supabasePaging';
import { fetchEmptyTables, unlessEmpty } from '@/lib/emptyTables';
import { phantomVoucherDiagnostics, type PhantomVoucherDiagnostics } from '@/lib/diagnostics/phantomVouchers';
import { accountDeleteFailure, coaResetBlockers, coaResetLiveData } from '@/lib/accounting/accountDelete';
import { planJoiningReceipts } from '@/lib/members/joiningReceipts';
import { memberAuditDiff } from '@/lib/members/memberAudit';
import { splitAdmissionFields, clearedAdmissionFields, applicationReceivedOn, MEMBER_PROFILE_FIELDS, MEMBER_CONTACT_FIELDS, MEMBER_PHOTO_FIELD, type AdmissionDecision } from '@/lib/members/admission';
import { MEMBER_PHOTO_BUCKET, memberPhotoPath, photoFileError, downscalePhoto } from '@/lib/members/photo';
import { canHoldShares, touchesShareCapital, manualMemberShareVoucherMessage } from '@/lib/members/shareRules';
import { memberWriteErrorText } from '@/lib/members/writeErrors';
import { MEMBER_STATUS_EXTRA_FIELDS } from '@/lib/members/cessation';
import { isCountedVoucher } from '@/lib/countedVoucher';
import { voucherCheckErrorText } from '@/lib/vouchers/checkErrors';

/* T-09 — the `ledger_events` row → LedgerEvent mapper now lives in lib/ledger/rows.ts.
   It moved because the CAIOS D-lane must read the SAME journal from the Edge Function,
   and a local const cannot be imported there. One mapper, three readers (RULE 2). */

/** mergeAccounts outcome. `accountDeleted=false` ⇒ the merge committed but the emptied account row
 *  could not be deleted (the user was told to delete it by hand). */
export interface AccountMergeResult { moved: number; journaled: number; accountDeleted: boolean }

interface DataContextType {
  vouchers: Voucher[];
  // ECR-17 multi-branch (Phase 1)
  branches: Branch[];
  activeBranchId: string;                       // 'all' = consolidated
  setActiveBranch: (id: string) => void;
  addBranch: (data: Omit<Branch, 'id' | 'createdAt'>) => Branch;
  updateBranch: (id: string, data: Partial<Branch>) => void;
  deleteBranch: (id: string) => void;
  transferBetweenBranches: (input: { fromBranchId: string; toBranchId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; narration?: string }) => void;
  matchesActiveBranch: (branchId?: string) => boolean;   // ECR-17 Phase 4: does an entity's branch fall under the active branch? ('all' → always true)
  isBranchRestricted: boolean;                           // ECR-17 Phase 4b: current user is locked to a single branch (selector disabled)
  // ECR-17 Phase 3 — godown-wise stock
  godowns: Godown[];
  activeGodownId: string;                       // '' = none (movements unassigned)
  setActiveGodown: (id: string) => void;
  addGodown: (data: Omit<Godown, 'id' | 'createdAt'>) => Godown;
  updateGodown: (id: string, data: Partial<Godown>) => void;
  deleteGodown: (id: string) => void;
  members: Member[];
  accounts: LedgerAccount[];
  society: SocietySettings;
  societyCapabilities: SocietyCapabilityRow[];   // C3: capability grant/revoke rows
  societyActivities: SocietyActivityRow[];        // T-11 (ADR-0003): the society's declared business activities
  setCapabilityHidden: (capability: Capability, hidden: boolean, meta?: { reason?: string; by?: string }) => void;  // C6
  procurementFarmers: Farmer[];
  procurementLots: ProcurementLot[];
  procurementEvents: ProcurementEvent[];
  addFarmer: (data: FarmerInput) => Promise<Farmer>;
  /** D2b: edit a farmer (name / father / mobile + bank, village, portal id). */
  updateFarmer: (id: string, data: Partial<FarmerInput>) => void;
  addProcurementLot: (data: { farmerId: string; cropId: string; varietyId?: string; seasonId?: string; centreId?: string; quantity: Quantity; mspRate: Money; lotDate?: string; arhtiyaId?: string; grossWeight?: number; tareWeight?: number; bags?: number }) => ProcurementLot;
  procurementQualityTests: QualityTest[];
  procurementMoistureRecords: MoistureRecord[];
  recordQualityInspection: (data: { lotId: string; result: string; moisture: number; inspectedBy?: string }) => QualityTest;
  procurementJForms: JForm[];
  generateJForm: (data: { lotId: string }) => JForm;
  procurementFinancialIntents: FinancialIntentRecord[];
  /** opts.onCommitted fires once the server committed it — chain the next posting step there. */
  generateFinancialIntent: (data: { jformId: string }, opts?: { onCommitted?: (fi: FinancialIntentRecord) => void; onFailed?: () => void }) => FinancialIntentRecord;
  procurementPostingRequests: PostingRequest[];
  generatePostingRequest: (data: { financialIntentId: string }, opts?: { onCommitted?: (pr: PostingRequest) => void; onFailed?: () => void }) => PostingRequest;
  procurementPostingRuleResults: PostingRuleResult[];
  /** D1: opts.receivableAccountId = the lot's agency ledger (else 3308); the society's 5116-route setting adds the pass-through legs. */
  generatePostingRuleResult: (data: { postingRequestId: string }, opts?: { onCommitted?: (r: PostingRuleResult) => void; onFailed?: () => void; receivableAccountId?: string }) => PostingRuleResult;
  /** D1: opts.onSaved fires once the engine voucher is durably saved (auto-commission hangs off it). */
  generateEngineVoucher: (data: { postingRuleResultId: string }, opts?: { onSaved?: (v: Voucher) => void }) => Voucher;
  // Farmer Settlement — the authoritative business document. Deductions live ONLY here (draft lines);
  // approval is the single accounting trigger; payments settle the approved settlement's Net Payable.
  procurementSettlements: FarmerSettlement[];
  createFarmerSettlement: (data: { engineVoucherId: string }) => FarmerSettlement;
  addSettlementDeductionLine: (data: { settlementId: string; deductionType: string; accountId: string; amount: number; reference?: string; remarks?: string }) => void;
  removeSettlementDeductionLine: (data: { settlementId: string; lineId: string }) => void;
  approveFarmerSettlement: (data: { settlementId: string }) => FarmerSettlement;
  /** Batch B: cancel a lot and reverse its postings (engine reversal + settlement + commission). Refused while money has moved. */
  cancelProcurementLot: (data: { lotId: string; reason: string }) => Promise<boolean>;
  recordFarmerPayment: (data: { engineVoucherId: string; amount: number; mode: 'cash' | 'bank' | 'agency'; bankAccountId?: string; agencyAccountId?: string; paymentDate: string; reference?: string; remarks?: string }) => Voucher;
  loans: Loan[];
  depositAccounts: DepositAccount[];
  depositTransactions: DepositTransaction[];
  addDepositAccount: (data: Omit<DepositAccount, 'id' | 'accountNo' | 'balance' | 'status' | 'createdAt'> & { openingAmount?: number; mode?: 'cash' | 'bank' }) => DepositAccount | null;
  postDepositTransaction: (accountId: string, txnType: 'deposit' | 'withdraw', amount: number, mode: 'cash' | 'bank', date: string) => boolean;
  postDepositInterest: (accountId: string, amount: number, date: string) => boolean;
  closeDepositAccount: (accountId: string, mode: 'cash' | 'bank', date: string) => boolean;
  getDepositTransactions: (accountId: string) => DepositTransaction[];
  markComplianceFiled: (itemId: string, note?: string) => void;
  unmarkComplianceFiled: (itemId: string) => void;
  getComplianceFiledIds: () => string[];
  assets: Asset[];

  /** opts.onSaved fires once the voucher is durably saved in the cloud (any save path); opts.onFailed once a
   *  save failed and the optimistic row was rolled back. A page should clear its input form only on onSaved. */
  addVoucher: (data: Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'> & { voucherNo?: string }, opts?: { onSaved?: (v: Voucher) => void; onFailed?: () => void }) => Voucher;
  // Returns true only when the edit passed every guard and was applied. Returns false
  // when a guard blocked it (FY-lock / period-lock / approved-under-maker-checker /
  // engine voucher / unbalanced) — the guard already showed the real reason, so callers
  // must NOT show a success toast on false (mirrors cancelVoucher's contract).
  updateVoucher: (id: string, data: Partial<Pick<Voucher, 'type' | 'date' | 'debitAccountId' | 'creditAccountId' | 'amount' | 'narration' | 'memberId' | 'lines' | 'costCentreId'>>, opts?: { viaParent?: boolean }) => boolean;
  /** X-4: rollback = an app flow taking back the voucher it just posted (no delete role needed — server withdraw_voucher).
   *  X-3: onCancelled / onFailed fire once the cloud has answered (the boolean only says the cancel was STARTED). */
  cancelVoucher: (id: string, reason: string, deletedBy: string, opts?: { viaParent?: boolean; rollback?: boolean; onCancelled?: () => void; onFailed?: (message: string) => void }) => boolean;
  /** ARCH-07: the refusals every DataContext mutation applies, for a page that writes its own table (TDS register, bank
   *  reconciliation, loan accruals, distribution runs): offline / failed load, role, FY lock, expired plan (new entries
   *  only) and period lock on every supplied date. Returns TRUE when BLOCKED and has already told the user why. */
  guardPageWrite: (action: 'create' | 'update' | 'delete', ...dates: (string | undefined)[]) => boolean;
  /** H: a domain context registers who owns its vouchers; returns the unregister fn. */
  registerVoucherOwner: (key: string, check: VoucherOwnerCheck) => () => void;
  /** X-5: told about every CONFIRMED direct cancel of a voucher whose refType it lists (takes the amount back off its document). */
  registerVoucherCancelFollower: (key: string, follower: VoucherCancelFollower) => () => void;
  /** RM-17: the ledger(s) a document's GST goes to — head-wise, or the combined 2201 / 3310 (lib/accounting/gstLedgers). */
  gstLegs: (side: GstSide, parts: { cgst?: number; sgst?: number; igst?: number; total: number }, opts?: { legacy?: boolean }) => GstLeg[];
  /** S2: which skippable tables (src/lib/emptyTables.ts) hold no rows for this society — one shared call. */
  knownEmptyTables: (sid: string) => Promise<ReadonlySet<string>>;
  reverseVoucher: (id: string, reason: string) => Voucher | null;
  /** Migration 205: cheque / DD no. and date on an existing voucher. false = a guard refused it. */
  setVoucherCheque: (id: string, chequeNo: string | undefined, chequeDate: string | undefined) => boolean;
  /** T-20: post the year-end statutory appropriation of net surplus as ONE balanced voucher through
   *  the canonical engine (effective-dated UCAS rates). Flag-gated (society.statutoryAppropriation).
   *  Returns the posted voucher, or null when blocked/refused (a toast explains why). */
  addStatutoryAppropriation: (opts: { date: string; narration?: string; discretionary?: { dividend?: number }; attestation: AuthorityAttestation }) => Voucher | null;
  /** true when the restore was applied (a later cloud failure rolls back with its own toast); false = blocked, already toasted. */
  restoreVoucher: (id: string) => boolean;
  /** True when this society saves through the posting service (society_flags.posting_service): a new
   *  sale/purchase number is then issued by the server AFTER addSale/addPurchase returns — pages show the
   *  number from the list (restamped) and leave the success toast to DataContext. */
  usesPostingService: () => boolean;
  /** True when an edit may change a voucher's activity tag (costCentreId): the posting service is off (the
   *  client writes the column itself) or the server has migration 127. False → show the tag read-only. */
  canEditVoucherActivity: () => boolean;
  clearVoucher: (id: string, clearedDate?: string) => void;
  unclearVoucher: (id: string) => void;
  /** true = approved; false = a guard blocked it (it already toasted why) — never toast success on false. */
  approveVoucher: (id: string, approvedBy: string) => boolean;
  /** true = rejected; false = a guard blocked it (it already toasted why). */
  rejectVoucher: (id: string, rejectedBy: string, reason: string) => boolean;
  auditObjections: AuditObjection[];
  addAuditObjection: (data: Omit<AuditObjection, 'id' | 'objectionNo' | 'createdAt'>) => AuditObjection;
  updateAuditObjection: (id: string, data: Partial<AuditObjection>) => void;
  deleteAuditObjection: (id: string) => void;

  // Recoverables (HAFED Proforma 2)
  recoverables: Recoverable[];
  addRecoverable: (data: Omit<Recoverable, 'id' | 'createdAt'>) => Recoverable;
  updateRecoverable: (id: string, data: Partial<Recoverable>) => void;
  deleteRecoverable: (id: string) => void;

  // Kachi Aarat (HAFED Proforma 8)
  kachiAaratEntries: KachiAaratEntry[];
  addKachiAaratEntry: (data: Omit<KachiAaratEntry, 'id' | 'createdAt'>) => KachiAaratEntry;
  updateKachiAaratEntry: (id: string, data: Partial<KachiAaratEntry>) => void;
  deleteKachiAaratEntry: (id: string) => void;

  // P7 Entries (HAFED Proforma 7 — Rent/Transport/Consumer)
  p7Entries: P7Entry[];
  upsertP7Entry: (data: Omit<P7Entry, 'id' | 'createdAt'> & { id?: string }) => P7Entry;
  deleteP7Entry: (id: string) => void;

  addMember: (data: Omit<Member, 'id'>, opts?: { quiet?: boolean; onSaved?: (m: Member) => void; onFailed?: () => void }) => Member;
  updateMember: (id: string, data: Partial<Member>, opts?: { onSaved?: (saved?: Member) => void }) => boolean;
  changeMemberStatus: (id: string, newStatus: MemberStatus, reason: string, opts?: { effectiveDate?: string; resolutionNo?: string; resolutionDate?: string; details?: Record<string, unknown> }) => boolean;
  /** `domain`: the housing / dairy / portal records the Members page sees (they also block the delete). */
  deleteMember: (id: string, domain?: MemberDomainLinkSources) => void;
  uploadMemberPhoto: (id: string, file: File) => Promise<boolean>;
  removeMemberPhoto: (id: string) => Promise<boolean>;
  memberPhotoUrl: (path: string | undefined) => Promise<string | null>;
  refundShareCapital: (memberId: string, amount: number, mode: 'cash' | 'bank', date: string) => void;
  /** Two-step refund: committee approval (Dr Share Capital / Cr Share Refund Payable) … */
  approveShareRefund: (memberId: string, amount: number, date: string, resolution: string) => boolean;
  /** … and the later payment (Dr Share Refund Payable / Cr Cash-Bank). */
  payShareRefund: (memberId: string, amount: number, mode: 'cash' | 'bank', date: string) => boolean;
  purchaseShareCapital: (memberId: string, amount: number, mode: 'cash' | 'bank', date: string) => void;
  transferShareCapital: (fromMemberId: string, toMemberId: string, amount: number, date: string, premium?: number, opts?: { mode?: 'cash' | 'bank'; reserveAccountId?: string }) => void;
  shareOperation: (memberId: string, type: ShareOpType, amount: number, opts?: { mode?: 'cash' | 'bank'; reserveAccountId?: string; date?: string; reason?: string }) => boolean;
  getMemberShareReconciliation: (memberId: string) => ShareCapitalReconciliation | null;


  workOrders: WorkOrder[];
  addWorkOrder: (data: Omit<WorkOrder, 'id' | 'createdAt'>) => WorkOrder;
  updateWorkOrder: (id: string, data: Partial<WorkOrder>) => void;
  deleteWorkOrder: (id: string) => void;

  musterEntries: MusterEntry[];
  addMusterEntry: (data: Omit<MusterEntry, 'id' | 'createdAt'>) => MusterEntry;
  updateMusterEntry: (id: string, data: Partial<MusterEntry>) => void;
  deleteMusterEntry: (id: string) => void;
  payWages: (data: { workOrderId: string; period: string; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; reference?: string; remarks?: string; allocations: { entryId: string; amount: number }[] }) => Voucher;
  approveMember: (id: string, decision?: AdmissionDecision) => void;
  rejectMember: (id: string, reason: string) => void;

  /** opts.onSaved fires once the account row is in the cloud; opts.onFailed after a refused/failed save (rolled back). */
  addAccount: (data: Omit<LedgerAccount, 'id'>, opts?: { id?: string; onSaved?: (a: LedgerAccount) => void; onFailed?: () => void }) => LedgerAccount;
  updateAccount: (id: string, data: Partial<LedgerAccount>, opts?: { onSaved?: () => void; onFailed?: (message: string) => void }) => boolean;
  /** Give a readable code (accounts.code, migration 109) to every account whose id is a UUID and
   *  has none. Explicit admin action — the load path never writes (RM-01). */
  assignMissingAccountCodes: () => Promise<{ assigned: number; failed: number; refused?: boolean }>;
  deleteAccount: (id: string) => boolean;
  /** Resolves null when a guard blocked the merge or the save failed (each shows its own toast). */
  mergeAccounts: (keepId: string, removeId: string) => Promise<AccountMergeResult | null>;
  resetAccounts: (templateAccounts: LedgerAccount[]) => Promise<boolean>;
  /** opts.onSaved fires once the cloud accepted the save (with any un-migrated columns that were trimmed
   *  from it — those values did NOT persist); opts.onFailed after a refusal was rolled back
   *  (e.g. the server refusing an FY rollover — migration 090). Callers announce success only in onSaved. */
  updateSociety: (data: Partial<SocietySettings>, opts?: { onSaved?: (droppedColumns: string[]) => void; onFailed?: (message: string) => void }) => void;
  /** T-23: lock the FY as a finalization. When society.fyCloseAuthorityRequired is on, a valid board
   *  resolution must authorize it (else refused). Returns true when locked. */
  closeFinancialYear: (opts?: { attestation?: AuthorityAttestation }) => boolean;

  addLoan: (data: Omit<Loan, 'id' | 'loanNo' | 'createdAt'>) => Loan;
  /** NEW-08: returns false when a guard refused up front; onSaved runs only once the cloud write landed. */
  updateLoan: (id: string, data: Partial<Loan>, opts?: { onSaved?: () => void }) => boolean;
  deleteLoan: (id: string) => void;

  addAsset: (data: Omit<Asset, 'id' | 'assetNo'>, opts?: { capitalize?: boolean; mode?: 'cash' | 'bank' }) => Asset;
  updateAsset: (id: string, data: Partial<Asset>) => void;
  disposeAsset: (id: string, opts: { saleProceeds: number; mode: 'cash' | 'bank'; date: string }) => boolean;
  deleteAsset: (id: string) => void;
  postDepreciation: (fy?: string) => { posted: number; skipped: number };

  // Inventory
  stockItems: StockItem[];
  stockMovements: StockMovement[];
  /** RULE 2/3: movements reconciled to live purchase/sale records — use for stock QUANTITY/VALUE
   *  (Inventory, Sale availability, Valuation, Closing Stock). Raw `stockMovements` is for history display only. */
  reconciledStockMovements: StockMovement[];
  addStockItem: (data: Omit<StockItem, 'id' | 'itemCode'>, opts?: { onSaved?: (i: StockItem) => void; onFailed?: () => void }) => StockItem;
  updateStockItem: (id: string, data: Partial<StockItem>) => void;
  deleteStockItem: (id: string) => void;
  addStockMovement: (data: Omit<StockMovement, 'id' | 'createdAt'>, opts?: { onSaved?: () => void; onFailed?: (message: string) => void }) => void;
  transferStock: (input: { itemId: string; fromGodownId: string; toGodownId: string; qty: number; date?: string }) => boolean;
  // Godown shortage (HAFED 9.19 / 10.20): false = a guard refused it at once; otherwise onDone reports the cloud result.
  recordStockShortage: (input: { itemId: string; qty: number; rate: number; date: string; person: string; narration?: string; godownId?: string; onDone?: (ok: boolean, voucherNo?: string) => void }) => boolean;
  reverseStockShortage: (movementId: string, reason: string, onDone?: (ok: boolean) => void) => boolean;
  writeOffShortage: (input: { personAccountId: string; amount: number; date: string; resolutionNo: string; onDone?: (ok: boolean) => void }) => boolean;

  // Sales
  sales: Sale[];
  addSale: (data: Omit<Sale, 'id' | 'saleNo' | 'createdAt'>) => Sale;
  updateSale: (id: string, data: Omit<Sale, 'id' | 'saleNo' | 'createdAt'>) => Sale | null;
  deleteSale: (id: string) => boolean;
  addBillReceipt: (data: { customerId: string; date: string; paymentMode: 'cash' | 'bank'; bankAccountId?: string; allocations: { saleId: string; amount: number }[]; advance?: number; onAccount?: number; narration?: string }) => Voucher | null;
  addBillPayment: (data: { supplierId: string; date: string; paymentMode: 'cash' | 'bank'; bankAccountId?: string; allocations: { purchaseId: string; amount: number }[]; advance?: number; onAccount?: number; narration?: string }) => Voucher | null;

  // Purchases
  purchases: Purchase[];
  addPurchase: (data: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt'>) => Purchase;
  updatePurchase: (id: string, data: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt'>) => Purchase | null;
  deletePurchase: (id: string) => boolean;

  // Suppliers
  suppliers: Supplier[];
  /** The supplier and its ledger account are saved together: onSaved once BOTH are in the cloud; if either fails both are rolled back and onFailed fires. */
  addSupplier: (data: Omit<Supplier, 'id' | 'supplierCode' | 'accountId' | 'createdAt'>, opts?: { onSaved?: (s: Supplier) => void; onFailed?: () => void }) => Supplier;
  updateSupplier: (id: string, data: Partial<Omit<Supplier, 'id' | 'supplierCode' | 'accountId' | 'createdAt'>>) => void;
  deleteSupplier: (id: string) => void;

  // Customers
  customers: Customer[];
  /** Same contract as addSupplier (customer + its ledger account saved together). */
  addCustomer: (data: Omit<Customer, 'id' | 'customerCode' | 'accountId' | 'createdAt'>, opts?: { onSaved?: (c: Customer) => void; onFailed?: () => void }) => Customer;
  updateCustomer: (id: string, data: Partial<Omit<Customer, 'id' | 'customerCode' | 'accountId' | 'createdAt'>>) => void;
  deleteCustomer: (id: string) => void;

  // Employees & Salary
  employees: Employee[];
  addEmployee: (data: Omit<Employee, 'id' | 'empNo'>) => Employee;
  updateEmployee: (id: string, data: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  salaryRecords: SalaryRecord[];
  addSalaryRecord: (data: Omit<SalaryRecord, 'id' | 'slipNo' | 'createdAt'>) => SalaryRecord;
  /** true = saved; false = refused (a toast says why). */
  updateSalaryRecord: (id: string, data: Partial<SalaryRecord>) => boolean;
  deleteSalaryRecord: (id: string) => void;

  kccLoans: KccLoan[];

  getAccountBalance: (accountId: string) => number;
  getShareCapitalReconciliation: () => ShareCapitalReconciliation;
  getAssetRegisterReconciliation: () => AssetReconciliation;   // ECR-05: register cost vs fixed-asset ledger
  getCashBookEntries: (fromDate?: string, toDate?: string) => CashBookEntry[];
  getBankBookEntries: (fromDate?: string, toDate?: string, bankAccountId?: string) => BankBookEntry[];
  getTrialBalance: (asOnDate?: string) => AccountBalance[];
  /** T-06 shadow dual-write: the immutable ledger events emitted this session as vouchers are
   *  posted. Read-only; reporting still derives from vouchers (the ledger cutover is T-09). */
  getLedgerEvents: () => LedgerEvent[];
  /** RM-01: read-only report of what the removed load-time writers used to "fix" — suspected phantom
   *  member vouchers and sale/purchase ↔ voucher gaps. Never mutates anything. */
  getPhantomVoucherDiagnostics: () => PhantomVoucherDiagnostics;
  /** T-09 pre-flight: does the journal reproduce every report this tenant reads? Read-only — the
   *  answer that decides whether `ledgerReadsEnabled` is safe to flip. Surfaced on Ledger Hygiene. */
  getLedgerReportParity: () => LedgerParitySnapshot;
  /** T-09: page the full event journal into memory (a tenant that is not cut over does not load it
   *  at startup). Needed before the pre-flight above can prove anything. Returns the event count. */
  loadLedgerJournal: () => Promise<number>;
  // M15: All point-in-time aggregators accept asOnDate so Day Book / Balance Sheet
  // historical lookups don't silently show current-day numbers.
  getMemberLedger: (memberId: string) => MemberLedgerEntry[];
  getProfitLoss: (asOnDate?: string) => {
    incomeItems: { name: string; nameHi: string; amount: number }[];
    expenseItems: { name: string; nameHi: string; amount: number }[];
    totalIncome: number;
    totalExpenses: number;
    /** ACC-03: THIS financial year's result only. */
    netProfit: number;
    /** Result earlier, not-yet-closed years left on income/expense accounts (0 once closed). */
    priorUnclosed: number;
    /** netProfit + priorUnclosed — what a Balance Sheet carries so it ties. */
    balanceSheetResult: number;
  };
  getReceiptsPayments: (asOnDate?: string) => ReceiptsPaymentsData;
  // ECR-27: spend a statutory fund (Dr fund / Cr cash|bank). Balance-guarded, FY-locked,
  // and >₹50,000 needs a committee/AGM resolution. Returns null if blocked.
  recordFundUtilisation: (data: { fundAccountId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; purpose?: string; resolutionNo?: string }) => Voucher | null;
  getTradingAccount: (asOnDate?: string) => {
    salesItems:        { name: string; nameHi: string; amount: number }[];
    closingStockItems: { name: string; nameHi: string; amount: number }[];
    openingStockItems: { name: string; nameHi: string; amount: number }[];
    purchaseItems:     { name: string; nameHi: string; amount: number }[];
    directExpItems:    { name: string; nameHi: string; amount: number }[];
    totalSales: number; totalClosingStock: number;
    totalOpeningStock: number; totalPurchases: number; totalDirectExp: number;
    grossProfit: number;
    physicalClosingStock: number;    // computed from stockItems, used when no ledger closing stock
    closingStockPosted: boolean;     // true if a closing stock journal exists for current FY
    tracksStock: boolean;            // YE-01: the society keeps tracked stock items (physical 0 = all sold)
    procuredToStock: number;         // goods bought straight into a 3400 stock head (a Dr-side purchase)
    legacyPurchaseGrossUp: number;   // closing stock added back to 5101 when the LEGACY journal reduced it
    activities: { key: string; keyHi: string; salesId: string; purchaseId: string; sales: number; purchases: number; hasRoutedPurchase: boolean; grossMargin: number }[];
    unallocated: { purchases: number; directExp: number; otherSales: number };
  };
  postClosingStock: (fy?: string) => { posted: boolean; amount: number; alreadyPosted: boolean };
  getEntityLinks: (entityType: 'member' | 'customer' | 'supplier' | 'stockItem' | 'employee' | 'account' | 'loan' | 'asset', id: string, domain?: MemberDomainLinkSources) => EntityLink[];
  isLoading: boolean;
}

// ── ECR-08 (P1 #8): reversal-not-edit pure helpers — extracted to @/lib/voucherReversal
//    (reverseEntryLines / isEditLocked), imported above, so they are unit-testable. ──────────

// ── ECR-16 (member lifecycle) — the pure status model now lives in @/lib/memberLifecycle
//    (MEMBER_STATUSES / canTransitionMember / isMemberActive), imported above, so it is
//    unit-testable in isolation. ──────────────────────────────────────────────────────────

/** Report a secondary / CASCADE Supabase write failure (audit P0-2). These are the RULE-3
 *  ghost-data risks — a linked voucher left un-cancelled, a stock movement not deleted, a stock
 *  or share or deposit balance left inconsistent — that previously died at a bare console.error
 *  with no durable trace. Keeps the dev-console line AND records it in error_log. Never throws. */
const localOnlyReported = new Set<string>();   // per page load — see localOnlyAccountsReport
function reportCascade(label: string, err: { message: string } | string): void {
  const msg = typeof err === 'string' ? err : err.message;
  console.error(`${label}:`, msg);
  reportError('cascade-sync', msg, { label });
}

/** Undo an optimistic removal: put the row back unless it is already there. */
function putBack<T extends { id: string }>(list: T[], row: T | undefined): T[] {
  return !row || list.some(x => x.id === row.id) ? list : [...list, row];
}

/** Migration 127 probe: true = edit_voucher/save_pending_voucher keep an edited activity tag; false = they
 *  don't (voucher_edit_capabilities() absent → PostgREST PGRST202 / Postgres 42883); null = unknown (network). */
async function probeActivityTagEditable(): Promise<boolean | null> {
  try {
    const { data, error } = await supabase.rpc('voucher_edit_capabilities');
    if (error) return error.code === 'PGRST202' || error.code === '42883' ? false : null;
    return (data as { activityTag?: boolean } | null)?.activityTag === true;
  } catch { return null; }
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);
  // Tally-style ledger-balance guard reads the live account balance through this ref. It is kept
  // in sync further below (right after getAccountBalance is defined), so the early-declared delete
  // guards — deleteAccount/deleteSupplier/deleteCustomer — can all consult the same source.
  const accountBalanceFnRef = useRef<(accountId: string) => number>(() => 0);
  const societyIdRef = useRef(user?.societyId || 'SOC001');
  // Keep ref updated when user changes
  useEffect(() => { societyIdRef.current = user?.societyId || 'SOC001'; }, [user?.societyId]);
  // T-01 (ADR-0009 / Canonical CL-5): the society's jurisdiction code, kept in a ref and
  // synced from society.state below (where societyRef is synced). Resolved by the SSOT so
  // every stamped row uses the same code.
  const jurisdictionRef = useRef('');
  // Helper: stamps BOTH tenancy keys (society_id, jurisdiction) onto any Supabase record —
  // the SINGLE seam every write goes through (T-01, anti-IRR-4). stampTenant is the tested,
  // pure primitive; the row's tenancy is set by context, never by whatever it carried.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withSoc = (d: Record<string, any>): LooseRow => stampTenant(d, { societyId: societyIdRef.current, jurisdiction: jurisdictionRef.current });
  // Member PII split (Phase 2, docs/reports-audit/design/MEMBER-PII-ROLE-SCOPED-READ.md). true once the
  // member_identity table is found at load: from then on `members` upserts never carry aadhaar/pan
  // (they would re-expose PII to every role) and PII is saved to member_identity instead. false =
  // LEGACY (table not migrated yet): behaviour is exactly as before, nothing is lost.
  const identitySplitRef = useRef(false);
  // DB-09 (migration 195): the same split for customers / suppliers / farmers / employees — true once party_identity is
  // found at load. Then party rows never carry PAN / bank / Aadhaar; they are read from / written to party_identity.
  const partySplitRef = useRef(false);
  // M2: the admission columns (migration 116) never ride the base upsert — persistMemberAdmission writes them after.
  const memberRow = (m: Record<string, any>): LooseRow => {
    const base: Record<string, any> = splitAdmissionFields(identitySplitRef.current ? stripMemberPII(m) : m).base;
    for (const f of MEMBER_STATUS_EXTRA_FIELDS) delete base[f];   // M4: migration-117 columns ride their own update
    delete base.statusDetails;   // stage C (migration 125): its own update in changeMemberStatus, never the base upsert
    for (const f of MEMBER_PROFILE_FIELDS) delete base[f];        // M5: migration-118 columns ride their own update
    for (const f of MEMBER_CONTACT_FIELDS) delete base[f];        // M6: migration-119 columns ride their own update
    delete base[MEMBER_PHOTO_FIELD];                              // M6: set only by uploadMemberPhoto / removeMemberPhoto
    return withSoc(base);
  };
  // M6 step 2: the correspondence address in its own update (119) — a missing 119 must not drop gender / DOB (118).
  const persistMemberContact = (id: string, member: Record<string, any>, touched: boolean) => {
    if (!touched) return;
    const patch: Record<string, string | null> = {};
    for (const f of MEMBER_CONTACT_FIELDS) patch[f] = member[f] || null;
    supabase.from('members').update(patch).eq('id', id).then(({ error }) => {
      if (!error) return;
      reportError('write-partial', error.message, { at: 'member contact fields' });
      toastRef.current({ title: tr('सदस्य सेव हुआ — पर पत्राचार का पता नहीं', 'Member saved — but not the correspondence address'), description: tr(`पत्राचार का पता सेव नहीं हुआ (${error.message})। Migration 119 चलाएँ, फिर दोबारा सेव करें।`, `Correspondence address not saved (${error.message}). Run Migration 119, then save again.`), duration: 10000 });
    });
  };
  // M5 step 2: gender / date of birth in their own update (a missing 118 must not drop the admission fields).
  const persistMemberProfile = (id: string, member: Record<string, any>, touched: boolean) => {
    if (!touched) return;
    const patch: Record<string, string | null> = {};
    for (const f of MEMBER_PROFILE_FIELDS) patch[f] = member[f] || null;
    supabase.from('members').update(patch).eq('id', id).then(({ error }) => {
      if (!error) return;
      reportError('write-partial', error.message, { at: 'member profile fields' });
      toastRef.current({ title: tr('सदस्य सेव हुआ — पर लिंग/जन्मतिथि नहीं', 'Member saved — but not gender/date of birth'), description: tr(`लिंग या जन्मतिथि सेव नहीं हुई (${error.message})। Migration 118 चलाएँ, फिर सदस्य को दोबारा सेव करें।`, `Gender or date of birth not saved (${error.message}). Run Migration 118, then save the member again.`), duration: 10000 });
    });
  };
  // RULE 1 step 2 for the admission columns: the member row is already safe; a failure here (migration 116 not run)
  // keeps the member and says so mildly — no rollback.
  const persistMemberAdmission = (id: string, member: Record<string, any>, cleared: readonly string[] = []) => {
    const { extras } = splitAdmissionFields(member);
    // A blanked field is written as null — leaving it out kept the old value in the cloud (M-4).
    const payload: Record<string, string | null> = { ...extras, ...Object.fromEntries(cleared.map(f => [f, null])) };
    if (!Object.keys(payload).length) return;
    supabase.from('members').update(payload).eq('id', id).then(({ error }) => {
      if (!error) return;
      reportError('write-partial', error.message, { at: 'member admission fields' });
      toastRef.current({
        title: tr('सदस्य सेव हुआ — पर दाख़िले की जानकारी नहीं', 'Member saved — but not the admission details'),
        description: tr(`आवेदन/दाख़िला तिथि, प्रस्ताव संख्या या अस्वीकृति का कारण सेव नहीं हुआ (${error.message})। Migration 116 चलाएँ, फिर सदस्य को दोबारा सेव करें।`, `Application/admission date, resolution number or rejection reason not saved (${error.message}). Run Migration 116, then save the member again.`),
        duration: 10000,
      });
    });
  };

  // T-06 · best-effort append of a shadow ledger event to the WORM ledger_events table. Fire-and-
  // forget: the voucher save is authoritative and this never blocks or affects it; a failed insert
  // is logged and dropped (the in-memory event remains for the session). Maps the LedgerEvent
  // (built by buildEvent) onto the existing ledger_events columns — no new schema.
  // The LedgerEvent → ledger_events row mapping, in ONE place (RULE 2). Used by the best-effort shadow
  // append (persistLedgerEvent) and the journal-first AUTHORITATIVE append (persistEventAuthoritative).
  const toLedgerEventRow = (ev: LedgerEvent): LooseRow => ({
    event_id: ev.eventId,
    event_type: ev.eventType,
    schema_version: ev.schemaVersion,
    society_id: ev.tenantId,
    jurisdiction: ev.jurisdiction || null,
    aggregate_type: ev.aggregateType,
    aggregate_id: ev.aggregateId,
    sequence: ev.sequence,
    occurred_at: ev.occurredAt,
    producer_kind: ev.producer.kind,
    producer_id: ev.producer.id ?? null,
    on_behalf_of: ev.producer.onBehalfOf ?? null,
    reversal_of: ev.reversalOf ?? null,
    payload: ev.payload,
  });
  // A failed append stays best-effort for the SAVE, but it must never be silent: Assandh (ddcb71c2)
  // lost the journal for 451 of 452 vouchers (2026-07-16 → 08-19) and the cause is unknowable because
  // this only ever reached the browser console. Every failure now lands in error_log with its code.
  const persistLedgerEvent = (ev: LedgerEvent) => {
    const report = (msg: string, code?: string) => {
      console.warn('ledger_events append (best-effort):', msg);
      reportError('ledger-event-append', msg, { eventType: ev.eventType, aggregateId: ev.aggregateId, sequence: ev.sequence, code: code ?? null });
    };
    try {
      supabase.from('ledger_events').insert(toLedgerEventRow(ev))
        .then(({ error }) => { if (error) report(error.message, error.code); },
              (e: unknown) => report(e instanceof Error ? e.message : String(e)));
    } catch (e) { report(e instanceof Error ? e.message : String(e)); }   // never affects the voucher save
  };
  // journal-first-write (slice 4): the AUTHORITATIVE append IO — insert + verify the event persisted.
  // Passed to persistEventAuthoritative so a voucher's save is a durable, confirmed journal write.
  const ledgerAppendIO = {
    insert: async (ev: LedgerEvent): Promise<{ error: string | null }> => {
      const { error } = await supabase.from('ledger_events').insert(toLedgerEventRow(ev));
      return { error: error?.message ?? null };
    },
    verify: async (eventId: string): Promise<{ found: boolean; error: string | null }> => {
      const { data, error } = await supabase.from('ledger_events').select('event_id').eq('event_id', eventId).limit(1);
      return { found: !!data && data.length > 0, error: error?.message ?? null };
    },
    // journal-first-write (slice 6): atomic batch insert for a multi-event append — an EDIT journals a
    // reverse+repost PAIR that must land whole or not at all (a half-written pair on a WORM log is a
    // permanent parity break). One insert() call with an array = one atomic statement.
    insertMany: async (events: LedgerEvent[]): Promise<{ error: string | null }> => {
      const { error } = await supabase.from('ledger_events').insert(events.map(toLedgerEventRow));
      return { error: error?.message ?? null };
    },
    // Bulk read-back for a large batch (an account merge journals two events per moved voucher) —
    // chunked so the `in (...)` filter stays well inside the URL limit.
    verifyMany: async (eventIds: string[]): Promise<{ found: string[]; error: string | null }> => {
      const found: string[] = [];
      for (let i = 0; i < eventIds.length; i += 100) {
        const { data, error } = await supabase.from('ledger_events').select('event_id').in('event_id', eventIds.slice(i, i + 100));
        if (error) return { found, error: error.message };
        for (const r of (data ?? []) as { event_id: string }[]) found.push(r.event_id);
      }
      return { found, error: null };
    },
  };
  // Live-cancel hardening (journal-drift fix). cancelVoucher appends its reversing `voucher.cancelled`
  // ONLY when the voucher's posting is already in the in-memory journal (ledgerEventsRef). For a tenant
  // whose FULL journal was NOT loaded at cancel time — ledgerReads off, a failed/in-flight/truncated
  // load — that posting is absent from the ref even though ledger_events HAS it, so the guard sees "no
  // posting", appends nothing, and the journal keeps a LIVE voucher.posted for a cancelled voucher: a
  // parity break (the raw-journal D-lane then over-counts it). This best-effort async check runs ONLY
  // when the journal wasn't loaded (the sync path already handles the loaded case). It fetches THIS
  // voucher's events from the DB (ground truth) and, IFF a posting exists with no cancel yet, appends
  // the reversing voucher.cancelled — sequence from the FETCHED events (the empty ref would give seq 1
  // and collide on the unique index). It NEVER appends when there is no posting: that would be an orphan
  // reversal (legs cancelling nothing), the exact CV/320/329 parity break scripts/reconcile-cancelled-
  // ledger.mjs exists to repair. Idempotent: skips if a voucher.cancelled already exists.
  const flipLegs = (payload: unknown): { accountId: string; drCr: 'Dr' | 'Cr'; amountMinor: number }[] | null => {
    const ls = (payload as { lines?: { accountId: string; drCr: 'Dr' | 'Cr'; amountMinor: number }[] } | null)?.lines;
    return Array.isArray(ls) && ls.length ? ls.map(l => ({ accountId: l.accountId, drCr: l.drCr === 'Dr' ? 'Cr' as const : 'Dr' as const, amountMinor: l.amountMinor })) : null;
  };
  const ensureVoucherCancelEvent = async (voucher: Voucher, deletedBy: string, reason: string) => {
    try {
      const { data, error } = await supabase.from('ledger_events')
        .select('event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type, aggregate_id, sequence, occurred_at, producer_kind, producer_id, on_behalf_of, reversal_of, payload')
        .eq('aggregate_type', 'voucher').eq('aggregate_id', voucher.id);
      if (error || !data) return;
      const evs = mapLedgerEventRows(data);
      const posting = currentPostingEventId(evs, voucher.id);
      if (!posting) return;                                              // no posting → appending would orphan
      if (evs.some(e => e.eventType === 'voucher.cancelled')) return;    // already reconciled — idempotent
      const maxSeq = evs.reduce((m, e) => Math.max(m, e.sequence || 0), 0);
      const cancelEvent = buildEvent({
        eventType: 'voucher.cancelled',
        tenantId: societyIdRef.current,
        jurisdiction: jurisdictionRef.current,
        aggregateType: 'voucher',
        aggregateId: voucher.id,
        sequence: maxSeq + 1,
        reversalOf: posting,
        producer: { kind: 'human', id: deletedBy ?? null },
        // Reverse what the JOURNAL holds (its current posting's legs), not the voucher's own legs — they
        // differ when an earlier edit never reached the journal, and only the former nets to zero.
        payload: { lines: flipLegs(evs.find(e => e.eventId === posting)?.payload) ?? voucherReversalLines(voucher), ...voucherEventMeta(voucher), reason },
      }, { eventId: crypto.randomUUID(), occurredAt: new Date().toISOString() });
      const { error: insErr } = await supabase.from('ledger_events').insert(toLedgerEventRow(cancelEvent));
      if (insErr) { console.warn('ensureVoucherCancelEvent append (best-effort):', insErr.message); reportError('voucher-cancel-journal', insErr.message, { voucherId: voucher.id }); }
      else if (journalLoadedRef.current && !ledgerEventsRef.current.some(e => e.aggregateId === voucher.id && e.eventType === 'voucher.cancelled')) {
        ledgerEventsRef.current = [...ledgerEventsRef.current, cancelEvent];   // keep the in-session journal in step
      }
    } catch { /* best-effort — never affects the cancel */ }
  };
  // Edit hardening (same idea as ensureVoucherCancelEvent): the reverse-old + repost-new pair is built
  // from THIS voucher's events read from the DB, not from the in-memory ref. With the ref short (journal
  // not loaded, or not readable for the session), the edit used to append a second "voucher.posted
  // seq 1" — refused by the WORM log — and the journal kept the OLD legs for good (Assandh
  // JV/2026/27/2384, 2026-10-02). Appends atomically; a failure is shown, never only logged.
  const persistVoucherEditEvents = async (voucher: Voucher, newLegs: { accountId: string; drCr: 'Dr' | 'Cr'; amountMinor: number }[], optimistic: LedgerEvent[]) => {
    const fail = (msg: string) => {
      reportError('voucher-edit-journal', msg, { voucherId: voucher.id });
      toastRef.current({
        title: tr('⚠ वाउचर सेव हुआ, पर Journal अपडेट नहीं हुआ', '⚠ Voucher saved, but the Journal was not updated'),
        description: tr(`${voucher.voucherNo}: ${msg}. रिपोर्ट सही रहेंगी; admin को बताएँ ताकि journal ठीक किया जाए। / Voucher saved but the journal was not updated — reports stay correct; tell your admin.`, `${voucher.voucherNo}: ${msg}. Reports will stay correct; tell your admin so the journal can be fixed.`),
        variant: 'destructive', duration: 15000,
      });
    };
    try {
      const { data, error } = await supabase.from('ledger_events')
        .select('event_id, event_type, schema_version, society_id, jurisdiction, aggregate_type, aggregate_id, sequence, occurred_at, producer_kind, producer_id, on_behalf_of, reversal_of, payload')
        .eq('aggregate_type', 'voucher').eq('aggregate_id', voucher.id);
      if (error || !data) { fail(error?.message ?? 'journal read failed'); return; }
      const evs = mapLedgerEventRows(data);
      if (evs.some(e => e.eventType === 'voucher.cancelled')) return;   // cancelled — nothing to repost
      const posting = currentPostingEventId(evs, voucher.id);
      const maxSeq = evs.reduce((m, e) => Math.max(m, e.sequence || 0), 0);
      const at = new Date().toISOString();
      const base = {
        tenantId: societyIdRef.current, jurisdiction: jurisdictionRef.current,
        aggregateType: 'voucher' as const, aggregateId: voucher.id,
        producer: { kind: 'human' as const, id: userRef.current?.name ?? null },
      };
      const events: LedgerEvent[] = posting
        ? [
            // Reverse what the JOURNAL holds — it can differ from the voucher's old legs.
            buildEvent({ ...base, eventType: 'voucher.reversed', sequence: maxSeq + 1, reversalOf: posting, payload: { lines: flipLegs(evs.find(e => e.eventId === posting)?.payload) ?? [], ...voucherEventMeta(voucher), reason: 'edit' } }, { eventId: crypto.randomUUID(), occurredAt: at }),
            buildEvent({ ...base, eventType: 'voucher.reposted', sequence: maxSeq + 2, payload: { lines: newLegs, ...voucherEventMeta(voucher) } }, { eventId: crypto.randomUUID(), occurredAt: at }),
          ]
        : [buildEvent({ ...base, eventType: 'voucher.posted', sequence: maxSeq + 1, payload: { lines: newLegs, ...voucherEventMeta(voucher) } }, { eventId: crypto.randomUUID(), occurredAt: at })];
      if (posting && !(events[0].payload as { lines: unknown[] }).lines.length) { fail('journal posting has no legs to reverse'); return; }
      const { error: insErr } = await supabase.from('ledger_events').insert(events.map(toLedgerEventRow));
      if (insErr) { fail(insErr.message); return; }
      // Keep the in-session journal in step: swap the optimistic events for the ones actually written.
      ledgerEventsRef.current = [...ledgerEventsRef.current.filter(e => !optimistic.some(x => x.eventId === e.eventId)), ...events];
    } catch (e) { fail(e instanceof Error ? e.message : String(e)); }
  };
  // S3-e-2 · an APPROVED voucher must be in the journal. A pending voucher gets no voucher.posted when it
  // is created (addVoucher skips it), and approval used to flip the status only — 342 approved vouchers
  // since T-09 had no journal event (prod, 2026-09-29). After a table-first approval this checks the DB
  // journal (ground truth, not the maybe-unloaded ref) and appends voucher.posted IFF the voucher has no
  // posting and no cancel yet. Best-effort + idempotent; failures are reported, never block the approval.
  const ensureVoucherPostedEvent = async (voucher: Voucher, by: string) => {
    try {
      const { data, error } = await supabase.from('ledger_events').select('event_type, sequence')
        .eq('aggregate_type', 'voucher').eq('aggregate_id', voucher.id);
      if (error || !data) { if (error) reportError('voucher-approve-journal', error.message, { voucherId: voucher.id }); return; }
      if (data.some(e => e.event_type === 'voucher.posted' || e.event_type === 'voucher.reposted' || e.event_type === 'voucher.cancelled')) return;
      const maxSeq = data.reduce((m, e) => Math.max(m, (e.sequence as number) || 0), 0);
      const posted = buildEvent({
        eventType: 'voucher.posted', tenantId: societyIdRef.current, jurisdiction: jurisdictionRef.current,
        aggregateType: 'voucher', aggregateId: voucher.id, sequence: maxSeq + 1,
        producer: { kind: 'human', id: by ?? null },
        payload: { lines: voucherPostingLines(voucher), ...voucherEventMeta(voucher) },
      }, { eventId: crypto.randomUUID(), occurredAt: new Date().toISOString() });
      const { error: insErr } = await supabase.from('ledger_events').insert(toLedgerEventRow(posted));
      if (insErr) reportError('voucher-approve-journal', insErr.message, { voucherId: voucher.id });
      else if (journalLoadedRef.current && !ledgerEventsRef.current.some(e => e.aggregateId === voucher.id && e.eventType === 'voucher.posted')) {
        ledgerEventsRef.current = [...ledgerEventsRef.current, posted];
      }
    } catch (e) { reportError('voucher-approve-journal', e instanceof Error ? e.message : String(e), { voucherId: voucher.id }); }
  };

  // P0 #3: append-only audit. Actor is read from a ref so it is never stale inside the
  // delete/approve useCallbacks; emitAudit is fire-and-forget and never blocks the write.
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // T-06 · append-only event ledger (shadow dual-write). As vouchers are posted, addVoucher also
  // emits an immutable `voucher.posted` event via the tested buildEvent core. This is a SHADOW:
  // no read path consumes it (reporting still derives from vouchers), so it changes no behavior;
  // the ledger cutover that flips reports to the projection is T-09. In-memory this session.
  const ledgerEventsRef = useRef<LedgerEvent[]>([]);
  // S3-b: society_flags.posting_service — when true, a new posted voucher is saved by ONE server call
  // (post_voucher, migration 077) instead of the client's multi-call save.
  // ARCH-03 (migration 191): ON for every society. A missing row or a read error leaves it ON (the server's
  // posting_service_on() reads a missing row the same way); only an explicit false row turns the voucher-level
  // paths back to the client save. Sales / purchases ignore it — they save only through the server now.
  const postingServiceRef = useRef(true);
  // Migration 127: edit_voucher / save_pending_voucher keep an edited activity tag (costCentreId) only once
  // the founder has run it. Probed at load via voucher_edit_capabilities() (absent before 127 → stays false),
  // so the edit dialog never offers a tag change the server would silently drop (RULE 1).
  const activityTagEditableRef = useRef(false);
  // True once the FULL journal has been paged into the ref (society load for a cut-over tenant, or
  // the on-demand diagnostic load). Until then the ref holds only this session's events, so a
  // sequence derived from it would be too low and collide with a not-yet-loaded genesis event on the
  // WORM unique index — so live opening-delta events are held back until this is true.
  const journalLoadedRef = useRef(false);
  // The next per-aggregate sequence, from the in-session journal (the FULL log for a cut-over
  // tenant; session events otherwise). ledger_events has a unique (tenant, aggregate, sequence)
  // index, so a hardcoded sequence collides the SECOND time an aggregate is touched — e.g. a
  // voucher edited twice, or cancelled after an edit — and the event is silently dropped, breaking
  // parity for good. Every lifecycle emitter below asks this instead of hardcoding.
  const nextEventSeq = (aggregateType: string, aggregateId: string): number => {
    let max = 0;
    for (const e of ledgerEventsRef.current) {
      if (e.aggregateType === aggregateType && e.aggregateId === aggregateId && e.sequence > max) max = e.sequence;
    }
    return max + 1;
  };
  // T-09 auto-cutover · the journal's CURRENT signed opening (Dr − Cr, paise) for one account —
  // the `prevSignedMinor` a live opening-delta event must be computed against.
  const journalOpeningSignedMinor = (accountId: string): number => {
    let net = 0;
    for (const e of ledgerEventsRef.current) {
      if (e.aggregateType !== 'account' || e.aggregateId !== accountId || e.eventType !== 'account.opening') continue;
      const lines = (e.payload as { lines?: { drCr: 'Dr' | 'Cr'; amountMinor: number }[] })?.lines ?? [];
      for (const l of lines) net += l.drCr === 'Dr' ? l.amountMinor : -l.amountMinor;
    }
    return net;
  };
  const emitAudit = (input: AuditInput) => logAudit(input, {
    societyId: societyIdRef.current,
    actor: { name: userRef.current?.name, email: userRef.current?.email, role: userRef.current?.role },
  });

  const [vouchers, setVouchersState] = useState<Voucher[]>([]);
  const vouchersRef = useRef<Voucher[]>(vouchers);
  useEffect(() => { vouchersRef.current = vouchers; }, [vouchers]);

  // ── ECR-17 multi-branch (Phase 1) ──────────────────────────────────────────
  const [branches, setBranchesState] = useState<Branch[]>(() => { try { return JSON.parse(localStorage.getItem('sahayata_branches') || '[]'); } catch { return []; } });
  const [activeBranchId, setActiveBranchState] = useState<string>(() => localStorage.getItem('sahayata_active_branch') || ALL_BRANCHES);
  const activeBranchIdRef = useRef(activeBranchId);
  useEffect(() => { activeBranchIdRef.current = activeBranchId; }, [activeBranchId]);
  const headOfficeBranchId = branches.find(b => b.isHeadOffice)?.id;
  const headOfficeIdRef = useRef<string | undefined>(headOfficeBranchId);
  useEffect(() => { headOfficeIdRef.current = headOfficeBranchId; }, [headOfficeBranchId]);
  const cacheBranches = (b: Branch[]) => { try { localStorage.setItem('sahayata_branches', JSON.stringify(b)); } catch { /* quota */ } };
  // ── ECR-17 Phase 4b: RBAC branch-restriction ───────────────────────────────
  // A user with a home branch (user.branchId) is restricted to it: the active
  // branch is forced to that branch and cannot be switched away. Unset → society-wide.
  const restrictedBranchId = user?.branchId;
  const isBranchRestricted = !!restrictedBranchId;
  const restrictedBranchIdRef = useRef<string | undefined>(restrictedBranchId);
  useEffect(() => { restrictedBranchIdRef.current = restrictedBranchId; }, [restrictedBranchId]);
  // A restricted user can never leave their branch — collapse any switch to it.
  const setActiveBranch = useCallback((id: string) => {
    const target = resolveActiveBranch(restrictedBranchIdRef.current, id);
    setActiveBranchState(target);
    try { localStorage.setItem('sahayata_active_branch', target); } catch { /* quota */ }
  }, []);
  // Clamp on login / role change (also fixes a stale localStorage value from a prior session).
  useEffect(() => {
    if (restrictedBranchId && activeBranchId !== restrictedBranchId) {
      setActiveBranchState(restrictedBranchId);
      try { localStorage.setItem('sahayata_active_branch', restrictedBranchId); } catch { /* quota */ }
    }
  }, [restrictedBranchId, activeBranchId]);

  // Load branches for the society (best-effort; localStorage is the offline fallback).
  // `data` non-null (even []) always overwrites: the localStorage cache is GLOBAL, so after a
  // society switch it still holds the PREVIOUS society's branches — keeping them rendered a wrong
  // branch selector. Only a query error (data null) falls back to the cache.
  useEffect(() => {
    if (!user?.societyId) return;   // J6: logged out (public pages) → no society data to load
    supabase.from('branches').select('*').eq('society_id', societyIdRef.current)
      .then(({ data }) => { if (data) { const bs = data as Branch[]; setBranchesState(bs); cacheBranches(bs); } });
  }, [user?.societyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clamp a STALE active branch. `sahayata_active_branch` is a global key, so after a society
  // switch it can hold a branch id that does not exist here — matchesBranch would then reject
  // every voucher and all reports silently collapsed to just opening balances. Once the real
  // branch list is loaded, an id that isn't in it resets to 'all'. (A restricted user's clamp
  // above takes precedence — their branch always exists in their own society.)
  useEffect(() => {
    if (restrictedBranchId) return;
    if (activeBranchId !== ALL_BRANCHES && !branches.some(b => b.id === activeBranchId)) {
      setActiveBranchState(ALL_BRANCHES);
      try { localStorage.setItem('sahayata_active_branch', ALL_BRANCHES); } catch { /* quota */ }
    }
  }, [branches, activeBranchId, restrictedBranchId]);

  const addBranch = useCallback((data: Omit<Branch, 'id' | 'createdAt'>): Branch => {
    if (guardFYLocked()) return { ...data, id: '', createdAt: '' } as Branch;   // RULE 6: FY-lock guard
    if (guardPlanFeature('multiBranch')) return { ...data, id: '', createdAt: '' } as Branch;
    const branch: Branch = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(), isActive: data.isActive ?? true };
    let snapshot: Branch[] = [];
    setBranchesState(prev => {
      snapshot = prev;
      const demoted = branch.isHeadOffice ? prev.map(b => ({ ...b, isHeadOffice: false })) : prev; // only one Head Office
      const next = [...demoted, branch];
      cacheBranches(next);
      return next;
    });
    supabase.from('branches').upsert(withSoc({ ...branch })).then(({ error }) => {
      if (error) {   // RULE 1: roll back so a failed cloud save can't silently diverge on F5
        console.error('Branch save:', error.message);
        setBranchesState(() => { cacheBranches(snapshot); return snapshot; });
        toastRef.current({ title: tr('Branch सेव नहीं हुआ', 'Branch not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा।`, `Not saved to the cloud — ${error.message}. Nothing will go wrong on Refresh.`), variant: 'destructive', duration: 12000 });
      }
    });
    return branch;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateBranch = useCallback((id: string, data: Partial<Branch>) => {
    if (guardFYLocked()) return;   // RULE 6
    let snapshot: Branch[] = [];
    setBranchesState(prev => {
      snapshot = prev;
      let next = prev.map(b => b.id === id ? { ...b, ...data } : b);
      if (data.isHeadOffice) next = next.map(b => b.id === id ? b : { ...b, isHeadOffice: false });
      cacheBranches(next);
      return next;
    });
    supabase.from('branches').update(data).eq('id', id).then(({ error }) => {
      if (error) {   // RULE 1: restore prior state on failure
        console.error('Branch update:', error.message);
        setBranchesState(() => { cacheBranches(snapshot); return snapshot; });
        toastRef.current({ title: tr('Branch अपडेट नहीं हुआ', 'Branch not updated'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteBranch = useCallback((id: string) => {
    if (guardPermission('delete', tr('शाखा मिटाने', 'delete a branch'))) return;   // ECR-06: role gate
    if (guardFYLocked()) return;   // RULE 6
    let snapshot: Branch[] = [];
    setBranchesState(prev => { snapshot = prev; const next = prev.filter(b => b.id !== id); cacheBranches(next); return next; });
    if (activeBranchIdRef.current === id) setActiveBranch(ALL_BRANCHES);
    supabase.from('branches').delete().eq('id', id).then(({ error }) => {
      if (error) {   // RULE 1: restore the deleted row on failure
        console.error('Branch delete:', error.message);
        setBranchesState(() => { cacheBranches(snapshot); return snapshot; });
        toastRef.current({ title: tr('Branch delete नहीं हुआ', 'Branch not deleted'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर शाखा वापस आ जाएगी।`, `Not saved to the cloud — ${error.message}. On Refresh, the branch will come back.`), variant: 'destructive', duration: 12000 });
      }
    });
  }, [setActiveBranch]);

  // ── ECR-17 Phase 3: godowns ────────────────────────────────────────────────
  const [godowns, setGodownsState] = useState<Godown[]>(() => { try { return JSON.parse(localStorage.getItem('sahayata_godowns') || '[]'); } catch { return []; } });
  const [activeGodownId, setActiveGodownState] = useState<string>(() => localStorage.getItem('sahayata_active_godown') || '');
  const activeGodownIdRef = useRef(activeGodownId);
  useEffect(() => { activeGodownIdRef.current = activeGodownId; }, [activeGodownId]);
  const cacheGodowns = (g: Godown[]) => { try { localStorage.setItem('sahayata_godowns', JSON.stringify(g)); } catch { /* quota */ } };
  const setActiveGodown = useCallback((id: string) => { setActiveGodownState(id); try { localStorage.setItem('sahayata_active_godown', id); } catch { /* quota */ } }, []);
  useEffect(() => {
    if (!user?.societyId) return;   // J6: logged out → nothing to load
    supabase.from('godowns').select('*').eq('society_id', societyIdRef.current)
      .then(({ data }) => { if (data && data.length) { const gs = data as Godown[]; setGodownsState(gs); cacheGodowns(gs); } });
  }, [user?.societyId]); // eslint-disable-line react-hooks/exhaustive-deps
  const addGodown = useCallback((data: Omit<Godown, 'id' | 'createdAt'>): Godown => {
    if (guardFYLocked()) return { ...data, id: '', createdAt: '' } as Godown;   // RULE 6
    const g: Godown = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(), isActive: data.isActive ?? true };
    let snapshot: Godown[] = [];
    setGodownsState(prev => { snapshot = prev; const next = [...prev, g]; cacheGodowns(next); return next; });
    supabase.from('godowns').upsert(withSoc({ ...g })).then(({ error }) => {
      if (error) {   // RULE 1
        console.error('Godown save:', error.message);
        setGodownsState(() => { cacheGodowns(snapshot); return snapshot; });
        toastRef.current({ title: tr('Godown सेव नहीं हुआ', 'Godown not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा।`, `Not saved to the cloud — ${error.message}. Nothing will go wrong on Refresh.`), variant: 'destructive', duration: 12000 });
      }
    });
    return g;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const updateGodown = useCallback((id: string, data: Partial<Godown>) => {
    if (guardFYLocked()) return;   // RULE 6
    let snapshot: Godown[] = [];
    setGodownsState(prev => { snapshot = prev; const next = prev.map(g => g.id === id ? { ...g, ...data } : g); cacheGodowns(next); return next; });
    supabase.from('godowns').update(data).eq('id', id).then(({ error }) => {
      if (error) {   // RULE 1
        console.error('Godown update:', error.message);
        setGodownsState(() => { cacheGodowns(snapshot); return snapshot; });
        toastRef.current({ title: tr('Godown अपडेट नहीं हुआ', 'Godown not updated'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const deleteGodown = useCallback((id: string) => {
    if (guardPermission('delete', tr('गोदाम मिटाने', 'delete a godown'))) return;   // ECR-06: role gate
    if (guardFYLocked()) return;   // RULE 6
    let snapshot: Godown[] = [];
    setGodownsState(prev => { snapshot = prev; const next = prev.filter(g => g.id !== id); cacheGodowns(next); return next; });
    if (activeGodownIdRef.current === id) setActiveGodown('');
    supabase.from('godowns').delete().eq('id', id).then(({ error }) => {
      if (error) {   // RULE 1
        console.error('Godown delete:', error.message);
        setGodownsState(() => { cacheGodowns(snapshot); return snapshot; });
        toastRef.current({ title: tr('Godown delete नहीं हुआ', 'Godown not deleted'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर godown वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the godown will come back.`), variant: 'destructive', duration: 12000 });
      }
    });
  }, [setActiveGodown]);
  // ARCH-03: persistMovement / persistExtras (the client-side sale & purchase save) are gone — stock documents
  // save only through post_stock_document / update_stock_document.

  const [members, setMembersState] = useState<Member[]>([]);
  const membersRef = useRef<Member[]>(members);
  useEffect(() => { membersRef.current = members; }, [members]);
  const [accounts, setAccountsState] = useState<LedgerAccount[]>([]);
  // Latest accounts for callbacks with stable identity (M1-4a: the account-delete rollbacks read it).
  const accountsRef = useRef<LedgerAccount[]>([]);
  // Accounts merged on screen that the database lacks (see localOnlyAccountsReport) — never posted to automatically.
  const localOnlyAccountIdsRef = useRef<ReadonlySet<string>>(new Set());
  useEffect(() => { accountsRef.current = accounts; }, [accounts]);
  const [society, setSocietyState] = useState<SocietySettings>(() => storage.getSociety());
  const societyRef = useRef(society);
  useEffect(() => {
    societyRef.current = society;
    // T-01: keep the jurisdiction code in sync with the society's state, via the SSOT.
    jurisdictionRef.current = resolveJurisdiction(society.state);
  }, [society]);
  // Phase 2a-4c: the signed-in society's subscription row (RLS also scopes it to the caller's society,
  // 055 policy). The guard below derives "expired" from it AT CALL TIME (effectiveStatus, the rule of
  // migration 159), so a session that stays open across the end of the grace period is paused too.
  // No row / no period_end → never expired. A grandfathered (legacy) society is blocked only after the
  // end date it was given (migration 160) plus the grace days.
  const subRowRef = useRef<SubRow | null>(null);
  useEffect(() => {
    if (!user?.societyId) { subRowRef.current = null; return; }   // J6: logged out → nothing to read
    let cancelled = false;
    // J5: shared with useSubscription (one request per society per minute, not one per reader).
    fetchSubscriptionRow(user.societyId).then((row) => {
      if (!cancelled) subRowRef.current = row;
    });
    return () => { cancelled = true; };
  }, [user?.societyId]);   // re-read per signed-in society (was once, at mount — possibly logged out)
  // FY-lock guard — reads the LATEST society via ref, so it is never stale even
  // inside useCallbacks declared with empty deps. Returns true (and toasts) when locked.
  const guardFYLocked = useCallback((): boolean => {
    // F1 (offline policy अ): every mutation already passes this guard, so the online-only rule lives
    // here once — offline, or a core part of the books failed to load ⇒ refuse with a clear toast.
    if (refuseIfWriteBlocked(toastRef.current)) return true;
    if (societyRef.current?.fyLocked) {
      toastRef.current({ title: tr('वित्तीय वर्ष लॉक है', 'Financial Year is locked'), description: tr('ऑडिट-लॉक वर्ष में कोई बदलाव नहीं हो सकता। (Financial Year is audit-locked.)', 'No changes can be made in an audit-locked year. (Financial Year is audit-locked.)'), variant: 'destructive', duration: 10000 });
      return true;
    }
    return false;
  }, []);
  // ECR-07 (P1 #7): period lock / back-dating prevention. A voucher dated ON or BEFORE
  // society.periodLockDate is in a closed period. Pure predicate (mirrored in the test).
  const isPeriodLocked = (entityDate?: string): boolean => isDateInLockedPeriod(entityDate, societyRef.current?.periodLockDate);
  // A voucher leg on a GROUP account is invisible to every report (they read ledgers only), so it
  // would surface as a "[Deleted]" row and fall out of I&E. AccountPicker already hides groups;
  // this is the choke-point check for every other path (edits, composite flows). True = blocked.
  const blockGroupPosting = (lines: readonly { accountId: string }[]): boolean => {
    const group = lines.map(l => accountsRef.current.find(a => a.id === l.accountId)).find(a => a?.isGroup);
    if (!group) return false;
    toastRef.current({
      title: tr('ग्रुप खाते में एंट्री नहीं / Cannot post to a group', 'Cannot post to a group account'),
      description: tr(`"${group.name}" एक ग्रुप है — इसके नीचे का कोई ledger खाता चुनें। / "${group.name}" is a group; choose a ledger under it.`, `"${group.name}" is a group — choose a ledger account under "${group.name}".`),
      variant: 'destructive', duration: 12000,
    });
    return true;
  };
  // Returns true when BLOCKED (mirrors guardFYLocked). Checks any of the supplied dates
  // (add → new date; edit → existing AND incoming date) so you can neither edit within
  // nor back-date into a locked period.
  const guardPeriodLock = useCallback((...dates: (string | undefined)[]): boolean => {
    const lock = societyRef.current?.periodLockDate;
    if (lock && dates.some(d => isPeriodLocked(d))) {
      toastRef.current({
        title: tr('🔒 अवधि लॉक / Period Locked', '🔒 Period Locked'),
        description: tr(`इस तारीख तक की अवधि लॉक है (${lock}) — इस अवधि में entry add/edit नहीं हो सकती। (Period up to ${lock} is locked; back-dated entries are blocked.)`, `The period up to ${lock} is locked — entries in this period cannot be added or edited. (Back-dated entries up to ${lock} are blocked.)`),
        variant: 'destructive',
        duration: 9000,
      });
      return true;
    }
    return false;
  }, []);
  // SL-06: block an action the current user's role is not granted. Returns true when BLOCKED
  // (mirrors guardFYLocked's convention). Hindi-first toast. Detection is app-layer only.
  const guardPermission = useCallback((permission: Permission, actionHi: string): boolean => {
    const role = userRef.current?.role;
    if (role && rbacCan(role, permission)) return false; // allowed
    toastRef.current({ title: tr('अनुमति नहीं', 'Not allowed'), description: tr(`आपकी भूमिका को ${actionHi} की अनुमति नहीं है। (Your role cannot ${permission}.)`, `Your role is not allowed to ${actionHi}.`), variant: 'destructive', duration: 8000 });
    return true; // blocked
  }, []);
  // Tally-style ledger safety (परत 1 / RULE-3): a ledger or party whose account still carries a
  // NON-ZERO balance can never be removed or orphaned — otherwise that balance strands in reports
  // as a "[…deleted]" / orphan row (the very leak we are closing). Mirrors Tally's "Cannot delete.
  // Ledger is used in transactions." An epsilon (₹0.005) prevents a rounding-paisa false block.
  // Returns TRUE when BLOCKED (same convention as guardFYLocked / guardPermission).
  const guardAccountBalance = useCallback((accountId: string | undefined, labelHi: string): boolean => {
    if (!accountId) return false;
    const bal = accountBalanceFnRef.current(accountId);
    if (Math.abs(bal) < 0.005) return false; // zero within rounding → safe to remove
    const abs = Math.abs(bal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    toastRef.current({
      title: tr('पहले बैलेंस settle करें', 'Settle the balance first'),
      description: tr(`${labelHi} के खाते पर ₹${abs} बाकी है — पहले इसे settle करें या journal से दूसरे खाते में भेजें, तभी delete होगा। (Ledger has a non-zero balance.)`, `The ${labelHi} ledger still has a balance of ₹${abs} — settle it first or move it to another account by journal; only then can it be deleted. (Ledger has a non-zero balance.)`),
      variant: 'destructive',
      duration: 12000,
    });
    return true; // blocked
  }, []);
  // Phase 2a-4c: new entries are paused while the subscription is expired (reads stay available).
  // Returns true (and toasts) when BLOCKED — same convention as guardFYLocked. Shared by addVoucher
  // and guardVoucherPostable so both refuse for the identical reason (RULE 2).
  // Plan gate (founder 2026-11-11): a feature the plan does not include is refused HERE, before any optimistic
  // update, so nothing is shown that the server would not keep (RULE 1). No row yet / legacy → allowed.
  // Returns true (and toasts) when BLOCKED — same convention as guardFYLocked.
  const guardPlanFeature = useCallback((feature: PlanFeature): boolean => {
    const plan = subRowRef.current?.plan;
    if (planAllows(plan, feature)) return false;
    const need = minPlanFor(feature) === 'plus' ? 'Plus' : 'Pro';
    const label = PLAN_FEATURE_LABEL[feature];
    toastRef.current({
      title: tr(`${need} plan चाहिए / ${need} plan needed`, `${need} plan needed — upgrade to ${need}`),
      description: tr(`${label.hi} ${need} plan में शामिल है — User Management से plan लें। आपका बाकी हिसाब पहले की तरह चलता रहेगा। / ${label.en} is part of the ${need} plan — upgrade in User Management.`, `${label.en} is part of the ${need} plan — get the ${need} plan from User Management. The rest of your accounting keeps working as before. (${label.hi})`),
      variant: 'destructive',
      duration: 12000,
    });
    return true;
  }, []);
  const guardSubscriptionExpired = useCallback((): boolean => {
    const row = subRowRef.current;
    if (!row || effectiveStatus(row.plan, row.status, row.period_end) !== 'expired') return false;
    toastRef.current({
      title: tr('प्लान समाप्त / Plan expired', 'Plan expired'),
      description: tr('आपका trial / plan समाप्त हो गया है, इसलिए नई एंट्री रुकी है। आपका डेटा सुरक्षित है — रिपोर्ट और export चालू हैं। User Management से plan लेते ही एंट्री फिर शुरू हो जाएगी। / Your trial or plan has ended, so new entries are paused. Your data is safe; buy a plan in User Management to continue.', 'Your trial / plan has ended, so new entries are paused. Your data is safe — reports and export still work. Entries will resume as soon as you buy a plan in User Management.'),
      variant: 'destructive',
      duration: 12000,
    });
    return true;
  }, []);
  // RM-01: the voucher-birth refusals addVoucher applies (permission, FY lock, expired plan, period
  // lock), checked BEFORE a sale/purchase touches stock, movements or its old voucher. Without the
  // load-time repair loop nothing re-creates a missing voucher later, so a flow must never get past a
  // point it cannot finish. Returns true (and toasts) when BLOCKED. Every supplied date is checked, so
  // an edit can neither start from nor move into a locked period.
  const guardVoucherPostable = useCallback((...dates: (string | undefined)[]): boolean => {
    if (guardPermission('create', tr('वाउचर बनाने', 'create vouchers'))) return true;
    if (guardFYLocked()) return true;
    if (guardSubscriptionExpired()) return true;
    if (guardPeriodLock(...dates)) return true;
    return false;
  }, [guardPermission, guardFYLocked, guardSubscriptionExpired, guardPeriodLock]);
  // ARCH-07: one guard for the pages that write their own tables (see the interface). Same order and toasts as
  // guardVoucherPostable; an expired plan pauses NEW entries only (edits and deletes of existing rows still work).
  const guardPageWrite = useCallback((action: 'create' | 'update' | 'delete', ...dates: (string | undefined)[]): boolean => {
    const what = action === 'create' ? tr('नई एंट्री बनाने', 'create entries') : action === 'update' ? tr('एंट्री बदलने', 'edit entries') : tr('एंट्री हटाने', 'delete entries');
    if (guardPermission(action, what)) return true;
    if (guardFYLocked()) return true;
    if (action === 'create' && guardSubscriptionExpired()) return true;
    if (guardPeriodLock(...dates)) return true;
    return false;
  }, [guardPermission, guardFYLocked, guardSubscriptionExpired, guardPeriodLock]);
  const [loans, setLoansState] = useState<Loan[]>([]);
  const [depositAccounts, setDepositAccountsState] = useState<DepositAccount[]>([]);
  const [depositTransactions, setDepositTransactionsState] = useState<DepositTransaction[]>([]);
  const depositTransactionsRef = useRef<DepositTransaction[]>([]);   // X-5: the deposits owner check reads the latest
  depositTransactionsRef.current = depositTransactions;
  const [complianceFilings, setComplianceFilingsState] = useState<ComplianceFiling[]>([]);
  const [societyCapabilities, setSocietyCapabilitiesState] = useState<SocietyCapabilityRow[]>([]);
  const societyCapabilitiesRef = useRef(societyCapabilities);
  useEffect(() => { societyCapabilitiesRef.current = societyCapabilities; }, [societyCapabilities]);
  // T-11 (ADR-0003): the society's DECLARED activities (society_activities). Dormant until the
  // cutover flag (T-12) — the resolver port ignores them while it is off, so this changes nothing today.
  const [societyActivities, setSocietyActivitiesState] = useState<SocietyActivityRow[]>([]);
  const societyActivitiesRef = useRef(societyActivities);
  useEffect(() => { societyActivitiesRef.current = societyActivities; }, [societyActivities]);
  // T-14 (ADR-0002): bind behaviour to CAPABILITIES, not the society TYPE. Resolved from the
  // current refs so it is correct inside []-dep callbacks. NO super-admin bypass — a data
  // default must reflect what the SOCIETY does, not who is viewing it. Declared activities feed the
  // resolver WITHIN entitlement (T-11), gated by the cutover flag inside navigationService.
  const hasCap = (c: Capability): boolean =>
    navigationService.resolveCapabilities(societyRef.current?.societyType ?? 'other', societyCapabilitiesRef.current, societyRef.current?.state, declaredActivities(societyActivitiesRef.current), societyRef.current?.activitiesCutoverEnabled).has(c);
  const [procurementFarmers, setProcurementFarmersState] = useState<Farmer[]>(() => storage.getProcurementFarmers());
  const [procurementLots, setProcurementLotsState] = useState<ProcurementLot[]>(() => storage.getProcurementLots());
  const [procurementEvents, setProcurementEventsState] = useState<ProcurementEvent[]>(() => storage.getProcurementEvents());
  const [procurementQualityTests, setProcurementQualityTestsState] = useState<QualityTest[]>(() => storage.getProcurementQualityTests());
  const [procurementMoistureRecords, setProcurementMoistureRecordsState] = useState<MoistureRecord[]>(() => storage.getProcurementMoistureRecords());
  const [procurementJForms, setProcurementJFormsState] = useState<JForm[]>(() => storage.getProcurementJForms());
  const [procurementFinancialIntents, setProcurementFinancialIntentsState] = useState<FinancialIntentRecord[]>(() => storage.getProcurementFinancialIntents());
  const [procurementPostingRequests, setProcurementPostingRequestsState] = useState<PostingRequest[]>(() => storage.getProcurementPostingRequests());
  const [procurementPostingRuleResults, setProcurementPostingRuleResultsState] = useState<PostingRuleResult[]>(() => storage.getProcurementPostingRuleResults());
  const [procurementSettlements, setProcurementSettlementsState] = useState<FarmerSettlement[]>(() => storage.getProcurementSettlements());
  const [workOrders, setWorkOrdersState] = useState<WorkOrder[]>(() => storage.getWorkOrders());
  const [musterEntries, setMusterEntriesState] = useState<MusterEntry[]>(() => storage.getMusterEntries());
  const musterEntriesRef = useRef<MusterEntry[]>(musterEntries);
  useEffect(() => { musterEntriesRef.current = musterEntries; }, [musterEntries]);
  const procurementFarmersRef = useRef<Farmer[]>(procurementFarmers);
  useEffect(() => { procurementFarmersRef.current = procurementFarmers; }, [procurementFarmers]);
  // Batch A (P1-1): synchronous mirrors of the posting chain. "Post to Ledger" runs the next step in the
  // same tick the previous one added its object, before React re-renders — the generators look their
  // inputs up HERE (the add/rollback points update these refs immediately), not in render-time state.
  const procurementLotsRef = useRef<ProcurementLot[]>(procurementLots);
  useEffect(() => { procurementLotsRef.current = procurementLots; }, [procurementLots]);
  const procurementJFormsRef = useRef<JForm[]>(procurementJForms);
  useEffect(() => { procurementJFormsRef.current = procurementJForms; }, [procurementJForms]);
  const procurementIntentsRef = useRef<FinancialIntentRecord[]>(procurementFinancialIntents);
  useEffect(() => { procurementIntentsRef.current = procurementFinancialIntents; }, [procurementFinancialIntents]);
  const procurementRequestsRef = useRef<PostingRequest[]>(procurementPostingRequests);
  useEffect(() => { procurementRequestsRef.current = procurementPostingRequests; }, [procurementPostingRequests]);
  const procurementRuleResultsRef = useRef<PostingRuleResult[]>(procurementPostingRuleResults);
  useEffect(() => { procurementRuleResultsRef.current = procurementPostingRuleResults; }, [procurementPostingRuleResults]);
  const procurementSettlementsRef = useRef<FarmerSettlement[]>(procurementSettlements);
  useEffect(() => { procurementSettlementsRef.current = procurementSettlements; }, [procurementSettlements]);
  const loansRef = useRef<Loan[]>(loans);
  useEffect(() => { loansRef.current = loans; }, [loans]);
  // LOAN-04: cancelVoucher (defined earlier) re-opens a repayment through updateLoan (defined later).
  const updateLoanRef = useRef<(id: string, data: Partial<Loan>) => void>(() => {});
  const depositAccountsRef = useRef<DepositAccount[]>(depositAccounts);
  useEffect(() => { depositAccountsRef.current = depositAccounts; }, [depositAccounts]);
  const complianceFilingsRef = useRef<ComplianceFiling[]>(complianceFilings);
  useEffect(() => { complianceFilingsRef.current = complianceFilings; }, [complianceFilings]);
  const [assets, setAssetsState] = useState<Asset[]>([]);
  const assetsRef = useRef<Asset[]>(assets);
  useEffect(() => { assetsRef.current = assets; }, [assets]);
  const [auditObjections, setAuditObjectionsState] = useState<AuditObjection[]>([]);
  const auditObjectionsRef = useRef<AuditObjection[]>(auditObjections);
  useEffect(() => { auditObjectionsRef.current = auditObjections; }, [auditObjections]);
  const [recoverables, setRecoverablesState] = useState<Recoverable[]>([]);
  const recoverablesRef = useRef<Recoverable[]>(recoverables);
  useEffect(() => { recoverablesRef.current = recoverables; }, [recoverables]);
  const [kachiAaratEntries, setKachiAaratEntriesState] = useState<KachiAaratEntry[]>([]);
  const kachiAaratEntriesRef = useRef<KachiAaratEntry[]>(kachiAaratEntries);
  useEffect(() => { kachiAaratEntriesRef.current = kachiAaratEntries; }, [kachiAaratEntries]);
  const [p7Entries, setP7EntriesState] = useState<P7Entry[]>([]);
  const p7EntriesRef = useRef<P7Entry[]>(p7Entries);
  useEffect(() => { p7EntriesRef.current = p7Entries; }, [p7Entries]);
  const [stockItems, setStockItemsState] = useState<StockItem[]>([]);
  const stockItemsRef = useRef<StockItem[]>(stockItems);
  useEffect(() => { stockItemsRef.current = stockItems; }, [stockItems]);
  const [stockMovements, setStockMovementsState] = useState<StockMovement[]>([]);
  const stockMovementsRef = useRef<StockMovement[]>(stockMovements);
  useEffect(() => { stockMovementsRef.current = stockMovements; }, [stockMovements]);
  const [sales, setSalesState] = useState<Sale[]>([]);
  const salesRef = useRef<Sale[]>(sales);
  useEffect(() => { salesRef.current = sales; }, [sales]);
  const [purchases, setPurchasesState] = useState<Purchase[]>([]);
  const purchasesRef = useRef<Purchase[]>(purchases);
  useEffect(() => { purchasesRef.current = purchases; }, [purchases]);
  // RULE 2/3: stock quantity is derived from LIVE purchase/sale records (not from
  // stock_movements, which can drift — orphan movements from deleted docs, or a live
  // doc with no movement). Every stock read (Inventory, Sale availability, Valuation,
  // Closing Stock, Trading A/c) uses THIS, not raw stockMovements. No-op for synced data.
  const reconciledStockMovements = useMemo(
    () => reconcileMovements(stockMovements, sales, purchases),
    [stockMovements, sales, purchases],
  );
  const [employees, setEmployeesState] = useState<Employee[]>([]);
  const employeesRef = useRef<Employee[]>(employees);
  useEffect(() => { employeesRef.current = employees; }, [employees]);
  const [salaryRecords, setSalaryRecordsState] = useState<SalaryRecord[]>([]);
  const salaryRecordsRef = useRef<SalaryRecord[]>(salaryRecords);
  useEffect(() => { salaryRecordsRef.current = salaryRecords; }, [salaryRecords]);
  const [suppliers, setSuppliersState] = useState<Supplier[]>([]);
  const suppliersRef = useRef<Supplier[]>(suppliers);
  useEffect(() => { suppliersRef.current = suppliers; }, [suppliers]);
  const [customers, setCustomersState] = useState<Customer[]>([]);
  const customersRef = useRef<Customer[]>(customers);
  useEffect(() => { customersRef.current = customers; }, [customers]);
  const [kccLoans, setKccLoansState] = useState<KccLoan[]>([]);
  const kccLoansRef = useRef<KccLoan[]>(kccLoans);
  useEffect(() => { kccLoansRef.current = kccLoans; }, [kccLoans]);

  const [isLoading, setIsLoading] = useState(true);
  const loadedSocietyRef = useRef<string | null>(null);   // J6: the society whose books this page loaded

  // S2 (login read-load): ONE call per society says which skippable tables hold no rows; those are not
  // fetched (their state is the same `[]`). Shared with the domain contexts, whose effects run BEFORE this
  // provider's, so it is created on first ask. Any failure → empty set → every table fetched as before.
  const emptyTablesRef = useRef<{ sid: string; p: Promise<ReadonlySet<string>> } | null>(null);
  const knownEmptyTables = useCallback((sid: string): Promise<ReadonlySet<string>> => {
    if (emptyTablesRef.current?.sid !== sid) emptyTablesRef.current = { sid, p: fetchEmptyTables(sid) };
    return emptyTablesRef.current.p;
  }, []);

  useEffect(() => {
    // J6: logged out (landing, blog, login …) there is no society to load. This used to load the
    // placeholder 'SOC001' — ~41 Supabase requests on EVERY public page view, all returning nothing.
    if (!user?.societyId) {
      setIsLoading(false);
      // Signed out after a society's books were loaded in THIS page → reload once, so no previous
      // society's data stays in memory (the old placeholder load used to overwrite it by accident).
      // After the reload nothing is loaded yet, so this cannot loop.
      if (loadedSocietyRef.current) { loadedSocietyRef.current = null; window.location.reload(); }
      return;
    }
    const sid = user.societyId;
    societyIdRef.current = sid;
    loadedSocietyRef.current = sid;
    setIsLoading(true);

    // Reset all state to empty before loading new society's data
    setVouchersState([]); setMembersState([]); setLoansState([]); setSocietyCapabilitiesState([]); setSocietyActivitiesState([]);
    setDepositAccountsState([]); setDepositTransactionsState([]); setComplianceFilingsState([]);
    setProcurementFarmersState([]); setProcurementLotsState([]); setProcurementEventsState([]);
    setProcurementQualityTestsState([]); setProcurementMoistureRecordsState([]); setProcurementJFormsState([]); setProcurementFinancialIntentsState([]); setProcurementPostingRequestsState([]); setProcurementPostingRuleResultsState([]); setProcurementSettlementsState([]); setWorkOrdersState([]); setMusterEntriesState([]);
    setAssetsState([]); setAuditObjectionsState([]); setStockItemsState([]);
    setStockMovementsState([]); setSalesState([]); setPurchasesState([]);
    setEmployeesState([]); setSalaryRecordsState([]);
    setSuppliersState([]); setCustomersState([]);
    setRecoverablesState([]); setKachiAaratEntriesState([]); setP7EntriesState([]);

    // Paginated fetch — bypasses PostgREST max-rows server cap (typically 1000).
    // We loop .range() in 1000-row pages until a partial page comes back. Guarantees
    // ALL rows are loaded regardless of server-side cap; otherwise the user's newest
    // entries silently vanish on F5 once total rows exceed the cap.
    //
    // `orderBy` MUST end in a UNIQUE column, so the order is TOTAL. Paging with LIMIT/OFFSET over a
    // non-unique ORDER BY (or none at all) leaves tied rows free to sort differently on each page
    // request, which duplicates or drops them — see the note on the shared helper in supabasePaging.ts.
    // Defaults to the primary key `id`; ledger_events keys on `event_id` instead.
    const fetchAllPaged = async <T,>(table: string, orderBy: string[] = ['id']): Promise<{ data: T[]; error: { message: string } | null }> => {
      const PAGE = 1000;
      const out: T[] = [];
      let from = 0;
      // Safety cap: 200 pages = 200,000 rows. Tweak if any single table ever exceeds this.
      for (let i = 0; i < 200; i++) {
        let q = supabaseLoose.from(table).select('*').eq('society_id', sid).range(from, from + PAGE - 1);
        for (const col of orderBy) q = q.order(col, { ascending: true });
        const { data, error } = await q;
        if (error) return { data: out, error };
        if (!data || data.length === 0) break;
        out.push(...(data as T[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return { data: out, error: null };
    };

    const loadFromSupabase = async () => {
      try {
        const emptyP = knownEmptyTables(sid);   // S2: in flight alongside the core load below
        // S3-b: read-only flag read (RM-01-safe); never blocks or fails the load.
        postingServiceRef.current = true;
        supabase.from('society_flags').select('posting_service').eq('society_id', sid).maybeSingle()
          .then(({ data, error }) => { if (!error) postingServiceRef.current = data?.posting_service !== false; }, () => { /* stays on */ });
        activityTagEditableRef.current = false;
        void probeActivityTagEditable().then(v => { activityTagEditableRef.current = v === true; });
        const loadResults = await Promise.all([
          fetchAllPaged<Voucher>('vouchers', ['createdAt', 'id']),
          fetchAllPaged<Member>('members'),
          fetchAllPaged<LedgerAccount>('accounts'),
          fetchAllPaged<Loan>('loans'),
          fetchAllPaged<Asset>('assets'),
          fetchAllPaged<AuditObjection>('audit_objections'),
          fetchAllPaged<StockItem>('stock_items'),
          fetchAllPaged<StockMovement>('stock_movements', ['createdAt', 'id']),
          fetchAllPaged<Sale>('sales', ['createdAt', 'id']),
          fetchAllPaged<Purchase>('purchases', ['createdAt', 'id']),
          fetchAllPaged<Employee>('employees'),
          fetchAllPaged<SalaryRecord>('salary_records', ['createdAt', 'id']),
          supabase.from('society_settings').select('*').eq('society_id', sid).limit(1),
          fetchAllPaged<Supplier>('suppliers'),
          fetchAllPaged<Customer>('customers'),
          fetchAllPaged<KccLoan>('kcc_loans'),
          fetchAllPaged<Recoverable>('recoverables', ['createdAt', 'id']),
          fetchAllPaged<KachiAaratEntry>('kachi_aarat_entries', ['createdAt', 'id']),
          fetchAllPaged<P7Entry>('p7_entries', ['createdAt', 'id']),
        ]);
        const [
          { data: vData, error: vErr }, { data: mData }, { data: aData, error: aErr },
          { data: lData }, { data: asData }, { data: aoData },
          { data: siData }, { data: smData }, { data: slData },
          { data: puData }, { data: emData }, { data: srData },
          { data: socData }, { data: supData }, { data: cusData },
          { data: kccData }, { data: recData }, { data: kaData }, { data: p7Data },
        ] = loadResults;
        // F1 (offline policy अ): supabase-js RESOLVES a network failure as `{ data: null, error }` —
        // it never throws — so the catch-block fallback below never ran and an offline load showed
        // ₹0 / empty registers with no warning. Record which parts errored; a failed CORE part (or
        // the browser being offline) refuses every mutation and shows the read-only banner.
        const LOAD_PARTS = ['vouchers', 'members', 'accounts', 'loans', 'assets', 'audit_objections', 'stock_items',
          'stock_movements', 'sales', 'purchases', 'employees', 'salary_records', 'society_settings', 'suppliers',
          'customers', 'kcc_loans', 'recoverables', 'kachi_aarat_entries', 'p7_entries'] as const;
        const failedParts = LOAD_PARTS.filter((_, i) => loadResults[i].error);
        setLoadFailures(failedParts);
        if (failedParts.length > 0) console.warn('Load incomplete — failed parts:', failedParts.join(', '));

        if (vErr) console.warn('Vouchers query error:', vErr.message);
        // Load vouchers — safe first, auto-migration separate
        if (vData && vData.length > 0) { setVouchersState(vData); storage.setVouchers(vData); }
        else if (!vErr) setVouchersState([]);
        // P0 #2: exclude soft-deleted rows so archived members never repopulate the array.
        let activeMembers = (mData || []).filter(m => !m.isDeleted);
        // Member PII split (Phase 2): table present => SPLIT mode (overlay identity, strip for roles that
        // may not read PII); table missing => LEGACY (unchanged). Any other error stays LEGACY + warns.
        identitySplitRef.current = false;
        try {
          const idRes = await fetchAllPaged<IdentityRow>('member_identity', ['member_id']);
          if (!idRes.error) {
            identitySplitRef.current = true;
            activeMembers = applyMemberIdentity(activeMembers, idRes.data, canReadMemberPii(userRef.current?.role));
          } else if (!isMissingIdentityTable(idRes.error)) {
            console.warn('member_identity load failed — staying in legacy PII mode:', idRes.error.message);
          }
        } catch (e) { console.warn('member_identity load threw — staying in legacy PII mode:', e); }
        // DB-09: party PII split (migration 195). Table present → SPLIT (overlay for roles allowed to read, strip for the
        // rest); missing → LEGACY (unchanged). One read for all party types; farmers overlay later from the same rows.
        partySplitRef.current = false;
        let partyRows: PartyIdentityRow[] = [];
        try {
          const pRes = await fetchAllPaged<PartyIdentityRow>('party_identity', ['entity_type', 'entity_id']);
          if (!pRes.error) { partySplitRef.current = true; partyRows = pRes.data; }
          else if (!isMissingPartyIdentityTable(pRes.error)) console.warn('party_identity load failed — staying in legacy PII mode:', pRes.error.message);
        } catch (e) { console.warn('party_identity load threw — staying in legacy PII mode:', e); }
        const overlayParty = <T extends { id: string }>(rows: T[], t: PartyType): T[] =>
          partySplitRef.current ? applyPartyIdentity(rows, partyRows, t, canReadPartyPii(userRef.current?.role, t)) : rows;
        if (activeMembers.length > 0) { setMembersState(activeMembers); storage.setMembers(activeMembers); }
        else setMembersState([]);

        // Load accounts from Supabase; fall back to CMS template if none exist. F1: a FAILED accounts
        // query is not "none exist" — showing the template then presented a stranger's chart as this
        // society's, and overwrote the device's cached copy of the real one. On error show the cached
        // copy (read-only: entry is blocked) and leave the cache untouched.
        const rawAccts: LedgerAccount[] = aData && aData.length > 0 ? [...aData]
          : aErr ? storage.getAccounts() : [...CMS_SOCIETY_ACCOUNTS];
        const { accounts: baseAccts, changed: acctsMigrated, newlyAdded } = storage.migrateAccounts(rawAccts);
        setAccountsState(baseAccts);
        localOnlyAccountIdsRef.current = new Set(aData && aData.length > 0 ? newlyAdded.map(a => a.id) : []);
        if (!aErr) storage.setAccounts(baseAccts);
        // RM-01 (S0 emergency safety fix): the load path NEVER writes to the database. The template
        // accounts migrateAccounts adds are merged into LOCAL state only (every device merges the same
        // deterministic list on load); they used to be upserted into `accounts` here on every load.
        // Persisting them is an explicit, reviewed step (Phase-3 M2), never a side effect of loading.
        void acctsMigrated;
        // Not a write — a flag: if the chart merged on screen holds accounts the database lacks, say so in error_log
        // (once per society per page load). After migration 114 this should never fire.
        if (!aErr && aData && aData.length > 0) {
          const rep = localOnlyAccountsReport(sid, newlyAdded, localOnlyReported);
          if (rep) reportError(rep.source, rep.message, rep.context);
        }

        // RM-01 (S0 emergency safety fix): loading members NEVER creates an accounting voucher.
        // This used to post a Cash receipt (Dr 3301 / Cr 1102 share capital, Cr 4407 admission fee) for
        // every member whose scalar shareCapital/admissionFee had no matching voucher — judged only by
        // the legacy creditAccountId, so imported vouchers were missed and duplicates were posted on
        // every load (production M0: 846 duplicate System vouchers in one society). Share capital and
        // admission fee are posted only by explicit transactions (addMember, Share Register actions).
        // Suspected phantoms are REPORTED, never repaired, by getPhantomVoucherDiagnostics().

        setLoansState((lData || []).filter(l => !l.isDeleted));            // ECR-02: exclude archived loans
        setAssetsState((asData || []).filter(a => !a.isDeleted));          // P0 #2: exclude archived
        setAuditObjectionsState((aoData || []).filter(o => !o.isDeleted)); // P0 #2: exclude archived
        setStockItemsState(siData || []);
        setStockMovementsState(smData || []);

        // J5: the side-loads below used to call setState each on its own resolve — one React commit per
        // table (~17 extra commits after login, each re-rendering every consumer). They are collected and
        // applied in ONE callback, so React batches them into a single commit. Each stays independent and
        // error-tolerant: a failed or missing table still takes its own fallback and never breaks another.
        const sideLoads: { q: PromiseLike<unknown>; settle: (r: PromiseSettledResult<unknown>) => void }[] = [];
        const sideLoad = <R,>(q: PromiseLike<R>, ok: (r: R) => void, fail: () => void) => {
          sideLoads.push({ q, settle: (r) => (r.status === 'fulfilled' ? ok(r.value as R) : fail()) });
        };

        // C3: load capability rows independently (NOT in the Promise.all) so a missing
        // table (pre-migration) NEVER breaks the main data load. snake → camel mapped.
        sideLoad(unlessEmpty(emptyP, 'society_capabilities', () => supabase.from('society_capabilities').select('*').eq('society_id', sid)),
          ({ data: capData, error: capErr }) => {
            if (capErr || !capData) { setSocietyCapabilitiesState([]); return; }
            setSocietyCapabilitiesState(capData.map((r: Record<string, unknown>) => ({
              capability: r.capability as SocietyCapabilityRow['capability'],
              mode: r.mode as SocietyCapabilityRow['mode'],
              source: r.source as SocietyCapabilityRow['source'],
              expiresAt: (r.expires_at as string | null) ?? null,
              grantedBy: (r.granted_by as string | null) ?? null,
              createdAt: (r.created_at as string | null) ?? null,
            })));
          },
          () => setSocietyCapabilitiesState([]),
        );

        // T-11 (ADR-0003): load declared activities independently (NOT in the Promise.all) so a
        // missing table (pre-migration) NEVER breaks the main data load. Only active, non-deleted
        // rows matter to the resolver; declaredActivities() re-filters, but we drop deleted rows here
        // to keep state lean. Dormant until the cutover flag (T-12) — this changes nothing today.
        sideLoad(unlessEmpty(emptyP, 'society_activities', () => supabase.from('society_activities').select('*').eq('society_id', sid)),
          ({ data: actData, error: actErr }) => {
            if (actErr || !actData) { setSocietyActivitiesState([]); return; }
            setSocietyActivitiesState((actData as Record<string, unknown>[])
              .filter((r) => !r.isDeleted)
              .map((r) => ({
                activity: r.activity as SocietyActivityRow['activity'],
                status: r.status as SocietyActivityRow['status'],
                isDeleted: (r.isDeleted as boolean | undefined) ?? false,
              })));
          },
          () => setSocietyActivitiesState([]),
        );

        // Deposits module — independent, error-tolerant load (a missing table pre-migration
        // NEVER breaks the main data load).
        sideLoad(unlessEmpty(emptyP, 'deposit_accounts', () => fetchAllPaged('deposit_accounts')),
          ({ data, error }) => { if (!error && data) setDepositAccountsState(data as DepositAccount[]); },
          () => { /* table absent pre-migration — ignore */ },
        );
        sideLoad(unlessEmpty(emptyP, 'deposit_transactions', () => fetchAllPaged('deposit_transactions')),
          ({ data, error }) => { if (!error && data) setDepositTransactionsState(data as DepositTransaction[]); },
          () => { /* table absent pre-migration — ignore */ },
        );
        sideLoad(unlessEmpty(emptyP, 'compliance_filings', () => fetchAllPaged('compliance_filings')),
          ({ data, error }) => { if (!error && data) setComplianceFilingsState(data as ComplianceFiling[]); },
          () => { /* table absent pre-migration — ignore */ },
        );

        // Procurement Phase 1.0 — error-tolerant load (Supabase → localStorage fallback). Independent
        // queries: a missing table NEVER breaks the main data load; the demo persists via localStorage.
        sideLoad(unlessEmpty(emptyP, 'procurement_farmers', () => fetchAllPaged('procurement_farmers')),
          ({ data, error }) => setProcurementFarmersState(error || !data ? storage.getProcurementFarmers() : overlayParty(data as unknown as Farmer[], 'farmer')),
          () => setProcurementFarmersState(storage.getProcurementFarmers()),
        );
        sideLoad(unlessEmpty(emptyP, 'procurement_lots', () => fetchAllPaged('procurement_lots')),
          ({ data, error }) => setProcurementLotsState(error || !data ? storage.getProcurementLots() : (data as unknown as ProcurementLot[])),
          () => setProcurementLotsState(storage.getProcurementLots()),
        );
        sideLoad(unlessEmpty(emptyP, 'procurement_events', () => fetchAllPaged('procurement_events')),
          ({ data, error }) => setProcurementEventsState(error || !data ? storage.getProcurementEvents() : (data as unknown as ProcurementEvent[])),
          () => setProcurementEventsState(storage.getProcurementEvents()),
        );
        sideLoad(unlessEmpty(emptyP, 'procurement_quality_tests', () => fetchAllPaged('procurement_quality_tests')),
          ({ data, error }) => setProcurementQualityTestsState(error || !data ? storage.getProcurementQualityTests() : (data as unknown as QualityTest[])),
          () => setProcurementQualityTestsState(storage.getProcurementQualityTests()),
        );
        sideLoad(unlessEmpty(emptyP, 'procurement_moisture_records', () => fetchAllPaged('procurement_moisture_records')),
          ({ data, error }) => setProcurementMoistureRecordsState(error || !data ? storage.getProcurementMoistureRecords() : (data as unknown as MoistureRecord[])),
          () => setProcurementMoistureRecordsState(storage.getProcurementMoistureRecords()),
        );
        sideLoad(unlessEmpty(emptyP, 'procurement_jforms', () => fetchAllPaged('procurement_jforms')),
          // T-05 dual-read: prefer the typed money columns, JSONB as fallback (hydrateJForm).
          ({ data, error }) => setProcurementJFormsState(error || !data ? storage.getProcurementJForms() : (data as Record<string, unknown>[]).map(hydrateJForm) as unknown as JForm[]),
          () => setProcurementJFormsState(storage.getProcurementJForms()),
        );
        sideLoad(unlessEmpty(emptyP, 'procurement_financial_intents', () => fetchAllPaged('procurement_financial_intents')),
          // T-05 dual-read: prefer the typed money columns, JSONB as fallback (hydrateAmount).
          ({ data, error }) => setProcurementFinancialIntentsState(error || !data ? storage.getProcurementFinancialIntents() : (data as Record<string, unknown>[]).map(hydrateAmount) as unknown as FinancialIntentRecord[]),
          () => setProcurementFinancialIntentsState(storage.getProcurementFinancialIntents()),
        );
        sideLoad(unlessEmpty(emptyP, 'procurement_posting_requests', () => fetchAllPaged('procurement_posting_requests')),
          // T-05 dual-read: prefer the typed money columns, JSONB as fallback (hydrateAmount).
          ({ data, error }) => setProcurementPostingRequestsState(error || !data ? storage.getProcurementPostingRequests() : (data as Record<string, unknown>[]).map(hydrateAmount) as unknown as PostingRequest[]),
          () => setProcurementPostingRequestsState(storage.getProcurementPostingRequests()),
        );
        sideLoad(unlessEmpty(emptyP, 'procurement_posting_rule_results', () => fetchAllPaged('procurement_posting_rule_results')),
          ({ data, error }) => setProcurementPostingRuleResultsState(error || !data ? storage.getProcurementPostingRuleResults() : (data as unknown as PostingRuleResult[])),
          () => setProcurementPostingRuleResultsState(storage.getProcurementPostingRuleResults()),
        );
        sideLoad(unlessEmpty(emptyP, 'procurement_settlements', () => fetchAllPaged('procurement_settlements')),
          // T-05 dual-read: prefer the typed money columns, JSONB as fallback (hydrateSettlement).
          ({ data, error }) => setProcurementSettlementsState(error || !data ? storage.getProcurementSettlements() : (data as Record<string, unknown>[]).map(hydrateSettlement) as unknown as FarmerSettlement[]),
          () => setProcurementSettlementsState(storage.getProcurementSettlements()),
        );
        sideLoad(unlessEmpty(emptyP, 'work_orders', () => fetchAllPaged('work_orders')),
          ({ data, error }) => setWorkOrdersState(error || !data ? storage.getWorkOrders() : (data as unknown as WorkOrder[])),
          () => setWorkOrdersState(storage.getWorkOrders()),
        );
        sideLoad(unlessEmpty(emptyP, 'muster_entries', () => fetchAllPaged('muster_entries')),
          ({ data, error }) => setMusterEntriesState(error || !data ? storage.getMusterEntries() : (data as unknown as MusterEntry[])),
          () => setMusterEntriesState(storage.getMusterEntries()),
        );
        Promise.allSettled(sideLoads.map(l => l.q)).then(results => results.forEach((r, i) => {
          try { sideLoads[i].settle(r); } catch (e) { console.warn('side-load apply failed:', e); }
        }));

        // RM-01 (S0 emergency safety fix): loading NEVER repairs, re-routes, renumbers or soft-deletes
        // vouchers, and never patches sales/purchases. The old "REPAIR v2" loop created vouchers for
        // sales/purchases without one, rewrote earlier repair vouchers in place, soft-deleted "duplicate"
        // ref vouchers and patched voucherId — bypassing the FY lock, period lock, approval and the
        // journal. Gaps are now REPORTED by getPhantomVoucherDiagnostics(); fixing one is an explicit act.
        setSalesState((slData || []).filter(s => !s.isDeleted));          // ECR-02: exclude archived
        setPurchasesState((puData || []).filter(p => !p.isDeleted));      // P0 #2: exclude archived

        setEmployeesState(overlayParty((emData || []).filter(e => !e.isDeleted), 'employee'));       // ECR-02: exclude archived employees · DB-09 PII overlay
        setSalaryRecordsState(srData || []);
        setSuppliersState(overlayParty(supData || [], 'supplier'));   // DB-09 PII overlay
        setCustomersState(overlayParty(cusData || [], 'customer'));
        setKccLoansState(kccData || []);
        setRecoverablesState(recData || []);
        setKachiAaratEntriesState(kaData || []);
        setP7EntriesState(p7Data || []);

        // RM-01 (S0 emergency safety fix): loading NEVER writes voucher_entries. The one-time
        // "migration" that upserted entries for any voucher without them ran on every load; a voucher
        // missing its entries is now listed by getPhantomVoucherDiagnostics() instead.

        if (socData && socData.length > 0) {
          // Supabase is the single source of truth for society settings.
          // All devices always load from Supabase — save once, sync everywhere.
          // localStorage is only used as offline fallback (when Supabase is unreachable).
          // DB row → app type: settings columns allow NULL where SocietySettings treats them as present (DB types).
          const socRow = dbRowAs<SocietySettings>(socData[0]);
          setSocietyState(socRow);
          storage.setSociety(socRow);

          // T-09 (ADR-0001): when this tenant is cut over to ledger reads, load the FULL event journal
          // so getTrialBalance's parity gate has the whole log (session events alone never satisfy
          // parity). GATED on the flag → for every other tenant this never runs (dormant, zero cost).
          // Best-effort: a failure just leaves the journal short, so the parity gate falls back to the
          // voucher-state compute — no harm. snake_case columns → the camelCase LedgerEvent shape.
          if (socRow.ledgerReadsEnabled) {
            try {
              // NOTE: this loader's fetchAllPaged is the LOCAL one — (table, orderBy), society-scoped
              // already. It was being called as (table, sid, orderCol), so `sid` landed in orderCol:
              // Postgres rejected the order column, the query errored, and a cut-over tenant loaded an
              // EMPTY journal — every ledger read then failed parity and silently fell back forever.
              // `orderBy` is a string[] precisely so that mix-up can no longer typecheck.
              // event_id (the PK) breaks occurred_at ties: genesis stamps every voucher of a day at
              // that day's midnight, so ties are the rule here, not the exception — see genesis.ts.
              const { data: evData } = await fetchAllPaged<Record<string, unknown>>('ledger_events', ['occurred_at', 'event_id']);
              ledgerEventsRef.current = mapLedgerEventRows(evData ?? []);
              journalLoadedRef.current = true; // safe to derive per-aggregate sequences from the ref
            } catch (e) { console.warn('T-09 journal load (best-effort) failed:', e); }
          }
        }
      } catch (err) {
        console.warn('Supabase load failed, falling back to localStorage:', err);
        setLoadFailures([...CORE_PARTS]); // F1: the cached copy below is read-only — entry stays blocked
        // Properly restore from localStorage when Supabase is unavailable
        const lsVouchers = storage.getVouchers();
        const lsMembers = storage.getMembers();
        const lsAccounts = storage.getAccounts();
        if (lsVouchers.length > 0) setVouchersState(lsVouchers);
        if (lsMembers.length > 0) setMembersState(lsMembers);
        if (lsAccounts.length > 0) {
          const { accounts: migratedAccts } = storage.migrateAccounts(lsAccounts);
          setAccountsState(migratedAccts);
          storage.setAccounts(migratedAccts);
        }
        setSocietyState(storage.getSociety());
        setLoansState(storage.getLoans());
        setSocietyCapabilitiesState([]);   // C3: offline fallback → empty (all modules visible, as today)
        setSocietyActivitiesState([]);     // T-11: offline fallback → no declared activities
        setProcurementFarmersState(storage.getProcurementFarmers());
        setProcurementLotsState(storage.getProcurementLots());
        setProcurementEventsState(storage.getProcurementEvents());
        setProcurementQualityTestsState(storage.getProcurementQualityTests());
        setProcurementMoistureRecordsState(storage.getProcurementMoistureRecords());
        setProcurementJFormsState(storage.getProcurementJForms());
        setProcurementFinancialIntentsState(storage.getProcurementFinancialIntents());
        setProcurementPostingRequestsState(storage.getProcurementPostingRequests());
        setProcurementPostingRuleResultsState(storage.getProcurementPostingRuleResults());
        setProcurementSettlementsState(storage.getProcurementSettlements());
        setWorkOrdersState(storage.getWorkOrders());
        setMusterEntriesState(storage.getMusterEntries());
        setAssetsState(storage.getAssets());
      } finally {
        setIsLoading(false);
      }
    };
    loadFromSupabase();
  }, [user?.societyId]);

  // ── voucher_entries helpers ───────────────────────────────────────────────
  // The posting rule lives in voucherUtils.buildVoucherEntries — NOT here. A restore
  // replays `voucher_entries` rather than inserting the archived rows, and it must replay
  // through the same function this context posts through. Two copies of one posting rule
  // would make the replay assertion (T-33) compare a copy against a copy.

  // Write (upsert) entries for a voucher — fire-and-forget, non-blocking.
  const syncEntries = (v: Voucher) => {
    // A PENDING (maker-checker / threshold-held) voucher has no accounting effect until approved —
    // approveVoucher syncs its entries then (as save_pending_voucher / approve_voucher do server-side).
    if (!isCountedVoucher(v)) return;
    const sid = societyIdRef.current;
    // T-01: stamp jurisdiction alongside society_id. voucher_entries is replay-derived, and
    // REPLAY_FIELDS deliberately excludes tenant/storage columns (society_id, jurisdiction), so the
    // T-33 replay comparison is unaffected — the row just carries the residency key like every other.
    // The table's tenant column is society_id; VoucherEntry.societyId (the replay model's name) has no
    // column, and sending it made PostgREST reject EVERY upsert — hidden for months by the load-time
    // backfill RM-01 removed (no voucher created after 2026-09-26 had entries). Send only real columns.
    const rows = buildVoucherEntries(v, sid).map(({ societyId: _sid, ...e }) => ({ ...e, society_id: sid, jurisdiction: jurisdictionRef.current }));
    if (rows.length === 0) return;
    supabase.from('voucher_entries').upsert(rows).then(({ error }) => {
      if (error) { console.warn('voucher_entries sync error:', error.message); reportError('voucher-entries-sync', error.message, { voucherId: v.id }); return; }
      // An edit rebuilds the voucher's lines with NEW ids, so upserting alone left the old rows in
      // place — the voucher counted twice in voucher_entries (Assandh JV/2026/27/2384, 2026-10-02:
      // bank Dr twice, 4400 + 4405 both Cr). Drop this voucher's rows that are no longer its lines —
      // only after the new rows are confirmed, so a failed upsert never leaves it with no entries.
      const keep = rows.map(r => `"${r.id}"`).join(',');
      supabase.from('voucher_entries').delete().eq('voucherId', v.id).not('id', 'in', `(${keep})`).then(({ error: delErr }) => {
        if (delErr) { console.warn('voucher_entries stale-row cleanup error:', delErr.message); reportError('voucher-entries-sync', delErr.message, { voucherId: v.id, at: 'stale-cleanup' }); }
      });
    });
  };

  // Delete entries for a voucher (on cancel).
  const deleteEntries = (voucherId: string) => {
    supabase.from('voucher_entries').delete().eq('voucherId', voucherId).then(({ error }) => {
      if (error) { console.warn('voucher_entries delete error:', error.message); reportError('write-partial', error.message, { at: 'voucher_entries delete error:' }); }
    });
  };

  // S3-f-1 · a sale / purchase saved in ONE server call (post_stock_document, migration 080): official
  // numbers, the voucher (every post_voucher check), the document row, its movements and the currentStock
  // cache — all or nothing. On success the server's numbers / narration / event are restamped into local
  // state (the document, its movements and its voucher then carry ONE number); on any failure every
  // optimistic change is undone with a destructive toast (RULE 1).
  const postStockDocument = (args: {
    kind: 'sale' | 'purchase'; doc: Sale | Purchase; voucher: Voucher; event: LedgerEvent; movements: StockMovement[];
    rollbackVoucher: () => void; undoLocal: () => void;
  }) => {
    const { kind, doc, voucher, event, movements } = args;
    const docNoKey = kind === 'sale' ? 'saleNo' : 'purchaseNo';
    const label = kind === 'sale' ? tr('बिक्री', 'sale') : tr('खरीद', 'purchase');
    const fail = (msg: string) => {
      args.rollbackVoucher();
      args.undoLocal();
      reportError(`${kind}-post-service`, msg, { documentId: doc.id });
      toastRef.current({ title: tr(`❌ ${label} क्लाउड में सेव नहीं हुई`, `❌ ${label} not saved to the cloud`), description: tr(`${msg}. स्क्रीन से हटा दी गई — refresh करने पर कुछ ग़लत नहीं होगा।`, `${msg}. Removed from the screen — nothing will go wrong on refresh.`), variant: 'destructive', duration: 15000 });
    };
    const p = buildStockDocumentPayload(kind, doc, voucher, event, movements);
    supabase.rpc('post_stock_document', asDbArgs(p)).then(({ data, error }) => {
      if (error) { fail(postVoucherMessage(postVoucherErrorCode(error.message), error.message)); return; }
      const r = (data ?? {}) as { docNo?: string; voucherNo?: string; narration?: string; events?: Record<string, unknown>[] };
      const docNo = r.docNo ?? (doc as unknown as Record<string, string>)[docNoKey];
      const mvIds = new Set(movements.map(m => m.id));
      if (kind === 'sale') {
        salesRef.current = salesRef.current.map(x => x.id === doc.id ? { ...x, saleNo: docNo } : x);
        setSalesState(prev => prev.map(x => x.id === doc.id ? { ...x, saleNo: docNo } : x));
      } else {
        purchasesRef.current = purchasesRef.current.map(x => x.id === doc.id ? { ...x, purchaseNo: docNo } : x);
        setPurchasesState(prev => prev.map(x => x.id === doc.id ? { ...x, purchaseNo: docNo } : x));
      }
      stockMovementsRef.current = stockMovementsRef.current.map(m => mvIds.has(m.id) ? { ...m, referenceNo: docNo } : m);
      setStockMovementsState(prev => prev.map(m => mvIds.has(m.id) ? { ...m, referenceNo: docNo } : m));
      const vPatch = { ...(r.voucherNo ? { voucherNo: r.voucherNo } : {}), ...(r.narration !== undefined ? { narration: r.narration } : {}) };
      vouchersRef.current = vouchersRef.current.map(v => v.id === voucher.id ? { ...v, ...vPatch } : v);
      setVouchersState(prev => prev.map(v => v.id === voucher.id ? { ...v, ...vPatch } : v));
      const evs = mapLedgerEventRows(r.events ?? []);
      if (evs.length) ledgerEventsRef.current = [...ledgerEventsRef.current.filter(e => e.eventId !== event.eventId), ...evs];
      // The success toast carries the OFFICIAL number (the page no longer toasts the provisional one).
      toastRef.current({ title: tr(`✅ ${label} सहेजी गई: ${docNo}`, `✅ ${label} saved: ${docNo}`), description: kind === 'sale' ? `Sale saved: ${docNo}` : `Purchase saved: ${docNo}` });
    }, (e: unknown) => fail(`Network error — ${e instanceof Error ? e.message : String(e)}`));
  };

  // S3-f-2 · a sale / purchase deleted in ONE server call (cancel_stock_document, migration 082): row
  // soft-deleted, every linked voucher cancelled with its journal (cancel_voucher), movements removed,
  // currentStock restored from them — all or nothing. Local state changes optimistically (the same
  // changes the old path made) and is restored wholesale if the server refuses (RULE 1).
  const cancelStockDocument = (kind: 'sale' | 'purchase', doc: Sale | Purchase, docNo: string, voucherIds: string[], reason: string) => {
    const label = kind === 'sale' ? tr('बिक्री', 'sale') : tr('खरीद', 'purchase');
    const vTargets = vouchersRef.current.filter(v => voucherIds.includes(v.id) && !v.isDeleted && !isEngineVoucher(v));
    const vIds = new Set(vTargets.map(v => v.id));
    const movs = stockMovementsRef.current.filter(m => m.referenceNo === docNo);
    const qtyBy = new Map<string, number>();
    for (const m of movs) if (m.type === kind) qtyBy.set(m.itemId, (qtyBy.get(m.itemId) ?? 0) + m.qty);
    const stockBefore = new Map<string, number>();
    const now = new Date().toISOString();
    // Local, optimistic — mirrors the server.
    if (kind === 'sale') { salesRef.current = salesRef.current.filter(x => x.id !== doc.id); setSalesState(prev => prev.filter(x => x.id !== doc.id)); }
    else { purchasesRef.current = purchasesRef.current.filter(x => x.id !== doc.id); setPurchasesState(prev => prev.filter(x => x.id !== doc.id)); }
    const cancelV = (v: Voucher) => vIds.has(v.id) ? { ...v, isDeleted: true, deletedAt: now, deletedBy: 'System', deletedReason: reason } : v;
    vouchersRef.current = vouchersRef.current.map(cancelV);
    setVouchersState(prev => prev.map(cancelV));
    stockMovementsRef.current = stockMovementsRef.current.filter(m => m.referenceNo !== docNo);
    setStockMovementsState(prev => prev.filter(m => m.referenceNo !== docNo));
    setStockItemsState(prev => prev.map(i => {
      const q = qtyBy.get(i.id);
      if (q === undefined) return i;
      stockBefore.set(i.id, i.currentStock);
      return { ...i, currentStock: kind === 'sale' ? i.currentStock + q : Math.max(0, i.currentStock - q) };
    }));
    if (movs.length) emitAudit({ entityType: 'stockMovement', entityId: docNo, action: 'delete', before: { count: movs.length, movements: snapshotDeletedMovements(movs) }, reason });
    const undo = (msg: string) => {
      if (kind === 'sale') { salesRef.current = [...salesRef.current, doc as Sale]; setSalesState(prev => [...prev, doc as Sale]); }
      else { purchasesRef.current = [...purchasesRef.current, doc as Purchase]; setPurchasesState(prev => [...prev, doc as Purchase]); }
      const back = new Map(vTargets.map(v => [v.id, v]));
      vouchersRef.current = vouchersRef.current.map(v => back.get(v.id) ?? v);
      setVouchersState(prev => prev.map(v => back.get(v.id) ?? v));
      stockMovementsRef.current = [...stockMovementsRef.current, ...movs];
      setStockMovementsState(prev => [...prev, ...movs]);
      setStockItemsState(prev => prev.map(i => stockBefore.has(i.id) ? { ...i, currentStock: stockBefore.get(i.id)! } : i));
      reportError(`${kind}-cancel-post-service`, msg, { documentId: doc.id });
      toastRef.current({ title: tr(`❌ ${label} हटाना क्लाउड में सेव नहीं हुआ`, `❌ Deleting ${label} was not saved to the cloud`), description: tr(`${msg}. ${label} वापस दिखा दी गई — कुछ नहीं बदला।`, `${msg}. ${label} is shown again — nothing changed.`), variant: 'destructive', duration: 15000 });
    };
    supabase.rpc('cancel_stock_document', { p_kind: kind, p_id: doc.id, p_reason: reason, p_by: userRef.current?.name || 'System' }).then(({ data, error }) => {
      if (error) { undo(postVoucherMessage(postVoucherErrorCode(error.message), error.message)); return; }
      const evs = mapLedgerEventRows(((data as { events?: Record<string, unknown>[] } | null)?.events) ?? []);
      if (evs.length) ledgerEventsRef.current = [...ledgerEventsRef.current, ...evs];
    }, (e: unknown) => undo(`Network error — ${e instanceof Error ? e.message : String(e)}`));
  };

  // S3-f-3 · a sale / purchase EDIT in ONE server call (update_stock_document, migration 083): old
  // vouchers cancelled with their journal, stock + movements replaced, the new voucher posted, the row
  // updated in place — all or nothing. The caller has already applied the same changes locally; on success
  // the new voucher number and the server's journal events are restamped, on failure undo() restores it all.
  const postStockDocumentEdit = (args: {
    kind: 'sale' | 'purchase'; doc: Sale | Purchase; voucher: Voucher; event: LedgerEvent; movements: StockMovement[]; undo: () => void;
  }) => {
    const { kind, doc, voucher, event, movements } = args;
    const label = kind === 'sale' ? tr('बिक्री', 'sale') : tr('खरीद', 'purchase');
    const fail = (msg: string) => {
      args.undo();
      reportError(`${kind}-edit-post-service`, msg, { documentId: doc.id });
      toastRef.current({ title: tr(`❌ ${label} का बदलाव क्लाउड में सेव नहीं हुआ`, `❌ Change to ${label} not saved to the cloud`), description: tr(`${msg}. बदलाव वापस ले लिया गया — ${label} पहले जैसी ही है।`, `${msg}. The change was undone — ${label} is the same as before.`), variant: 'destructive', duration: 15000 });
    };
    const p = buildStockDocumentPayload(kind, doc, voucher, event, movements);
    supabase.rpc('update_stock_document', asDbArgs({
      p_kind: kind, p_id: doc.id, p_doc: p.p_doc, p_voucher: p.p_voucher, p_lines: p.p_lines, p_event: p.p_event, p_movements: p.p_movements,
      p_reason: null, p_by: userRef.current?.name || 'System',
    })).then(({ data, error }) => {
      if (error) { fail(postVoucherMessage(postVoucherErrorCode(error.message), error.message)); return; }
      const r = (data ?? {}) as { voucherNo?: string; events?: Record<string, unknown>[] };
      if (r.voucherNo) {
        vouchersRef.current = vouchersRef.current.map(v => v.id === voucher.id ? { ...v, voucherNo: r.voucherNo! } : v);
        setVouchersState(prev => prev.map(v => v.id === voucher.id ? { ...v, voucherNo: r.voucherNo! } : v));
      }
      const evs = mapLedgerEventRows(r.events ?? []);
      ledgerEventsRef.current = [...ledgerEventsRef.current.filter(e => e.eventId !== event.eventId), ...evs];
    }, (e: unknown) => fail(`Network error — ${e instanceof Error ? e.message : String(e)}`));
  };

  // S3-e-1 · the ONE way a parent-record cascade (member / loan / asset / sale / purchase / salary
  // slip deleted or edited) cancels its linked vouchers. The old per-site code only flipped isDeleted:
  // the journal kept a LIVE posting for every such voucher (69 in prod, ~₹37L, 2026-09-29) and a failed
  // write left the voucher cancelled on screen only. Here every voucher is cancelled WITH its journal:
  //   • posting service on → cancel_voucher (row + lines + entries + voucher.cancelled, one transaction)
  //   • off → targeted soft-delete, then entries removed and voucher.cancelled appended from the DB
  //     journal (ensureVoucherCancelEvent — never skipped because the journal wasn't loaded here)
  // A failed cancel puts that voucher back on screen with a destructive toast (RULE 1). Idempotent:
  // already-cancelled / engine vouchers are skipped, so a re-run (or a StrictMode double call) is a no-op.
  // Limitation (S3-f): the parent row / stock writes are still separate calls from these.
  // X-4: opts.rollback = the flow is withdrawing vouchers it just posted (server withdraw_voucher — no delete role needed).
  const cancelLinkedVouchers = (ids: readonly string[], reason: string, by: string, opts?: { rollback?: boolean }) => {
    const targets = vouchersRef.current.filter(v => ids.includes(v.id) && !v.isDeleted && !isEngineVoucher(v));
    if (!targets.length) return;
    const now = new Date().toISOString();
    const byId = new Map(targets.map(v => [v.id, v]));
    const cancel = (v: Voucher) => byId.has(v.id) ? { ...v, isDeleted: true, deletedAt: now, deletedBy: by, deletedReason: reason } : v;
    vouchersRef.current = vouchersRef.current.map(cancel);
    setVouchersState(prev => prev.map(cancel));
    const undo = (v: Voucher, msg: string) => {
      vouchersRef.current = vouchersRef.current.map(x => x.id === v.id ? v : x);
      setVouchersState(prev => prev.map(x => x.id === v.id ? v : x));
      reportError('voucher-cascade-cancel', msg, { voucherId: v.id, voucherNo: v.voucherNo, reason });
      toastRef.current({ title: tr('❌ जुड़ा वाउचर रद्द नहीं हुआ', '❌ Linked voucher was not cancelled'), description: tr(`${v.voucherNo}: ${msg}. वाउचर अभी भी चालू है — refresh करके दोबारा देखें।`, `${v.voucherNo}: ${msg}. The voucher is still active — refresh and check again.`), variant: 'destructive', duration: 15000 });
    };
    for (const v of targets) {
      const fail = (e: unknown) => undo(v, e instanceof Error ? e.message : String(e));
      if (postingServiceRef.current) {
        supabase.rpc(opts?.rollback ? 'withdraw_voucher' : 'cancel_voucher', { p_id: v.id, p_reason: reason, p_deleted_by: by }).then(({ data, error }) => {
          if (error) { undo(v, postVoucherMessage(postVoucherErrorCode(error.message), error.message)); return; }
          const evs = mapLedgerEventRows(((data as { events?: Record<string, unknown>[] } | null)?.events) ?? []);
          if (evs.length) ledgerEventsRef.current = [...ledgerEventsRef.current, ...evs];
        }, fail);
      } else {
        supabase.from('vouchers').update({ isDeleted: true, deletedAt: now, deletedBy: by, deletedReason: reason }).eq('id', v.id).then(({ error }) => {
          if (error) { undo(v, error.message); return; }
          deleteEntries(v.id);
          void ensureVoucherCancelEvent(v, by, reason);
        }, fail);
      }
    }
  };

  // Member-area stage A (M-6): a NEW loan or deposit account only for a live member — never for a
  // pending / rejected applicant or a resigned / expelled / deceased member (the pickers listed them).
  // Existing accounts of a member who later ceased are untouched (repayments, closure still work).
  const refuseNonLiveMember = (memberId: string | undefined, what: string): boolean => {
    if (!memberId) return false;
    const m = membersRef.current.find(x => x.id === memberId);
    if (!m || canHoldShares(m)) return false;
    toastRef.current({ title: tr(`${what} नहीं खुल सकता`, `${what} cannot be opened`), description: tr(`${m.name} सक्रिय/स्वीकृत सदस्य नहीं हैं (स्थिति: ${m.approvalStatus === 'pending' || m.approvalStatus === 'rejected' ? m.approvalStatus : m.status}) — नया ${what} केवल सक्रिय सदस्य के लिए।`, `${m.name} is not an active/approved member (status: ${m.approvalStatus === 'pending' || m.approvalStatus === 'rejected' ? m.approvalStatus : m.status}) — a new ${what} can be opened only for an active member.`), variant: 'destructive', duration: 10000 });
    return true;
  };

  // RULE 1 · a delete / save whose cloud write FAILED: put the record back on screen and say so loudly
  // (was an English "Save failed" with the row left gone locally — it came back on F5). Delete paths with a
  // cascade (linked vouchers, stock, party ledger) run that cascade only AFTER the parent write succeeds,
  // so a failed delete leaves nothing half-done.
  const failedCloudWrite = (what: string, error: { message: string }, restore: () => void) => {
    console.error('DB sync error:', error.message); reportError('db-sync', error.message, { what });
    restore();
    toastRef.current({
      title: tr(`❌ ${what} — क्लाउड में सेव नहीं हुआ`, `❌ ${what} — not saved to the cloud`),
      description: tr(`बदलाव वापस ले लिया गया है, दोबारा कोशिश करें। (Cloud save failed — the change was undone.) ${error.message}`, `Cloud save failed — the change was undone; please try again. ${error.message}`),
      variant: 'destructive', duration: 10000,
    });
  };

  // ── Voucher persistence helper (two-step + rollback) ──────────────────────
  // RULE: Every Supabase write MUST either (a) succeed silently or (b) roll back
  // local state AND show a loud destructive toast. Never let local state diverge
  // from Supabase silently — F5 will wipe local-only data and the user loses work.
  //
  // The base table only has core columns. Late-added columns (lines, refType,
  // refId, isCleared, clearedDate, editHistory, groupId, approvalStatus, ...)
  // sit in PostgREST's schema cache only AFTER you ALTER TABLE. If the cache is
  // stale they cause "Could not find column X" errors that nuke the whole upsert.
  // Solution: upsert ONLY base columns (always succeeds), then patch extras in a
  // second .update() call — that one is allowed to fail without losing the row.
  // T-03: the server document sequence, wrapped for issueOfficialNumber — returns null on any
  // error/absent data so the caller falls back to the client-provisional number (the
  // unique-index collision-retry stays the net). Shared by voucher / sale / purchase saves.
  const nextDocNumber = async (societyId: string, book: string, fy: string): Promise<number | null> => {
    const { data, error } = await supabase.rpc('next_document_number', { p_society_id: societyId, p_book: book, p_fy: fy });
    return error || data == null ? null : (typeof data === 'number' ? data : Number(data));
  };

  // ARCH-06: ONE message and ONE restamp for every voucher save path (client save, posting service, pending save) —
  // they used to carry their own copies, which is how three paths drift apart.
  const toastVoucherNotSaved = (msg: string) => toastRef.current({
    title: tr('❌ वाउचर क्लाउड में सेव नहीं हुआ', '❌ Voucher not saved to the cloud'),
    description: tr(`${voucherCheckErrorText(msg)}. स्क्रीन से entry हटा दी गई — refresh करने पर कुछ ग़लत नहीं होगा।`, `${voucherCheckErrorText(msg)}. The entry was removed from the screen — nothing will go wrong on refresh.`),
    variant: 'destructive',
    duration: 15000,
  });
  /** The server issued the official number: put it on the voucher on screen (ref + state). */
  const restampVoucherNo = (id: string, officialNo: string) => {
    vouchersRef.current = vouchersRef.current.map(x => x.id === id ? { ...x, voucherNo: officialNo } : x);
    setVouchersState(prev => prev.map(x => x.id === id ? { ...x, voucherNo: officialNo } : x));
  };
  const persistVoucher = (v: Voucher, opts: { onBaseFail: () => void; onBaseSuccess?: () => void; isUpdate?: boolean }) => {
    // journal-first-write (slice 4): when true, the voucher is ALREADY durably saved as a journal
    // event (the number was issued + the event verified before this call). This table write is now a
    // best-effort PROJECTION: skip re-issuing the number (the event's number is authoritative) and skip
    // the dup renumber-retry (renumbering would make the table diverge from the event). A base failure
    // therefore just runs opts.onBaseFail (log-only from the caller — NO rollback, the journal is truth).
    // Strip out everything that may live in late-added columns. branchId is the exception
    // (ECR-17 Phase 5): it stays IN the base upsert because the branch-scoped RLS SELECT
    // policies (migration 039) must see it on the row from birth — otherwise a branch-
    // restricted user's fresh voucher is invisible to its own verify-read below and would
    // be falsely rolled back. attemptBase retries without it on a stale schema cache.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    // chequeNo / chequeDate (migration 205) are kept out of BOTH steps — patchVoucherCheque writes them on their own,
    // so an un-migrated database never loses the voucher's lines or approval status over a cheque number.
    const { lines, refType, refId, billAllocations, isCleared, clearedDate, editHistory, groupId,
            approvalStatus, approvalRemarks, approvedBy, approvedAt, workOrderId, costCentreId, chequeNo, chequeDate, ...baseCols } = v;

    const handleBaseFailure = (msg: string) => {
      console.error(`Voucher ${opts.isUpdate ? 'update' : 'save'} failed (base):`, msg);
      // audit P0-2: the RULE-1 divergence the operator must SEE — surface it off-device.
      reportError('voucher-save', msg, { voucherId: v.id, voucherNo: (v as { voucherNo?: string }).voucherNo, isUpdate: !!opts.isUpdate });
      opts.onBaseFail();
      toastVoucherNotSaved(msg);
    };

    // Feature 6: a duplicate voucherNo (another till minted it) fails the base upsert
    // with 23505 — keep the prefix+FY, bump to max+1, restamp state, and retry.
    const renumberVoucher = (cur: string | undefined): string => {
      const m = cur?.match(/^(.*)\/(\d+)$/);
      const head = m ? m[1] : (cur || '');
      let max = 0;
      for (const vx of vouchersRef.current) {
        const mm = vx.voucherNo?.match(/^(.*)\/(\d+)$/);
        if (mm && mm[1] === head) max = Math.max(max, parseInt(mm[2], 10));
      }
      return `${head}/${String(max + 1).padStart(3, '0')}`;
    };
    const attemptBase = (cols: typeof baseCols, tries: number) => {
    supabase.from('vouchers').upsert(withSoc(cols)).then(({ error }) => {
      if (error) {
        if (isMissingBranchColumn(error) && 'branchId' in cols) {
          // Stale schema cache without "branchId" → retry the base save without it (the
          // step-2 extras patch still tries to stamp it, and warns loudly if it can't).
          const { branchId: _b, ...noBranch } = cols as typeof cols & { branchId?: string };
          attemptBase(noBranch, tries);
          return;
        }
        if (isUniqueViolation(error) && !opts.isUpdate && tries < MAX_RENUMBER_RETRIES) {
          const newNo = renumberVoucher((cols as { voucherNo?: string }).voucherNo);
          vouchersRef.current = vouchersRef.current.map(x => x.id === v.id ? { ...x, voucherNo: newNo } : x);
          setVouchersState(prev => prev.map(x => x.id === v.id ? { ...x, voucherNo: newNo } : x));
          attemptBase({ ...cols, voucherNo: newNo }, tries + 1);
          return;
        }
        handleBaseFailure(error.message);
        return;
      }
      // VERIFY: confirm the row actually persisted (catches RLS / cache-miss
      // edge cases where upsert returns no error but no row was written).
      supabase.from('vouchers').select('id').eq('id', v.id).limit(1).then(({ data: verifyData, error: verifyErr }) => {
        if (verifyErr || !verifyData || verifyData.length === 0) {
          handleBaseFailure(verifyErr?.message || 'Verification failed — row not found after upsert');
          return;
        }
      // Base row is confirmed durable — the voucher save is authoritative. Only now is it safe to
      // append the shadow ledger event to the WORM ledger_events table (never before, so a failed/
      // rolled-back voucher can never leave an un-deletable orphan event).
      opts.onBaseSuccess?.();
      // Step 2: best-effort patch of overlay columns. ECR-04: critical control/audit
      // overlays (approvalStatus/editHistory/…) must NOT be lost silently. Split the
      // buckets, retry once (clears the common PostgREST schema-cache lag), and on a
      // terminal failure raise a LOUD toast when critical data didn't reach the cloud.
      const { critical, optional, hasCritical } = splitVoucherExtras(v as unknown as Record<string, unknown>);
      const extras = { ...optional, ...critical };
      if (Object.keys(extras).length === 0) {
        if (!opts.isUpdate) syncEntries(v);
        return;
      }
      const EXTRAS_MAX_RETRIES = 1;
      const patchExtras = (tries: number) => {
        supabase.from('vouchers').update(extras).eq('id', v.id).then(({ error: e2 }) => {
          if (e2) {
            if (tries < EXTRAS_MAX_RETRIES) { setTimeout(() => patchExtras(tries + 1), 1500); return; }
            console.warn('Voucher extras patch failed (run latest supabase-tables.sql migration):', e2.message);
            toastRef.current(extrasFailureToast(hasCritical, e2.message));
          }
          // Sync voucher_entries once, at the terminal outcome — they use confirmed base columns.
          if (!opts.isUpdate) syncEntries(v);
        });
      };
      patchExtras(0);
      }); // close verify .then
    }, (rejection: unknown) => {
      // Promise rejection (network error, fetch abort) — supabase-js usually resolves
      // with { error } rather than rejecting, but cover the rare case.
      const msg = rejection instanceof Error ? rejection.message : String(rejection);
      handleBaseFailure(`Network/promise rejection: ${msg}`);
    });
    };
    // T-03 (ADR-0005): for a NEW voucher, take the OFFICIAL number from the server sequence at
    // this durable-append point — atomic, gapless, collision-free (next_document_number). Restamp
    // local state to the issued number. Falls back to the client-provisional number on
    // offline/RPC failure; the 23505 collision-retry above stays the safety net, so this is safe
    // even BEFORE the document_sequences backfill (migration 016) runs. Updates keep their number.
    const provisionalNo = (baseCols as { voucherNo?: string }).voucherNo;
    if (opts.isUpdate) {
      attemptBase(baseCols, 0);   // an update keeps its number
    } else {
      issueOfficialNumber(nextDocNumber, societyIdRef.current, provisionalNo).then((officialNo) => {
        if (officialNo && officialNo !== provisionalNo) {
          restampVoucherNo(v.id, officialNo);
        }
        attemptBase({ ...baseCols, voucherNo: officialNo ?? provisionalNo ?? v.voucherNo }, 0);
      });
    }
  };

  // opts.persistWith (S3-f-1): the caller persists this voucher TOGETHER with its document in one server
  // call (post_stock_document). addVoucher builds + applies it optimistically exactly as always, then hands
  // over the voucher, its voucher.posted event and the rollback instead of saving it itself.
  type VoucherPersistWith = (v: Voucher, ev: LedgerEvent, rollback: () => void) => void;
  // opts.onPersisted (S4-a): called once the posting service has made the voucher durable (with its official
  // number) — for a follow-up server call that needs the row to exist (reverseVoucher's link).
  // Member-audit M1 (D1, 2026-10-16): the same refusals addVoucher applies, asked BEFORE a flow that posts a voucher
  // and then moves a scalar (member share capital). Those flows used to ignore addVoucher's empty return, so a
  // period-locked / role-refused / expired-plan voucher was refused while the member's share capital still changed.
  const voucherBirthBlocked = (date: string): boolean => {
    if (guardPermission('create', tr('वाउचर बनाने', 'create vouchers'))) return true;
    if (guardFYLocked()) return true;   // offline / core-load write block + the audit-locked year (Hindi toast)
    if (guardSubscriptionExpired()) return true;
    return guardPeriodLock(date);
  };

  // Migration 205: write a voucher's cheque / DD number and date in their OWN update (never with the base row or the
  // lines / approval extras). Resolves the error message, or null when saved. Local state is the caller's to keep in step.
  const patchVoucherCheque = (id: string, chequeNo: string | undefined, chequeDate: string | undefined): Promise<string | null> =>
    new Promise(resolve => {
      supabase.from('vouchers').update({ chequeNo: chequeNo?.trim() || null, chequeDate: chequeDate || null }).eq('id', id).select('id').then(
        ({ data, error }) => {
          const msg = error?.message ?? (data && data.length ? null : 'cheque update matched 0 rows');
          if (msg) reportError('write-partial', msg, { at: 'voucher cheque patch', voucherId: id });
          resolve(msg);
        },
        (e: unknown) => resolve(e instanceof Error ? e.message : String(e)),
      );
    });
  const chequeNotSavedToast = (msg: string) => toastRef.current({
    title: tr('वाउचर सेव हुआ — पर cheque नं. नहीं', 'Voucher saved — but not the cheque no.'),
    description: tr(`Cheque नं. / तारीख़ क्लाउड में सेव नहीं हुई (${msg})। Migration 205 चलाएँ, फिर वाउचर edit करके दोबारा भरें।`, `The cheque no. / date did not reach the cloud (${msg}). Run Migration 205, then edit the voucher and fill them again.`),
    duration: 10000,
  });

  // Cheque / DD details on an existing voucher (Vouchers page edit). Same guards as an edit; rolled back on failure.
  const setVoucherCheque = useCallback((id: string, chequeNo: string | undefined, chequeDate: string | undefined): boolean => {
    const cur = vouchersRef.current.find(v => v.id === id);
    if (!cur || cur.isDeleted) return false;
    if (guardPageWrite('update', cur.date)) return false;
    const next = { chequeNo: chequeNo?.trim() || undefined, chequeDate: chequeDate || undefined };
    if ((cur.chequeNo || undefined) === next.chequeNo && (cur.chequeDate || undefined) === next.chequeDate) return true;
    const put = (fields: { chequeNo?: string; chequeDate?: string }) => {
      vouchersRef.current = vouchersRef.current.map(v => v.id === id ? { ...v, ...fields } : v);
      setVouchersState(prev => prev.map(v => v.id === id ? { ...v, ...fields } : v));
    };
    put(next);
    void patchVoucherCheque(id, next.chequeNo, next.chequeDate).then(msg => {
      if (!msg) return;
      put({ chequeNo: cur.chequeNo, chequeDate: cur.chequeDate });   // RULE 1: roll back
      toastRef.current({ title: tr('Cheque नं. सेव नहीं हुआ', 'Cheque no. not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${msg}। Migration 205 चली है?`, `Not saved to the cloud — ${msg}. Has Migration 205 been run?`), variant: 'destructive', duration: 10000 });
    });
    return true;
  }, [guardPageWrite]); // eslint-disable-line react-hooks/exhaustive-deps

  const addVoucher = useCallback((data: Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'> & { voucherNo?: string }, opts?: { persistWith?: VoucherPersistWith; onPersisted?: (v: Voucher) => void; onSaved?: (v: Voucher) => void; onFailed?: () => void }): Voucher => {
    // ECR-06: role gate at the voucher choke point — every composite flow (sale/purchase/salary/
    // loan/reversal) and page funnels through here, so one guard covers every voucher birth.
    if (guardPermission('create', tr('वाउचर बनाने', 'create vouchers'))) {
      return { id: '', voucherNo: '', type: data.type, date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    }
    // F1: online-only entry — addVoucher carries its own FY check rather than guardFYLocked, so the
    // shared write-block is applied here explicitly (every voucher birth funnels through this point).
    if (refuseIfWriteBlocked(toastRef.current)) {
      return { id: '', voucherNo: '', type: data.type, date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    }
    // P2-1: Block new vouchers when the FY is audit-locked
    if (society.fyLocked) {
      toastRef.current({
        title: 'FY is Audit-Locked',
        description: `Financial Year ${society.financialYear} has been locked by ${society.fyLockedBy || 'admin'}. No new entries are allowed. Contact the administrator to unlock.`,
        variant: 'destructive',
      });
      // Return a dummy voucher object to satisfy the return type — caller must handle gracefully
      return { id: '', voucherNo: '', type: data.type, date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    }
    // Phase 2a-4c: block NEW entries when the subscription has expired (read-only).
    // Reads/reports/export stay available and data is never deleted (RULE-1).
    if (guardSubscriptionExpired()) {
      return { id: '', voucherNo: '', type: data.type, date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    }
    // ECR-07: block back-dating a new voucher into a locked period.
    if (guardPeriodLock(data.date)) {
      return { id: '', voucherNo: '', type: data.type, date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    }
    // Migration 205: a voucher born with a cheque no. gets it written in its own patch once the voucher is durable,
    // whichever save path ran (post_voucher, save_pending_voucher or the client two-step).
    if (data.chequeNo || data.chequeDate) {
      const callerSaved = opts?.onSaved;
      opts = { ...opts, onSaved: (saved: Voucher) => {
        void patchVoucherCheque(saved.id, data.chequeNo, data.chequeDate).then(msg => {
          if (!msg) return;
          vouchersRef.current = vouchersRef.current.map(v => v.id === saved.id ? { ...v, chequeNo: undefined, chequeDate: undefined } : v);
          setVouchersState(prev => prev.map(v => v.id === saved.id ? { ...v, chequeNo: undefined, chequeDate: undefined } : v));
          chequeNotSavedToast(msg);
        });
        callerSaved?.(saved);
      } };
    }
    // Final batch: a MANUAL voucher on Share Capital 1102 tagged to a member never moves member.shareCapital — the
    // register and the ledger drifted (2 members in prod). Member share moves go through the Share Register.
    if (data.origin === 'manual' && data.memberId && touchesShareCapital(data, ACCOUNT_IDS.SHARE_CAP)) {
      toastRef.current({ title: tr('शेयर रजिस्टर से करें', 'Use the Share Register'), description: manualMemberShareVoucherMessage(), variant: 'destructive', duration: 12000 });
      return { id: '', voucherNo: '', type: data.type, date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    }

    // P2-3: Warn if voucher date is outside the active FY range
    const fyEnd = `20${society.financialYear.split('-')[1]}-03-31`;
    const fyStart = societyFyStart(society);
    if (data.date && fyStart && (data.date < fyStart || data.date > fyEnd)) {
      toastRef.current({
        title: tr('तारीख़ चालू वित्त वर्ष से बाहर / Date Outside Financial Year', 'Date Outside Financial Year'),
        description: tr(`वाउचर की तारीख़ ${data.date} चालू वित्त वर्ष ${society.financialYear} (${fyStart} से ${fyEnd}) से बाहर है। एंट्री सहेजी जा रही है — कृपया तारीख़ जाँच लें। / Voucher date is outside the active FY. Entry is being saved, but please verify the date.`, `Voucher date ${data.date} is outside the current Financial Year ${society.financialYear} (${fyStart} to ${fyEnd}). The entry is being saved — please check the date.`),
        variant: 'default',
      });
    }

    const lid = () => crypto.randomUUID();
    // Build lines if not provided (legacy single Dr/Cr mode)
    let lines: VoucherLine[] | undefined = data.lines;
    if (!lines || lines.length === 0) {
      if (data.debitAccountId && data.creditAccountId && (data.amount || 0) > 0) {
        lines = [
          { id: lid(), accountId: data.debitAccountId, type: 'Dr', amount: data.amount! },
          { id: lid(), accountId: data.creditAccountId, type: 'Cr', amount: data.amount! },
        ];
      }
    }
    if (blockGroupPosting(lines ?? [])) {
      return { id: '', voucherNo: '', type: data.type, date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    }

    // ── Double-entry balance guard (Audit C-1/C-2, NCDC double-entry rule) ────
    // Every Dr MUST have an equal Cr. Two-tier handling:
    //  • Sub-rupee residual (< ₹1) = rounding from pro-rated GST/TDS splits →
    //    snap it into the largest line on the deficient side so the voucher
    //    tallies EXACTLY (standard accounting rounding adjustment).
    //  • Material imbalance (≥ ₹1) = a real error → BLOCK the save with a loud
    //    toast and return a dummy voucher (caller handles id==='' gracefully).
    if (lines && lines.length > 0) {
      lines = snapSubRupeeResidual(lines);
      const bal = voucherLinesBalance(lines);
      if (!bal.balanced) {
        toastRef.current({
          title: tr('❌ वाउचर असंतुलित / Voucher not balanced', '❌ Voucher not balanced'),
          description: tr(`डेबिट ₹${bal.drTotal.toFixed(2)} ≠ क्रेडिट ₹${bal.crTotal.toFixed(2)} (अंतर ₹${bal.diff.toFixed(2)})। हर Dr का बराबर Cr होना चाहिए — ठीक करके दोबारा save करें।`, `Debit ₹${bal.drTotal.toFixed(2)} ≠ Credit ₹${bal.crTotal.toFixed(2)} (difference ₹${bal.diff.toFixed(2)}). Every Dr needs an equal Cr — fix it and save again.`),
          variant: 'destructive',
          duration: 12000,
        });
        return { id: '', voucherNo: '', type: data.type, date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
      }
    }

    // Compute legacy fields from lines (for backward compat with existing reports)
    const drLines = (lines || []).filter(l => l.type === 'Dr');
    const crLines = (lines || []).filter(l => l.type === 'Cr');
    const debitAccountId = data.debitAccountId || drLines[0]?.accountId || '';
    const creditAccountId = data.creditAccountId || crLines[0]?.accountId || '';
    const amount = data.amount || drLines.reduce((s, l) => s + l.amount, 0);

    const voucherNo = data.voucherNo?.trim() || storage.getNextVoucherNo(data.type, society.financialYear, vouchersRef.current);
    // ECR-11: hold MANUAL vouchers for approval when the matrix matches (all-manual flag OR
    // amount ≥ threshold). Only origin==='manual' is subject to this — auto/engine vouchers
    // are never held. If the caller already set a status, respect it.
    const needsApproval = data.origin === 'manual' && data.approvalStatus === undefined &&
      requiresApproval(amount, data.type, { approvalRequired: society.approvalRequired, threshold: society.approvalThresholdAmount, types: society.approvalVoucherTypes });
    const newVoucher: Voucher = {
      ...data,
      id: lid(),
      voucherNo,
      lines,
      debitAccountId,
      creditAccountId,
      amount,
      approvalStatus: needsApproval ? 'pending' : data.approvalStatus,
      // ECR-17: stamp the branch — explicit on data, else the active branch (or Head Office when viewing "all").
      branchId: data.branchId ?? branchToStamp(activeBranchIdRef.current, headOfficeIdRef.current),
      createdAt: new Date().toISOString(),
    };
    // Update ref immediately so the next addVoucher call in the same tick sees this voucher
    vouchersRef.current = [...vouchersRef.current, newVoucher];
    setVouchersState(prev => [...prev, newVoucher]);

    // T-06 shadow dual-write: emit an immutable `voucher.posted` event for a posted (non-pending)
    // voucher. Best-effort and fully isolated — any failure here can never affect the voucher save.
    // Built before persist so the rollback below can drop it too, keeping the shadow ledger
    // consistent with the vouchers it mirrors.
    let shadowEvent: LedgerEvent | null = null;
    try {
      if (newVoucher.approvalStatus !== 'pending') {
        shadowEvent = buildEvent({
          eventType: 'voucher.posted',
          tenantId: societyIdRef.current,
          jurisdiction: jurisdictionRef.current,
          aggregateType: 'voucher',
          aggregateId: newVoucher.id,
          sequence: 1,
          producer: { kind: 'human', id: userRef.current?.name ?? null },
          // T-06: carry the balanced posting LEGS (exact paise) so the journal is replay-faithful —
          // projectTrialBalance/replayBalances reconstruct balances from `lines`. Metadata kept alongside.
          payload: { lines: voucherPostingLines(newVoucher), ...voucherEventMeta(newVoucher) },
        }, { eventId: crypto.randomUUID(), occurredAt: new Date().toISOString() });
        ledgerEventsRef.current = [...ledgerEventsRef.current, shadowEvent];
      }
    } catch { /* shadow ledger is best-effort — never touches the voucher save path */ }

    // Roll back the optimistic voucher + its shadow event (shared by both save paths on failure).
    const rollbackOptimistic = () => {
      vouchersRef.current = vouchersRef.current.filter(v => v.id !== newVoucher.id);
      setVouchersState(prev => prev.filter(v => v.id !== newVoucher.id));
      if (shadowEvent) ledgerEventsRef.current = ledgerEventsRef.current.filter(e => e.eventId !== shadowEvent!.eventId);
    };

    if (opts?.persistWith && shadowEvent) { opts.persistWith(newVoucher, shadowEvent, rollbackOptimistic); return newVoucher; }
    // ARCH-03: a stock document (sale / purchase) saves ONLY through the server (post_stock_document) — the
    // old client multi-call path is gone. Without its ledger event (pending, or the event failed to build) it
    // cannot be posted there, so nothing is saved and the caller stops on the empty id.
    if (opts?.persistWith) {
      rollbackOptimistic();
      reportError('stock-document-no-event', 'stock document voucher has no ledger event', { voucherId: newVoucher.id, approvalStatus: newVoucher.approvalStatus });
      toastRef.current({ title: tr('❌ बिल सेव नहीं हुआ', '❌ Bill not saved'), description: tr('इस बिल का वाउचर नहीं बन सका, इसलिए कुछ भी सेव नहीं हुआ। दोबारा कोशिश करें।', 'The voucher for this bill could not be built, so nothing was saved. Please try again.'), variant: 'destructive', duration: 10000 });
      opts?.onFailed?.();
      return { ...newVoucher, id: '' };
    }

    // ── S3-b posting service — per-society flag (society_flags.posting_service), default OFF ─────
    // ONE server call writes the vouchers row, voucher_lines, voucher_entries and the journal event in
    // one transaction (post_voucher, migration 077) — no half-saved voucher on a dropped connection.
    // The posting rule stays here (RULE 2): the payload carries getVoucherLines legs + the same event.
    // Any refusal/failure → rollback + destructive toast (RULE 1). Flag OFF → the path below, unchanged.
    // S4-a (104) · a PENDING voucher with the posting service ON: save_pending_voucher stores the row (and issues
    // the official number) server-side — no lines, entries or journal event until approve_voucher posts it.
    if (postingServiceRef.current && newVoucher.approvalStatus === 'pending') {
      const failPending = (msg: string, raw: string) => {
        reportError('voucher-pending-post-service', raw, { voucherId: newVoucher.id });
        rollbackOptimistic();
        toastVoucherNotSaved(msg);
        opts?.onFailed?.();
      };
      const pp = buildPendingVoucherPayload(newVoucher);
      supabase.rpc('save_pending_voucher', asDbArgs(pp)).then(({ data, error }) => {
        if (error) { failPending(postVoucherMessage(postVoucherErrorCode(error.message), error.message), error.message); return; }
        const officialNo = (data as { voucherNo?: string } | null)?.voucherNo;
        if (officialNo && officialNo !== newVoucher.voucherNo) {
          restampVoucherNo(newVoucher.id, officialNo);
        }
        opts?.onPersisted?.({ ...newVoucher, voucherNo: officialNo || newVoucher.voucherNo });
        opts?.onSaved?.({ ...newVoucher, voucherNo: officialNo || newVoucher.voucherNo });
      }, (rejection: unknown) => { const msg = rejection instanceof Error ? rejection.message : String(rejection); failPending(`Network error — ${msg}`, msg); });
      return newVoucher;
    }

    if (postingServiceRef.current && shadowEvent) {
      const provisionalNo = newVoucher.voucherNo;
      const eventFor = (v: Voucher) => buildEvent({
        eventType: 'voucher.posted', tenantId: societyIdRef.current, jurisdiction: jurisdictionRef.current,
        aggregateType: 'voucher', aggregateId: v.id, sequence: 1,
        producer: { kind: 'human', id: userRef.current?.name ?? null },
        payload: { lines: voucherPostingLines(v), ...voucherEventMeta(v) },
      }, { eventId: shadowEvent!.eventId, occurredAt: shadowEvent!.occurredAt });
      const restamp = (v: Voucher, ev: LedgerEvent) => {
        vouchersRef.current = vouchersRef.current.map(x => x.id === v.id ? v : x);
        setVouchersState(prev => prev.map(x => x.id === v.id ? v : x));
        ledgerEventsRef.current = ledgerEventsRef.current.map(e => e.eventId === ev.eventId ? ev : e);
      };
      const fail = (msg: string, raw: string) => {
        reportError('voucher-post-service', raw, { voucherId: newVoucher.id, voucherNo: provisionalNo });
        rollbackOptimistic();
        toastVoucherNotSaved(msg);
        opts?.onFailed?.();
      };
      const attempt = (v: Voucher, tries: number) => {
        const ev = eventFor(v);
        restamp(v, ev);
        const p = buildPostVoucherPayload(v, ev);
        supabase.rpc('post_voucher', asDbArgs(p)).then(({ data, error }) => {
          if (!error) {
            // 'posted' or 'exists' (idempotent retry) — both mean the voucher is durable. 096: the server
            // issued the OFFICIAL number inside the posting transaction — restamp it locally.
            const officialNo = (data as { voucherNo?: string } | null)?.voucherNo;
            if (officialNo && officialNo !== v.voucherNo) {
              const nv = { ...v, voucherNo: officialNo };
              const nev = { ...ev, payload: { ...(ev.payload as Record<string, unknown>), voucherNo: officialNo } } as LedgerEvent;
              restamp(nv, nev);
              opts?.onPersisted?.(nv);
              opts?.onSaved?.(nv);
            } else { opts?.onPersisted?.(v); opts?.onSaved?.(v); }
            return;
          }
          if (isUniqueViolation(error) && tries < MAX_RENUMBER_RETRIES) {
            // Another device took this number — bump to max+1 in the same series and retry.
            const m = v.voucherNo?.match(/^(.*)\/(\d+)$/);
            const head = m ? m[1] : (v.voucherNo || '');
            let max = 0;
            for (const vx of vouchersRef.current) { const mm = vx.voucherNo?.match(/^(.*)\/(\d+)$/); if (mm && mm[1] === head) max = Math.max(max, parseInt(mm[2], 10)); }
            attempt({ ...v, voucherNo: `${head}/${String(max + 1).padStart(3, '0')}` }, tries + 1);
            return;
          }
          const code = postVoucherErrorCode(error.message);
          fail(postVoucherMessage(code, error.message), error.message);
        }, (rejection: unknown) => {
          const msg = rejection instanceof Error ? rejection.message : String(rejection);
          fail(`Network error — ${msg}`, msg);
        });
      };
      // 096: post_voucher issues the OFFICIAL number inside its own transaction (gapless — a refused post
      // spends no number) and returns it; no client pre-issue, which used to burn a number per failure.
      attempt(newVoucher, 0);
      return newVoucher;
    }

    // ── Client save: the emergency switch (society_flags.posting_service = false), or a voucher with no ledger
    //    event to post. Table-first, two-step + rollback (RULE 1). ──
    // If base save fails, REMOVE the voucher from local state so the UI reflects what's actually in
    // Supabase — F5 won't silently delete the user's work because the work was never optimistically
    // shown as "saved" once the failure was confirmed.
    persistVoucher(newVoucher, {
      isUpdate: false,
      // The voucher save is authoritative; the ledger event is durably appended ONLY after the base
      // row is confirmed (WORM-safe — a rolled-back voucher never orphans an event).
      onBaseSuccess: () => {
        if (shadowEvent) persistLedgerEvent(shadowEvent);
        opts?.onSaved?.(vouchersRef.current.find(x => x.id === newVoucher.id) ?? newVoucher);
      },
      onBaseFail: () => { rollbackOptimistic(); opts?.onFailed?.(); },
    });
    return newVoucher;
  }, [society.financialYear, society.fyLocked, society.fyLockedBy, society.financialYearStart]);

  // ── ECR-17 Phase 2: inter-branch transfer ──────────────────────────────────
  // Moves cash/bank between two branches via the Inter-Branch Control A/c (created
  // on-demand). Posts TWO branch-stamped, self-balancing vouchers; consolidated the
  // control account and the cash-bank net to zero.
  const transferBetweenBranches = useCallback((input: { fromBranchId: string; toBranchId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; narration?: string }) => {
    if (guardFYLocked()) return;
    const amt = toRupees(toMinor(Math.max(0, input.amount || 0)));
    if (amt <= 0 || input.fromBranchId === input.toBranchId) {
      toastRef.current({ title: tr('अमान्य ट्रांसफर', 'Invalid transfer'), description: tr('From/To शाखा अलग हों और राशि > 0 हो।', 'From and To branches must be different, and the amount must be > 0.'), variant: 'destructive' });
      return;
    }
    // Ensure the Inter-Branch Control account exists (fixed id, on-demand).
    if (!accounts.find(a => a.id === INTER_BRANCH_CONTROL_ID)) {
      const control: LedgerAccount = { id: INTER_BRANCH_CONTROL_ID, name: 'Inter-Branch Control A/c', nameHi: 'अंतर-शाखा नियंत्रण खाता', type: 'liability', subtype: 'current_liability', openingBalance: 0, openingBalanceType: 'credit', parentId: '2100', isGroup: false };
      setAccountsState(prev => [...prev, control]);
      supabase.from('accounts').upsert(withSoc(control)).then(({ error }) => {
        if (error) {   // G4 / RULE 1: the transfer vouchers would reference an account the cloud lacks
          setAccountsState(prev => prev.filter(a => a.id !== control.id));
          reportError('control-account-save', error.message, { accountId: control.id });
          toastRef.current({ title: tr('अंतर-शाखा खाता सेव नहीं हुआ', 'Inter-branch account not saved'), description: tr(`${error.message}. ट्रांसफर दोबारा करें; न हो तो admin को बताएँ।`, `${error.message}. Do the transfer again; if it still fails, tell your admin.`), variant: 'destructive', duration: 15000 });
        }
      });
    }
    const acct = input.mode === 'bank' ? (input.bankAccountId || defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK) : ACCOUNT_IDS.CASH;
    const t = buildInterBranchTransfer({ fromBranchId: input.fromBranchId, toBranchId: input.toBranchId, amount: amt, fromAccountId: acct, toAccountId: acct });
    const lid = () => crypto.randomUUID();
    const nameOf = (id: string) => branches.find(b => b.id === id)?.name || 'branch';
    addVoucher({ type: 'journal', date: input.date, branchId: input.fromBranchId, debitAccountId: INTER_BRANCH_CONTROL_ID, creditAccountId: acct, amount: amt, lines: t.from.lines.map(l => ({ id: lid(), ...l })), narration: input.narration || `Inter-branch transfer to ${nameOf(input.toBranchId)}`, createdBy: userRef.current?.name ?? 'System' });
    addVoucher({ type: 'journal', date: input.date, branchId: input.toBranchId, debitAccountId: acct, creditAccountId: INTER_BRANCH_CONTROL_ID, amount: amt, lines: t.to.lines.map(l => ({ id: lid(), ...l })), narration: input.narration || `Inter-branch transfer from ${nameOf(input.fromBranchId)}`, createdBy: userRef.current?.name ?? 'System' });
    toastRef.current({ title: tr('अंतर-शाखा ट्रांसफर दर्ज', 'Inter-branch transfer recorded'), description: `${nameOf(input.fromBranchId)} → ${nameOf(input.toBranchId)}: ₹${amt.toLocaleString('en-IN')}` });
  }, [accounts, branches, addVoucher]);

  // ── Bill-wise receipt (Tally "Against Reference"): a customer payment applied to
  //    one or more open credit bills. Builds a Dr Cash/Bank, Cr Customer receipt
  //    voucher and tags it with billAllocations; bill balances are DERIVED from
  //    these allocations (lib/billUtils), so deleting the receipt auto-reverses it.
  const addBillReceipt = useCallback((data: {
    customerId: string;
    date: string;
    paymentMode: 'cash' | 'bank';
    bankAccountId?: string;
    allocations: { saleId: string; amount: number }[];
    advance?: number;       // money received before/without a specific bill
    onAccount?: number;     // received in excess of the bills, kept unallocated
    narration?: string;
  }): Voucher | null => {
    if (guardFYLocked()) return null;
    const cust = customers.find(c => c.id === data.customerId);
    const custAcc = cust?.accountId || defaultDebtorsAccountId(accountsRef.current);   // Sundry Debtors fallback
    const allocs = data.allocations.filter(a => a.amount > 0);
    const adv = Math.max(0, +(data.advance || 0));
    const onAcc = Math.max(0, +(data.onAccount || 0));
    const total = toRupees(addMinor(sumMinor(allocs.map(a => toMinor(a.amount))), toMinor(adv), toMinor(onAcc)));
    if (total <= 0) {
      toastRef.current({ title: tr('राशि डालें', 'Enter an amount'), description: tr('कम से कम एक बिल के विरुद्ध (या अग्रिम) राशि भरें।', 'Enter an amount against at least one bill (or as an advance).'), variant: 'destructive' });
      return null;
    }
    const debitAcc = data.paymentMode === 'cash'
      ? ACCOUNT_IDS.CASH
      : (data.bankAccountId || defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK);
    const billAllocations: BillAllocation[] = [
      ...allocs.map(a => {
        const sale = salesRef.current.find(s => s.id === a.saleId);
        return { billId: a.saleId, billNo: sale?.saleNo || '', saleId: a.saleId, saleNo: sale?.saleNo || '', amount: toRupees(toMinor(a.amount)), method: 'against' as const };
      }),
      ...(adv > 0 ? [{ amount: toRupees(toMinor(adv)), method: 'advance' as const }] : []),
      ...(onAcc > 0 ? [{ amount: toRupees(toMinor(onAcc)), method: 'on-account' as const }] : []),
    ];
    const billList = billAllocations.filter(b => b.method === 'against').map(b => b.billNo).filter(Boolean).join(', ');
    const tag = billList ? `बिल ${billList} के विरुद्ध` : (adv > 0 ? 'अग्रिम राशि' : 'On Account');
    const narration = `${cust?.name || 'ग्राहक'} से प्राप्त — ${tag}${data.narration?.trim() ? ' · ' + data.narration.trim() : ''}`;
    const lid = () => crypto.randomUUID();
    const v = addVoucher({
      type: 'receipt',
      date: data.date,
      debitAccountId: debitAcc,
      creditAccountId: custAcc,
      amount: total,
      narration,
      refType: 'bill-receipt',
      refId: data.customerId,
      origin: 'manual',   // ECR-11: user-created → subject to the approval matrix
      billAllocations,
      lines: [
        { id: lid(), accountId: debitAcc, type: 'Dr', amount: total },
        { id: lid(), accountId: custAcc, type: 'Cr', amount: total },
      ],
      createdBy: user?.name ?? 'System',
    });
    return v && v.id ? v : null;
  }, [customers, accounts, addVoucher, user?.name]);

  // ── Bill-wise payment (supplier side): a payment applied to one or more open credit
  //    purchase bills (and/or advance/on-account). Builds Dr Supplier, Cr Cash/Bank and
  //    tags billAllocations; balances are DERIVED (lib/billUtils), mirror of addBillReceipt.
  const addBillPayment = useCallback((data: {
    supplierId: string;
    date: string;
    paymentMode: 'cash' | 'bank';
    bankAccountId?: string;
    allocations: { purchaseId: string; amount: number }[];
    advance?: number;
    onAccount?: number;
    narration?: string;
  }): Voucher | null => {
    if (guardFYLocked()) return null;
    const sup = suppliers.find(s => s.id === data.supplierId);
    const supAcc = sup?.accountId || defaultCreditorsAccountId(accountsRef.current);   // Sundry Creditors fallback
    const allocs = data.allocations.filter(a => a.amount > 0);
    const adv = Math.max(0, +(data.advance || 0));
    const onAcc = Math.max(0, +(data.onAccount || 0));
    const total = toRupees(addMinor(sumMinor(allocs.map(a => toMinor(a.amount))), toMinor(adv), toMinor(onAcc)));
    if (total <= 0) {
      toastRef.current({ title: tr('राशि डालें', 'Enter an amount'), description: tr('कम से कम एक बिल के विरुद्ध (या अग्रिम) राशि भरें।', 'Enter an amount against at least one bill (or as an advance).'), variant: 'destructive' });
      return null;
    }
    const creditAcc = data.paymentMode === 'cash'
      ? ACCOUNT_IDS.CASH
      : (data.bankAccountId || defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK);
    const billAllocations: BillAllocation[] = [
      ...allocs.map(a => {
        const p = purchasesRef.current.find(x => x.id === a.purchaseId);
        return { billId: a.purchaseId, billNo: p?.purchaseNo || '', amount: toRupees(toMinor(a.amount)), method: 'against' as const };
      }),
      ...(adv > 0 ? [{ amount: toRupees(toMinor(adv)), method: 'advance' as const }] : []),
      ...(onAcc > 0 ? [{ amount: toRupees(toMinor(onAcc)), method: 'on-account' as const }] : []),
    ];
    const billList = billAllocations.filter(b => b.method === 'against').map(b => b.billNo).filter(Boolean).join(', ');
    const tag = billList ? `बिल ${billList} के विरुद्ध` : (adv > 0 ? 'अग्रिम भुगतान' : 'On Account');
    const narration = `${sup?.name || 'आपूर्तिकर्ता'} को भुगतान — ${tag}${data.narration?.trim() ? ' · ' + data.narration.trim() : ''}`;
    const lid = () => crypto.randomUUID();
    const v = addVoucher({
      type: 'payment',
      date: data.date,
      debitAccountId: supAcc,
      creditAccountId: creditAcc,
      amount: total,
      narration,
      refType: 'bill-payment',
      refId: data.supplierId,
      origin: 'manual',   // ECR-11: user-created → subject to the approval matrix
      billAllocations,
      lines: [
        { id: lid(), accountId: supAcc, type: 'Dr', amount: total },
        { id: lid(), accountId: creditAcc, type: 'Cr', amount: total },
      ],
      createdBy: user?.name ?? 'System',
    });
    return v && v.id ? v : null;
  }, [suppliers, accounts, addVoucher, user?.name]);

  // RULE 3: a salary slip owns TWO vouchers — its accrual journal (accrualVoucherId) and its payment
  // (voucherId). Neither is edited, cancelled or reversed from the Vouchers page: the slip, the TDS Register,
  // 24Q and Statutory Reconciliation would keep showing what the ledger no longer has. The Salary page
  // (viaParent) is the only door. Returns true (and toasts) when BLOCKED.
  // YE-03 / PAY-01 (audit 2026-11-17): year-close and payroll-run vouchers belong to a server process — never
  // edited, cancelled or reversed from here, not even viaParent (no parent screen owns them). Migration 176 refuses
  // the same on the server. Returns true (and toasts) when BLOCKED.
  const guardSystemOwnedVoucher = (id: string, what: { hi: string; en: string }): boolean => {
    const kind = systemOwnedVoucherKind(vouchersRef.current.find(v => v.id === id));
    if (!kind) return false;
    const hi = systemOwnedVoucherMessage(kind, what.hi, true);
    const en = systemOwnedVoucherMessage(kind, what.en, false);
    toastRef.current({ title: tr(hi.title, en.title), description: tr(hi.description, en.description), variant: 'destructive', duration: 12000 });
    return true;
  };
  // RPT-02 (audit 2026-11-17): a sale's / purchase's own vouchers (the main voucher and its GST / TDS journals) are
  // changed only through Sale / Purchase Management. Cancel was already blocked; REVERSE and edit were not, so the
  // ledger could reverse a sale's tax while the sale row — and GSTR-1 / 3B built from it — kept showing it.
  // Returns true (and toasts) when BLOCKED.
  const guardStockDocumentVoucher = (id: string, what: { hi: string; en: string }): boolean => {
    const live = (x: { isDeleted?: boolean }) => !x.isDeleted;
    const sale = salesRef.current.find(x => live(x as { isDeleted?: boolean }) && (x.voucherId === id || (x.gstVoucherIds ?? []).includes(id)));
    const purchase = sale ? undefined : purchasesRef.current.find(x => live(x as { isDeleted?: boolean }) && (x.voucherId === id || (x.taxVoucherIds ?? []).includes(id)));
    if (!sale && !purchase) return false;
    const docHi = sale ? `बिक्री ${sale.saleNo}` : `खरीद ${purchase!.purchaseNo}`;
    const docEn = sale ? `sale ${sale.saleNo}` : `purchase ${purchase!.purchaseNo}`;
    const screenHi = sale ? 'Sale Management' : 'Purchase Management';
    toastRef.current({
      title: tr(`वाउचर ${what.hi} नहीं होगा`, `Voucher cannot be ${what.en}`),
      description: tr(`यह ${docHi} का वाउचर है। उसे ${screenHi} से बदलें या हटाएँ — तभी stock, GST रिपोर्ट और बही साथ ठीक रहेंगे।`, `This is a voucher of ${docEn}. Change or delete it from ${screenHi} — only then do stock, the GST reports and the ledger stay together.`),
      variant: 'destructive', duration: 12000,
    });
    return true;
  };
  // MEM-02 / MEM-03 (audit 2026-11-17): a member's system share / admission voucher (joining receipt, additional
  // shares, refund, share operation, transfer) moves the member's share register WITH it. Cancel was already blocked;
  // REVERSE and edit from the Vouchers page were not, so the ledger moved while the register stayed — register ≠ 1102,
  // dividend on the wrong base. A hand-made voucher (origin 'manual') never moved the register, so it stays free.
  // Returns true (and toasts) when BLOCKED.
  const guardMemberShareVoucher = (id: string, what: { hi: string; en: string }): boolean => {
    const v = vouchersRef.current.find(x => x.id === id);
    if (!isMemberShareVoucher(v)) return false;
    toastRef.current({
      title: tr(`वाउचर ${what.hi} नहीं होगा`, `Voucher cannot be ${what.en}`),
      description: tr('यह सदस्य के शेयर / प्रवेश शुल्क का वाउचर है — इससे सदस्य का शेयर रजिस्टर भी बदला था। सदस्य पेज या Share Register से ही बदलें (गलती हो तो उल्टी entry करें), तभी रजिस्टर और बही साथ ठीक रहेंगे।', 'This is a member\'s share / admission fee voucher — it also moved the member\'s share register. Change it only from the Members page or the Share Register (make the reverse entry for a mistake), so the register and the ledger stay together.'),
      variant: 'destructive', duration: 12000,
    });
    return true;
  };
  // LOAN-04: a loan's own vouchers (disbursement, repayment receipt, reserve release) move the loan register with
  // them. Reversing or editing one from the Vouchers page moved the ledger alone. A repayment is undone by CANCELLING
  // its receipt (the register follows — loanFollowsCancel); the loan itself through the Loan Register.
  const guardLoanVoucher = (id: string, what: { hi: string; en: string }): boolean => {
    const v = vouchersRef.current.find(x => x.id === id);
    if (!v) return false;
    const isLoanDoc = v.refType === REF_LOAN_REPAYMENT || v.refType === REF_LOAN_INTEREST_RELEASE
      || loansRef.current.some(l => !l.isDeleted && (l as { voucherId?: string }).voucherId === id);
    if (!isLoanDoc) return false;
    toastRef.current({
      title: tr(`वाउचर ${what.hi} नहीं होगा`, `Voucher cannot be ${what.en}`),
      description: tr('यह ऋण का वाउचर है (वितरण / चुकौती / संचय-मुक्ति) — इससे ऋण रजिस्टर भी बदलता है। चुकौती गलत हो तो उसकी रसीद रद्द करें (रजिस्टर साथ ठीक होगा); ऋण में बदलाव ऋण रजिस्टर से करें।', 'This is a loan voucher (disbursement / repayment / reserve release) — it moves the loan register too. For a wrong repayment, cancel its receipt (the register follows); change the loan from the Loan Register.'),
      variant: 'destructive', duration: 12000,
    });
    return true;
  };
  const guardSalaryVoucher = (id: string, what: string): boolean => {
    const slip = salaryRecordsRef.current.find(r => r.voucherId === id || r.accrualVoucherId === id);
    if (!slip) return false;
    const kind = slip.accrualVoucherId === id ? tr('वेतन-खर्च (accrual)', 'salary expense (accrual)') : tr('भुगतान', 'payment');
    toastRef.current({
      title: tr(`वाउचर ${what} नहीं होगा`, `Voucher cannot be ${what}`),
      description: tr(`यह वेतन पर्ची ${slip.slipNo} का ${kind} वाउचर है। वेतन पेज पर पर्ची बदलें या हटाएँ — वाउचर अपने-आप ठीक होगा। / This is the ${slip.accrualVoucherId === id ? 'accrual' : 'payment'} voucher of salary slip ${slip.slipNo}; change or delete the slip on the Salary page.`, `This is the ${slip.accrualVoucherId === id ? 'accrual' : 'payment'} voucher (${kind}) of salary slip ${slip.slipNo}. Change or delete slip ${slip.slipNo} on the Salary page — the voucher will be fixed automatically.`),
      variant: 'destructive', duration: 10000,
    });
    return true;
  };
  // X-2 (audit 2026-11-17): the vouchers a module document owns were protected from CANCEL only — edit and reverse from
  // the Vouchers page still changed the ledger while the document (settlement, maintenance bill, worker advance, return,
  // share transfer, muster accrual, depreciation run…) kept its own figures. Same checks as cancelVoucher, for both.
  // Returns true (and toasts) when BLOCKED. An orphan (its document gone / cancelled) stays editable.
  const guardDocumentOwnedVoucher = (id: string, what: { hi: string; en: string }): boolean => {
    const v = vouchersRef.current.find(x => x.id === id);
    if (!v) return false;
    let owner: string | null = null;
    for (const check of voucherOwnersRef.current.values()) { owner = check(id); if (owner) break; }
    if (!owner && (v.refType === 'sale.return' || v.refType === 'purchase.return')) owner = v.refType === 'sale.return' ? tr('बिक्री वापसी (Sales Return)', 'Sales Return') : tr('ख़रीद वापसी (Purchase Return)', 'Purchase Return');
    if (!owner && (v.refType === 'share.transfer' || (!v.refType && (v.narration || '').startsWith('Shares transferred from ')))) owner = tr('शेयर ट्रांसफर (Share Register)', 'Share transfer (Share Register)');
    if (!owner && v.refType === 'wage.accrual' && musterEntriesRef.current.some(m => m.accrualVoucherId === id && !m.isDeleted)) owner = tr('मस्टर रोल (Muster Roll)', 'Muster Roll');
    if (!owner && v.narration && /depreciation/i.test(v.narration)) {
      const asset = assetsRef.current.find(a => a.assetNo && v.narration.includes(a.assetNo));
      if (asset) owner = tr(`संपत्ति ${asset.assetNo} का ह्रास (Asset Register)`, `Depreciation of asset ${asset.assetNo} (Asset Register)`);
    }
    const follower = owner ? null : followedBy(v.refType);
    if (follower && !v.isDeleted) {
      // X-5: the document follows a CANCEL of this payment, not an edit / reverse.
      toastRef.current({ title: tr(`वाउचर ${what.hi} नहीं होगा`, `Voucher cannot be ${what.en}`), description: tr(`यह "${follower}" का भुगतान / वसूली वाउचर है। गलती हो तो इसे रद्द (cancel) करें — document की राशि अपने-आप ठीक होगी — फिर सही entry करें।`, `This is a payment / collection voucher of "${follower}". For a mistake, cancel it (the document's figure follows), then make the right entry.`), variant: 'destructive', duration: 12000 });
      return true;
    }
    if (!owner) return false;
    toastRef.current({
      title: tr(`वाउचर ${what.hi} नहीं होगा`, `Voucher cannot be ${what.en}`),
      description: tr(`यह वाउचर "${owner}" से जुड़ा है। उसी module से बदलें या हटाएँ — तभी document, बही और balances साथ ठीक रहेंगे।`, `This voucher belongs to "${owner}". Change or delete it from that module — only then do the document, the ledger and the balances stay together.`),
      variant: 'destructive', duration: 12000,
    });
    return true;
  };
  const updateVoucher = useCallback((id: string, data: Partial<Pick<Voucher, 'type' | 'date' | 'debitAccountId' | 'creditAccountId' | 'amount' | 'narration' | 'memberId' | 'lines' | 'costCentreId'>>, opts?: { viaParent?: boolean }): boolean => {
    if (guardPermission('update', tr('वाउचर बदलने', 'change vouchers'))) return false;   // ECR-06: role gate
    if (guardSystemOwnedVoucher(id, { hi: 'बदला', en: 'changed' })) return false;
    if (!opts?.viaParent && guardStockDocumentVoucher(id, { hi: 'बदला', en: 'changed' })) return false;
    if (!opts?.viaParent && guardMemberShareVoucher(id, { hi: 'बदला', en: 'changed' })) return false;   // MEM-03
    if (!opts?.viaParent && guardLoanVoucher(id, { hi: 'बदला', en: 'changed' })) return false;   // LOAN-04
    if (!opts?.viaParent && guardSalaryVoucher(id, tr('बदला', 'changed'))) return false;
    if (!opts?.viaParent && guardDocumentOwnedVoucher(id, { hi: 'बदला', en: 'changed' })) return false;   // X-2
    if (guardFYLocked()) return false;
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return false;
    // ECR-07: can neither edit a voucher within a locked period nor move one into it.
    if (guardPeriodLock(current.date, data.date)) return false;
    // ECR-08: a reversed voucher — or an approved one under maker-checker — is edit-locked;
    // corrections must go through a reversal, not an in-place edit.
    if (isEditLocked(current, !!societyRef.current?.approvalRequired)) {
      toastRef.current({
        title: tr('🔁 सीधे edit नहीं / Use reversal', '🔁 No direct edit — Use reversal'),
        description: current.reversedBy
          ? tr('यह वाउचर पहले ही reverse हो चुका है — edit नहीं हो सकता।', 'This voucher has already been reversed — it cannot be edited.')
          : current.reversalOf
          ? tr('यह एक reversal वाउचर है — इसे मूल वाउचर के बिल्कुल बराबर रहना चाहिए, edit नहीं हो सकता। गलती हो तो इसे रद्द करके सही reversal/entry करें।', 'This is a reversal voucher — it must stay exactly equal to the original voucher, so it cannot be edited. If it is wrong, cancel it and make the correct reversal/entry.')
          : tr('Approved voucher सीधे edit नहीं होता — correction के लिए इसे reverse करें (Reversal voucher बनेगा)।', 'An approved voucher cannot be edited directly — reverse it to make a correction (a Reversal voucher will be created).'),
        variant: 'destructive', duration: 9000,
      });
      return false;
    }
    if (isEngineVoucher(current)) { toastRef.current({ ...ENGINE_VOUCHER_BLOCK, variant: 'destructive', duration: 10000 }); return false; }
    // Activity tag (costCentreId): '' clears it. Through the posting service it saves only once migration 127
    // is live — before that the server would drop it and the tag would revert on refresh (RULE 1), so refuse.
    const tagChanged = data.costCentreId !== undefined && (data.costCentreId || '') !== (current.costCentreId || '');
    if (!tagChanged && 'costCentreId' in data) { data = { ...data }; delete data.costCentreId; }
    if (tagChanged && postingServiceRef.current && !activityTagEditableRef.current) {
      toastRef.current({
        title: tr('गतिविधि अभी नहीं बदल सकते / Activity not editable yet', 'Activity not editable yet'),
        description: tr('सर्वर पर migration 127 अभी नहीं चला है — गतिविधि बदली तो refresh पर पुरानी लौट आती। बाकी बदलाव गतिविधि बदले बिना save करें।', 'Migration 127 has not been run on the server yet — if you change the activity, it would go back to the old one on refresh. Save your other changes without changing the activity.'),
        variant: 'destructive', duration: 12000,
      });
      return false;
    }
    // Final batch: a manual voucher cannot be edited INTO a member-tagged Share Capital entry (see addVoucher).
    if (current.origin === 'manual' && (data.memberId ?? current.memberId)
        && touchesShareCapital({ debitAccountId: data.debitAccountId ?? current.debitAccountId, creditAccountId: data.creditAccountId ?? current.creditAccountId, lines: data.lines ?? current.lines }, ACCOUNT_IDS.SHARE_CAP)
        && !(current.memberId && touchesShareCapital(current, ACCOUNT_IDS.SHARE_CAP))) {
      toastRef.current({ title: tr('शेयर रजिस्टर से करें', 'Use the Share Register'), description: manualMemberShareVoucherMessage(), variant: 'destructive', duration: 12000 });
      return false;
    }
    // Capture edit audit snapshot — only track the fields that actually changed
    const changedFields = (Object.keys(data) as (keyof typeof data)[]).filter(
      k => data[k] !== current[k]
    );
    const snapshot: VoucherEditSnapshot | undefined = changedFields.length > 0 ? {
      editedAt: new Date().toISOString(),
      editedBy: userRef.current?.name ?? current.createdBy,
      before: Object.fromEntries(changedFields.map(k => [k, current[k]])) as VoucherEditSnapshot['before'],
    } : undefined;
    const updatedVoucher = {
      ...current,
      ...data,
      editHistory: snapshot
        ? [...(current.editHistory ?? []), snapshot]
        : current.editHistory,
    };

    // If a SIMPLE (≤2-line) voucher's Dr/Cr account or amount was edited via the
    // single-entry edit form — which sends debitAccountId/creditAccountId/amount but
    // NOT `lines` — rebuild the two lines so the edit actually reaches REPORTS, which
    // read `lines` (getVoucherLines), not the legacy fields. Without this, editing the
    // debit/credit account updated only the legacy fields while the stale `lines` kept
    // the OLD direction, so the List/Trial Balance/Ledger silently ignored the change —
    // and the row could even show Dr/Cr reversed vs the edit dialog. Compound vouchers
    // (>2 lines) are left untouched: the single-entry form can't represent them.
    const wasSimple = !current.lines || current.lines.length <= 2;
    const touchedDrCr = data.debitAccountId !== undefined || data.creditAccountId !== undefined || data.amount !== undefined;
    if (wasSimple && data.lines === undefined && touchedDrCr) {
      const dr = updatedVoucher.debitAccountId, cr = updatedVoucher.creditAccountId, amt = updatedVoucher.amount;
      if (dr && cr && amt > 0) {
        updatedVoucher.lines = [
          { id: crypto.randomUUID(), accountId: dr, type: 'Dr', amount: amt },
          { id: crypto.randomUUID(), accountId: cr, type: 'Cr', amount: amt },
        ];
      }
    }

    if (blockGroupPosting(getVoucherLines(updatedVoucher))) return false;

    // ── Double-entry balance guard on edit (Audit C-1/C-2) ───────────────────
    // Block an edit that would leave a multi-line voucher materially unbalanced.
    if (updatedVoucher.lines && updatedVoucher.lines.length > 0) {
      // The SAME sub-rupee rule as a new voucher: snap a < ₹1 rounding gap, refuse anything bigger.
      updatedVoucher.lines = snapSubRupeeResidual(updatedVoucher.lines);
      const bal = voucherLinesBalance(updatedVoucher.lines);
      if (!bal.balanced) {
        toastRef.current({
          title: tr('❌ वाउचर असंतुलित / Voucher not balanced', '❌ Voucher not balanced'),
          description: tr(`डेबिट ₹${bal.drTotal.toFixed(2)} ≠ क्रेडिट ₹${bal.crTotal.toFixed(2)} (अंतर ₹${bal.diff.toFixed(2)})। बदलाव save नहीं हुआ — Dr=Cr करें।`, `Debit ₹${bal.drTotal.toFixed(2)} ≠ Credit ₹${bal.crTotal.toFixed(2)} (difference ₹${bal.diff.toFixed(2)}). The change was not saved — make Dr = Cr.`),
          variant: 'destructive',
          duration: 12000,
        });
        return false;
      }
    }

    // T-06: an edit that changes the POSTINGS is journaled as reverse-old + repost-new (T-08) — the
    // append-only log is never mutated in place, so history stays intact (CL-2). A postings-neutral
    // edit (narration / member only) emits nothing. Best-effort and isolated from the save path.
    let editEvents: LedgerEvent[] = [];
    try {
      const oldLegs = voucherPostingLines(current);
      const newLegs = voucherPostingLines(updatedVoucher);
      // ACC-02: a date-only edit must reach the journal too — the journal dates each voucher from its posting
      // event, so without a reversed + reposted pair every as-of statement between the two dates was wrong.
      if (JSON.stringify(oldLegs) !== JSON.stringify(newLegs) || current.date !== updatedVoucher.date) {
        const at = new Date().toISOString();
        const base = {
          tenantId: societyIdRef.current, jurisdiction: jurisdictionRef.current,
          aggregateType: 'voucher' as const, aggregateId: id,
          producer: { kind: 'human' as const, id: userRef.current?.name ?? null },
        };
        // Sequence from the journal, NOT hardcoded 2/3 — the unique (aggregate, sequence) index
        // means a SECOND edit of the same voucher would collide and its events would be silently
        // dropped, leaving the journal on the first edit's legs (permanent parity break).
        const seq = nextEventSeq('voucher', id);
        // CL-2 lineage: the reversed half points at the posting it reverses — the current effective
        // event (latest repost, else posted), resolved BEFORE these new events are appended.
        const reversedTarget = currentPostingEventId(ledgerEventsRef.current, id);
        if (reversedTarget) {
          const reversal = buildEvent({ ...base, eventType: 'voucher.reversed', sequence: seq, reversalOf: reversedTarget, payload: { lines: voucherReversalLines(current), ...voucherEventMeta(current), reason: 'edit' } }, { eventId: crypto.randomUUID(), occurredAt: at });
          const repost = buildEvent({ ...base, eventType: 'voucher.reposted', sequence: seq + 1, payload: { lines: newLegs, ...voucherEventMeta(updatedVoucher) } }, { eventId: crypto.randomUUID(), occurredAt: at });
          editEvents = [reversal, repost];
        } else {
          // No posting in the journal to reverse (a pre-T-06 voucher edited after go-live). A
          // reversed(old)+reposted(new) pair would leave the journal short by the OLD legs — active-voucher
          // drift (journal = new − old, but its current legs = new). Seed the CURRENT legs as a single
          // voucher.posted instead: a late genesis of the edited voucher, so the journal equals its legs.
          const posted = buildEvent({ ...base, eventType: 'voucher.posted', sequence: seq, payload: { lines: newLegs, ...voucherEventMeta(updatedVoucher) } }, { eventId: crypto.randomUUID(), occurredAt: at });
          editEvents = [posted];
        }
        ledgerEventsRef.current = [...ledgerEventsRef.current, ...editEvents];
      }
    } catch { /* shadow ledger is best-effort — never touches the edit save path */ }

    vouchersRef.current = vouchersRef.current.map(v => v.id === id ? updatedVoucher : v);
    setVouchersState(prev => prev.map(v => v.id === id ? updatedVoucher : v));

    // Revert the optimistic edit (shared by both save paths on failure).
    const revertEdit = () => {
      vouchersRef.current = vouchersRef.current.map(v => v.id === id ? current : v);
      setVouchersState(prev => prev.map(v => v.id === id ? current : v));
      if (editEvents.length) ledgerEventsRef.current = ledgerEventsRef.current.filter(e => !editEvents.some(x => x.eventId === e.eventId));
    };

    // ── S3-d posting service — society_flags.posting_service, default OFF ─────────────────────────
    // ONE server call (edit_voucher, migration 078) updates the row, replaces voucher_lines and
    // voucher_entries (no stale entries) and appends the reversed/reposted pair it builds from the
    // journal itself. The server's events replace the optimistic ones. Failure → revert + toast (RULE 1).
    if (postingServiceRef.current && current.approvalStatus !== 'pending') {
      const p = buildEditVoucherPayload(updatedVoucher, { withActivityTag: tagChanged });
      supabase.rpc('edit_voucher', asDbArgs({ ...p, p_producer: userRef.current?.name ?? null })).then(({ data, error }) => {
        if (error) {
          reportError('voucher-edit-post-service', error.message, { voucherId: id });
          revertEdit();
          toastRef.current({ title: tr('❌ वाउचर का बदलाव क्लाउड में सेव नहीं हुआ', '❌ Voucher change not saved to the cloud'), description: tr(`${postVoucherMessage(postVoucherErrorCode(error.message), error.message)}. बदलाव वापस ले लिया गया — refresh करने पर पुराना data सुरक्षित है।`, `${postVoucherMessage(postVoucherErrorCode(error.message), error.message)}. The change was undone — your old data is safe on refresh.`), variant: 'destructive', duration: 15000 });
          return;
        }
        const serverEvents = mapLedgerEventRows(((data as { events?: Record<string, unknown>[] } | null)?.events) ?? []);
        ledgerEventsRef.current = [...ledgerEventsRef.current.filter(e => !editEvents.some(x => x.eventId === e.eventId)), ...serverEvents];
      }, (rejection: unknown) => {
        const msg = rejection instanceof Error ? rejection.message : String(rejection);
        reportError('voucher-edit-post-service', msg, { voucherId: id });
        revertEdit();
        toastRef.current({ title: tr('❌ वाउचर का बदलाव क्लाउड में सेव नहीं हुआ', '❌ Voucher change not saved to the cloud'), description: tr(`Network error — ${msg}. बदलाव वापस ले लिया गया।`, `Network error — ${msg}. The change was undone.`), variant: 'destructive', duration: 15000 });
      });
      return true;
    }
    // S4-a (104) · a PENDING voucher edited with the posting service ON: save_pending_voucher updates its
    // editable fields server-side (no journal — it is not posted until approve_voucher).
    if (postingServiceRef.current && current.approvalStatus === 'pending') {
      const undo = (msg: string, raw: string) => {
        reportError('voucher-pending-edit-post-service', raw, { voucherId: id });
        revertEdit();
        toastRef.current({ title: tr('❌ वाउचर का बदलाव क्लाउड में सेव नहीं हुआ', '❌ Voucher change not saved to the cloud'), description: tr(`${msg}. बदलाव वापस ले लिया गया — refresh करने पर पुराना data सुरक्षित है।`, `${msg}. The change was undone — your old data is safe on refresh.`), variant: 'destructive', duration: 15000 });
      };
      const p = buildEditVoucherPayload(updatedVoucher, { withActivityTag: tagChanged });
      supabase.rpc('save_pending_voucher', asDbArgs({ p_voucher: p.p_voucher, p_lines: p.p_lines })).then(({ error }) => {
        if (error) undo(postVoucherMessage(postVoucherErrorCode(error.message), error.message), error.message);
      }, (rejection: unknown) => { const msg = rejection instanceof Error ? rejection.message : String(rejection); undo(`Network error — ${msg}`, msg); });
      return true;
    }

    // ── Client save: the emergency switch (posting_service = false), or an edit of a PENDING voucher (no postings
    //    yet). Two-step persist + rollback (RULE 1). ──
    persistVoucher(updatedVoucher, {
      isUpdate: true,
      // The reverse-old + repost-new pair is durably appended only after the base row is confirmed —
      // built from the DB journal (ground truth), not the possibly-short in-memory ref.
      onBaseSuccess: () => {
        if (editEvents.length) void persistVoucherEditEvents(updatedVoucher, voucherPostingLines(updatedVoucher), editEvents);
      },
      onBaseFail: revertEdit,
    });
    // syncEntries (which uses base columns only) is fired by persistVoucher only on add,
    // so we trigger it explicitly here for updates to keep voucher_entries in sync.
    // Fire it AFTER the upsert resolves to avoid syncing entries that didn't save.
    // Note: persistVoucher already handles the timing — entries land on a slight delay,
    // which is acceptable for SQL-side reports.
    syncEntries(updatedVoucher);
    // Edit applied to local state + persistence initiated (a base-write failure reverts and
    // toasts on its own). Success from the caller's toast perspective — mirrors cancelVoucher.
    return true;
  }, []);

  // Returns true if the voucher was actually cancelled, false if blocked (a guard fired
  // and showed its own toast). Callers should only show a success message when true.
  // H / RULE 3: domain contexts register an owner check for the vouchers their documents carry.
  const voucherOwnersRef = useRef(new Map<string, VoucherOwnerCheck>());
  const registerVoucherOwner = useCallback((key: string, check: VoucherOwnerCheck) => {
    voucherOwnersRef.current.set(key, check);
    return () => { if (voucherOwnersRef.current.get(key) === check) voucherOwnersRef.current.delete(key); };
  }, []);
  // X-5: followers keep a document's stored paid / received figure in step with its live payment vouchers.
  const cancelFollowersRef = useRef(new Map<string, VoucherCancelFollower>());
  const registerVoucherCancelFollower = useCallback((key: string, follower: VoucherCancelFollower) => {
    cancelFollowersRef.current.set(key, follower);
    return () => { if (cancelFollowersRef.current.get(key) === follower) cancelFollowersRef.current.delete(key); };
  }, []);
  const followCancel = (v: Voucher) => {
    if (!v.refType) return;
    for (const fl of cancelFollowersRef.current.values()) {
      if (!fl.refTypes.includes(v.refType)) continue;
      try { fl.follow(v); } catch (e) { reportError('voucher-cancel-follow', e instanceof Error ? e.message : String(e), { voucherId: v.id, refType: v.refType }); }
    }
  };
  const followedBy = (refType?: string): string | null => {
    if (!refType) return null;
    for (const fl of cancelFollowersRef.current.values()) if (fl.refTypes.includes(refType)) return fl.label;
    return null;
  };
  // X-5: a deposit / withdrawal / closure voucher moved the passbook balance; it carries no refType, so the passbook
  // cannot follow a cancel — it is changed only by a counter-entry on the Deposits page.
  useEffect(() => registerVoucherOwner('deposits', id => findVoucherOwner([{ label: tr('जमा खाता पासबुक (Deposits)', 'Deposit passbook (Deposits)'), docs: depositTransactionsRef.current }], id)), [registerVoucherOwner]);
  // X-5: a wage payment made before per-worker lines existed cannot say which muster entry got how much — it stays
  // fixed while an entry still points at it. Newer ones carry musterEntryId on each line and are followed (below).
  useEffect(() => registerVoucherOwner('muster-payment', id => {
    const v = vouchersRef.current.find(x => x.id === id);
    if (!v || v.refType !== 'wage.payment' || (v.lines || []).some(l => l.musterEntryId)) return null;
    return musterEntriesRef.current.some(m => !m.isDeleted && m.paymentVoucherId === id) ? tr('मज़दूरी भुगतान (Muster Roll)', 'Wage payment (Muster Roll)') : null;
  }), [registerVoucherOwner]);
  useEffect(() => registerVoucherCancelFollower('muster-payment', {
    refTypes: ['wage.payment'], label: tr('मज़दूरी भुगतान (Muster Roll)', 'Wage payment (Muster Roll)'),
    follow: (v) => {
      const back = new Map<string, number>();
      for (const l of v.lines || []) if (l.musterEntryId) back.set(l.musterEntryId, (back.get(l.musterEntryId) || 0) + l.amount);
      if (!back.size) return;
      const wageOf = (m: MusterEntry) => (m.daysWorked || 0) * (m.dailyWage || 0);
      const changed = musterEntriesRef.current.filter(m => back.has(m.id)).map(m => {
        const paidAmount = figureAfterCancel(m.paidAmount || 0, back.get(m.id) || 0);
        return { ...m, paidAmount, paid: paidAmount > 0.005 && paidAmount >= wageOf(m) - 0.005, ...(m.paymentVoucherId === v.id ? { paymentVoucherId: undefined } : {}) } as MusterEntry;
      });
      if (!changed.length) return;
      const byId = new Map(changed.map(m => [m.id, m]));
      setMusterEntriesState(prev => { const u = prev.map(m => byId.get(m.id) ?? m); storage.setMusterEntries(u); return u; });
      supabase.from('muster_entries').upsert(changed.map(m => withSoc({ ...m, paymentVoucherId: m.paymentVoucherId ?? null }))).then(({ error }) => {
        if (error) { reportError('voucher-cancel-follow', error.message, { voucherId: v.id, at: 'muster' }); toastRef.current({ title: tr('⚠ मस्टर ठीक नहीं हुआ', '⚠ Muster not updated'), description: tr(`भुगतान रद्द हुआ, पर मस्टर की भुगतान-राशि क्लाउड पर नहीं घटी — ${error.message}. Refresh करके देखें।`, `The payment was cancelled, but the muster's paid amount did not go down on the cloud — ${error.message}. Refresh and check.`), variant: 'destructive', duration: 15000 }); }
      });
      toastRef.current({ title: tr('मस्टर भी ठीक किया गया', 'Muster updated too'), description: tr(`मज़दूरी भुगतान रद्द हुआ — ${changed.length} श्रमिक(ों) की राशि फिर से बकाया है।`, `The wage payment was cancelled — ${changed.length} worker(s) are due again.`), duration: 10000 });
    },
  }), [registerVoucherCancelFollower]);

  // RM-17: GST goes head-wise (Output / Input CGST · SGST · IGST) — the one rule in lib/accounting/gstLedgers.
  // A head the database does not hold yet (merged on screen only, migration 156 not run) is not used: the
  // server would refuse the voucher (post_voucher:account_not_found), so the tax stays on 2201 / 3310.
  const gstLegs = useCallback((side: GstSide, parts: { cgst?: number; sgst?: number; igst?: number; total: number }, opts?: { legacy?: boolean }): GstLeg[] =>
    gstLedgerLegs(side, parts, accountsRef.current, { legacy: opts?.legacy, unavailableIds: localOnlyAccountIdsRef.current }), []);

  // Batch A (P1-4 / RULE 3): an approved MSP settlement owns its deduction voucher. Cancelling that voucher
  // alone reversed the deductions in the ledger while the settlement kept its locked Net Payable. Payments,
  // agency receipts and commission vouchers stay cancellable: every procurement balance is derived from
  // the live vouchers, so cancelling one of them keeps the screens and the ledger in step.
  useEffect(() => registerVoucherOwner('procurement', id => findVoucherOwner([{ label: tr('किसान निपटान (MSP)', 'Farmer settlement (MSP)'), docs: procurementSettlementsRef.current }], id)), [registerVoucherOwner]);

  // LOAN-04 (audit 2026-11-17): cancelling a loan / KCC repayment receipt from the Vouchers page is the documented way
  // to undo a repayment (deleteLoan says so) — but repaidAmount is a stored figure and did not follow, so the register
  // kept the money as repaid. Called once the cancel is CONFIRMED and only for a direct cancel (a parent screen —
  // viaParent — handles its own loan): the principal comes back onto the loan, a cleared loan re-opens, and the
  // repayment's own reserve-release journal (same groupId) is cancelled with it.
  const loanFollowsCancel = (v: Voucher) => {
    if (v.refType !== REF_LOAN_REPAYMENT || !v.refId) return;
    const accs = accountsRef.current;
    const principal = loanRepaymentPrincipal(v, (id) => accs.find(a => a.id === id)?.type === 'income');
    const loan = loansRef.current.find(l => l.id === v.refId);
    const kcc = loan ? undefined : kccLoansRef.current.find(k => k.id === v.refId);
    if (principal > 0.005 && loan) {
      const repaid = toRupees(subMinor(toMinor(loan.repaidAmount || 0), toMinor(principal)));
      const back = Math.max(0, repaid);
      updateLoanRef.current(loan.id, { repaidAmount: back, status: loan.status === 'cleared' && loan.amount - back > 0.005 ? 'active' : loan.status });
    } else if (principal > 0.005 && kcc) {
      const back = Math.max(0, toRupees(subMinor(toMinor(kcc.repaidAmount || 0), toMinor(principal))));
      const out = toRupees(addMinor(toMinor(Number((kcc as { outstandingAmount?: number }).outstandingAmount) || 0), toMinor(principal)));
      const patch = { repaidAmount: back, outstandingAmount: out, ...(kcc.status === 'repaid' ? { status: 'active' } : {}) };
      setKccLoansState(prev => prev.map(k => k.id === kcc.id ? { ...k, ...patch } as KccLoan : k));
      supabase.from('kcc_loans').update(patch).eq('id', kcc.id).then(({ error }) => { if (error) reportCascade('KCC repayment cancel follow-up', error); });
    }
    if (v.groupId) {
      const release = vouchersRef.current.filter(x => !x.isDeleted && x.id !== v.id && x.groupId === v.groupId && x.refType === REF_LOAN_INTEREST_RELEASE).map(x => x.id);
      if (release.length) cancelLinkedVouchers(release, 'Loan repayment cancelled — its reserve release follows', 'System');
    }
    if (principal > 0.005 && (loan || kcc)) {
      toastRef.current({ title: tr('ऋण रजिस्टर भी ठीक किया गया', 'Loan register updated too'), description: tr(`चुकौती रद्द हुई — ₹${principal.toLocaleString('en-IN')} मूलधन ${loan?.loanNo || kcc?.loanNo || ''} पर फिर से बकाया है।`, `The repayment was cancelled — ₹${principal.toLocaleString('en-IN')} of principal is outstanding again on ${loan?.loanNo || kcc?.loanNo || ''}.`), duration: 10000 });
    }
  };

  const cancelVoucher = useCallback((id: string, reason: string, deletedBy: string, opts?: { viaParent?: boolean; rollback?: boolean; onCancelled?: () => void; onFailed?: (message: string) => void }): boolean => {
    if (guardFYLocked()) return false;
    // X-4 (audit 2026-11-17): a ROLLBACK is the app withdrawing the voucher this same flow just posted because its own
    // document failed to save. It needs no delete role (the server's withdraw_voucher allows the login that posted it,
    // within 30 minutes) and skips the "cancel it from its document" guards — the document is exactly what failed.
    if (!opts?.rollback && guardPermission('delete', tr('वाउचर रद्द करने', 'cancel vouchers'))) return false;   // ECR-06: role gate
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return false;
    // H4: already cancelled ⇒ nothing to do. A parent cleanup (e.g. deleting a return whose voucher
    // was cancelled earlier) must not fire a second server cancel that is refused and toasts red.
    if (current.isDeleted) { opts?.onCancelled?.(); return true; }
    if (!opts?.rollback) {
      // H4 / RULE 3: a return's voucher belongs to its Sales/Purchase Return document. Cancelling it
      // here left the return live (still in the return register, still moving stock) while the ledger
      // dropped it — found in prod (2 returns, 2026-10-01). Only the Returns page (viaParent) may.
      // H / RULE 3: a share transfer is a PAIR of vouchers (bridged by Suspense 9999) plus both members'
      // share balances; cancelling one half here left the other half and the balances standing (prod
      // 2026-07). Legacy transfers carry no refType, so their narration identifies them.
      if ((current.refType === 'share.transfer' || (!current.refType && (current.narration || '').startsWith('Shares transferred from '))) && !opts?.viaParent) {
        toastRef.current({ title: tr('यहाँ रद्द नहीं होगा', 'Cannot cancel here'), description: tr('यह शेयर-ट्रांसफर का वाउचर है (दो वाउचरों का जोड़ा)। गलती सुधारने के लिए Share Register से उल्टा ट्रांसफर करें — तभी दोनों सदस्यों का शेयर और बही साथ ठीक रहेंगे।', 'This is a share-transfer voucher (a pair of two vouchers). To correct a mistake, make a reverse transfer from the Share Register — only then will both members\' shares and the ledger stay correct together.'), variant: 'destructive', duration: 10000 });
        return false;
      }
      // H / RULE 3: a voucher a LIVE module document links to (settlement, maintenance bill, worker
      // advance, …) is cancelled only through that document; an orphan (document gone) stays cancellable.
      if (!opts?.viaParent) {
        for (const check of voucherOwnersRef.current.values()) {
          const owner = check(id);
          if (owner) {
            toastRef.current({ title: tr('यहाँ रद्द नहीं होगा', 'Cannot cancel here'), description: tr(`यह वाउचर "${owner}" से जुड़ा है। उसी module से उसे delete करें — तभी document, बही और balances साथ ठीक रहेंगे।`, `This voucher is linked to "${owner}". Delete it from that module — only then will the document, ledger and balances stay correct together.`), variant: 'destructive', duration: 10000 });
            return false;
          }
        }
      }
      if (current.refType === 'tds.challan' && !opts?.viaParent) {   // X-5: the challan would stay "paid"
      toastRef.current({ title: tr('यहाँ रद्द नहीं होगा', 'Cannot cancel here'), description: tr('यह TDS चालान का भुगतान वाउचर है। TDS Register से चालान हटाएँ — चालान और वाउचर साथ हटेंगे।', 'This is a TDS challan payment voucher. Delete the challan from the TDS Register — the challan and the voucher go together.'), variant: 'destructive', duration: 10000 });
      return false;
    }
    if ((current.refType === 'sale.return' || current.refType === 'purchase.return') && !opts?.viaParent) {
        const page = current.refType === 'sale.return' ? tr('बिक्री वापसी (Sales Return)', 'Sales Return') : tr('ख़रीद वापसी (Purchase Return)', 'Purchase Return');
        toastRef.current({ title: tr('यहाँ रद्द नहीं होगा', 'Cannot cancel here'), description: tr(`यह वाउचर ${page} से बना है। उसी page से return delete करें — तभी return, स्टॉक और बही तीनों साथ ठीक होंगे।`, `This voucher was created from ${page}. Delete the return from that page — only then will the return, stock and ledger all stay correct together.`), variant: 'destructive', duration: 10000 });
        return false;
      }
      if (isEngineVoucher(current)) { toastRef.current({ ...ENGINE_VOUCHER_BLOCK, variant: 'destructive', duration: 10000 }); return false; }
      // ECR-08: a reversed voucher must not also be cancelled — its reversal would then
      // net against nothing (phantom entry). Correction already stands via the reversal.
      if (current.reversedBy) {
        toastRef.current({ title: tr('रद्द नहीं होगा', 'Cannot be cancelled'), description: tr('यह वाउचर reverse हो चुका है — इसकी reversal entry ही correction है। इसे cancel न करें।', 'This voucher has been reversed — its reversal entry is the correction. Do not cancel it.'), variant: 'destructive', duration: 9000 });
        return false;
      }

      // 🔒 Block deletion of vouchers ACTIVELY linked to a Purchase / Sale parent.
      // If the parent purchase/sale no longer points to THIS voucher (i.e., it's an
      // orphan or duplicate left over from auto-repair), allow cancellation so the
      // user can clean up. Without this, duplicate cleanup is impossible.
      if (current.refType === 'purchase') {
        const parent = purchasesRef.current.find(p => p.id === current.refId);
        const isActive = parent && parent.voucherId === current.id;
        if (isActive) {
          toastRef.current({
            title: tr('यहाँ रद्द नहीं होगा', 'Cannot cancel here'),
            description: tr('यह वाउचर Purchase Management से बना है। इसे Purchase Management → Purchase List से delete करें — तभी stock भी सही रहेगा।', 'This voucher was created from Purchase Management. Delete it from Purchase Management → Purchase List — only then will the stock stay correct too.'),
            variant: 'destructive',
          });
          return false;
        }
        // else: orphan/duplicate — allow cancellation
      }
      if (current.refType === 'sale') {
        const parent = salesRef.current.find(s => s.id === current.refId);
        const isActive = parent && parent.voucherId === current.id;
        if (isActive) {
          toastRef.current({
            title: tr('यहाँ रद्द नहीं होगा', 'Cannot cancel here'),
            description: tr('यह वाउचर Sale Management से बना है। इसे Sale Management → Sale List से delete करें — तभी stock भी वापस आएगी।', 'This voucher was created from Sale Management. Delete it from Sale Management → Sale List — only then will the stock come back too.'),
            variant: 'destructive',
          });
          return false;
        }
        // else: orphan/duplicate — allow cancellation
      }

      // H12: Block cancelling auto-generated vouchers — parent record would dangle
      // Both the payment AND the accrual voucher of a salary slip (the accrual used to be cancellable here).
      if (guardSystemOwnedVoucher(id, { hi: 'रद्द', en: 'cancelled' })) return false;
      if (!opts?.viaParent && guardSalaryVoucher(id, tr('रद्द', 'cancelled'))) return false;
      // Block cancelling an auto wage-accrual voucher while its muster entry is live —
      // otherwise the entry's `accrued` flag goes stale and payWages would Dr 2109 against
      // a liability that no longer exists (double-counting the expense).
      if (current.refType === 'wage.accrual') {
        const linkedMuster = musterEntriesRef.current.find(m => m.accrualVoucherId === id && !m.isDeleted);
        if (linkedMuster) {
          toastRef.current({
            title: tr('यहाँ रद्द नहीं होगा', 'Cannot cancel here'),
            description: tr('यह मज़दूरी-देयता (स्वतः) वाउचर मस्टर रोल से बना है। इसे Muster Roll → सम्बंधित प्रविष्टि को edit/delete करें — accrual अपने-आप उलट जाएगा।', 'This wage-liability (automatic) voucher was created from the Muster Roll. Edit/delete the related entry in Muster Roll — the accrual will reverse automatically.'),
            variant: 'destructive', duration: 10000,
          });
          return false;
        }
      }
      // Member-area stage A (H-3): a system share-capital DEBIT (refund, refund approval, forfeit / redeem /
      // surrender) moved the member's share-capital scalar down. Cancelling it here restored the ledger
      // but not the scalar (register ≠ ledger, dividend on the wrong base). A hand-made voucher
      // (origin 'manual') never moved the scalar, so it stays cancellable.
      if (current.memberId && current.debitAccountId === ACCOUNT_IDS.SHARE_CAP && current.origin !== 'manual' && !opts?.viaParent) {
        toastRef.current({
          title: tr('यहाँ रद्द नहीं होगा', 'Cannot cancel here'),
          description: tr('यह सदस्य की शेयर-वापसी / शेयर-संचालन का वाउचर है — इससे सदस्य की शेयर राशि घटी थी। गलती सुधारने के लिए Share Register से उल्टी entry (अतिरिक्त शेयर) करें, तभी सदस्य की राशि और बही साथ ठीक रहेंगे।', 'This is a member\'s share refund / share operation voucher — it reduced the member\'s share amount. To correct a mistake, make the reverse entry (additional shares) from the Share Register; only then will the member\'s amount and the ledger stay correct together.'),
          variant: 'destructive', duration: 10000,
        });
        return false;
      }
      if (current.memberId && (current.creditAccountId === ACCOUNT_IDS.SHARE_CAP || current.creditAccountId === ACCOUNT_IDS.ADM_FEE)) {
        const kind = current.creditAccountId === ACCOUNT_IDS.SHARE_CAP ? 'Share Capital' : 'Admission Fee';
        toastRef.current({
          title: tr('वाउचर नहीं हटाया जा सकता', 'Voucher cannot be deleted'),
          description: tr(`यह सदस्य का अपने-आप बना ${kind} वाउचर है। सदस्य पेज से सदस्य को बदलें या हटाएँ।`, `This is an auto-created ${kind} voucher of a member. Change or delete the member from the Members page.`),
          variant: 'destructive',
        });
        return false;
      }
      // Detect depreciation vouchers by narration pattern + asset link
      if (current.narration && /depreciation/i.test(current.narration)) {
        const linkedAsset = assetsRef.current.find(a => current.narration.includes(a.assetNo));
        if (linkedAsset) {
          toastRef.current({
            title: tr('वाउचर नहीं हटाया जा सकता', 'Voucher cannot be deleted'),
            description: tr(`यह संपत्ति ${linkedAsset.assetNo} की ह्रास (depreciation) एंट्री है। संपत्ति रजिस्टर पेज पर "Reverse Depreciation" इस्तेमाल करें।`, `This is the depreciation entry of asset ${linkedAsset.assetNo}. Use "Reverse Depreciation" on the Asset Register page.`),
            variant: 'destructive',
          });
          return false;
        }
      }
    }   // end of the document guards (skipped for a rollback)

    const cancelledVoucher = { ...current, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy, deletedReason: reason };
    // T-06: shadow 'voucher.cancelled' event — REVERSING legs (Dr/Cr flipped) net the original's
    // postings out of the journal, mirroring the isDeleted + deleteEntries that removes it from SQL
    // reports. Best-effort and isolated; the original voucher.posted event stays in the log (CL-2).
    let cancelEvent: LedgerEvent | null = null;
    try {
      // Only reverse a posting the journal ACTUALLY HOLDS. currentPostingEventId is undefined when there
      // is no voucher.posted/reposted for this voucher — it was posted before the shadow journal existed
      // (pre-T-06) and genesis skips deleted vouchers, so its posting was never seeded. Appending a
      // voucher.cancelled then leaves an ORPHAN reversal whose legs have nothing to cancel — a permanent
      // trial-balance parity break (the CV/2026/27/320 & /329 class, historically reconciled by
      // scripts/reconcile-cancelled-ledger.mjs). With no posting the voucher already contributes nothing,
      // so the correct cancellation appends nothing.
      const postingToReverse = currentPostingEventId(ledgerEventsRef.current, id);
      if (postingToReverse) {
        cancelEvent = buildEvent({
          eventType: 'voucher.cancelled',
          tenantId: societyIdRef.current,
          jurisdiction: jurisdictionRef.current,
          aggregateType: 'voucher',
          aggregateId: id,
          // From the journal, not hardcoded 2 — cancelling an already-EDITED voucher (which holds
          // sequences 1..3) would collide on the unique index and the cancel event would be silently
          // dropped: the journal would keep counting a cancelled voucher, permanent parity break.
          sequence: nextEventSeq('voucher', id),
          reversalOf: postingToReverse,   // CL-2 lineage: points at the posting it reverses (latest repost, else posted)
          producer: { kind: 'human', id: deletedBy ?? null },
          payload: { lines: voucherReversalLines(current), ...voucherEventMeta(current), reason },
        }, { eventId: crypto.randomUUID(), occurredAt: new Date().toISOString() });
        ledgerEventsRef.current = [...ledgerEventsRef.current, cancelEvent];
      }
    } catch { /* shadow ledger is best-effort — never touches the cancel path */ }
    emitAudit({ entityType: 'voucher', entityId: id, action: 'cancel', reason });
    setVouchersState(prev => {
      const updated = prev.map(v => v.id === id ? cancelledVoucher : v);
      return updated;
    });

    // ── S3-d posting service — society_flags.posting_service, default OFF ─────────────────────────
    // ONE server call (cancel_voucher, migration 078): soft-delete + lines reversed + entries removed +
    // voucher.cancelled built from the journal in the DB (so it is never skipped because the journal
    // was not loaded here). The server's event replaces the optimistic one. Failure → un-cancel + toast.
    if (postingServiceRef.current) {
      const undoCancel = () => {
        setVouchersState(prev => prev.map(v => v.id === id ? current : v));
        if (cancelEvent) ledgerEventsRef.current = ledgerEventsRef.current.filter(e => e.eventId !== cancelEvent!.eventId);
      };
      supabase.rpc(opts?.rollback ? 'withdraw_voucher' : 'cancel_voucher', { p_id: id, p_reason: reason, p_deleted_by: deletedBy ?? null }).then(({ data, error }) => {
        if (error) {
          reportError('voucher-cancel-post-service', error.message, { voucherId: id });
          undoCancel();
          opts?.onFailed?.(postVoucherMessage(postVoucherErrorCode(error.message), error.message));
          toastRef.current({ title: tr('❌ वाउचर रद्द करना क्लाउड में सेव नहीं हुआ', '❌ Voucher cancellation not saved to the cloud'), description: tr(`${postVoucherMessage(postVoucherErrorCode(error.message), error.message)}. रद्द करना वापस ले लिया गया — वाउचर चालू और सुरक्षित है।`, `${postVoucherMessage(postVoucherErrorCode(error.message), error.message)}. The cancellation was undone — the voucher is active and safe.`), variant: 'destructive', duration: 15000 });
          return;
        }
        const serverEvents = mapLedgerEventRows(((data as { events?: Record<string, unknown>[] } | null)?.events) ?? []);
        ledgerEventsRef.current = [...ledgerEventsRef.current.filter(e => e.eventId !== cancelEvent?.eventId), ...serverEvents];
        if (!opts?.viaParent) { loanFollowsCancel(current); followCancel(current); }   // LOAN-04 / X-5: confirmed
        opts?.onCancelled?.();
      }, (rejection: unknown) => {
        const msg = rejection instanceof Error ? rejection.message : String(rejection);
        reportError('voucher-cancel-post-service', msg, { voucherId: id });
        undoCancel();
        opts?.onFailed?.(msg);
        toastRef.current({ title: tr('❌ वाउचर रद्द करना क्लाउड में सेव नहीं हुआ', '❌ Voucher cancellation not saved to the cloud'), description: tr(`Network error — ${msg}. रद्द करना वापस ले लिया गया — वाउचर चालू है।`, `Network error — ${msg}. The cancellation was undone — the voucher is active.`), variant: 'destructive', duration: 15000 });
      });
      return true;
    }

    // ── Emergency switch (posting_service = false): table-first soft-delete (RULE 1). ──
    // Soft-delete via a TARGETED update of only the delete columns. Upserting the
    // whole voucher object fails with a schema-cache error when it carries any
    // late-added column the table lacks (RULE 1) — which silently left cancelled
    // vouchers un-synced (the "Save failed" on delete).
    supabase.from('vouchers').update({ isDeleted: true, deletedAt: cancelledVoucher.deletedAt, deletedBy, deletedReason: reason }).eq('id', id).then(({ error }) => {
      if (error) {
        // RULE 1: the cancel did not reach the cloud → the voucher is live again on screen too.
        failedCloudWrite(tr('वाउचर रद्द करना', 'Cancelling the voucher'), error, () => setVouchersState(prev => prev.map(v => v.id === id ? current : v)));
        // Keep the shadow ledger consistent with the un-cancelled voucher.
        if (cancelEvent) ledgerEventsRef.current = ledgerEventsRef.current.filter(e => e.eventId !== cancelEvent!.eventId);
        opts?.onFailed?.(error.message);
      } else {
        deleteEntries(id); // remove from voucher_entries so cancelled voucher has no SQL-visible impact
        if (!opts?.viaParent) { loanFollowsCancel(current); followCancel(current); }   // LOAN-04 / X-5: confirmed
        opts?.onCancelled?.();
        if (cancelEvent) persistLedgerEvent(cancelEvent); // durable append only after the cancel is confirmed
        // No cancelEvent → the in-memory journal did not hold this voucher's posting: either it was never
        // loaded, OR the posting was written AFTER this tab loaded (another user / device — e.g. a voucher
        // approved by a checker; 2026-10-01 Assandh JV/2026/27/6720). Check the DB directly and append the
        // reversing event iff a posting really exists (idempotent; no posting → no-op).
        else void ensureVoucherCancelEvent(current, deletedBy, reason);
      }
    });
    return true;
  }, []);

  // ECR-08 (P1 #8): correct a posted voucher by posting a LINKED contra reversal (Dr↔Cr
  // swapped) instead of editing it in place. Both entries stay in the ledger (net zero),
  // audit-visible — unlike a soft-delete. The reversal is dated today (must be in an open
  // period). Reversal linkage (reversalOf / reversedBy) is persisted via targeted best-effort
  // .update() so the base upserts stay safe before the migration runs.
  // opts.engine (batch B): ONLY the procurement lot-cancel path may reverse an engine voucher — the
  // immutable-boundary rule allows exactly one correction, an engine-generated reversal. The reversal
  // is itself an engine voucher (origin 'engine') carrying the caller's refType/refId.
  const reverseVoucher = useCallback((id: string, reason: string, opts?: { engine?: { refType: string; refId?: string } }): Voucher | null => {
    if (guardFYLocked()) return null;
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return null;
    if (current.isDeleted) { toastRef.current({ title: tr('रद्द वाउचर', 'Cancelled voucher'), description: tr('रद्द किया हुआ वाउचर reverse नहीं होता।', 'A cancelled voucher cannot be reversed.'), variant: 'destructive' }); return null; }
    if (current.reversedBy) { toastRef.current({ title: tr('पहले से reversed', 'Already reversed'), description: tr(`यह वाउचर पहले ही reverse हो चुका है।`, `This voucher has already been reversed.`), variant: 'destructive' }); return null; }
    if (current.reversalOf) { toastRef.current({ title: tr('यह स्वयं reversal है', 'This is itself a reversal'), description: tr('Reversal entry को दोबारा reverse नहीं किया जाता।', 'A reversal entry cannot be reversed again.'), variant: 'destructive' }); return null; }
    if (isEngineVoucher(current) && !opts?.engine) { toastRef.current({ ...ENGINE_VOUCHER_BLOCK, variant: 'destructive', duration: 10000 }); return null; }
    if (guardSystemOwnedVoucher(id, { hi: 'reverse', en: 'reversed' })) return null;
    if (!opts?.engine && guardStockDocumentVoucher(id, { hi: 'reverse', en: 'reversed' })) return null;
    if (!opts?.engine && guardMemberShareVoucher(id, { hi: 'reverse', en: 'reversed' })) return null;   // MEM-02
    if (!opts?.engine && guardLoanVoucher(id, { hi: 'reverse', en: 'reversed' })) return null;   // LOAN-04
    if (guardSalaryVoucher(id, 'reverse')) return null;
    if (!opts?.engine && guardDocumentOwnedVoucher(id, { hi: 'reverse', en: 'reversed' })) return null;   // X-2
    const revDate = new Date().toISOString().split('T')[0];
    if (guardPeriodLock(revDate)) return null; // reversal must post into an open period

    // Build the contra reversal: swap Dr/Cr (and flip each compound line). addVoucher runs
    // its own FY/period-lock + balance checks and returns id:'' on failure.
    const revLines = current.lines ? reverseEntryLines(current.lines).map(l => ({ ...l, id: crypto.randomUUID() })) : undefined;
    // S4-a: with the posting service the two links are set by ONE server call (link_voucher_reversal, 103)
    // AFTER post_voucher has made the reversal durable — the old direct .update() could run before the row
    // existed and silently link nothing.
    const viaServer = postingServiceRef.current;
    const linkOnServer = (rev: Voucher) => {
      supabase.rpc('link_voucher_reversal', { p_original_id: id, p_reversal_id: rev.id }).then(({ error }) => {
        if (!error) return;
        reportError('voucher-reversal-link', error.message, { voucherId: rev.id, originalId: id });
        toastRef.current({ title: tr('⚠ Reversal पोस्ट हुआ, पर जोड़ (link) सेव नहीं हुआ', '⚠ Reversal posted, but the link was not saved'), description: tr(`${postVoucherMessage(postVoucherErrorCode(error.message), error.message)} — दोनों entries ledger में सही हैं; दोबारा reverse न करें, admin को बताएँ।`, `${postVoucherMessage(postVoucherErrorCode(error.message), error.message)} — both entries are correct in the ledger; do not reverse again, tell your admin.`), variant: 'destructive', duration: 15000 });
      }, (e: unknown) => reportError('voucher-reversal-link', e instanceof Error ? e.message : String(e), { voucherId: rev.id, originalId: id }));
    };
    const reversal = addVoucher({
      type: current.type,
      date: revDate,
      debitAccountId: current.creditAccountId,
      creditAccountId: current.debitAccountId,
      amount: current.amount,
      narration: `Reversal of ${current.voucherNo}${reason ? ' — ' + reason : ''}`,
      memberId: current.memberId,
      lines: revLines,
      createdBy: user?.name ?? 'System', // every other addVoucher call sets this; the reversal was left without a creator
      ...(opts?.engine ? { origin: 'engine' as const, refType: opts.engine.refType, refId: opts.engine.refId } : {}),
    }, viaServer ? { onPersisted: linkOnServer } : undefined);
    if (!reversal?.id) return null; // addVoucher blocked (FY-lock / unbalanced / etc.)

    // Link both sides. reversalOf/reversedBy are late-added columns → targeted best-effort
    // .update() (same approach as the delete columns), never part of a base upsert.
    const linkedReversal = { ...reversal, reversalOf: current.id };
    const linkedOriginal = { ...current, reversedBy: reversal.id };
    vouchersRef.current = vouchersRef.current.map(v => v.id === reversal.id ? linkedReversal : v.id === id ? linkedOriginal : v);
    setVouchersState(prev => prev.map(v => v.id === reversal.id ? linkedReversal : v.id === id ? linkedOriginal : v));
    if (!viaServer) {
      supabase.from('vouchers').update({ reversalOf: current.id }).eq('id', reversal.id).then(({ error }) => {
        if (error) reportError('voucher-reversal-link', error.message, { voucherId: reversal.id, field: 'reversalOf' });
      });
      supabase.from('vouchers').update({ reversedBy: reversal.id }).eq('id', id).then(({ error }) => {
        if (error) reportError('voucher-reversal-link', error.message, { voucherId: id, field: 'reversedBy' });
      });
    }
    emitAudit({ entityType: 'voucher', entityId: id, action: 'reverse', before: { reversedBy: null }, after: { reversedBy: reversal.id }, reason });
    toastRef.current({ title: tr('🔁 Reversal बन गया', '🔁 Reversal created'), description: tr(`${current.voucherNo} के लिए reversal ${reversal.voucherNo} पोस्ट हो गया। दोनों entries ledger में दिखेंगी (net zero)।`, `Reversal ${reversal.voucherNo} posted for ${current.voucherNo}. Both entries will show in the ledger (net zero).`), variant: 'default', duration: 8000 });
    return reversal;
  }, [addVoucher]);

  // Restore of a cancelled voucher is DISABLED (founder decision A, 2026-09-29). The journal has no
  // "un-cancel": every reader (resolveCurrentVouchers, ask-core, the genesis/reconcile scripts) treats a
  // voucher.cancelled as final, and the old restore emitted no event — the row came back while the
  // journal kept it cancelled (TB/cash-book drift). A cancelled voucher stays cancelled; a correction
  // is a NEW voucher (as in Tally). Kept as a function so any caller gets the explanation, not a crash.
  // B2: the posting-service flag is read once at load. A tab left open across a flag change kept the
  // OLD client path (2026-10-01: a tab opened before the batch flip cancelled a voucher client-side).
  // Re-read it whenever the tab becomes visible again and every 5 minutes; a failed read keeps the value.
  useEffect(() => {
    const refreshPostingFlag = () => {
      const sid = societyIdRef.current;
      if (!userRef.current || !sid || document.visibilityState !== 'visible') return;   // J6: not when logged out
      supabase.from('society_flags').select('posting_service').eq('society_id', sid).maybeSingle()
        .then(({ data, error }) => { if (!error) postingServiceRef.current = data?.posting_service !== false; }, () => { /* keep */ });
      // 127 run (or rolled back) while this tab was open: picked up here, without a reload. A failed read keeps the value.
      void probeActivityTagEditable().then(v => { if (v !== null) activityTagEditableRef.current = v; });
    };
    document.addEventListener('visibilitychange', refreshPostingFlag);
    const timer = setInterval(refreshPostingFlag, 5 * 60 * 1000);
    return () => { document.removeEventListener('visibilitychange', refreshPostingFlag); clearInterval(timer); };
  }, []);

  const usesPostingService = useCallback((): boolean => postingServiceRef.current, []);
  const canEditVoucherActivity = useCallback((): boolean => !postingServiceRef.current || activityTagEditableRef.current, []);

  const restoreVoucher = useCallback((_id: string): boolean => {
    toastRef.current({ title: tr('रद्द वाउचर वापस नहीं आता', 'A cancelled voucher cannot be brought back'), description: tr('रद्द किया गया वाउचर restore नहीं होता — ज़रूरत हो तो नया वाउचर बनाएँ।', 'A cancelled voucher cannot be restored — create a new voucher if needed.'), variant: 'destructive', duration: 10000 });
    return false;
  }, []);

  const clearVoucher = useCallback((id: string, clearedDate?: string) => {
    if (guardFYLocked()) return;
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    const cleared = { ...current, isCleared: true, clearedDate: clearedDate ?? new Date().toISOString().split('T')[0] };
    setVouchersState(prev => { const updated = prev.map(v => v.id === id ? cleared : v); return updated; });
    // Only the two changed columns — re-upserting the whole client copy could overwrite server-owned
    // fields (e.g. a server-assigned number) with a stale local copy (B3). S4-a: via the server when ON.
    const write = postingServiceRef.current
      ? supabase.rpc('set_voucher_cleared', { p_id: id, p_cleared: true, p_cleared_date: cleared.clearedDate })
      : supabase.from('vouchers').update({ isCleared: true, clearedDate: cleared.clearedDate }).eq('id', id);
    write.then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        setVouchersState(prev => prev.map(v => v.id === id ? current : v));   // RULE 1: roll back
        toastRef.current({ title: tr('क्लियर सेव नहीं हुआ', 'Clear not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
      }
    });
  }, []);

  const unclearVoucher = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return;
    const uncleared = { ...current, isCleared: false, clearedDate: undefined };
    setVouchersState(prev => { const updated = prev.map(v => v.id === id ? uncleared : v); return updated; });
    const write = postingServiceRef.current
      ? supabase.rpc('set_voucher_cleared', asDbArgs({ p_id: id, p_cleared: false, p_cleared_date: null }))
      : supabase.from('vouchers').update({ isCleared: false, clearedDate: null }).eq('id', id);
    write.then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        setVouchersState(prev => prev.map(v => v.id === id ? current : v));   // RULE 1: roll back
        toastRef.current({ title: tr('अनक्लियर सेव नहीं हुआ', 'Unclear not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
      }
    });
  }, []);

  // Returns true only when every guard passed and the change was applied (a later cloud failure
  // rolls back with its own destructive toast). false = a guard blocked it and already said why —
  // callers must NOT toast success (the false-success pattern, fixed for updateVoucher in #345).
  const approveVoucher = useCallback((id: string, approvedBy: string): boolean => {
    if (guardFYLocked()) return false;
    if (guardPermission('approve', tr('वाउचर अप्रूव करने', 'approve vouchers'))) return false; // SL-06: segregation of duties
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return false;
    if (isEngineVoucher(current)) { toastRef.current({ ...ENGINE_VOUCHER_BLOCK, variant: 'destructive', duration: 10000 }); return false; }
    // ECR-11: uniform state machine — only a PENDING voucher may be approved. Blocks flipping a
    // rejected voucher straight to approved (which would re-post it) or double-approving.
    if (!canApprovalTransition(current.approvalStatus, 'approved')) {
      toastRef.current({ title: tr('कार्रवाई संभव नहीं', 'Action not possible'), description: tr(`वाउचर ${current.voucherNo} ${current.approvalStatus === 'approved' ? 'पहले से स्वीकृत' : current.approvalStatus === 'rejected' ? 'अस्वीकृत' : 'अनुमोदन-workflow से बाहर'} है — केवल लम्बित (pending) वाउचर ही approve किए जा सकते हैं।`, `Voucher ${current.voucherNo} is ${current.approvalStatus === 'approved' ? 'already approved' : current.approvalStatus === 'rejected' ? 'rejected' : 'outside the approval workflow'} — only pending vouchers can be approved.`), variant: 'destructive', duration: 10000 });
      return false;
    }
    // ECR-06: identity-level SoD — maker ≠ checker. A user may not approve their OWN voucher.
    // Only ever reached for opted-in maker-checker societies (pending vouchers), so it can't
    // stall a society that never enabled approval.
    if (isSelfApproval(current.createdBy, approvedBy)) {
      toastRef.current({ title: tr('स्व-अनुमोदन मना है', 'Self-approval not allowed'), description: tr(`आप अपना ही बनाया वाउचर (${current.voucherNo}) approve नहीं कर सकते। किसी अन्य अधिकृत सदस्य से approve कराएँ, या Society Setup में approval-required बंद करें।`, `You cannot approve a voucher you created yourself (${current.voucherNo}). Get it approved by another authorised member, or turn off approval-required in Society Setup.`), variant: 'destructive', duration: 12000 });
      return false;
    }
    const updated = { ...current, approvalStatus: 'approved' as const, approvedBy, approvedAt: new Date().toISOString() };
    emitAudit({ entityType: 'voucher', entityId: id, action: 'approve', before: { approvalStatus: current.approvalStatus ?? null }, after: { approvalStatus: 'approved' } });
    setVouchersState(prev => { const u = prev.map(v => v.id === id ? updated : v); return u; });
    // S3-e-2 · posting service: ONE server call (approve_voucher, migration 079) flips the status AND
    // writes the lines, entries and voucher.posted in one transaction. Failure → roll back + toast.
    if (postingServiceRef.current) {
      const undoApprove = (msg: string) => {
        setVouchersState(prev => prev.map(v => v.id === id ? current : v));
        reportError('voucher-approve-post-service', msg, { voucherId: id });
        toastRef.current({ title: tr('अप्रूवल सेव नहीं हुआ', 'Approval not saved'), description: tr(`${msg}. Refresh करने पर पुराना data वापस आ जाएगा।`, `${msg}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 15000 });
      };
      supabase.rpc('approve_voucher', asDbArgs({ p_id: id, p_lines: buildEditVoucherPayload(updated).p_lines, p_approved_by: approvedBy })).then(({ data, error }) => {
        if (error) undoApprove(postVoucherMessage(postVoucherErrorCode(error.message), error.message));
        else {
          const evs = mapLedgerEventRows(((data as { events?: Record<string, unknown>[] } | null)?.events) ?? []);
          if (evs.length) ledgerEventsRef.current = [...ledgerEventsRef.current, ...evs];
        }
      }, (e: unknown) => undoApprove(`Network error — ${e instanceof Error ? e.message : String(e)}`));
      return true;
    }
    supabase.from('vouchers').upsert(withSoc(updated)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        setVouchersState(prev => prev.map(v => v.id === id ? current : v));   // RULE 1: roll back
        toastRef.current({ title: tr('अप्रूवल सेव नहीं हुआ', 'Approval not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
      }
      else {
        syncEntries(updated); // mirror to voucher_entries so SQL reports see the approved entries
        void ensureVoucherPostedEvent(updated, approvedBy); // S3-e-2: the approved voucher enters the journal
      }
    });
    return true;
  }, [society.fyLocked]);

  const rejectVoucher = useCallback((id: string, rejectedBy: string, reason: string): boolean => {
    if (guardFYLocked()) return false;
    if (guardPermission('reject', tr('वाउचर रिजेक्ट करने', 'reject vouchers'))) return false; // SL-06: segregation of duties
    const current = vouchersRef.current.find(v => v.id === id);
    if (!current) return false;
    if (isEngineVoucher(current)) { toastRef.current({ ...ENGINE_VOUCHER_BLOCK, variant: 'destructive', duration: 10000 }); return false; }
    // ECR-11: uniform state machine — only a PENDING voucher may be rejected.
    if (!canApprovalTransition(current.approvalStatus, 'rejected')) {
      toastRef.current({ title: tr('कार्रवाई संभव नहीं', 'Action not possible'), description: tr(`वाउचर ${current.voucherNo} ${current.approvalStatus === 'approved' ? 'पहले से स्वीकृत' : current.approvalStatus === 'rejected' ? 'पहले से अस्वीकृत' : 'अनुमोदन-workflow से बाहर'} है — केवल लम्बित (pending) वाउचर ही reject किए जा सकते हैं।`, `Voucher ${current.voucherNo} is ${current.approvalStatus === 'approved' ? 'already approved' : current.approvalStatus === 'rejected' ? 'already rejected' : 'outside the approval workflow'} — only pending vouchers can be rejected.`), variant: 'destructive', duration: 10000 });
      return false;
    }
    const updated = { ...current, approvalStatus: 'rejected' as const, approvalRemarks: reason, approvedBy: rejectedBy, approvedAt: new Date().toISOString() };
    emitAudit({ entityType: 'voucher', entityId: id, action: 'reject', before: { approvalStatus: current.approvalStatus ?? null }, after: { approvalStatus: 'rejected' }, reason });
    setVouchersState(prev => { const u = prev.map(v => v.id === id ? updated : v); return u; });
    // S4-a: with the posting service, ONE server call (reject_voucher, 103) flips the status AND removes the
    // voucher_entries in one transaction.
    if (postingServiceRef.current) {
      const undoReject = (msg: string) => {
        reportError('voucher-reject-post-service', msg, { voucherId: id });
        setVouchersState(prev => prev.map(v => v.id === id ? current : v));   // RULE 1: roll back
        toastRef.current({ title: tr('रिजेक्ट सेव नहीं हुआ', 'Reject not saved'), description: tr(`${msg}. Refresh करने पर पुराना data वापस आ जाएगा।`, `${msg}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 15000 });
      };
      supabase.rpc('reject_voucher', { p_id: id, p_reason: reason, p_rejected_by: rejectedBy }).then(({ error }) => {
        if (error) undoReject(postVoucherMessage(postVoucherErrorCode(error.message), error.message));
      }, (e: unknown) => undoReject(`Network error — ${e instanceof Error ? e.message : String(e)}`));
      return true;
    }
    supabase.from('vouchers').update({ approvalStatus: 'rejected', approvalRemarks: reason, approvedBy: rejectedBy, approvedAt: updated.approvedAt }).eq('id', id).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        setVouchersState(prev => prev.map(v => v.id === id ? current : v));   // RULE 1: roll back
        toastRef.current({ title: tr('रिजेक्ट सेव नहीं हुआ', 'Reject not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
      }
      else deleteEntries(id); // rejected vouchers shouldn't impact SQL reports
    });
    return true;
  }, [society.fyLocked]);

  const addAuditObjection = useCallback((data: Omit<AuditObjection, 'id' | 'objectionNo' | 'createdAt'>): AuditObjection => {
    // ECR-06: audit objections are the auditor's SCOPED write (auditNote) — distinct from the
    // financial `create` guard on addVoucher, so an auditor files objections but can't post
    // vouchers, and a cashier/viewer reaching /audit-register can't file objections.
    if (guardPermission('auditNote', tr('ऑडिट आपत्ति दर्ज करने', 'record audit objections'))) return { ...data, id: '' } as unknown as AuditObjection;
    if (guardFYLocked()) return { ...data, id: '' } as unknown as AuditObjection;
    const maxNum = auditObjectionsRef.current.filter(o => o.objectionNo?.includes(data.auditYear)).reduce((max, o) => {
      const m = o.objectionNo?.match(/\/(\d+)$/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const objectionNo = `AUD/${data.auditYear}/${String(maxNum + 1).padStart(3, '0')}`;
    const newObj: AuditObjection = { ...data, id: crypto.randomUUID(), objectionNo, createdAt: new Date().toISOString() };
    auditObjectionsRef.current = [...auditObjectionsRef.current, newObj];
    setAuditObjectionsState(prev => { const updated = [...prev, newObj]; return updated; });
    // T-03 (ADR-0005): take the OFFICIAL objectionNo from the server sequence (book 'AUD') at
    // persist, restamp local state. Falls back to the client-provisional number on offline/RPC fail.
    issueOfficialNumber(nextDocNumber, societyIdRef.current, newObj.objectionNo).then((officialNo) => {
      const objToSave = (officialNo && officialNo !== newObj.objectionNo) ? { ...newObj, objectionNo: officialNo } : newObj;
      if (objToSave !== newObj) {
        auditObjectionsRef.current = auditObjectionsRef.current.map(o => o.id === newObj.id ? objToSave : o);
        setAuditObjectionsState(prev => prev.map(o => o.id === newObj.id ? objToSave : o));
      }
      supabase.from('audit_objections').upsert(withSoc(objToSave)).then(({ error }) => {
        if (error) {
          console.error('DB sync error:', error.message); reportError('db-sync', error.message);
          auditObjectionsRef.current = auditObjectionsRef.current.filter(o => o.id !== newObj.id);
          setAuditObjectionsState(prev => prev.filter(o => o.id !== newObj.id));   // RULE 1: roll back
          toastRef.current({ title: tr('सेव नहीं हुआ', 'Not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}.`, `Not saved to the cloud — ${error.message}.`), variant: 'destructive', duration: 12000 });
        }
      });
    });
    return newObj;
  }, []);

  const updateAuditObjection = useCallback((id: string, data: Partial<AuditObjection>) => {
    if (guardPermission('auditNote', tr('ऑडिट आपत्ति बदलने', 'change audit objections'))) return;   // ECR-06: auditor-family scoped write
    if (guardFYLocked()) return;
    const before = auditObjectionsRef.current.find(o => o.id === id);
    if (!before) return;
    const updated = { ...before, ...data };
    setAuditObjectionsState(prev => prev.map(o => o.id === id ? updated : o));
    patchRow('audit_objections', id, before, updated).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        setAuditObjectionsState(prev => prev.map(o => o.id === id ? before : o));   // RULE 1: roll back to prior state
        toastRef.current({ title: tr('अपडेट सेव नहीं हुआ', 'Update not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
      }
    });
  }, []);

  const deleteAuditObjection = useCallback((id: string) => {
    if (guardPermission('delete', tr('ऑडिट आपत्ति मिटाने', 'delete audit objections'))) return;   // ECR-06: role gate
    if (guardFYLocked()) return;
    const removed = auditObjectionsRef.current.find(o => o.id === id);
    setAuditObjectionsState(prev => { const updated = prev.filter(o => o.id !== id); return updated; });
    // Soft-delete (P0 #2): retain the audit-objection row (isDeleted=true) — statutory
    // register must persist. Load filters isDeleted out on refresh.
    supabase.from('audit_objections').update({ isDeleted: true }).eq('id', id).then(({ error }) => { if (error) failedCloudWrite(tr('ऑडिट आपत्ति हटाना', 'Deleting the audit objection'), error, () => setAuditObjectionsState(prev => putBack(prev, removed))); });
    emitAudit({ entityType: 'auditObjection', entityId: id, action: 'delete', reason: 'Audit objection deleted' });
    console.info(`[AUDIT-DELETE] AuditObjection id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, []);

  // ── Recoverables (HAFED Proforma 2) ────────────────────────────────────────
  const addRecoverable = useCallback((data: Omit<Recoverable, 'id' | 'createdAt'>): Recoverable => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as Recoverable;
    const newRec: Recoverable = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    recoverablesRef.current = [...recoverablesRef.current, newRec];
    setRecoverablesState(prev => [...prev, newRec]);
    supabase.from('recoverables').upsert(withSoc(newRec)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        recoverablesRef.current = recoverablesRef.current.filter(r => r.id !== newRec.id);
        setRecoverablesState(prev => prev.filter(r => r.id !== newRec.id));   // RULE 1: roll back
        toastRef.current({ title: tr('सेव नहीं हुआ', 'Not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}.`, `Not saved to the cloud — ${error.message}.`), variant: 'destructive', duration: 12000 });
      }
    });
    return newRec;
  }, []);

  const updateRecoverable = useCallback((id: string, data: Partial<Recoverable>) => {
    if (guardFYLocked()) return;
    const before = recoverablesRef.current.find(r => r.id === id);
    if (!before) return;
    const updated = { ...before, ...data };
    setRecoverablesState(prev => prev.map(r => r.id === id ? updated : r));
    patchRow('recoverables', id, before, updated).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        setRecoverablesState(prev => prev.map(r => r.id === id ? before : r));   // RULE 1: roll back to prior state
        toastRef.current({ title: tr('अपडेट सेव नहीं हुआ', 'Update not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
      }
    });
  }, []);

  const deleteRecoverable = useCallback((id: string) => {
    if (guardPermission('delete', tr('वसूली मद मिटाने', 'delete recoverable items'))) return;   // ECR-06: role gate
    if (guardFYLocked()) return;
    const removed = recoverablesRef.current.find(r => r.id === id);
    setRecoverablesState(prev => prev.filter(r => r.id !== id));
    supabase.from('recoverables').delete().eq('id', id).then(({ error }) => { if (error) failedCloudWrite(tr('वसूली मद हटाना', 'Deleting the recoverable item'), error, () => setRecoverablesState(prev => putBack(prev, removed))); });
  }, []);

  // ── Kachi Aarat (HAFED Proforma 8) ─────────────────────────────────────────
  const addKachiAaratEntry = useCallback((data: Omit<KachiAaratEntry, 'id' | 'createdAt'>): KachiAaratEntry => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as KachiAaratEntry;
    const newEntry: KachiAaratEntry = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    kachiAaratEntriesRef.current = [...kachiAaratEntriesRef.current, newEntry];
    setKachiAaratEntriesState(prev => [...prev, newEntry]);
    supabase.from('kachi_aarat_entries').upsert(withSoc(newEntry)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        kachiAaratEntriesRef.current = kachiAaratEntriesRef.current.filter(e => e.id !== newEntry.id);
        setKachiAaratEntriesState(prev => prev.filter(e => e.id !== newEntry.id));   // RULE 1: roll back
        toastRef.current({ title: tr('सेव नहीं हुआ', 'Not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}.`, `Not saved to the cloud — ${error.message}.`), variant: 'destructive', duration: 12000 });
      }
    });
    return newEntry;
  }, []);

  const updateKachiAaratEntry = useCallback((id: string, data: Partial<KachiAaratEntry>) => {
    if (guardFYLocked()) return;
    const before = kachiAaratEntriesRef.current.find(e => e.id === id);
    if (!before) return;
    const updated = { ...before, ...data };
    setKachiAaratEntriesState(prev => prev.map(e => e.id === id ? updated : e));
    patchRow('kachi_aarat_entries', id, before, updated).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        setKachiAaratEntriesState(prev => prev.map(e => e.id === id ? before : e));   // RULE 1: roll back to prior state
        toastRef.current({ title: tr('अपडेट सेव नहीं हुआ', 'Update not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
      }
    });
  }, []);

  const deleteKachiAaratEntry = useCallback((id: string) => {
    if (guardPermission('delete', tr('कच्ची आढ़त एंट्री मिटाने', 'delete Kachi Aarat entries'))) return;   // ECR-06: role gate
    if (guardFYLocked()) return;
    const removed = kachiAaratEntriesRef.current.find(e => e.id === id);
    setKachiAaratEntriesState(prev => prev.filter(e => e.id !== id));
    supabase.from('kachi_aarat_entries').delete().eq('id', id).then(({ error }) => { if (error) failedCloudWrite(tr('कच्ची आढ़त एंट्री हटाना', 'Deleting the Kachi Aarat entry'), error, () => setKachiAaratEntriesState(prev => putBack(prev, removed))); });
  }, []);

  // ── P7 Entries (HAFED Proforma 7) — one row per FY ─────────────────────────
  const upsertP7Entry = useCallback((data: Omit<P7Entry, 'id' | 'createdAt'> & { id?: string }): P7Entry => {
    // If an entry for the same fyStartDate already exists, update it; else create.
    const existing = p7EntriesRef.current.find(e => e.fyStartDate === data.fyStartDate);
    const id = data.id || existing?.id || crypto.randomUUID();
    const createdAt = existing?.createdAt || new Date().toISOString();
    const entry: P7Entry = { ...(existing || {} as P7Entry), ...data, id, createdAt };
    if (guardFYLocked()) return entry;
    setP7EntriesState(prev => {
      const filtered = prev.filter(e => e.id !== id);
      return [...filtered, entry];
    });
    p7EntriesRef.current = [...p7EntriesRef.current.filter(e => e.id !== id), entry];
    supabase.from('p7_entries').upsert(withSoc(entry)).then(({ error }) => { if (error) failedCloudWrite(tr('P7 एंट्री सेव करना', 'Saving the P7 entry'), error, () => {
      const restore = (list: P7Entry[]) => existing ? [...list.filter(e => e.id !== id), existing] : list.filter(e => e.id !== id);
      p7EntriesRef.current = restore(p7EntriesRef.current);
      setP7EntriesState(restore);
    }); });
    return entry;
  }, []);

  const deleteP7Entry = useCallback((id: string) => {
    if (guardPermission('delete', tr('P7 एंट्री मिटाने', 'delete P7 entries'))) return;   // ECR-06: role gate
    if (guardFYLocked()) return;
    const removed = p7EntriesRef.current.find(e => e.id === id);
    setP7EntriesState(prev => prev.filter(e => e.id !== id));
    supabase.from('p7_entries').delete().eq('id', id).then(({ error }) => { if (error) failedCloudWrite(tr('P7 एंट्री हटाना', 'Deleting the P7 entry'), error, () => setP7EntriesState(prev => putBack(prev, removed))); });
  }, []);

  // Member joining receipts (share capital / admission fee) — ONE rule for add, import and approve
  // (src/lib/members/joiningReceipts.ts). A member who joined BEFORE this FY gets no receipt: that
  // money belongs in the opening balances, not in this year's cash (it overstated the Rania demo's
  // cash by decades of receipts). Cheque / online go to the default bank, not cash. A receipt dated
  // in a locked period is not posted. `quiet` (bulk import) suppresses the per-member toasts — the
  // importer shows one summary from the same planner.
  const postJoiningReceipts = useCallback((m: Member, opts: { quiet?: boolean; fallbackBranch?: string } = {}): 'posted' | 'historical' | 'locked' | 'none' => {
    const plan = planJoiningReceipts(m, {
      financialYear: societyRef.current?.financialYear || '',
      today: new Date().toISOString().slice(0, 10),
      bankAccountId: defaultBankAccountId(accountsRef.current) || null,
    });
    if (plan.mode === 'historical') {
      if (!opts.quiet) {
        toastRef.current({
          title: tr('पुराना सदस्य — नकद रसीद नहीं बनी', 'Old member — cash receipt not created'),
          description: tr(`${m.name} वर्तमान वित्तीय वर्ष से पहले जुड़े हैं, इसलिए शेयर ₹${plan.historicalShare}${plan.historicalAdmission ? ` / प्रवेश शुल्क ₹${plan.historicalAdmission}` : ''} की रसीद नहीं बनाई गई। यह राशि opening balance (शेयर पूँजी 1102) में शामिल करें। (Joined before this FY — carry it in the opening balances.)`, `${m.name} joined before the current Financial Year, so no receipt was created for share ₹${plan.historicalShare}${plan.historicalAdmission ? ` / admission fee ₹${plan.historicalAdmission}` : ''}. Include this amount in the opening balance (Share Capital 1102). (Joined before this FY — carry it in the opening balances.)`),
          duration: 12000,
        });
      }
      return 'historical';
    }
    if (plan.mode !== 'post') return 'none';
    if (isPeriodLocked(plan.date)) {
      if (!opts.quiet) guardPeriodLock(plan.date);
      return 'locked';
    }
    if (plan.bankFallbackToCash && !opts.quiet) {
      toastRef.current({ title: tr('बैंक खाता नहीं मिला', 'Bank account not found'), description: tr(`${m.name} का भुगतान cheque/online है, पर समिति में कोई बैंक खाता नहीं — रसीद नकद में दर्ज हुई। बैंक खाता जोड़कर voucher सुधारें।`, `${m.name}'s payment is by cheque/online, but the society has no bank account — the receipt was recorded as cash. Add a bank account and correct the voucher.`), variant: 'destructive', duration: 12000 });
    }
    // B3 (Phase 2): under the posting service a joining receipt is posted by the SERVER like every
    // other voucher (addVoucher → post_voucher: row + lines + entries + journal in one transaction).
    // The client-side three-step save below stays for societies with the flag OFF (byte-identical).
    if (postingServiceRef.current) {
      for (const r of plan.receipts) {
        addVoucher({ type: 'receipt', date: plan.date, debitAccountId: plan.debitAccountId, creditAccountId: r.creditAccountId, amount: r.amount,
          narration: r.narration, memberId: m.id, branchId: m.branchId ?? opts.fallbackBranch, createdBy: 'System' });
      }
      return 'posted';
    }
    for (const r of plan.receipts) {
      // ECR-17 Phase 5: stamp the member's branch — this construction bypasses addVoucher's stamp,
      // and an unbranched voucher would be invisible to a branch-restricted creator's verify-read.
      const v: Voucher = { id: crypto.randomUUID(), voucherNo: storage.getNextVoucherNo('receipt', societyRef.current?.financialYear || '', vouchersRef.current), type: 'receipt', date: plan.date, debitAccountId: plan.debitAccountId, creditAccountId: r.creditAccountId, amount: r.amount, narration: r.narration, memberId: m.id, branchId: m.branchId ?? opts.fallbackBranch, createdAt: new Date().toISOString(), createdBy: 'System' };
      vouchersRef.current = [...vouchersRef.current, v];
      setVouchersState(prev => [...prev, v]);
      // T-06 / T-09: the same `voucher.posted` journal event addVoucher emits — without it the receipt
      // is invisible to every journal read and breaks the society's parity. Appended durably only
      // after the voucher row is confirmed (WORM-safe), dropped with the voucher on failure.
      let postedEvent: LedgerEvent | null = null;
      try {
        postedEvent = buildEvent({
          eventType: 'voucher.posted', tenantId: societyIdRef.current, jurisdiction: jurisdictionRef.current,
          aggregateType: 'voucher', aggregateId: v.id, sequence: 1,
          producer: { kind: 'human', id: userRef.current?.name ?? null },
          payload: { lines: voucherPostingLines(v), ...voucherEventMeta(v) },
        }, { eventId: crypto.randomUUID(), occurredAt: new Date().toISOString() });
        ledgerEventsRef.current = [...ledgerEventsRef.current, postedEvent];
      } catch { /* shadow ledger is best-effort — never touches the receipt save */ }
      // RULE 1: persistVoucher rolls the optimistic receipt back if the cloud save fails.
      persistVoucher(v, {
        isUpdate: false,
        onBaseSuccess: () => { if (postedEvent) persistLedgerEvent(postedEvent); },
        onBaseFail: () => {
          vouchersRef.current = vouchersRef.current.filter(x => x.id !== v.id);
          setVouchersState(prev => prev.filter(x => x.id !== v.id));
          if (postedEvent) ledgerEventsRef.current = ledgerEventsRef.current.filter(e => e.eventId !== postedEvent!.eventId);
        },
      });
    }
    return 'posted';
    // persistVoucher is a plain per-render function that only reads refs — same omission as the
    // other voucher-writing callbacks here; listing it would rebuild addMember every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardPeriodLock, addVoucher]);

  // Member PII split, step 2 of the two-step save (RULE 1): the base `members` row is already safe; this
  // writes aadhaar/pan to member_identity. Failure never loses the member — it reverts the PII shown in
  // state and tells the user clearly. No-op in LEGACY mode (PII rode in the members row).
  // DB-09: the party PII write (step 2 after the party row is safe). Writes party_identity only when the PII changed
  // (before = undefined for a new party). A role that may not store it, or a refused write, reverts the PII on screen
  // and says so (RULE 1) — the rest of the party is already saved. No-op in LEGACY mode (PII rode on the party row).
  const persistPartyIdentity = (type: PartyType, entityId: string, row: object, before: object | undefined, revert: () => void) => {
    if (!partySplitRef.current) return;
    if (before ? !partyPIIChanged(before, row, type) : Object.keys(pickPartyPII(row, type)).length === 0) return;
    const what = tr('PAN/बैंक विवरण', 'PAN / bank details');
    if (!canReadPartyPii(userRef.current?.role, type)) {
      revert();
      toastRef.current({ title: tr(`${what} सेव नहीं हुआ`, `${what} not saved`), description: tr('यह भूमिका PAN/आधार/बैंक विवरण नहीं बदल सकती — बाकी जानकारी सेव हो गई है। Admin/Accountant से करवाएँ।', 'This role cannot change PAN / Aadhaar / bank details — the other details were saved. Ask an Admin/Accountant to do it.'), variant: 'destructive', duration: 10000 });
      return;
    }
    const r = partyIdentityRowFor(societyIdRef.current, type, entityId, row);
    supabase.from('party_identity').upsert(r, { onConflict: 'society_id,entity_type,entity_id' }).then(({ error }) => {
      if (!error) return;
      console.error('party_identity sync error:', error.message); reportError('db-sync', error.message, { at: 'party_identity', type });
      revert();
      toastRef.current({ title: tr(`${what} सेव नहीं हुआ`, `${what} not saved`), description: tr(`बाकी जानकारी सेव हो गई, पर PAN/बैंक विवरण नहीं (${error.message})। दोबारा कोशिश करें।`, `The other details were saved, but not the PAN / bank details (${error.message}). Please try again.`), variant: 'destructive', duration: 12000 });
    }, () => { revert(); });
  };
  /** DB-09: put a party's PII fields back to `from` on screen (used as the revert of persistPartyIdentity). */
  const piiOf = (from: object | undefined, type: PartyType): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const f of PARTY_PII_FIELDS[type]) out[f] = from ? (from as Record<string, unknown>)[f] : undefined;
    return out;
  };

  const persistMemberIdentity = (memberId: string, pii: { aadhaar?: string; pan?: string }, revert: () => void) => {
    if (!identitySplitRef.current) return;
    if (!canReadMemberPii(userRef.current?.role)) {
      // This role may not store PAN/Aadhaar (RLS would refuse). Never claim it saved: revert and say so (RULE 1).
      revert();
      toastRef.current({ title: tr('PAN/Aadhaar सेव नहीं हुआ', 'PAN/Aadhaar not saved'), description: tr('यह भूमिका PAN/Aadhaar नहीं बदल सकती — सदस्य की बाकी जानकारी सेव हो गई है। Admin/Accountant से करवाएँ.', 'This role cannot change PAN/Aadhaar — the member\'s other details were saved. Ask an Admin/Accountant to do it.'), variant: 'destructive', duration: 10000 });
      return;
    }
    const sid = societyIdRef.current;
    const row = identityRowFor(sid, memberId, pii);
    const req = row
      ? supabase.from('member_identity').upsert(row, { onConflict: 'society_id,member_id' })
      : supabase.from('member_identity').delete().eq('society_id', sid).eq('member_id', memberId);
    req.then(({ error }) => {
      if (!error) return;
      console.error('member_identity sync error:', error.message); reportError('db-sync', error.message);
      revert();
      toastRef.current({ title: tr('PAN/Aadhaar सेव नहीं हुआ', 'PAN/Aadhaar not saved'), description: tr(`सदस्य सेव हो गया, पर PAN/Aadhaar नहीं (${error.message})। दोबारा कोशिश करें।`, `Member saved, but not the PAN/Aadhaar (${error.message}). Please try again.`), variant: 'destructive', duration: 12000 });
    });
  };

  const addMember = useCallback((data: Omit<Member, 'id'>, opts: { quiet?: boolean; onSaved?: (m: Member) => void; onFailed?: () => void } = {}): Member => {
    if (guardFYLocked()) return { ...data, id: '' } as Member;
    const today = new Date().toISOString().split('T')[0];
    const newMember: Member = {
      ...data, id: crypto.randomUUID(), branchId: data.branchId ?? branchToStamp(activeBranchIdRef.current, headOfficeIdRef.current),
      // M2: a new application starts the r.17 / s.16 clock on the day it is received.
      ...(data.approvalStatus === 'pending' && !data.applicationDate ? { applicationDate: today } : {}),
    };
    setMembersState(prev => {
      const updated = [...prev, newMember];
      return updated;
    });
    // ECR-17 Phase 5: branchId rides IN the base upsert — the branch-scoped RLS SELECT
    // policies (migration 039) must see it on the row from birth, or a branch-restricted
    // user's own new member vanishes from their next load. On a stale schema cache that
    // doesn't know "branchId" yet, retry once without it so the base save never fails
    // because of the branch column (RULE 1).
    const attemptMemberSave = (payload: Member) => {
      supabase.from('members').upsert(memberRow(payload)).then(({ error }) => {
        if (error) {
          if (isMissingBranchColumn(error) && 'branchId' in payload) {
            const { branchId: _b, ...noBranch } = payload;
            attemptMemberSave(noBranch as Member);
            return;
          }
          console.error('DB sync error:', error.message); reportError('db-sync', error.message);
          setMembersState(prev => prev.filter(m => m.id !== newMember.id));   // RULE 1: roll back local state
          toastRef.current({ title: tr('सदस्य सेव नहीं हुआ', 'Member not saved'), description: memberWriteErrorText(error) ?? tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा; दोबारा जोड़ें।`, `Not saved to the cloud — ${error.message}. Nothing will go wrong on Refresh; add it again.`), variant: 'destructive', duration: 12000 });
          opts.onFailed?.();
          return;
        }
        if (newMember.aadhaar || newMember.pan) {
          persistMemberIdentity(newMember.id, { aadhaar: newMember.aadhaar, pan: newMember.pan },
            () => setMembersState(prev => prev.map(m => m.id === newMember.id ? { ...m, aadhaar: undefined, pan: undefined } : m)));
        }
        persistMemberAdmission(newMember.id, newMember);
        persistMemberProfile(newMember.id, newMember, !!(newMember.gender || newMember.dateOfBirth));
        persistMemberContact(newMember.id, newMember, !!newMember.correspondenceAddress);
        // Member-audit M1 (D4/D5): the page's success message waits for the cloud; one audit row per member
        // (a bulk import passes quiet and is summarised by the importer instead of one row per member).
        if (!opts.quiet) emitAudit({ entityType: 'member', entityId: newMember.id, action: 'create', after: { memberId: newMember.memberId, name: newMember.name, shareCapital: newMember.shareCapital || 0, admissionFee: newMember.admissionFee || 0, approvalStatus: newMember.approvalStatus ?? 'approved' } });
        // Share capital / admission fee receipts — one rule for add / import / approve (see
        // postJoiningReceipts). ONLY once the member row is durable (as approveMember does): a receipt
        // posted before a failed member save would survive the rollback as a voucher with no member.
        // Pending applications get theirs on approval.
        if (newMember.approvalStatus !== 'pending') postJoiningReceipts(newMember, { quiet: opts.quiet });
        opts.onSaved?.(newMember);
      });
    };
    attemptMemberSave(newMember);
    return newMember;
  }, [postJoiningReceipts]);

  const updateMember = useCallback((id: string, data: Partial<Member>, opts?: { onSaved?: (saved?: Member) => void }): boolean => {
    if (guardFYLocked()) return false;
    const oldMember = membersRef.current.find(m => m.id === id);
    if (!oldMember) return false;
    const updatedMember = { ...oldMember, ...data };
    // A flat-only nominee edit (Nomination / Share Register, importer) also moves the role-'primary' entry of
    // nominees[], so the statutory print (flat) and nominees[] never name different people.
    if (!('nominees' in data) && ('nomineeName' in data || 'nomineeRelation' in data || 'nomineePhone' in data)) {
      updatedMember.nominees = syncPrimaryNominee(oldMember.nominees, {
        nomineeName: updatedMember.nomineeName, nomineeRelation: updatedMember.nomineeRelation, nomineePhone: updatedMember.nomineePhone,
      });
    }
    setMembersState(prev => {
      const updated = prev.map(m => m.id === id ? updatedMember : m);
      return updated;
    });
    // Helper: re-sync a member's auto-voucher (Share Capital / Admission Fee).
    // S3-e-3: through the ONE voucher-edit path (updateVoucher) — its guards, its rollback, its journal
    // events (reversed + reposted) and, under the posting service, edit_voucher (one transaction that
    // also replaces voucher_entries). The old direct upsert changed the amount with NO journal event,
    // left the old entries behind (new line ids + upsert) and never rolled back. An amount set to 0
    // cancels the voucher (with its journal) instead of leaving a ₹0 receipt.
    // If the voucher was cancelled earlier, warn the user instead of silently no-op.
    const resyncMemberVoucher = (creditAccountId: string, newAmount: number, kind: string) => {
      const active = vouchersRef.current.find(v => v.memberId === id && v.creditAccountId === creditAccountId && !v.isDeleted);
      if (active) {
        if (!(newAmount > 0)) {
          cancelLinkedVouchers([active.id], `${kind} set to 0 for ${updatedMember.name}`, userRef.current?.name || 'System');
          return;
        }
        const lid = () => crypto.randomUUID();
        // Rebuild lines so multi-line vouchers stay consistent; legacy single-line use derived
        const newLines: VoucherLine[] = [
          { id: lid(), accountId: active.debitAccountId, type: 'Dr', amount: newAmount },
          { id: lid(), accountId: creditAccountId, type: 'Cr', amount: newAmount },
        ];
        // viaParent: the member edit IS the owning screen (MEM-03 blocks the same edit from the Vouchers page).
        const applied = updateVoucher(active.id, { amount: newAmount, lines: newLines, narration: `${kind} updated for ${updatedMember.name}` }, { viaParent: true });
        if (!applied) {
          // updateVoucher already said why (FY/period lock, role, reversed…). Make the split visible.
          toastRef.current({ title: tr(`${kind} वाउचर नहीं बदला`, `${kind} voucher not changed`), description: tr(`सदस्य की राशि ₹${newAmount} हो गई, पर ${active.voucherNo} पुरानी राशि पर है — ऊपर बताया कारण देखें और वाउचर अलग से ठीक करें।`, `The member's amount is now ₹${newAmount}, but ${active.voucherNo} is still at the old amount — see the reason shown above and fix the voucher separately.`), variant: 'destructive', duration: 12000 });
        }
      } else {
        const cancelled = vouchersRef.current.find(v => v.memberId === id && v.creditAccountId === creditAccountId && v.isDeleted);
        if (cancelled) {
          toastRef.current({
            title: `${kind} voucher cancelled`,
            description: `Previous ${kind} voucher was cancelled — amount changed but no new voucher auto-created. Add a manual voucher if needed.`,
            variant: 'default',
          });
        }
      }
    };

    // ECR-17 Phase 5: branchId rides IN the base upsert (see addMember); stale-schema-cache
    // fallback keeps RULE 1 intact.
    // ARCH-04 (audit 2026-11-17): send ONLY the base columns this edit changed. The whole-row upsert rebuilt the member
    // from the snapshot this tab loaded at login — a tab open since morning, correcting a phone number, wrote back its
    // stale share capital over another user's newer one. An unchanged column is no longer sent, so it cannot be undone.
    const changedBase = (payload: Member): Record<string, unknown> => {
      const base = memberRow(payload) as Record<string, unknown>;
      const before = oldMember as unknown as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(base)) {
        if (k === 'id' || k === 'society_id' || !(k in data)) continue;
        if (JSON.stringify(v ?? null) !== JSON.stringify(before[k] ?? null)) patch[k] = v;
      }
      return patch;
    };
    const attemptMemberUpdate = (payload: Member) => {
      const patch = changedBase(payload);
      const write = Object.keys(patch).length === 0
        ? Promise.resolve({ error: null as { message: string; code?: string } | null })   // only side-table fields changed
        : supabase.from('members').update(patch).eq('id', id).select('id').then(({ data: rows, error }) =>
            ({ error: error ?? (!rows?.length ? { message: tr('सदस्य cloud पर नहीं मिला / अनुमति नहीं', 'member not found on the cloud / not permitted') } : null) }));
      write.then(({ error }) => {
        if (error) {
          if (isMissingBranchColumn(error) && 'branchId' in payload) {
            const { branchId: _b, ...noBranch } = payload;
            attemptMemberUpdate(noBranch as Member);
            return;
          }
          console.error('DB sync error:', error.message); reportError('db-sync', error.message);
          setMembersState(prev => prev.map(m => m.id === id ? oldMember : m));   // RULE 1: roll back to prior state
          toastRef.current({ title: tr('अपडेट सेव नहीं हुआ', 'Update not saved'), description: memberWriteErrorText(error) ?? tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
          return;
        }
        // Step 2 (PII split): only when aadhaar/pan actually changed.
        if (('aadhaar' in data || 'pan' in data)
            && ((updatedMember.aadhaar || '') !== (oldMember.aadhaar || '') || (updatedMember.pan || '') !== (oldMember.pan || ''))) {
          persistMemberIdentity(id, { aadhaar: updatedMember.aadhaar, pan: updatedMember.pan },
            () => setMembersState(prev => prev.map(m => m.id === id ? { ...m, aadhaar: oldMember.aadhaar, pan: oldMember.pan } : m)));
        }
        const clearedAdmission = clearedAdmissionFields(data as Record<string, unknown>, oldMember as unknown as Record<string, unknown>);
        if (Object.keys(splitAdmissionFields(data as Record<string, unknown>).extras).length || clearedAdmission.length) persistMemberAdmission(id, updatedMember, clearedAdmission);
        persistMemberProfile(id, updatedMember, MEMBER_PROFILE_FIELDS.some(f => f in data && (data as Record<string, unknown>)[f] !== (oldMember as unknown as Record<string, unknown>)[f]));
        persistMemberContact(id, updatedMember, MEMBER_CONTACT_FIELDS.some(f => f in data && (data as Record<string, unknown>)[f] !== (oldMember as unknown as Record<string, unknown>)[f]));
        // Member-audit M1 (D4): who changed what — Aadhaar / PAN are named, never their values.
        const changed = memberAuditDiff(oldMember as unknown as Record<string, unknown>, updatedMember as unknown as Record<string, unknown>);
        if (changed) emitAudit({ entityType: 'member', entityId: id, action: 'update', before: changed.before, after: changed.after });
        // The linked auto-voucher follows ONLY once the member row is durable: re-syncing first and then
        // rolling the member back would leave the voucher on the new amount (register ≠ ledger).
        if (data.shareCapital !== undefined && data.shareCapital !== oldMember.shareCapital) {
          resyncMemberVoucher(ACCOUNT_IDS.SHARE_CAP, data.shareCapital, 'Share Capital');
        }
        if (data.admissionFee !== undefined && data.admissionFee !== oldMember.admissionFee) {
          resyncMemberVoucher(ACCOUNT_IDS.ADM_FEE, data.admissionFee, 'Admission Fee');
        }
        opts?.onSaved?.(updatedMember);
      });
    };
    attemptMemberUpdate(updatedMember);
    return true;
  }, [updateVoucher]);

  // ECR-16 (member lifecycle): record a lifecycle transition (resign/expel/death/reactivate)
  // with reason + date. `status` (base column) is persisted reliably; the reason/date
  // metadata rides a targeted best-effort .update() so the change is safe pre-migration.
  const changeMemberStatus = useCallback((id: string, newStatus: MemberStatus, reason: string, opts?: { effectiveDate?: string; resolutionNo?: string; resolutionDate?: string; details?: Record<string, unknown> }): boolean => {
    if (guardFYLocked()) return false;
    const current = membersRef.current.find(m => m.id === id);
    if (!current) return false;
    if (!canTransitionMember(current.status, newStatus)) {
      toastRef.current({
        title: tr('बदलाव मान्य नहीं / Invalid change', 'Invalid change'),
        description: current.status === 'deceased'
          ? tr('मृत सदस्य की स्थिति नहीं बदली जा सकती। (A deceased member cannot be reactivated.)', 'A deceased member\'s status cannot be changed. (A deceased member cannot be reactivated.)')
          : tr('यह बदलाव मान्य नहीं (वही स्थिति पहले से है)।', 'This change is not valid (the member already has this status).'),
        variant: 'destructive', duration: 8000,
      });
      return false;
    }
    // M4: r.22(c) — the date the member really ceased (a resignation / death recorded later keeps its own date).
    const changedAt = opts?.effectiveDate || new Date().toISOString().split('T')[0];
    const resolutionNo = opts?.resolutionNo?.trim() || undefined;
    const resolutionDate = opts?.resolutionDate || undefined;
    const details = opts?.details && Object.keys(opts.details).length ? opts.details : undefined;
    const updated: Member = { ...current, status: newStatus, statusReason: reason, statusChangedAt: changedAt, statusResolutionNo: resolutionNo, statusResolutionDate: resolutionDate, statusDetails: details };
    membersRef.current = membersRef.current.map(m => m.id === id ? updated : m);
    setMembersState(prev => prev.map(m => m.id === id ? updated : m));
    // Persist status (base column) reliably — roll back on failure (RULE 1). Everything else (the
    // metadata, the audit row, the success toast) waits for it: a "✅ updated" toast and an audit row for
    // a change the cloud then refused was the false-success pattern (member-area stage A, M-3).
    supabase.from('members').update({ status: newStatus }).eq('id', id).select('id').then(({ data: changed, error: err }) => {
      // Final batch (M-15): 0 rows changed (RLS / missing row) is a failure too, not a silent success.
      const error = err ?? (!changed?.length ? { message: tr('रिकॉर्ड नहीं बदला — अनुमति नहीं या रिकॉर्ड नहीं मिला (0 rows)', 'Record not changed — no permission or record not found (0 rows)') } : null);
      if (error) {
        console.error('DB sync error (member status):', error.message);
        membersRef.current = membersRef.current.map(m => m.id === id ? current : m);
        setMembersState(prev => prev.map(m => m.id === id ? current : m));
        toastRef.current({ title: tr('स्थिति सेव नहीं हुई', 'Status not saved'), description: memberWriteErrorText(error) ?? tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
        return;
      }
      // Metadata (late-added columns) — the base status above is already safe, so no rollback; but the
      // date is the r.22(c) "ceased on" date the register and voters list read, so a failure is SAID.
      supabase.from('members').update({ statusReason: reason, statusChangedAt: changedAt }).eq('id', id).then(({ error: e1 }) => {
        if (!e1) return;
        reportError('write-partial', e1.message, { at: 'member status metadata' });
        toastRef.current({ title: tr('स्थिति सेव हुई — पर तिथि/कारण नहीं', 'Status saved — but not the date/reason'), description: tr(`समाप्ति की तिथि और कारण सेव नहीं हुए (${e1.message})। Migration चलाएँ, फिर स्थिति दोबारा दर्ज करें।`, `The end date and reason were not saved (${e1.message}). Run the Migration, then record the status again.`), duration: 10000 });
      });
      // M4: the resolution (migration 117) in its OWN update — one missing column must not drop the reason/date above.
      supabase.from('members').update({ statusResolutionNo: resolutionNo ?? null, statusResolutionDate: resolutionDate ?? null }).eq('id', id).then(({ error: e2 }) => {
        if (!e2) return;
        reportError('write-partial', e2.message, { at: 'member status resolution' });
        if (resolutionNo || resolutionDate) toastRef.current({ title: tr('स्थिति सेव हुई — पर प्रस्ताव संख्या नहीं', 'Status saved — but not the resolution number'), description: tr(`प्रस्ताव संख्या/तिथि सेव नहीं हुई (${e2.message})। Migration 117 चलाएँ।`, `Resolution number/date not saved (${e2.message}). Run Migration 117.`), duration: 10000 });
      });
      // Stage C (migration 125): the facts behind the cessation (r.14(2) proof, r.19 count, r.18 facts) — own update.
      supabase.from('members').update(asDbRow({ statusDetails: details ?? null })).eq('id', id).then(({ error: e3 }) => {
        if (!e3) return;
        reportError('write-partial', e3.message, { at: 'member status details' });
        if (details) toastRef.current({ title: tr('स्थिति सेव हुई — पर विवरण नहीं', 'Status saved — but not the details'), description: tr(`अयोग्यता का प्रमाण / आम सभा की गिनती / त्यागपत्र का विवरण सेव नहीं हुआ (${e3.message})। Migration 125 चलाएँ, फिर स्थिति दोबारा दर्ज करें।`, `Proof of disqualification / general meeting count / resignation details not saved (${e3.message}). Run Migration 125, then record the status again.`), duration: 10000 });
      });
      emitAudit({ entityType: 'member', entityId: id, action: 'update', before: { status: current.status, statusChangedAt: current.statusChangedAt ?? null }, after: { status: newStatus, statusChangedAt: changedAt, resolutionNo: resolutionNo ?? null, resolutionDate: resolutionDate ?? null, details: details ?? null }, reason });
      toastRef.current({ title: tr('✅ सदस्य स्थिति अपडेट', '✅ Member status updated'), description: `${current.name}: ${current.status} → ${newStatus}`, variant: 'default', duration: 6000 });
    });
    return true;
  }, []);

  // M6 (Act s.40 proviso): the member's photograph in the PRIVATE 'member-photos' bucket. Upload first; only when the
  // file is stored does photoPath move (step-2 update) — a failed upload changes nothing (RULE 1).
  const uploadMemberPhoto = useCallback(async (id: string, file: File): Promise<boolean> => {
    if (guardPermission('update', tr('सदस्य की फ़ोटो बदलने', 'change a member\'s photo'))) return false;
    if (guardFYLocked()) return false;
    const member = membersRef.current.find(m => m.id === id);
    if (!member) return false;
    const bad = photoFileError(file);
    if (bad) { toastRef.current({ title: tr('फ़ोटो नहीं ली जा सकी', 'Photo could not be taken'), description: bad, variant: 'destructive' }); return false; }
    let blob: Blob;
    try { blob = await downscalePhoto(file); } catch { toastRef.current({ title: tr('फ़ोटो नहीं पढ़ी जा सकी', 'Photo could not be read'), description: tr('दूसरी फ़ोटो (JPG/PNG) आज़माएँ। (Could not read the image.)', 'Try another photo (JPG/PNG). (Could not read the image.)'), variant: 'destructive' }); return false; }
    const path = memberPhotoPath(societyIdRef.current, id);
    const { error: upErr } = await supabase.storage.from(MEMBER_PHOTO_BUCKET).upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '60' });
    if (upErr) {
      reportError('db-sync', upErr.message, { at: 'member photo upload' });
      toastRef.current({ title: tr('फ़ोटो सेव नहीं हुई', 'Photo not saved'), description: tr(`क्लाउड में सेव नहीं हुई — ${upErr.message}. (Migration 119 चलाया है?)`, `Not saved to the cloud — ${upErr.message}. (Have you run Migration 119?)`), variant: 'destructive', duration: 12000 });
      return false;
    }
    const { error } = await supabase.from('members').update({ photoPath: path }).eq('id', id);
    if (error) {
      reportError('write-partial', error.message, { at: 'member photoPath' });
      toastRef.current({ title: tr('फ़ोटो सेव हुई — पर सदस्य से नहीं जुड़ी', 'Photo saved — but not linked to the member'), description: tr(`${error.message}. Migration 119 चलाएँ।`, `${error.message}. Run Migration 119.`), variant: 'destructive', duration: 12000 });
      return false;
    }
    membersRef.current = membersRef.current.map(m => m.id === id ? { ...m, photoPath: path } : m);
    setMembersState(prev => prev.map(m => m.id === id ? { ...m, photoPath: path } : m));
    emitAudit({ entityType: 'member', entityId: id, action: 'update', before: { photoPath: member.photoPath ? '(set)' : null }, after: { photoPath: '(changed)' }, reason: 'Member photograph updated' });
    toastRef.current({ title: tr('✅ फ़ोटो सेव हुई', '✅ Photo saved'), description: `${member.name} (${member.memberId})` });
    return true;
  }, []);

  const removeMemberPhoto = useCallback(async (id: string): Promise<boolean> => {
    if (guardPermission('update', tr('सदस्य की फ़ोटो हटाने', 'remove a member\'s photo'))) return false;
    if (guardFYLocked()) return false;
    const member = membersRef.current.find(m => m.id === id);
    if (!member?.photoPath) return false;
    const { error } = await supabase.from('members').update({ photoPath: null }).eq('id', id);
    if (error) { toastRef.current({ title: tr('फ़ोटो नहीं हटी', 'Photo not removed'), description: error.message, variant: 'destructive' }); return false; }
    await supabase.storage.from(MEMBER_PHOTO_BUCKET).remove([member.photoPath]);   // best effort: the link is already gone
    membersRef.current = membersRef.current.map(m => m.id === id ? { ...m, photoPath: undefined } : m);
    setMembersState(prev => prev.map(m => m.id === id ? { ...m, photoPath: undefined } : m));
    emitAudit({ entityType: 'member', entityId: id, action: 'update', before: { photoPath: '(set)' }, after: { photoPath: null }, reason: 'Member photograph removed' });
    return true;
  }, []);

  /** A short-lived signed URL for a member photo (private bucket), or null. */
  const memberPhotoUrl = useCallback(async (path: string | undefined): Promise<string | null> => {
    if (!path) return null;
    const { data, error } = await supabase.storage.from(MEMBER_PHOTO_BUCKET).createSignedUrl(path, 600);
    return error ? null : data?.signedUrl ?? null;
  }, []);

  const deleteMember = useCallback((id: string, domain?: MemberDomainLinkSources) => {
    if (guardPermission('delete', tr('सदस्य मिटाने', 'delete members'))) return;   // ECR-06: role gate
    if (guardFYLocked()) return;
    // Member-audit M1 (D3): a member with live vouchers, loans, deposit accounts or KCC loans is never deleted —
    // the dialog used to offer "Proceed anyway" and this then cancelled ALL their vouchers (share capital, loans).
    // Such a member leaves through a status change (resigned / expelled / deceased); delete is for a wrong entry.
    // Re-audit leftovers: consumer credit sales (sales) and the page-supplied housing / dairy / portal links block too.
    const live = computeEntityLinks('member', id, {
      vouchers: vouchersRef.current.filter(v => !v.isDeleted), loans: loansRef.current,
      sales: salesRef.current, purchases: [], stockMovements: [], salaryRecords: [], suppliers: [], customers: [], assets: [],
      depositAccounts: depositAccountsRef.current, kccLoans: kccLoansRef.current, ...domain,
    }).filter(l => l.blocking);
    if (live.length) {
      toastRef.current({
        title: tr('सदस्य नहीं हटाया जा सकता', 'Member cannot be deleted'),
        description: tr(`इस सदस्य के ${live.map(l => l.labelHi).join(', ')} हैं। सदस्य को हटाने के बजाय "इस्तीफ़ा / निष्कासित / मृत" स्थिति दें। (Member has live records — change the status instead.)`, `This member has ${live.map(l => l.labelHi).join(', ')}. Instead of deleting the member, set the status to "Resigned / Expelled / Deceased". (Member has live records — change the status instead.)`),
        variant: 'destructive', duration: 12000,
      });
      return;
    }
    const removed = membersRef.current.find(m => m.id === id);
    setMembersState(prev => {
      const updated = prev.filter(m => m.id !== id);
      return updated;
    });
    // Soft-delete (P0 #2): retain the row (isDeleted=true) for statutory retention & audit.
    // The in-memory removal above hides it from the app; load filters isDeleted out on refresh.
    // The cascade runs only once the member row is soft-deleted in the cloud (RULE 1 + 3).
    // Final batch (M-15): an UPDATE that RLS filters out returns no error and changes 0 rows — ask for the row back,
    // so "deleted" is said only when the cloud really has it (else the member came back on F5).
    supabase.from('members').update({ isDeleted: true }).eq('id', id).select('id').then(({ data: changed, error: err }) => {
      const error = err ?? (!changed?.length ? { message: tr('रिकॉर्ड नहीं बदला — अनुमति नहीं या रिकॉर्ड नहीं मिला (0 rows)', 'Record not changed — no permission or record not found (0 rows)') } : null);
      if (error) { failedCloudWrite(tr('सदस्य हटाना', 'Deleting the member'), error, () => setMembersState(prev => putBack(prev, removed))); return; }
      // RULE 3: soft-cancel the member's auto-generated vouchers (share capital /
      // admission fee) so no ghost Share Capital lingers in the Trial Balance.
      cancelLinkedVouchers(vouchersRef.current.filter(v => v.memberId === id).map(v => v.id), 'Member deleted', user?.name || 'System');
      emitAudit({ entityType: 'member', entityId: id, action: 'delete', before: removed ? { memberId: removed.memberId, name: removed.name } : undefined, reason: 'Member deleted' });
      toastRef.current({ title: tr('सदस्य हटाया गया', 'Member deleted'), description: removed ? `${removed.name} (${removed.memberId})` : undefined });
    });
  }, []);

  // Refund / withdraw a member's share capital (resignation, death, partial surrender).
  // Posts a SEPARATE dated voucher Dr Share Capital 1102 / Cr Cash-Bank (memberId-tagged)
  // — the original join receipt is left intact, so net 1102 = issued − refunds = current
  // holdings, matching the reduced member.shareCapital used for dividends. Updates the
  // member row DIRECTLY (not via updateMember) so the join receipt is not resynced/rewritten.
  const refundShareCapital = useCallback((memberId: string, amount: number, mode: 'cash' | 'bank', date: string) => {
    if (guardFYLocked()) return;
    const member = membersRef.current.find(m => m.id === memberId);
    if (!member) return;
    const refund = toRupees(toMinor(Math.max(0, Math.min(amount, member.shareCapital || 0))));
    if (!(refund > 0)) { toastRef.current({ title: tr('राशि सही नहीं है', 'Amount is not valid'), description: tr('वापसी राशि 0 से अधिक और सदस्य की वर्तमान अंश पूँजी से कम या बराबर हो। (Refund must be > 0 and ≤ current share capital.)', 'The refund amount must be more than 0 and not more than the member\'s current share capital. (Refund must be > 0 and ≤ current share capital.)'), variant: 'destructive' }); return; }
    const creditAcc = mode === 'bank' ? (defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK) : ACCOUNT_IDS.CASH;
    if (voucherBirthBlocked(date)) return;
    const voucher = addVoucher({
      type: 'payment', date,
      debitAccountId: ACCOUNT_IDS.SHARE_CAP, creditAccountId: creditAcc, amount: refund,
      narration: `Share Capital refunded to ${member.name} — ${date}`,
      createdBy: user?.name ?? 'System', memberId,
    });
    if (!voucher?.id) return;   // D1: no voucher → the member's share capital must not move either
    const before = member;
    const updated = withShareCapital(member, toRupees(subMinor(toMinor(member.shareCapital || 0), toMinor(refund))));
    membersRef.current = membersRef.current.map(m => m.id === memberId ? updated : m);
    setMembersState(prev => prev.map(m => m.id === memberId ? updated : m));
    supabase.from('members').upsert(memberRow(updated)).then(({ error }) => {
      if (error) {
        reportCascade('Share refund member sync', error);
        membersRef.current = membersRef.current.map(m => m.id === memberId ? before : m);
        setMembersState(prev => prev.map(m => m.id === memberId ? before : m));   // RULE 1: roll back
        // …and the voucher with it — a refund voucher without the reduced scalar is register ≠ ledger.
        cancelLinkedVouchers([voucher.id], 'Share refund not saved (cloud save failed)', userRef.current?.name ?? 'System', { rollback: true });
        toastRef.current({ title: tr('शेयर वापसी सेव नहीं हुई', 'Share refund not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. वाउचर रद्द कर दिया गया।`, `Not saved to the cloud — ${error.message}. The voucher was cancelled.`), variant: 'destructive', duration: 12000 });
      } else {
        emitAudit({ entityType: 'member', entityId: memberId, action: 'update', before: { shareCapital: before.shareCapital || 0, shareCount: before.shareCount ?? null }, after: { shareCapital: updated.shareCapital, shareCount: updated.shareCount ?? null, voucherNo: voucher.voucherNo || voucher.id }, reason: `Share capital refunded ₹${refund}` });
        toastRef.current({ title: tr('✅ शेयर पूँजी वापस', '✅ Share capital refunded'), description: `₹${refund.toLocaleString('en-IN')} · ${member.name}` });
      }
    });
  }, [accounts, addVoucher, user]);

  // Two-step share refund. APPROVE: Dr Share Capital 1102 / Cr Share Refund Payable (journal) — the member's holding comes
  // down now, the society's debt to them is booked. PAY: Dr Share Refund Payable / Cr Cash-Bank. Unlike refundShareCapital the
  // member row is only touched on approval (shareCapital is reduced then); the outstanding is read from live vouchers.
  // RULE 1: if the member row cannot be saved, the member is restored AND the voucher is cancelled again.
  // MEM-04 (audit 2026-11-17): a share voucher the server refuses LATE (closed year, period lock) is rolled back by
  // addVoucher, but the member's share capital had already moved — register ≠ ledger. The scalar still moves at once
  // (that is what stops a second click), and on a late refusal it is moved back by the same delta, applied to the
  // LATEST row. `forward` resolves true once the forward member save landed (false = it failed and already rolled
  // itself back), so the undo is written strictly AFTER it and never twice.
  const undoShareDeltas = (deltas: { memberId: string; deltaMinor: number }[], forward: Promise<boolean>, what: { hi: string; en: string }) => {
    forward.then((ok) => {
      if (!ok) return;
      for (const d of deltas) {
        const cur = membersRef.current.find(m => m.id === d.memberId);
        if (!cur) continue;
        const back = withShareCapital(cur, toRupees(subMinor(toMinor(cur.shareCapital || 0), d.deltaMinor)));
        membersRef.current = membersRef.current.map(m => m.id === d.memberId ? back : m);
        setMembersState(prev => prev.map(m => m.id === d.memberId ? back : m));
        supabase.from('members').upsert(memberRow(back)).then(({ error }) => { if (error) reportCascade(`Share undo after refusal (${what.en})`, error); });
      }
      toastRef.current({ title: tr(`${what.hi} दर्ज नहीं हुआ`, `${what.en} not recorded`), description: tr('सर्वर ने इसका वाउचर स्वीकार नहीं किया, इसलिए सदस्य की शेयर राशि भी पहले जैसी कर दी गई। कारण ऊपर की सूचना में है।', 'The server did not accept its voucher, so the member\'s share amount was put back as well. The reason is in the message above.'), variant: 'destructive', duration: 12000 });
    });
  };
  const approveShareRefund = useCallback((memberId: string, amount: number, date: string, resolution: string): boolean => {
    if (guardFYLocked()) return false;
    const member = membersRef.current.find(m => m.id === memberId);
    if (!member) return false;
    if (guardPeriodLock(date)) return false;
    const payableId = shareRefundPayableAccountId(accounts);
    if (!payableId) { toastRef.current({ ...MISSING_HEAD_TOAST.shareRefund, variant: 'destructive', duration: 12000 }); return false; }
    const built = buildShareRefundApproval({ amount, shareCapital: member.shareCapital || 0, shareCapAccountId: ACCOUNT_IDS.SHARE_CAP, payableAccountId: payableId, resolution });
    if (built.ok === false) {
      if (built.error !== 'no_payable_head') toastRef.current({ title: tr('शेयर वापसी स्वीकृत नहीं हुई', 'Share refund not approved'), description: SHARE_REFUND_MESSAGE[built.error], variant: 'destructive', duration: 10000 });
      return false;
    }
    const v = addVoucher({
      type: 'journal', date, debitAccountId: ACCOUNT_IDS.SHARE_CAP, creditAccountId: payableId, amount: built.amount, lines: built.lines,
      narration: `Share refund approved for ${member.name} — resolution ${resolution.trim()} — ${date}`,
      refType: SHARE_REFUND_APPROVE_REF, refId: memberId, createdBy: userRef.current?.name ?? 'System', memberId,
    }, {
      onFailed: () => undoShareDeltas([{ memberId, deltaMinor: subMinor(0, toMinor(built.amount)) }], forward, { hi: 'शेयर वापसी', en: 'Share refund' }),   // MEM-04
    });
    let markForward: (ok: boolean) => void = () => {};
    const forward = new Promise<boolean>((res) => { markForward = res; });
    if (!v?.id) { markForward(false); return false; }   // addVoucher already told the user why
    const before = member;
    const updated = withShareCapital(member, toRupees(subMinor(toMinor(member.shareCapital || 0), toMinor(built.amount))));
    membersRef.current = membersRef.current.map(m => m.id === memberId ? updated : m);
    setMembersState(prev => prev.map(m => m.id === memberId ? updated : m));
    supabase.from('members').upsert(memberRow(updated)).then(({ error }) => {
      if (error) {
        reportCascade('Share refund approval member sync', error);
        membersRef.current = membersRef.current.map(m => m.id === memberId ? before : m);
        setMembersState(prev => prev.map(m => m.id === memberId ? before : m));   // RULE 1: roll back
        // The cascade path, not cancelVoucher: the rollback must not depend on this user's delete right
        // nor be refused by the share-debit guard there.
        cancelLinkedVouchers([v.id], 'Share refund approval not saved (cloud save failed)', userRef.current?.name ?? 'System', { rollback: true });
        toastRef.current({ title: tr('शेयर वापसी सेव नहीं हुई', 'Share refund not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. वाउचर रद्द कर दिया गया।`, `Not saved to the cloud — ${error.message}. The voucher was cancelled.`), variant: 'destructive', duration: 12000 });
      }
      markForward(!error);
    });
    emitAudit({ entityType: 'member', entityId: memberId, action: 'update', before: { shareCapital: before.shareCapital }, after: { shareCapital: updated.shareCapital }, reason: `share:refund-approved — ${resolution.trim()}` });
    toastRef.current({ title: tr('✅ शेयर वापसी स्वीकृत', '✅ Share refund approved'), description: tr(`${member.name} · ₹${built.amount.toLocaleString('en-IN')} देय दर्ज`, `${member.name} · ₹${built.amount.toLocaleString('en-IN')} recorded as payable`) });
    return true;
  }, [accounts, addVoucher]);

  const payShareRefund = useCallback((memberId: string, amount: number, mode: 'cash' | 'bank', date: string): boolean => {
    if (guardFYLocked()) return false;
    const member = membersRef.current.find(m => m.id === memberId);
    if (!member) return false;
    if (guardPeriodLock(date)) return false;
    const payableId = shareRefundPayableAccountId(accounts);
    if (!payableId) { toastRef.current({ ...MISSING_HEAD_TOAST.shareRefund, variant: 'destructive', duration: 12000 }); return false; }
    const cashBank = mode === 'bank' ? (defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK) : ACCOUNT_IDS.CASH;
    const built = buildShareRefundPayment({ amount, outstanding: shareRefundOutstanding(vouchersRef.current, memberId), payableAccountId: payableId, cashBankAccountId: cashBank });
    if (built.ok === false) {
      if (built.error !== 'no_payable_head') toastRef.current({ title: tr('शेयर वापसी का भुगतान नहीं हुआ', 'Share refund payment not made'), description: SHARE_REFUND_MESSAGE[built.error], variant: 'destructive', duration: 10000 });
      return false;
    }
    const v = addVoucher({
      type: 'payment', date, debitAccountId: payableId, creditAccountId: cashBank, amount: built.amount, lines: built.lines,
      narration: `Share refund paid to ${member.name} — ${date}`,
      refType: SHARE_REFUND_PAY_REF, refId: memberId, createdBy: userRef.current?.name ?? 'System', memberId,
    }, {
      // MEM-04: the payment IS its voucher (the outstanding is read from vouchers) — "paid" only once the server has it.
      onSaved: () => toastRef.current({ title: tr('✅ शेयर वापसी का भुगतान', '✅ Share refund paid'), description: `${member.name} · ₹${built.amount.toLocaleString('en-IN')}` }),
      onFailed: () => voucherRefusedToast(toastRef.current, tr('शेयर वापसी का भुगतान दर्ज नहीं हुआ', 'Share refund payment not recorded')),
    });
    if (!v?.id) return false;
    return true;
  }, [accounts, addVoucher]);

  // ECR-16 / MS-02: statutory share operations — bonus / forfeit / redeem / surrender.
  // Posts the SHARE_CAP voucher and moves member.shareCapital by the same amount so the
  // per-member ledger (getMemberLedger) and the scalar stay in lock-step. Mirrors the
  // refundShareCapital pattern (post voucher → adjust scalar → RULE 1 rollback on failure).
  const shareOperation = useCallback((memberId: string, type: ShareOpType, amount: number,
    opts?: { mode?: 'cash' | 'bank'; reserveAccountId?: string; date?: string; reason?: string }): boolean => {
    if (guardFYLocked()) return false;
    const member = membersRef.current.find(m => m.id === memberId);
    if (!member) return false;
    const amt = toRupees(toMinor(amount));
    const v = validateShareOp(type, amt, member.shareCapital || 0);
    if (!v.ok) { toastRef.current({ title: tr('अमान्य शेयर संचालन', 'Invalid share operation'), description: v.error, variant: 'destructive', duration: 9000 }); return false; }
    const date = opts?.date || new Date().toISOString().split('T')[0];
    if (guardPeriodLock(date)) return false;
    const payout = opts?.mode === 'bank' ? (defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK) : ACCOUNT_IDS.CASH;
    const reserve = opts?.reserveAccountId || '1201';
    const posting = shareOpPosting(type, { shareCap: ACCOUNT_IDS.SHARE_CAP, payout, reserve });
    const LABELS: Record<ShareOpType, string> = { bonus: 'Bonus shares issued to', forfeit: 'Shares forfeited from', redeem: 'Shares redeemed for', surrender: 'Shares surrendered by' };
    const voucher = addVoucher({
      type: posting.usesCash ? 'payment' : 'journal', date,
      debitAccountId: posting.debitAccountId, creditAccountId: posting.creditAccountId, amount: amt,
      narration: `${LABELS[type]} ${member.name}${opts?.reason ? ' — ' + opts.reason : ''}`,
      createdBy: userRef.current?.name ?? 'System', memberId,
    }, {
      onFailed: () => undoShareDeltas([{ memberId, deltaMinor: opDeltaMinor }], forward, { hi: 'शेयर संचालन', en: 'Share operation' }),   // MEM-04
    });
    let markForward: (ok: boolean) => void = () => {};
    const forward = new Promise<boolean>((res) => { markForward = res; });
    if (!voucher?.id) { markForward(false); return false; } // addVoucher blocked (FY-lock / period-lock / unbalanced)
    const before = member;
    const updated = withShareCapital(member, applyShareOp(type, member.shareCapital || 0, amt));
    const opDeltaMinor = subMinor(toMinor(updated.shareCapital || 0), toMinor(before.shareCapital || 0));
    membersRef.current = membersRef.current.map(m => m.id === memberId ? updated : m);
    setMembersState(prev => prev.map(m => m.id === memberId ? updated : m));
    supabase.from('members').upsert(memberRow(updated)).then(({ error }) => {
      if (error) {
        reportCascade('Share operation member sync', error);
        membersRef.current = membersRef.current.map(m => m.id === memberId ? before : m);
        setMembersState(prev => prev.map(m => m.id === memberId ? before : m));   // RULE 1: roll back
        cancelLinkedVouchers([voucher.id], `Share ${type} not saved (cloud save failed)`, userRef.current?.name ?? 'System', { rollback: true });
        toastRef.current({ title: tr('शेयर संचालन सेव नहीं हुआ', 'Share operation not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. वाउचर रद्द कर दिया गया।`, `Not saved to the cloud — ${error.message}. The voucher was cancelled.`), variant: 'destructive', duration: 12000 });
      }
      markForward(!error);
    });
    emitAudit({ entityType: 'member', entityId: memberId, action: 'update', before: { shareCapital: before.shareCapital }, after: { shareCapital: updated.shareCapital }, reason: `share:${type}${opts?.reason ? ' — ' + opts.reason : ''}` });
    toastRef.current({ title: tr('✅ शेयर संचालन दर्ज', '✅ Share operation recorded'), description: `${LABELS[type]} ${member.name} · ₹${amt.toLocaleString('en-IN')}`, variant: 'default' });
    return true;
  }, [accounts, addVoucher]);

  // Additional share purchase — a member buys MORE shares over time. Inverse of the
  // refund: posts a SEPARATE dated voucher Dr Cash-Bank / Cr Share Capital 1102
  // (memberId-tagged); the original join receipt stays intact so net 1102 =
  // issued + purchases = current holdings, matching the increased member.shareCapital.
  const purchaseShareCapital = useCallback((memberId: string, amount: number, mode: 'cash' | 'bank', date: string) => {
    if (guardFYLocked()) return;
    const member = membersRef.current.find(m => m.id === memberId);
    if (!member) return;
    const buy = toRupees(toMinor(Math.max(0, amount)));
    if (!(buy > 0)) { toastRef.current({ title: tr('राशि सही नहीं है', 'Amount is not valid'), description: tr('राशि 0 से अधिक होनी चाहिए। (Amount must be > 0.)', 'The amount must be more than 0. (Amount must be > 0.)'), variant: 'destructive' }); return; }
    // M3: shares are issued only to a live, approved member (never to a resigned / expelled / deceased one).
    if (!canHoldShares(member)) { toastRef.current({ title: tr('शेयर नहीं दिए जा सकते', 'Shares cannot be issued'), description: tr(`${member.name} सक्रिय/स्वीकृत सदस्य नहीं हैं (स्थिति: ${member.status}) — शेयर नहीं जोड़े जा सकते।`, `${member.name} is not an active/approved member (status: ${member.status}) — shares cannot be added.`), variant: 'destructive', duration: 10000 }); return; }
    const debitAcc = mode === 'bank' ? (defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK) : ACCOUNT_IDS.CASH;
    if (voucherBirthBlocked(date)) return;
    const voucher = addVoucher({
      type: 'receipt', date,
      debitAccountId: debitAcc, creditAccountId: ACCOUNT_IDS.SHARE_CAP, amount: buy,
      narration: `Additional share capital from ${member.name} — ${date}`,
      createdBy: user?.name ?? 'System', memberId,
    }, {
      onFailed: () => undoShareDeltas([{ memberId, deltaMinor: toMinor(buy) }], forward, { hi: 'अतिरिक्त शेयर', en: 'Additional shares' }),   // MEM-04
    });
    let markForward: (ok: boolean) => void = () => {};
    const forward = new Promise<boolean>((res) => { markForward = res; });
    if (!voucher?.id) { markForward(false); return; }   // D1: no voucher → the member's share capital must not move either
    const before = member;
    const updated = withShareCapital(member, toRupees(addMinor(toMinor(member.shareCapital || 0), toMinor(buy))));
    membersRef.current = membersRef.current.map(m => m.id === memberId ? updated : m);
    setMembersState(prev => prev.map(m => m.id === memberId ? updated : m));
    supabase.from('members').upsert(memberRow(updated)).then(({ error }) => {
      markForward(!error);
      if (error) {
        reportCascade('Share purchase member sync', error);
        membersRef.current = membersRef.current.map(m => m.id === memberId ? before : m);
        setMembersState(prev => prev.map(m => m.id === memberId ? before : m));   // RULE 1: roll back
        cancelLinkedVouchers([voucher.id], 'Share purchase not saved (cloud save failed)', userRef.current?.name ?? 'System', { rollback: true });
        toastRef.current({ title: tr('अतिरिक्त शेयर सेव नहीं हुए', 'Additional shares not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. वाउचर रद्द कर दिया गया।`, `Not saved to the cloud — ${error.message}. The voucher was cancelled.`), variant: 'destructive', duration: 12000 });
      } else {
        emitAudit({ entityType: 'member', entityId: memberId, action: 'update', before: { shareCapital: before.shareCapital || 0, shareCount: before.shareCount ?? null }, after: { shareCapital: updated.shareCapital, shareCount: updated.shareCount ?? null, voucherNo: voucher.voucherNo || voucher.id }, reason: `Additional share capital ₹${buy}` });
        toastRef.current({ title: tr('✅ अतिरिक्त शेयर पूँजी', '✅ Additional share capital'), description: `₹${buy.toLocaleString('en-IN')} · ${member.name}` });
      }
    });
  }, [accounts, addVoucher, user]);

  // Transfer shares from one member to another (sale/gift/nomination). Share capital total
  // is unchanged — it's a reclassification between members. Posted as two net-zero vouchers
  // bridged by the Suspense account (9999) so BOTH member sub-ledgers reflect the move
  // (each voucher carries a single memberId): the transferor gets Dr 1102 / Cr 9999, the
  // transferee gets Dr 9999 / Cr 1102. GL 1102 + 9999 both net to zero.
  const transferShareCapital = useCallback((fromMemberId: string, toMemberId: string, amount: number, date: string, premium = 0, opts?: { mode?: 'cash' | 'bank'; reserveAccountId?: string }) => {
    if (guardFYLocked()) return;
    if (fromMemberId === toMemberId) { toastRef.current({ title: tr('हस्तांतरण सही नहीं है', 'Transfer is not valid'), description: tr('पाने वाला सदस्य अलग चुनें। (Choose a different recipient.)', 'Choose a different recipient member.'), variant: 'destructive' }); return; }
    const from = membersRef.current.find(m => m.id === fromMemberId);
    const to = membersRef.current.find(m => m.id === toMemberId);
    if (!from || !to) return;
    // M3: the recipient must be a live, approved member.
    if (!canHoldShares(to)) { toastRef.current({ title: tr('हस्तांतरण नहीं हो सकता', 'Transfer not possible'), description: tr(`${to.name} सक्रिय/स्वीकृत सदस्य नहीं हैं (स्थिति: ${to.status}) — उन्हें शेयर हस्तांतरित नहीं हो सकते।`, `${to.name} is not an active/approved member (status: ${to.status}) — shares cannot be transferred to them.`), variant: 'destructive', duration: 10000 }); return; }
    const amt = toRupees(toMinor(Math.max(0, Math.min(amount, from.shareCapital || 0))));
    if (!(amt > 0)) { toastRef.current({ title: tr('राशि सही नहीं है', 'Amount is not valid'), description: tr('राशि 0 से अधिक और देने वाले सदस्य की अंश पूँजी से कम या बराबर हो। (Amount must be > 0 and ≤ the sender\'s share capital.)', 'The amount must be more than 0 and not more than the sender\'s share capital. (Amount must be > 0 and ≤ the sender\'s share capital.)'), variant: 'destructive' }); return; }
    // ECR-16 (MS-11): enforce the share-transfer premium cap (% of face value) BEFORE posting.
    const prem = toRupees(toMinor(Math.max(0, premium || 0)));
    const capPct = societyRef.current?.maxSharePremiumPercent ?? 0;
    if (!isSharePremiumAllowed(prem, amt, capPct)) {
      const cap = sharePremiumCap(amt, capPct);
      toastRef.current({
        title: tr('प्रीमियम सीमा से अधिक / Premium over cap', 'Premium over cap'),
        description: capPct > 0
          ? tr(`प्रीमियम ₹${prem.toLocaleString('en-IN')} अधिकतम ₹${cap.toLocaleString('en-IN')} (${capPct}% of ₹${amt.toLocaleString('en-IN')}) से ज़्यादा है।`, `Premium ₹${prem.toLocaleString('en-IN')} is more than the maximum ₹${cap.toLocaleString('en-IN')} (${capPct}% of ₹${amt.toLocaleString('en-IN')}).`)
          : tr('इस समिति में शेयर-ट्रांसफर प्रीमियम की अनुमति नहीं है (cap 0%)। पहले "Max transfer premium %" सेट करें।', 'Share-transfer premium is not allowed in this society (cap 0%). First set "Max transfer premium %".'),
        variant: 'destructive', duration: 10000,
      });
      return;
    }
    const SUSPENSE = '9999';
    // H: both halves carry refType 'share.transfer' + one transfer id, so cancelVoucher can refuse
    // a lone half (prod: a cancelled transferor half left Cr 1102 / Dr 9999 standing, inflating
    // share capital and suspense by the transfer amount).
    const transferId = crypto.randomUUID();
    // D1: ask every refusal first — the two halves (and the premium) must all post or none, and the scalars
    // below move only when they did.
    if (voucherBirthBlocked(date)) return;
    // MEM-04: any of the 2–3 vouchers refused LATE → both members' share capital moves back (after the forward saves
    // landed) and the transfer's other vouchers are unwound. Once, however many are refused.
    let markForward: (ok: boolean) => void = () => {};
    const forward = new Promise<boolean>((res) => { markForward = res; });
    let refusedOnce = false;
    const onRefused = () => {
      if (refusedOnce) return;
      refusedOnce = true;
      forward.then((ok) => {
        if (!ok) return;
        const live = [outHalf?.id, inHalf?.id, premiumId].filter((x): x is string => !!x && vouchersRef.current.some(v => v.id === x && !v.isDeleted));
        if (live.length) cancelLinkedVouchers(live, 'Share transfer voucher refused by the server (auto-unwind)', userRef.current?.name ?? 'System', { rollback: true });
      });
      undoShareDeltas([{ memberId: fromMemberId, deltaMinor: subMinor(0, toMinor(amt)) }, { memberId: toMemberId, deltaMinor: toMinor(amt) }], forward, { hi: 'शेयर स्थानांतरण', en: 'Share transfer' });
    };
    let premiumId: string | undefined;
    const outHalf = addVoucher({
      type: 'journal', date, debitAccountId: ACCOUNT_IDS.SHARE_CAP, creditAccountId: SUSPENSE, amount: amt,
      narration: `Shares transferred from ${from.name} to ${to.name} — ${date}`,
      createdBy: user?.name ?? 'System', memberId: fromMemberId, refType: 'share.transfer', refId: transferId,
    }, { onFailed: onRefused });
    if (!outHalf?.id) { markForward(false); return; }
    const inHalf = addVoucher({
      type: 'journal', date, debitAccountId: SUSPENSE, creditAccountId: ACCOUNT_IDS.SHARE_CAP, amount: amt,
      narration: `Shares transferred from ${from.name} to ${to.name} — ${date}`,
      createdBy: user?.name ?? 'System', memberId: toMemberId, refType: 'share.transfer', refId: transferId,
    }, { onFailed: onRefused });
    // Member-area stage A (H-3): a half-posted transfer is unwound here through the cascade path —
    // cancelVoucher refuses a lone transfer half, so asking the user to cancel it was a dead end.
    const unwind = (ids: string[], why: string) => cancelLinkedVouchers(ids, why, userRef.current?.name ?? 'System', { rollback: true });
    if (!inHalf?.id) {
      markForward(false);
      unwind([outHalf.id], 'Share transfer incomplete (second half not posted)');
      toastRef.current({ title: tr('शेयर स्थानांतरण नहीं हुआ', 'Share transfer failed'), description: tr(`दूसरा वाउचर नहीं बना, इसलिए पहला वाउचर (${outHalf.voucherNo || outHalf.id}) अपने-आप रद्द कर दिया गया। सदस्यों की शेयर राशि नहीं बदली — दोबारा करें।`, `The second voucher was not created, so the first voucher (${outHalf.voucherNo || outHalf.id}) was cancelled automatically. Members' share amounts did not change — please try again.`), variant: 'destructive', duration: 15000 });
      return;
    }
    // ECR-16 (MS-11): premium paid to the society → Dr Cash/Bank / Cr Reserve (capped above).
    if (prem > 0) {
      const payout = opts?.mode === 'bank' ? (defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK) : ACCOUNT_IDS.CASH;
      const premV = addVoucher({
        type: 'receipt', date, debitAccountId: payout, creditAccountId: opts?.reserveAccountId || '1201', amount: prem,
        narration: `Share transfer premium from ${to.name} (transfer from ${from.name}) — ${date}`,
        createdBy: user?.name ?? 'System', memberId: toMemberId,
      }, { onFailed: onRefused });
      if (!premV?.id) {
        markForward(false);
        unwind([outHalf.id, inHalf.id], 'Share transfer premium not posted');
        toastRef.current({ title: tr('शेयर स्थानांतरण नहीं हुआ', 'Share transfer failed'), description: tr('प्रीमियम का वाउचर नहीं बना, इसलिए दोनों ट्रांसफर वाउचर रद्द कर दिए गए। सदस्यों की शेयर राशि नहीं बदली — दोबारा करें।', 'The premium voucher was not created, so both transfer vouchers were cancelled. Members\' share amounts did not change — please try again.'), variant: 'destructive', duration: 15000 });
        return;
      }
      premiumId = premV.id;
    }
    const transferVoucherIds = [outHalf.id, inHalf.id, ...(premiumId ? [premiumId] : [])];
    const beforeFrom = from, beforeTo = to;
    const updFrom = withShareCapital(from, toRupees(subMinor(toMinor(from.shareCapital || 0), toMinor(amt))));
    const updTo = withShareCapital(to, toRupees(addMinor(toMinor(to.shareCapital || 0), toMinor(amt))));
    const applyBoth = (a: Member, b: Member) => {
      membersRef.current = membersRef.current.map(m => m.id === a.id ? a : m.id === b.id ? b : m);
      setMembersState(prev => prev.map(m => m.id === a.id ? a : m.id === b.id ? b : m));
    };
    applyBoth(updFrom, updTo);
    // RULE 1: scalars back, AND the vouchers cancelled — otherwise both halves stand while neither
    // member's share moved (and cancelVoucher refuses the halves).
    const rollback = () => {
      applyBoth(beforeFrom, beforeTo);
      unwind(transferVoucherIds, 'Share transfer not saved (cloud save failed)');
      toastRef.current({ title: tr('शेयर स्थानांतरण सेव नहीं हुआ', 'Share transfer not saved'), description: tr('क्लाउड में सेव नहीं हुआ — स्थानांतरण और उसके वाउचर वापस ले लिए गए। दोबारा करें।', 'Not saved to the cloud — the transfer and its vouchers were undone. Please try again.'), variant: 'destructive', duration: 12000 });
    };
    supabase.from('members').upsert(memberRow(updFrom)).then(({ error }) => {
      if (error) { reportCascade('Share transfer (from) sync', error); markForward(false); rollback(); return; }
      supabase.from('members').upsert(memberRow(updTo)).then(({ error: e2 }) => {
        if (e2) {
          reportCascade('Share transfer (to) sync', e2);
          // The transferor's row DID save — put it back in the cloud too.
          supabase.from('members').upsert(memberRow(beforeFrom)).then(({ error: e3 }) => {
            if (e3) {
              reportCascade('Share transfer (from) restore', e3);
              toastRef.current({ title: tr('ध्यान दें: देने वाले सदस्य की राशि', 'Note: the sender\'s amount'), description: tr(`${beforeFrom.name} की शेयर राशि cloud में ₹${updFrom.shareCapital} रह गई हो सकती है (होनी चाहिए ₹${beforeFrom.shareCapital || 0})। Refresh करके Share Register में जाँचें।`, `${beforeFrom.name}'s share amount in the cloud may still be ₹${updFrom.shareCapital} (it should be ₹${beforeFrom.shareCapital || 0}). Refresh and check in the Share Register.`), variant: 'destructive', duration: 15000 });
            }
          });
          markForward(false);
          rollback();
        }
        else {
          markForward(true);
          emitAudit({ entityType: 'member', entityId: fromMemberId, action: 'update', before: { shareCapital: beforeFrom.shareCapital || 0 }, after: { shareCapital: updFrom.shareCapital, transferredTo: to.memberId, transferId }, reason: `Shares transferred ₹${amt} to ${to.name}` });
          emitAudit({ entityType: 'member', entityId: toMemberId, action: 'update', before: { shareCapital: beforeTo.shareCapital || 0 }, after: { shareCapital: updTo.shareCapital, transferredFrom: from.memberId, transferId }, reason: `Shares received ₹${amt} from ${from.name}` });
          toastRef.current({ title: tr('✅ शेयर स्थानांतरित', '✅ Shares transferred'), description: tr(`₹${amt.toLocaleString('en-IN')} · ${from.name} → ${to.name}${prem > 0 ? ` (+ प्रीमियम ₹${prem.toLocaleString('en-IN')})` : ''}`, `₹${amt.toLocaleString('en-IN')} · ${from.name} → ${to.name}${prem > 0 ? ` (+ premium ₹${prem.toLocaleString('en-IN')})` : ''}`) });
        }
      });
    });
  }, [accounts, addVoucher, user]);

  // ══ Deposits module (Core for Credit/PACS) — SB / FD / RD / Pigmy ═══════════
  // A member deposit is a LIABILITY (society owes the member). Slice 1 wires SB
  // open/deposit/withdraw: each cash movement posts a voucher (Dr/Cr the 2107/2108
  // liability) and updates the account balance + the deposit sub-ledger.
  const nextDepositAccountNo = (type: DepositType): string => {
    const yy = (societyRef.current?.financialYear || '').split('-')[0] || new Date().toISOString().slice(0, 4);
    const n = depositAccountsRef.current.filter(d => d.depositType === type).length + 1;
    return `${type}/${yy}/${String(n).padStart(4, '0')}`;
  };

  // DEP-01 (audit 2026-11-17): a deposit movement is THREE writes — the voucher, the passbook line and the account's
  // balance. If any one fails, all three must go: a cash voucher left standing after "Transaction not saved" makes the
  // clerk pay the member a second time. One undo, run at most once, from whichever write failed first:
  //   • the server refuses the voucher (addVoucher onFailed — it already removed the voucher),
  //   • the passbook line does not save,
  //   • the account's balance does not save (the caller calls undo()).
  // It cancels the voucher (if it still stands), removes the passbook line (screen + cloud) and calls onUndone so
  // the caller restores the account as it was.
  const makeDepositUndo = (voucherNo: string, onUndone?: () => void) => {
    let done = false;
    let voucherId: string | undefined;
    let txnId: string | undefined;
    const undo = (why: 'voucher' | 'passbook' | 'balance', detail?: string) => {
      if (done) return;
      done = true;
      if (voucherId && why !== 'voucher') cancelLinkedVouchers([voucherId], `Deposit not saved (${why})`, 'System', { rollback: true });
      if (txnId) {
        const id = txnId;
        setDepositTransactionsState(prev => prev.filter(t => t.id !== id));
        supabase.from('deposit_transactions').delete().eq('id', id).then(({ error }) => {
          if (error) reportError('deposit-txn-undo', error.message, { id });
        }, () => {});
      }
      onUndone?.();
      const tail = detail ? ` (${detail})` : '';
      toastRef.current({
        title: tr('लेनदेन सेव नहीं हुआ — कुछ भी दर्ज नहीं हुआ', 'Transaction not saved — nothing was recorded'),
        description: tr(`वाउचर ${voucherNo || '—'} रद्द किया गया; पासबुक और शेष पहले जैसे हैं। सदस्य को भुगतान न करें / रकम न लें — कारण ठीक करके दोबारा दर्ज करें।${tail}`, `Voucher ${voucherNo || '—'} was cancelled; the passbook and balance are unchanged. Do not pay out or take the money — fix the cause and enter it again.${tail}`),
        variant: 'destructive', duration: 15000,
      });
    };
    return { undo, isDone: () => done, setIds: (v?: string, t?: string) => { voucherId = v; txnId = t; } };
  };

  // Post the cash voucher + sub-ledger transaction for a deposit movement. Returns the new balance and the undo
  // for the whole movement, or null if the voucher was blocked (FY/period lock / unbalanced). onUndone restores the
  // caller's account state when any part of the movement fails later.
  const postDepositLeg = (acct: DepositAccount, txnType: DepositTxnType, amount: number, mode: 'cash' | 'bank', date: string, onUndone?: () => void): { balance: number; undo: (why: 'balance', detail?: string) => void } | null => {
    // FD sits in 2108 only where that id really is Fixed Deposits (PACS); elsewhere it is another head or absent.
    const liability = resolveDepositLiabilityAccount(acct.depositType, accounts);
    if (!liability) { toastRef.current({ ...missingDepositHeadToast(acct.depositType), variant: 'destructive', duration: 12000 }); return null; }
    const cashBank = mode === 'bank' ? (defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK) : ACCOUNT_IDS.CASH;
    const posting = depositPosting(txnType, { liability, cashBank });
    const member = membersRef.current.find(m => m.id === acct.memberId);
    let pending: ReturnType<typeof makeDepositUndo> | null = null;
    let refusedEarly = false;
    const voucher = addVoucher({
      // A closure pays the balance out, exactly like a withdrawal — it is a payment voucher, not a receipt.
      type: depositVoucherType(txnType), date,
      debitAccountId: posting.debitAccountId, creditAccountId: posting.creditAccountId, amount,
      narration: `${acct.depositType} ${txnType} — ${acct.accountNo}${member ? ' · ' + member.name : ''}`,
      createdBy: userRef.current?.name ?? 'System', memberId: acct.memberId,
    }, { onFailed: () => { if (pending) pending.undo('voucher'); else refusedEarly = true; } });
    if (!voucher?.id || refusedEarly) return null;
    const leg = makeDepositUndo(voucher.voucherNo, onUndone);
    pending = leg;
    const balanceAfter = applyDepositTxn(acct.balance, txnType, amount);
    const txn: DepositTransaction = {
      id: crypto.randomUUID(), depositAccountId: acct.id, date, txnType, amount, mode,
      voucherId: voucher.id, balanceAfter, createdAt: new Date().toISOString(),
    };
    leg.setIds(voucher.id, txn.id);
    setDepositTransactionsState(prev => [...prev, txn]);
    // G4 / RULE 1 + DEP-01: a passbook line that does not save undoes the whole movement (voucher + balance too).
    supabase.from('deposit_transactions').upsert(withSoc(txn)).then(({ error }) => {
      if (error) {
        reportError('deposit-txn-save', error.message, { depositAccountId: acct.id, voucherId: voucher.id });
        leg.undo('passbook', error.message);
      } else if (leg.isDone()) {
        // undone while this save was in flight — the line must not outlive its voucher
        supabase.from('deposit_transactions').delete().eq('id', txn.id).then(() => {}, () => {});
      }
    });
    return { balance: balanceAfter, undo: leg.undo };
  };

  // Start a deposit movement and save the account's new state. If the balance save fails, the whole movement is
  // undone (voucher cancelled, passbook line removed). If the voucher or passbook line fails, the account goes back
  // to `before` — and when the new balance has already reached the cloud (or reaches it after the undo), `before`
  // is written back too, so the cloud never keeps a balance with no voucher behind it. Returns the new account, or
  // null when the movement could not start (voucher blocked).
  const commitDepositMovement = (
    before: DepositAccount,
    makeUpdated: (balance: number) => DepositAccount,
    startLeg: (onUndone: () => void) => { balance: number; undo: (why: 'balance', detail?: string) => void } | null,
    label: string,
  ): DepositAccount | null => {
    const id = before.id;
    let balanceSaved = false;
    let undone = false;
    let updatedBalance = before.balance;
    // DEP-03: the write-back is conditional too — only while the cloud still holds OUR new balance, so an undo never
    // overwrites a later movement made from another window.
    const writeBackBefore = () => supabase.from('deposit_accounts').update(withSoc(before)).eq('id', id).eq('balance', updatedBalance).then(({ error }) => { if (error) reportCascade(`${label} undo`, error); }, () => {});
    const leg = startLeg(() => {
      undone = true;
      depositAccountsRef.current = depositAccountsRef.current.map(d => d.id === id ? before : d);
      setDepositAccountsState(prev => prev.map(d => d.id === id ? before : d));   // RULE 1: roll back
      if (balanceSaved) writeBackBefore();
    });
    if (leg === null) return null;
    const updated = makeUpdated(leg.balance);
    updatedBalance = updated.balance;
    depositAccountsRef.current = depositAccountsRef.current.map(d => d.id === id ? updated : d);
    setDepositAccountsState(prev => prev.map(d => d.id === id ? updated : d));
    // DEP-03 (audit 2026-11-17): a whole-row upsert of the balance this screen READ let two windows both withdraw the
    // same ₹1,000 — the second write simply overwrote the first. The balance is now written only while the cloud still
    // holds the balance this movement started from (compare-and-set). No row matched ⇒ another movement got there
    // first ⇒ this whole movement is undone (voucher cancelled, passbook line removed) and the clerk is told to refresh.
    supabase.from('deposit_accounts').update(withSoc(updated)).eq('id', id).eq('balance', before.balance).select('id').then(({ data, error }) => {
      if (error) {
        reportCascade(label, error);
        leg.undo('balance', error.message);
      } else if (!data || data.length === 0) {
        reportError('deposit-balance-conflict', `${label}: balance changed elsewhere`, { depositAccountId: id });
        leg.undo('balance', tr('इस खाते में इसी बीच कहीं और से लेनदेन हुआ — शेष बदल चुका है। पेज refresh करके दोबारा करें', 'another transaction changed this account\'s balance in the meantime — refresh the page and enter it again'));
      } else {
        balanceSaved = true;
        if (undone) writeBackBefore();
      }
    });
    return updated;
  };

  const addDepositAccount = useCallback((data: Omit<DepositAccount, 'id' | 'accountNo' | 'balance' | 'status' | 'createdAt'> & { openingAmount?: number; mode?: 'cash' | 'bank' }): DepositAccount | null => {
    if (guardFYLocked()) return null;
    if (refuseNonLiveMember(data.memberId, tr('जमा खाता', 'Deposit account'))) return null;
    const { openingAmount = 0, mode = 'cash', ...rest } = data;
    // Refuse BEFORE creating anything when the chart has no liability head for this product — otherwise the account
    // would be created empty and every later deposit would fail, with a "जमा खाता खुला" toast on top of the error.
    if (!resolveDepositLiabilityAccount(data.depositType, accounts)) { toastRef.current({ ...missingDepositHeadToast(data.depositType), variant: 'destructive', duration: 12000 }); return null; }
    // A member has ONE compulsory deposit: a second open account would split the same monthly contribution.
    if (data.depositType === 'CD' && hasActiveCompulsoryDeposit(depositAccountsRef.current, data.memberId)) {
      toastRef.current({ title: tr('अनिवार्य जमा खाता पहले से है', 'Compulsory deposit account already exists'), description: tr('इस सदस्य का अनिवार्य जमा खाता पहले से चालू है — उसी में जमा करें। नया खाता नहीं खुला।', 'This member already has an open compulsory deposit account — post to that one. No new account was opened.'), variant: 'destructive', duration: 10000 });
      return null;
    }
    const acct: DepositAccount = {
      ...rest, id: crypto.randomUUID(), accountNo: nextDepositAccountNo(data.depositType),
      balance: 0, status: 'active', createdAt: new Date().toISOString(),
    };
    depositAccountsRef.current = [...depositAccountsRef.current, acct];
    setDepositAccountsState(prev => [...prev, acct]);
    let openUndone = false;
    const writeZero = () => {
      if (!depositAccountsRef.current.some(d => d.id === acct.id)) return;   // the account itself was rolled back
      const zero = { ...acct, balance: 0 };
      depositAccountsRef.current = depositAccountsRef.current.map(d => d.id === acct.id ? zero : d);
      setDepositAccountsState(prev => prev.map(d => d.id === acct.id ? zero : d));
      supabase.from('deposit_accounts').upsert(withSoc(zero)).then(({ error }) => { if (error) reportCascade('Deposit open undo', error); }, () => {});
    };
    const persist = (a: DepositAccount, undoLeg?: (why: 'balance', detail?: string) => void) => supabase.from('deposit_accounts').upsert(withSoc(a)).then(({ error }) => {
      if (!error && undoLeg && openUndone) writeZero();   // the opening deposit failed while this save was in flight
      if (error) {
        reportCascade('Deposit account sync', error);
        depositAccountsRef.current = depositAccountsRef.current.filter(d => d.id !== a.id);
        setDepositAccountsState(prev => prev.filter(d => d.id !== a.id));   // RULE 1: roll back
        toastRef.current({ title: tr('जमा खाता सेव नहीं हुआ', 'Deposit account not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}.`, `Not saved to the cloud — ${error.message}.`), variant: 'destructive', duration: 12000 });
        undoLeg?.('balance', error.message);   // DEP-01: the opening deposit's voucher + passbook line go too
      }
    });
    // Opening deposit (if any) posts a voucher + first transaction, then re-persist with the balance.
    const opening = toRupees(toMinor(Math.max(0, openingAmount)));
    if (opening > 0) {
      // If the opening deposit fails later, the account stays open with a zero balance (only if it still exists).
      const leg = postDepositLeg(acct, 'open', opening, mode, acct.openDate, () => { openUndone = true; writeZero(); });
      if (leg !== null) {
        const newBal = leg.balance;
        const withBal = { ...acct, balance: newBal };
        depositAccountsRef.current = depositAccountsRef.current.map(d => d.id === acct.id ? withBal : d);
        setDepositAccountsState(prev => prev.map(d => d.id === acct.id ? withBal : d));
        persist(withBal, leg.undo);
        emitAudit({ entityType: 'deposit', entityId: acct.id, action: 'create', after: { accountNo: acct.accountNo, type: acct.depositType, opening } });
        toastRef.current({ title: tr('✅ जमा खाता खुला', '✅ Deposit account opened'), description: `${acct.accountNo} · ₹${opening.toLocaleString('en-IN')}` });
        return withBal;
      }
    }
    persist(acct);
    emitAudit({ entityType: 'deposit', entityId: acct.id, action: 'create', after: { accountNo: acct.accountNo, type: acct.depositType } });
    toastRef.current({ title: tr('✅ जमा खाता खुला', '✅ Deposit account opened'), description: acct.accountNo });
    return acct;
  }, [accounts, addVoucher]);

  const postDepositTransaction = useCallback((accountId: string, txnType: 'deposit' | 'withdraw', amount: number, mode: 'cash' | 'bank', date: string): boolean => {
    if (guardFYLocked()) return false;
    const acct = depositAccountsRef.current.find(d => d.id === accountId);
    if (!acct) return false;
    if (acct.status !== 'active') { toastRef.current({ title: tr('खाता सक्रिय नहीं', 'Account not active'), description: 'Only active deposit accounts can transact.', variant: 'destructive' }); return false; }
    const amt = toRupees(toMinor(amount));
    const v = validateDepositTxn(txnType, amt, acct.balance, acct.depositType, societyRef.current?.compulsoryDepositWithdrawal === true);
    if (!v.ok) { toastRef.current({ title: tr('अमान्य लेनदेन', 'Invalid transaction'), description: v.error, variant: 'destructive', duration: 9000 }); return false; }
    const before = acct;
    const updated = commitDepositMovement(before, bal => ({ ...acct, balance: bal }),
      onUndone => postDepositLeg(acct, txnType, amt, mode, date, onUndone), 'Deposit txn balance sync');
    if (!updated) return false; // voucher blocked
    const newBal = updated.balance;
    emitAudit({ entityType: 'deposit', entityId: accountId, action: 'update', before: { balance: before.balance }, after: { balance: newBal, txn: txnType, amount: amt } });
    toastRef.current({ title: txnType === 'deposit' ? tr('✅ जमा', '✅ Deposit') : tr('✅ निकासी', '✅ Withdrawal'), description: tr(`${acct.accountNo} · ₹${amt.toLocaleString('en-IN')} · शेष ₹${newBal.toLocaleString('en-IN')}`, `${acct.accountNo} · ₹${amt.toLocaleString('en-IN')} · balance ₹${newBal.toLocaleString('en-IN')}`) });
    return true;
  }, [accounts, addVoucher]);

  // Credit interest to a deposit account: Dr Interest-on-Deposits expense (5604 Interest on
  // Borrowings — member deposits are borrowings from members) / Cr the deposit liability.
  // Not a cash movement — it increases the member's balance.
  const postDepositInterest = useCallback((accountId: string, amount: number, date: string): boolean => {
    if (guardFYLocked()) return false;
    const acct = depositAccountsRef.current.find(d => d.id === accountId);
    if (!acct) return false;
    if (acct.status !== 'active') { toastRef.current({ title: tr('खाता सक्रिय नहीं', 'Account not active'), description: 'Only active deposit accounts can accrue interest.', variant: 'destructive' }); return false; }
    const amt = toRupees(toMinor(amount));
    if (!(amt > 0)) { toastRef.current({ title: tr('अमान्य राशि', 'Invalid amount'), description: 'Interest must be greater than 0.', variant: 'destructive' }); return false; }
    const liability = resolveDepositLiabilityAccount(acct.depositType, accounts);
    if (!liability) { toastRef.current({ ...missingDepositHeadToast(acct.depositType), variant: 'destructive', duration: 12000 }); return false; }
    const member = membersRef.current.find(m => m.id === acct.memberId);
    const before = acct;
    // Same three writes as postDepositLeg (voucher, passbook line, balance) — one undo for all (DEP-01).
    const startInterestLeg = (onUndone: () => void) => {
      let pending: ReturnType<typeof makeDepositUndo> | null = null;
      let refusedEarly = false;
      const voucher = addVoucher({
        type: 'journal', date, debitAccountId: '5604', creditAccountId: liability, amount: amt,
        narration: `Interest on ${acct.depositType} deposit ${acct.accountNo}${member ? ' · ' + member.name : ''}`,
        createdBy: userRef.current?.name ?? 'System', memberId: acct.memberId,
      }, { onFailed: () => { if (pending) pending.undo('voucher'); else refusedEarly = true; } });
      if (!voucher?.id || refusedEarly) return null;
      const leg = makeDepositUndo(voucher.voucherNo, onUndone);
      pending = leg;
      const balanceAfter = applyDepositTxn(acct.balance, 'interest', amt);
      const txn: DepositTransaction = {
        id: crypto.randomUUID(), depositAccountId: accountId, date, txnType: 'interest', amount: amt, mode: 'cash',
        voucherId: voucher.id, balanceAfter, createdAt: new Date().toISOString(),
      };
      leg.setIds(voucher.id, txn.id);
      setDepositTransactionsState(prev => [...prev, txn]);
      supabase.from('deposit_transactions').upsert(withSoc(txn)).then(({ error }) => {
        if (error) {
          reportError('deposit-txn-save', error.message, { depositAccountId: accountId, voucherId: voucher.id });
          leg.undo('passbook', error.message);
        } else if (leg.isDone()) {
          supabase.from('deposit_transactions').delete().eq('id', txn.id).then(() => {}, () => {});
        }
      });
      return { balance: balanceAfter, undo: leg.undo };
    };
    const updated = commitDepositMovement(before, bal => ({ ...acct, balance: bal }), startInterestLeg, 'Deposit interest balance sync');
    if (!updated) return false;
    const newBal = updated.balance;
    emitAudit({ entityType: 'deposit', entityId: accountId, action: 'update', before: { balance: before.balance }, after: { balance: newBal, interest: amt } });
    toastRef.current({ title: tr('✅ ब्याज जमा', '✅ Interest credited'), description: tr(`${acct.accountNo} · ₹${amt.toLocaleString('en-IN')} · शेष ₹${newBal.toLocaleString('en-IN')}`, `${acct.accountNo} · ₹${amt.toLocaleString('en-IN')} · balance ₹${newBal.toLocaleString('en-IN')}`) });
    return true;
  }, [addVoucher]);

  // Mature / close a deposit account: pay out the full balance (Dr liability / Cr Cash-Bank)
  // and mark it matured (FD/RD) or closed (SB/Pigmy). A zero-balance account just closes.
  const closeDepositAccount = useCallback((accountId: string, mode: 'cash' | 'bank', date: string): boolean => {
    if (guardFYLocked()) return false;
    const acct = depositAccountsRef.current.find(d => d.id === accountId);
    if (!acct) return false;
    if (acct.status !== 'active') { toastRef.current({ title: tr('खाता पहले से बंद', 'Account already closed'), description: 'Account is not active.', variant: 'destructive' }); return false; }
    const before = acct;
    const newStatus: DepositAccount['status'] = (acct.depositType === 'FD' || acct.depositType === 'RD') ? 'matured' : 'closed';
    // A balance is paid out through the same three-write movement (DEP-01); a zero-balance account only changes status.
    const startCloseLeg = (onUndone: () => void) => acct.balance > 0
      ? postDepositLeg(acct, 'closure', acct.balance, mode, date, onUndone)
      : {
          balance: acct.balance,
          undo: (_why: 'balance', detail?: string) => {
            onUndone();
            toastRef.current({ title: tr('बंद करना सेव नहीं हुआ', 'Closing not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${detail ?? ''}.`, `Not saved to the cloud — ${detail ?? ''}.`), variant: 'destructive', duration: 12000 });
          },
        };
    const updated = commitDepositMovement(before, bal => ({ ...acct, balance: bal, status: newStatus }), startCloseLeg, 'Deposit close sync');
    if (!updated) return false; // payout voucher blocked (FY/period lock)
    const newBal = updated.balance;
    emitAudit({ entityType: 'deposit', entityId: accountId, action: 'update', before: { status: before.status, balance: before.balance }, after: { status: newStatus, balance: newBal } });
    toastRef.current({ title: newStatus === 'matured' ? tr('✅ जमा परिपक्व', '✅ Deposit matured') : tr('✅ जमा खाता बंद', '✅ Deposit account closed'), description: tr(`${acct.accountNo}${acct.balance > 0 ? ` · भुगतान ₹${acct.balance.toLocaleString('en-IN')}` : ''}`, `${acct.accountNo}${acct.balance > 0 ? ` · payment ₹${acct.balance.toLocaleString('en-IN')}` : ''}`) });
    return true;
  }, [accounts, addVoucher]);

  const getDepositTransactions = useCallback((accountId: string): DepositTransaction[] =>
    depositTransactions.filter(t => t.depositAccountId === accountId)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
    [depositTransactions]);

  // ECR-13: mark a compliance calendar item as filed (idempotent) / unmark it.
  const markComplianceFiled = useCallback((itemId: string, note?: string): void => {
    if (guardFYLocked()) return;   // RULE 6
    if (complianceFilingsRef.current.some(f => f.itemId === itemId)) return;
    const filing: ComplianceFiling = { id: crypto.randomUUID(), itemId, filedAt: new Date().toISOString().split('T')[0], filedBy: userRef.current?.name, note };
    complianceFilingsRef.current = [...complianceFilingsRef.current, filing];
    setComplianceFilingsState(prev => [...prev, filing]);
    supabase.from('compliance_filings').upsert(withSoc(filing)).then(({ error }) => {
      if (error) {
        console.error('Compliance filing sync:', error.message);
        complianceFilingsRef.current = complianceFilingsRef.current.filter(f => f.id !== filing.id);
        setComplianceFilingsState(prev => prev.filter(f => f.id !== filing.id));   // RULE 1: roll back
        toastRef.current({ title: tr('सेव नहीं हुआ', 'Not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}.`, `Not saved to the cloud — ${error.message}.`), variant: 'destructive', duration: 10000 });
      }
    });
    emitAudit({ entityType: 'compliance', entityId: itemId, action: 'update', after: { filed: true } });
  }, [guardFYLocked]);
  const unmarkComplianceFiled = useCallback((itemId: string): void => {
    if (guardFYLocked()) return;   // RULE 6
    const filing = complianceFilingsRef.current.find(f => f.itemId === itemId);
    if (!filing) return;
    complianceFilingsRef.current = complianceFilingsRef.current.filter(f => f.itemId !== itemId);
    setComplianceFilingsState(prev => prev.filter(f => f.itemId !== itemId));
    // RLS lets only jwt_can_delete() roles delete, and a refused delete removes 0 rows WITHOUT an error — so
    // check the returned rows too. On failure restore the filing locally (RULE 1): the server still has it,
    // and the reminder emails (migration 145) keep treating the item as filed.
    supabase.from('compliance_filings').delete().eq('id', filing.id).select('id').then(({ data, error }) => {
      if (!error && (data?.length ?? 0) > 0) return;
      const msg = error?.message ?? 'no row deleted (permission)';
      console.warn('Compliance filing delete:', msg);
      reportError('write-partial', msg, { at: 'Compliance filing delete:' });
      complianceFilingsRef.current = [...complianceFilingsRef.current.filter(f => f.id !== filing.id), filing];
      setComplianceFilingsState(prev => [...prev.filter(f => f.id !== filing.id), filing]);
      toastRef.current({ title: tr('हटाया नहीं गया', 'Not removed'), description: tr(`"फाइल हुआ" निशान क्लाउड से नहीं हटा — ${error ? error.message : 'आपकी भूमिका में हटाने की अनुमति नहीं है'}। (Could not undo "filed".)`, `The "filed" mark was not removed from the cloud — ${error ? error.message : 'your role is not allowed to remove it'}. (Could not undo "filed".)`), variant: 'destructive', duration: 10000 });
    });
    emitAudit({ entityType: 'compliance', entityId: itemId, action: 'update', after: { filed: false } });
  }, [guardFYLocked]);
  const getComplianceFiledIds = useCallback((): string[] => complianceFilings.map(f => f.itemId), [complianceFilings]);

  // ── Housing Flats/Units register (master data; Member-pattern persistence + RULE-1 rollback) ──
  // ── Labour Work Orders register (master data; Member-pattern persistence + RULE-1 rollback) ──
  const addWorkOrder = useCallback((data: Omit<WorkOrder, 'id' | 'createdAt'>): WorkOrder => {
    if (guardFYLocked()) return { ...data, id: '', createdAt: '' } as WorkOrder;
    const wo: WorkOrder = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setWorkOrdersState(prev => { const u = [...prev, wo]; storage.setWorkOrders(u); return u; });
    supabase.from('work_orders').upsert(withSoc(wo)).then(({ error }) => {
      if (error) {
        console.error('Work order save error:', error.message);
        setWorkOrdersState(prev => { const r = prev.filter(w => w.id !== wo.id); storage.setWorkOrders(r); return r; });
        toastRef.current({ title: tr('कार्य आदेश सेव नहीं हुआ', 'Work order not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा; दोबारा जोड़ें।`, `Not saved to the cloud — ${error.message}. Nothing will go wrong on Refresh; add it again.`), variant: 'destructive', duration: 12000 });
      }
    });
    return wo;
  }, []);

  const updateWorkOrder = useCallback((id: string, data: Partial<WorkOrder>) => {
    if (guardFYLocked()) return;
    const old = workOrders.find(w => w.id === id);
    if (!old) return;
    const updated = { ...old, ...data };
    setWorkOrdersState(prev => { const u = prev.map(w => w.id === id ? updated : w); storage.setWorkOrders(u); return u; });
    patchRow('work_orders', id, old, updated).then(({ error }) => {
      if (error) {
        console.error('Work order update error:', error.message);
        setWorkOrdersState(prev => { const u = prev.map(w => w.id === id ? old : w); storage.setWorkOrders(u); return u; });
        toastRef.current({ title: tr('अपडेट सेव नहीं हुआ', 'Update not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
      }
    });
  }, [workOrders]);

  const deleteWorkOrder = useCallback((id: string) => {
    if (guardPermission('delete', tr('वर्क ऑर्डर मिटाने', 'delete work orders'))) return;   // ECR-06: role gate
    if (guardFYLocked()) return;
    const old = workOrders.find(w => w.id === id);
    setWorkOrdersState(prev => { const u = prev.filter(w => w.id !== id); storage.setWorkOrders(u); return u; });
    supabase.from('work_orders').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Work order delete error:', error.message);
        if (old) setWorkOrdersState(prev => { const u = [...prev, old]; storage.setWorkOrders(u); return u; });
        toastRef.current({ title: tr('डिलीट सेव नहीं हुआ', 'Delete not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
      }
    });
  }, [workOrders]);

  // ── Labour Muster Roll (attendance register) — AUTO-ACCRUAL ──────────────────
  // Per Indian Cooperative (mercantile) accounting, wages are an expense + liability
  // the moment they are earned. So every attendance line auto-posts a journal
  // Dr 5202 Wages / Cr 2109 Wages Payable (origin:'auto'); the operator never sees an
  // accrual step. Edit re-accrues (supersede old voucher on success); delete reverses
  // it; Pay Wages later clears 2109. No double-count (payWages debits 2109 for accrued).
  const postWageAccrual = useCallback((entry: MusterEntry): Voucher => {
    const wage = (entry.daysWorked || 0) * (entry.dailyWage || 0);
    if (!(wage > 0)) return { id: '' } as Voucher;
    const wo = workOrders.find(w => w.id === entry.workOrderId);
    const lid = () => crypto.randomUUID();
    return addVoucher({
      type: 'journal', date: `${entry.period}-15`,
      debitAccountId: '5202', creditAccountId: '2109', amount: wage,
      narration: `मज़दूरी देयता (स्वतः) — ${wo?.workOrderNo || entry.workOrderId} · ${entry.period}`,
      refType: 'wage.accrual', refId: entry.id, origin: 'auto',
      createdBy: user?.name || 'System',
      lines: [
        { id: lid(), accountId: '5202', type: 'Dr', amount: wage },
        { id: lid(), accountId: '2109', type: 'Cr', amount: wage },
      ],
    } as Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>);
  }, [workOrders, addVoucher, user]);

  const addMusterEntry = useCallback((data: Omit<MusterEntry, 'id' | 'createdAt'>): MusterEntry => {
    if (guardFYLocked()) return { ...data, id: '', createdAt: '' } as MusterEntry;
    const id = crypto.randomUUID();
    const wage = (data.daysWorked || 0) * (data.dailyWage || 0);
    // Auto-accrual first — if it fails (unbalanced/FY), don't create the entry.
    const av = wage > 0 ? postWageAccrual({ ...data, id, createdAt: '' } as MusterEntry) : ({ id: '' } as Voucher);
    if (wage > 0 && !av.id) return { ...data, id: '', createdAt: '' } as MusterEntry;
    const m: MusterEntry = { ...data, id, accrued: wage > 0, accrualVoucherId: av.id || undefined, createdAt: new Date().toISOString() };
    setMusterEntriesState(prev => { const u = [...prev, m]; storage.setMusterEntries(u); return u; });
    supabase.from('muster_entries').upsert(withSoc(m)).then(({ error }) => {
      if (error) {
        console.error('Muster entry save error:', error.message);
        setMusterEntriesState(prev => { const r = prev.filter(x => x.id !== m.id); storage.setMusterEntries(r); return r; });
        if (av.id) cancelVoucher(av.id, 'Muster entry rolled back (save failed)', user?.name || 'System', { viaParent: true, rollback: true });
        toastRef.current({ title: tr('हाज़िरी सेव नहीं हुई', 'Attendance not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा; दोबारा जोड़ें।`, `Not saved to the cloud — ${error.message}. Nothing will go wrong on Refresh; add it again.`), variant: 'destructive', duration: 12000 });
      }
    });
    return m;
  }, [postWageAccrual, cancelVoucher, user]);

  const updateMusterEntry = useCallback((id: string, data: Partial<MusterEntry>) => {
    if (guardFYLocked()) return;
    const old = musterEntries.find(x => x.id === id);
    if (!old) return;
    if (old.paid || (old.paidAmount || 0) > 0) { toastRef.current({ title: tr('भुगतान हो चुका', 'Already paid'), description: tr('जिस entry की कुछ/पूरी मज़दूरी चुक चुकी है, उसे संपादित नहीं किया जा सकता। पहले भुगतान voucher रद्द करें।', 'An entry whose wages have been partly or fully paid cannot be edited. Cancel the payment voucher first.'), variant: 'destructive', duration: 9000 }); return; }
    const updated: MusterEntry = { ...old, ...data };
    const oldWage = (old.daysWorked || 0) * (old.dailyWage || 0);
    const newWage = (updated.daysWorked || 0) * (updated.dailyWage || 0);
    const wageChanged = newWage !== oldWage;
    // X-4 follow-up: superseding the old accrual is a CANCEL of an older voucher (often another day's / user's), which
    // needs a delete role on the server. Ask before anything is posted — otherwise an accountant's edit left BOTH the
    // old and the new accrual live (wage expense counted twice).
    if (wageChanged && old.accrualVoucherId && guardPermission('delete', tr('accrual वाली मस्टर एंट्री की मज़दूरी बदलने', 'change the wage of an accrued muster entry'))) return;
    // If the wage amount changed, post a fresh accrual now; the old one is superseded
    // (cancelled) only after the entry update persists, so a failure leaves old intact.
    const newAv = wageChanged && newWage > 0 ? postWageAccrual(updated) : ({ id: '' } as Voucher);
    if (wageChanged && newWage > 0 && !newAv.id) return; // accrual failed → abort edit
    const next: MusterEntry = wageChanged
      ? { ...updated, accrued: newWage > 0, accrualVoucherId: newAv.id || undefined }
      : updated;
    setMusterEntriesState(prev => { const u = prev.map(x => x.id === id ? next : x); storage.setMusterEntries(u); return u; });
    patchRow('muster_entries', id, old, next).then(({ error }) => {
      if (error) {
        console.error('Muster entry update error:', error.message);
        setMusterEntriesState(prev => { const u = prev.map(x => x.id === id ? old : x); storage.setMusterEntries(u); return u; });
        if (newAv.id) cancelVoucher(newAv.id, 'Muster edit rolled back (save failed)', user?.name || 'System', { viaParent: true, rollback: true });
        toastRef.current({ title: tr('अपडेट सेव नहीं हुआ', 'Update not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
      } else if (wageChanged && old.accrualVoucherId) {
        cancelVoucher(old.accrualVoucherId, 'Wage accrual superseded (muster edited)', user?.name || 'System', {
          viaParent: true,
          onFailed: (msg) => toastRef.current({ title: tr('⚠ पुराना accrual रद्द नहीं हुआ', '⚠ Old accrual not cancelled'), description: tr(`मस्टर बदल गया, पर पुराना मज़दूरी-accrual वाउचर क्लाउड पर रद्द नहीं हुआ (${msg}) — मज़दूरी दो बार गिनी जा रही है। Vouchers से उसे रद्द करें।`, `The muster changed, but the old wage-accrual voucher was not cancelled on the cloud (${msg}) — the wage is counted twice. Cancel it from Vouchers.`), variant: 'destructive', duration: 15000 }),
        });
      }
    });
  }, [musterEntries, postWageAccrual, cancelVoucher, guardPermission, user]);

  const deleteMusterEntry = useCallback((id: string) => {
    if (guardPermission('delete', tr('मस्टर एंट्री मिटाने', 'delete muster entries'))) return;   // ECR-06: role gate
    if (guardFYLocked()) return;
    const old = musterEntries.find(x => x.id === id);
    if (old?.paid || (old?.paidAmount || 0) > 0) { toastRef.current({ title: tr('भुगतान हो चुका', 'Already paid'), description: tr('जिस entry की कुछ/पूरी मज़दूरी चुक चुकी है, उसे हटाया नहीं जा सकता। पहले भुगतान voucher रद्द करें।', 'An entry whose wages have been partly or fully paid cannot be deleted. Cancel the payment voucher first.'), variant: 'destructive', duration: 9000 }); return; }
    setMusterEntriesState(prev => { const u = prev.filter(x => x.id !== id); storage.setMusterEntries(u); return u; });
    supabase.from('muster_entries').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Muster entry delete error:', error.message);
        if (old) setMusterEntriesState(prev => { const u = [...prev, old]; storage.setMusterEntries(u); return u; });
        toastRef.current({ title: tr('डिलीट सेव नहीं हुआ', 'Delete not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
      } else if (old?.accrualVoucherId) {
        cancelVoucher(old.accrualVoucherId, 'Wage accrual reversed (muster deleted)', user?.name || 'System');
      }
    });
  }, [musterEntries, cancelVoucher, user]);

  // ── Labour Wage Payment — partial-capable (per-labourer + instalment) ────────
  // Pays a set of allocations {entryId, amount}; each amount ≤ that entry's outstanding
  // (wage − paidAmount). Split Dr (no double-count): the part paid against accrued
  // entries → Dr 2109 Wages Payable; against non-accrued → Dr 5202 Wages. Cr Cash-Bank.
  // Each entry's paidAmount increments; paid=true only when fully settled.
  // RULE-1: on entry-mark persist failure, cancel the voucher + roll back. RULE-6: FY guard.
  const payWages = useCallback((data: { workOrderId: string; period: string; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; reference?: string; remarks?: string; allocations: { entryId: string; amount: number }[] }): Voucher => {
    const sentinel = { id: '', voucherNo: '', type: 'payment', date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    if (guardFYLocked()) return sentinel;
    const wageOf = (m: MusterEntry) => (m.daysWorked || 0) * (m.dailyWage || 0);
    const outstandingOf = (m: MusterEntry) => toRupees(subMinor(toMinor(wageOf(m)), toMinor(m.paidAmount || 0)));
    // Resolve + validate allocations against live entries.
    const allocs = (data.allocations || [])
      .map(a => ({ entry: musterEntries.find(m => m.id === a.entryId && !m.isDeleted && !m.paid), amount: toRupees(toMinor(+a.amount)) }))
      .filter((a): a is { entry: MusterEntry; amount: number } => !!a.entry && a.amount > 0);
    if (allocs.length === 0) { toastRef.current({ title: tr('कोई श्रमिक/राशि चुनी नहीं', 'No worker/amount selected'), description: tr('कम-से-कम एक श्रमिक की भुगतान-राशि चुनें।', 'Choose a payment amount for at least one worker.'), variant: 'destructive', duration: 8000 }); return sentinel; }
    const over = allocs.find(a => a.amount > outstandingOf(a.entry) + 0.005);
    if (over) { toastRef.current({ title: tr('राशि बकाया से अधिक', 'Amount more than outstanding'), description: tr(`एक श्रमिक की भुगतान-राशि उसकी बकाया मज़दूरी ₹${outstandingOf(over.entry)} से अधिक नहीं हो सकती।`, `A worker's payment cannot be more than their outstanding wages of ₹${outstandingOf(over.entry)}.`), variant: 'destructive', duration: 9000 }); return sentinel; }
    const total = toRupees(sumMinor(allocs.map(a => toMinor(a.amount))));
    const accruedPortion = toRupees(sumMinor(allocs.filter(a => a.entry.accrued).map(a => toMinor(a.amount))));
    const directPortion = toRupees(subMinor(toMinor(total), toMinor(accruedPortion)));
    const wo = workOrders.find(w => w.id === data.workOrderId);
    const creditAcc = data.mode === 'cash' ? ACCOUNT_IDS.CASH : (data.bankAccountId || defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK);
    const lid = () => crypto.randomUUID();
    const ref = data.reference?.trim() ? ` · Ref ${data.reference.trim()}` : '';
    const rem = data.remarks?.trim() ? ` · ${data.remarks.trim()}` : '';
    // X-5: one Dr line per worker, tagged with its muster entry, so a cancel of this payment can give each worker's
    // amount back (the muster follower). Same accounts and totals as before (2109 accrued / 5202 direct).
    const lines: VoucherLine[] = [
      ...allocs.map(a => ({ id: lid(), accountId: a.entry.accrued ? '2109' : '5202', type: 'Dr' as const, amount: a.amount, musterEntryId: a.entry.id })),
      { id: lid(), accountId: creditAcc, type: 'Cr' as const, amount: total },
    ];
    const voucher = addVoucher({
      type: 'payment', date: data.date,
      debitAccountId: accruedPortion > 0 ? '2109' : '5202', creditAccountId: creditAcc, amount: total,
      narration: `मज़दूरी भुगतान — ${wo?.workOrderNo || data.workOrderId} · ${data.period} · ${allocs.length} श्रमिक${ref}${rem}`,
      refType: 'wage.payment', refId: data.workOrderId,
      createdBy: user?.name || 'System',
      lines,
    });
    if (!voucher.id) return sentinel;
    const amtById = new Map(allocs.map(a => [a.entry.id, a.amount]));
    const applyPay = (m: MusterEntry): MusterEntry => {
      const add = amtById.get(m.id); if (add == null) return m;
      const newPaid = toRupees(addMinor(toMinor(m.paidAmount || 0), toMinor(add)));
      return { ...m, paidAmount: newPaid, paid: newPaid >= wageOf(m) - 0.005, paymentVoucherId: voucher.id };
    };
    const snapshot = new Map(allocs.map(a => [a.entry.id, a.entry]));   // for rollback
    setMusterEntriesState(prev => { const u = prev.map(applyPay); storage.setMusterEntries(u); return u; });
    const updatedRows = allocs.map(a => applyPay(a.entry));
    supabase.from('muster_entries').upsert(updatedRows.map(m => withSoc(m))).then(({ error }) => {
      if (error) {
        console.error('Wage payment muster-mark error:', error.message);
        setMusterEntriesState(prev => { const u = prev.map(m => snapshot.get(m.id) ?? m); storage.setMusterEntries(u); return u; });
        cancelVoucher(voucher.id, 'Wage payment rolled back (muster mark failed)', user?.name || 'System', { viaParent: true, rollback: true });
        toastRef.current({ title: tr('मज़दूरी भुगतान सेव नहीं हुआ', 'Wage payment not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. भुगतान वापस ले लिया गया; दोबारा करें।`, `Not saved to the cloud — ${error.message}. The payment was undone; please try again.`), variant: 'destructive', duration: 12000 });
      }
    });
    toastRef.current({ title: tr('मज़दूरी भुगतान दर्ज हुआ', 'Wage payment recorded'), description: tr(`${wo?.workOrderNo || ''} · ${data.period} · ${allocs.length} श्रमिक · ₹${total}`, `${wo?.workOrderNo || ''} · ${data.period} · ${allocs.length} workers · ₹${total}`), duration: 6000 });
    return voucher;
  }, [musterEntries, workOrders, accounts, addVoucher, cancelVoucher, user]);

  const approveMember = useCallback((id: string, decision?: AdmissionDecision) => {
    if (guardFYLocked()) return;   // RULE 6
    const member = membersRef.current.find(m => m.id === id);
    if (!member) return;
    const today = new Date().toISOString().split('T')[0];
    const admissionDate = decision?.admissionDate || today;
    // M2: r.22(b) — the register's date of entry is the admission date, so joinDate follows it (and the joining
    // receipt is dated then); the application date is kept separately.
    const approved: Member = {
      ...member, approvalStatus: 'approved' as const, joinDate: admissionDate,
      applicationDate: applicationReceivedOn(member), admissionDate, decidedAt: today,
      admissionResolutionNo: decision?.resolutionNo?.trim() || undefined, admissionResolutionDate: decision?.resolutionDate || undefined,
    };
    setMembersState(prev => prev.map(m => m.id === id ? approved : m));
    supabase.from('members').upsert(memberRow(approved)).then(({ error }) => {
      if (error) {   // RULE 1: revert the approval so state matches Supabase; NO auto-vouchers on a failed approve
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        setMembersState(prev => prev.map(m => m.id === id ? member : m));
        toastRef.current({ title: tr('Approve सेव नहीं हुआ', 'Approve not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर सदस्य फिर से pending दिखेगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the member will show as pending again.`), variant: 'destructive', duration: 12000 });
        return;
      }
      // Member approval is durable — ONLY now create the auto-vouchers (never before, so a
      // failed approve can never leave orphan share-capital / admission-fee vouchers).
      // One rule for add / import / approve (postJoiningReceipts): a member who joined before this FY
      // gets no receipt; cheque / online go to the bank. Falls back to the approver's active branch.
      persistMemberAdmission(id, approved);
      postJoiningReceipts(approved, { fallbackBranch: branchToStamp(activeBranchIdRef.current, headOfficeIdRef.current) });
      emitAudit({ entityType: 'member', entityId: id, action: 'approve', before: { approvalStatus: member.approvalStatus ?? 'pending', joinDate: member.joinDate }, after: { approvalStatus: 'approved', admissionDate, resolutionNo: approved.admissionResolutionNo ?? null, resolutionDate: approved.admissionResolutionDate ?? null, eligibilityConfirmed: decision?.eligibility ?? null } });
      toastRef.current({ title: tr('सदस्य स्वीकृत', 'Member approved'), description: tr(`${member.name} (${member.memberId}) अब सत्यापित सदस्य है`, `${member.name} (${member.memberId}) is now a verified member`) });
    });
  }, [postJoiningReceipts]);

  const rejectMember = useCallback((id: string, reason: string) => {
    if (guardFYLocked()) return;   // RULE 6
    const member = membersRef.current.find(m => m.id === id);
    if (!member) return;
    const why = (reason || '').trim();
    if (why.length < 5) {   // M2: r.17 — the refusal goes to the applicant with its reasons
      toastRef.current({ title: tr('कारण ज़रूरी है', 'Reason required'), description: tr('अस्वीकृति का कारण लिखें (नियम 17)। (A reason is required.)', 'Write the reason for rejection (Rule 17). (A reason is required.)'), variant: 'destructive' });
      return;
    }
    const rejected: Member = { ...member, approvalStatus: 'rejected' as const, rejectionReason: why, decidedAt: new Date().toISOString().split('T')[0], applicationDate: applicationReceivedOn(member) };
    setMembersState(prev => prev.map(m => m.id === id ? rejected : m));
    supabase.from('members').upsert(memberRow(rejected)).then(({ error }) => {
      if (error) {   // RULE 1: revert so state matches Supabase
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        setMembersState(prev => prev.map(m => m.id === id ? member : m));
        toastRef.current({ title: tr('Reject सेव नहीं हुआ', 'Reject not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर सदस्य फिर से pending दिखेगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the member will show as pending again.`), variant: 'destructive', duration: 12000 });
        return;
      }
      persistMemberAdmission(id, rejected);
      emitAudit({ entityType: 'member', entityId: id, action: 'reject', before: { approvalStatus: member.approvalStatus ?? 'pending' }, after: { approvalStatus: 'rejected' }, reason: why });
      toastRef.current({ title: tr('आवेदन अस्वीकृत', 'Application rejected'), description: `${member.name} (${member.memberId})` });
    });
  }, []);

  // T-09 auto-cutover · keep the JOURNAL's opening in step with an account mutation. ledger_events
  // is WORM, so a change appends a signed DELTA `account.opening` event (planOpeningDelta) — the
  // account's opening events then always sum to the current opening and ledger parity holds with no
  // ops re-seed. Shadow-pattern like the voucher events: append to the ref now, persist only after
  // the account row is durable, drop from the ref if the account save rolls back.
  const buildOpeningDelta = (account: LedgerAccount): LedgerEvent | null => {
    // Only when the full journal is in memory can we derive a collision-free sequence. If it isn't
    // (a non-cut-over tenant, or a load still in flight), skip — the account row still saves, and the
    // parity gate keeps reads correct (voucher-state) until a later load + genesis re-seed reconciles.
    if (!journalLoadedRef.current) return null;
    try {
      return planOpeningDelta(
        account,
        journalOpeningSignedMinor(account.id),
        nextEventSeq('account', account.id),
        societyIdRef.current,
        { jurisdiction: jurisdictionRef.current, producer: { kind: 'human', id: userRef.current?.name ?? null } },
      );
    } catch { return null; } // best-effort — never affects the account save
  };
  // S4-a · posting service ON: the account.opening delta is computed and appended by the SERVER from the DB
  // journal (sync_account_opening_event, 103) — no client journal write, and no dependence on the in-memory
  // journal being fully loaded. target 0 = the account was deleted (net its journal opening to zero).
  const syncOpeningOnServer = (accountId: string, targetMinor?: number) => {
    supabase.rpc('sync_account_opening_event', asDbArgs({ p_account_id: accountId, p_target_minor: targetMinor ?? null })).then(({ data, error }) => {
      if (error) {
        reportError('account-opening-post-service', error.message, { accountId });
        toastRef.current({ title: tr('⚠ खाता सेव हुआ, पर opening बही (journal) में नहीं गई', '⚠ Account saved, but the opening was not posted to the ledger (journal)'), description: tr(`${postVoucherMessage(postVoucherErrorCode(error.message), error.message)} — opening दोबारा सेव करें; न हो तो admin को बताएँ।`, `${postVoucherMessage(postVoucherErrorCode(error.message), error.message)} — save the opening again; if it still fails, tell your admin.`), variant: 'destructive', duration: 15000 });
        return;
      }
      const evs = mapLedgerEventRows(((data as { events?: Record<string, unknown>[] } | null)?.events) ?? []);
      if (evs.length) ledgerEventsRef.current = [...ledgerEventsRef.current, ...evs];
    }, (e: unknown) => reportError('account-opening-post-service', e instanceof Error ? e.message : String(e), { accountId }));
  };

  // opts.id — a conventional template id (e.g. '3308') chosen by domain provisioning after it checked
  // the cloud chart does not use it. Written with INSERT, never upsert, so a row that appeared in the
  // meantime is never overwritten: the conflict fails the save and RULE 1 rolls it back.
  const addAccount = useCallback((data: Omit<LedgerAccount, 'id'>, opts?: { id?: string; onSaved?: (a: LedgerAccount) => void; onFailed?: () => void }): LedgerAccount => {
    if (guardFYLocked()) { opts?.onFailed?.(); return { ...data, id: '' } as LedgerAccount; }
    if (opts?.id && accountsRef.current.some(a => a.id === opts.id)) {
      toastRef.current({ title: tr('खाता पहले से है', 'Account already exists'), description: tr(`खाता संख्या ${opts.id} इस चार्ट में पहले से मौजूद है — नया नहीं बनाया।`, `Account number ${opts.id} already exists in this chart — a new one was not created.`), variant: 'destructive', duration: 10000 });
      opts?.onFailed?.();
      return { ...data, id: '' } as LedgerAccount;
    }
    // Readable code for a UUID id (next free in the parent group's range, or the type's root range
    // when there is no parent). A conventional template id (opts.id) IS its own code — none stored.
    const code = opts?.id ? undefined : (data.code || nextAccountCode(accountsRef.current, data.parentId, !!data.isGroup, data.type));
    const newAccount: LedgerAccount = { ...data, id: opts?.id || crypto.randomUUID(), ...(code ? { code } : {}) };
    // accountsRef is normally refreshed by an effect AFTER render, so a caller that adds many accounts in
    // one synchronous loop (UniversalImporter) would have every call compute its code from the SAME stale
    // chart → the same "next free" code for every sibling → accounts_society_code_uniq rejects the
    // step-2 code write for all but the first (Rania, 2026-10: 891 accounts saved with no code, 1,856
    // errors). Append to the ref now so the next call in the same tick sees this account's code as used.
    accountsRef.current = [...accountsRef.current, newAccount];
    setAccountsState(prev => [...prev, newAccount]);
    const openingViaServer = postingServiceRef.current;
    const openingEvent = openingViaServer ? null : buildOpeningDelta(newAccount);
    if (openingEvent) ledgerEventsRef.current = [...ledgerEventsRef.current, openingEvent];
    // RULE 1 two-step: `code` is a late-added column (migration 109) — keep it OUT of the base
    // upsert so the account still saves on a DB that hasn't run 109; set it in step 2.
    const { code: _code, ...baseAccount } = newAccount;
    void _code;
    const write = opts?.id ? supabase.from('accounts').insert(withSoc(baseAccount)) : supabase.from('accounts').upsert(withSoc(baseAccount));
    write.then(({ error }) => {
      if (!error && code) {
        supabase.from('accounts').update({ code }).eq('id', newAccount.id).eq('society_id', societyIdRef.current).select('id').then(({ data: codeRows, error: codeErr0 }) => {
          // RLS refusing an update returns 0 rows and no error — treat that as a failure too.
          const codeErr = codeErr0 ?? (codeRows && codeRows.length > 0 ? null : { message: 'code update matched 0 rows' });
          if (!codeErr) return;
          // Step 2 failure: the account is safe; only the readable code is missing. Drop it locally so
          // the screen matches the cloud, and say so mildly (no rollback).
          reportError('db-sync', codeErr.message);
          accountsRef.current = accountsRef.current.map(a => a.id === newAccount.id ? { ...a, code: undefined } : a);
          setAccountsState(prev => prev.map(a => a.id === newAccount.id ? { ...a, code: undefined } : a));
          toastRef.current({ title: tr('खाता सेव हुआ — पर कोड नहीं', 'Account saved — but not its code'), description: tr(`लेजर कोड सेव नहीं हुआ (${codeErr.message})। Migration 109 चलाएँ, फिर लेजर हेड पेज पर "कोड दें" dabayein.`, `Ledger code was not saved (${codeErr.message}). Run Migration 109, then press "Give code" on the Ledger Heads page.`), duration: 10000 });
        });
      }
      if (error) {   // RULE 1: roll back so a failed cloud save can't silently diverge on F5
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        accountsRef.current = accountsRef.current.filter(a => a.id !== newAccount.id);
        setAccountsState(prev => prev.filter(a => a.id !== newAccount.id));
        if (openingEvent) ledgerEventsRef.current = ledgerEventsRef.current.filter(e => e.eventId !== openingEvent.eventId);
        toastRef.current({ title: tr('खाता सेव नहीं हुआ', 'Account not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा; दोबारा जोड़ें।`, `Not saved to the cloud — ${error.message}. Nothing will go wrong on Refresh; please add it again.`), variant: 'destructive', duration: 12000 });
        opts?.onFailed?.();
        return;
      }
      opts?.onSaved?.(newAccount);
      if (openingEvent) persistLedgerEvent(openingEvent);
      // No client event while the journal isn't in memory (posting service off, or its flag not read yet)
      // used to mean NO journal opening at all, silently (seen in production, 2026-11) — the server
      // computes the delta from the DB journal for any society, so hand it over instead of dropping it.
      else if ((openingViaServer || !journalLoadedRef.current) && (Number(newAccount.openingBalance) || 0) !== 0) syncOpeningOnServer(newAccount.id);
    });
    return newAccount;
  }, []);

  // Returns false when a guard blocked the edit (callers must not show a success toast then).
  // opts.onSaved / onFailed fire once the cloud upsert settles, so a batch caller (Opening Balances)
  // can announce success only after EVERY row is really saved (RULE 1).
  const updateAccount = useCallback((id: string, data: Partial<LedgerAccount>, opts?: { onSaved?: () => void; onFailed?: (message: string) => void }): boolean => {
    if (guardFYLocked()) return false;
    const current = accountsRef.current.find(a => a.id === id);
    // A ledger that carries entries (or an opening balance) must never become a GROUP: reports skip
    // group accounts, so its balance turned into a "[Deleted]" row and vanished from I&E (Assandh,
    // 2026-10-02 — Salary ₹9.07 L). Re-home the entries first, or create a new group instead.
    if (current && !current.isGroup && data.isGroup === true) {
      const hasOpening = (Number(current.openingBalance) || 0) !== 0;
      const hasEntries = vouchersRef.current.some(v => !v.isDeleted && getVoucherLines(v).some(l => l.accountId === id));
      if (hasOpening || hasEntries) {
        toastRef.current({
          title: tr('ग्रुप नहीं बन सकता / Cannot make this a group', 'Cannot make this a group'),
          description: hasEntries
            ? tr('इस खाते में वाउचर एंट्री हैं — ग्रुप बनाने पर इसका बैलेंस रिपोर्ट से गायब हो जाएगा। नया ग्रुप अलग से बनाएँ और यह खाता उसके नीचे रखें। / This account has voucher entries; create a separate group and place this ledger under it.', 'This account has voucher entries — making it a group would make its balance disappear from reports. Create a separate new group and place this ledger under it.')
            : tr('इस खाते का Opening Balance है — पहले उसे शून्य करें या नया ग्रुप अलग से बनाएँ। / This account has an opening balance; clear it first or create a separate group.', 'This account has an Opening Balance — clear it to zero first, or create a separate new group.'),
          variant: 'destructive', duration: 12000,
        });
        return false;
      }
    }
    // The other direction: a GROUP that still has accounts under it must not become a ledger — its
    // children would hang under a postable account (the dual state the 3302/2101/3303 fix removed).
    if (current && current.isGroup && data.isGroup !== undefined && !data.isGroup) {
      const childCount = accountsRef.current.filter(a => a.parentId === id).length;
      if (childCount > 0) {
        toastRef.current({
          title: tr('लेजर नहीं बन सकता / Cannot make this a ledger', 'Cannot make this a ledger'),
          description: tr(`इस ग्रुप के नीचे ${childCount} खाते हैं — पहले उन्हें दूसरे ग्रुप में ले जाएँ। / This group has ${childCount} account(s) under it — move them to another group first.`, `This group has ${childCount} account(s) under it — first move these ${childCount} to another group.`),
          variant: 'destructive', duration: 12000,
        });
        return false;
      }
    }
    setAccountsState(prev => {
      const before = prev.find(a => a.id === id);
      const updated = prev.map(a => a.id === id ? { ...a, ...data } : a);
      const updatedAccount = updated.find(a => a.id === id);
      const openingViaServer = postingServiceRef.current;
      const openingTouched = 'openingBalance' in data || 'openingBalanceType' in data;
      const openingEvent = updatedAccount && before && !openingViaServer ? buildOpeningDelta(updatedAccount) : null;
      if (openingEvent) ledgerEventsRef.current = [...ledgerEventsRef.current, openingEvent];
      if (updatedAccount && before) {
        // A field CLEARED by the edit (undefined, e.g. "Group" unticked or parent removed) is dropped by
        // JSON, so the upsert left the old DB value in place — the UI showed a ledger, F5 brought the
        // group back (RULE 1). Send it explicitly: false for isGroup, null for anything else.
        const row: Record<string, unknown> = { ...withSoc(updatedAccount) };
        for (const k of Object.keys(data) as (keyof LedgerAccount)[]) {
          if (data[k] === undefined) row[k] = k === 'isGroup' || k === 'isSystem' ? false : null;
        }
        patchRow('accounts', id, before, row).then(({ error }) => {
          if (error) {
            console.error('DB sync error:', error.message); reportError('db-sync', error.message);
            setAccountsState(p => p.map(a => a.id === id ? before : a));   // RULE 1: roll back to prior state
            if (openingEvent) ledgerEventsRef.current = ledgerEventsRef.current.filter(e => e.eventId !== openingEvent.eventId);
            toastRef.current({ title: tr('अपडेट सेव नहीं हुआ', 'Update not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh the old data will come back.`), variant: 'destructive', duration: 12000 });
            opts?.onFailed?.(error.message);
            return;
          }
          opts?.onSaved?.();
          if (openingEvent) persistLedgerEvent(openingEvent);
          else if ((openingViaServer || !journalLoadedRef.current) && openingTouched) syncOpeningOnServer(id);   // see addAccount
          // Chart edits were never audited, so a ledger flipped to group left no trace of who/when.
          const changed = (Object.keys(data) as (keyof LedgerAccount)[]).filter(k => before[k] !== updatedAccount[k]);
          if (changed.length) emitAudit({
            entityType: 'account', entityId: id, action: 'update',
            before: Object.fromEntries(changed.map(k => [k, before[k] ?? null])),
            after: Object.fromEntries(changed.map(k => [k, updatedAccount[k] ?? null])),
          });
        });
      } else opts?.onFailed?.('account not found');
      return updated;
    });
    return true;
  }, []);

  // Explicit admin action (Ledger Heads → "कोड दें"): give a readable code to every account whose id
  // is a UUID and has none. The load path never writes (RM-01), so existing UUID accounts are coded
  // only here. RULE 1: optimistic, then per-row update; any row the cloud refuses is reverted locally
  // and reported. Codes are metadata, but RULE 6 still applies (no chart changes in a locked FY).
  const assignMissingAccountCodes = useCallback(async (): Promise<{ assigned: number; failed: number; refused?: boolean }> => {
    // A guard bail already toasted — `refused` lets the page stay silent instead of guessing why.
    if (guardPermission('config', tr('खातों को कोड देने', 'assign codes to accounts'))) return { assigned: 0, failed: 0, refused: true };
    if (guardFYLocked()) return { assigned: 0, failed: 0, refused: true };
    if (refuseIfWriteBlocked(toastRef.current)) return { assigned: 0, failed: 0, refused: true };
    const plan = planMissingCodes(accountsRef.current);
    if (plan.size === 0) return { assigned: 0, failed: 0 };
    setAccountsState(prev => prev.map(a => plan.has(a.id) ? { ...a, code: plan.get(a.id) } : a));
    const sid = societyIdRef.current;
    const results = await Promise.all([...plan].map(([id, code]) =>
      supabase.from('accounts').update({ code }).eq('id', id).eq('society_id', sid).select('id')
        .then(({ data, error }) => ({ id, ok: !error && !!data && data.length > 0, msg: error?.message }),
              () => ({ id, ok: false, msg: 'network' }))));
    const failed = results.filter(r => !r.ok);
    if (failed.length) {
      const failedIds = new Set(failed.map(f => f.id));
      setAccountsState(prev => prev.map(a => failedIds.has(a.id) ? { ...a, code: undefined } : a));   // RULE 1: revert
      reportError('db-sync', failed[0].msg || 'account code update matched 0 rows', { failed: failed.length });
      toastRef.current({ title: tr('कुछ खातों का कोड सेव नहीं हुआ', 'Code not saved for some accounts'), description: tr(`${failed.length} खाते — क्लाउड में सेव नहीं हुआ (${failed[0].msg || 'अनुमति नहीं'}). Migration 109 चला है? Refresh करने पर ये कोड नहीं रहेंगे; दोबारा कोशिश करें।`, `${failed.length} account(s) — not saved to the cloud (${failed[0].msg || 'not permitted'}). Has Migration 109 been run? These codes will be lost on Refresh; please try again.`), variant: 'destructive', duration: 12000 });
    }
    const assigned = results.length - failed.length;
    if (assigned) emitAudit({ entityType: 'account', entityId: 'bulk', action: 'update', reason: `Assigned readable codes to ${assigned} account(s)` });
    return { assigned, failed: failed.length };
  }, [guardPermission, guardFYLocked]);

  // Returns true only when the account was actually removed; false on any guard bail. Callers
  // (e.g. LedgerHeads) must gate their "deleted" success toast on this, or a blocked delete
  // would still read as success (the false-success-toast class fixed for vouchers in 3f734c8).
  // M1-4a: the ONE way an `accounts` row is deleted. Scoped to this society (defence in depth on
  // top of RLS), and it asks for the deleted rows back: a forbidden delete under RLS returns 0 rows
  // and no error. On any failure — including 23503 once account_roles points at the account — the
  // row is put back in local state and the user is told (RULE 1), instead of vanishing until F5.
  const deleteAccountRow = useCallback((account: LedgerAccount, opts: { context: string; onSuccess?: () => void; onFail?: () => void; failTitle?: string }) => {
    supabase.from('accounts').delete().eq('id', account.id).eq('society_id', societyIdRef.current).select('id')
      .then(({ data, error }) => {
        const why = accountDeleteFailure(account.name, { error, deleted: error ? null : (data?.length ?? 0) });
        if (!why) { opts.onSuccess?.(); return; }
        setAccountsState(prev => prev.some(a => a.id === account.id) ? prev : [...prev, account]);
        opts.onFail?.();
        reportError(opts.context, error?.message || 'account delete removed 0 rows', { accountId: account.id, code: error?.code });
        toastRef.current({ title: opts.failTitle || tr('खाता नहीं मिटा', 'Account not deleted'), description: why, variant: 'destructive', duration: 12000 });
      });
  }, []);

  const deleteAccount = useCallback((id: string): boolean => {
    if (guardPermission('delete', tr('खाता मिटाने', 'delete accounts'))) return false;   // ECR-06: role gate
    if (guardFYLocked()) return false;

    // H11: Block deletion of built-in system accounts (CASH, BANK, 5101, 3403, etc.)
    // TEST-01 finding: read the REF, not the render's `accounts` — a caller that rolls back a sub-ledger it created a
    // moment ago (Labour addDepartment's failed save) holds this callback from BEFORE that account existed, so the
    // lookup said "Account not found" and left the orphan ledger on screen and in the cloud.
    const account = accountsRef.current.find(a => a.id === id) ?? accounts.find(a => a.id === id);
    if (!account) { toastRef.current({ title: tr('खाता नहीं मिला', 'Account not found'), description: tr('Refresh करके दोबारा देखें। (Account not found.)', 'Refresh and check again. (Account not found.)'), variant: 'destructive' }); return false; }
    if (account.isSystem) {
      toastRef.current({ title: tr('सिस्टम खाता नहीं हटेगा', 'System account cannot be deleted'), description: tr(`"${account.name}" सॉफ़्टवेयर का अपना खाता है — बिक्री/खरीद/अंतिम स्टॉक की पोस्टिंग इसी में होती है। (Built-in system account — cannot be deleted.)`, `"${account.name}" is the software's own built-in account — sales/purchase/closing stock postings go into it. It cannot be deleted.`), variant: 'destructive', duration: 10000 });
      return false;
    }

    // Tally-style: an account with a non-zero balance (incl. opening-only) can never be deleted.
    if (guardAccountBalance(id, tr(`खाता "${account.name}"`, `Account "${account.name}"`))) return false;

    // H10: Block if account is referenced by active vouchers or by a supplier/customer sub-ledger
    const activeV = vouchersRef.current.filter(v => !v.isDeleted);
    const usedInLines = activeV.some(v =>
      v.debitAccountId === id || v.creditAccountId === id ||
      (v.lines && v.lines.some(l => l.accountId === id))
    );
    if (usedInLines) {
      toastRef.current({ title: tr('खाता नहीं हटाया जा सकता', 'Account cannot be deleted'), description: tr(`"${account.name}" चालू वाउचरों में इस्तेमाल हुआ है — पहले वे वाउचर रद्द करें। (Used in active vouchers.)`, `"${account.name}" is used in active vouchers — cancel those vouchers first.`), variant: 'destructive', duration: 10000 });
      return false;
    }
    const supLinked = suppliersRef.current.find(s => s.accountId === id);
    if (supLinked) {
      toastRef.current({ title: tr('खाता नहीं हटाया जा सकता', 'Account cannot be deleted'), description: tr(`"${account.name}" आपूर्तिकर्ता "${supLinked.name}" का खाता है — आपूर्तिकर्ता पेज से आपूर्तिकर्ता हटाएँ। (Delete the supplier instead.)`, `"${account.name}" is the account of supplier "${supLinked.name}" — delete the supplier from the Suppliers page instead.`), variant: 'destructive', duration: 10000 });
      return false;
    }
    const cusLinked = customersRef.current.find(c => c.accountId === id);
    if (cusLinked) {
      toastRef.current({ title: tr('खाता नहीं हटाया जा सकता', 'Account cannot be deleted'), description: tr(`"${account.name}" ग्राहक "${cusLinked.name}" का खाता है — ग्राहक पेज से ग्राहक हटाएँ। (Delete the customer instead.)`, `"${account.name}" is the account of customer "${cusLinked.name}" — delete the customer from the Customers page instead.`), variant: 'destructive', duration: 10000 });
      return false;
    }

    setAccountsState(prev => prev.filter(a => a.id !== id));
    // T-09: net the account's journal opening to zero — a deleted account's opening events would
    // otherwise keep its old balance in the journal and break parity permanently.
    const zeroViaServer = postingServiceRef.current;
    const zeroEvent = zeroViaServer ? null : buildOpeningDelta({ ...account, openingBalance: 0 });
    if (zeroEvent) ledgerEventsRef.current = [...ledgerEventsRef.current, zeroEvent];
    deleteAccountRow(account, {
      context: 'account-delete',
      onSuccess: () => { if (zeroEvent) persistLedgerEvent(zeroEvent); else if (zeroViaServer || !journalLoadedRef.current) syncOpeningOnServer(id, 0); },
      onFail: () => { if (zeroEvent) ledgerEventsRef.current = ledgerEventsRef.current.filter(e => e.eventId !== zeroEvent.eventId); },
    });
    // H11: was console-only — a deleted ledger left no durable trail.
    emitAudit({ entityType: 'account', entityId: id, action: 'delete', before: { name: account.name, type: account.type }, reason: 'Account deleted' });
    return true;
  }, [accounts, society.fyLocked, deleteAccountRow]);

  // Merge one duplicate account into another — ONLY on an explicit, confirmed user action (the
  // LedgerHeads AlertDialog). Never call this from a load path or an effect (RM-01 / #533).
  //
  // Journal-safe and all-or-nothing:
  //   1. Guards first — any refusal toasts and resolves null with NOTHING changed.
  //   2. planAccountMerge re-points every voucher leg and journals each live, posted voucher as
  //      voucher.reversed + voucher.reposted (exactly like updateVoucher), so the journal-read
  //      statements (T-09) move with the vouchers table.
  //   3. Table writes (vouchers / suppliers / customers). Any failure → the writes that DID land are
  //      written back to their snapshot (compensation), local state rolls back, loud toast (RULE 1).
  //   4. The events are appended as ONE atomic, verified batch. This is the commit point: the WORM
  //      journal cannot be un-appended, so it goes after every reversible write. Failure → the same
  //      compensation + rollback.
  //   5. Only then is the emptied account deleted. Its opening is 0 (guarded) and its postings have
  //      moved, so a failed delete is not rolled back — the row is restored locally and the user is
  //      told to delete it by hand.
  const mergeAccounts = useCallback(async (keepId: string, removeId: string): Promise<AccountMergeResult | null> => {
    if (guardPermission('delete', tr('खाते merge करने', 'merge accounts'))) return null;   // ECR-06: a merge deletes an account
    if (guardFYLocked()) return null;                                 // RULE 6
    const block = (description: string): null => {
      toastRef.current({ title: tr('मर्ज नहीं हो सकता', 'Cannot merge'), description, variant: 'destructive', duration: 12000 });
      return null;
    };
    if (!keepId || !removeId || keepId === removeId) return block(tr('एक ही खाते को खुद में merge नहीं किया जा सकता — दो अलग खाते चुनें।', 'An account cannot be merged into itself — choose two different accounts.'));
    const keep = accounts.find(a => a.id === keepId);
    const remove = accounts.find(a => a.id === removeId);
    if (!keep || !remove) return block(tr('खाता नहीं मिला — पेज refresh करके दोबारा कोशिश करें।', 'Account not found — refresh the page and try again.'));
    if (remove.isSystem) return block(tr(`"${remove.name}" सिस्टम खाता है — इसे हटाया नहीं जा सकता। इसे रखें और दूसरे खाते को इसमें merge करें।`, `"${remove.name}" is a system account — it cannot be removed. Keep it and merge the other account into it.`));
    if (keep.isGroup || remove.isGroup) return block(tr('Group खाते merge नहीं होते — सिर्फ़ ledger खाते।', 'Group accounts cannot be merged — only ledger accounts.'));
    if (keep.type !== remove.type) return block(tr(`दोनों खातों का प्रकार अलग है (${keep.type} / ${remove.type}) — अलग प्रकार के खाते merge नहीं होते।`, `The two accounts are of different types (${keep.type} / ${remove.type}) — accounts of different types cannot be merged.`));
    // The removed account's opening is NOT transferred automatically (Dr/Cr netting is a judgement
    // call). The user moves it by editing the openings first; then this guard passes.
    if (Math.abs(remove.openingBalance || 0) >= 0.005) {
      const ob = Math.abs(remove.openingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return block(tr(`"${remove.name}" पर ₹${ob} का opening balance है। पहले इसे "${keep.name}" के opening में जोड़कर इस खाते का opening 0 करें, फिर merge करें।`, `"${remove.name}" has an opening balance of ₹${ob}. First add it to the opening of "${keep.name}" and set this account's opening to 0, then merge.`));
    }
    // Config that routes FUTURE postings to removeId would point at a deleted account after the merge.
    const stockRefs = stockItems.filter(s => s.salesAccountId === removeId || s.purchaseAccountId === removeId);
    if (stockRefs.length > 0) {
      const names = stockRefs.slice(0, 3).map(s => s.name).join(', ') + (stockRefs.length > 3 ? ` +${stockRefs.length - 3}` : '');
      return block(tr(`यह खाता ${stockRefs.length} stock item का बिक्री/खरीद खाता है (${names}) — पहले Inventory में इन items का खाता "${keep.name}" करें, फिर merge करें।`, `This account is the sales/purchase account of ${stockRefs.length} stock item(s) (${names}) — first change these items' account to "${keep.name}" in Inventory, then merge.`));
    }
    const partyOf = (id: string) => suppliersRef.current.find(s => s.accountId === id)?.name ?? customersRef.current.find(c => c.accountId === id)?.name;
    const removeParty = partyOf(removeId), keepParty = partyOf(keepId);
    if (removeParty && keepParty) return block(tr(`दोनों खाते अलग-अलग party के हैं ("${removeParty}" और "${keepParty}") — दो parties का ledger एक नहीं किया जा सकता।`, `The two accounts belong to different parties ("${removeParty}" and "${keepParty}") — the ledgers of two parties cannot be combined.`));
    // P0.1b: engine vouchers are immutable — never re-point their accounts; abort the WHOLE merge.
    const engineRefKind = (v: Voucher): 'Debit' | 'Credit' | 'Line' | null =>
      v.debitAccountId === removeId ? 'Debit'
        : v.creditAccountId === removeId ? 'Credit'
          : (v.lines?.some(l => l.accountId === removeId) ? 'Line' : null);
    const blocker = vouchersRef.current.find(v => isEngineVoucher(v) && engineRefKind(v) !== null);
    if (blocker) {
      return block(tr(`इस खाते से जुड़ा सिस्टम वाउचर ${blocker.voucherNo || blocker.id} (${engineRefKind(blocker)}) है — सिस्टम वाउचर (engine-generated) के खाते बदले नहीं जा सकते। पहले reversal करें, फिर merge करें।`, `System voucher ${blocker.voucherNo || blocker.id} (${engineRefKind(blocker)}) is linked to this account — the accounts of a system (engine-generated) voucher cannot be changed. Reverse it first, then merge.`));
    }
    const liveMoving = vouchersRef.current.filter(v => !v.isDeleted && repointVoucher(v, keepId, removeId));
    if (guardPeriodLock(...liveMoving.map(v => v.date))) return null;   // ECR-07: no re-point inside a locked period
    // S4-a · posting service ON: the WHOLE merge is one server transaction (merge_accounts, 103) — re-point,
    // journal reversed + reposted pairs, voucher_entries/voucher_lines, parties, opening netting, account
    // delete and the audit row. Nothing is half-applied, so there is no client compensation to run.
    if (postingServiceRef.current) {
      const res = await supabase.rpc('merge_accounts', asDbArgs({ p_keep: keepId, p_remove: removeId, p_by: userRef.current?.name ?? null }))
        .then((r) => r, (e: unknown) => ({ data: null, error: { message: `Network error — ${e instanceof Error ? e.message : String(e)}` } }));
      if (res.error) {
        reportError('merge-accounts-post-service', res.error.message, { keepId, removeId });
        return block(postVoucherMessage(postVoucherErrorCode(res.error.message), res.error.message));
      }
      const r = (res.data ?? {}) as { moved?: number; journaled?: number; accountDeleted?: boolean; events?: Record<string, unknown>[] };
      const repointed = vouchersRef.current.map(v => repointVoucher(v, keepId, removeId) ?? v);
      vouchersRef.current = repointed;
      setVouchersState(repointed);
      if (suppliersRef.current.some(x => x.accountId === removeId)) {
        suppliersRef.current = suppliersRef.current.map(x => x.accountId === removeId ? { ...x, accountId: keepId } : x);
        setSuppliersState(suppliersRef.current);
      }
      if (customersRef.current.some(x => x.accountId === removeId)) {
        customersRef.current = customersRef.current.map(x => x.accountId === removeId ? { ...x, accountId: keepId } : x);
        setCustomersState(customersRef.current);
      }
      const evs = mapLedgerEventRows(r.events ?? []);
      if (evs.length) ledgerEventsRef.current = [...ledgerEventsRef.current, ...evs];
      if (r.accountDeleted) setAccountsState(prev => prev.filter(a => a.id !== removeId));
      else toastRef.current({ title: tr('Merge हो गया, पर पुराना खाता नहीं मिटा', 'Merge done, but the old account was not deleted'), description: tr(`"${remove.name}" अभी किसी और जगह (जैसे account role) से जुड़ा है — उसे हटाकर यह खाता हाथ से delete करें।`, `"${remove.name}" is still linked somewhere else (for example an account role) — remove that link, then delete this account manually.`), variant: 'destructive', duration: 12000 });
      return { moved: r.moved ?? 0, journaled: r.journaled ?? 0, accountDeleted: !!r.accountDeleted };
    }
    // Sequences come from the in-memory journal — without the FULL log they would collide on the WORM
    // index and the postings would silently stay on removeId. Fail closed.
    if (!journalLoadedRef.current && liveMoving.some(v => v.approvalStatus !== 'pending')) {
      return block(tr('लेखा-बही (journal) अभी पूरी load नहीं हुई — पेज refresh करें, फिर merge करें।', 'The ledger (journal) has not fully loaded yet — refresh the page, then merge.'));
    }

    let plan: ReturnType<typeof planAccountMerge>;
    try {
      plan = planAccountMerge({
        vouchers: vouchersRef.current, events: ledgerEventsRef.current, keepId, removeId,
        tenantId: societyIdRef.current, jurisdiction: jurisdictionRef.current,
        producerId: userRef.current?.name ?? null, occurredAt: new Date().toISOString(),
        newEventId: () => crypto.randomUUID(),
      });
    } catch (e) {
      return block(tr(`Merge की तैयारी नहीं हो सकी — ${e instanceof Error ? e.message : String(e)}`, `Could not prepare the merge — ${e instanceof Error ? e.message : String(e)}`));
    }
    // T-09: net the removed account's journal opening to zero (as deleteAccount does) — null when the
    // journal already agrees with its 0 opening.
    const zeroEvent = buildOpeningDelta({ ...remove, openingBalance: 0 });
    const allEvents = zeroEvent ? [...plan.events, zeroEvent] : plan.events;
    const eventIds = new Set(allEvents.map(e => e.eventId));

    // Optimistic apply (snapshots for rollback).
    const voucherSnapshot = vouchersRef.current;
    const supplierSnapshot = suppliersRef.current;
    const customerSnapshot = customersRef.current;
    const afterById = new Map(plan.changed.map(c => [c.after.id, c.after]));
    const reSup = suppliersRef.current.filter(s => s.accountId === removeId);
    const reCus = customersRef.current.filter(c => c.accountId === removeId);
    ledgerEventsRef.current = [...ledgerEventsRef.current, ...allEvents];
    vouchersRef.current = vouchersRef.current.map(v => afterById.get(v.id) ?? v);
    setVouchersState(vouchersRef.current);
    if (reSup.length > 0) {
      suppliersRef.current = suppliersRef.current.map(s => s.accountId === removeId ? { ...s, accountId: keepId } : s);
      setSuppliersState(suppliersRef.current);
    }
    if (reCus.length > 0) {
      customersRef.current = customersRef.current.map(c => c.accountId === removeId ? { ...c, accountId: keepId } : c);
      setCustomersState(customersRef.current);
    }

    // Every table write with its compensating undo. Each resolves to its error message (or null).
    const msgOf = (p: PromiseLike<{ error: { message: string } | null }>): Promise<string | null> =>
      Promise.resolve(p).then(({ error }) => error?.message ?? null, (e: unknown) => (e instanceof Error ? e.message : String(e)));
    const voucherRow = (v: Voucher) => { const { editHistory: _eh, ...forDb } = v; return withSoc(forDb); };
    const writes: { run: () => Promise<string | null>; undo: () => Promise<string | null> }[] = [
      ...plan.changed.map(({ before, after }) => ({
        run: () => msgOf(supabase.from('vouchers').upsert(voucherRow(after))),
        undo: () => msgOf(supabase.from('vouchers').upsert(voucherRow(before))),
      })),
      ...reSup.map(s => ({
        run: () => msgOf(supabase.from('suppliers').update({ accountId: keepId }).eq('id', s.id)),
        undo: () => msgOf(supabase.from('suppliers').update({ accountId: removeId }).eq('id', s.id)),
      })),
      ...reCus.map(c => ({
        run: () => msgOf(supabase.from('customers').update({ accountId: keepId }).eq('id', c.id)),
        undo: () => msgOf(supabase.from('customers').update({ accountId: removeId }).eq('id', c.id)),
      })),
    ];

    const failMerge = async (msg: string, results: (string | null)[], phase: string): Promise<null> => {
      ledgerEventsRef.current = ledgerEventsRef.current.filter(e => !eventIds.has(e.eventId));
      vouchersRef.current = voucherSnapshot; setVouchersState(voucherSnapshot);
      suppliersRef.current = supplierSnapshot; setSuppliersState(supplierSnapshot);
      customersRef.current = customerSnapshot; setCustomersState(customerSnapshot);
      // Undo only the writes that landed; a failed write left its row untouched.
      const undoErrs = await Promise.all(writes.map((w, i) => (results[i] === null ? w.undo() : Promise.resolve(null))));
      const stuck = undoErrs.filter(e => e !== null).length;
      reportError('merge-accounts', msg, { keepId, removeId, phase, compensationFailures: stuck });
      toastRef.current(stuck === 0
        ? { title: tr('❌ खाता merge cloud पर save नहीं हुआ', '❌ Account merge not saved to the cloud'), description: tr(`${msg}. सारे बदलाव वापस ले लिए — दोनों खाते पहले जैसे हैं; refresh करने पर data lose नहीं होगा। दोबारा merge करें।`, `${msg}. All changes were rolled back — both accounts are as they were; no data will be lost on refresh. Please merge again.`), variant: 'destructive', duration: 15000 }
        : { title: tr('❌ Merge अधूरा रह गया — तुरंत ध्यान दें', '❌ Merge left incomplete — needs attention now'), description: tr(`${msg}. ${stuck} row cloud में वापस नहीं हो सकीं। पेज refresh करके Ledger Hygiene पर जाँच करें; ज़रूरत हो तो support से संपर्क करें।`, `${msg}. ${stuck} row(s) could not be rolled back in the cloud. Refresh the page and check on Ledger Hygiene; contact support if needed.`), variant: 'destructive', duration: 20000 });
      return null;
    };

    const results = await Promise.all(writes.map(w => w.run()));
    const firstErr = results.find(e => e !== null);
    if (firstErr) return failMerge(firstErr, results, 'table');

    const appended = await persistEventsAuthoritative(allEvents, ledgerAppendIO);
    if (!appended.ok) return failMerge(appended.error ?? 'journal append failed', results, 'journal');

    // Committed. Rebuild the moved voucher_entries, then delete the emptied account.
    plan.changed.forEach(({ after }) => { if (!after.isDeleted) syncEntries(after); });
    // M1-4a: the one accounts-delete path — on a refusal (RLS 0 rows, or 23503 once account_roles
    // points at the account) it puts the row back on screen and shows a destructive toast itself.
    setAccountsState(prev => prev.filter(a => a.id !== removeId));
    const accountDeleted = await new Promise<boolean>(resolve => deleteAccountRow(remove, {
      context: 'merge-accounts', failTitle: tr('Merge हो गया, पर पुराना खाता नहीं मिटा — इसे हाथ से delete करें', 'Merge done, but the old account was not deleted — delete it manually'),
      onSuccess: () => resolve(true), onFail: () => resolve(false),
    }));
    console.info(`[AUDIT-MERGE] Account id=${removeId} merged into ${keepId} (${plan.changed.length} vouchers, ${plan.journaledCount} journaled) by ${userRef.current?.name || 'unknown'} at ${new Date().toISOString()}`);
    return { moved: plan.changed.length, journaled: plan.journaledCount, accountDeleted };
  }, [accounts, stockItems, deleteAccountRow]);

  // COA reset (M1-4a): cloud FIRST, local after — so a refused or half-done reset never leaves the
  // screen showing a chart the cloud does not have. Resolves true only when the whole template
  // was written; the caller announces success only then.
  const resetAccounts = useCallback(async (templateAccounts: LedgerAccount[]): Promise<boolean> => {
    if (guardPermission('delete', tr('खाता संरचना रीसेट करने', 'reset the account structure'))) return false;
    if (guardFYLocked()) return false;
    const fail = (description: string) => {
      toastRef.current({ title: tr('खाता संरचना रीसेट नहीं हुई', 'Account structure was not reset'), description, variant: 'destructive', duration: 15000 });
      return false;
    };
    // A running society's chart is never reset: the reset zeroes every opening balance and drops every
    // custom head, and the blocker check below only covers vouchers/suppliers/customers. UI-side checks
    // can be bypassed or stale, so the refusal lives here, where the delete happens.
    const live = coaResetLiveData({
      vouchers: vouchersRef.current.length, members: membersRef.current.length, loans: loansRef.current.length,
      suppliers: suppliersRef.current.length, customers: customersRef.current.length,
      sales: salesRef.current.length, purchases: purchasesRef.current.length, employees: employeesRef.current.length,
      accountsWithOpening: accountsRef.current.filter(a => (Number(a.openingBalance) || 0) !== 0).length,
    });
    if (live.length > 0) {
      return fail(tr(`यह समिति चालू है (${live.join(', ')}), इसलिए खाता संरचना रीसेट नहीं हो सकती — रीसेट सभी opening balance शून्य कर देता और आपके बनाए खाते मिटा देता। कुछ नहीं बदला गया। (Reset is only for a society with no records.)`, `This society is in use (${live.join(', ')}), so the account structure cannot be reset — a reset would set every opening balance to zero and delete the accounts you created. Nothing was changed. (Reset is only for a society with no records.)`));
    }
    // An account outside the template that a voucher (incl. cancelled) or a party points at would be
    // orphaned by the reset — refuse instead (RULE 3). Template ids come back with the same id.
    const blockers = coaResetBlockers(
      new Set(templateAccounts.map(a => a.id)),
      accountsRef.current, vouchersRef.current, suppliersRef.current, customersRef.current,
    );
    if (blockers.length > 0) {
      const list = blockers.slice(0, 5).map(b => `"${b.name}"`).join(', ') + (blockers.length > 5 ? tr(` और ${blockers.length - 5}`, ` and ${blockers.length - 5} more`) : '');
      return fail(tr(`${blockers.length} खाते template में नहीं हैं पर vouchers / suppliers / customers में इस्तेमाल हैं: ${list}। रीसेट से ये टूट जाते — कुछ नहीं बदला गया। (Accounts outside the template are in use.)`, `${blockers.length} accounts are not in the template but are used in vouchers / suppliers / customers: ${list}. A reset would break them — nothing was changed. (Accounts outside the template are in use.)`));
    }
    const sid = societyIdRef.current;
    const { error: delErr } = await supabase.from('accounts').delete().eq('society_id', sid);
    if (delErr) {
      reportError('coa-reset', delErr.message, { phase: 'delete', code: delErr.code });
      return fail(delErr.code === '23503'
        ? tr('कुछ खाते accounting roles या दूसरे records से जुड़े हैं, इसलिए cloud ने मिटाने से मना कर दिया। कुछ नहीं बदला गया।', 'Some accounts are linked to accounting roles or other records, so the cloud refused to delete them. Nothing was changed.')
        : tr(`Cloud ने खाते नहीं मिटाए — कुछ नहीं बदला गया। (${delErr.message})`, `The cloud did not delete the accounts — nothing was changed. (${delErr.message})`));
    }
    const BATCH = 50;
    let insertErr: string | null = null;
    for (let i = 0; i < templateAccounts.length && !insertErr; i += BATCH) {
      const batch = templateAccounts.slice(i, i + BATCH).map(a => ({ ...a, society_id: sid, jurisdiction: jurisdictionRef.current }));
      const { error } = await supabase.from('accounts').insert(batch);
      if (error) insertErr = error.message;
    }
    if (insertErr) {
      // The old chart is already gone: show exactly what the cloud now holds, never the template.
      reportError('coa-reset', insertErr, { phase: 'insert' });
      const { data } = await fetchAllPagedFor<LedgerAccount>('accounts', sid);
      setAccountsState(storage.migrateAccounts(data || []).accounts);
      return fail(tr(`पुराने खाते मिट गए पर template पूरा नहीं बना (${insertErr})। Screen पर अब वही खाते हैं जो cloud में हैं — दोबारा रीसेट करें।`, `The old accounts were deleted but the template was not fully created (${insertErr}). The screen now shows the same accounts as the cloud — reset again.`));
    }
    setAccountsState(templateAccounts);
    return true;
  }, [guardPermission, guardFYLocked]);

  // RULE-1: optimistic + rollback. society_settings writes are admin-only at the RLS layer
  // (is_society_admin), so a non-admin's save is REJECTED by the DB — we must restore local
  // state (not just toast) or the change would silently diverge and vanish on refresh.
  const updateSociety = useCallback((data: Partial<SocietySettings>, opts?: { onSaved?: (droppedColumns: string[]) => void; onFailed?: (message: string) => void }) => {
    // F1: settings deliberately skip the FY guard (unlocking the FY is a settings save), so the
    // online-only rule is applied here directly. Without it, a load whose society_settings failed
    // would upsert the device's STALE cached settings over the live row.
    if (refuseIfWriteBlocked(toastRef.current)) { opts?.onFailed?.('offline / data incomplete'); return; }
    setSocietyState(prev => {
      const rollback = prev;
      const updated = { ...prev, ...data };
      const failToast = (msg: string) => toastRef.current({ title: tr('सेटिंग सेव नहीं हुई', 'Setting not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — refresh करने पर बदलाव नहीं रहेगा। समिति की सेटिंग सिर्फ़ admin बदल सकता है। (${msg})`, `Not saved to the cloud — the change will be lost on refresh. Only an admin can change the society's settings. (${msg})`), variant: 'destructive', duration: 12000 });
      // RULE 1: society_settings is one flat row whose column set has grown over many
      // migrations. The whole state object rides in the upsert, so a SINGLE un-migrated
      // column (e.g. "fyLocked" before its migration runs) makes PostgREST reject the ENTIRE
      // save — the user then can't save ANY setting. Trim the offending column and retry so
      // every column the DB DOES have still lands; the base row is safe. Only roll back on a
      // real failure (RLS reject / network). A migrated DB succeeds on the first call.
      const attempt = (payload: Record<string, unknown>, dropped: string[]): void => {
        supabase.from('society_settings').upsert(asDbRow(payload)).then(
          ({ error }) => {
            if (!error) {
              if (dropped.length) toastRef.current({ title: tr('सहेजा गया — पर कुछ कॉलम इस DB में नहीं हैं', 'Saved — but some columns are not in this DB'), description: tr(`बाक़ी सब सेव हुआ; ये कॉलम database में नहीं हैं — बाकी migration चलाएँ: ${dropped.join(', ')}.`, `Everything else was saved; these columns are not in the database — run the pending migrations: ${dropped.join(', ')}.`), duration: 12000 });
              opts?.onSaved?.(dropped);
              return;
            }
            const trimmed = dropped.length < 24 ? payloadWithoutMissingColumn(error, payload) : null;
            if (trimmed && Object.keys(trimmed).length > 0) {
              const col = Object.keys(payload).find(k => !(k in trimmed))!;
              attempt(trimmed, [...dropped, col]);
              return;
            }
            console.error('DB sync error:', error.message); reportError('db-sync', error.message); setSocietyState(rollback); failToast(error.message);
            opts?.onFailed?.(error.message);
          },
          () => { setSocietyState(rollback); failToast('network'); opts?.onFailed?.('network'); },
        );
      };
      // RULE 1: keys cleared with undefined (period unlock, FY unlock request, liability "not recorded" …)
      // travel as null — JSON would drop them and the DB would keep the old value (lib/settingsPayload).
      attempt({ id: societyIdRef.current, society_id: societyIdRef.current, ...updated, ...clearedKeysAsNull(data) }, []);
      return updated;
    });
  }, []);

  // ── T-23 · Governance authority for the FY close (UCAS CM-2 / CL-7) ──────────
  // Locking the financial year is a FINALIZATION: its legality derives from a recorded board
  // resolution. When the per-tenant flag is on, the close REQUIRES that authority — validated
  // (correct kind, reference, date, authorizer, and SoD: the authorizer must not be the admin
  // locking) and stamped on the society so the locked year ties to the resolution that closed it.
  // Flag OFF (default) ⇒ the exact lock the setup page did before, byte-identical.
  // Returns true when the year was locked; false when refused (a toast explains why).
  const closeFinancialYear = useCallback((opts?: { attestation?: AuthorityAttestation }): boolean => {
    // F1: refuse up front — updateSociety would refuse too, but this returns true regardless, so the
    // page would toast a lock that never happened (the false-success pattern).
    if (refuseIfWriteBlocked(toastRef.current)) return false;
    let recorded: string | undefined;
    if (societyRef.current?.fyCloseAuthorityRequired) {
      const verdict = authorizeFinalization({ act: 'fy_close', preparedBy: userRef.current?.name ?? '', attestation: opts?.attestation });
      if (!verdict.ok || !verdict.recorded) {
        toastRef.current({ title: tr('🏛️ प्राधिकार आवश्यक', '🏛️ Authorisation required'), description: tr(`${verdict.problems.join('; ')} — बोर्ड संकल्प के बिना वित्तीय वर्ष लॉक नहीं होगा। (FY close needs a recorded board resolution.)`, `${verdict.problems.join('; ')} — the Financial Year will not be locked without a board resolution. (FY close needs a recorded board resolution.)`), variant: 'destructive', duration: 12000 });
        return false;
      }
      const r = verdict.recorded;
      recorded = `${r.kind} ${r.reference} (${r.date}) — ${r.authorizedBy}`;
    }
    updateSociety({
      fyLocked: true,
      fyLockedAt: new Date().toISOString().split('T')[0],
      fyLockedBy: userRef.current?.name || 'Admin',
      fyUnlockRequestedBy: undefined,
      fyUnlockRequestedAt: undefined,
      ...(recorded ? { fyCloseAuthority: recorded } : {}),
    });
    return true;
  }, [updateSociety]);

  // C6: admin hides/shows an ENTITLED capability for this society. Writes/removes an
  // admin 'revoke' row only (admin can never entitle). RULE-1: optimistic + rollback on
  // failure with a destructive Hindi toast so local state never diverges from Supabase.
  const setCapabilityHidden = useCallback((capability: Capability, hidden: boolean, meta?: { reason?: string; by?: string }) => {
    const sid = societyIdRef.current;
    const stableId = `${sid}__${capability}__admin`;
    const failToast = (msg: string) => toastRef.current({ title: tr('सेव नहीं हुआ', 'Not saved'), description: tr('क्लाउड में सेव नहीं हुआ — refresh करने पर बदलाव नहीं रहेगा। (', 'Not saved to the cloud — the change will be lost on refresh. (') + msg + ')', variant: 'destructive', duration: 10000 });
    setSocietyCapabilitiesState(prev => {
      const rollback = prev;
      if (hidden) {
        const nowIso = new Date().toISOString();
        const next = [
          ...prev.filter(r => !(r.capability === capability && r.source === 'admin' && r.mode === 'revoke')),
          { capability, mode: 'revoke' as const, source: 'admin' as const, expiresAt: null, grantedBy: meta?.by ?? null, createdAt: nowIso },
        ];
        supabase.from('society_capabilities').upsert({ id: stableId, society_id: sid, capability, mode: 'revoke', source: 'admin', granted_by: meta?.by ?? null, created_at: nowIso }).then(
          ({ error }) => { if (error) { setSocietyCapabilitiesState(rollback); failToast(error.message); } else { toastRef.current({ title: tr('फ़ीचर बंद किया गया', 'Feature turned off'), description: meta?.reason ? tr('कारण: ', 'Reason: ') + meta.reason : tr('सुविधा अब साइडबार में नहीं दिखेगी।', 'This feature will no longer show in the sidebar.') }); } },
          () => { setSocietyCapabilitiesState(rollback); failToast('network'); },
        );
        return next;
      }
      const next = prev.filter(r => !(r.capability === capability && r.source === 'admin' && r.mode === 'revoke'));
      supabase.from('society_capabilities').delete().eq('society_id', sid).eq('capability', capability).eq('source', 'admin').then(
        ({ error }) => { if (error) { setSocietyCapabilitiesState(rollback); failToast(error.message); } else { toastRef.current({ title: tr('फ़ीचर चालू किया गया', 'Feature turned on'), description: meta?.reason ? tr('कारण: ', 'Reason: ') + meta.reason : tr('सुविधा अब साइडबार में दिखेगी।', 'This feature will now show in the sidebar.') }); } },
        () => { setSocietyCapabilitiesState(rollback); failToast('network'); },
      );
      return next;
    });
  }, []);

  // ── Procurement Phase 1.0 ──────────────────────────────────────────────────
  // Farmer master (minimal). Optimistic + localStorage mirror + Supabase upsert + RULE-1 rollback.
  // The code comes from the server's atomic per-society counter (next_document_number, book
  // 'procurement.farmer') — the old "local count + 1" gave two devices the same code. Codes an older
  // client already issued (read fresh from the cloud) are skipped. No counter -> no farmer (RULE 1).
  // D2b (migration 138): village / bank / IFSC / portal id are step-2 columns (RULE 1) — the farmer row
  // saves before the migration; a miss is a mild warning (payment then needs the details re-entered).
  const FARMER_EXTRA_KEYS = ['village', 'bankName', 'bankAccountNo', 'ifsc', 'portalId'] as const;
  const farmerBase = (f: Farmer) => { const b: Record<string, unknown> = { ...f }; for (const k of FARMER_EXTRA_KEYS) delete b[k]; return b; };
  // DB-09: before = the farmer before an edit (undefined for a new one). In SPLIT mode the bank fields go to
  // party_identity (a procurementOfficer may write them there), never to the farmer row.
  const persistFarmerExtras = (f: Farmer, force = false, before?: Farmer) => {
    const split = partySplitRef.current;
    if (split) persistPartyIdentity('farmer', f.id, f, before, () => {
      const back = (x: Farmer) => x.id === f.id ? { ...x, ...piiOf(before, 'farmer') } as Farmer : x;
      setProcurementFarmersState(prev => { const u = prev.map(back); storage.setProcurementFarmers(u); return u; });
    });
    const extras: Record<string, unknown> = {};
    for (const k of FARMER_EXTRA_KEYS) if (f[k] !== undefined && !(split && (PARTY_PII_FIELDS.farmer as readonly string[]).includes(k))) extras[k] = f[k] || null;
    if (!force && Object.keys(extras).length === 0) return;
    if (Object.keys(extras).length === 0) return;
    supabase.from('procurement_farmers').update(extras).eq('id', f.id).then(({ error }) => {
      if (!error) return;
      reportError('write-partial', error.message, { at: 'procurement_farmers bank columns (migration 138)' });
      toastRef.current({ title: tr('किसान सेव हुआ, बैंक विवरण नहीं', 'Farmer saved, bank details not saved'), description: tr(`गाँव / बैंक / IFSC / पोर्टल ID क्लाउड में सेव नहीं हुए (migration 138 चलाएँ)। ${error.message}`, `Village / bank / IFSC / portal ID were not saved to the cloud (run migration 138). ${error.message}`), variant: 'default', duration: 12000 });
    });
  };
  const validFarmerBank = (d: Partial<FarmerInput>): boolean => {
    if (!isValidIfsc(d.ifsc)) { toastRef.current({ title: tr('IFSC ठीक नहीं', 'IFSC is not valid'), description: tr('IFSC 11 अक्षर का होता है — 4 अक्षर, फिर 0, फिर 6 अक्षर/अंक (जैसे SBIN0001234)।', 'IFSC has 11 characters — 4 letters, then 0, then 6 letters/digits (e.g. SBIN0001234).'), variant: 'destructive', duration: 9000 }); return false; }
    if (!isValidBankAccount(d.bankAccountNo)) { toastRef.current({ title: tr('खाता नंबर ठीक नहीं', 'Account number is not valid'), description: tr('बैंक खाता नंबर 6 से 18 अंकों का होना चाहिए।', 'Bank account number must be 6 to 18 digits.'), variant: 'destructive', duration: 9000 }); return false; }
    return true;
  };
  const cleanFarmerInput = <T extends Partial<FarmerInput>>(d: T): T => ({ ...d, ifsc: d.ifsc ? d.ifsc.trim().toUpperCase() : d.ifsc, bankAccountNo: d.bankAccountNo ? d.bankAccountNo.trim() : d.bankAccountNo });

  const addFarmer = useCallback(async (input: FarmerInput): Promise<Farmer> => {
    const data = cleanFarmerInput(input);
    const blank: Farmer = { id: '', farmerCode: '', farmerName: data.farmerName, createdAt: '', updatedAt: '' };
    if (guardFYLocked()) return blank;
    if (!validFarmerBank(data)) return blank;
    const sid = societyIdRef.current;
    // Paged read: PostgREST silently stops at 1000 rows, which would hide issued codes.
    const { data: codeRows, error: codeErr } = await fetchAllPagedFor<Farmer>('procurement_farmers', sid);
    const taken = new Set<string>([...procurementFarmersRef.current, ...codeRows].map(f => f.farmerCode));
    const farmerCode = codeErr ? null : await allocateFarmerCode(() => nextDocNumber(sid, 'procurement.farmer', 'ALL'), taken);
    if (!farmerCode) {
      toastRef.current({ title: tr('किसान कोड नहीं मिला', 'Farmer code not received'), description: tr(`Cloud से किसान कोड नहीं मिल सका${codeErr ? ` — ${codeErr.message}` : ''}. इंटरनेट जाँचकर दोबारा जोड़ें; कोई किसान नहीं बना।`, `Could not get a farmer code from the Cloud${codeErr ? ` — ${codeErr.message}` : ''}. Check your internet and add again; no farmer was created.`), variant: 'destructive', duration: 12000 });
      return blank;
    }
    const now = new Date().toISOString();
    const newFarmer: Farmer = {
      id: crypto.randomUUID(),
      farmerCode,
      farmerName: data.farmerName,
      fatherName: data.fatherName || undefined,
      mobile: data.mobile || undefined,
      village: data.village || undefined, bankName: data.bankName || undefined, bankAccountNo: data.bankAccountNo || undefined,
      ifsc: data.ifsc || undefined, portalId: data.portalId || undefined,
      createdAt: now,
      updatedAt: now,
    };
    setProcurementFarmersState(prev => { const u = [...prev, newFarmer]; storage.setProcurementFarmers(u); return u; });
    supabase.from('procurement_farmers').upsert(withSoc(farmerBase(newFarmer))).then(({ error }) => {
      if (!error) { persistFarmerExtras(newFarmer); return; }
      {
        console.error('Farmer sync error:', error.message);
        setProcurementFarmersState(prev => { const r = prev.filter(f => f.id !== newFarmer.id); storage.setProcurementFarmers(r); return r; });
        toastRef.current({ title: tr('किसान सेव नहीं हुआ', 'Farmer not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा; दोबारा जोड़ें।`, `Not saved to the cloud — ${error.message}. Nothing will go wrong on Refresh; please add it again.`), variant: 'destructive', duration: 12000 });
      }
    });
    return newFarmer;
  }, []);

  const updateFarmer = useCallback((id: string, input: Partial<FarmerInput>) => {
    if (guardFYLocked()) return;
    const data = cleanFarmerInput(input);
    if (data.farmerName !== undefined && !data.farmerName.trim()) { toastRef.current({ title: tr('किसान का नाम आवश्यक है', 'Farmer name is required'), variant: 'destructive' }); return; }
    if (!validFarmerBank(data)) return;
    const before = procurementFarmersRef.current.find(f => f.id === id);
    if (!before) return;
    const next: Farmer = { ...before, ...data, updatedAt: new Date().toISOString() };
    setProcurementFarmersState(prev => { const u = prev.map(f => f.id === id ? next : f); storage.setProcurementFarmers(u); return u; });
    patchRow('procurement_farmers', id, before, farmerBase(next)).then(({ error }) => {
      if (!error) { persistFarmerExtras(next, true, before); return; }
      setProcurementFarmersState(prev => { const u = prev.map(f => f.id === id ? before : f); storage.setProcurementFarmers(u); return u; });
      toastRef.current({ title: tr('किसान अपडेट नहीं हुआ', 'Farmer not updated'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh the old data will come back.`), variant: 'destructive', duration: 12000 });
    });
  }, []);

  // Create a ProcurementLot + exactly ONE immutable 'lot.created' event (append-only). No voucher.
  const addProcurementLot = useCallback((data: { farmerId: string; cropId: string; varietyId?: string; seasonId?: string; centreId?: string; quantity: Quantity; mspRate: Money; lotDate?: string; arhtiyaId?: string; grossWeight?: number; tareWeight?: number; bags?: number }): ProcurementLot => {
    const sentinel: ProcurementLot = { id: '', centreId: '', seasonId: '', cropId: '', farmerId: '', operationalStatus: 'created', financialStatus: 'unbilled', reconciliationStatus: 'pending', createdAt: '', updatedAt: '' };
    if (guardFYLocked()) return sentinel;
    // Batch B: the business date may be back-dated, but never into the future, a locked period or
    // another financial year — the posting voucher will carry it (same refusals as any voucher).
    if (data.lotDate) {
      if (data.lotDate > todayStr()) { toastRef.current({ title: tr('भविष्य की तारीख', 'Future date'), description: tr('लॉट की तारीख आज के बाद की नहीं हो सकती।', 'Lot date cannot be after today.'), variant: 'destructive', duration: 8000 }); return sentinel; }
      if (guardVoucherPostable(data.lotDate)) return sentinel;
    }
    const now = new Date().toISOString();
    const lot: ProcurementLot = {
      id: crypto.randomUUID(),
      // M1b: real Season/Centre from the masters when provided; else the legacy stubs
      // (society id / financial year) so pre-M1b callers keep working unchanged.
      centreId: data.centreId || societyIdRef.current,
      seasonId: data.seasonId || societyRef.current?.financialYear || '',
      cropId: data.cropId,
      varietyId: data.varietyId || undefined,
      farmerId: data.farmerId,
      quantity: data.quantity,
      mspRate: data.mspRate,
      operationalStatus: 'created',
      financialStatus: 'unbilled',
      reconciliationStatus: 'pending',
      lotDate: data.lotDate || undefined,
      // D2a: arhtiyaId is written by the commit RPC itself; the weighment slip is a step-2 write below.
      arhtiyaId: data.arhtiyaId || undefined,
      grossWeight: data.grossWeight || undefined,
      tareWeight: data.tareWeight ?? undefined,
      bags: data.bags ? Math.trunc(data.bags) : undefined,
      createdAt: now,
      updatedAt: now,
    };
    const event: ProcurementEvent = {
      id: crypto.randomUUID(),
      correlationId: lot.id,
      name: 'lot.created',
      occurredAt: now,
      recordedAt: now,
      actor: user?.name || 'System',
      payload: { centreId: lot.centreId, farmerId: lot.farmerId, cropId: lot.cropId, seasonId: lot.seasonId },
    };
    setProcurementLotsState(prev => { const u = [...prev, lot]; storage.setProcurementLots(u); return u; });
    setProcurementEventsState(prev => { const u = [...prev, event]; storage.setProcurementEvents(u); return u; });
    // M1: commit the lot AND its immutable event in ONE atomic DB transaction (generic
    // business-transaction boundary). Both persist together or neither does → the cloud can
    // never hold a lot without its lot.created event. On failure, roll back BOTH optimistically.
    supabase.rpc('procurement_commit_transaction', { p_payload: { transactionType: 'lot.create', transactionId: crypto.randomUUID(), transactionVersion: 1, lots: [withSoc(lot)], events: [withSoc(event)] } }).then(({ error }) => {
      if (error) {
        console.error('Procurement commit error:', error.message);
        setProcurementLotsState(prev => { const r = prev.filter(l => l.id !== lot.id); storage.setProcurementLots(r); return r; });
        setProcurementEventsState(prev => { const r = prev.filter(e => e.id !== event.id); storage.setProcurementEvents(r); return r; });
        toastRef.current({ title: tr('लॉट सेव नहीं हुआ', 'Lot not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा; दोबारा बनाएँ।`, `Not saved to the cloud — ${error.message}. Nothing will go wrong on Refresh; please create it again.`), variant: 'destructive', duration: 12000 });
        return;
      }
      // Step 2 (RULE 1): lotDate (migration 135) and the weighment slip (migration 137) are columns the
      // frozen RPC does not write. The lot is saved; a miss here only loses those details (postings then
      // use the J-Form / entry day).
      const extras: Record<string, unknown> = {};
      if (lot.lotDate) extras.lotDate = lot.lotDate;
      if (lot.grossWeight != null) extras.grossWeight = lot.grossWeight;
      if (lot.tareWeight != null) extras.tareWeight = lot.tareWeight;
      if (lot.bags != null) extras.bags = lot.bags;
      if (Object.keys(extras).length) supabase.from('procurement_lots').update(extras).eq('id', lot.id).then(({ error: e2 }) => {
        if (!e2) return;
        reportError('write-partial', e2.message, { at: 'procurement_lots step-2 (migrations 135/137)' });
        toastRef.current({ title: tr('लॉट सेव हुआ, कुछ विवरण नहीं', 'Lot saved, some details not saved'), description: tr(`लॉट की तारीख / तौल / बोरी क्लाउड में सेव नहीं हुई (migration 135 व 137 चलाएँ) — पोस्टिंग J-Form के दिन की होगी। ${e2.message}`, `Lot date / weight / bags were not saved to the cloud (run migration 135 and 137) — posting will be dated on the J-Form day. ${e2.message}`), variant: 'default', duration: 10000 });
      });
    });
    return lot;
  }, [user]);

  // Phase 2.1 — Quality Inspection (pure recording). Records a QualityTest + the measured
  // MoistureRecord + two immutable events (quality.tested, moisture.recorded) for a lot, all
  // committed atomically via the frozen transaction contract. No lot status change, no voucher.
  const recordQualityInspection = useCallback((data: { lotId: string; result: string; moisture: number; inspectedBy?: string }): QualityTest => {
    const sentinel: QualityTest = { id: '', lotId: data.lotId, result: data.result, inspectedBy: '', createdAt: '', updatedAt: '' };
    if (guardFYLocked()) return sentinel;
    // Phase 2.1.1 — early validation only (NOT the business guarantee; the DB unique index on
    // lotId is). One QualityTest + one MoistureRecord per lot: reject a repeat before the RPC.
    if (procurementQualityTests.some(q => q.lotId === data.lotId) || procurementMoistureRecords.some(m => m.lotId === data.lotId)) {
      toastRef.current({ title: tr('पहले से दर्ज', 'Already recorded'), description: tr('इस लॉट की क्वालिटी जाँच पहले से मौजूद है। (Quality already recorded for this lot)', 'Quality check for this lot already exists. (Quality already recorded for this lot)'), variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    if (lotBlocked(data.lotId)) return sentinel;
    // Batch A (P1-3): quality is the gate BEFORE the J-Form — recording (or rejecting) it afterwards
    // stranded a posted lot (no settlement / payment, its 3308/2105 entry still booked).
    if (!canRecordQuality({ hasQualityTest: false, hasJForm: procurementJFormsRef.current.some(j => j.lotId === data.lotId) })) {
      toastRef.current({ title: tr('J-Form बन चुका है', 'J-Form already issued'), description: tr('इस लॉट का J-Form जारी हो चुका है — अब क्वालिटी जाँच दर्ज नहीं हो सकती। क्वालिटी J-Form से पहले दर्ज करें।', 'The J-Form for this lot has been issued — quality check can no longer be recorded. Record quality before the J-Form.'), variant: 'destructive', duration: 10000 });
      return sentinel;
    }
    const now = new Date().toISOString();
    const by = data.inspectedBy?.trim() || user?.name || 'System';
    const qt: QualityTest = { id: crypto.randomUUID(), lotId: data.lotId, result: data.result, inspectedBy: by, createdAt: now, updatedAt: now };
    const mr: MoistureRecord = { id: crypto.randomUUID(), lotId: data.lotId, moisture: { value: data.moisture }, createdAt: now, updatedAt: now };
    const qEvent: ProcurementEvent = { id: crypto.randomUUID(), correlationId: data.lotId, name: 'quality.tested', occurredAt: now, recordedAt: now, actor: by, payload: { lotId: data.lotId, result: data.result } };
    const mEvent: ProcurementEvent = { id: crypto.randomUUID(), correlationId: data.lotId, name: 'moisture.recorded', occurredAt: now, recordedAt: now, actor: by, payload: { lotId: data.lotId, moisture: data.moisture } };
    setProcurementQualityTestsState(prev => { const u = [...prev, qt]; storage.setProcurementQualityTests(u); return u; });
    setProcurementMoistureRecordsState(prev => { const u = [...prev, mr]; storage.setProcurementMoistureRecords(u); return u; });
    setProcurementEventsState(prev => { const u = [...prev, qEvent, mEvent]; storage.setProcurementEvents(u); return u; });
    supabase.rpc('procurement_commit_transaction', { p_payload: { transactionType: 'quality.record', transactionId: crypto.randomUUID(), transactionVersion: 1, qualityTests: [withSoc(qt)], moistureRecords: [withSoc(mr)], events: [withSoc(qEvent), withSoc(mEvent)] } }).then(({ error }) => {
      if (error) {
        console.error('Quality commit error:', error.message);
        setProcurementQualityTestsState(prev => { const r = prev.filter(x => x.id !== qt.id); storage.setProcurementQualityTests(r); return r; });
        setProcurementMoistureRecordsState(prev => { const r = prev.filter(x => x.id !== mr.id); storage.setProcurementMoistureRecords(r); return r; });
        setProcurementEventsState(prev => { const r = prev.filter(e => e.id !== qEvent.id && e.id !== mEvent.id); storage.setProcurementEvents(r); return r; });
        toastRef.current({ title: tr('क्वालिटी सेव नहीं हुई', 'Quality not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा; दोबारा दर्ज करें।`, `Not saved to the cloud — ${error.message}. Nothing will go wrong on Refresh; please record it again.`), variant: 'destructive', duration: 12000 });
      }
    });
    return qt;
  }, [user, procurementQualityTests, procurementMoistureRecords]);

  // Quality gate (MSP agent flow): a lot whose quality test says "rejected" must never be invoiced,
  // posted, settled or paid. lotIdOfEngineVoucher walks the SSOT trace ev -> PostingRuleResult -> lot.
  const lotIsRejected = (lotId?: string) =>
    !!lotId && procurementQualityTests.some(q => q.lotId === lotId && isRejectedQuality(q.result));
  const lotIdOfEngineVoucher = (ev?: Voucher) =>
    ev && ev.refType === 'posting.rule.result' ? procurementPostingRuleResults.find(r => r.id === ev.refId)?.lotId : undefined;
  const toastRejectedLot = () =>
    toastRef.current({ title: tr('लॉट अस्वीकृत है', 'Lot is rejected'), description: tr('क्वालिटी जाँच में यह लॉट अस्वीकृत हुआ था — इसका J-Form, पोस्टिंग, निपटान या भुगतान नहीं हो सकता।', 'This lot was rejected in the quality check — no J-Form, posting, settlement or payment can be made for it.'), variant: 'destructive', duration: 10000 });
  // Batch B: a CANCELLED lot is read-only as well — no J-Form, posting, settlement, payment or quality.
  const lotBlocked = (lotId?: string): boolean => {
    if (lotId && isLotCancelled(procurementLotsRef.current.find(l => l.id === lotId))) {
      toastRef.current({ title: tr('लॉट रद्द है', 'Lot is cancelled'), description: tr('यह लॉट रद्द किया जा चुका है — इस पर अब कोई कार्रवाई नहीं हो सकती।', 'This lot has been cancelled — no further action can be taken on it.'), variant: 'destructive', duration: 10000 });
      return true;
    }
    if (lotIsRejected(lotId)) { toastRejectedLot(); return true; }
    return false;
  };

  // Phase 2.2 — J-Form generation (business DOCUMENT only; NOT an accounting event). Generates
  // ONE J-Form per lot + one immutable 'jform.generated' event, committed atomically via the frozen
  // contract. gross = qty × MSP rate, deductions = 0 (no deduction workflow this phase), net = gross.
  // No voucher / financial intent / posting request.
  const generateJForm = useCallback((data: { lotId: string }): JForm => {
    const sentinel: JForm = { id: '', lotId: data.lotId, documentNo: '', gross: { amount: 0, currency: 'INR' }, deductions: { amount: 0, currency: 'INR' }, net: { amount: 0, currency: 'INR' }, createdAt: '', updatedAt: '' };
    if (guardFYLocked()) return sentinel;
    // Early validation only (NOT the business guarantee; the DB unique index on lotId is). One per lot.
    if (procurementJForms.some(j => j.lotId === data.lotId)) {
      toastRef.current({ title: tr('पहले से जारी', 'Already issued'), description: tr('इस लॉट का J-Form पहले से बना है। (J-Form already generated for this lot)', 'A J-Form for this lot already exists. (J-Form already generated for this lot)'), variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    if (lotBlocked(data.lotId)) return sentinel;
    // D1 (founder 2026-10-25): quality is REQUIRED before the J-Form.
    if (!procurementQualityTests.some(q => q.lotId === data.lotId)) {
      toastRef.current({ title: tr('पहले क्वालिटी जाँच', 'Quality check first'), description: tr('J-Form से पहले इस लॉट की क्वालिटी (परिणाम + नमी) दर्ज करें।', 'Record this lot\'s quality (result + moisture) before the J-Form.'), variant: 'destructive', duration: 9000 });
      return sentinel;
    }
    const lot = procurementLots.find(l => l.id === data.lotId);
    const cur = lot?.mspRate?.currency || 'INR';
    // Rounded to paise (e.g. 12.345 qtl × ₹2,425 gave a 3-decimal voucher amount).
    const grossAmount = toRupees(toMinor((lot?.quantity?.value || 0) * (lot?.mspRate?.amount || 0)));
    const now = new Date().toISOString();
    // documentNo is DB-owned (single source of truth). The client sends a placeholder and receives the
    // authoritative number in the RPC response — it never computes J000n here.
    const jf: JForm = {
      id: crypto.randomUUID(), lotId: data.lotId, documentNo: '',
      gross: { amount: grossAmount, currency: cur },
      deductions: { amount: 0, currency: cur },
      net: { amount: grossAmount, currency: cur },
      createdAt: now, updatedAt: now,
    };
    const event: ProcurementEvent = { id: crypto.randomUUID(), correlationId: data.lotId, name: 'jform.generated', occurredAt: now, recordedAt: now, actor: user?.name || 'System', payload: { jformId: jf.id, documentNo: '', net: jf.net } };
    setProcurementJFormsState(prev => { const u = [...prev, jf]; storage.setProcurementJForms(u); return u; });
    procurementJFormsRef.current = [...procurementJFormsRef.current, jf];
    setProcurementEventsState(prev => { const u = [...prev, event]; storage.setProcurementEvents(u); return u; });
    supabase.rpc('procurement_commit_transaction', { p_payload: { transactionType: 'jform.generate', transactionId: crypto.randomUUID(), transactionVersion: 1, jforms: [withSoc(jf)], events: [withSoc(event)] } }).then(({ data: res, error }) => {
      if (error) {
        console.error('J-Form commit error:', error.message);
        setProcurementJFormsState(prev => { const r = prev.filter(x => x.id !== jf.id); storage.setProcurementJForms(r); return r; });
        procurementJFormsRef.current = procurementJFormsRef.current.filter(x => x.id !== jf.id);
        setProcurementEventsState(prev => { const r = prev.filter(e => e.id !== event.id); storage.setProcurementEvents(r); return r; });
        toastRef.current({ title: tr('J-Form सेव नहीं हुआ', 'J-Form not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा; दोबारा बनाएँ।`, `Not saved to the cloud — ${error.message}. Nothing will go wrong on Refresh; please create it again.`), variant: 'destructive', duration: 12000 });
        return;
      }
      // D1(A): patch the optimistic J-Form + its event with the DB-generated documentNo from the response.
      const gen = (res as { jforms?: Array<{ id: string; documentNo: string }> } | null)?.jforms?.find(j => j.id === jf.id);
      if (gen?.documentNo) {
        setProcurementJFormsState(prev => { const u = prev.map(x => x.id === jf.id ? { ...x, documentNo: gen.documentNo } : x); storage.setProcurementJForms(u); return u; });
        setProcurementEventsState(prev => { const u = prev.map(e => e.id === event.id ? { ...e, payload: { ...(e.payload as Record<string, unknown>), documentNo: gen.documentNo } } : e); storage.setProcurementEvents(u); return u; });
        toastRef.current({ title: tr('J-Form बना', 'J-Form created'), description: `${gen.documentNo} · ₹${jf.net.amount}`, duration: 6000 });
      }
    });
    return jf;
  }, [user, procurementJForms, procurementLots, procurementQualityTests]);

  // Phase 3.0 — Financial Intent (business object only; NOT accounting). Generates ONE immutable
  // FinancialIntentRecord from a generated J-Form + one immutable 'financial.intent.created' event,
  // committed atomically via the frozen contract. No posting / engine / voucher / ledger.
  const generateFinancialIntent = useCallback((data: { jformId: string }, opts?: { onCommitted?: (fi: FinancialIntentRecord) => void; onFailed?: () => void }): FinancialIntentRecord => {
    const sentinel: FinancialIntentRecord = { id: '', lotId: '', jformId: data.jformId, intentType: 'RecogniseProcurement', amount: { amount: 0, currency: 'INR' }, createdAt: '', updatedAt: '' };
    if (guardFYLocked()) return sentinel;
    // 2. J-Form exists?
    const jform = procurementJFormsRef.current.find(j => j.id === data.jformId);
    if (!jform) {
      toastRef.current({ title: tr('J-Form नहीं मिला', 'J-Form not found'), description: tr('पहले इस लॉट का J-Form बनाएं। (Generate the J-Form first)', 'Create the J-Form for this lot first. (Generate the J-Form first)'), variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    if (lotBlocked(jform.lotId)) return sentinel;
    // 3. Existing Financial Intent? (early validation; the DB unique index on jformId is the guarantee). One per J-Form.
    if (procurementIntentsRef.current.some(i => i.jformId === data.jformId)) {
      toastRef.current({ title: tr('पहले से बना', 'Already created'), description: tr('इस J-Form का Financial Intent पहले से मौजूद है। (Financial Intent already exists for this J-Form)', 'A Financial Intent for this J-Form already exists. (Financial Intent already exists for this J-Form)'), variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    const now = new Date().toISOString();
    // 4. Build the FinancialIntentRecord.
    const fi: FinancialIntentRecord = {
      id: crypto.randomUUID(), lotId: jform.lotId, jformId: jform.id,
      intentType: 'RecogniseProcurement', amount: jform.net,
      createdAt: now, updatedAt: now,
    };
    // 5. Build the immutable 'financial.intent.created' event (correlationId = lot id).
    const event: ProcurementEvent = { id: crypto.randomUUID(), correlationId: jform.lotId, name: 'financial.intent.created', occurredAt: now, recordedAt: now, actor: user?.name || 'System', payload: { intentId: fi.id, jformId: fi.jformId, amount: fi.amount } };
    setProcurementFinancialIntentsState(prev => { const u = [...prev, fi]; storage.setProcurementFinancialIntents(u); return u; });
    procurementIntentsRef.current = [...procurementIntentsRef.current, fi];
    setProcurementEventsState(prev => { const u = [...prev, event]; storage.setProcurementEvents(u); return u; });
    // 6. Commit through the frozen transaction contract.
    supabase.rpc('procurement_commit_transaction', { p_payload: { transactionType: 'financial.intent.create', transactionId: crypto.randomUUID(), transactionVersion: 1, financialIntents: [withSoc(fi)], events: [withSoc(event)] } }).then(({ error }) => {
      if (error) {
        console.error('Financial Intent commit error:', error.message);
        setProcurementFinancialIntentsState(prev => { const r = prev.filter(x => x.id !== fi.id); storage.setProcurementFinancialIntents(r); return r; });
        procurementIntentsRef.current = procurementIntentsRef.current.filter(x => x.id !== fi.id);
        setProcurementEventsState(prev => { const r = prev.filter(e => e.id !== event.id); storage.setProcurementEvents(r); return r; });
        toastRef.current({ title: tr('Financial Intent सेव नहीं हुआ', 'Financial Intent not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा; दोबारा बनाएँ।`, `Not saved to the cloud — ${error.message}. Nothing will go wrong on Refresh; please create it again.`), variant: 'destructive', duration: 12000 });
        opts?.onFailed?.();
        return;
      }
      toastRef.current({ title: tr('खरीद दर्ज (1/4)', 'Purchase recorded (1/4)'), description: `₹${fi.amount.amount}`, duration: 4000 });
      opts?.onCommitted?.(fi);
    });
    return fi;
  }, [user, procurementJForms, procurementFinancialIntents, procurementQualityTests]);

  // Phase 3.1 — Posting Request (business object only; NOT posting/ledger/accounting/voucher).
  // Generates ONE immutable PostingRequest from a Financial Intent + one immutable
  // 'posting.request.created' event, committed atomically via the frozen contract. requestType and
  // amount are copied from the source intent (no recalculation).
  const generatePostingRequest = useCallback((data: { financialIntentId: string }, opts?: { onCommitted?: (pr: PostingRequest) => void; onFailed?: () => void }): PostingRequest => {
    const sentinel: PostingRequest = { id: '', lotId: '', jformId: '', financialIntentId: data.financialIntentId, requestType: 'RecogniseProcurement', amount: { amount: 0, currency: 'INR' }, createdAt: '', updatedAt: '' };
    if (guardFYLocked()) return sentinel;
    // 2. Financial Intent exists?
    const intent = procurementIntentsRef.current.find(i => i.id === data.financialIntentId);
    if (!intent) {
      toastRef.current({ title: tr('Financial Intent नहीं मिला', 'Financial Intent not found'), description: tr('पहले इस लॉट का Financial Intent बनाएं। (Generate the Financial Intent first)', 'Create the Financial Intent for this lot first. (Generate the Financial Intent first)'), variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    // 3. Posting Request already exists? (early validation; the DB unique index on financialIntentId is the guarantee). One per intent.
    if (procurementRequestsRef.current.some(p => p.financialIntentId === data.financialIntentId)) {
      toastRef.current({ title: tr('पहले से बना', 'Already created'), description: tr('इस Financial Intent का Posting Request पहले से मौजूद है। (Posting Request already exists for this Financial Intent)', 'A Posting Request for this Financial Intent already exists. (Posting Request already exists for this Financial Intent)'), variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    const now = new Date().toISOString();
    // 4. Build the PostingRequest (requestType + amount copied from the source intent).
    const pr: PostingRequest = {
      id: crypto.randomUUID(), lotId: intent.lotId, jformId: intent.jformId, financialIntentId: intent.id,
      requestType: intent.intentType, amount: intent.amount,
      createdAt: now, updatedAt: now,
    };
    // 5. Build the immutable 'posting.request.created' event (correlationId = lot id).
    const event: ProcurementEvent = { id: crypto.randomUUID(), correlationId: intent.lotId, name: 'posting.request.created', occurredAt: now, recordedAt: now, actor: user?.name || 'System', payload: { postingRequestId: pr.id, financialIntentId: pr.financialIntentId, amount: pr.amount } };
    setProcurementPostingRequestsState(prev => { const u = [...prev, pr]; storage.setProcurementPostingRequests(u); return u; });
    procurementRequestsRef.current = [...procurementRequestsRef.current, pr];
    setProcurementEventsState(prev => { const u = [...prev, event]; storage.setProcurementEvents(u); return u; });
    // 6. Commit through the frozen transaction contract.
    supabase.rpc('procurement_commit_transaction', { p_payload: { transactionType: 'posting.request.create', transactionId: crypto.randomUUID(), transactionVersion: 1, postingRequests: [withSoc(pr)], events: [withSoc(event)] } }).then(({ error }) => {
      if (error) {
        console.error('Posting Request commit error:', error.message);
        setProcurementPostingRequestsState(prev => { const r = prev.filter(x => x.id !== pr.id); storage.setProcurementPostingRequests(r); return r; });
        procurementRequestsRef.current = procurementRequestsRef.current.filter(x => x.id !== pr.id);
        setProcurementEventsState(prev => { const r = prev.filter(e => e.id !== event.id); storage.setProcurementEvents(r); return r; });
        toastRef.current({ title: tr('Posting Request सेव नहीं हुआ', 'Posting Request not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा; दोबारा बनाएँ।`, `Not saved to the cloud — ${error.message}. Nothing will go wrong on Refresh; please create it again.`), variant: 'destructive', duration: 12000 });
        opts?.onFailed?.();
        return;
      }
      toastRef.current({ title: tr('पोस्टिंग अनुरोध बना (2/4)', 'Posting request created (2/4)'), description: `₹${pr.amount.amount}`, duration: 4000 });
      opts?.onCommitted?.(pr);
    });
    return pr;
  }, [user, procurementFinancialIntents, procurementPostingRequests]);

  // Phase 3.2 — Posting Rule resolution (business object only; NOT posting/ledger/voucher).
  // Consumes ONE PostingRequest → resolves balanced legs via the pure resolver → persists ONE
  // immutable PostingRuleResult + one immutable 'posting.rule.resolved' event, committed atomically
  // via the frozen contract. The legs are data (symbolic selectors); no voucher / journal / ledger.
  const generatePostingRuleResult = useCallback((data: { postingRequestId: string }, opts?: { onCommitted?: (r: PostingRuleResult) => void; onFailed?: () => void; receivableAccountId?: string }): PostingRuleResult => {
    const sentinel: PostingRuleResult = { id: '', postingRequestId: data.postingRequestId, lotId: '', jformId: '', financialIntentId: '', requestType: 'RecogniseProcurement', profile: 'agency', legs: [], createdAt: '', updatedAt: '' };
    if (guardFYLocked()) return sentinel;
    // 2. PostingRequest exists?
    const request = procurementRequestsRef.current.find(p => p.id === data.postingRequestId);
    if (!request) {
      toastRef.current({ title: tr('Posting Request नहीं मिला', 'Posting Request not found'), description: tr('पहले Posting Request बनाएं। (Generate the Posting Request first)', 'Create the Posting Request first. (Generate the Posting Request first)'), variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    // 3. PostingRuleResult already exists? (early validation; the DB unique index on postingRequestId is the guarantee). One per request.
    if (procurementRuleResultsRef.current.some(r => r.postingRequestId === data.postingRequestId)) {
      toastRef.current({ title: tr('पहले से बना', 'Already created'), description: tr('इस Posting Request का result पहले से मौजूद है। (Already resolved for this Posting Request)', 'A result for this Posting Request already exists. (Already resolved for this Posting Request)'), variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    // 4. Resolve legs via the pure rule, then build the result.
    const profile: AccountingProfile = 'agency';
    // Resolution + account snapshot are FROZEN here (binding + live chart). Engine never re-resolves.
    // Binding is resolved against THIS society's chart (template id or name), so a PACS / sugar
    // society whose MSP ledgers were created via Ledger Hygiene posts exactly like a CMS society.
    // D1: the lot's agency may keep its OWN receivable ledger (e.g. "HSWC Sirsa") — an asset leaf.
    const binding = { ...procurementPostingBinding(accounts) };
    if (opts?.receivableAccountId) {
      const own = accounts.find(a => a.id === opts.receivableAccountId);
      if (!own || own.isGroup || own.type !== 'asset') {
        toastRef.current({ title: tr('एजेंसी का खाता ठीक नहीं', 'Agency account is not correct'), description: tr('एजेंसी master में चुना गया प्राप्य खाता नहीं मिला या asset ledger नहीं है — Procurement Masters → एजेंसी में ठीक करें।', 'The receivable account chosen in the agency master was not found or is not an asset ledger — fix it in Procurement Masters → Agency.'), variant: 'destructive', duration: 12000 });
        opts?.onFailed?.();
        return sentinel;
      }
      binding['agency.receivable'] = own.id;
    }
    // D1: society setting — pass each purchase through 5116 Govt Procurement Purchase.
    const via = !!societyRef.current?.procurementVia5116;
    if (via) {
      const viaAcc = accounts.find(a => a.id === '5116' && !a.isGroup) ?? accounts.find(a => !a.isGroup && a.type === 'expense' && /govt\.? procurement purchase|सरकारी खरीद/i.test(`${a.name} ${a.nameHi || ''}`));
      if (!viaAcc) {
        toastRef.current({ title: tr('5116 खाता नहीं है', 'Account 5116 does not exist'), description: tr('"5116 से होकर पोस्ट" चालू है पर चार्ट में Govt Procurement Purchase (5116) खाता नहीं है — खाता बनाएँ या setting बंद करें।', '"Post through 5116" is on, but the chart has no Govt Procurement Purchase (5116) account — create the account or turn the setting off.'), variant: 'destructive', duration: 12000 });
        opts?.onFailed?.();
        return sentinel;
      }
      binding['procurement.via'] = viaAcc.id;
    }
    const legs = resolvePostingLegs(request.requestType, request.amount, profile, binding, accounts, { via });
    if (legs.length === 0) {
      const missing = missingProcurementRoles(accounts, ['agencyReceivable', 'farmerPayable']);
      toastRef.current(missing.length > 0
        ? { title: tr('MSP खाते नहीं हैं', 'MSP accounts missing'), description: tr(`इस समिति के चार्ट में ${missing.map(r => PROCUREMENT_ROLE_LABEL_HI[r]).join(' और ')} खाता नहीं है। "लेजर स्वच्छता" (Ledger Hygiene) पेज पर "डोमेन खाते बनाएँ" दबाएँ, फिर दोबारा पोस्ट करें।`, `This society's chart has no ${missing.map(r => PROCUREMENT_ROLE_LABEL_EN[r]).join(' and ')} account. Press "Create domain accounts" on the Ledger Hygiene page, then post again.`), variant: 'destructive', duration: 15000 }
        : { title: tr('पोस्टिंग नियम नहीं', 'No posting rule'), description: tr(`इस प्रकार (${request.requestType}) की पोस्टिंग का नियम नहीं है।`, `There is no posting rule for this type (${request.requestType}).`), variant: 'destructive', duration: 10000 });
      return sentinel;
    }
    const now = new Date().toISOString();
    const result: PostingRuleResult = {
      id: crypto.randomUUID(), postingRequestId: request.id, lotId: request.lotId, jformId: request.jformId,
      financialIntentId: request.financialIntentId, requestType: request.requestType, profile, legs,
      createdAt: now, updatedAt: now,
    };
    // 5. Build the immutable 'posting.rule.resolved' event (correlationId = lot id).
    const event: ProcurementEvent = { id: crypto.randomUUID(), correlationId: request.lotId, name: 'posting.rule.resolved', occurredAt: now, recordedAt: now, actor: user?.name || 'System', payload: { postingRuleResultId: result.id, postingRequestId: result.postingRequestId, legCount: legs.length } };
    setProcurementPostingRuleResultsState(prev => { const u = [...prev, result]; storage.setProcurementPostingRuleResults(u); return u; });
    procurementRuleResultsRef.current = [...procurementRuleResultsRef.current, result];
    setProcurementEventsState(prev => { const u = [...prev, event]; storage.setProcurementEvents(u); return u; });
    // 6. Commit through the frozen transaction contract.
    supabase.rpc('procurement_commit_transaction', { p_payload: { transactionType: 'posting.rule.resolve', transactionId: crypto.randomUUID(), transactionVersion: 1, postingRuleResults: [withSoc(result)], events: [withSoc(event)] } }).then(({ error }) => {
      if (error) {
        console.error('Posting Rule resolve error:', error.message);
        setProcurementPostingRuleResultsState(prev => { const r = prev.filter(x => x.id !== result.id); storage.setProcurementPostingRuleResults(r); return r; });
        procurementRuleResultsRef.current = procurementRuleResultsRef.current.filter(x => x.id !== result.id);
        setProcurementEventsState(prev => { const r = prev.filter(e => e.id !== event.id); storage.setProcurementEvents(r); return r; });
        toastRef.current({ title: tr('Posting Rule result सेव नहीं हुआ', 'Posting Rule result not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा; दोबारा करें।`, `Not saved to the cloud — ${error.message}. Nothing will go wrong on Refresh; please do it again.`), variant: 'destructive', duration: 12000 });
        opts?.onFailed?.();
        return;
      }
      toastRef.current({ title: tr('खाते तय हुए (3/4)', 'Accounts resolved (3/4)'), description: tr(`${legs.length} प्रविष्टियाँ`, `${legs.length} entries`), duration: 4000 });
      opts?.onCommitted?.(result);
    });
    return result;
  }, [user, procurementPostingRequests, procurementPostingRuleResults, accounts]);

  // Phase 3.3 — Financial Engine (first slice). Consumes ONE PostingRuleResult → produces ONE
  // immutable Engine Voucher (origin:'engine'), reusing addVoucher / persistVoucher / voucherImmutability.
  // The Voucher (Accounting subsystem) is the SINGLE authoritative record; the procurement
  // 'engine.voucher.created' event is a best-effort audit log. No link table, no compensation, no
  // selector lookup — the engine maps ONLY the frozen resolvedAccountId on each leg.
  const generateEngineVoucher = useCallback((data: { postingRuleResultId: string }, opts?: { onSaved?: (v: Voucher) => void }): Voucher => {
    const sentinel = { id: '', voucherNo: '', type: 'journal', date: '', debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    if (guardFYLocked()) return sentinel;
    // 2. PostingRuleResult exists?
    const result = procurementRuleResultsRef.current.find(r => r.id === data.postingRuleResultId);
    if (!result) {
      toastRef.current({ title: tr('Posting Rule result नहीं मिला', 'Posting Rule result not found'), description: tr('पहले Resolve करें। (Resolve the Posting Request first)', 'Resolve first. (Resolve the Posting Request first)'), variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    // 3. Engine voucher already exists? The Voucher itself is the authoritative one-to-one record
    //    (origin='engine' + refType='posting.rule.result' + refId=result.id). No duplicate link table.
    if (vouchersRef.current.some(v => !v.isDeleted && isEngineVoucher(v) && v.refType === 'posting.rule.result' && v.refId === result.id)) {
      toastRef.current({ title: tr('पहले से पोस्ट', 'Already posted'), description: tr('इस result का Engine Voucher पहले से बना है। (Engine voucher already exists for this result)', 'An Engine Voucher for this result already exists. (Engine voucher already exists for this result)'), variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    // 4. Map the frozen legs → voucher lines (uses ONLY resolvedAccountId; no binding lookup).
    const specs = buildEngineVoucherLines(result.legs);
    if (specs.length === 0) {
      toastRef.current({ title: tr('Legs resolved नहीं', 'Legs not resolved'), description: tr('इस result के legs में resolvedAccountId नहीं है — दोबारा Resolve करें। (Legs are not account-resolved)', 'The legs of this result have no resolvedAccountId — Resolve again. (Legs are not account-resolved)'), variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    if (lotBlocked(result.lotId)) return sentinel;
    const lines: VoucherLine[] = specs.map(s => ({ id: crypto.randomUUID(), accountId: s.accountId, type: s.type, amount: s.amount }));
    const drTotal = specs.filter(s => s.type === 'Dr').reduce((sum, s) => sum + s.amount, 0);
    // 5. Create the immutable engine voucher via the EXISTING accounting path (authoritative record).
    //    Dated the J-Form day (the purchase), not the click day — period / FY correctness.
    const jf = procurementJFormsRef.current.find(j => j.id === result.jformId);
    const lot = procurementLotsRef.current.find(l => l.id === result.lotId);
    const voucher = addVoucher({
      type: 'journal', date: procurementBusinessDate(jf?.createdAt, lot?.createdAt, todayStr(), lot?.lotDate),
      debitAccountId: '', creditAccountId: '', amount: drTotal, lines,
      narration: `MSP खरीद (एजेंट) — J-Form ${jf?.documentNo || result.jformId}`,
      createdBy: user?.name || 'Engine',
      origin: 'engine', refType: 'posting.rule.result', refId: result.id,
    }, opts?.onSaved ? { onSaved: opts.onSaved } : undefined);
    if (!voucher.id) return sentinel;   // addVoucher's own FY/balance guard already toasted
    // 6. Best-effort immutable audit event (procurement-owned; NEVER affects the voucher).
    const now = new Date().toISOString();
    const event: ProcurementEvent = { id: crypto.randomUUID(), correlationId: result.lotId, name: 'engine.voucher.created', occurredAt: now, recordedAt: now, actor: user?.name || 'System', payload: { voucherId: voucher.id, voucherNo: voucher.voucherNo, postingRuleResultId: result.id } };
    setProcurementEventsState(prev => { const u = [...prev, event]; storage.setProcurementEvents(u); return u; });
    supabase.rpc('procurement_commit_transaction', { p_payload: { transactionType: 'engine.voucher.create', transactionId: crypto.randomUUID(), transactionVersion: 1, events: [withSoc(event)] } }).then(({ error }) => {
      if (error) {
        console.warn('engine.voucher.created event commit failed:', error.message);
        setProcurementEventsState(prev => { const r = prev.filter(e => e.id !== event.id); storage.setProcurementEvents(r); return r; });
        toastRef.current({ title: tr('⚠️ Audit event save नहीं हुआ', '⚠️ Audit event not saved'), description: tr(`वाउचर ${voucher.voucherNo} बन गया (मुख्य रिकॉर्ड); पर ऑडिट event क्लाउड में सेव नहीं हुआ: ${error.message}.`, `Voucher ${voucher.voucherNo} was created (main record); but the audit event was not saved to the cloud: ${error.message}.`), variant: 'default', duration: 8000 });
      }
    });
    toastRef.current({ title: tr('बहीखाते में पोस्ट हुआ (4/4)', 'Posted to the books (4/4)'), description: tr(`वाउचर ${voucher.voucherNo} · ${voucher.date}`, `Voucher ${voucher.voucherNo} · ${voucher.date}`), duration: 6000 });
    return voucher;
  }, [user, procurementPostingRuleResults, procurementJForms, procurementLots, procurementQualityTests, addVoucher]);

  // ── Farmer Settlement — the authoritative business document ──────────────────
  // Helper: the live (non-deleted) settlement for an Engine Voucher (1:1). SoT for the operator.
  const settlementForEv = (engineVoucherId: string) =>
    procurementSettlements.find(s => !s.isDeleted && s.engineVoucherId === engineVoucherId);

  // Create the DRAFT settlement for a posted Engine Voucher. Snapshots gross from the ev payable.
  // No accounting, no number yet. Plain upsert (provisional record) with RULE-1 rollback.
  const createFarmerSettlement = useCallback((data: { engineVoucherId: string }): FarmerSettlement => {
    const blank: FarmerSettlement = { id: '', engineVoucherId: data.engineVoucherId, status: 'draft', gross: { amount: 0, currency: 'INR' }, deductionLines: [], netPayable: { amount: 0, currency: 'INR' }, amountPaid: { amount: 0, currency: 'INR' }, createdAt: '', updatedAt: '' };
    if (guardFYLocked()) return blank;
    const ev = vouchersRef.current.find(v => v.id === data.engineVoucherId && !v.isDeleted && isEngineVoucher(v));
    if (!ev) {
      toastRef.current({ title: tr('Engine Voucher नहीं मिला', 'Engine Voucher not found'), description: tr('पहले Post करें। (Post the engine voucher first)', 'Post first. (Post the engine voucher first)'), variant: 'destructive', duration: 8000 });
      return blank;
    }
    if (lotBlocked(lotIdOfEngineVoucher(ev))) return blank;
    if (procurementSettlements.some(s => !s.isDeleted && s.engineVoucherId === ev.id)) {
      toastRef.current({ title: tr('पहले से बना', 'Already created'), description: tr('इस वाउचर का निपटान पहले से मौजूद है। (Settlement already exists)', 'A settlement for this voucher already exists. (Settlement already exists)'), variant: 'destructive', duration: 8000 });
      return blank;
    }
    const now = new Date().toISOString();
    // D1: the procurement value from the NET legs — with the 5116 route the voucher total is twice it.
    const gross: Money = { amount: procurementLegsOf(ev).value, currency: 'INR' };
    const stl: FarmerSettlement = { id: crypto.randomUUID(), engineVoucherId: ev.id, status: 'draft', gross, deductionLines: [], netPayable: { ...gross }, amountPaid: { amount: 0, currency: 'INR' }, createdBy: user?.name || 'System', isDeleted: false, createdAt: now, updatedAt: now };
    setProcurementSettlementsState(prev => { const u = [...prev, stl]; storage.setProcurementSettlements(u); return u; });
    supabase.from('procurement_settlements').upsert(withSoc(stl)).then(({ error }) => {
      if (error) {
        console.error('Settlement create error:', error.message);
        setProcurementSettlementsState(prev => { const r = prev.filter(x => x.id !== stl.id); storage.setProcurementSettlements(r); return r; });
        toastRef.current({ title: tr('निपटान सेव नहीं हुआ', 'Settlement not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा; दोबारा बनाएँ।`, `Not saved to the cloud — ${error.message}. Nothing will go wrong on Refresh; please create it again.`), variant: 'destructive', duration: 12000 });
        return;
      }
      // T-05 dual-write: mirror the money objects into typed columns (step-2, RULE 1 — the base
      // row is already saved; this fails only until migration 017 adds the columns).
      supabase.from('procurement_settlements').update(settlementTypedColumns(stl)).eq('id', stl.id)
        .then(({ error: e2 }) => { if (e2) { console.warn('Settlement typed-money columns (run migration 017):', e2.message); reportError('write-partial', e2.message, { at: 'Settlement typed-money columns (run migration 017):' }); } });
    });
    toastRef.current({ title: tr('निपटान ड्राफ्ट बना', 'Settlement draft created'), description: tr(`सकल ₹${gross.amount}`, `Gross ₹${gross.amount}`), duration: 5000 });
    return stl;
  }, [user, procurementSettlements, procurementQualityTests, procurementPostingRuleResults]);

  // Internal: persist a DRAFT settlement mutation (line add/remove) with optimistic update + rollback.
  const persistDraftSettlement = (prevStl: FarmerSettlement, nextStl: FarmerSettlement) => {
    setProcurementSettlementsState(prev => { const u = prev.map(x => x.id === nextStl.id ? nextStl : x); storage.setProcurementSettlements(u); return u; });
    supabase.from('procurement_settlements').upsert(withSoc(nextStl)).then(({ error }) => {
      if (error) {
        console.error('Settlement update error:', error.message);
        setProcurementSettlementsState(prev => { const u = prev.map(x => x.id === prevStl.id ? prevStl : x); storage.setProcurementSettlements(u); return u; });
        toastRef.current({ title: tr('बदलाव सेव नहीं हुआ', 'Change not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा।`, `Not saved to the cloud — ${error.message}. Nothing will go wrong on Refresh.`), variant: 'destructive', duration: 12000 });
        return;
      }
      // T-05 dual-write (step-2, RULE 1) — mirror the money objects into typed columns.
      supabase.from('procurement_settlements').update(settlementTypedColumns(nextStl)).eq('id', nextStl.id)
        .then(({ error: e2 }) => { if (e2) { console.warn('Settlement typed-money columns (run migration 017):', e2.message); reportError('write-partial', e2.message, { at: 'Settlement typed-money columns (run migration 017):' }); } });
    });
  };

  // Add a deduction LINE to a draft settlement (no accounting). Net Payable = gross − Σ lines (recomputed).
  const addSettlementDeductionLine = useCallback((data: { settlementId: string; deductionType: string; accountId: string; amount: number; reference?: string; remarks?: string }): void => {
    if (guardFYLocked()) return;
    const stl = procurementSettlements.find(s => s.id === data.settlementId && !s.isDeleted);
    if (!stl) { toastRef.current({ title: tr('निपटान नहीं मिला', 'Settlement not found'), description: tr('यह निपटान अब मौजूद नहीं है — पेज refresh करें।', 'This settlement no longer exists — refresh the page.'), variant: 'destructive', duration: 8000 }); return; }
    if (stl.status !== 'draft') { toastRef.current({ title: tr('स्वीकृत निपटान', 'Approved settlement'), description: tr('स्वीकृत निपटान में कटौती नहीं जोड़ सकते। (Cannot edit an approved settlement)', 'Cannot add a deduction to an approved settlement. (Cannot edit an approved settlement)'), variant: 'destructive', duration: 9000 }); return; }
    if (!data.accountId || !accounts.some(a => a.id === data.accountId)) { toastRef.current({ title: tr('खाता चुनें', 'Select an account'), description: tr('कटौती के लिए एक खाता चुनें। (Select a deduction account)', 'Select an account for the deduction. (Select a deduction account)'), variant: 'destructive', duration: 8000 }); return; }
    if (!(data.amount > 0)) { toastRef.current({ title: tr('राशि डालें', 'Enter amount'), description: tr('कटौती राशि 0 से अधिक होनी चाहिए।', 'Deduction amount must be more than 0.'), variant: 'destructive', duration: 8000 }); return; }
    const line: SettlementDeductionLine = { id: crypto.randomUUID(), deductionType: data.deductionType, accountId: data.accountId, amount: { amount: toRupees(toMinor(data.amount)), currency: stl.gross.currency }, reference: data.reference?.trim() || undefined, remarks: data.remarks?.trim() || undefined };
    const lines = [...stl.deductionLines, line];
    const totalDed = toRupees(sumMinor(lines.map(l => toMinor(l.amount.amount))));
    if (totalDed > stl.gross.amount) { toastRef.current({ title: tr('कटौती सकल से अधिक', 'Deduction exceeds gross'), description: tr(`कुल कटौती ₹${totalDed} सकल ₹${stl.gross.amount} से अधिक नहीं हो सकती।`, `Total deduction ₹${totalDed} cannot be more than gross ₹${stl.gross.amount}.`), variant: 'destructive', duration: 9000 }); return; }
    const next: FarmerSettlement = { ...stl, deductionLines: lines, netPayable: { amount: toRupees(subMinor(toMinor(stl.gross.amount), toMinor(totalDed))), currency: stl.gross.currency }, updatedAt: new Date().toISOString() };
    persistDraftSettlement(stl, next);
    toastRef.current({ title: tr('कटौती जोड़ी', 'Deduction added'), description: `${data.deductionType} · ₹${line.amount.amount}`, duration: 5000 });
  }, [accounts, procurementSettlements]);

  // Remove a deduction line from a draft settlement.
  const removeSettlementDeductionLine = useCallback((data: { settlementId: string; lineId: string }): void => {
    if (guardFYLocked()) return;
    const stl = procurementSettlements.find(s => s.id === data.settlementId && !s.isDeleted);
    if (!stl || stl.status !== 'draft') { toastRef.current({ title: tr('संभव नहीं', 'Not possible'), description: tr('केवल ड्राफ्ट निपटान संपादित कर सकते हैं।', 'Only a draft settlement can be edited.'), variant: 'destructive', duration: 8000 }); return; }
    const lines = stl.deductionLines.filter(l => l.id !== data.lineId);
    const totalDed = toRupees(sumMinor(lines.map(l => toMinor(l.amount.amount))));
    const next: FarmerSettlement = { ...stl, deductionLines: lines, netPayable: { amount: toRupees(subMinor(toMinor(stl.gross.amount), toMinor(totalDed))), currency: stl.gross.currency }, updatedAt: new Date().toISOString() };
    persistDraftSettlement(stl, next);
  }, [procurementSettlements]);

  // APPROVE — the single business event (immutable Settlement Transaction). Posts ONE compound
  // deduction voucher (Dr payable Σ / Cr each deduction account) as the accounting CONSEQUENCE, locks
  // Net Payable, and commits the approved settlement + 'settlement.approved' event via the atomic RPC,
  // which assigns the DB-owned gap-free Settlement Number. Voucher is created FIRST (authoritative
  // accounting); on RPC failure it is cancelled and the settlement reverts to draft (RULE 1).
  const approveFarmerSettlement = useCallback((data: { settlementId: string }): FarmerSettlement => {
    const blank = { id: '', engineVoucherId: '', status: 'draft', gross: { amount: 0, currency: 'INR' }, deductionLines: [], netPayable: { amount: 0, currency: 'INR' }, amountPaid: { amount: 0, currency: 'INR' }, createdAt: '', updatedAt: '' } as FarmerSettlement;
    if (guardFYLocked()) return blank;
    const stl = procurementSettlements.find(s => s.id === data.settlementId && !s.isDeleted);
    if (!stl) { toastRef.current({ title: tr('निपटान नहीं मिला', 'Settlement not found'), description: tr('यह निपटान अब मौजूद नहीं है — पेज refresh करें।', 'This settlement no longer exists — refresh the page.'), variant: 'destructive', duration: 8000 }); return blank; }
    if (stl.status !== 'draft') { toastRef.current({ title: tr('पहले से स्वीकृत', 'Already approved'), description: tr('यह निपटान पहले ही स्वीकृत है। (Already approved)', 'This settlement is already approved. (Already approved)'), variant: 'destructive', duration: 8000 }); return blank; }
    const ev = vouchersRef.current.find(v => v.id === stl.engineVoucherId && !v.isDeleted && isEngineVoucher(v));
    if (!ev) { toastRef.current({ title: tr('पोस्टिंग वाउचर नहीं मिला', 'Posting voucher not found'), description: tr('पहले लॉट को "बहीखाता में पोस्ट" करें।', 'First do "Post to books" for the lot.'), variant: 'destructive', duration: 8000 }); return blank; }
    if (lotBlocked(lotIdOfEngineVoucher(ev))) return blank;
    const totalDed = toRupees(sumMinor(stl.deductionLines.map(l => toMinor(l.amount.amount))));
    const netPayable: Money = { amount: toRupees(subMinor(toMinor(stl.gross.amount), toMinor(totalDed))), currency: stl.gross.currency };
    const payableAcc = procurementLegsOf(ev).payableAccountId || ev.creditAccountId;
    const now = new Date().toISOString();

    // Batch A (P0-2): the approval is committed only AFTER its deduction voucher is durably saved. Before,
    // the RPC ran at once — a voucher whose save then failed (and was rolled back) left the settlement
    // "approved" on the server, pointing at a voucher that does not exist, so 2105 and the settlement
    // disagreed. Now: voucher saved → commit the approval; voucher failed → settlement back to draft.
    const event: ProcurementEvent = { id: crypto.randomUUID(), correlationId: ev.id, name: 'settlement.approved', occurredAt: now, recordedAt: now, actor: user?.name || 'System', payload: { settlementId: stl.id, settlementNo: '', engineVoucherId: ev.id, netPayable } };
    let approved: FarmerSettlement = { ...stl, status: 'approved', netPayable, amountPaid: { amount: 0, currency: netPayable.currency }, approvedAt: now, approvedBy: user?.name || 'System', updatedAt: now };
    let settlementVoucherId: string | undefined;
    const revertLocal = () => {
      setProcurementSettlementsState(prev => { const u = prev.map(x => x.id === stl.id ? stl : x); storage.setProcurementSettlements(u); return u; });
      setProcurementEventsState(prev => { const r = prev.filter(e => e.id !== event.id); storage.setProcurementEvents(r); return r; });
    };
    const commitApproval = () => {
      supabase.rpc('procurement_commit_transaction', { p_payload: { transactionType: 'settlement.approve', transactionId: crypto.randomUUID(), transactionVersion: 1, settlements: [withSoc(approved)], events: [withSoc({ ...event, payload: { ...(event.payload as Record<string, unknown>), settlementVoucherId } })] } }).then(({ data: res, error }) => {
        if (error) {
          console.error('Settlement approve commit error:', error.message);
          // RULE 1 — revert to draft AND cancel the accounting consequence so re-approval can't double-post.
          // viaParent: this module owns the voucher (the owner check would otherwise refuse it).
          revertLocal();
          if (settlementVoucherId) cancelVoucher(settlementVoucherId, 'Settlement approval failed (auto-rollback)', user?.name || 'System', { viaParent: true, rollback: true });
          toastRef.current({ title: tr('निपटान स्वीकृत नहीं हुआ', 'Settlement not approved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा; दोबारा approve करें।`, `Not saved to the cloud — ${error.message}. Nothing will go wrong on Refresh; please approve again.`), variant: 'destructive', duration: 12000 });
          return;
        }
        const gen = (res as { settlements?: Array<{ id: string; settlementNo: string }> } | null)?.settlements?.find(s => s.id === stl.id);
        if (gen?.settlementNo) {
          setProcurementSettlementsState(prev => { const u = prev.map(x => x.id === stl.id ? { ...x, settlementNo: gen.settlementNo } : x); storage.setProcurementSettlements(u); return u; });
          setProcurementEventsState(prev => { const u = prev.map(e => e.id === event.id ? { ...e, payload: { ...(e.payload as Record<string, unknown>), settlementNo: gen.settlementNo } } : e); storage.setProcurementEvents(u); return u; });
          toastRef.current({ title: tr('निपटान स्वीकृत', 'Settlement approved'), description: tr(`${gen.settlementNo} · निवल देय ₹${netPayable.amount}`, `${gen.settlementNo} · Net payable ₹${netPayable.amount}`), duration: 6000 });
        }
      });
    };

    // 1. Accounting consequence — ONE compound deduction voucher (only if there are deductions).
    if (totalDed > 0) {
      const lid = () => crypto.randomUUID();
      // Deductions are part of the J-Form, so they carry the posting voucher's (J-Form) date.
      const v = addVoucher({
        type: 'journal', date: ev.date || todayStr(),
        debitAccountId: payableAcc, creditAccountId: stl.deductionLines[0].accountId, amount: totalDed,
        narration: `निपटान कटौती — ${ev.voucherNo}`,
        refType: 'farmer.settlement', refId: stl.id,
        createdBy: user?.name || 'System',
        lines: [
          { id: lid(), accountId: payableAcc, type: 'Dr', amount: totalDed },
          ...stl.deductionLines.map(l => ({ id: lid(), accountId: l.accountId, type: 'Cr' as const, amount: l.amount.amount })),
        ],
      }, {
        onSaved: () => commitApproval(),
        onFailed: () => {
          revertLocal();
          toastRef.current({ title: tr('निपटान स्वीकृत नहीं हुआ', 'Settlement not approved'), description: tr('कटौती वाउचर क्लाउड में सेव नहीं हुआ, इसलिए निपटान फिर से ड्राफ्ट है — दोबारा approve करें।', 'The deduction voucher was not saved to the cloud, so the settlement is back to draft — please approve again.'), variant: 'destructive', duration: 12000 });
        },
      });
      if (!v.id) { toastRef.current({ title: tr('कटौती वाउचर नहीं बना', 'Deduction voucher not created'), description: tr('निपटान स्वीकृत नहीं हुआ — ऊपर की चेतावनी देखें।', 'Settlement not approved — see the warning above.'), variant: 'destructive', duration: 9000 }); return blank; }
      settlementVoucherId = v.id;
      approved = { ...approved, settlementVoucherId };
    }

    // 2. Optimistic local update (a second click now sees "approved"); the server commit follows the
    //    voucher's save, or runs now when there is no deduction voucher.
    setProcurementSettlementsState(prev => { const u = prev.map(x => x.id === stl.id ? approved : x); storage.setProcurementSettlements(u); return u; });
    setProcurementEventsState(prev => { const u = [...prev, event]; storage.setProcurementEvents(u); return u; });
    if (!settlementVoucherId) commitApproval();
    return approved;
  }, [user, procurementSettlements, procurementQualityTests, procurementPostingRuleResults, addVoucher, cancelVoucher]);

  // Farmer Payment — settles the APPROVED settlement's Net Payable. Dr = the Engine Voucher's payable
  // account (its Cr leg); Cr = Cash / selected Bank. Outstanding = netPayable − Σ live farmer.payment
  // vouchers (P0-1: the stored amountPaid is only a cache; trusting it let a failed cache write pay the
  // farmer twice after F5). The cache is refreshed once the voucher is durably saved.
  const recordFarmerPayment = useCallback((data: { engineVoucherId: string; amount: number; mode: 'cash' | 'bank' | 'agency'; bankAccountId?: string; agencyAccountId?: string; paymentDate: string; reference?: string; remarks?: string }): Voucher => {
    const sentinel = { id: '', voucherNo: '', type: 'payment', date: data.paymentDate, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    if (guardFYLocked()) return sentinel;
    const ev = vouchersRef.current.find(v => v.id === data.engineVoucherId && !v.isDeleted && isEngineVoucher(v));
    if (!ev) {
      toastRef.current({ title: tr('Engine Voucher नहीं मिला', 'Engine Voucher not found'), description: tr('पहले Post करें। (Post the engine voucher first)', 'Post first. (Post the engine voucher first)'), variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    if (lotBlocked(lotIdOfEngineVoucher(ev))) return sentinel;
    const stl = procurementSettlements.find(s => !s.isDeleted && s.engineVoucherId === ev.id);
    if (!stl || stl.status !== 'approved') {
      toastRef.current({ title: tr('पहले निपटान स्वीकृत करें', 'Approve the settlement first'), description: tr('भुगतान से पहले निपटान बनाकर स्वीकृत करें। (Approve the settlement before paying)', 'Create and approve the settlement before payment. (Approve the settlement before paying)'), variant: 'destructive', duration: 9000 });
      return sentinel;
    }
    const paidSoFar = farmerPaidByEngineVoucher(vouchersRef.current).get(ev.id) ?? 0;
    const outstanding = toRupees(subMinor(toMinor(stl.netPayable.amount), toMinor(paidSoFar)));
    if (!(data.amount > 0)) {
      toastRef.current({ title: tr('राशि डालें', 'Enter amount'), description: tr('भुगतान राशि 0 से अधिक होनी चाहिए। (Amount must be greater than 0)', 'Payment amount must be more than 0. (Amount must be greater than 0)'), variant: 'destructive', duration: 8000 });
      return sentinel;
    }
    if (data.amount > outstanding) {
      toastRef.current({ title: tr('राशि बकाया से अधिक', 'Amount exceeds outstanding'), description: tr(`भुगतान ₹${data.amount} बकाया ₹${outstanding} से अधिक नहीं हो सकता। (Cannot exceed outstanding)`, `Payment ₹${data.amount} cannot be more than outstanding ₹${outstanding}. (Cannot exceed outstanding)`), variant: 'destructive', duration: 9000 });
      return sentinel;
    }
    const payableAcc = procurementLegsOf(ev).payableAccountId || ev.creditAccountId;
    // ECR: credit side by mode. 'agency' = the agency (Hafed) paid the farmers directly, so
    // the society's cash/bank are untouched — we Cr the agency receivable instead (crediting
    // cash/bank there wrongly drove those balances negative).
    const bankFallback = data.bankAccountId || defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK;
    const creditAcc = resolveFarmerPaymentCredit(data.mode, { cash: ACCOUNT_IDS.CASH, bank: bankFallback, agency: data.agencyAccountId });
    if (data.mode === 'agency' && (!creditAcc || !agencyDirectAccounts(accounts, resolveProcurementAccountId(accounts, 'agencyReceivable'), [procurementLegsOf(ev).receivableAccountId]).some(a => a.id === creditAcc))) {
      toastRef.current({ title: tr('एजेंसी खाता चुनें', 'Select agency account'), description: tr('सीधे-एजेंसी भुगतान के लिए एजेंसी प्राप्य (MSP Receivable) खाता चुनें।', 'For a direct-agency payment, select the agency receivable (MSP Receivable) account.'), variant: 'destructive', duration: 9000 });
      return sentinel;
    }
    if (!creditAcc) return sentinel;
    const lid = () => crypto.randomUUID();
    const ref = data.reference?.trim() ? ` · Ref ${data.reference.trim()}` : '';
    const rem = data.remarks?.trim() ? ` · ${data.remarks.trim()}` : '';
    const modeNote = data.mode === 'agency' ? ' · एजेंसी द्वारा सीधे भुगतान' : '';
    // Authoritative base: the payment voucher (addVoucher self-manages RULE-1 — a failed save removes it,
    // and the derived outstanding comes straight back). The settlement's amountPaid cache is refreshed
    // only after the voucher is durably saved, from the vouchers themselves.
    const refreshPaidCache = () => {
      const paid = farmerPaidByEngineVoucher(vouchersRef.current).get(ev.id) ?? 0;
      const cur = procurementSettlementsRef.current.find(x => x.id === stl.id) ?? stl;
      const next: FarmerSettlement = { ...cur, amountPaid: { amount: paid, currency: stl.netPayable.currency }, updatedAt: new Date().toISOString() };
      setProcurementSettlementsState(prev => { const u = prev.map(x => x.id === stl.id ? next : x); storage.setProcurementSettlements(u); return u; });
      supabase.from('procurement_settlements').upsert(withSoc(next)).then(({ error }) => {
        // Only the cache is stale — every screen reads the payment vouchers — so nothing to roll back.
        if (error) { console.warn('Settlement amountPaid cache update failed:', error.message); reportError('write-partial', error.message, { at: 'procurement_settlements.amountPaid cache' }); }
      });
    };
    const voucher = addVoucher({
      type: 'payment', date: data.paymentDate,
      debitAccountId: payableAcc, creditAccountId: creditAcc, amount: data.amount,
      narration: `किसान को भुगतान — ${ev.voucherNo}${ref}${rem}${modeNote}`,
      refType: FARMER_PAYMENT_REF_TYPE, refId: ev.id,
      createdBy: user?.name || 'System',
      lines: [
        { id: lid(), accountId: payableAcc, type: 'Dr', amount: data.amount },
        { id: lid(), accountId: creditAcc, type: 'Cr', amount: data.amount },
      ],
    }, { onSaved: refreshPaidCache });
    if (!voucher.id) return sentinel;
    return voucher;
  }, [user, accounts, addVoucher, procurementSettlements, procurementQualityTests, procurementPostingRuleResults]);

  // ── Batch B: cancel a procurement lot (RULE 3 cascade) ──────────────────────────────────────────
  // Order: refuse while money has MOVED (farmer paid, agency / commission money received beyond what
  // would stay) → write the cancel on the lot row FIRST (the authority; if that fails nothing else
  // happens) → settlement + its deduction voucher → commission accrual → engine REVERSAL of the
  // posting voucher (the only correction an engine voucher allows) → 'lot.cancelled' event.
  const cancelProcurementLot = useCallback(async (data: { lotId: string; reason: string }): Promise<boolean> => {
    if (guardFYLocked()) return false;
    if (guardPermission('delete', tr('लॉट रद्द करने', 'cancel lots'))) return false;
    const lot = procurementLotsRef.current.find(l => l.id === data.lotId);
    if (!lot) { toastRef.current({ title: tr('लॉट नहीं मिला', 'Lot not found'), description: tr('पेज refresh करें।', 'Refresh the page.'), variant: 'destructive' }); return false; }
    const reason = (data.reason || '').trim();
    const live = vouchersRef.current.filter(v => !v.isDeleted && v.approvalStatus !== 'rejected');
    const rr = procurementRuleResultsRef.current.find(r => r.lotId === lot.id);
    const ev = rr ? live.find(v => isEngineVoucher(v) && v.refType === 'posting.rule.result' && v.refId === rr.id && !v.reversedBy) : undefined;
    const netOn = (accountId: string | null | undefined, vs: Voucher[]) => {
      if (!accountId) return 0;
      let m = 0;
      for (const v of vs) for (const l of getVoucherLines(v)) if (l.accountId === accountId) m = addMinor(m, l.type === 'Dr' ? toMinor(Number(l.amount) || 0) : -toMinor(Number(l.amount) || 0));
      return toRupees(m);
    };
    // D1: the receivable the lot ACTUALLY debited (3308 or the agency's own ledger) and the account the
    // commission accrual debited (3314 or that same agency ledger).
    const mspId = (ev && procurementLegsOf(ev).receivableAccountId) || resolveProcurementAccountId(accounts, 'agencyReceivable');
    const accrual = live.find(v => v.refType === COMMISSION_ACCRUAL_REF_TYPE && v.refId === lot.id);
    const comId = (accrual && procurementLegsOf(accrual).receivableAccountId) || resolveProcurementAccountId(accounts, 'commissionReceivable');
    const sameLedger = !!accrual && comId === mspId;
    const stl = ev ? procurementSettlementsRef.current.find(x => !x.isDeleted && x.engineVoucherId === ev.id) : undefined;
    const dedVoucher = stl?.settlementVoucherId ? live.find(v => v.id === stl.settlementVoucherId) : undefined;
    const blockers = lotCancelBlockers({
      cancelled: isLotCancelled(lot), reason,
      farmerPaid: ev ? (farmerPaidByEngineVoucher(vouchersRef.current).get(ev.id) ?? 0) : 0,
      // One agency ledger carrying BOTH MSP and commission: the commission leaves with the lot too.
      postedAmount: ev ? netOn(mspId, [ev]) + (sameLedger ? netOn(comId, [accrual!]) : 0) : 0, mspReceivable: netOn(mspId, live),
      commissionAccrued: accrual && !sameLedger ? netOn(comId, [accrual]) : 0, commissionReceivable: netOn(comId, live),
    });
    if (blockers.length) {
      toastRef.current({ title: tr('लॉट रद्द नहीं हुआ', 'Lot not cancelled'), description: blockers.map(b => LOT_CANCEL_BLOCKER_TEXT[b]).join(' '), variant: 'destructive', duration: 15000 });
      return false;
    }
    // The vouchers this cascade cancels must sit in an open period (the reversal posts today).
    if (guardPeriodLock(todayStr(), dedVoucher?.date, accrual?.date)) return false;

    // 1. The authority: the lot row (migration 135 columns). Nothing else moves unless this saved.
    const by = user?.name || 'System';
    const at = new Date().toISOString();
    const { data: saved, error } = await supabase.from('procurement_lots')
      .update({ cancelledAt: at, cancelledBy: by, cancelReason: reason, updatedAt: at }).eq('id', lot.id).select('id');
    if (error || !saved?.length) {
      toastRef.current({ title: tr('लॉट रद्द नहीं हुआ', 'Lot not cancelled'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error?.message || 'लॉट नहीं मिला / अनुमति नहीं'}. (Migration 135 चलाई है?) कुछ भी बदला नहीं गया।`, `Not saved to the cloud — ${error?.message || 'lot not found / not permitted'}. (Has Migration 135 been run?) Nothing was changed.`), variant: 'destructive', duration: 15000 });
      return false;
    }
    const cancelledLot: ProcurementLot = { ...lot, cancelledAt: at, cancelledBy: by, cancelReason: reason, updatedAt: at };
    procurementLotsRef.current = procurementLotsRef.current.map(l => l.id === lot.id ? cancelledLot : l);
    setProcurementLotsState(prev => { const u = prev.map(l => l.id === lot.id ? cancelledLot : l); storage.setProcurementLots(u); return u; });

    const left: string[] = [];
    // X-3: a cancel the cloud refuses LATER (after the summary toast below) is named in its own warning.
    const lateLeft = (what: string) => () => toastRef.current({ title: tr('⚠ लॉट रद्द हुआ, पर एक वाउचर बाकी है', '⚠ Lot cancelled, but one voucher remains'), description: tr(`${what} क्लाउड पर रद्द नहीं हुआ — इसे हाथ से ठीक करें (या admin को बताएँ)।`, `${what} was not cancelled on the cloud — fix it manually (or tell the admin).`), variant: 'destructive', duration: 20000 });
    // 2. Settlement (draft or approved) + its deduction voucher.
    if (stl) {
      if (dedVoucher && !cancelVoucher(dedVoucher.id, `Lot cancelled — ${reason}`, by, { viaParent: true, onFailed: lateLeft(tr(`कटौती वाउचर ${dedVoucher.voucherNo}`, `Deduction voucher ${dedVoucher.voucherNo}`)) })) left.push(`कटौती वाउचर ${dedVoucher.voucherNo}`);
      const gone: FarmerSettlement = { ...stl, isDeleted: true, updatedAt: at };
      setProcurementSettlementsState(prev => { const u = prev.map(x => x.id === stl.id ? gone : x); storage.setProcurementSettlements(u); return u; });
      const { error: se } = await supabase.from('procurement_settlements').upsert(withSoc(gone));
      if (se) { reportError('write-partial', se.message, { at: 'cancelProcurementLot settlement' }); left.push(tr(`निपटान ${stl.settlementNo || ''} (${se.message})`, `Settlement ${stl.settlementNo || ''} (${se.message})`)); }
    }
    // 3. Commission accrual.
    if (accrual && !cancelVoucher(accrual.id, `Lot cancelled — ${reason}`, by, { viaParent: true, onFailed: lateLeft(tr(`कमीशन वाउचर ${accrual.voucherNo}`, `Commission voucher ${accrual.voucherNo}`)) })) left.push(`कमीशन वाउचर ${accrual.voucherNo}`);
    // 4. The posting voucher: an engine reversal (equal and opposite), dated today.
    if (ev && rr && !reverseVoucher(ev.id, `Lot cancelled — ${reason}`, { engine: { refType: ENGINE_REVERSAL_REF_TYPE, refId: rr.id } })) left.push(`पोस्टिंग वाउचर ${ev.voucherNo} का reversal`);
    // 5. Immutable audit event (best-effort; the lot row is the record).
    const event: ProcurementEvent = { id: crypto.randomUUID(), correlationId: lot.id, name: 'lot.cancelled', occurredAt: at, recordedAt: at, actor: by, payload: { lotId: lot.id, reason, engineVoucherId: ev?.id, settlementId: stl?.id, commissionVoucherId: accrual?.id } };
    setProcurementEventsState(prev => { const u = [...prev, event]; storage.setProcurementEvents(u); return u; });
    supabase.rpc('procurement_commit_transaction', { p_payload: { transactionType: 'lot.cancel', transactionId: crypto.randomUUID(), transactionVersion: 1, events: [withSoc(event)] } }).then(({ error: ee }) => {
      if (ee) reportError('write-partial', ee.message, { at: 'lot.cancelled event' });
    });

    if (left.length) {
      toastRef.current({ title: tr('⚠ लॉट रद्द हुआ, पर कुछ बाकी है', '⚠ Lot cancelled, but some steps remain'), description: tr(`लॉट रद्द दर्ज है, लेकिन ये नहीं हो पाए: ${left.join(', ')}। ऊपर की चेतावनी देखें और इन्हें हाथ से ठीक करें (या admin को बताएँ)।`, `The lot is recorded as cancelled, but these could not be done: ${left.join(', ')}. See the warning above and fix them manually (or tell the admin).`), variant: 'destructive', duration: 20000 });
    } else {
      toastRef.current({ title: tr('लॉट रद्द हुआ', 'Lot cancelled'), description: ev ? tr(`पोस्टिंग ${ev.voucherNo} का reversal बना${stl ? ', निपटान रद्द' : ''}${accrual ? ', कमीशन रद्द' : ''}।`, `Reversal created for posting ${ev.voucherNo}${stl ? ', settlement cancelled' : ''}${accrual ? ', commission cancelled' : ''}.`) : tr('लॉट रद्द दर्ज हुआ।', 'Lot cancellation recorded.'), duration: 8000 });
    }
    return true;
  }, [user, accounts, cancelVoucher, reverseVoucher, guardPeriodLock]);

  // Only active vouchers for all financial calculations. A voucher counts iff:
  //  • not soft-deleted, AND
  //  • not REJECTED — rejected vouchers must never affect reports (the SQL side already
  //    drops them via deleteEntries; this closes the client-vs-SQL divergence so both agree), AND
  //  • not a held PENDING voucher — whatever society.approvalRequired says: the approval matrix
  //    also holds by amount threshold / voucher type with the flag OFF, and a pending voucher has
  //    no journal event until approve_voucher posts it (lib/countedVoucher — the ONE shared rule).
  // Memoised so its reference is stable across renders: it's the base list nearly every report
  // reads, and an inline .filter() made a fresh array each render — needlessly re-running the
  // report useCallbacks (and defeating any downstream memo) that depend on it. Same contents.
  const activeVouchers = useMemo(() => vouchers.filter(v =>
    isCountedVoucher(v) &&
    // ECR-17: branch scope — 'all' (default) = consolidated (no filter). Legacy
    // unbranched vouchers map to the Head Office. Additive — no regression on 'all'.
    matchesBranch(v.branchId, activeBranchId, headOfficeBranchId)
  ), [vouchers, activeBranchId, headOfficeBranchId]);

  // ECR-17 Phase 4: shared predicate for branch-scoping non-voucher entities
  // (sales / purchases / members) in report pages. Same rule as activeVouchers.
  const matchesActiveBranch = useCallback((branchId?: string) =>
    matchesBranch(branchId, activeBranchId, headOfficeBranchId), [activeBranchId, headOfficeBranchId]);

  // ECR-17: society-level (unbranched) values — account OPENING BALANCES, physical stock — belong
  // to the Head Office, exactly like an unbranched voucher. Every balance formula below multiplies
  // its opening by this flag; otherwise each branch's TB carried the full society openings and the
  // branch Balance Sheets double-counted them against the consolidated one (silently — a TB built
  // from self-balancing vouchers plus two-sided openings always still "balances").
  const openingsInScope = unbranchedInScope(activeBranchId, headOfficeBranchId);

  // One-pass signed balance (opening + Σ Dr − Cr legs) per account, memoised on [accounts,
  // activeVouchers]. getAccountBalance was O(vouchers×lines) PER CALL and is called in loops and
  // even sort comparators (Customers/FundRegister reduce, LedgerHeads sort, asset/fund/share
  // reconciliation) → O(N×vouchers×lines). Building every balance once makes each lookup O(1).
  // T-02: summed in exact integer paise so it can't drift over many legs (RULE 2) — identical numbers.
  const accountBalanceMinorMap = useMemo(() => {
    const txn = new Map<string, Minor>();
    activeVouchers.forEach(v => {
      getVoucherLines(v).forEach(l => {
        const legMinor = toMinor(Number(l.amount) || 0);
        txn.set(l.accountId, addMinor(txn.get(l.accountId) ?? 0, l.type === 'Dr' ? legMinor : -legMinor));
      });
    });
    const bal = new Map<string, Minor>();
    accounts.forEach(a => {
      const opening = openingsInScope
        ? (a.openingBalanceType === 'debit' ? (Number(a.openingBalance) || 0) : -(Number(a.openingBalance) || 0))
        : 0;
      bal.set(a.id, addMinor(toMinor(opening), txn.get(a.id) ?? 0));
    });
    return bal;
  }, [accounts, activeVouchers, openingsInScope]);

  // T-09 (ADR-0001): the ledger-derived balance map — non-null ONLY when this tenant is cut over AND
  // the journal reproduces the vouchers (parity checked ONCE here, not per getAccountBalance call, so
  // the O(1) primitive stays O(1)). Null ⇒ dormant / parity failed ⇒ getAccountBalance uses the
  // voucher-state map below (default). balancesFromJournal nets openings + postings per account (paise).
  const ledgerBalanceMinorMap = useMemo((): Map<string, Minor> | null => {
    if (!society?.ledgerReadsEnabled) return null;
    // ECR-17 × T-09: the journal is society-wide — ledger balances serve only the consolidated view.
    if (activeBranchId !== ALL_BRANCHES) return null;
    const journal = ledgerEventsRef.current;
    if (!ledgerParity(journal, activeVouchers, accounts).matches) return null;
    return new Map(Object.entries(balancesFromJournal(journal)));
  }, [accounts, activeVouchers, society?.ledgerReadsEnabled, activeBranchId]);

  const getAccountBalance = useCallback((accountId: string): number => {
    // When cut over (ledgerBalanceMinorMap present), read the balance from the journal; else the
    // voucher-state map. An account absent from either map has a zero balance.
    const src = ledgerBalanceMinorMap ?? accountBalanceMinorMap;
    const m = src.get(accountId);   // undefined ⇒ unknown account (was `if (!account) return 0`)
    return m === undefined ? 0 : toRupees(m);
  }, [accountBalanceMinorMap, ledgerBalanceMinorMap]);
  // Keep the Tally-style balance guard pointed at the live balance function (declared far above,
  // before the delete guards). Effects run after render, so no temporal-dead-zone concern.
  useEffect(() => { accountBalanceFnRef.current = getAccountBalance; }, [getAccountBalance]);

  // P0 #4 / ECR-05 (MS-03): detect drift between the member scalar (subsidiary) and the
  // Share-Capital ledger account (control). getAccountBalance returns a signed (Dr−Cr)
  // balance, so negate for the equity credit magnitude. Detection only — nothing is mutated.
  const getShareCapitalReconciliation = useCallback((): ShareCapitalReconciliation => {
    const controlBalance = -getAccountBalance(ACCOUNT_IDS.SHARE_CAP);
    return reconcileShareCapital(sumActiveMemberShareCapital(members), controlBalance);
  }, [members, getAccountBalance]);

  // ECR-05 (asset side): Asset Register cost vs the fixed-asset ledger control. Detects the
  // other dual-source-of-truth the register calls out. Read-only — mirrors the share recon.
  const getAssetRegisterReconciliation = useCallback((): AssetReconciliation => {
    const registerTotal = sumActiveAssetCost(assets);
    const controlBalance = accounts
      .filter(a => a.subtype === 'fixed_asset' && !a.isGroup)
      .reduce((s, a) => s + getAccountBalance(a.id), 0);   // Dr (gross cost)
    return reconcileAssetRegister(registerTotal, controlBalance);
  }, [assets, accounts, getAccountBalance]);

  // ECR-27: spend a statutory fund (Education/Building/Welfare/etc.) — Dr fund / Cr cash|bank.
  // Balance-guarded (can't exceed the fund's corpus), FY-locked, and utilisation above
  // ₹50,000 requires a committee/AGM resolution number (stored in the narration for audit).
  const FUND_RESOLUTION_THRESHOLD = 50000;
  const recordFundUtilisation = useCallback((data: { fundAccountId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; purpose?: string; resolutionNo?: string }): Voucher | null => {
    if (guardFYLocked()) return null;
    const fund = accounts.find(a => a.id === data.fundAccountId);
    if (!fund || !isFundAccount(fund)) { toastRef.current({ title: tr('निधि खाता नहीं मिला', 'Fund account not found'), description: 'Fund account not found or not a reserve fund.', variant: 'destructive', duration: 8000 }); return null; }
    if (!(data.amount > 0)) { toastRef.current({ title: tr('राशि डालें', 'Enter amount'), description: tr('राशि 0 से अधिक होनी चाहिए।', 'Amount must be more than 0.'), variant: 'destructive', duration: 8000 }); return null; }
    // Balance guard — never spend more than the fund currently holds (corpus).
    const corpus = buildFundStatement(fund, vouchersRef.current.filter(isCountedVoucher)).closing;
    if (data.amount > corpus + 0.005) {
      toastRef.current({ title: tr('निधि में पर्याप्त शेष नहीं', 'Not enough balance in the fund'), description: tr(`${fund.nameHi || fund.name} में केवल ₹${corpus.toLocaleString('en-IN')} उपलब्ध है — इससे अधिक उपयोग नहीं हो सकता।`, `Only ₹${corpus.toLocaleString('en-IN')} is available in ${fund.nameHi || fund.name} — you cannot use more than this.`), variant: 'destructive', duration: 12000 });
      return null;
    }
    // Governance gate — large utilisation needs a resolution reference.
    if (data.amount > FUND_RESOLUTION_THRESHOLD && !data.resolutionNo?.trim()) {
      toastRef.current({ title: tr('प्रस्ताव संख्या आवश्यक', 'Resolution number required'), description: tr(`₹${FUND_RESOLUTION_THRESHOLD.toLocaleString('en-IN')} से ऊपर निधि उपयोग के लिए समिति/AGM प्रस्ताव संख्या दर्ज करें।`, `For fund use above ₹${FUND_RESOLUTION_THRESHOLD.toLocaleString('en-IN')}, enter the committee/AGM resolution number.`), variant: 'destructive', duration: 12000 });
      return null;
    }
    const bankAcc = data.mode === 'cash' ? ACCOUNT_IDS.CASH : (data.bankAccountId || defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK);
    const lid = () => crypto.randomUUID();
    const resNote = data.resolutionNo?.trim() ? `प्रस्ताव ${data.resolutionNo.trim()}` : '';
    const note = [data.purpose?.trim(), resNote].filter(Boolean).join(' · ');
    const v = addVoucher({
      type: 'payment', date: data.date,
      debitAccountId: data.fundAccountId, creditAccountId: bankAcc, amount: data.amount,
      narration: `निधि उपयोग — ${fund.nameHi || fund.name}${note ? ` · ${note}` : ''}`,
      refType: 'fund.utilisation', refId: data.fundAccountId,
      createdBy: user?.name || 'System',
      lines: [
        { id: lid(), accountId: data.fundAccountId, type: 'Dr', amount: data.amount },
        { id: lid(), accountId: bankAcc, type: 'Cr', amount: data.amount },
      ],
    });
    if (v?.id) toastRef.current({ title: tr('निधि उपयोग दर्ज', 'Fund use recorded'), description: `${fund.nameHi || fund.name} · ₹${data.amount.toLocaleString('en-IN')}`, duration: 6000 });
    return v?.id ? v : null;
  }, [accounts, addVoucher, user]);

  // T-09 (ADR-0001) — the read cut for the reports the TRIAL-BALANCE parity gate cannot vouch for
  // (cash book, bank book, member ledger, R&P). Those are transaction LISTS: a projection bug moves
  // rows, not net balances, so ledgerParity would let it through. So each one carries its OWN gate —
  // project it from the journal and serve that ONLY when it is identical, row for row, to the report
  // computed from the vouchers. Any difference (journal not seeded/loaded, a branch filter narrowing
  // the vouchers, a projection gap) silently falls back to the voucher compute, so a flipped tenant
  // can never be shown a number the vouchers disagree with. Flag off (default) ⇒ nothing runs.
  // Each gate's last verdict, keyed by report — this is what getLedgerReportParity reports. Populated
  // when the tenant is cut over, or when the diagnostic asks for it (the PRE-flight, before any flip).
  const reportParityRef = useRef<Map<string, ReportParityResult>>(new Map());
  const parityDiagnosticRef = useRef(false);

  const ledgerReport = useCallback(<T,>(
    report: string,
    fromVouchers: T,
    project: () => T,
    parity: (ledger: T, vouchers: T) => ReportParityResult,
  ): T => {
    // ECR-17 × T-09: the journal is society-wide, so ledger reads serve only the consolidated view —
    // in a branch view the voucher compute is scoped and the projection is not, so they'd never match.
    const cutOver = !!societyRef.current?.ledgerReadsEnabled && activeBranchIdRef.current === ALL_BRANCHES;
    if (!cutOver && !parityDiagnosticRef.current) return fromVouchers;
    try {
      const fromJournal = project();
      const verdict = parity(fromJournal, fromVouchers);
      reportParityRef.current.set(report, verdict);
      return cutOver && verdict.matches ? fromJournal : fromVouchers;
    } catch (e) {
      // A report must never fail because of the shadow journal — fall back, and record why.
      reportParityRef.current.set(report, { matches: false, diffs: [{ field: 'exception', ledger: String(e), vouchers: '' }] });
      return fromVouchers;
    }
  }, []);

  const getCashBookEntries = useCallback((fromDate?: string, toDate?: string): CashBookEntry[] => {
    // K4: the voucher-state compute is a pure module (lib/reports/accountBook) — same formula, testable alone.
    const book = computeCashBook({ accounts, vouchers: activeVouchers, accountId: ACCOUNT_IDS.CASH, fromDate, toDate, openingsInScope });
    if (!book) return [];
    const { entries: result, openingMinor } = book;
    return ledgerReport<CashBookEntry[]>(
      'cashBook',
      result,
      () => ledgerCashBookEntries(ledgerEventsRef.current, ACCOUNT_IDS.CASH, accounts, { openingMinor, fromDate, toDate }),
      cashBookParity,
    );
  }, [accounts, activeVouchers, ledgerReport, openingsInScope]);

  const getBankBookEntries = useCallback((fromDate?: string, toDate?: string, bankAccountId?: string): BankBookEntry[] => {
    const targetBankId = bankAccountId || defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK;
    // K4: the voucher-state compute is a pure module (lib/reports/accountBook) — same formula, testable alone.
    const book = computeBankBook({ accounts, vouchers: activeVouchers, accountId: targetBankId, fromDate, toDate, openingsInScope });
    if (!book) return [];
    const { entries: result, openingMinor } = book;
    return ledgerReport<BankBookEntry[]>(
      `bankBook:${targetBankId}`,
      result,
      () => ledgerBankBookEntries(ledgerEventsRef.current, targetBankId, accounts, { openingMinor, fromDate, toDate }),
      bankBookParity,
    );
  }, [accounts, activeVouchers, ledgerReport, openingsInScope]);

  // BUG-03 FIX: Accept optional asOnDate to filter vouchers up to that date.
  const getTrialBalance = useCallback((asOnDate?: string): AccountBalance[] => {
    // Phase-2 C (D1, one continuous ledger): the opening columns are the balance brought forward at the
    // start of the as-of date's financial year — earlier years' vouchers fold into it — and the
    // transaction columns hold only that year. Net balances are unchanged; a society whose vouchers all
    // sit in one year sees exactly the old columns.
    const tbFyStart = asOnDate ? fyStartOf(asOnDate) : fyStartFromLabel(societyRef.current?.financialYear);
    // T-09 (ADR-0001): the ledger read cut. When this tenant is cut over AND the journal reproduces
    // the vouchers RIGHT NOW (ledgerParity — belt-and-suspenders), serve the trial balance from the
    // event log. If parity fails (journal not fully loaded/seeded, or drifted) we fall through to the
    // voucher-state compute below — so a flip can never break a report. Default flag off ⇒ today.
    // ECR-17 × T-09: the journal is society-wide, so ledger reads serve ONLY the consolidated view.
    // (Without this, a society whose vouchers all sit in one branch could pass parity in that
    // branch's view and be served the full-openings ledger TB, contradicting openingsInScope.)
    if (societyRef.current?.ledgerReadsEnabled
      && activeBranchIdRef.current === ALL_BRANCHES
      && ledgerParity(ledgerEventsRef.current, activeVouchers, accounts).matches) {
      return ledgerTrialBalance(ledgerEventsRef.current, accounts, asOnDate, tbFyStart);
    }

    // K1: the voucher-state compute is a pure module (lib/reports/trialBalance) — same formula, testable alone.
    return computeTrialBalance({ accounts, vouchers: activeVouchers, asOnDate, fyStart: tbFyStart, openingsInScope });
  }, [accounts, activeVouchers, openingsInScope, society.financialYear]);

  const getMemberLedger = useCallback((memberId: string): MemberLedgerEntry[] => {
    const member = members.find(m => m.id === memberId);
    if (!member) return [];

    // Member Portal S0: the voucher-path khata lives in lib/memberSnapshot so the member's own view
    // runs the SAME formula (RULE 2).
    const result = buildMemberShareLedger(member, activeVouchers, ACCOUNT_IDS.SHARE_CAP);

    return ledgerReport<MemberLedgerEntry[]>(
      `memberLedger:${memberId}`,
      result,
      // The opening (member.shareCapital) and joinDate are MEMBER data, not journal data — the
      // projection applies the same "OB row only when no share-capital voucher exists" rule.
      () => ledgerMemberLedgerEntries(ledgerEventsRef.current, memberId, ACCOUNT_IDS.SHARE_CAP, {
        openingMinor: toMinor(member.shareCapital || 0),
        joinDate: member.joinDate,
      }),
      memberLedgerParity,
    );
  }, [members, activeVouchers, ledgerReport]);

  // ECR-16 / MS-03: per-member share reconciliation — the voucher-derived ledger balance
  // vs the member.shareCapital scalar (extends the global P0 #4 reconciliation to each member).
  const getMemberShareReconciliation = useCallback((memberId: string): ShareCapitalReconciliation | null => {
    const member = members.find(m => m.id === memberId);
    if (!member) return null;
    const entries = getMemberLedger(memberId);
    const ledgerBalance = entries.length ? entries[entries.length - 1].balance : (member.shareCapital || 0);
    return reconcileShareCapital(member.shareCapital || 0, ledgerBalance);
  }, [members, getMemberLedger]);

  // Sureties are a late-added column (169): never part of the base upsert (a database without the column would
  // refuse the whole loan), saved in a second step. If that step fails the loan row is safe; the sureties are taken
  // back off the screen so it never shows something a refresh would lose (RULE 1).
  const refuseBadSureties = (memberId: string, sureties: Loan['sureties']): boolean => {
    const p = suretyProblem(memberId, sureties);
    if (!p) return false;
    const msg = p === 'self'
      ? tr('ऋणी अपना ही ज़मानतदार नहीं हो सकता।', 'The borrower cannot be their own surety.')
      : p === 'duplicate' ? tr('एक ही सदस्य दो बार ज़मानतदार नहीं हो सकता।', 'The same member cannot be a surety twice.')
      : tr('जो ज़मानतदार सदस्य नहीं है उसका नाम भरें।', 'Enter the name of a surety who is not a member.');
    toastRef.current({ title: tr('ज़मानतदार ठीक करें', 'Fix the sureties'), description: tr(`${msg} ऋण सेव नहीं हुआ।`, `${msg} The loan was not saved.`), variant: 'destructive', duration: 10000 });
    return true;
  };
  const saveLoanSureties = (loanId: string, sureties: NonNullable<Loan['sureties']>, restore: Loan['sureties']) => {
    supabase.from('loans').update(asDbRow({ sureties })).eq('id', loanId).eq('society_id', societyIdRef.current).then(({ error }) => {
      if (!error) return;
      reportError('write-partial', error.message, { at: 'Loan sureties', loanId });
      loansRef.current = loansRef.current.map(l => l.id === loanId ? { ...l, sureties: restore } : l);
      setLoansState(prev => prev.map(l => l.id === loanId ? { ...l, sureties: restore } : l));
      toastRef.current({ title: tr('ज़मानतदार सेव नहीं हुए', 'Sureties not saved'), description: tr(`ऋण सुरक्षित है, पर ज़मानतदार cloud पर नहीं गए — ${error.message}. अगर यह "column sureties" कहता है तो Supabase में migration 169 चलानी बाकी है। ज़मानतदार दोबारा भरें।`, `The loan is safe, but the sureties did not reach the cloud — ${error.message}. If it mentions "column sureties", migration 169 has not been run in Supabase yet. Enter the sureties again.`), variant: 'destructive', duration: 15000 });
    });
  };

  // The monthly instalment is its own late-added column (170) and its own step-2 write: one un-migrated column must
  // not take the sureties (169) down with it, so the two are never sent in the same update.
  const saveLoanInstalment = (loanId: string, monthlyInstallment: number | null, restore: Loan['monthlyInstallment']) => {
    supabase.from('loans').update({ monthlyInstallment }).eq('id', loanId).eq('society_id', societyIdRef.current).then(({ error }) => {
      if (!error) return;
      reportError('write-partial', error.message, { at: 'Loan monthly instalment', loanId });
      loansRef.current = loansRef.current.map(l => l.id === loanId ? { ...l, monthlyInstallment: restore } : l);
      setLoansState(prev => prev.map(l => l.id === loanId ? { ...l, monthlyInstallment: restore } : l));
      toastRef.current({ title: tr('मासिक किस्त सेव नहीं हुई', 'Monthly instalment not saved'), description: tr(`ऋण सुरक्षित है, पर मासिक किस्त cloud पर नहीं गई — ${error.message}. अगर यह "column monthlyInstallment" कहता है तो Supabase में migration 170 चलानी बाकी है। किस्त दोबारा भरें।`, `The loan is safe, but the monthly instalment did not reach the cloud — ${error.message}. If it mentions "column monthlyInstallment", migration 170 has not been run in Supabase yet. Enter the instalment again.`), variant: 'destructive', duration: 15000 });
    });
  };
  /** A fixed instalment is a positive amount no larger than the loan; anything else means "not fixed" (null). */
  const cleanInstalment = (v: Loan['monthlyInstallment']): number | null => { const n = Number(v); return Number.isFinite(n) && n > 0 ? toRupees(toMinor(n)) : null; };
  const refuseBadInstalment = (instalment: number | null, amount: number): boolean => {
    if (instalment === null || instalment <= amount + 0.005) return false;
    toastRef.current({ title: tr('मासिक किस्त ठीक करें', 'Fix the monthly instalment'), description: tr('मासिक किस्त ऋण राशि से ज़्यादा नहीं हो सकती। ऋण सेव नहीं हुआ।', 'The monthly instalment cannot be more than the loan amount. The loan was not saved.'), variant: 'destructive', duration: 10000 });
    return true;
  };

  const addLoan = useCallback((data: Omit<Loan, 'id' | 'loanNo' | 'createdAt'>): Loan => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as Loan;
    if (refuseNonLiveMember(data.memberId, tr('ऋण', 'Loan'))) return { ...data, id: '' } as unknown as Loan;
    if (refuseBadSureties(data.memberId, data.sureties)) return { ...data, id: '' } as unknown as Loan;
    if (refuseBadInstalment(cleanInstalment(data.monthlyInstallment), data.amount)) return { ...data, id: '' } as unknown as Loan;
    data = { ...data, sureties: normalizeSureties(data.sureties), monthlyInstallment: cleanInstalment(data.monthlyInstallment) };
    const fy = society.financialYear;
    const maxNum = loansRef.current.filter(l => l.loanNo?.includes(fy)).reduce((max, l) => {
      const m = l.loanNo?.match(/\/(\d+)$/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const loanNo = `L/${fy}/${String(maxNum + 1).padStart(3, '0')}`;
    const newLoan: Loan = { ...data, id: crypto.randomUUID(), loanNo, createdAt: new Date().toISOString() };
    loansRef.current = [...loansRef.current, newLoan];
    setLoansState(prev => { const updated = [...prev, newLoan]; return updated; });
    // T-03 (ADR-0005): take the OFFICIAL loanNo from the server sequence (book 'L') at persist,
    // restamp local state. Falls back to the client-provisional number on offline/RPC failure.
    issueOfficialNumber(nextDocNumber, societyIdRef.current, newLoan.loanNo).then((officialNo) => {
      const loanToSave = (officialNo && officialNo !== newLoan.loanNo) ? { ...newLoan, loanNo: officialNo } : newLoan;
      if (loanToSave !== newLoan) {
        loansRef.current = loansRef.current.map(l => l.id === newLoan.id ? loanToSave : l);
        setLoansState(prev => prev.map(l => l.id === newLoan.id ? loanToSave : l));
      }
      const { sureties: loanSuretiesToSave, monthlyInstallment: loanInstalmentToSave, ...loanBase } = loanToSave;   // step 1: base columns only
      supabase.from('loans').upsert(withSoc(loanBase)).then(({ error }) => {
        if (!error && loanSuretiesToSave && loanSuretiesToSave.length > 0) saveLoanSureties(newLoan.id, loanSuretiesToSave, []);   // step 2
        if (!error && loanInstalmentToSave) saveLoanInstalment(newLoan.id, loanInstalmentToSave, null);   // step 2 (own write)
        if (error) {
          console.error('DB sync error:', error.message); reportError('db-sync', error.message);
          loansRef.current = loansRef.current.filter(l => l.id !== newLoan.id);
          setLoansState(prev => prev.filter(l => l.id !== newLoan.id));   // RULE 1: roll back
          toastRef.current({ title: tr('ऋण सेव नहीं हुआ', 'Loan not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा; दोबारा जोड़ें।`, `Not saved to the cloud — ${error.message}. Nothing will go wrong on Refresh; please add it again.`), variant: 'destructive', duration: 12000 });
        }
      });
    });

    // M16: Create disbursement voucher so loan appears as an asset in Trial Balance / Balance Sheet.
    // Dr: Loans & Advances (3304) for principal; Cr: Cash (default) — user can re-class later from Vouchers.
    // Tolerant of chart-of-accounts variants: if 3304 isn't present, look for any account whose name
    // contains "Loans" under parent 3300.
    if (newLoan.amount > 0) {
      const loanAccount = accounts.find(a => a.id === '3304')
        || accounts.find(a => a.parentId === '3300' && /loan/i.test(a.name) && !a.isGroup);
      if (loanAccount) {
        const member = membersRef.current.find(m => m.id === newLoan.memberId);
        const dv = addVoucher({
          type: 'payment',
          date: newLoan.disbursementDate || new Date().toISOString().split('T')[0],
          debitAccountId: loanAccount.id,
          creditAccountId: ACCOUNT_IDS.CASH,
          amount: newLoan.amount,
          narration: `Loan ${loanNo} disbursed to ${member?.name || newLoan.memberId} — ${newLoan.purpose || newLoan.loanType}`,
          createdBy: user?.name ?? 'System',
          memberId: newLoan.memberId,
        });
        // P0-3: remember the disbursement voucher's id on the loan so deleteLoan cancels
        // exactly it (not a fragile narration-substring match). voucherId is a late-added
        // column → best-effort step-2 update; the base loan row (upserted above) stays safe.
        if (dv?.id) {
          newLoan.voucherId = dv.id;
          loansRef.current = loansRef.current.map(l => l.id === newLoan.id ? { ...l, voucherId: dv.id } : l);
          setLoansState(prev => prev.map(l => l.id === newLoan.id ? { ...l, voucherId: dv.id } : l));
          supabase.from('loans').update({ voucherId: dv.id }).eq('id', newLoan.id).then(({ error }) => { if (error) { console.warn('Loan voucherId patch:', error.message); reportError('write-partial', error.message, { at: 'Loan voucherId patch:' }); } });
        }
      } else {
        toastRef.current({
          title: 'Loan saved, voucher skipped',
          description: 'No "Loans & Advances" (3304) account found. Trial Balance will not show this loan until you add a manual disbursement voucher.',
          variant: 'default',
        });
      }
    }

    return newLoan;
  }, [society.financialYear, accounts, addVoucher, user?.name]);

  const updateLoan = useCallback((id: string, data: Partial<Loan>, opts?: { onSaved?: () => void }): boolean => {
    if (guardFYLocked()) return false;
    const before = loansRef.current.find(l => l.id === id);
    if (!before) return false;
    const suretiesChanged = 'sureties' in data;
    if (suretiesChanged && refuseBadSureties(data.memberId ?? before.memberId, data.sureties)) return false;
    if (suretiesChanged) data = { ...data, sureties: normalizeSureties(data.sureties) };
    const instalmentChanged = 'monthlyInstallment' in data;
    if (instalmentChanged) {
      if (refuseBadInstalment(cleanInstalment(data.monthlyInstallment), data.amount ?? before.amount)) return false;
      data = { ...data, monthlyInstallment: cleanInstalment(data.monthlyInstallment) };
    }
    const updated = { ...before, ...data };
    setLoansState(prev => prev.map(l => l.id === id ? updated : l));
    const { sureties: updatedSureties, monthlyInstallment: updatedInstalment, ...updatedBase } = updated;   // step 1: base columns only (169, 170 go in step 2)
    patchRow('loans', id, before, updatedBase).then(({ error }) => {
      if (!error && suretiesChanged) saveLoanSureties(id, updatedSureties ?? [], before.sureties);   // step 2
      if (!error && instalmentChanged && (updatedInstalment ?? null) !== (before.monthlyInstallment ?? null)) saveLoanInstalment(id, updatedInstalment ?? null, before.monthlyInstallment);   // step 2 (own write), only when it really changed
      if (error) {
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        setLoansState(prev => prev.map(l => l.id === id ? before : l));   // RULE 1: roll back to prior state
        toastRef.current({ title: tr('अपडेट सेव नहीं हुआ', 'Update not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh the old data will come back.`), variant: 'destructive', duration: 12000 });
        return;
      }
      opts?.onSaved?.();   // NEW-08: the page's "Loan updated" toast waits for this
    });
    return true;
  }, []);
  updateLoanRef.current = updateLoan;

  const deleteLoan = useCallback((id: string) => {
    if (guardPermission('delete', tr('ऋण मिटाने', 'delete loans'))) return;   // ECR-06: role gate
    if (guardFYLocked()) return;
    const loan = loansRef.current.find(l => l.id === id);
    // Data-integrity guard: a loan with posted repayments carries real receipt vouchers
    // (Dr Cash/Bank / Cr Loans & Advances + interest income). Deleting it here would only
    // reverse the disbursement, leaving those repayment receipts live and the books
    // inconsistent. Refuse — the user must cancel the repayment vouchers first.
    if (loan && (loan.repaidAmount || 0) > 0) {
      toastRef.current({
        title: tr('ऋण नहीं हटाया जा सकता', 'Loan cannot be deleted'),
        description: tr(`इस ऋण की ₹${(loan.repaidAmount || 0).toLocaleString('en-IN')} चुकौती दर्ज है। पहले "वाउचर" पेज से चुकौती रसीदें रद्द करें, फिर ऋण मिटाएँ — ताकि बही मेल खाती रहे।`, `This loan has ₹${(loan.repaidAmount || 0).toLocaleString('en-IN')} of repayment recorded. First cancel the repayment receipts from the "Vouchers" page, then delete the loan — so the books keep matching.`),
        variant: 'destructive', duration: 10000,
      });
      return;
    }
    setLoansState(prev => { const updated = prev.filter(l => l.id !== id); return updated; });
    // Soft-delete (ECR-02 / RULE-5): retain the loan register row (isDeleted=true) for audit; the
    // loader filters it out. The linked disbursement voucher is still soft-cancelled below (RULE-3).
    supabase.from('loans').update({ isDeleted: true }).eq('id', id).then(({ error }) => {
      if (error) { failedCloudWrite(tr('ऋण हटाना', 'Deleting the loan'), error, () => setLoansState(prev => putBack(prev, loan))); return; }
      emitAudit({ entityType: 'loan', entityId: id, action: 'delete', reason: 'Loan deleted' });
      // RULE 3: soft-cancel the auto-generated disbursement voucher (matched by the unique loanNo
      // in its narration) so no ghost "Loans & Advances" asset lingers in Trial Balance / Balance Sheet.
      if (loan) {
        const now = new Date().toISOString();
        // P0-3: prefer the stored disbursement voucherId (exact); fall back to the legacy
        // narration match only for loans created before voucherId existed. The old substring
        // match (`narration.includes(loanNo)`) collided "L/…/1" with "L/…/10".
        const linkedIds = loan.voucherId
          ? new Set(vouchersRef.current.filter(v => v.id === loan.voucherId && !v.isDeleted && !isEngineVoucher(v)).map(v => v.id))
          : (loan.loanNo
              ? new Set(vouchersRef.current.filter(v => !v.isDeleted && v.memberId === loan.memberId && v.narration?.includes(loan.loanNo) && !isEngineVoucher(v)).map(v => v.id))
              : new Set<string>());
        cancelLinkedVouchers([...linkedIds], 'Loan deleted', user?.name || 'System');
      }
      console.info(`[AUDIT-DELETE] Loan id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
    });
  }, []);

  const addAsset = useCallback((data: Omit<Asset, 'id' | 'assetNo'>, opts?: { capitalize?: boolean; mode?: 'cash' | 'bank' }): Asset => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as Asset;
    const maxNum = assetsRef.current.reduce((max, a) => {
      const m = a.assetNo?.match(/AST\/(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const assetNo = `AST/${String(maxNum + 1).padStart(4, '0')}`;
    let newAsset: Asset = { ...data, id: crypto.randomUUID(), assetNo };
    // ECR-15: capitalize a NEW purchase — Dr Fixed-Asset / Cr Cash-Bank. Off by default so
    // opening/historical assets stay register-only (no voucher, no double-count).
    if (opts?.capitalize && (data.cost || 0) > 0) {
      const cashBank = opts.mode === 'bank' ? (defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK) : ACCOUNT_IDS.CASH;
      // The ledger for this category in THIS chart (lib/assetHeads) — never a conventional id that means another head here.
      const costId = resolveAssetHead('cost', data.category, accounts);
      if (!costId) {
        toastRef.current({ title: tr('संपत्ति का खाता नहीं मिला', 'Asset account not found'), description: tr(`इस chart में "${data.category}" के लिए स्थायी संपत्ति का खाता नहीं है — Ledger Heads में Fixed Assets के नीचे बनाएँ, फिर दोबारा करें। कुछ सेव नहीं हुआ। (No fixed-asset ledger for ${data.category} in this chart; nothing was saved.)`, `This chart has no fixed-asset ledger for "${data.category}" — create it under Fixed Assets in Ledger Heads, then try again. Nothing was saved. (No fixed-asset ledger for ${data.category} in this chart.)`), variant: 'destructive', duration: 12000 });
        return { ...data, id: '' } as unknown as Asset;
      }
      const posting = assetAcquisitionPosting(data.category, data.cost, cashBank, costId);
      const v = addVoucher({
        type: 'payment', date: data.purchaseDate || new Date().toISOString().split('T')[0],
        debitAccountId: posting.assetAccount, creditAccountId: cashBank, amount: posting.amount,
        lines: posting.lines.map(l => ({ id: crypto.randomUUID(), accountId: l.accountId, type: l.type, amount: l.amount })),
        narration: `Asset acquisition: ${assetNo} ${data.name} — capitalized ₹${posting.amount.toLocaleString('en-IN')}`,
        createdBy: userRef.current?.name ?? 'System',
      });
      if (v?.id) newAsset = { ...newAsset, acquisitionVoucherId: v.id };
    }
    assetsRef.current = [...assetsRef.current, newAsset];
    setAssetsState(prev => { const updated = [...prev, newAsset]; return updated; });
    // T-03 (ADR-0005): official assetNo from the server sequence (book 'AST', FY-less) at persist;
    // restamp local state. Falls back to the client-provisional number on offline/RPC failure.
    issueOfficialNumber(nextDocNumber, societyIdRef.current, newAsset.assetNo).then((officialNo) => {
      const toSave = (officialNo && officialNo !== newAsset.assetNo) ? { ...newAsset, assetNo: officialNo } : newAsset;
      if (toSave !== newAsset) {
        assetsRef.current = assetsRef.current.map(a => a.id === newAsset.id ? toSave : a);
        setAssetsState(prev => prev.map(a => a.id === newAsset.id ? toSave : a));
      }
      supabase.from('assets').upsert(withSoc(toSave)).then(({ error }) => {
        if (error) {
          console.error('DB sync error:', error.message); reportError('db-sync', error.message);
          assetsRef.current = assetsRef.current.filter(a => a.id !== newAsset.id);
          setAssetsState(prev => prev.filter(a => a.id !== newAsset.id));   // RULE 1: roll back
          toastRef.current({ title: tr('संपत्ति सेव नहीं हुई', 'Asset not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}.`, `Not saved to the cloud — ${error.message}.`), variant: 'destructive', duration: 12000 });
        }
      });
    });
    return newAsset;
  }, [accounts, addVoucher]);

  const updateAsset = useCallback((id: string, data: Partial<Asset>) => {
    if (guardFYLocked()) return;
    const before = assetsRef.current.find(a => a.id === id);
    if (!before) return;
    const updated = { ...before, ...data };
    setAssetsState(prev => prev.map(a => a.id === id ? updated : a));
    patchRow('assets', id, before, updated).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        setAssetsState(prev => prev.map(a => a.id === id ? before : a));   // RULE 1: roll back to prior state
        toastRef.current({ title: tr('अपडेट सेव नहीं हुआ', 'Update not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh the old data will come back.`), variant: 'destructive', duration: 12000 });
      }
    });
  }, []);

  // ECR-15: dispose (sell/scrap) an asset. Computes accumulated depreciation to the disposal
  // FY, posts the standard disposal journal (Dr Cash/Bank + Dr Accum-Dep + optional Dr Loss;
  // Cr Fixed-Asset cost + optional Cr Profit), and marks the asset disposed. RULE 1 rollback.
  const disposeAsset = useCallback((id: string, opts: { saleProceeds: number; mode: 'cash' | 'bank'; date: string }): boolean => {
    if (guardFYLocked()) return false;
    const asset = assetsRef.current.find(a => a.id === id);
    if (!asset) return false;
    if (asset.status === 'disposed') { toastRef.current({ title: tr('पहले से disposed', 'Already disposed'), description: 'This asset is already disposed.', variant: 'destructive' }); return false; }
    // Accumulated depreciation from purchase FY through the disposal FY (capped at cost − residual).
    const disposalFY = fyOfDate(new Date(opts.date));
    let accum = 0, cursor = fyOfDate(new Date(asset.purchaseDate)), guard = 0;
    while (cursor <= disposalFY && guard++ < 200) { accum += calcDepForFY(asset, cursor, accum); cursor = nextFY(cursor); }
    accum = Math.min(accum, asset.cost - (asset.residualValue || 0));
    const cashBank = opts.mode === 'bank' ? (defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK) : ACCOUNT_IDS.CASH;
    // This chart's own ledgers for the category (lib/assetHeads); refuse rather than post to a head that means something else here.
    const heads = resolveAssetHeads(asset.category, accounts);
    const missing: AssetHeadKind[] = [...(!heads.costId ? ['cost' as const] : []), ...(accum > 0 && !heads.accumId ? ['accumDep' as const] : [])];
    if (missing.length) {
      toastRef.current({ title: tr('संपत्ति का खाता नहीं मिला', 'Asset account not found'), description: tr(`इस chart में ये खाते नहीं हैं — ${missingAssetHeadsText(asset.category, missing, true)}। Ledger Heads में बनाएँ, फिर दोबारा करें। कुछ सेव नहीं हुआ। (Missing: ${missingAssetHeadsText(asset.category, missing, false)}; nothing was saved.)`, `These accounts are missing in this chart — ${missingAssetHeadsText(asset.category, missing, true)}. Create them in Ledger Heads, then try again. Nothing was saved. (Missing: ${missingAssetHeadsText(asset.category, missing, false)}.)`), variant: 'destructive', duration: 12000 });
      return false;
    }
    const posting = assetDisposalPosting({ category: asset.category, cost: asset.cost, accumDep: accum, saleProceeds: opts.saleProceeds, cashBankAccount: cashBank, gainAccount: disposalGainAccountId(accounts), costAccount: heads.costId!, accumAccount: heads.accumId ?? undefined });
    const firstDr = posting.lines.find(l => l.type === 'Dr');
    const firstCr = posting.lines.find(l => l.type === 'Cr');
    const voucher = addVoucher({
      type: opts.saleProceeds > 0 ? 'receipt' : 'journal', date: opts.date,
      debitAccountId: firstDr?.accountId || cashBank, creditAccountId: firstCr?.accountId || heads.costId || ASSET_ACCOUNTS[asset.category], amount: posting.drTotal,
      lines: posting.lines.map(l => ({ id: crypto.randomUUID(), accountId: l.accountId, type: l.type, amount: l.amount })),
      narration: `Asset disposal: ${asset.assetNo} ${asset.name} — WDV ₹${posting.wdv.toLocaleString('en-IN')}, ${posting.gainLoss >= 0 ? 'profit' : 'loss'} ₹${Math.abs(posting.gainLoss).toLocaleString('en-IN')}`,
      createdBy: userRef.current?.name ?? 'System',
    });
    if (!voucher?.id) return false;
    const before = asset;
    const updated: Asset = { ...asset, status: 'disposed', disposalDate: opts.date, saleProceeds: opts.saleProceeds,
      voucherIds: [...(asset.voucherIds ?? []), voucher.id] };   // P0-3: link the disposal voucher by id
    assetsRef.current = assetsRef.current.map(a => a.id === id ? updated : a);
    setAssetsState(prev => prev.map(a => a.id === id ? updated : a));
    supabase.from('assets').upsert(withSoc(updated)).then(({ error }) => {
      if (error) {
        reportCascade('Asset dispose sync', error);
        assetsRef.current = assetsRef.current.map(a => a.id === id ? before : a);
        setAssetsState(prev => prev.map(a => a.id === id ? before : a));   // RULE 1: roll back
        toastRef.current({ title: tr('Disposal सेव नहीं हुआ', 'Disposal not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}.`, `Not saved to the cloud — ${error.message}.`), variant: 'destructive', duration: 12000 });
      }
    });
    emitAudit({ entityType: 'asset', entityId: id, action: 'update', before: { status: 'active' }, after: { status: 'disposed', saleProceeds: opts.saleProceeds, gainLoss: posting.gainLoss } });
    toastRef.current({ title: posting.gainLoss >= 0 ? tr('✅ Asset disposed (लाभ)', '✅ Asset disposed (gain)') : tr('✅ Asset disposed (हानि)', '✅ Asset disposed (loss)'), description: tr(`${asset.assetNo} · WDV ₹${posting.wdv.toLocaleString('en-IN')} · ${posting.gainLoss >= 0 ? 'लाभ' : 'हानि'} ₹${Math.abs(posting.gainLoss).toLocaleString('en-IN')}`, `${asset.assetNo} · WDV ₹${posting.wdv.toLocaleString('en-IN')} · ${posting.gainLoss >= 0 ? 'gain' : 'loss'} ₹${Math.abs(posting.gainLoss).toLocaleString('en-IN')}`) });
    return true;
  }, [accounts, addVoucher]);

  const deleteAsset = useCallback((id: string) => {
    if (guardPermission('delete', tr('संपत्ति मिटाने', 'delete assets'))) return;   // ECR-06: role gate
    if (guardFYLocked()) return;
    const asset = assetsRef.current.find(a => a.id === id);
    setAssetsState(prev => { const updated = prev.filter(a => a.id !== id); return updated; });
    // Soft-delete (P0 #2): retain the asset row (isDeleted=true); dependent depreciation
    // vouchers are still soft-cancelled below. Load filters isDeleted out on refresh.
    supabase.from('assets').update({ isDeleted: true }).eq('id', id).then(({ error }) => {
      if (error) { failedCloudWrite(tr('संपत्ति हटाना', 'Deleting the asset'), error, () => setAssetsState(prev => putBack(prev, asset))); return; }
      // RULE 3: soft-cancel any depreciation journal(s) auto-posted for this asset (matched by its
      // unique assetNo in the narration) so no orphan depreciation expense / accumulated-dep lingers.
      if (asset) {
        const now = new Date().toISOString();
        // P0-3: prefer the stored voucher ids (capitalization + depreciation + disposal); fall back
        // to the legacy narration match only for assets created before these ids were stored. The old
        // substring match (`narration.includes(assetNo)`) collided "AST/0001" with "AST/00010".
        const storedIds = [asset.acquisitionVoucherId, ...(asset.voucherIds ?? [])].filter(Boolean) as string[];
        const linkedIds = storedIds.length > 0
          ? new Set(vouchersRef.current.filter(v => storedIds.includes(v.id) && !v.isDeleted && !isEngineVoucher(v)).map(v => v.id))
          : (asset.assetNo
              ? new Set(vouchersRef.current.filter(v => !v.isDeleted && v.narration?.includes(asset.assetNo) && !isEngineVoucher(v)).map(v => v.id))
              : new Set<string>());
        cancelLinkedVouchers([...linkedIds], 'Asset deleted', user?.name || 'System');
      }
      emitAudit({ entityType: 'asset', entityId: id, action: 'delete', reason: 'Asset deleted' });
      console.info(`[AUDIT-DELETE] Asset id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
    });
  }, []);

  // ── Depreciation Posting ───────────────────────────────────────────────────
  // Posts one journal entry per active depreciable asset for the given FY.
  // Skips assets already posted, with zero rate, Land category, or disposed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const postDepreciation = useCallback((fy?: string): { posted: number; skipped: number } => {
    if (guardFYLocked()) return { posted: 0, skipped: 0 };
    const targetFY  = fy || society.financialYear;
    const fyDates   = parseFY(targetFY);
    if (!fyDates) return { posted: 0, skipped: 0 };

    const depDate   = fyDates.end; // last day of FY
    const createdBy = user?.name || 'System';

    const currentAccounts = accounts;
    const currentVouchers = vouchersRef.current.filter(v => !v.isDeleted);

    let posted = 0, skipped = 0;
    const unresolved = new Set<string>();

    for (const asset of assets) {
      if (asset.status !== 'active' || !asset.depreciationRate || asset.depreciationRate <= 0) { skipped++; continue; }
      if (!DEP_ACCOUNTS[asset.category]) { skipped++; continue; } // Land or unknown
      // This chart's own ledgers for the category (lib/assetHeads). A chart where the conventional id is another
      // head (housing 5502 = "Dep. - Lift") must not take a Furniture asset's depreciation: skip it and say so.
      const expenseId = resolveAssetHead('depExpense', asset.category, accounts);
      const accumId = resolveAssetHead('accumDep', asset.category, accounts);
      if (!expenseId || !accumId) {
        skipped++;
        unresolved.add(missingAssetHeadsText(asset.category, [...(!expenseId ? ['depExpense' as const] : []), ...(!accumId ? ['accumDep' as const] : [])], true));
        continue;
      }
      const depAcc = { expenseId, accumId };
      if (asset.depreciationPostedFY?.includes(targetFY)) { skipped++; continue; }

      // WDV needs THIS asset's OWN accumulated depreciation (replayed per-asset). The
      // category ledger (accumId) holds the whole group, so using it over-/under-depreciated
      // any asset sharing a category (Audit #6). SLM is cost-based and ignores this.
      const priorAccumDep = (asset.depreciationMethod ?? 'SLM') === 'WDV'
        ? wdvAccumulatedBefore(asset, targetFY)
        : 0;

      const depAmount = calcDepForFY(asset, targetFY, priorAccumDep);
      if (depAmount <= 0) { skipped++; continue; }

      const dv = addVoucher({
        type: 'journal',
        date: depDate,
        debitAccountId:  depAcc.expenseId,
        creditAccountId: depAcc.accumId,
        amount: depAmount,
        narration: `Depreciation: ${asset.name} (${asset.assetNo}) FY ${targetFY}`,
        createdBy,
      });

      // Mark FY as posted on the asset record + link the depreciation voucher by id (P0-3),
      // so deleteAsset cancels exactly it, not a narration-substring match.
      updateAsset(asset.id, {
        depreciationPostedFY: [...(asset.depreciationPostedFY ?? []), targetFY],
        ...(dv?.id ? { voucherIds: [...(asset.voucherIds ?? []), dv.id] } : {}),
      });

      posted++;
    }

    if (unresolved.size) {
      toastRef.current({ title: tr('कुछ संपत्तियों का ह्रास नहीं चढ़ा', 'Depreciation not charged for some assets'), description: tr(`इस chart में ये खाते नहीं हैं — ${[...unresolved].join('; ')}। Ledger Heads में बनाएँ और ह्रास दोबारा चलाएँ; बाक़ी संपत्तियों का ह्रास चढ़ गया है। (Depreciation skipped for assets whose ledgers are missing in this chart.)`, `These accounts are missing in this chart — ${[...unresolved].join('; ')}. Create them in Ledger Heads and run depreciation again; depreciation for the other assets has been charged. (Depreciation skipped for assets whose ledgers are missing in this chart.)`), variant: 'destructive', duration: 15000 });
    }
    return { posted, skipped };
  // addVoucher and updateAsset are stable callbacks; assets/accounts/society/user are state
  }, [assets, accounts, society, user, addVoucher, updateAsset]); // eslint-disable-line

  const getReceiptsPayments = useCallback((asOnDate?: string): ReceiptsPaymentsData => {
    // K3: the voucher-state compute is a pure module (lib/reports/receiptsPayments) — same formula, testable alone.
    const { data: fromVouchers, openingCashMinor, openingBankMinor, bankIds } =
      computeReceiptsPayments({ accounts, vouchers: activeVouchers, asOnDate, openingsInScope });
    return ledgerReport(
      'receiptsPayments',
      fromVouchers,
      // The cash/bank set the projection excludes from the R&P lines must be exactly the one
      // `isCashBank` in lib/reports/receiptsPayments uses (isBankAccount = the Bank head itself, or a non-group child of it).
      () => ledgerReceiptsPaymentsData(ledgerEventsRef.current, accounts, ACCOUNT_IDS.CASH, new Set([ACCOUNT_IDS.BANK, ...bankIds]), {
        openingCashMinor, openingBankMinor, asOf: asOnDate,
      }),
      receiptsPaymentsParity,
    );
  }, [accounts, vouchers, activeVouchers, ledgerReport, openingsInScope]);

  // T-09 PRE-FLIGHT (runbook §2c) — read-only. Before a tenant is flipped to `ledgerReadsEnabled`,
  // every read that has a ledger path must prove it reproduces the voucher-computed report exactly.
  // The balance reads (trial balance → trading a/c → P&L → getAccountBalance) ride on `ledgerParity`;
  // the four transaction reports each carry their own gate. Rather than re-implement those computes
  // here (RULE 2 — one formula), this runs the REAL getters with the diagnostic flag on, which makes
  // each gate record its verdict even on a tenant that is not cut over yet. Surfaced on Ledger Hygiene.
  // The journal is only paged in at society load for a tenant that is ALREADY cut over — so before a
  // flip the ref is empty and the pre-flight below would have nothing to check (and would "pass" only
  // because there is nothing to compare). This pulls the full log on demand, so parity can be proven
  // BEFORE the flip. Cost is paid only when the diagnostic asks for it.
  const loadLedgerJournal = useCallback(async (): Promise<number> => {
    const sid = societyIdRef.current;
    if (!sid) return ledgerEventsRef.current.length;
    try {
      const { data } = await fetchAllPagedFor<Record<string, unknown>>('ledger_events', sid, ['occurred_at', 'event_id']);
      ledgerEventsRef.current = mapLedgerEventRows(data ?? []);
      journalLoadedRef.current = true; // full log in memory — sequences are now collision-free
    } catch (e) {
      console.warn('T-09 journal load (on demand) failed:', e);
    }
    return ledgerEventsRef.current.length;
  }, []);

  const getLedgerReportParity = useCallback((): LedgerParitySnapshot => {
    const journal = ledgerEventsRef.current;
    const reports: LedgerParityReport[] = [];

    // 1. Balances — the trial balance gate, which Trading A/c, P&L and getAccountBalance inherit.
    // In a branch view the vouchers are scoped and the journal is not, so every check below would
    // "fail" for the wrong reason — say so, rather than reporting a false drift.
    const branchScoped = activeBranchId !== ALL_BRANCHES;
    const tb = ledgerParity(journal, activeVouchers, accounts);
    reports.push({
      report: 'trialBalance',
      matches: tb.matches,
      detail: `${tb.accountsChecked} accounts checked${branchScoped ? ' — ⚠ branch view active: switch to सभी शाखाएँ (consolidated) and re-check' : ''}`,
      diffs: tb.diffs.slice(0, 10).map(d => ({ field: `account ${d.accountId}`, ledger: toRupees(d.actual), vouchers: toRupees(d.expected) })),
    });

    // 2. The transaction reports — run each getter once with the gates recording.
    parityDiagnosticRef.current = true;
    reportParityRef.current.clear();
    try {
      getCashBookEntries();
      for (const bid of getBankAccountIds(accounts)) getBankBookEntries(undefined, undefined, bid);
      getReceiptsPayments();
      for (const m of members) getMemberLedger(m.id);
    } finally {
      parityDiagnosticRef.current = false;
    }

    const verdicts = reportParityRef.current;
    const take = (report: string, verdict?: ReportParityResult) => {
      if (verdict) reports.push({ report, matches: verdict.matches, diffs: verdict.diffs });
    };
    take('cashBook', verdicts.get('cashBook'));
    for (const bid of getBankAccountIds(accounts)) take(`bankBook:${bid}`, verdicts.get(`bankBook:${bid}`));
    take('receiptsPayments', verdicts.get('receiptsPayments'));

    // Members are many — report them as one line: how many diverge, and the first one's diffs.
    const memberVerdicts = [...verdicts.entries()].filter(([k]) => k.startsWith('memberLedger:'));
    if (memberVerdicts.length) {
      const bad = memberVerdicts.filter(([, v]) => !v.matches);
      reports.push({
        report: 'memberLedger',
        matches: bad.length === 0,
        detail: bad.length ? `${bad.length} of ${memberVerdicts.length} members differ (first: ${bad[0][0].slice('memberLedger:'.length)})` : `${memberVerdicts.length} members checked`,
        diffs: bad[0]?.[1].diffs ?? [],
      });
    }

    return {
      journalEvents: journal.length,
      cutOver: !!society?.ledgerReadsEnabled,
      reports,
      allMatch: reports.every(r => r.matches),
    };
  }, [accounts, activeVouchers, members, society?.ledgerReadsEnabled, activeBranchId, getCashBookEntries, getBankBookEntries, getReceiptsPayments, getMemberLedger]);

  const getTradingAccount = useCallback((asOnDate?: string) => {
    // BS-tie fix: when no date is given, bound to the FINANCIAL-YEAR END (not "all
    // time"), so vouchers mis-dated into the next FY never leak into this year's
    // Trading A/c / Gross Profit and unbalance the Balance Sheet.
    const fyEnd = `20${society.financialYear.split('-')[1]}-03-31`;
    const effDate = asOnDate ?? fyEnd;
    // M15: Pass effDate to underlying TB so historical Trading A/c is consistent.
    // Batch C: ledgers inside a sub-group under 4100/5100 are Trading heads too (withTradingParents).
    const tb = withTradingParents(getTrialBalance(effDate), accounts);
    const fy = society.financialYear;
    // K2: the statement itself is a pure module (lib/reports/tradingAndProfitLoss) — same formula, testable alone.
    // RULE 2/3: movements are reconciled against live purchase/sale records first.
    return computeTradingAccount({
      tb, fy, effDate, vouchers: activeVouchers, stockItems, openingsInScope,
      fyStart: fyStartOf(effDate),   // ACC-01: the same year window as the trial balance's opening columns
      movements: reconcileMovements(stockMovementsRef.current, salesRef.current, purchasesRef.current),
    });
  }, [getTrialBalance, accounts, stockItems, stockMovements, sales, purchases, activeVouchers, society.financialYear, openingsInScope]);

  const postClosingStock = useCallback((fy?: string): { posted: boolean; amount: number; alreadyPosted: boolean } => {
    if (guardFYLocked()) return { posted: false, amount: 0, alreadyPosted: false };
    const currentFY = fy ?? society.financialYear;
    // Check if already posted — accept the NEW (Cr 5150) or LEGACY (Cr 5101) journal.
    const alreadyPosted = activeVouchers.some(v =>
      getVoucherLines(v).some(l => l.accountId === '3403' && l.type === 'Dr') &&
      getVoucherLines(v).some(l => (l.accountId === '5150' || l.accountId === '5101') && l.type === 'Cr') &&
      v.narration.includes(currentFY)
    );
    if (alreadyPosted) return { posted: false, amount: 0, alreadyPosted: true };

    // Use movement-based qty (same formula as Inventory / Stock Valuation / Trading Account)
    // so the journal posts the same number user sees in reports. RULE 2/3: reconcile first.
    const recMovs = reconcileMovements(stockMovementsRef.current, salesRef.current, purchasesRef.current);
    const amount = toRupees(sumMinor(
      stockItems.filter(s => s.isActive).map(s => toMinor(Number(computeStockValue(s, recMovs)) || 0)),
    ));

    if (amount <= 0) return { posted: false, amount: 0, alreadyPosted: false };

    addVoucher({
      type: 'journal',
      date: new Date().toISOString().split('T')[0],
      debitAccountId: '3403',   // Trading Goods inventory (Balance Sheet asset)
      creditAccountId: '5150',  // Audit C-8: dedicated Closing Stock A/c — keeps Purchases (5101) gross
      amount,
      narration: `Closing Stock at year end — FY ${currentFY}`,
      createdBy: user?.name ?? 'System',
    });
    return { posted: true, amount, alreadyPosted: false };
  }, [stockItems, stockMovements, sales, purchases, activeVouchers, society.financialYear, addVoucher, user?.name]);

  const getProfitLoss = useCallback((asOnDate?: string) => {
    // BS-tie fix: default to the FINANCIAL-YEAR END so a voucher mis-dated into the
    // next FY can't inflate this year's surplus (which would unbalance the Balance
    // Sheet, whose asset side is correctly date-filtered).
    const fyEnd = `20${society.financialYear.split('-')[1]}-03-31`;
    const effDate = asOnDate ?? fyEnd;
    // M15: Pass effDate to underlying TB so historical P&L is accurate.
    const tb = getTrialBalance(effDate);

    // Indian Cooperative Act: a TRADING Account is only meaningful for goods-trading
    // societies (those entitled to inventory_sales). Service societies (housing, labour,
    // …) have no trading — their 4100/5100 heads are ordinary income/expense and must
    // appear DIRECTLY in Income & Expenditure (no Trading A/c, no Gross-Profit bridge).
    const hasTrading = navigationService.resolveCapabilities(society.societyType ?? 'other', societyCapabilities, society.state, declaredActivities(societyActivities), society.activitiesCutoverEnabled).has('inventory_sales');

    // K2: the statement itself is a pure module (lib/reports/tradingAndProfitLoss) — same formula, testable alone.
    // Batch C: same Trading-head rule as getTradingAccount (RULE 2) — nested 4100/5100 ledgers leave the P&L.
    return computeProfitLoss({ tb: hasTrading ? withTradingParents(tb, accounts) : tb, hasTrading, tradingGrossProfit: () => getTradingAccount(effDate).grossProfit });
  }, [getTrialBalance, getTradingAccount, accounts, society.financialYear, society.societyType, societyCapabilities]);

  // ── T-20 · Statutory appropriation posting (UCAS CM-1) ───────────────────────
  // Post the year-end appropriation of net surplus as ONE balanced voucher (Dr Net Surplus / Cr each
  // statutory fund) via the CANONICAL engine — effective-dated UCAS rates, exact paise, caps enforced.
  // Flag-gated per tenant (society.statutoryAppropriation, default off) so the legacy ad-hoc float path
  // (ReserveFund / ProfitDistribution) is untouched until the flip. Posts through addVoucher, so it
  // inherits the ledger append, journal-first write path, RULE-1 rollback, numbering and FY guards —
  // no persistence is re-implemented here. A refused/invalid plan is surfaced, never posted (RULE 1).
  const addStatutoryAppropriation = useCallback((opts: { date: string; narration?: string; discretionary?: { dividend?: number }; attestation: AuthorityAttestation }): Voucher | null => {
    const soc = societyRef.current;
    if (!soc?.statutoryAppropriation) {
      toastRef.current({ title: tr('सुविधा सक्रिय नहीं', 'Feature not active'), description: tr('इस समिति के लिए वैधानिक लाभ-विनियोजन अभी सक्षम नहीं है। (Statutory Appropriation is not enabled for this society.)', 'Statutory profit appropriation is not enabled for this society yet. (Statutory Appropriation is not enabled for this society.)'), variant: 'destructive', duration: 9000 });
      return null;
    }
    if (guardFYLocked()) return null;                                        // RULE 6
    if (guardPermission('create', tr('लाभ-विनियोजन पोस्ट करने', 'post the profit appropriation'))) return null;     // ECR-06
    if (guardPeriodLock(opts.date)) return null;                             // ECR-07: no posting into a closed period

    // T-23 (UCAS CM-2, CL-7): a statutory appropriation is a FINALIZATION — its legality derives from
    // a recorded governance act (the AGM adopting the appropriation). Require + validate that authority
    // (correct kind, referenced, dated, authorizer, and SoD: authorizer ≠ preparer) BEFORE posting, and
    // stamp the attestation on the voucher so the figure ties to the governance act that authorized it.
    const authority = authorizeFinalization({ act: 'appropriation', preparedBy: userRef.current?.name ?? '', attestation: opts.attestation });
    if (!authority.ok || !authority.recorded) {
      toastRef.current({ title: tr('🏛️ प्राधिकार आवश्यक', '🏛️ Authorisation required'), description: tr(`${authority.problems.join('; ')} — AGM संकल्प के बिना विनियोजन पोस्ट नहीं होगा। (Appropriation needs recorded AGM authority.)`, `${authority.problems.join('; ')} — appropriation will not be posted without an AGM resolution. (Appropriation needs recorded AGM authority.)`), variant: 'destructive', duration: 12000 });
      return null;
    }

    const netSurplus = getProfitLoss().netProfit;
    const shareCapital = getShareCapitalReconciliation().controlBalance;      // ECR-05: the control-ledger paid-up base
    const appr = planSocietyAppropriation({
      netSurplus,
      shareCapital,
      state: soc.state,
      asOf: opts.date,
      discretionary: { dividend: opts.discretionary?.dividend ?? 0 },         // core-only: reserve + education + optional dividend
      // A statutory Bad & Doubtful Debt Fund minimum (Haryana s.87(1)(a)) posts to the chart's Bad Debt
      // Fund when it exists; without it the step has no head and the plan is refused, never mis-posted.
      accounts: {
        ...(accounts.some((a) => a.id === '1205' && !a.isGroup) ? { bye_law_reserves: '1205' } : {}),
        // Patronage is owed to members — their rebate-payable head, never 2103 Salary Payable.
        ...(resolveRebatePayableAccountId(accounts) ? { patronage_bonus: resolveRebatePayableAccountId(accounts) as string } : {}),
      },
    });
    if (!appr.ok) {
      // A bad plan (cap breach / over-appropriation) is refused, never posted (RULE 1).
      toastRef.current({ title: tr('❌ विनियोजन पोस्ट नहीं हुआ', '❌ Appropriation not posted'), description: tr(`${appr.problems.join('; ')} — कृपया सुधारें। (Appropriation refused.)`, `${appr.problems.join('; ')} — please correct these. (Appropriation refused.)`), variant: 'destructive', duration: 12000 });
      return null;
    }
    const content = appropriationVoucherContent(appr, opts.narration);
    if (!content) {
      toastRef.current({ title: tr('कुछ विनियोजित नहीं हुआ', 'Nothing appropriated'), description: tr('कोई शुद्ध अधिशेष नहीं — पोस्ट करने को कुछ नहीं। (No net surplus to appropriate.)', 'No net surplus — nothing to post. (No net surplus to appropriate.)'), variant: 'destructive', duration: 9000 });
      return null;
    }
    // Stamp the governance authority on the voucher narration — the auditable link from the figure to
    // the AGM act that authorized it (CL-7). It flows into the ledger event payload (narration) too.
    const rec = authority.recorded;
    const authLabel = rec.kind === 'agm_adoption' ? 'AGM' : rec.kind;
    const narration = `${content.narration} · ${authLabel} ${rec.reference} (${rec.date}), अधिकृत: ${rec.authorizedBy}`;
    const v = addVoucher({ ...content, narration, date: opts.date, createdBy: userRef.current?.name ?? '' });
    toastRef.current({ title: tr('✅ वैधानिक लाभ-विनियोजन पोस्ट', '✅ Statutory profit appropriation posted'), description: tr(`कुल ₹${content.amount.toFixed(2)} — ${content.lines.length - 1} निधियों में। ${authLabel} ${rec.reference}. वाउचर ${v.voucherNo}.`, `Total ₹${content.amount.toFixed(2)} — into ${content.lines.length - 1} funds. ${authLabel} ${rec.reference}. Voucher ${v.voucherNo}.`), duration: 8000 });
    return v;
  }, [getProfitLoss, getShareCapitalReconciliation, addVoucher, guardFYLocked, guardPermission, guardPeriodLock, accounts]);

  // ── Inventory ──────────────────────────────────────────────────────────────
  // Two-step stock_items save pattern (same as purchases for GST/TDS columns):
  // Step 1: upsert base columns only — schema cache always knows these, never fails.
  // Step 2: update the late-added columns (stockGroup, salesAccountId, purchaseAccountId,
  // p4Category, valuationMethod, hsnCode, sacCode, gstRate) separately. If user hasn't run
  // the ALTER TABLE migration yet, only step 2 fails — local state stays consistent and base
  // save still works. RULE 1: hsnCode/sacCode/gstRate are NOT in the base stock_items table
  // (added by the HSN-picker migration), so they MUST stay in this extras bucket — otherwise
  // a schema-cache miss would fail the whole item save the moment an HSN is entered.
  const persistStockItem = (item: StockItem, opts?: { onBaseFail?: () => void; onBaseSuccess?: () => void }) => {
    const { salesAccountId, purchaseAccountId, stockGroup, p4Category, valuationMethod, hsnCode, sacCode, gstRate, ...baseCols } = item;
    supabase.from('stock_items').upsert(withSoc(baseCols)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        opts?.onBaseFail?.();   // RULE 1: roll back local state
        toastRef.current({ title: tr('स्टॉक आइटम सेव नहीं हुआ', 'Stock item not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा; दोबारा सेव करें।`, `Not saved to the cloud — ${error.message}. Nothing will go wrong on Refresh; please save again.`), variant: 'destructive', duration: 12000 });
        return;
      }
      opts?.onBaseSuccess?.();
      const extras: Record<string, unknown> = {};
      if (salesAccountId !== undefined) extras.salesAccountId = salesAccountId || null;
      if (purchaseAccountId !== undefined) extras.purchaseAccountId = purchaseAccountId || null;
      if (stockGroup !== undefined) extras.stockGroup = stockGroup || null;
      if (p4Category !== undefined) extras.p4Category = p4Category || null;
      if (valuationMethod !== undefined) extras.valuationMethod = valuationMethod || null;
      if (hsnCode !== undefined) extras.hsnCode = hsnCode || null;
      if (sacCode !== undefined) extras.sacCode = sacCode || null;
      if (gstRate !== undefined) extras.gstRate = gstRate ?? null;
      if (Object.keys(extras).length === 0) return;
      supabase.from('stock_items').update(extras).eq('id', item.id)
        .then(({ error: extraErr }) => {
          if (extraErr) {
            console.warn('Stock item extras update (run ALTER TABLE if column missing):', extraErr.message);
            // Show a milder warning instead of "Save failed" so the user knows save partially worked.
            // Base row (name/qty/rate) is safe; only extras (A/c routing, HSN/SAC/GST) didn't persist.
            toastRef.current({
              title: 'Saved, but HSN/A-c routing not persisted',
              description: `${extraErr.message}. Run the latest supabase-tables.sql migration to enable the HSN/SAC/GST & A/c routing columns.`,
              variant: 'default',
            });
          }
        });
    });
  };

  // Batch C (RULE 4): 5150 is the closing-stock contra, excluded from the Trading A/c and the P&L —
  // an item routed there made its purchase cost disappear from both. The dropdown no longer offers it;
  // this also stops an import / older client.
  const refuseClosingStockRouting = (d: { salesAccountId?: string; purchaseAccountId?: string }): boolean => {
    if (d.salesAccountId !== CLOSING_STOCK_CONTRA_ID && d.purchaseAccountId !== CLOSING_STOCK_CONTRA_ID) return false;
    toastRef.current({ title: tr('यह खाता नहीं चुन सकते', 'This account cannot be chosen'), description: tr('5150 "समापन माल (व्यापार खाता)" वस्तु का खरीद/बिक्री खाता नहीं हो सकता — कोई खरीद (51xx) या बिक्री (41xx) खाता चुनें।', '5150 "Closing Stock (Trading Account)" cannot be an item\'s purchase/sales account — choose a purchase (51xx) or sales (41xx) account.'), variant: 'destructive', duration: 10000 });
    return true;
  };

  const addStockItem = useCallback((data: Omit<StockItem, 'id' | 'itemCode'>, opts?: { onSaved?: (i: StockItem) => void; onFailed?: () => void }): StockItem => {
    if (guardFYLocked()) { opts?.onFailed?.(); return { ...data, id: '' } as unknown as StockItem; }
    if (refuseClosingStockRouting(data)) { opts?.onFailed?.(); return { ...data, id: '' } as unknown as StockItem; }
    // Derive next item code from existing items (not localStorage counter) to prevent duplicates
    let newItem: StockItem;
    setStockItemsState(prev => {
      const maxNum = prev.reduce((max, i) => {
        const m = i.itemCode?.match(/ITM\/(\d+)/);
        return m ? Math.max(max, parseInt(m[1])) : max;
      }, 0);
      const itemCode = `ITM/${String(maxNum + 1).padStart(3, '0')}`;
      // POS-retail stores: give new items a default Sales/Purchase A/c (RULE-4 default 4101/5101)
      // so a non-technical operator isn't blocked by the "assign a Sales/Purchase A/c" guard on
      // the first sale/purchase. They can still reassign for per-category routing. Gated on the
      // pos_billing CAPABILITY (T-14 / ADR-0002), not the society type — so marketing/dairy keep
      // their mandatory dedicated-account routing, and a licensed retail society follows suit too.
      const consumerDefaults = hasCap('pos_billing')
        ? { salesAccountId: data.salesAccountId || '4101', purchaseAccountId: data.purchaseAccountId || '5101' }
        : null;
      newItem = { ...data, ...consumerDefaults, id: crypto.randomUUID(), itemCode };
      persistStockItem(newItem, { onBaseFail: () => { setStockItemsState(p => p.filter(i => i.id !== newItem.id)); opts?.onFailed?.(); }, onBaseSuccess: () => opts?.onSaved?.(newItem) });
      return [...prev, newItem];
    });
    return newItem!;
  }, []);

  const updateStockItem = useCallback((id: string, data: Partial<StockItem>) => {
    if (guardFYLocked()) return;
    if (refuseClosingStockRouting(data)) return;
    setStockItemsState(prev => {
      const before = prev.find(i => i.id === id);
      const updated = prev.map(i => {
        if (i.id !== id) return i;
        const merged = { ...i, ...data };
        // POS-retail stores: backfill a default Sales/Purchase A/c on save if still unset, so a
        // pre-existing item (created before this default) becomes sellable without the operator
        // needing to know about ledger accounts. (Same RULE-4 default; gated on pos_billing — T-14.)
        if (hasCap('pos_billing')) {
          if (!merged.salesAccountId) merged.salesAccountId = '4101';
          if (!merged.purchaseAccountId) merged.purchaseAccountId = '5101';
        }
        return merged;
      });
      const updatedItem = updated.find(i => i.id === id);
      if (updatedItem && before) persistStockItem(updatedItem, { onBaseFail: () => setStockItemsState(p => p.map(i => i.id === id ? before : i)) });
      return updated;
    });
  }, []);

  const deleteStockItem = useCallback((id: string) => {
    if (guardPermission('delete', tr('स्टॉक मद मिटाने', 'delete stock items'))) return;   // ECR-06: role gate
    if (guardFYLocked()) return;
    const item = stockItems.find(i => i.id === id);
    if (!item) return;
    const today = new Date().toISOString().split('T')[0];
    // Soft-delete: mark inactive, zero out stock (preserve history)
    setStockItemsState(prev => prev.map(i => i.id === id ? { ...i, isActive: false, currentStock: 0 } : i));
    // The write-off journal and the movement clean-up run only once the item row is saved in the cloud
    // (RULE 1 + 3) — a failed delete used to post the write-off anyway and leave the item active after F5.
    supabase.from('stock_items').update({ isActive: false, currentStock: 0 }).eq('id', id).then(({ error }) => {
      if (error) { failedCloudWrite(tr('स्टॉक मद हटाना', 'Deleting the stock item'), error, () => setStockItemsState(prev => prev.map(i => i.id === id ? item : i))); return; }
      // Write-off uses the AUTHORITATIVE movement-based qty (RULE 2), not the cached
      // currentStock field — which can be stale after a purchase edit/delete and would
      // otherwise create a phantom write-off journal for stock that no longer exists.
      const recMovs = reconcileMovements(stockMovementsRef.current, salesRef.current, purchasesRef.current);
      const realQty = computeStock(item, recMovs);
      // Value the write-off at weighted-average COST from movements (RULE 2), not the
      // stale purchaseRate field — else deleting an item whose purchaseRate is 0 would
      // post a ₹0 write-off and leave its closing-stock asset on the books forever.
      const costRate = computeStockCostRate(item, recMovs);
      if (item.isActive && realQty > 0) {
        const amount = toRupees(toMinor(realQty * costRate));
        if (amount > 0) {
          // Dr 5101 (Purchases/Write-off expense) / Cr 3403 (Closing Stock asset) — reverses closing stock asset
          addVoucher({
            type: 'journal',
            date: today,
            debitAccountId: '5101',
            creditAccountId: '3403',
            amount,
            narration: `Stock write-off on deletion: ${item.name} (${realQty} ${item.unit} @ ₹${costRate.toFixed(2)})`,
            createdBy: user?.name ?? 'System',
          });
        }
      }
      // ECR-21 (RULE-3): archive the movements to the WORM audit log before hard-deleting
      // them (kept out of the live table so the stock formula stays correct).
      const _delItemMovs = stockMovementsRef.current.filter(m => m.itemId === id);
      if (_delItemMovs.length) emitAudit({ entityType: 'stockMovement', entityId: id, action: 'delete', before: { count: _delItemMovs.length, movements: snapshotDeletedMovements(_delItemMovs) }, reason: 'Stock item deleted' });
      // Also remove orphaned stock movements for this item
      setStockMovementsState(prev => prev.filter(m => m.itemId !== id));
      supabase.from('stock_movements').delete().eq('itemId', id)
        .then(({ error: movErr }) => {
          if (!movErr) return;
          reportCascade('Stock-item movements cascade-delete sync', movErr);
          toastRef.current({ title: tr('वस्तु हटी, पर उसकी स्टॉक एंट्रियाँ क्लाउड से नहीं हटीं', 'Item deleted, but its stock entries were not removed from the cloud'), description: tr(`वस्तु निष्क्रिय है; बची एंट्रियाँ error log में दर्ज हैं। (Item deleted, its stock movements were not.) ${movErr.message}`, `The item is inactive; the remaining entries are recorded in the error log. (Item deleted, its stock movements were not.) ${movErr.message}`), variant: 'destructive', duration: 10000 });
        });
      console.info(`[AUDIT-DELETE] StockItem id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
    });
  }, [addVoucher, user?.name, stockItems]);

  // Saves one movement: optimistic add → base upsert (rolled back on failure, RULE 1) → step-2 patches.
  // godownId and the migration-203 pair (reason, responsiblePerson) are SEPARATE patches, so a database
  // that has not run 203 still keeps the godown (one missing column fails its whole update).
  const saveStockMovement = (movement: StockMovement, opts?: { onSaved?: () => void; onFailed?: (message: string) => void }) => {
    stockMovementsRef.current = [...stockMovementsRef.current, movement];
    setStockMovementsState(prev => [...prev, movement]);
    const { godownId: _mvGod, reason: _mvReason, responsiblePerson: _mvPerson, ...mvBase } = movement;
    supabase.from('stock_movements').upsert(withSoc(mvBase)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        stockMovementsRef.current = stockMovementsRef.current.filter(m => m.id !== movement.id);
        setStockMovementsState(prev => prev.filter(m => m.id !== movement.id));   // RULE 1: roll back
        recomputeItemStock(movement.itemId);
        toastRef.current({ title: tr('स्टॉक मूवमेंट सेव नहीं हुआ', 'Stock movement not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}.`, `Not saved to the cloud — ${error.message}.`), variant: 'destructive', duration: 12000 });
        opts?.onFailed?.(error.message);
        return;
      }
      if (_mvGod) supabase.from('stock_movements').update({ godownId: _mvGod }).eq('id', movement.id).then(({ error: gErr }) => { if (gErr) { console.warn('Movement godown patch:', gErr.message); reportError('write-partial', gErr.message, { at: 'Movement godown patch:' }); } });
      if (_mvReason || _mvPerson) {
        supabase.from('stock_movements').update({ reason: _mvReason ?? null, responsiblePerson: _mvPerson ?? null }).eq('id', movement.id).then(({ error: rErr }) => {
          if (!rErr) return;
          console.warn('Movement reason patch:', rErr.message); reportError('write-partial', rErr.message, { at: 'Movement reason patch:' });
          toastRef.current({ title: tr('स्टॉक सेव हुआ — पर कारण नहीं', 'Stock saved — but not the reason'), description: tr(`समायोजन का कारण क्लाउड में सेव नहीं हुआ (${rErr.message})। Migration 203 चलाएँ।`, `The adjustment reason was not saved to the cloud (${rErr.message}). Run Migration 203.`), duration: 10000 });
        });
      }
      opts?.onSaved?.();
    });
    recomputeItemStock(movement.itemId);
  };

  const addStockMovement = useCallback((data: Omit<StockMovement, 'id' | 'createdAt'>, opts?: { onSaved?: () => void; onFailed?: (message: string) => void }) => {
    if (guardFYLocked()) { opts?.onFailed?.('FY locked'); return; }
    const movement: StockMovement = { ...data, godownId: data.godownId ?? (activeGodownIdRef.current || undefined), id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    saveStockMovement(movement, opts);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Recompute currentStock from openingStock + ALL movements (authoritative — prevents drift
  // from past partial-sync failures or manual adjustments). Same formula as Inventory page.
  const recomputeItemStock = (itemId: string) => {
    const allMovs = stockMovementsRef.current;
    setStockItemsState(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      let qty = i.openingStock || 0;
      for (const m of allMovs) {
        if (m.itemId !== i.id) continue;
        if (m.type === 'purchase' || (m.type === 'adjustment' && m.qty > 0)) qty += m.qty;
        else qty -= Math.abs(m.qty);
      }
      qty = Math.max(0, qty);
      supabase.from('stock_items').update({ currentStock: qty }).eq('id', i.id).then(({ error }) => { if (error) { reportCascade('Stock currentStock sync error', error); toastRef.current({ title: tr('स्टॉक मात्रा क्लाउड में सेव नहीं हुई', 'Stock quantity not saved to the cloud'), description: tr(`Refresh के बाद स्टॉक जाँचें। (Stock update failed.) ${error.message}`, `Check the stock after Refresh. (Stock update failed.) ${error.message}`), variant: 'destructive', duration: 10000 }); } });
      return { ...i, currentStock: qty };
    }));
  };

  // ── Godown shortage (HAFED Accounts Manual 9.19 / 10.20) ─────────────────────────────────────────────
  // An account this flow needs, found by name or created once and awaited (the voucher must not name an
  // account the cloud does not have yet).
  const createAccountAwaited = (data: Omit<LedgerAccount, 'id'>) =>
    new Promise<LedgerAccount | null>(res => { addAccount(data, { onSaved: a => res(a), onFailed: () => res(null) }); });

  const ensureShortageHeads = async (person: string): Promise<{ personId: string; salesId: string } | null> => {
    let group = findShortageGroup(accountsRef.current);
    if (!group) {
      group = (await createAccountAwaited({ ...SHORTAGE_GROUP, type: 'asset', subtype: 'current_asset', openingBalance: 0, openingBalanceType: 'debit', isGroup: true, parentId: currentAssetsParent(accountsRef.current) })) ?? undefined;
      if (!group) return null;
    }
    const name = person.trim().replace(/\s+/g, ' ');
    let ledger = findPersonLedger(accountsRef.current, group.id, name);
    if (!ledger) {
      ledger = (await createAccountAwaited({ name, nameHi: name, type: 'asset', subtype: 'current_asset', openingBalance: 0, openingBalanceType: 'debit', isGroup: false, parentId: group.id })) ?? undefined;
      if (!ledger) return null;
    }
    let sales = findSalesByShortage(accountsRef.current);
    if (!sales) {
      sales = (await createAccountAwaited({ ...SALES_BY_SHORTAGE, type: 'income', subtype: 'trading_income', openingBalance: 0, openingBalanceType: 'credit', isGroup: false, parentId: tradingIncomeParent(accountsRef.current) })) ?? undefined;
      if (!sales) return null;
    }
    return { personId: ledger.id, salesId: sales.id };
  };

  // A recoverable shortage: the voucher (Dr person / Cr Sales by Shortage) is saved FIRST; the stock falls only
  // once it is in the cloud, and if the stock then fails the voucher is withdrawn — never one without the other.
  const recordStockShortage = useCallback((input: { itemId: string; qty: number; rate: number; date: string; person: string; narration?: string; godownId?: string; onDone?: (ok: boolean, voucherNo?: string) => void }): boolean => {
    if (guardFYLocked()) return false;
    if (guardPermission('create', tr('घटत दर्ज करने', 'record a shortage'))) return false;
    const item = stockItemsRef.current.find(i => i.id === input.itemId);
    const qty = -Math.abs(input.qty);
    const amount = shortageAmount(qty, input.rate);
    const err = validateAdjustment({ qty, reason: 'shortageRecoverable', person: input.person, rate: input.rate }, uiLanguage() === 'hi');
    if (!item || err) { toastRef.current({ title: tr('घटत दर्ज नहीं हुई', 'Shortage not recorded'), description: err ?? tr('वस्तु नहीं मिली', 'Item not found'), variant: 'destructive', duration: 8000 }); return false; }
    const by = user?.name ?? 'System';
    const movementId = crypto.randomUUID();
    const fail = (why: string) => { toastRef.current({ title: tr('घटत दर्ज नहीं हुई', 'Shortage not recorded'), description: why, variant: 'destructive', duration: 12000 }); input.onDone?.(false); };
    void (async () => {
      const heads = await ensureShortageHeads(input.person);
      if (!heads) { fail(tr('घटत के खाते नहीं बन सके — स्टॉक नहीं बदला।', 'The shortage ledgers could not be created — stock was not changed.')); return; }
      const narration = `${tr('गोदाम घटत', 'Godown shortage')}: ${item.name} ${Math.abs(qty)} ${item.unit || ''} @ ₹${input.rate.toFixed(2)} — ${tr('वसूली', 'recoverable from')} ${input.person.trim()}${input.narration ? ` (${input.narration})` : ''}`;
      const v = addVoucher({ type: 'journal', date: input.date, debitAccountId: heads.personId, creditAccountId: heads.salesId, amount, narration, createdBy: by, refType: REF_SHORTAGE, refId: movementId }, {
        onSaved: saved => {
          const movement: StockMovement = {
            id: movementId, createdAt: new Date().toISOString(), date: input.date, itemId: item.id, type: 'adjustment', qty, rate: input.rate, amount,
            referenceNo: saved.voucherNo, narration: input.narration || tr('गोदाम घटत — वसूली योग्य', 'Godown shortage — recoverable'),
            godownId: input.godownId ?? (activeGodownIdRef.current || undefined), reason: 'shortageRecoverable', responsiblePerson: input.person.trim(),
          };
          saveStockMovement(movement, {
            onSaved: () => {
              emitAudit({ entityType: 'stockMovement', entityId: movementId, action: 'create', after: { itemId: item.id, qty, amount, person: movement.responsiblePerson, voucherNo: saved.voucherNo }, reason: 'Godown shortage recoverable' });
              toastRef.current({ title: tr('घटत दर्ज', 'Shortage recorded'), description: tr(`${saved.voucherNo}: ₹${amount.toFixed(2)} ${movement.responsiblePerson} के नाम वसूली योग्य।`, `${saved.voucherNo}: ₹${amount.toFixed(2)} recoverable from ${movement.responsiblePerson}.`) });
              input.onDone?.(true, saved.voucherNo);
            },
            onFailed: msg => {
              cancelVoucher(saved.id, `Stock movement failed: ${msg}`, by, { rollback: true });
              input.onDone?.(false);
            },
          });
        },
        onFailed: () => fail(tr('घटत का वाउचर सेव नहीं हुआ — स्टॉक नहीं बदला।', 'The shortage voucher was not saved — stock was not changed.')),
      });
      if (!v.id) input.onDone?.(false);   // a guard refused the voucher (it has already said why)
    })();
    return true;
  }, [addVoucher, cancelVoucher, addAccount, user?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Undo a recoverable shortage booked by mistake: stock goes back FIRST (a "shortage cancelled" movement under
  // the same voucher no.), then the voucher is cancelled; if the cancel is refused the stock entry is removed again.
  const reverseStockShortage = useCallback((movementId: string, reason: string, onDone?: (ok: boolean) => void): boolean => {
    if (guardFYLocked()) return false;
    if (guardPermission('delete', tr('घटत रद्द करने', 'cancel a shortage'))) return false;
    const orig = stockMovementsRef.current.find(m => m.id === movementId && m.reason === 'shortageRecoverable');
    const voucher = orig && vouchersRef.current.find(v => v.refType === REF_SHORTAGE && (v.refId === orig.id || v.voucherNo === orig.referenceNo) && !v.isDeleted);
    if (!orig || stockMovementsRef.current.some(m => m.reason === 'shortageReversal' && m.referenceNo === orig.referenceNo)) {
      toastRef.current({ title: tr('रद्द नहीं हुआ', 'Not cancelled'), description: tr('यह घटत नहीं मिली, या पहले ही रद्द हो चुकी है।', 'This shortage was not found, or is already cancelled.'), variant: 'destructive', duration: 8000 });
      return false;
    }
    const by = user?.name ?? 'System';
    const back: StockMovement = {
      id: crypto.randomUUID(), createdAt: new Date().toISOString(), date: new Date().toISOString().split('T')[0], itemId: orig.itemId, type: 'adjustment',
      qty: Math.abs(orig.qty), rate: orig.rate, amount: Math.abs(orig.amount), referenceNo: orig.referenceNo, narration: `${tr('घटत रद्द', 'Shortage cancelled')}: ${reason}`,
      godownId: orig.godownId, reason: 'shortageReversal', responsiblePerson: orig.responsiblePerson,
    };
    const undoBack = () => {
      stockMovementsRef.current = stockMovementsRef.current.filter(m => m.id !== back.id);
      setStockMovementsState(prev => prev.filter(m => m.id !== back.id));
      recomputeItemStock(back.itemId);
      supabase.from('stock_movements').delete().eq('id', back.id).then(({ error }) => { if (error) reportCascade('Shortage reversal undo', error); });
    };
    saveStockMovement(back, {
      onSaved: () => {
        const finish = () => {
          emitAudit({ entityType: 'stockMovement', entityId: orig.id, action: 'delete', before: { qty: orig.qty, amount: orig.amount, person: orig.responsiblePerson, voucherNo: orig.referenceNo }, reason: `Shortage cancelled: ${reason}` });
          toastRef.current({ title: tr('घटत रद्द', 'Shortage cancelled'), description: tr(`${orig.referenceNo}: स्टॉक वापस जुड़ा, वाउचर रद्द।`, `${orig.referenceNo}: stock restored, voucher cancelled.`) });
          onDone?.(true);
        };
        if (!voucher) { finish(); return; }   // the voucher is already gone — putting the stock back is all that is left
        const started = cancelVoucher(voucher.id, `Shortage cancelled: ${reason}`, by, {
          viaParent: true,
          onCancelled: finish,
          onFailed: msg => { undoBack(); toastRef.current({ title: tr('घटत रद्द नहीं हुई', 'Shortage not cancelled'), description: msg, variant: 'destructive', duration: 12000 }); onDone?.(false); },
        });
        if (!started) { undoBack(); onDone?.(false); }
      },
      onFailed: () => onDone?.(false),
    });
    return true;
  }, [cancelVoucher, user?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Board-approved write-off of a person's shortage dues: Dr Wastage / Shortage expense / Cr the person's ledger.
  const writeOffShortage = useCallback((input: { personAccountId: string; amount: number; date: string; resolutionNo: string; onDone?: (ok: boolean) => void }): boolean => {
    if (guardFYLocked()) return false;
    if (guardPermission('create', tr('घटत बट्टे खाते डालने', 'write off a shortage'))) return false;
    const person = accountsRef.current.find(a => a.id === input.personAccountId);
    const amount = Math.round((Number(input.amount) || 0) * 100) / 100;
    if (!person || !(amount > 0) || !input.resolutionNo.trim()) {
      toastRef.current({ title: tr('बट्टे खाते नहीं डाला', 'Not written off'), description: tr('व्यक्ति, रकम और Board प्रस्ताव संख्या ज़रूरी हैं।', 'The person, amount and Board resolution no. are required.'), variant: 'destructive', duration: 8000 });
      return false;
    }
    const by = user?.name ?? 'System';
    void (async () => {
      let exp = findWriteOffAccount(accountsRef.current);
      if (!exp) exp = await createAccountAwaited({ ...WRITE_OFF_HEAD, type: 'expense', subtype: 'direct_expense', openingBalance: 0, openingBalanceType: 'debit', isGroup: false, parentId: directExpenseParent(accountsRef.current) });
      if (!exp) { input.onDone?.(false); return; }
      const v = addVoucher({
        type: 'journal', date: input.date, debitAccountId: exp.id, creditAccountId: person.id, amount, createdBy: by, refType: REF_SHORTAGE_WRITEOFF, refId: person.id,
        narration: `${tr('गोदाम घटत बट्टे खाते', 'Godown shortage written off')}: ${person.name} — ${tr('Board प्रस्ताव', 'Board resolution')} ${input.resolutionNo.trim()}`,
      }, {
        onSaved: saved => { toastRef.current({ title: tr('बट्टे खाते डाला गया', 'Written off'), description: `${saved.voucherNo}: ₹${amount.toFixed(2)} — ${person.name}` }); input.onDone?.(true); },
        onFailed: () => input.onDone?.(false),
      });
      if (!v.id) input.onDone?.(false);
    })();
    return true;
  }, [addVoucher, addAccount, user?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // RULE 3: a shortage voucher belongs to its stock entry — cancelled only from the shortage register, which puts
  // the stock back in the same step.
  useEffect(() => registerVoucherOwner('stock-shortage', id => {
    const v = vouchersRef.current.find(x => x.id === id);
    return v && v.refType === REF_SHORTAGE && !v.isDeleted ? tr('गोदाम घटत रजिस्टर (Godown Shortage Register)', 'Godown Shortage Register') : null;
  }), [registerVoucherOwner]); // eslint-disable-line react-hooks/exhaustive-deps

  // ECR-20: inter-godown transfer — moves stock between godowns as a pair of adjustment
  // movements (OUT -qty at source, IN +qty at dest) that net to zero society-wide, so the
  // canonical stock formula (RULE-2) needs no change. Persisted atomically: if either leg's
  // base save fails, BOTH are rolled back (RULE-1) so a half-transfer can never occur.
  const transferStock = useCallback((input: { itemId: string; fromGodownId: string; toGodownId: string; qty: number; date?: string }): boolean => {
    if (guardFYLocked()) return false;
    const movs = stockMovementsRef.current;
    // Batch C (RULE 2): availability from the SAME movements the godown report shows — opening stock
    // + movements reconciled against live purchase/sale records (raw movements missed the opening).
    const rows = computeGodownStock(godownMovementsWithOpening(stockItemsRef.current, reconcileMovements(movs, salesRef.current, purchasesRef.current)));
    const srcRow = rows.find(r => r.itemId === input.itemId && r.godownId === input.fromGodownId);
    const availableQty = srcRow?.qty ?? 0;
    const v = validateTransfer({ fromGodownId: input.fromGodownId, toGodownId: input.toGodownId, qty: input.qty, availableQty });
    if (!v.ok) { toastRef.current({ title: tr('स्थानांतरण नहीं हुआ', 'Transfer not done'), description: v.error, variant: 'destructive', duration: 8000 }); return false; }

    const rate = srcRow && srcRow.qty > 0 ? srcRow.value / srcRow.qty : 0;
    const nameOf = (id: string) => id === UNASSIGNED_GODOWN ? tr('बिना गोदाम', 'No godown') : (godowns.find(g => g.id === id)?.name || id);
    const seq = new Set(movs.filter(m => (m.referenceNo || '').startsWith('TRF/')).map(m => m.referenceNo)).size + 1;
    const transferNo = `TRF/${seq}`;
    const date = input.date || new Date().toISOString().split('T')[0];
    const [outLeg, inLeg] = buildTransferLegs({ ...input, rate, date, transferNo, fromLabel: nameOf(input.fromGodownId), toLabel: nameOf(input.toGodownId) });
    const now = new Date().toISOString();
    const outMv: StockMovement = { ...outLeg, id: crypto.randomUUID(), createdAt: now };
    const inMv: StockMovement = { ...inLeg, id: crypto.randomUUID(), createdAt: now };

    stockMovementsRef.current = [...movs, outMv, inMv];
    setStockMovementsState(prev => [...prev, outMv, inMv]);

    const rollback = (msg: string) => {
      stockMovementsRef.current = stockMovementsRef.current.filter(m => m.id !== outMv.id && m.id !== inMv.id);
      setStockMovementsState(prev => prev.filter(m => m.id !== outMv.id && m.id !== inMv.id));   // RULE 1: roll back BOTH legs
      toastRef.current({ title: tr('स्थानांतरण सेव नहीं हुआ', 'Transfer not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${msg}. Refresh करने पर transfer नहीं रहेगा।`, `Not saved to the cloud — ${msg}. The transfer will be lost on Refresh.`), variant: 'destructive', duration: 12000 });
    };
    const baseOf = (m: StockMovement) => { const { godownId: _g, ...base } = m; return base; };
    Promise.all([
      supabase.from('stock_movements').upsert(withSoc(baseOf(outMv))),
      supabase.from('stock_movements').upsert(withSoc(baseOf(inMv))),
    ]).then(([r1, r2]) => {
      const err = r1.error || r2.error;
      if (err) { console.error('DB sync error (transfer):', err.message); rollback(err.message); return; }
      // step-2: patch godownId on both legs (overlay column — never blocks the base save).
      supabase.from('stock_movements').update({ godownId: outMv.godownId }).eq('id', outMv.id).then(({ error }) => { if (error) { console.warn('Transfer OUT godown patch:', error.message); reportError('write-partial', error.message, { at: 'Transfer OUT godown patch:' }); } });
      supabase.from('stock_movements').update({ godownId: inMv.godownId }).eq('id', inMv.id).then(({ error }) => { if (error) { console.warn('Transfer IN godown patch:', error.message); reportError('write-partial', error.message, { at: 'Transfer IN godown patch:' }); } });
      emitAudit({ entityType: 'stockMovement', entityId: transferNo, action: 'create', after: { itemId: input.itemId, from: input.fromGodownId, to: input.toGodownId, qty: input.qty }, reason: `Inter-godown transfer ${transferNo}` });
    });
    toastRef.current({ title: tr('स्थानांतरण दर्ज', 'Transfer recorded'), description: `${transferNo}: ${input.qty} ${nameOf(input.fromGodownId)} → ${nameOf(input.toGodownId)}` });
    return true;
  }, [godowns]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sales ──────────────────────────────────────────────────────────────────
  const addSale = useCallback((data: Omit<Sale, 'id' | 'saleNo' | 'createdAt'>): Sale => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as Sale;
    // RM-01: refuse up front for the reasons addVoucher would — no load-time repair re-creates the voucher later.
    if (guardVoucherPostable(data.date)) return { ...data, id: '' } as unknown as Sale;
    // Enforce per-item Sales A/c (group): block posting if any STOCK item being
    // sold has no salesAccountId, so sales never silently fall back to '4101'.
    const unmappedNames = data.items
      .map(it => stockItems.find(s => s.id === it.itemId))
      .filter((s): s is NonNullable<typeof s> => !!s && !s.salesAccountId)
      .map(s => s.name);
    if (unmappedNames.length > 0) {
      throw new Error(
        tr(`इन वस्तुओं को पहले बिक्री खाता (group) असाइन करें: ${unmappedNames.join(', ')} — फिर बिक्री पोस्ट होगी। (Assign a Sales A/c to: ${unmappedNames.join(', ')})`, `First assign a Sales account (group) to these items: ${unmappedNames.join(', ')} — then the sale will post. (Assign a Sales A/c to: ${unmappedNames.join(', ')})`)
      );
    }
    // Batch C: a line whose item is not in the stock list has no routing at all — it used to fall to
    // '4101' (in the marketing chart that is "Fertilizer Sales"). Refuse it instead.
    const unknownSale = unknownItemLines(data.items, stockItems);
    if (unknownSale.length > 0) throw new Error(UNKNOWN_ITEM_MESSAGE('sale', unknownSale));

    const fy = society.financialYear;
    const maxSaleNum = salesRef.current.filter(s => s.saleNo?.includes(fy)).reduce((max, s) => {
      const m = s.saleNo?.match(/\/(\d+)$/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const saleNo = `SL/${fy}/${String(maxSaleNum + 1).padStart(3, '0')}`;
    const grandTotal = data.grandTotal ?? data.netAmount;
    const lid = () => crypto.randomUUID();

    // Build multi-line sale voucher (ONE voucher covers everything)
    const lines: VoucherLine[] = [];

    // Dr: Cash / Bank / Debtor for grand total
    const debitAccId = data.paymentMode === 'cash' ? ACCOUNT_IDS.CASH
      : data.paymentMode === 'bank' ? (data.bankAccountId || defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK)
      // Credit: an explicit receivable account (e.g. Consumer member-receivable control) wins,
      // else the linked customer's sub-ledger, else Sundry Debtors.
      : (data.receivableAccountId || (data.customerId ? (customers.find(c => c.id === data.customerId)?.accountId || defaultDebtorsAccountId(accountsRef.current)) : defaultDebtorsAccountId(accountsRef.current)));
    lines.push({ id: lid(), accountId: debitAccId, type: 'Dr', amount: grandTotal });

    // Cr: Sales A/c — split by each item's salesAccountId so multi-product societies
    // get per-category lines in TB / Trading A/c. Falls back to '4101' for unmapped items.
    // Cr: Sales A/c — T-02 / RULE 4: split net (grandTotal − tax) across each item's
    // salesAccountId in exact paise so the Cr lines sum to exactly the net and the voucher
    // balances by construction. Falls back to '4101' for unmapped items.
    splitNetByAccount(
      data.items.map(it => ({ accountId: stockItems.find(s => s.id === it.itemId)?.salesAccountId || '4101', weight: it.amount })),
      goodsBase('sale', grandTotal, data.roundOff), data.taxAmount || 0,
    ).forEach(({ accountId, amount }) => lines.push({ id: lid(), accountId, type: 'Cr', amount }));

    // Cr: GST output — head-wise (Output CGST / SGST / IGST), or the combined 2201 (lib/accounting/gstLedgers)
    gstLegs('output', { cgst: data.cgstAmount, sgst: data.sgstAmount, igst: data.igstAmount, total: data.taxAmount || 0 }, { legacy: false })
      .forEach(g => lines.push({ id: lid(), accountId: g.accountId, type: 'Cr', amount: g.amount, narration: g.head === 'combined' ? `GST: CGST ₹${data.cgstAmount||0} + SGST ₹${data.sgstAmount||0} + IGST ₹${data.igstAmount||0}` : gstLegLabel('output', g) }));
    // Round off (5499) — outside the taxable value and GST.
    adjustmentLines('sale', accountsRef.current, data.roundOff).forEach(l => lines.push({ id: lid(), ...l }));

    const vType = data.paymentMode === 'credit' ? 'sale' : 'receipt';
    const saleId = lid();
    // S3-f-1 / ARCH-03: the voucher is saved together with the sale in ONE server call (postStockDocument).
    let viaServer: { v: Voucher; ev: LedgerEvent; rollback: () => void } | null = null;
    const newVoucher = addVoucher({
      type: vType,
      date: data.date,
      lines,
      debitAccountId: debitAccId,
      creditAccountId: '4101',
      amount: grandTotal,
      narration: data.narration || `Sale: ${data.customerName} — ${saleNo}`,
      createdBy: data.createdBy,
      refType: 'sale',
      refId: saleId,
    }, { persistWith: (v, ev, rollback) => { viaServer = { v, ev, rollback }; } });
    // RM-01: no voucher ⇒ no sale. addVoucher already toasted why; stop before stock or the sale row
    // is written, so a sale can never exist without its voucher (nothing repairs it on load any more).
    const server = viaServer as { v: Voucher; ev: LedgerEvent; rollback: () => void } | null;
    if (!newVoucher.id || !server) return { ...data, id: '' } as unknown as Sale;

    // Stock movements — local only; the server writes them with the sale.
    const saleMovements: StockMovement[] = [];
    const stockBefore = new Map(stockItems.map(i => [i.id, i.currentStock]));
    data.items.forEach(item => {
      setStockItemsState(prev => {
        const updated = prev.map(i => {
          if (i.id !== item.itemId) return i;
          const newStock = Math.max(0, i.currentStock - item.qty);
          return { ...i, currentStock: newStock };
        });
        return updated;
      });
      const mv: StockMovement = { id: lid(), date: data.date, itemId: item.itemId, type: 'sale', qty: item.qty, rate: item.rate, amount: item.amount, referenceNo: saleNo, narration: `Sale to ${data.customerName}`, godownId: activeGodownIdRef.current || undefined, createdAt: new Date().toISOString() };
      saleMovements.push(mv);
      setStockMovementsState(prev => [...prev, mv]);
    });

    // receivableAccountId is routing-only (chose the credit debtor above) — never store it on
    // the sale row (no column; would break a later updateSale upsert).
    const { receivableAccountId: _omitRcv, ...saleFields } = data;
    const saleCustomer = data.customerId ? customers.find(c => c.id === data.customerId) : undefined;
    const saleTerms = billTerms({ paymentMode: data.paymentMode, date: data.date, creditDays: data.creditDays, partyCreditDays: saleCustomer?.creditDays, rule: resolveLateFeeRule(saleCustomer?.lateFeeRule, society.lateFeeRules?.sales) });
    const sale: Sale = { ...saleFields, ...saleTerms, id: saleId, saleNo, voucherId: newVoucher.id, gstVoucherIds: undefined, createdAt: new Date().toISOString(), branchId: data.branchId ?? branchToStamp(activeBranchIdRef.current, headOfficeIdRef.current) };
    salesRef.current = [...salesRef.current, sale];
    setSalesState(prev => [...prev, sale]);

    const mvIds = new Set(saleMovements.map(m => m.id));
    postStockDocument({
      kind: 'sale', doc: sale, voucher: server.v, event: server.ev, movements: saleMovements, rollbackVoucher: server.rollback,
      undoLocal: () => {
        salesRef.current = salesRef.current.filter(s => s.id !== sale.id);
        setSalesState(prev => prev.filter(s => s.id !== sale.id));
        stockMovementsRef.current = stockMovementsRef.current.filter(m => !mvIds.has(m.id));
        setStockMovementsState(prev => prev.filter(m => !mvIds.has(m.id)));
        setStockItemsState(prev => prev.map(i => stockBefore.has(i.id) && data.items.some(it => it.itemId === i.id) ? { ...i, currentStock: stockBefore.get(i.id)! } : i));
      },
    });
    return sale;
  }, [society.financialYear, customers, accounts, addVoucher, stockItems]);

  // H4 / RULE 3: a sale/purchase with a LIVE return cannot be deleted — the return would be left
  // pointing at a deleted bill (prod 2026-09: Rania's returns outlived their sale and purchase).
  // Returns live in ConsumerDataContext, but their vouchers carry refType '<kind>.return' +
  // refId = the bill, so the live-return check needs no cross-context state.
  const guardLiveReturns = (kind: 'sale' | 'purchase', docId: string): boolean => {
    const n = vouchersRef.current.filter(v => !v.isDeleted && v.refType === `${kind}.return` && v.refId === docId).length;
    if (n === 0) return false;
    const page = kind === 'sale' ? tr('बिक्री वापसी (Sales Return)', 'Sales Return') : tr('ख़रीद वापसी (Purchase Return)', 'Purchase Return');
    toastRef.current({ title: tr('पहले वापसी (return) हटाएँ', 'Delete the return first'), description: tr(`इस ${kind === 'sale' ? 'बिक्री' : 'ख़रीद'} की ${n} चालू वापसी है। पहले ${page} page से उसे delete करें, फिर यह बिल हटेगा।`, `This ${kind === 'sale' ? 'sale' : 'purchase'} has ${n} active return(s). Delete it from the ${page} page first, then this bill can be deleted.`), variant: 'destructive', duration: 10000 });
    return true;
  };

  const deleteSale = useCallback((id: string): boolean => {
    if (guardPermission('delete', tr('बिक्री मिटाने', 'delete sales'))) return false;   // ECR-06: role gate
    if (guardFYLocked()) return false;
    if (guardLiveReturns('sale', id)) return false;
    // S3-f-2 / ARCH-03: the whole delete is one server transaction (the old client path is gone).
    const sale = salesRef.current.find(s => s.id === id);
    if (!sale) return false;
    cancelStockDocument('sale', sale, sale.saleNo, [sale.voucherId, ...(sale.gstVoucherIds ?? [])].filter(Boolean) as string[], `Sale ${sale.saleNo} deleted`);
    emitAudit({ entityType: 'sale', entityId: id, action: 'delete', reason: 'Sale deleted' });
    return true;
  }, []);

  const updateSale = useCallback((id: string, data: Omit<Sale, 'id' | 'saleNo' | 'createdAt'>): Sale | null => {
    if (guardFYLocked()) return null;
    // Enforce per-item Sales A/c (group) BEFORE mutating anything (no data loss).
    const unmappedNames = data.items
      .map(it => stockItems.find(s => s.id === it.itemId))
      .filter((s): s is NonNullable<typeof s> => !!s && !s.salesAccountId)
      .map(s => s.name);
    if (unmappedNames.length > 0) {
      toastRef.current({
        title: tr('बिक्री खाता आवश्यक', 'Sales account required'),
        description: tr(`इन वस्तुओं को पहले बिक्री खाता (group) असाइन करें: ${unmappedNames.join(', ')}`, `First assign a sales account (group) to these items: ${unmappedNames.join(', ')}`),
        variant: 'destructive',
        duration: 10000,
      });
      return null;
    }
    const unknownSaleU = unknownItemLines(data.items, stockItems);
    if (unknownSaleU.length > 0) {
      toastRef.current({ title: tr('वस्तु नहीं मिली', 'Item not found'), description: UNKNOWN_ITEM_MESSAGE('sale', unknownSaleU), variant: 'destructive', duration: 10000 });
      return null;
    }
    const original = salesRef.current.find(s => s.id === id);
    if (!original) {
      toastRef.current({ title: tr('बिक्री नहीं मिली', 'Sale not found'), description: tr('Refresh करके दोबारा देखें। (Sale not found.)', 'Refresh and check again. (Sale not found.)'), variant: 'destructive' });
      return null;
    }
    // RM-17: a bill whose voucher sits on the combined GST ledger stays there when edited (no history moves).
    const legacyGst = usesCombinedGst('output', ...[original.voucherId, ...(original.gstVoucherIds ?? [])].map(vid => vouchersRef.current.find(v => v.id === vid)));
    // RM-01: check every voucher-birth refusal BEFORE stock is adjusted or the old voucher is cancelled —
    // both the original date and the new one — so an edit cannot stop half-way.
    if (guardVoucherPostable(original.date, data.date)) return null;

    const now = new Date().toISOString();
    const lid = () => crypto.randomUUID();
    // S3-f-3 / ARCH-03: every write below is LOCAL only; update_stock_document then does them all in one
    // transaction, and the snapshots here undo the local state if it refuses (the old client path is gone).
    const stockBefore = new Map<string, { cs: number; rate: number }>();
    const oldMovs = stockMovementsRef.current.filter(m => m.referenceNo === original.saleNo);
    const newMovs: StockMovement[] = [];
    let oldVouchers: Voucher[] = [];
    let viaServer: { v: Voucher; ev: LedgerEvent; rollback: () => void } | null = null;

    // 1️⃣ Compute net stock delta (sale REDUCES stock — revert old qty adds back, new qty subtracts).
    const stockDelta = new Map<string, number>();
    original.items.forEach(item => {
      stockDelta.set(item.itemId, (stockDelta.get(item.itemId) || 0) + item.qty); // revert old sale → add back
    });
    data.items.forEach(item => {
      stockDelta.set(item.itemId, (stockDelta.get(item.itemId) || 0) - item.qty); // new sale → subtract
    });

    setStockItemsState(prev => prev.map(i => {
      const delta = stockDelta.get(i.id);
      if (delta == null || delta === 0) return i;
      const newStock = Math.max(0, i.currentStock + delta);
      stockBefore.set(i.id, { cs: i.currentStock, rate: i.purchaseRate });
      return { ...i, currentStock: newStock };
    }));

    // 1b: Delete old stock_movements rows for this sale (so movement sum stays correct).
    const _delSaleEditMovs = stockMovementsRef.current.filter(m => m.referenceNo === original.saleNo);   // ECR-21: archive before hard-delete
    if (_delSaleEditMovs.length) emitAudit({ entityType: 'stockMovement', entityId: original.saleNo, action: 'delete', before: { count: _delSaleEditMovs.length, movements: snapshotDeletedMovements(_delSaleEditMovs) }, reason: `Sale ${original.saleNo} edited (movements replaced)` });
    stockMovementsRef.current = stockMovementsRef.current.filter(m => m.referenceNo !== original.saleNo);
    setStockMovementsState(prev => prev.filter(m => m.referenceNo !== original.saleNo));

    // 2️⃣ Soft-cancel the original sale voucher(s) + drop voucher_entries
    const linkedIds = ([original.voucherId, ...(original.gstVoucherIds ?? [])].filter(Boolean) as string[]).filter(vid => !isEngineVoucher(vouchersRef.current.find(v => v.id === vid)));
    oldVouchers = vouchersRef.current.filter(v => linkedIds.includes(v.id) && !v.isDeleted);
    const oldIds = new Set(oldVouchers.map(v => v.id));
    const cancelV = (v: Voucher) => oldIds.has(v.id) ? { ...v, isDeleted: true, deletedAt: now, deletedBy: data.createdBy || 'System', deletedReason: `Sale ${original.saleNo} edited` } : v;
    vouchersRef.current = vouchersRef.current.map(cancelV);
    setVouchersState(prev => prev.map(cancelV));
    const undoLocal = () => {
      const back = new Map(oldVouchers.map(v => [v.id, v]));
      vouchersRef.current = vouchersRef.current.map(v => back.get(v.id) ?? v);
      setVouchersState(prev => prev.map(v => back.get(v.id) ?? v));
      const newIds = new Set(newMovs.map(m => m.id));
      stockMovementsRef.current = [...stockMovementsRef.current.filter(m => !newIds.has(m.id)), ...oldMovs];
      setStockMovementsState(prev => [...prev.filter(m => !newIds.has(m.id)), ...oldMovs]);
      setStockItemsState(prev => prev.map(i => stockBefore.has(i.id) ? { ...i, currentStock: stockBefore.get(i.id)!.cs, purchaseRate: stockBefore.get(i.id)!.rate } : i));
      salesRef.current = salesRef.current.map(x => x.id === id ? original : x);
      setSalesState(prev => prev.map(x => x.id === id ? original : x));
    };

    // 3️⃣ Build fresh voucher lines from new data
    const grandTotal = data.grandTotal ?? data.netAmount;
    const lines: VoucherLine[] = [];
    const debitAccId = data.paymentMode === 'cash' ? ACCOUNT_IDS.CASH
      : data.paymentMode === 'bank' ? (data.bankAccountId || defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK)
      // Credit: an explicit receivable account (e.g. Consumer member-receivable control) wins,
      // else the linked customer's sub-ledger, else Sundry Debtors.
      : (data.receivableAccountId || (data.customerId ? (customers.find(c => c.id === data.customerId)?.accountId || defaultDebtorsAccountId(accountsRef.current)) : defaultDebtorsAccountId(accountsRef.current)));
    lines.push({ id: lid(), accountId: debitAccId, type: 'Dr', amount: grandTotal });

    // T-02 / RULE 4: exact-paise split by salesAccountId (same shared rule as addSale / repair).
    splitNetByAccount(
      data.items.map(it => ({ accountId: stockItems.find(s => s.id === it.itemId)?.salesAccountId || '4101', weight: it.amount })),
      goodsBase('sale', grandTotal, data.roundOff), data.taxAmount || 0,
    ).forEach(({ accountId, amount }) => lines.push({ id: lid(), accountId, type: 'Cr', amount }));
    gstLegs('output', { cgst: data.cgstAmount, sgst: data.sgstAmount, igst: data.igstAmount, total: data.taxAmount || 0 }, { legacy: legacyGst })
      .forEach(g => lines.push({ id: lid(), accountId: g.accountId, type: 'Cr', amount: g.amount, narration: g.head === 'combined' ? `GST: CGST ₹${data.cgstAmount||0} + SGST ₹${data.sgstAmount||0} + IGST ₹${data.igstAmount||0}` : gstLegLabel('output', g) }));
    // Round off (5499) — outside the taxable value and GST.
    adjustmentLines('sale', accountsRef.current, data.roundOff).forEach(l => lines.push({ id: lid(), ...l }));

    const vType = data.paymentMode === 'credit' ? 'sale' : 'receipt';
    const newVoucher = addVoucher({
      type: vType,
      date: data.date,
      lines,
      debitAccountId: debitAccId,
      creditAccountId: '4101',
      amount: grandTotal,
      narration: data.narration || `Sale: ${data.customerName} — ${original.saleNo}`,
      createdBy: data.createdBy,
      refType: 'sale',
      refId: id,
    }, { persistWith: (v, ev, rollback) => { viaServer = { v, ev, rollback }; } });
    // Nothing was sent yet — a refused voucher just undoes the local edit.
    const srv = viaServer as { v: Voucher; ev: LedgerEvent; rollback: () => void } | null;
    if (!newVoucher.id || !srv) { undoLocal(); return null; }

    // 4️⃣ Add fresh stock_movement rows for the edited sale
    data.items.forEach(item => {
      const mv: StockMovement = { id: lid(), date: data.date, itemId: item.itemId, type: 'sale', qty: item.qty, rate: item.rate, amount: item.amount, referenceNo: original.saleNo, narration: `Sale to ${data.customerName} (edited)`, godownId: activeGodownIdRef.current || undefined, createdAt: now };
      newMovs.push(mv);
      stockMovementsRef.current = [...stockMovementsRef.current, mv];
      setStockMovementsState(prev => [...prev, mv]);
    });

    // 5️⃣ Update the sale record in place (same id + saleNo)
    const updCustomer = data.customerId ? customers.find(c => c.id === data.customerId) : undefined;
    const updated: Sale = {
      ...data,
      ...billTerms({ paymentMode: data.paymentMode, date: data.date, creditDays: data.creditDays, partyCreditDays: updCustomer?.creditDays, rule: resolveLateFeeRule(updCustomer?.lateFeeRule, society.lateFeeRules?.sales), original }),
      id,
      saleNo: original.saleNo,
      voucherId: newVoucher.id,
      gstVoucherIds: undefined,
      createdAt: original.createdAt,
      branchId: original.branchId ?? data.branchId,   // ECR-17 Phase 4: a sale keeps its branch across edits
    };
    salesRef.current = salesRef.current.map(s => s.id === id ? updated : s);
    setSalesState(prev => prev.map(s => s.id === id ? updated : s));
    // H11: a bill edited after the fact was audited to the console only — now a durable row.
    emitAudit({ entityType: 'sale', entityId: id, action: 'update', before: { date: original.date, grandTotal: original.grandTotal, items: original.items.length }, after: { date: updated.date, grandTotal: updated.grandTotal, items: updated.items.length }, reason: `Sale ${original.saleNo} edited` });

    postStockDocumentEdit({ kind: 'sale', doc: updated, voucher: srv.v, event: srv.ev, movements: newMovs, undo: () => { srv.rollback(); undoLocal(); } });
    return updated;
  }, [society.fyLocked, customers, accounts, addVoucher, stockItems]);

  // ── Purchases ──────────────────────────────────────────────────────────────
  const addPurchase = useCallback((data: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt'>): Purchase => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as Purchase;
    // RM-01: refuse up front for the reasons addVoucher would — no load-time repair re-creates the voucher later.
    if (guardVoucherPostable(data.date)) return { ...data, id: '' } as unknown as Purchase;
    // Reverse charge (lib/rcm.rcmPurchaseTerms): the GST is owed to the government, not to the supplier, so the
    // bill total carries no GST. No reverse-charge payable head → refuse BEFORE anything is changed.
    const rcmT = rcmPurchaseTerms(data);
    const rcmAccId = rcmT.rcm ? rcmPayableAccountId(accountsRef.current, localOnlyAccountIdsRef.current) : null;
    if (rcmT.rcm && !rcmAccId) {
      toastRef.current({ title: tr('RCM देय खाता नहीं मिला', 'RCM payable account not found'), description: tr('"Reverse Charge GST Payable (RCM)" (2297) खाता chart में नहीं है — पहले Ledger Heads में बनाएँ, फिर यह खरीद सेव करें। कुछ भी सेव नहीं हुआ। (No reverse-charge payable ledger — nothing was saved.)', 'The "Reverse Charge GST Payable (RCM)" (2297) account is not in the chart — create it in Ledger Heads first, then save this purchase. Nothing was saved. (No reverse-charge payable ledger — nothing was saved.)'), variant: 'destructive', duration: 12000 });
      return { ...data, id: '' } as unknown as Purchase;
    }
    if (rcmT.rcm) data = { ...data, grandTotal: rcmT.grandTotal };
    // Enforce per-item Purchase A/c (group): block posting if any STOCK item being
    // purchased has no purchaseAccountId, so purchases never silently fall to '5101'.
    const unmappedNames = data.items
      .map(it => stockItems.find(s => s.id === it.itemId))
      .filter((s): s is NonNullable<typeof s> => !!s && !s.purchaseAccountId)
      .map(s => s.name);
    if (unmappedNames.length > 0) {
      throw new Error(
        tr(`इन वस्तुओं को पहले खरीद खाता (group) असाइन करें: ${unmappedNames.join(', ')} — फिर खरीद पोस्ट होगी। (Assign a Purchase A/c to: ${unmappedNames.join(', ')})`, `First assign a Purchase account (group) to these items: ${unmappedNames.join(', ')} — then the purchase will post. (Assign a Purchase A/c to: ${unmappedNames.join(', ')})`)
      );
    }
    // Batch C: an item not in the stock list has no routing — it used to fall to '5101'. Refuse it.
    const unknownPurchase = unknownItemLines(data.items, stockItems);
    if (unknownPurchase.length > 0) throw new Error(UNKNOWN_ITEM_MESSAGE('purchase', unknownPurchase));

    const fy = society.financialYear;
    const maxPurNum = purchasesRef.current.filter(p => p.purchaseNo?.includes(fy)).reduce((max, p) => {
      const m = p.purchaseNo?.match(/\/(\d+)$/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const purchaseNo = `PUR/${fy}/${String(maxPurNum + 1).padStart(3, '0')}`;
    const grandTotal = data.grandTotal ?? data.netAmount;
    const lid = () => crypto.randomUUID();

    // Build multi-line purchase voucher
    const lines: VoucherLine[] = [];
    const supplierAccId = data.supplierId ? (suppliers.find(s => s.id === data.supplierId)?.accountId || defaultCreditorsAccountId(accountsRef.current)) : defaultCreditorsAccountId(accountsRef.current);
    const creditAccId = data.paymentMode === 'cash' ? ACCOUNT_IDS.CASH
      : data.paymentMode === 'bank' ? (data.bankAccountId || defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK)
      : supplierAccId;

    // Dr: Purchases A/c — split by each item's purchaseAccountId so multi-product
    // societies get per-category lines. Falls back to '5101' for unmapped items.
    // Dr: Purchases A/c — T-02 / RULE 4: split net (grandTotal − tax + tds) across each item's
    // purchaseAccountId in exact paise so the Dr lines sum to exactly the net and the voucher
    // balances by construction. Falls back to '5101' for unmapped items.
    splitNetByAccount(
      data.items.map(it => ({ accountId: stockItems.find(s => s.id === it.itemId)?.purchaseAccountId || '5101', weight: it.amount })),
      goodsBase('purchase', grandTotal, data.roundOff, data.cashDiscount), rcmT.taxInPayable, data.tdsAmount || 0, data.tcsAmount || 0,
    ).forEach(({ accountId, amount }) => lines.push({ id: lid(), accountId, type: 'Dr', amount }));

    // Dr: GST input credit — head-wise (Input CGST / SGST / IGST), or the combined 3310 (lib/accounting/gstLedgers)
    gstLegs('input', { cgst: data.cgstAmount, sgst: data.sgstAmount, igst: data.igstAmount, total: data.taxAmount || 0 }, { legacy: false })
      .forEach(g => lines.push({ id: lid(), accountId: g.accountId, type: 'Dr', amount: g.amount, narration: g.head === 'combined' ? `GST ITC: CGST ₹${data.cgstAmount||0} + SGST ₹${data.sgstAmount||0} + IGST ₹${data.igstAmount||0}` : gstLegLabel('input', g) }));
    // Cr: reverse-charge GST payable (2297) — the society owes this tax to the government as recipient; the supplier
    // is credited the value only (CGST Act s.9(3)/(4), s.2(98); kept apart from output tax: s.2(82), Rule 56(4)).
    if (rcmT.rcm) lines.push({ id: lid(), accountId: rcmAccId!, type: 'Cr', amount: rcmT.rcmTax, narration: `RCM देय (reverse charge): CGST ₹${data.cgstAmount||0} + SGST ₹${data.sgstAmount||0} + IGST ₹${data.igstAmount||0}` });

    // Dr: TDS / TCS Receivable (3307) — the seller collected this income tax FROM us and put it
    // on the bill, so it is our 26AS credit, not the goods' cost. Dr, never Cr 2202.
    if ((data.tcsAmount ?? 0) > 0) {
      lines.push({ id: lid(), accountId: ACCOUNT_IDS.TAX_CREDIT, type: 'Dr', amount: data.tcsAmount!, narration: `TCS ${data.tcsPct||0}% — collected by ${data.supplierName}` });
    }

    // Cr: Cash / Bank / Supplier for net payable (grandTotal already = net + tax + TCS − TDS)
    const netPayable = grandTotal;
    if (netPayable > 0) {
      lines.push({ id: lid(), accountId: creditAccId, type: 'Cr', amount: netPayable });
    }

    // Cr: TDS Payable (2202) for TDS amount
    if ((data.tdsAmount ?? 0) > 0) {
      lines.push({ id: lid(), accountId: '2202', type: 'Cr', amount: data.tdsAmount!, narration: `TDS ${data.tdsPct||0}%` });
    }
    // Cash discount (Cr 4499) + round off (5499) — after GST: taxable value, ITC and TDS unchanged.
    adjustmentLines('purchase', accountsRef.current, data.roundOff, data.cashDiscount).forEach(l => lines.push({ id: lid(), ...l }));

    const vType = data.paymentMode === 'credit' ? 'purchase' : 'payment';
    const purchaseId = lid();
    // S3-f-1 / ARCH-03: the voucher is saved together with the purchase in ONE server call (postStockDocument).
    let viaServer: { v: Voucher; ev: LedgerEvent; rollback: () => void } | null = null;
    const newVoucher = addVoucher({
      type: vType,
      date: data.date,
      lines,
      debitAccountId: '5101',
      creditAccountId: creditAccId,
      amount: grandTotal,
      narration: data.narration || `Purchase: ${data.supplierName} — ${purchaseNo}`,
      createdBy: data.createdBy,
      refType: 'purchase',
      refId: purchaseId,
    }, { persistWith: (v, ev, rollback) => { viaServer = { v, ev, rollback }; } });
    // RM-01: no voucher ⇒ no purchase (see addSale). Stop before stock or the purchase row is written.
    const server = viaServer as { v: Voucher; ev: LedgerEvent; rollback: () => void } | null;
    if (!newVoucher.id || !server) return { ...data, id: '' } as unknown as Purchase;

    // Stock movements — local only; the server writes them with the purchase.
    const purMovements: StockMovement[] = [];
    const stockBefore = new Map(stockItems.map(i => [i.id, { cs: i.currentStock, rate: i.purchaseRate }]));
    data.items.forEach(item => {
      setStockItemsState(prev => {
        const updated = prev.map(i => {
          if (i.id !== item.itemId) return i;
          const newStock = i.currentStock + item.qty;
          return { ...i, currentStock: newStock, purchaseRate: item.rate };
        });
        return updated;
      });
      const mv: StockMovement = { id: lid(), date: data.date, itemId: item.itemId, type: 'purchase', qty: item.qty, rate: item.rate, amount: item.amount, referenceNo: purchaseNo, narration: `Purchase from ${data.supplierName}`, godownId: activeGodownIdRef.current || undefined, createdAt: new Date().toISOString() };
      purMovements.push(mv);
      setStockMovementsState(prev => [...prev, mv]);
    });

    const purSupplier = data.supplierId ? suppliers.find(s => s.id === data.supplierId) : undefined;
    const purTerms = billTerms({ paymentMode: data.paymentMode, date: data.date, creditDays: data.creditDays, partyCreditDays: purSupplier?.creditDays, rule: resolveLateFeeRule(purSupplier?.lateFeeRule, society.lateFeeRules?.purchases) });
    const purchase: Purchase = { ...data, ...purTerms, id: purchaseId, purchaseNo, voucherId: newVoucher.id, taxVoucherIds: undefined, createdAt: new Date().toISOString(), branchId: data.branchId ?? branchToStamp(activeBranchIdRef.current, headOfficeIdRef.current) };
    purchasesRef.current = [...purchasesRef.current, purchase];
    setPurchasesState(prev => [...prev, purchase]);

    const mvIds = new Set(purMovements.map(m => m.id));
    postStockDocument({
      kind: 'purchase', doc: purchase, voucher: server.v, event: server.ev, movements: purMovements, rollbackVoucher: server.rollback,
      undoLocal: () => {
        purchasesRef.current = purchasesRef.current.filter(p => p.id !== purchase.id);
        setPurchasesState(prev => prev.filter(p => p.id !== purchase.id));
        stockMovementsRef.current = stockMovementsRef.current.filter(m => !mvIds.has(m.id));
        setStockMovementsState(prev => prev.filter(m => !mvIds.has(m.id)));
        setStockItemsState(prev => prev.map(i => stockBefore.has(i.id) && data.items.some(it => it.itemId === i.id) ? { ...i, currentStock: stockBefore.get(i.id)!.cs, purchaseRate: stockBefore.get(i.id)!.rate } : i));
      },
    });
    return purchase;
  }, [society.financialYear, suppliers, accounts, addVoucher, stockItems]);

  const deletePurchase = useCallback((id: string): boolean => {
    if (guardPermission('delete', tr('खरीद मिटाने', 'delete purchases'))) return false;   // ECR-06: role gate
    if (guardFYLocked()) return false;
    if (guardLiveReturns('purchase', id)) return false;
    // S3-f-2 / ARCH-03: the whole delete is one server transaction (the old client path is gone).
    const purchase = purchasesRef.current.find(p => p.id === id);
    if (!purchase) return false;
    cancelStockDocument('purchase', purchase, purchase.purchaseNo, [purchase.voucherId, ...(purchase.taxVoucherIds ?? [])].filter(Boolean) as string[], `Purchase ${purchase.purchaseNo} deleted`);
    emitAudit({ entityType: 'purchase', entityId: id, action: 'delete', reason: 'Purchase deleted' });
    return true;
  }, []);

  const updatePurchase = useCallback((id: string, data: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt'>): Purchase | null => {
    if (guardFYLocked()) return null;
    // Enforce per-item Purchase A/c (group) BEFORE mutating anything (no data loss).
    const unmappedNames = data.items
      .map(it => stockItems.find(s => s.id === it.itemId))
      .filter((s): s is NonNullable<typeof s> => !!s && !s.purchaseAccountId)
      .map(s => s.name);
    if (unmappedNames.length > 0) {
      toastRef.current({
        title: tr('खरीद खाता आवश्यक', 'Purchase account required'),
        description: tr(`इन वस्तुओं को पहले खरीद खाता (group) असाइन करें: ${unmappedNames.join(', ')}`, `First assign a purchase account (group) to these items: ${unmappedNames.join(', ')}`),
        variant: 'destructive',
        duration: 10000,
      });
      return null;
    }
    const unknownPurchaseU = unknownItemLines(data.items, stockItems);
    if (unknownPurchaseU.length > 0) {
      toastRef.current({ title: tr('वस्तु नहीं मिली', 'Item not found'), description: UNKNOWN_ITEM_MESSAGE('purchase', unknownPurchaseU), variant: 'destructive', duration: 10000 });
      return null;
    }
    const original = purchasesRef.current.find(p => p.id === id);
    if (!original) {
      toastRef.current({ title: tr('खरीद नहीं मिली', 'Purchase not found'), description: tr('Refresh करके दोबारा देखें। (Purchase not found.)', 'Refresh and check again. (Purchase not found.)'), variant: 'destructive' });
      return null;
    }
    // RM-17: a bill whose voucher sits on the combined ITC ledger stays there when edited (no history moves).
    const legacyGst = usesCombinedGst('input', original.voucherId ? vouchersRef.current.find(v => v.id === original.voucherId) : null);
    // Reverse charge (lib/rcm.rcmPurchaseTerms): the GST is owed to the government, not to the supplier, so the
    // bill total carries no GST. No reverse-charge payable head → refuse BEFORE anything is changed.
    const rcmT = rcmPurchaseTerms(data);
    const rcmAccId = rcmT.rcm ? rcmPayableAccountId(accountsRef.current, localOnlyAccountIdsRef.current) : null;
    if (rcmT.rcm && !rcmAccId) {
      toastRef.current({ title: tr('RCM देय खाता नहीं मिला', 'RCM payable account not found'), description: tr('"Reverse Charge GST Payable (RCM)" (2297) खाता chart में नहीं है — पहले Ledger Heads में बनाएँ, फिर यह खरीद सेव करें। कुछ भी सेव नहीं हुआ। (No reverse-charge payable ledger — nothing was saved.)', 'The "Reverse Charge GST Payable (RCM)" (2297) account is not in the chart — create it in Ledger Heads first, then save this purchase. Nothing was saved. (No reverse-charge payable ledger — nothing was saved.)'), variant: 'destructive', duration: 12000 });
      return null;
    }
    if (rcmT.rcm) data = { ...data, grandTotal: rcmT.grandTotal };
    // RM-01: check every voucher-birth refusal BEFORE stock is adjusted or the old voucher is cancelled.
    if (guardVoucherPostable(original.date, data.date)) return null;

    const now = new Date().toISOString();
    const lid = () => crypto.randomUUID();
    // S3-f-3 / ARCH-03: every write below is LOCAL only; update_stock_document then does them all in one
    // transaction, and the snapshots here undo the local state if it refuses (the old client path is gone).
    const stockBefore = new Map<string, { cs: number; rate: number }>();
    const oldMovs = stockMovementsRef.current.filter(m => m.referenceNo === original.purchaseNo);
    const newMovs: StockMovement[] = [];
    let oldVouchers: Voucher[] = [];
    let viaServer: { v: Voucher; ev: LedgerEvent; rollback: () => void } | null = null;

    // 1️⃣ Compute net stock delta per item (old qty -> new qty) and apply atomically
    const stockDelta = new Map<string, number>();
    original.items.forEach(item => {
      stockDelta.set(item.itemId, (stockDelta.get(item.itemId) || 0) - item.qty);
    });
    data.items.forEach(item => {
      stockDelta.set(item.itemId, (stockDelta.get(item.itemId) || 0) + item.qty);
    });
    const newRateMap = new Map<string, number>();
    data.items.forEach(item => { newRateMap.set(item.itemId, item.rate); });

    setStockItemsState(prev => prev.map(i => {
      const delta = stockDelta.get(i.id);
      if (delta == null || delta === 0 && !newRateMap.has(i.id)) return i;
      const newStock = Math.max(0, i.currentStock + (delta || 0));
      const newRate = newRateMap.get(i.id) ?? i.purchaseRate;
      stockBefore.set(i.id, { cs: i.currentStock, rate: i.purchaseRate });
      return { ...i, currentStock: newStock, purchaseRate: newRate };
    }));

    // 1️⃣b Delete old stock_movements for this purchase (so they don't double-count)
    const _delPurEditMovs = stockMovementsRef.current.filter(m => m.referenceNo === original.purchaseNo);   // ECR-21: archive before hard-delete
    if (_delPurEditMovs.length) emitAudit({ entityType: 'stockMovement', entityId: original.purchaseNo, action: 'delete', before: { count: _delPurEditMovs.length, movements: snapshotDeletedMovements(_delPurEditMovs) }, reason: `Purchase ${original.purchaseNo} edited (movements replaced)` });
    stockMovementsRef.current = stockMovementsRef.current.filter(m => m.referenceNo !== original.purchaseNo);
    setStockMovementsState(prev => prev.filter(m => m.referenceNo !== original.purchaseNo));

    // 2️⃣ Soft-delete the original purchase voucher(s)
    const linkedIds = ([original.voucherId, ...(original.taxVoucherIds ?? [])].filter(Boolean) as string[]).filter(vid => !isEngineVoucher(vouchersRef.current.find(v => v.id === vid)));
    oldVouchers = vouchersRef.current.filter(v => linkedIds.includes(v.id) && !v.isDeleted);
    const oldIds = new Set(oldVouchers.map(v => v.id));
    const cancelV = (v: Voucher) => oldIds.has(v.id) ? { ...v, isDeleted: true, deletedAt: now, deletedBy: data.createdBy || 'System', deletedReason: `Purchase ${original.purchaseNo} edited` } : v;
    vouchersRef.current = vouchersRef.current.map(cancelV);
    setVouchersState(prev => prev.map(cancelV));
    const undoLocal = () => {
      const back = new Map(oldVouchers.map(v => [v.id, v]));
      vouchersRef.current = vouchersRef.current.map(v => back.get(v.id) ?? v);
      setVouchersState(prev => prev.map(v => back.get(v.id) ?? v));
      const newIds = new Set(newMovs.map(m => m.id));
      stockMovementsRef.current = [...stockMovementsRef.current.filter(m => !newIds.has(m.id)), ...oldMovs];
      setStockMovementsState(prev => [...prev.filter(m => !newIds.has(m.id)), ...oldMovs]);
      setStockItemsState(prev => prev.map(i => stockBefore.has(i.id) ? { ...i, currentStock: stockBefore.get(i.id)!.cs, purchaseRate: stockBefore.get(i.id)!.rate } : i));
      purchasesRef.current = purchasesRef.current.map(x => x.id === id ? original : x);
      setPurchasesState(prev => prev.map(x => x.id === id ? original : x));
    };

    // 3️⃣ Build new voucher lines from updated data
    const grandTotal = data.grandTotal ?? data.netAmount;
    const lines: VoucherLine[] = [];
    const supplierAccId = data.supplierId ? (suppliers.find(s => s.id === data.supplierId)?.accountId || defaultCreditorsAccountId(accountsRef.current)) : defaultCreditorsAccountId(accountsRef.current);
    const creditAccId = data.paymentMode === 'cash' ? ACCOUNT_IDS.CASH
      : data.paymentMode === 'bank' ? (data.bankAccountId || defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK)
      : supplierAccId;

    // T-02 / RULE 4: exact-paise split by purchaseAccountId (same shared rule as addPurchase / repair).
    splitNetByAccount(
      data.items.map(it => ({ accountId: stockItems.find(s => s.id === it.itemId)?.purchaseAccountId || '5101', weight: it.amount })),
      goodsBase('purchase', grandTotal, data.roundOff, data.cashDiscount), rcmT.taxInPayable, data.tdsAmount || 0, data.tcsAmount || 0,
    ).forEach(({ accountId, amount }) => lines.push({ id: lid(), accountId, type: 'Dr', amount }));
    gstLegs('input', { cgst: data.cgstAmount, sgst: data.sgstAmount, igst: data.igstAmount, total: data.taxAmount || 0 }, { legacy: legacyGst })
      .forEach(g => lines.push({ id: lid(), accountId: g.accountId, type: 'Dr', amount: g.amount, narration: g.head === 'combined' ? `GST ITC: CGST ₹${data.cgstAmount||0} + SGST ₹${data.sgstAmount||0} + IGST ₹${data.igstAmount||0}` : gstLegLabel('input', g) }));
    // Cr: reverse-charge GST payable (2297) — the society owes this tax to the government as recipient; the supplier
    // is credited the value only (CGST Act s.9(3)/(4), s.2(98); kept apart from output tax: s.2(82), Rule 56(4)).
    if (rcmT.rcm) lines.push({ id: lid(), accountId: rcmAccId!, type: 'Cr', amount: rcmT.rcmTax, narration: `RCM देय (reverse charge): CGST ₹${data.cgstAmount||0} + SGST ₹${data.sgstAmount||0} + IGST ₹${data.igstAmount||0}` });
    if ((data.tcsAmount ?? 0) > 0) {
      lines.push({ id: lid(), accountId: ACCOUNT_IDS.TAX_CREDIT, type: 'Dr', amount: data.tcsAmount!, narration: `TCS ${data.tcsPct||0}% — collected by ${data.supplierName}` });
    }
    const netPayable = grandTotal;  // grandTotal already = net + tax + TCS − TDS
    if (netPayable > 0) {
      lines.push({ id: lid(), accountId: creditAccId, type: 'Cr', amount: netPayable });
    }
    if ((data.tdsAmount ?? 0) > 0) {
      lines.push({ id: lid(), accountId: '2202', type: 'Cr', amount: data.tdsAmount!, narration: `TDS ${data.tdsPct||0}%` });
    }
    // Cash discount (Cr 4499) + round off (5499) — after GST: taxable value, ITC and TDS unchanged.
    adjustmentLines('purchase', accountsRef.current, data.roundOff, data.cashDiscount).forEach(l => lines.push({ id: lid(), ...l }));

    const vType = data.paymentMode === 'credit' ? 'purchase' : 'payment';
    const newVoucher = addVoucher({
      type: vType,
      date: data.date,
      lines,
      debitAccountId: '5101',
      creditAccountId: creditAccId,
      amount: grandTotal,
      narration: data.narration || `Purchase: ${data.supplierName} — ${original.purchaseNo}`,
      createdBy: data.createdBy,
      refType: 'purchase',
      refId: id,
    }, { persistWith: (v, ev, rollback) => { viaServer = { v, ev, rollback }; } });
    // Nothing was sent yet — a refused voucher just undoes the local edit.
    const srv = viaServer as { v: Voucher; ev: LedgerEvent; rollback: () => void } | null;
    if (!newVoucher.id || !srv) { undoLocal(); return null; }

    // 4️⃣ Add fresh stock_movement rows for the edited purchase
    //    (stock currentStock was already updated above via net-delta;
    //     old movement rows were deleted in step 1b)
    data.items.forEach(item => {
      const mv: StockMovement = { id: lid(), date: data.date, itemId: item.itemId, type: 'purchase', qty: item.qty, rate: item.rate, amount: item.amount, referenceNo: original.purchaseNo, narration: `Purchase from ${data.supplierName} (edited)`, godownId: activeGodownIdRef.current || undefined, createdAt: now };
      newMovs.push(mv);
      stockMovementsRef.current = [...stockMovementsRef.current, mv];
      setStockMovementsState(prev => [...prev, mv]);
    });

    // 5️⃣ Update the purchase record in place (same id + purchaseNo)
    const updSupplier = data.supplierId ? suppliers.find(s => s.id === data.supplierId) : undefined;
    const updated: Purchase = {
      ...data,
      ...billTerms({ paymentMode: data.paymentMode, date: data.date, creditDays: data.creditDays, partyCreditDays: updSupplier?.creditDays, rule: resolveLateFeeRule(updSupplier?.lateFeeRule, society.lateFeeRules?.purchases), original }),
      id,
      purchaseNo: original.purchaseNo,
      voucherId: newVoucher.id,
      taxVoucherIds: undefined,
      createdAt: original.createdAt,
      branchId: original.branchId ?? data.branchId,   // ECR-17 Phase 4: a purchase keeps its branch across edits
    };
    purchasesRef.current = purchasesRef.current.map(p => p.id === id ? updated : p);
    setPurchasesState(prev => prev.map(p => p.id === id ? updated : p));
    // H11: a bill edited after the fact was audited to the console only — now a durable row.
    emitAudit({ entityType: 'purchase', entityId: id, action: 'update', before: { date: original.date, grandTotal: original.grandTotal, items: original.items.length }, after: { date: updated.date, grandTotal: updated.grandTotal, items: updated.items.length }, reason: `Purchase ${original.purchaseNo} edited` });

    postStockDocumentEdit({ kind: 'purchase', doc: updated, voucher: srv.v, event: srv.ev, movements: newMovs, undo: () => { srv.rollback(); undoLocal(); } });
    return updated;
  }, [society.fyLocked, suppliers, accounts, addVoucher, stockItems]);

  // ── Employees ──────────────────────────────────────────────────────────────
  const addEmployee = useCallback((data: Omit<Employee, 'id' | 'empNo'>): Employee => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as Employee;
    if (guardPlanFeature('payroll')) return { ...data, id: '' } as unknown as Employee;
    const maxEmpNum = employeesRef.current.reduce((max, e) => {
      const m = e.empNo?.match(/EMP\/(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const empNo = `EMP/${String(maxEmpNum + 1).padStart(3, '0')}`;
    const emp: Employee = { ...data, id: crypto.randomUUID(), empNo };
    employeesRef.current = [...employeesRef.current, emp];
    setEmployeesState(prev => { const updated = [...prev, emp]; return updated; });
    // T-03 (ADR-0005): official empNo from the server sequence (book 'EMP', FY-less) at persist;
    // restamp local state. Falls back to the client-provisional number on offline/RPC failure.
    issueOfficialNumber(nextDocNumber, societyIdRef.current, emp.empNo).then((officialNo) => {
      const toSave = (officialNo && officialNo !== emp.empNo) ? { ...emp, empNo: officialNo } : emp;
      if (toSave !== emp) {
        employeesRef.current = employeesRef.current.map(e => e.id === emp.id ? toSave : e);
        setEmployeesState(prev => prev.map(e => e.id === emp.id ? toSave : e));
      }
      // DB-09: in SPLIT mode the row never carries PAN / bank — they go to party_identity once the row is safe.
      supabase.from('employees').upsert(withSoc(partySplitRef.current ? stripPartyPII(toSave, 'employee') : toSave)).then(({ error }) => {
        if (error) {
          console.error('DB sync error:', error.message); reportError('db-sync', error.message);
          employeesRef.current = employeesRef.current.filter(e => e.id !== emp.id);
          setEmployeesState(prev => prev.filter(e => e.id !== emp.id));   // RULE 1: roll back
          toastRef.current({ title: tr('कर्मचारी सेव नहीं हुआ', 'Employee not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}.`, `Not saved to the cloud — ${error.message}.`), variant: 'destructive', duration: 12000 });
          return;
        }
        persistPartyIdentity('employee', emp.id, toSave, undefined, () => {
          const strip = (e: Employee) => e.id === emp.id ? { ...e, ...piiOf(undefined, 'employee') } as Employee : e;
          employeesRef.current = employeesRef.current.map(strip); setEmployeesState(prev => prev.map(strip));
        });
      });
    });
    return emp;
  }, []);

  const updateEmployee = useCallback((id: string, data: Partial<Employee>) => {
    if (guardFYLocked()) return;
    const before = employeesRef.current.find(e => e.id === id);
    if (!before) return;
    const updated = { ...before, ...data };
    setEmployeesState(prev => prev.map(e => e.id === id ? updated : e));
    // DB-09: the row diff leaves PAN / bank out in SPLIT mode; they go to party_identity after the row is safe.
    const rowBefore = partySplitRef.current ? stripPartyPII(before, 'employee') : before;
    const rowAfter = partySplitRef.current ? stripPartyPII(updated, 'employee') : updated;
    patchRow('employees', id, rowBefore, rowAfter).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        setEmployeesState(prev => prev.map(e => e.id === id ? before : e));   // RULE 1: roll back to prior state
        toastRef.current({ title: tr('अपडेट सेव नहीं हुआ', 'Update not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh the old data will come back.`), variant: 'destructive', duration: 12000 });
        return;
      }
      persistPartyIdentity('employee', id, updated, before, () => setEmployeesState(prev => prev.map(e => e.id === id ? { ...e, ...piiOf(before, 'employee') } as Employee : e)));
    });
  }, []);

  const deleteEmployee = useCallback((id: string) => {
    if (guardPermission('delete', tr('कर्मचारी मिटाने', 'delete employees'))) return;   // ECR-06: role gate
    if (guardFYLocked()) return;
    // Guard (H9-style): block if the employee has salary records — deleting would orphan those
    // payslips (SalaryRecord has no denormalized name), breaking the statutory wage register.
    const linkedSlips = salaryRecordsRef.current.filter(r => r.employeeId === id).length;
    if (linkedSlips > 0) {
      toastRef.current({ title: tr('कर्मचारी हटाया नहीं जा सकता', 'Employee cannot be deleted'), description: tr(`${linkedSlips} वेतन-पर्ची इस कर्मचारी से जुड़ी हैं। पहले वे हटाएँ, या कर्मचारी को रखें (वेतन रजिस्टर के लिए ज़रूरी)।`, `${linkedSlips} salary slip(s) are linked to this employee. Delete them first, or keep the employee (needed for the salary register).`), variant: 'destructive', duration: 10000 });
      return;
    }
    // Soft-delete (ECR-02 / RULE-5): retain the employee row (isDeleted=true) for audit; the loader filters it out.
    const removed = employeesRef.current.find(e => e.id === id);
    setEmployeesState(prev => { const updated = prev.filter(e => e.id !== id); return updated; });
    supabase.from('employees').update({ isDeleted: true }).eq('id', id).then(({ error }) => { if (error) failedCloudWrite(tr('कर्मचारी हटाना', 'Deleting the employee'), error, () => setEmployeesState(prev => putBack(prev, removed))); });
    emitAudit({ entityType: 'employee', entityId: id, action: 'delete', reason: 'Employee deleted' });
    console.info(`[AUDIT-DELETE] Employee id=${id} deleted by ${user?.name || 'unknown'} at ${new Date().toISOString()}`);
  }, []);

  // ── Salary Records ─────────────────────────────────────────────────────────
  const addSalaryRecord = useCallback((data: Omit<SalaryRecord, 'id' | 'slipNo' | 'createdAt'>): SalaryRecord => {
    if (guardFYLocked()) return { ...data, id: '' } as unknown as SalaryRecord;
    if (guardPlanFeature('payroll')) return { ...data, id: '' } as unknown as SalaryRecord;
    const fy = society.financialYear;
    const maxSlipNum = salaryRecordsRef.current.filter(r => r.slipNo?.includes(fy)).reduce((max, r) => {
      const m = r.slipNo?.match(/\/(\d+)$/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const slipNo = `SAL/${fy}/${String(maxSlipNum + 1).padStart(3, '0')}`;
    // Professional Tax is booked to its own payable head. 2207 is Property Tax in a housing chart, so the head is resolved by
    // meaning; with PT deducted and no such head the slip is NOT saved (a silent mis-booking is worse than a refusal).
    const ptAcc = professionalTaxAccountId(accounts);
    if ((data.pt || 0) > 0 && !ptAcc) { toastRef.current({ ...MISSING_HEAD_TOAST.pt, variant: 'destructive', duration: 12000 }); return { ...data, id: '' } as unknown as SalaryRecord; }
    const base: SalaryRecord = { ...data, id: crypto.randomUUID(), slipNo, createdAt: new Date().toISOString() };
    // Accrual (H8+): recognise the salary expense + liability the moment it is processed,
    // regardless of payment — Dr Salary Expense 5201 / Cr Salary Payable 2103. Payment later
    // clears the liability. Dated at the salary month-end when parseable, else the process date.
    // A slip is saved only WITH its accrual voucher: a slip whose PF/ESI/PT/TDS never reach the ledger would
    // still feed 24Q, the TDS Register and Statutory Reconciliation (RULE 1/2). Net ≤ 0 cannot be booked.
    if (!((base.netSalary || 0) > 0)) {
      toastRef.current({ title: tr('वेतन पर्ची नहीं बनी / Slip not saved', 'Slip not saved'), description: tr(`${slipNo}: नेट वेतन शून्य या ऋणात्मक है — कटौतियाँ (PT/TDS आदि) और कार्य-दिवस जाँचें। / Net salary is zero or negative — check the deductions and paid days.`, `${slipNo}: Net salary is zero or negative — check the deductions (PT/TDS etc.) and paid days.`), variant: 'destructive', duration: 12000 });
      return { ...data, id: '' } as unknown as SalaryRecord;
    }
    let accrualVoucherId: string | undefined;
    {
      const emp = employees.find(e => e.id === base.employeeId);
      const payableAcc = accounts.find(a => a.id === '2103')?.id || '2103';
      const accrualDate = /^\d{4}-\d{2}$/.test(base.month || '')
        ? new Date(Number(base.month.slice(0, 4)), Number(base.month.slice(5, 7)), 0).toISOString().split('T')[0]
        : base.createdAt.split('T')[0];
      // ECR-14: when a statutory breakdown is present, book gross + employer contributions
      // to Salary Expense and split the employee dues + employer contributions to their
      // payable heads (EPF 2203 / ESI 2204 / PT 2207 / TDS 2202). Otherwise keep the legacy
      // net-basis accrual so old salary flows are unchanged. The lines come from the ONE shared
      // builder (lib/payroll/accrualLines.ts) that updateSalaryRecord also uses.
      const { lines, drTotal, hasStatutory } = salaryAccrualLines(base, payableAcc, undefined, { ptPayable: ptAcc ?? undefined });
      // The accrual is saved optimistically; if the SERVER refuses it later (addVoucher rolls it back and calls
      // onFailed), the slip must go too — otherwise it points at a voucher that does not exist (RULE 1).
      const dropSlipWithoutAccrual = () => {
        if (!salaryRecordsRef.current.some(r => r.id === base.id)) return;   // already gone (its own save failed)
        salaryRecordsRef.current = salaryRecordsRef.current.filter(r => r.id !== base.id);
        setSalaryRecordsState(prev => prev.filter(r => r.id !== base.id));
        supabase.from('salary_records').delete().eq('id', base.id).then(({ error }) => {
          if (error) reportError('salary-orphan-delete', error.message, { id: base.id });
        }, () => {});
        toastRef.current({ title: tr('वेतन पर्ची हटाई गई / Slip removed', 'Slip removed'), description: tr(`${slipNo}: वेतन का बही-voucher cloud में save नहीं हुआ, इसलिए पर्ची भी हटा दी गई — दोबारा प्रोसेस करें। / The salary journal was not saved in the cloud, so the slip was removed too.`, `${slipNo}: The salary journal voucher was not saved in the cloud, so the slip was removed too — process it again.`), variant: 'destructive', duration: 12000 });
      };
      try {
        const av = addVoucher({
          type: 'journal', date: accrualDate, debitAccountId: '5201', creditAccountId: payableAcc, amount: drTotal, lines,
          narration: hasStatutory
            ? `Salary accrual (statutory): ${emp?.name || ''} - ${base.month} (${slipNo})`
            : `Salary accrual: ${emp?.name || ''} - ${base.month} (${slipNo})`,
          createdBy: 'System',
        }, { onFailed: dropSlipWithoutAccrual });
        accrualVoucherId = av?.id || undefined;
      } catch { accrualVoucherId = undefined; }
    }
    if (!accrualVoucherId) {
      // addVoucher has already said why (locked period, FY lock, role, expired plan …).
      toastRef.current({ title: tr('वेतन पर्ची नहीं बनी / Slip not saved', 'Slip not saved'), description: tr(`${slipNo}: वेतन का बही-voucher नहीं बन सका, इसलिए पर्ची भी save नहीं की गई — ऊपर का कारण ठीक करके फिर प्रोसेस करें। / The salary journal could not be posted, so the slip was not saved.`, `${slipNo}: The salary journal voucher could not be posted, so the slip was not saved either — fix the reason above and process again.`), variant: 'destructive', duration: 12000 });
      return { ...data, id: '' } as unknown as SalaryRecord;
    }
    const record: SalaryRecord = { ...base, accrualVoucherId };
    salaryRecordsRef.current = [...salaryRecordsRef.current, record];
    setSalaryRecordsState(prev => { const updated = [...prev, record]; return updated; });
    supabase.from('salary_records').upsert(withSoc(record)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        salaryRecordsRef.current = salaryRecordsRef.current.filter(r => r.id !== record.id);
        setSalaryRecordsState(prev => prev.filter(r => r.id !== record.id));   // RULE 1: roll back
        // …and its accrual voucher, or the ledger would carry a salary no slip explains (RULE 3).
        if (record.accrualVoucherId) cancelLinkedVouchers([record.accrualVoucherId], `Salary slip ${record.slipNo} not saved`, 'System', { rollback: true });
        toastRef.current({ title: tr('वेतन रिकॉर्ड सेव नहीं हुआ', 'Salary record not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. उसका बही-voucher भी रद्द किया गया।`, `Not saved to the cloud — ${error.message}. Its journal voucher was also cancelled.`), variant: 'destructive', duration: 12000 });
      }
    });
    return record;
  }, [society.financialYear, addVoucher, accounts, employees]);

  const updateSalaryRecord = useCallback((id: string, data: Partial<SalaryRecord>): boolean => {
    if (guardFYLocked()) return false;
    const oldRecord = salaryRecordsRef.current.find(r => r.id === id);
    if (!oldRecord) return false;
    const merged = { ...oldRecord, ...data };
    const lid = () => crypto.randomUUID();
    // A field the caller did not send keeps its value: an edit that omits isPaid must never "un-pay" a paid slip
    // (the (a) branch used to test the raw flag, so an omitted isPaid counted as "unpaid").
    const nextPaid = data.isPaid ?? oldRecord.isPaid;
    const bankChanged = data.bankAccountId !== undefined && data.bankAccountId !== oldRecord.bankAccountId;

    // B3 / JRN-01: a paid salary's vouchers are re-synced through updateVoucher (which appends the
    // reversed/reposted journal pair — or calls edit_voucher under the posting service). The old code
    // rewrote the rows directly and never touched the journal, so journal-read statements drifted.
    // Pre-check both vouchers: if either may not be edited in place, change NOTHING (not even the record).
    const amountChanged = data.netSalary !== undefined && data.netSalary !== oldRecord.netSalary;
    // The accrual voucher carries the statutory split (EPF / ESI / PT / TDS + employer share), so ANY
    // accrual-relevant field change re-syncs it — not only the net. Payment vouchers stay net-based.
    const accrualChanged = salaryAccrualChanged(oldRecord, merged);
    {
      const payV = oldRecord.isPaid && nextPaid && oldRecord.voucherId ? vouchersRef.current.find(x => x.id === oldRecord.voucherId) : undefined;
      const accV = accrualChanged && oldRecord.accrualVoucherId ? vouchersRef.current.find(x => x.id === oldRecord.accrualVoucherId) : undefined;
      const payTouched = payV && !payV.isDeleted && (amountChanged || (data.paidDate !== undefined && data.paidDate !== oldRecord.paidDate) || (data.paymentMode !== undefined && data.paymentMode !== oldRecord.paymentMode) || bankChanged);
      for (const v of [payTouched ? payV : undefined, accV && !accV.isDeleted && !isEngineVoucher(accV) ? accV : undefined]) {
        if (v && isEditLocked(v, !!societyRef.current?.approvalRequired)) {
          toastRef.current({ title: tr('वेतन बदलाव नहीं हुआ', 'Salary change not made'), description: tr(`वाउचर ${v.voucherNo} सीधे edit नहीं हो सकता (approved / reversed) — पहले उसे reverse करें, फिर वेतन बदलें।`, `Voucher ${v.voucherNo} cannot be edited directly (approved / reversed) — reverse it first, then change the salary.`), variant: 'destructive', duration: 12000 });
          return false;
        }
      }
      // An unbalanced statutory breakdown cannot be re-booked: refuse the whole edit rather than save a
      // slip whose accrual voucher disagrees with it (RULE 1 — never let local state and books diverge).
      if (accV && !accV.isDeleted && !isEngineVoucher(accV)) {
        const payableAccCheck = accounts.find(a => a.id === '2103')?.id || '2103';
        if ((merged.pt || 0) > 0 && !professionalTaxAccountId(accounts)) {
          toastRef.current({ ...MISSING_HEAD_TOAST.pt, variant: 'destructive', duration: 12000 });
          return false;
        }
        if (!salaryAccrualLines(merged, payableAccCheck, lid, { ptPayable: professionalTaxAccountId(accounts) ?? undefined }).balanced) {
          toastRef.current({ title: tr('वेतन बदलाव नहीं हुआ', 'Salary change not made'), description: tr('रकमें संतुलित नहीं हैं — (मूल वेतन + भत्ते + नियोक्ता PF/ESI) = (नेट वेतन + सभी देय कटौतियाँ) होना चाहिए। नेट वेतन और कटौतियाँ दोबारा जाँचकर डालें।', 'Amounts do not balance — (basic salary + allowances + employer PF/ESI) must equal (net salary + all payable deductions). Check net salary and deductions and enter them again.'), variant: 'destructive', duration: 12000 });
          return false;
        }
      }
    }

    // H8: Voucher lifecycle —
    // (a) Was paid, now unpaid → cancel existing voucher
    // (b) Was unpaid, now paid → create new voucher
    // (c) Still paid, but amount/date/paymentMode changed → update existing voucher + entries

    if (oldRecord.isPaid && !nextPaid && oldRecord.voucherId) {
      // (a) Cancel the linked voucher
      cancelLinkedVouchers([oldRecord.voucherId], `Salary slip ${oldRecord.slipNo} marked unpaid`, 'System');
      merged.voucherId = undefined;
    } else if (!oldRecord.isPaid && nextPaid && !oldRecord.voucherId) {
      // A salary "paid on credit" is not paid: it stays unpaid in Salary Payable 2103. Refuse rather than post
      // a payment out of the first bank account (non-cash modes used to map to a bank).
      if (merged.paymentMode === 'credit') {
        toastRef.current({ title: tr('भुगतान दर्ज नहीं हुआ / Not marked paid', 'Not marked paid'), description: tr('उधार में दिया वेतन "भुगतान" नहीं है — पर्ची unpaid रहने दें, या नकद/बैंक चुनें। / Choose cash or bank.', 'Salary given on credit is not a "payment" — leave the slip unpaid, or choose cash/bank.'), variant: 'destructive', duration: 10000 });
        return false;
      }
      // (b) Create the payment voucher. If the salary was accrued (Cr Salary Payable 2103),
      // payment CLEARS that liability (Dr 2103 / Cr Bank). Legacy records with no accrual fall
      // back to the old expense-on-pay (Dr 5201 / Cr Bank) so their books stay correct.
      const emp = employees.find(e => e.id === oldRecord.employeeId);
      // Pay from the chosen bank; fall back to the first bank when none picked (unchanged default).
      const creditAcc = merged.paymentMode === 'cash' ? ACCOUNT_IDS.CASH : (merged.bankAccountId || defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK);
      const debitAcc = oldRecord.accrualVoucherId ? (accounts.find(a => a.id === '2103')?.id || '2103') : '5201';
      const newV = addVoucher({
        type: 'payment' as const,
        date: merged.paidDate || new Date().toISOString().split('T')[0],
        debitAccountId: debitAcc,
        creditAccountId: creditAcc,
        amount: merged.netSalary,
        narration: `Salary paid: ${emp?.name || ''} - ${oldRecord.month}`,
        createdBy: 'System',
      }, {
        // Server refused the payment later (rolled back by addVoucher) → the slip is UNPAID again (RULE 1).
        onFailed: () => {
          const cur = salaryRecordsRef.current.find(r => r.id === id);
          if (!cur || !cur.isPaid) return;
          const back: SalaryRecord = { ...cur, isPaid: false, paidDate: undefined, voucherId: undefined };
          salaryRecordsRef.current = salaryRecordsRef.current.map(r => r.id === id ? back : r);
          setSalaryRecordsState(prev => prev.map(r => r.id === id ? back : r));
          patchRow('salary_records', id, cur, back).then(({ error }) => {
            if (error) reportError('salary-unpay-sync', error.message, { id });
          }, () => {});
          toastRef.current({ title: tr('भुगतान दर्ज नहीं हुआ / Not marked paid', 'Not marked paid'), description: tr(`${oldRecord.slipNo}: भुगतान voucher cloud में save नहीं हुआ, इसलिए पर्ची फिर unpaid है। / The payment voucher was not saved, so the slip is unpaid again.`, `${oldRecord.slipNo}: The payment voucher was not saved in the cloud, so the slip is unpaid again.`), variant: 'destructive', duration: 12000 });
        },
      });
      if (!newV.id) {
        // addVoucher said why (locked period, FY lock, role, expired plan …). A slip is never PAID without its
        // payment voucher — the liability would stay open while the slip and its PDF say PAID (RULE 1).
        toastRef.current({ title: tr('भुगतान दर्ज नहीं हुआ / Not marked paid', 'Not marked paid'), description: tr(`${oldRecord.slipNo}: भुगतान का voucher नहीं बन सका, इसलिए पर्ची Paid नहीं की गई। / The payment voucher could not be posted, so the slip stays unpaid.`, `${oldRecord.slipNo}: The payment voucher could not be posted, so the slip was not marked Paid.`), variant: 'destructive', duration: 12000 });
        return false;
      }
      merged.voucherId = newV.id;
    } else if (oldRecord.isPaid && nextPaid && oldRecord.voucherId) {
      // (c) Still paid — re-sync voucher if amount / date / paymentMode / paying bank changed
      const dateChanged = data.paidDate !== undefined && data.paidDate !== oldRecord.paidDate;
      const modeChanged = data.paymentMode !== undefined && data.paymentMode !== oldRecord.paymentMode;
      if (amountChanged || dateChanged || modeChanged || bankChanged) {
        const v = vouchersRef.current.find(x => x.id === oldRecord.voucherId);
        if (v && !v.isDeleted) {
          const emp = employees.find(e => e.id === oldRecord.employeeId);
          const creditAcc = merged.paymentMode === 'cash' ? ACCOUNT_IDS.CASH : (merged.bankAccountId || defaultBankAccountId(accounts) || ACCOUNT_IDS.BANK);
          const payDebit = oldRecord.accrualVoucherId ? (accounts.find(a => a.id === '2103')?.id || '2103') : '5201';
          const newLines: VoucherLine[] = [
            { id: lid(), accountId: payDebit, type: 'Dr', amount: merged.netSalary },
            { id: lid(), accountId: creditAcc, type: 'Cr', amount: merged.netSalary },
          ];
          // RULE 1 + journal: updateVoucher reverts on a failed save and appends the repost pair.
          if (!updateVoucher(v.id, {
            date: merged.paidDate || v.date,
            debitAccountId: payDebit,
            creditAccountId: creditAcc,
            amount: merged.netSalary,
            lines: newLines,
            narration: `Salary paid: ${emp?.name || ''} - ${oldRecord.month}`,
          }, { viaParent: true })) return false;
        }
      }
    }

    // Accrual re-sync: if any accrual-relevant amount changed and the record was accrued, keep the
    // accrual voucher in step so the expense and EVERY payable (net, EPF, ESI, PT, TDS) stay correct.
    // The lines come from the same builder addSalaryRecord uses, so the statutory split is never dropped.
    if (accrualChanged && oldRecord.accrualVoucherId) {
      const av = vouchersRef.current.find(x => x.id === oldRecord.accrualVoucherId);
      if (av && !av.isDeleted && !isEngineVoucher(av)) {
        const payableAcc = accounts.find(a => a.id === '2103')?.id || '2103';
        const accrual = salaryAccrualLines(merged, payableAcc, lid, { ptPayable: professionalTaxAccountId(accounts) ?? undefined });
        if (!updateVoucher(av.id, { amount: accrual.drTotal, debitAccountId: '5201', creditAccountId: payableAcc, lines: accrual.lines }, { viaParent: true })) return false;
      }
    }

    salaryRecordsRef.current = salaryRecordsRef.current.map(r => r.id === id ? merged : r);
    setSalaryRecordsState(prev => prev.map(r => r.id === id ? merged : r));
    patchRow('salary_records', id, oldRecord, merged).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        salaryRecordsRef.current = salaryRecordsRef.current.map(r => r.id === id ? oldRecord : r);
        setSalaryRecordsState(prev => prev.map(r => r.id === id ? oldRecord : r));   // RULE 1: roll back to prior state
        // A payment voucher made by THIS edit goes too — the slip is back to unpaid (RULE 3).
        if (!oldRecord.voucherId && merged.voucherId) cancelLinkedVouchers([merged.voucherId], `Salary slip ${oldRecord.slipNo} not saved`, 'System', { rollback: true });
        toastRef.current({ title: tr('अपडेट सेव नहीं हुआ', 'Update not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh the old data will come back.`), variant: 'destructive', duration: 12000 });
      }
    });
    return true;
  }, [employees, accounts, addVoucher, updateVoucher]);

  const deleteSalaryRecord = useCallback((id: string) => {
    if (guardPermission('delete', tr('वेतन रिकॉर्ड मिटाने', 'delete salary records'))) return;   // ECR-06: role gate
    if (guardFYLocked()) return;
    // H8+: Cascade-cancel BOTH the accrual and the payment vouchers so the expense,
    // liability and cash all reverse cleanly.
    const record = salaryRecordsRef.current.find(r => r.id === id);
    const cancelIds = [record?.voucherId, record?.accrualVoucherId].filter(Boolean) as string[];
    // RULE 3: a slip whose TDS is linked to a deposited challan (TDS Register entry `sal-<id>`) is not deleted —
    // the challan and its Dr 2202 deposit would stay while the deduction vanished (2202 goes negative, the
    // quarter shows more deposited than deducted). Unlink it in the TDS Register first.
    const tdsEntryId = `sal-${id}`;
    const challanLinkedToast = () => toastRef.current({
      title: tr('वेतन पर्ची नहीं हटी / Slip not deleted', 'Slip not deleted'),
      description: tr(`${record?.slipNo ?? ''}: इसका TDS एक जमा चालान से जुड़ा है। पहले TDS Register में इस एंट्री को चालान से अलग करें, फिर पर्ची हटाएँ। / Its TDS is linked to a deposited challan — unlink it in the TDS Register first.`, `${record?.slipNo ?? ''}: Its TDS is linked to a deposited challan. First unlink this entry from the challan in the TDS Register, then delete the slip.`),
      variant: 'destructive', duration: 12000,
    });
    if (storage.getTdsChallanLinks().some(l => l.entryId === tdsEntryId)) { challanLinkedToast(); return; }
    supabase.from('tds_challan_links').select('entryId').eq('society_id', societyIdRef.current).eq('entryId', tdsEntryId).limit(1).then(({ data: linked, error: linkErr }) => {
      // An unreadable links table (not migrated / offline) falls back to the cached check above.
      if (!linkErr && linked && linked.length > 0) { challanLinkedToast(); return; }
      removeSlip();
    }, () => removeSlip());
    const removeSlip = () => {
    setSalaryRecordsState(prev => prev.filter(r => r.id !== id));
    salaryRecordsRef.current = salaryRecordsRef.current.filter(r => r.id !== id);
    // The vouchers are cancelled only once the slip row is gone from the cloud (RULE 1 + 3) — a failed
    // delete used to leave the slip alive after F5 with its accrual + payment already cancelled.
    supabase.from('salary_records').delete().eq('id', id).then(({ error }) => {
      if (error) {
        failedCloudWrite(tr('वेतन पर्ची हटाना', 'Deleting the salary slip'), error, () => {
          salaryRecordsRef.current = putBack(salaryRecordsRef.current, record);
          setSalaryRecordsState(prev => putBack(prev, record));
        });
        return;
      }
      cancelLinkedVouchers(cancelIds, `Salary slip ${record?.slipNo} deleted`, 'System');
    });
    emitAudit({ entityType: 'salaryRecord', entityId: id, action: 'delete', before: record ? { slipNo: record.slipNo, netSalary: record.netSalary, isPaid: record.isPaid } : undefined, reason: 'Salary slip deleted' });   // H11
    };
  }, []);

  // ── Suppliers ──────────────────────────────────────────────────────────────
  // Two-step supplier save (mirror of persistCustomer — RULE 1).
  // Base columns save first; Tally extras patched separately so missing
  // migration only shows a soft warning.
  const persistSupplier = (s: Supplier, opts: { onBaseFail: () => void; isUpdate: boolean; onBaseSuccess?: () => void; before?: Supplier; onIdentityFail?: () => void }) => {
    const {
      legalName, tradeName, mailingName, supplierType,
      addressLine1, addressLine2, city, state, pincode, country,
      mobile, landline, email, website, contactPerson, contactDesignation, salesRep,
      gstin, pan, registrationType, placeOfSupply, tdsApplicable, tdsSection, tcsApplicable,
      bankName, accountNo, ifsc, branch, upiId, beneficiaryName,
      creditDays, lateFeeRule, creditLimit, discountPercent, openingBalance, openingBalanceType,
      notes,
      ...baseCols
    } = s;
    supabase.from('suppliers').upsert(withSoc(baseCols)).then(({ error }) => {
      if (error) {
        console.error(`Supplier ${opts.isUpdate ? 'update' : 'save'} failed (base):`, error.message);
        opts.onBaseFail();
        toastRef.current({
          title: tr('❌ आपूर्तिकर्ता क्लाउड में सेव नहीं हुआ', '❌ Supplier not saved to the cloud'),
          description: tr(`${error.message}. स्क्रीन से हटा दी गई।`, `${error.message}. Removed from the screen.`),
          variant: 'destructive',
          duration: 15000,
        });
        return;
      }
      opts.onBaseSuccess?.();
      persistPartyIdentity('supplier', s.id, s, opts.before, opts.onIdentityFail ?? (() => {}));
      const extras: Record<string, unknown> = {};
      const setIf = (k: string, v: unknown) => { if (v !== undefined) extras[k] = v; };
      setIf('legalName', legalName); setIf('tradeName', tradeName); setIf('mailingName', mailingName);
      setIf('supplierType', supplierType);
      setIf('addressLine1', addressLine1); setIf('addressLine2', addressLine2);
      setIf('city', city); setIf('state', state); setIf('pincode', pincode); setIf('country', country);
      setIf('mobile', mobile); setIf('landline', landline); setIf('email', email);
      setIf('website', website); setIf('contactPerson', contactPerson); setIf('contactDesignation', contactDesignation);
      setIf('salesRep', salesRep);
      setIf('gstin', gstin); if (!partySplitRef.current) setIf('pan', pan); setIf('registrationType', registrationType);   // DB-09: PII → party_identity in SPLIT mode
      setIf('placeOfSupply', placeOfSupply); setIf('tdsApplicable', tdsApplicable);
      setIf('tdsSection', tdsSection); setIf('tcsApplicable', tcsApplicable);
      if (!partySplitRef.current) { setIf('bankName', bankName); setIf('accountNo', accountNo); setIf('ifsc', ifsc); }
      setIf('branch', branch); setIf('upiId', upiId); setIf('beneficiaryName', beneficiaryName);
      setIf('creditDays', creditDays); setIf('lateFeeRule', lateFeeRule); setIf('creditLimit', creditLimit); setIf('discountPercent', discountPercent);
      setIf('openingBalance', openingBalance); setIf('openingBalanceType', openingBalanceType);
      setIf('notes', notes);
      if (Object.keys(extras).length === 0) return;
      supabase.from('suppliers').update(extras).eq('id', s.id).then(({ error: e2 }) => {
        if (e2) {
          console.warn('Supplier extras patch warning (run STEP 17g migration):', e2.message);
          toastRef.current({
            title: '⚠️ Supplier saved partially',
            description: `Base info saved. Extra fields (GST/Bank/etc.) failed: ${e2.message}. Run STEP 17g migration.`,
            variant: 'default',
            duration: 8000,
          });
        }
      });
    });
  };

  const addSupplier = useCallback((data: Omit<Supplier, 'id' | 'supplierCode' | 'accountId' | 'createdAt'>, opts?: { onSaved?: (x: Supplier) => void; onFailed?: () => void }): Supplier => {
    if (guardFYLocked()) { opts?.onFailed?.(); return { ...data, id: '' } as unknown as Supplier; }
    const accountId = crypto.randomUUID();
    // Auto-create ledger account under Sundry Creditors (2101)
    const newAccount: LedgerAccount = {
      id: accountId,
      name: data.legalName || data.name,
      nameHi: data.nameHi || data.legalName || data.name,
      type: 'liability',
      openingBalance: data.openingBalance || 0,
      openingBalanceType: data.openingBalanceType || 'credit',
      isSystem: false,
      isGroup: false,
      parentId: '2101',
    };
    // Readable code (#706) for the party ledger, like every other user-created account.
    const partyCode = nextAccountCode(accountsRef.current, '2101', false, 'liability');
    if (partyCode) newAccount.code = partyCode;
    accountsRef.current = [...accountsRef.current, newAccount];
    setAccountsState(prev => [...prev, newAccount]);

    const maxSupNum = suppliersRef.current.reduce((max, s) => {
      const m = s.supplierCode?.match(/SUP\/(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const supplierCode = `SUP/${String(maxSupNum + 1).padStart(3, '0')}`;
    const supplier: Supplier = { ...data, id: crypto.randomUUID(), supplierCode, accountId, createdAt: new Date().toISOString() };
    suppliersRef.current = [...suppliersRef.current, supplier];
    setSuppliersState(prev => [...prev, supplier]);
    // RULE 1: the ledger account and the party row are ONE thing to the user. Save the account first;
    // only once it is in the cloud save the party (a voucher line is FK-bound to the account). If either
    // fails, roll BOTH back (screen + cloud) and say so — no party without a ledger, no orphan ledger.
    const undoLocal = () => {
      suppliersRef.current = suppliersRef.current.filter(x => x.id !== supplier.id);
      setSuppliersState(prev => prev.filter(x => x.id !== supplier.id));
      accountsRef.current = accountsRef.current.filter(a => a.id !== accountId);
      setAccountsState(prev => prev.filter(a => a.id !== accountId));
    };
    const { code: accCode, ...baseAccount } = newAccount;
    supabase.from('accounts').upsert(withSoc(baseAccount)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        undoLocal();
        toastRef.current({ title: tr('❌ आपूर्तिकर्ता सेव नहीं हुआ', '❌ Supplier not saved'), description: tr(`खाता क्लाउड में सेव नहीं हुआ — ${error.message}. स्क्रीन से हटा दिया गया; दोबारा जोड़ें।`, `Account not saved to the cloud — ${error.message}. Removed from the screen; please add again.`), variant: 'destructive', duration: 12000 });
        opts?.onFailed?.();
        return;
      }
      // The opening balance must reach the journal too (same as addAccount) — a party opened here with an
      // opening used to leave accounts and ledger_events disagreeing, which silently disables journal reads.
      if ((Number(newAccount.openingBalance) || 0) !== 0) {
        if (postingServiceRef.current) syncOpeningOnServer(accountId);
        else { const ev = buildOpeningDelta(newAccount); if (ev) { ledgerEventsRef.current = [...ledgerEventsRef.current, ev]; persistLedgerEvent(ev); } else if (!journalLoadedRef.current) syncOpeningOnServer(accountId); }
      }
      if (accCode) {
        supabase.from('accounts').update({ code: accCode }).eq('id', accountId).eq('society_id', societyIdRef.current).select('id').then(({ data: rows, error: cErr }) => {
          if (!cErr && rows && rows.length > 0) return;
          reportError('db-sync', cErr?.message || 'party code update matched 0 rows');   // code only — the ledger is safe
          accountsRef.current = accountsRef.current.map(a => a.id === accountId ? { ...a, code: undefined } : a);
          setAccountsState(prev => prev.map(a => a.id === accountId ? { ...a, code: undefined } : a));
        });
      }
      persistSupplier(supplier, {
        isUpdate: false,
        // DB-09: PII not stored in party_identity → take it off the screen too (never shown as saved)
        onIdentityFail: () => { const strip = (x: Supplier) => x.id === supplier.id ? { ...x, ...piiOf(undefined, 'supplier') } as Supplier : x; suppliersRef.current = suppliersRef.current.map(strip); setSuppliersState(prev => prev.map(strip)); },
        onBaseFail: () => {
          undoLocal();
          // no orphan ledger — the one rollback-aware account delete (puts it back on screen if the cloud refuses)
          deleteAccountRow(newAccount, { context: 'party-create-rollback', failTitle: tr('नया खाता हटाया नहीं जा सका', 'The new account could not be removed') });
          opts?.onFailed?.();
        },
        onBaseSuccess: () => opts?.onSaved?.(supplier),
      });
    });
    return supplier;
  }, []);

  const updateSupplier = useCallback((id: string, data: Partial<Omit<Supplier, 'id' | 'supplierCode' | 'accountId' | 'createdAt'>>) => {
    if (guardFYLocked()) return;
    const before = suppliersRef.current.find(s => s.id === id);
    if (!before) return;
    const updated: Supplier = { ...before, ...data };
    suppliersRef.current = suppliersRef.current.map(s => s.id === id ? updated : s);
    setSuppliersState(prev => prev.map(s => s.id === id ? updated : s));

    // Mirror name + opening balance changes to the linked Sundry Creditor account
    if (data.name || data.nameHi || data.legalName || data.openingBalance !== undefined || data.openingBalanceType) {
      setAccountsState(prev => prev.map(a => {
        if (a.id !== updated.accountId) return a;
        return {
          ...a,
          name: updated.legalName || updated.name,
          nameHi: updated.nameHi || updated.legalName || updated.name,
          openingBalance: updated.openingBalance ?? a.openingBalance,
          openingBalanceType: updated.openingBalanceType ?? a.openingBalanceType,
        };
      }));
    }

    persistSupplier(updated, {
      isUpdate: true,
      before,
      onIdentityFail: () => { const back = (x: Supplier) => x.id === id ? { ...x, ...piiOf(before, 'supplier') } as Supplier : x; suppliersRef.current = suppliersRef.current.map(back); setSuppliersState(prev => prev.map(back)); },
      onBaseFail: () => {
        suppliersRef.current = suppliersRef.current.map(s => s.id === id ? before : s);
        setSuppliersState(prev => prev.map(s => s.id === id ? before : s));
      },
    });
  }, []);

  const deleteSupplier = useCallback((id: string) => {
    if (guardPermission('delete', tr('आपूर्तिकर्ता मिटाने', 'delete suppliers'))) return;   // ECR-06: role gate
    if (guardFYLocked()) return;
    const sup = suppliers.find(s => s.id === id);
    if (!sup) return;
    // H9: Block if supplier has live purchases — otherwise sub-ledger reconciliation breaks
    const livePurchases = purchasesRef.current.filter(p => p.supplierId === id).length;
    if (livePurchases > 0) {
      toastRef.current({ title: tr('आपूर्तिकर्ता नहीं हटाया जा सकता', 'Supplier cannot be deleted'), description: tr(`इससे ${livePurchases} खरीद जुड़ी हैं — पहले खरीद पेज से वे हटाएँ। (${livePurchases} purchase(s) linked.)`, `${livePurchases} purchase(s) are linked to it — delete them from the Purchases page first. (${livePurchases} purchase(s) linked.)`), variant: 'destructive', duration: 10000 });
      return;
    }
    // Tally-style: block if the linked Sundry Creditor account still carries a balance.
    if (guardAccountBalance(sup.accountId, tr(`आपूर्तिकर्ता "${sup.name}"`, `Supplier "${sup.name}"`))) return;
    setSuppliersState(prev => prev.filter(s => s.id !== id));
    supabase.from('suppliers').delete().eq('id', id).then(({ error }) => {
      if (error) { failedCloudWrite(tr('आपूर्तिकर्ता हटाना', 'Deleting the supplier'), error, () => { suppliersRef.current = putBack(suppliersRef.current, sup); setSuppliersState(prev => putBack(prev, sup)); }); return; }
      // Only hard-delete the linked Sundry Creditor account if NO vouchers (even soft-deleted) reference it
      if (sup.accountId) {
        const accountReferenced = vouchersRef.current.some(v =>
          v.debitAccountId === sup.accountId || v.creditAccountId === sup.accountId ||
          (v.lines && v.lines.some(l => l.accountId === sup.accountId))
        );
        if (accountReferenced) {
          // Keep the account so historical vouchers stay reconcilable; just rename it to mark orphan
          setAccountsState(prev => prev.map(a => a.id === sup.accountId ? { ...a, name: `${a.name} [Supplier deleted]`, isSystem: false } : a));
          supabase.from('accounts').update({ name: `${sup.name} [Supplier deleted]` }).eq('id', sup.accountId).eq('society_id', societyIdRef.current)
            .then(({ error }) => { if (error) { console.error('Account rename sync:', error.message); reportError('write-partial', error.message, { at: 'Account rename sync:' }); } });
        } else {
          const supAccount = accountsRef.current.find(a => a.id === sup.accountId);
          setAccountsState(prev => prev.filter(a => a.id !== sup.accountId));
          if (supAccount) deleteAccountRow(supAccount, { context: 'supplier-account-delete' });
        }
      }
      emitAudit({ entityType: 'supplier', entityId: id, action: 'delete', before: { name: sup.name, accountId: sup.accountId }, reason: 'Supplier deleted' });   // H11
    });
  }, [suppliers, deleteAccountRow]);

  // ── Customers ──────────────────────────────────────────────────────────────
  // Two-step customer save (RULE 1): base columns (name, nameHi, address, phone, gstNo,
  // accountId, isActive, createdAt) save first — schema cache always knows these. Tally
  // extras (legalName, tradeName, customerType, addressLine1/2, city, state, pincode,
  // country, mobile, landline, email, website, contactPerson, contactDesignation, gstin,
  // pan, registrationType, placeOfSupply, tdsApplicable, tcsApplicable, bankName, accountNo,
  // ifsc, branch, upiId, creditDays, creditLimit, discountPercent, openingBalance,
  // openingBalanceType, notes, mailingName) patch separately so missing migration only
  // shows a soft warning instead of nuking the row.
  const persistCustomer = (c: Customer, opts: { onBaseFail: () => void; isUpdate: boolean; onBaseSuccess?: () => void; before?: Customer; onIdentityFail?: () => void }) => {
    const {
      legalName, tradeName, mailingName, customerType,
      addressLine1, addressLine2, city, state, pincode, country,
      mobile, landline, email, website, contactPerson, contactDesignation,
      gstin, pan, registrationType, placeOfSupply, tdsApplicable, tcsApplicable,
      bankName, accountNo, ifsc, branch, upiId,
      creditDays, lateFeeRule, creditLimit, discountPercent, openingBalance, openingBalanceType,
      notes,
      ...baseCols
    } = c;
    supabase.from('customers').upsert(withSoc(baseCols)).then(({ error }) => {
      if (error) {
        console.error(`Customer ${opts.isUpdate ? 'update' : 'save'} failed (base):`, error.message);
        opts.onBaseFail();
        toastRef.current({
          title: tr('❌ ग्राहक क्लाउड में सेव नहीं हुआ', '❌ Customer not saved to the cloud'),
          description: tr(`${error.message}. स्क्रीन से हटा दी गई।`, `${error.message}. Removed from the screen.`),
          variant: 'destructive',
          duration: 15000,
        });
        return;
      }
      opts.onBaseSuccess?.();
      persistPartyIdentity('customer', c.id, c, opts.before, opts.onIdentityFail ?? (() => {}));
      const extras: Record<string, unknown> = {};
      const setIf = (k: string, v: unknown) => { if (v !== undefined) extras[k] = v; };
      setIf('legalName', legalName); setIf('tradeName', tradeName); setIf('mailingName', mailingName);
      setIf('customerType', customerType);
      setIf('addressLine1', addressLine1); setIf('addressLine2', addressLine2);
      setIf('city', city); setIf('state', state); setIf('pincode', pincode); setIf('country', country);
      setIf('mobile', mobile); setIf('landline', landline); setIf('email', email);
      setIf('website', website); setIf('contactPerson', contactPerson); setIf('contactDesignation', contactDesignation);
      setIf('gstin', gstin); if (!partySplitRef.current) setIf('pan', pan); setIf('registrationType', registrationType);   // DB-09: PII → party_identity in SPLIT mode
      setIf('placeOfSupply', placeOfSupply); setIf('tdsApplicable', tdsApplicable); setIf('tcsApplicable', tcsApplicable);
      if (!partySplitRef.current) { setIf('bankName', bankName); setIf('accountNo', accountNo); setIf('ifsc', ifsc); }
      setIf('branch', branch); setIf('upiId', upiId);
      setIf('creditDays', creditDays); setIf('lateFeeRule', lateFeeRule); setIf('creditLimit', creditLimit); setIf('discountPercent', discountPercent);
      setIf('openingBalance', openingBalance); setIf('openingBalanceType', openingBalanceType);
      setIf('notes', notes);
      if (Object.keys(extras).length === 0) return;
      supabase.from('customers').update(extras).eq('id', c.id).then(({ error: e2 }) => {
        if (e2) {
          console.warn('Customer extras patch warning (run latest supabase-tables.sql migration):', e2.message);
          toastRef.current({
            title: '⚠️ Customer saved partially',
            description: `Base info saved. Extra fields (GST/Bank/etc.) failed: ${e2.message}. Run STEP 17f migration.`,
            variant: 'default',
            duration: 8000,
          });
        }
      });
    });
  };

  const addCustomer = useCallback((data: Omit<Customer, 'id' | 'customerCode' | 'accountId' | 'createdAt'>, opts?: { onSaved?: (x: Customer) => void; onFailed?: () => void }): Customer => {
    if (guardFYLocked()) { opts?.onFailed?.(); return { ...data, id: '' } as unknown as Customer; }
    const accountId = crypto.randomUUID();
    // Auto-create ledger account under Sundry Debtors (3303)
    const newAccount: LedgerAccount = {
      id: accountId,
      name: data.legalName || data.name,
      nameHi: data.nameHi || data.legalName || data.name,
      type: 'asset',
      openingBalance: data.openingBalance || 0,
      openingBalanceType: data.openingBalanceType || 'debit',
      isSystem: false,
      isGroup: false,
      parentId: '3303',
    };
    // Readable code (#706) for the party ledger, like every other user-created account.
    const partyCode = nextAccountCode(accountsRef.current, '3303', false, 'asset');
    if (partyCode) newAccount.code = partyCode;
    accountsRef.current = [...accountsRef.current, newAccount];
    setAccountsState(prev => [...prev, newAccount]);

    const maxCusNum = customersRef.current.reduce((max, c) => {
      const m = c.customerCode?.match(/CUS\/(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const customerCode = `CUS/${String(maxCusNum + 1).padStart(3, '0')}`;
    const customer: Customer = { ...data, id: crypto.randomUUID(), customerCode, accountId, createdAt: new Date().toISOString() };
    customersRef.current = [...customersRef.current, customer];
    setCustomersState(prev => [...prev, customer]);
    // RULE 1: the ledger account and the party row are ONE thing to the user. Save the account first;
    // only once it is in the cloud save the party (a voucher line is FK-bound to the account). If either
    // fails, roll BOTH back (screen + cloud) and say so — no party without a ledger, no orphan ledger.
    const undoLocal = () => {
      customersRef.current = customersRef.current.filter(x => x.id !== customer.id);
      setCustomersState(prev => prev.filter(x => x.id !== customer.id));
      accountsRef.current = accountsRef.current.filter(a => a.id !== accountId);
      setAccountsState(prev => prev.filter(a => a.id !== accountId));
    };
    const { code: accCode, ...baseAccount } = newAccount;
    supabase.from('accounts').upsert(withSoc(baseAccount)).then(({ error }) => {
      if (error) {
        console.error('DB sync error:', error.message); reportError('db-sync', error.message);
        undoLocal();
        toastRef.current({ title: tr('❌ ग्राहक सेव नहीं हुआ', '❌ Customer not saved'), description: tr(`खाता क्लाउड में सेव नहीं हुआ — ${error.message}. स्क्रीन से हटा दिया गया; दोबारा जोड़ें।`, `Account not saved to the cloud — ${error.message}. Removed from the screen; please add again.`), variant: 'destructive', duration: 12000 });
        opts?.onFailed?.();
        return;
      }
      // The opening balance must reach the journal too (same as addAccount) — a party opened here with an
      // opening used to leave accounts and ledger_events disagreeing, which silently disables journal reads.
      if ((Number(newAccount.openingBalance) || 0) !== 0) {
        if (postingServiceRef.current) syncOpeningOnServer(accountId);
        else { const ev = buildOpeningDelta(newAccount); if (ev) { ledgerEventsRef.current = [...ledgerEventsRef.current, ev]; persistLedgerEvent(ev); } else if (!journalLoadedRef.current) syncOpeningOnServer(accountId); }
      }
      if (accCode) {
        supabase.from('accounts').update({ code: accCode }).eq('id', accountId).eq('society_id', societyIdRef.current).select('id').then(({ data: rows, error: cErr }) => {
          if (!cErr && rows && rows.length > 0) return;
          reportError('db-sync', cErr?.message || 'party code update matched 0 rows');   // code only — the ledger is safe
          accountsRef.current = accountsRef.current.map(a => a.id === accountId ? { ...a, code: undefined } : a);
          setAccountsState(prev => prev.map(a => a.id === accountId ? { ...a, code: undefined } : a));
        });
      }
      persistCustomer(customer, {
        isUpdate: false,
        onIdentityFail: () => { const strip = (x: Customer) => x.id === customer.id ? { ...x, ...piiOf(undefined, 'customer') } as Customer : x; customersRef.current = customersRef.current.map(strip); setCustomersState(prev => prev.map(strip)); },
        onBaseFail: () => {
          undoLocal();
          // no orphan ledger — the one rollback-aware account delete (puts it back on screen if the cloud refuses)
          deleteAccountRow(newAccount, { context: 'party-create-rollback', failTitle: tr('नया खाता हटाया नहीं जा सका', 'The new account could not be removed') });
          opts?.onFailed?.();
        },
        onBaseSuccess: () => opts?.onSaved?.(customer),
      });
    });
    return customer;
  }, []);

  const updateCustomer = useCallback((id: string, data: Partial<Omit<Customer, 'id' | 'customerCode' | 'accountId' | 'createdAt'>>) => {
    if (guardFYLocked()) return;
    const before = customersRef.current.find(c => c.id === id);
    if (!before) return;
    const updated: Customer = { ...before, ...data };
    customersRef.current = customersRef.current.map(c => c.id === id ? updated : c);
    setCustomersState(prev => prev.map(c => c.id === id ? updated : c));

    // Mirror name + opening balance changes to the linked Sundry Debtor account
    if (data.name || data.nameHi || data.legalName || data.openingBalance !== undefined || data.openingBalanceType) {
      setAccountsState(prev => prev.map(a => {
        if (a.id !== updated.accountId) return a;
        return {
          ...a,
          name: updated.legalName || updated.name,
          nameHi: updated.nameHi || updated.legalName || updated.name,
          openingBalance: updated.openingBalance ?? a.openingBalance,
          openingBalanceType: updated.openingBalanceType ?? a.openingBalanceType,
        };
      }));
    }

    persistCustomer(updated, {
      isUpdate: true,
      before,
      onIdentityFail: () => { const back = (x: Customer) => x.id === id ? { ...x, ...piiOf(before, 'customer') } as Customer : x; customersRef.current = customersRef.current.map(back); setCustomersState(prev => prev.map(back)); },
      onBaseFail: () => {
        customersRef.current = customersRef.current.map(c => c.id === id ? before : c);
        setCustomersState(prev => prev.map(c => c.id === id ? before : c));
      },
    });
  }, []);

  const deleteCustomer = useCallback((id: string) => {
    if (guardPermission('delete', tr('ग्राहक मिटाने', 'delete customers'))) return;   // ECR-06: role gate
    if (guardFYLocked()) return;
    const cus = customers.find(c => c.id === id);
    if (!cus) return;
    // H9: Block if customer has live sales
    const liveSales = salesRef.current.filter(s => s.customerId === id).length;
    if (liveSales > 0) {
      toastRef.current({ title: tr('ग्राहक नहीं हटाया जा सकता', 'Customer cannot be deleted'), description: tr(`इससे ${liveSales} बिक्री जुड़ी हैं — पहले बिक्री पेज से वे हटाएँ। (${liveSales} sale(s) linked.)`, `${liveSales} sale(s) are linked to it — delete them from the Sales page first. (${liveSales} sale(s) linked.)`), variant: 'destructive', duration: 10000 });
      return;
    }
    // Tally-style: block if the linked Sundry Debtor account still carries a balance.
    if (guardAccountBalance(cus.accountId, tr(`ग्राहक "${cus.name}"`, `Customer "${cus.name}"`))) return;
    setCustomersState(prev => prev.filter(c => c.id !== id));
    supabase.from('customers').delete().eq('id', id).then(({ error }) => {
      if (error) { failedCloudWrite(tr('ग्राहक हटाना', 'Deleting the customer'), error, () => { customersRef.current = putBack(customersRef.current, cus); setCustomersState(prev => putBack(prev, cus)); }); return; }
      if (cus.accountId) {
        const accountReferenced = vouchersRef.current.some(v =>
          v.debitAccountId === cus.accountId || v.creditAccountId === cus.accountId ||
          (v.lines && v.lines.some(l => l.accountId === cus.accountId))
        );
        if (accountReferenced) {
          setAccountsState(prev => prev.map(a => a.id === cus.accountId ? { ...a, name: `${a.name} [Customer deleted]`, isSystem: false } : a));
          supabase.from('accounts').update({ name: `${cus.name} [Customer deleted]` }).eq('id', cus.accountId).eq('society_id', societyIdRef.current)
            .then(({ error }) => { if (error) { console.error('Account rename sync:', error.message); reportError('write-partial', error.message, { at: 'Account rename sync:' }); } });
        } else {
          const cusAccount = accountsRef.current.find(a => a.id === cus.accountId);
          setAccountsState(prev => prev.filter(a => a.id !== cus.accountId));
          if (cusAccount) deleteAccountRow(cusAccount, { context: 'customer-account-delete' });
        }
      }
      emitAudit({ entityType: 'customer', entityId: id, action: 'delete', before: { name: cus.name, accountId: cus.accountId }, reason: 'Customer deleted' });   // H11
    });
  }, [customers, deleteAccountRow]);

  const getEntityLinks = useCallback((entityType: 'member' | 'customer' | 'supplier' | 'stockItem' | 'employee' | 'account' | 'loan' | 'asset', id: string, domain?: MemberDomainLinkSources): EntityLink[] => {
    // K5: the pre-check is a pure module (lib/entityLinks) — same rules, testable alone.
    return computeEntityLinks(entityType, id, {
      vouchers: vouchersRef.current.filter(v => !v.isDeleted),
      loans: loansRef.current, sales: salesRef.current, purchases: purchasesRef.current, stockMovements,
      salaryRecords: salaryRecordsRef.current, suppliers: suppliersRef.current, customers: customersRef.current,
      assets: assetsRef.current, depositAccounts: depositAccountsRef.current, kccLoans: kccLoansRef.current, ...domain,
    });
  }, [stockMovements]); // eslint-disable-line

  // Perf (audit P0): the context value used to be an inline object literal, so EVERY re-render of
  // this provider — including ones where no data changed (navigation, theme toggle, a parent
  // re-render) — built a fresh value and re-rendered all ~135 consumers for nothing. Memoize it.
  // Every function in the value is already useCallback-stable and every data field is useState, so
  // the memo only rebuilds when a real field changes. getLedgerEvents was the sole inline arrow —
  // useCallback it so the memo can hold a stable identity. NOTE: this does NOT stop a genuine
  // mutation from re-rendering consumers (one field changing ⇒ new value) — that needs a context
  // split / selector, tracked separately. Deps mirror the value object exactly (exhaustive, so a
  // changed field is never missed and the value can never go stale).
  const getLedgerEvents = useCallback(() => [...ledgerEventsRef.current], []);
  // RM-01: computed on demand from what is already loaded — a pure read, never run by the load path.
  const getPhantomVoucherDiagnostics = useCallback(
    () => phantomVoucherDiagnostics({ vouchers, members, sales, purchases }),
    [vouchers, members, sales, purchases],
  );

  // Batch A (P0-1): pages and registers see amountPaid DERIVED from the live payment vouchers — the
  // stored column is only a cache that a failed second write could leave behind.
  const procurementSettlementsView = useMemo(
    () => withDerivedAmountPaid(procurementSettlements, farmerPaidByEngineVoucher(vouchers)),
    [procurementSettlements, vouchers],
  );

  const contextValue = useMemo<DataContextType>(() => ({
    branches, activeBranchId, setActiveBranch, addBranch, updateBranch, deleteBranch, transferBetweenBranches, matchesActiveBranch, isBranchRestricted,
    godowns, activeGodownId, setActiveGodown, addGodown, updateGodown, deleteGodown,
    vouchers, members, accounts, society, loans, assets, auditObjections,
    depositAccounts, depositTransactions, addDepositAccount, postDepositTransaction, postDepositInterest, closeDepositAccount, getDepositTransactions,
    markComplianceFiled, unmarkComplianceFiled, getComplianceFiledIds,
    stockItems, stockMovements, reconciledStockMovements, sales, purchases, employees, salaryRecords,
    suppliers, customers, kccLoans, societyCapabilities, societyActivities, setCapabilityHidden,
    procurementFarmers, procurementLots, procurementEvents, addFarmer, updateFarmer, addProcurementLot,
    procurementQualityTests, procurementMoistureRecords, recordQualityInspection,
    procurementJForms, generateJForm,
    procurementFinancialIntents, generateFinancialIntent,
    procurementPostingRequests, generatePostingRequest,
    procurementPostingRuleResults, generatePostingRuleResult, generateEngineVoucher,
    procurementSettlements: procurementSettlementsView, createFarmerSettlement, addSettlementDeductionLine, removeSettlementDeductionLine, approveFarmerSettlement,
    recordFarmerPayment, cancelProcurementLot,
    addVoucher, updateVoucher, cancelVoucher, guardPageWrite, registerVoucherOwner, registerVoucherCancelFollower, reverseVoucher, setVoucherCheque, gstLegs, addStatutoryAppropriation, restoreVoucher, usesPostingService, canEditVoucherActivity, clearVoucher, unclearVoucher, approveVoucher, rejectVoucher, knownEmptyTables,
    addMember, updateMember, changeMemberStatus, deleteMember, uploadMemberPhoto, removeMemberPhoto, memberPhotoUrl, refundShareCapital, approveShareRefund, payShareRefund, purchaseShareCapital, transferShareCapital, shareOperation, getMemberShareReconciliation, approveMember, rejectMember,
    workOrders, addWorkOrder, updateWorkOrder, deleteWorkOrder,
    musterEntries, addMusterEntry, updateMusterEntry, deleteMusterEntry, payWages,
    addAccount, updateAccount, assignMissingAccountCodes, deleteAccount, mergeAccounts, resetAccounts, updateSociety, closeFinancialYear,
    addLoan, updateLoan, deleteLoan,
    addAsset, updateAsset, disposeAsset, deleteAsset, postDepreciation,
    addAuditObjection, updateAuditObjection, deleteAuditObjection,
    recoverables, addRecoverable, updateRecoverable, deleteRecoverable,
    kachiAaratEntries, addKachiAaratEntry, updateKachiAaratEntry, deleteKachiAaratEntry,
    p7Entries, upsertP7Entry, deleteP7Entry,
    addStockItem, updateStockItem, deleteStockItem, addStockMovement, transferStock, recordStockShortage, reverseStockShortage, writeOffShortage,
    addSale, updateSale, deleteSale, addBillReceipt, addBillPayment,
    addPurchase, updatePurchase, deletePurchase,
    addEmployee, updateEmployee, deleteEmployee,
    addSalaryRecord, updateSalaryRecord, deleteSalaryRecord,
    addSupplier, updateSupplier, deleteSupplier,
    addCustomer, updateCustomer, deleteCustomer,
    getAccountBalance, getShareCapitalReconciliation, getAssetRegisterReconciliation, getCashBookEntries, getBankBookEntries,
    getTrialBalance, getProfitLoss, getTradingAccount, getMemberLedger, getReceiptsPayments, postClosingStock, recordFundUtilisation,
    getLedgerEvents, getLedgerReportParity, loadLedgerJournal, getPhantomVoucherDiagnostics,
    getEntityLinks,
    isLoading,
  }), [
    branches, activeBranchId, setActiveBranch, addBranch, updateBranch, deleteBranch, transferBetweenBranches, matchesActiveBranch, isBranchRestricted,
    godowns, activeGodownId, setActiveGodown, addGodown, updateGodown, deleteGodown,
    vouchers, members, accounts, society, loans, assets, auditObjections,
    depositAccounts, depositTransactions, addDepositAccount, postDepositTransaction, postDepositInterest, closeDepositAccount, getDepositTransactions,
    markComplianceFiled, unmarkComplianceFiled, getComplianceFiledIds,
    stockItems, stockMovements, reconciledStockMovements, sales, purchases, employees, salaryRecords,
    suppliers, customers, kccLoans, societyCapabilities, societyActivities, setCapabilityHidden,
    procurementFarmers, procurementLots, procurementEvents, addFarmer, updateFarmer, addProcurementLot,
    procurementQualityTests, procurementMoistureRecords, recordQualityInspection,
    procurementJForms, generateJForm,
    procurementFinancialIntents, generateFinancialIntent,
    procurementPostingRequests, generatePostingRequest,
    procurementPostingRuleResults, generatePostingRuleResult, generateEngineVoucher,
    procurementSettlementsView, createFarmerSettlement, addSettlementDeductionLine, removeSettlementDeductionLine, approveFarmerSettlement,
    recordFarmerPayment, cancelProcurementLot,
    addVoucher, updateVoucher, cancelVoucher, guardPageWrite, registerVoucherOwner, registerVoucherCancelFollower, reverseVoucher, setVoucherCheque, gstLegs, addStatutoryAppropriation, restoreVoucher, usesPostingService, canEditVoucherActivity, clearVoucher, unclearVoucher, approveVoucher, rejectVoucher, knownEmptyTables,
    addMember, updateMember, changeMemberStatus, deleteMember, uploadMemberPhoto, removeMemberPhoto, memberPhotoUrl, refundShareCapital, approveShareRefund, payShareRefund, purchaseShareCapital, transferShareCapital, shareOperation, getMemberShareReconciliation, approveMember, rejectMember,
    workOrders, addWorkOrder, updateWorkOrder, deleteWorkOrder,
    musterEntries, addMusterEntry, updateMusterEntry, deleteMusterEntry, payWages,
    addAccount, updateAccount, assignMissingAccountCodes, deleteAccount, mergeAccounts, resetAccounts, updateSociety, closeFinancialYear,
    addLoan, updateLoan, deleteLoan,
    addAsset, updateAsset, disposeAsset, deleteAsset, postDepreciation,
    addAuditObjection, updateAuditObjection, deleteAuditObjection,
    recoverables, addRecoverable, updateRecoverable, deleteRecoverable,
    kachiAaratEntries, addKachiAaratEntry, updateKachiAaratEntry, deleteKachiAaratEntry,
    p7Entries, upsertP7Entry, deleteP7Entry,
    addStockItem, updateStockItem, deleteStockItem, addStockMovement, transferStock, recordStockShortage, reverseStockShortage, writeOffShortage,
    addSale, updateSale, deleteSale, addBillReceipt, addBillPayment,
    addPurchase, updatePurchase, deletePurchase,
    addEmployee, updateEmployee, deleteEmployee,
    addSalaryRecord, updateSalaryRecord, deleteSalaryRecord,
    addSupplier, updateSupplier, deleteSupplier,
    addCustomer, updateCustomer, deleteCustomer,
    getAccountBalance, getShareCapitalReconciliation, getAssetRegisterReconciliation, getCashBookEntries, getBankBookEntries,
    getTrialBalance, getProfitLoss, getTradingAccount, getMemberLedger, getReceiptsPayments, postClosingStock, recordFundUtilisation,
    getLedgerEvents, getLedgerReportParity, loadLedgerJournal, getPhantomVoucherDiagnostics,
    getEntityLinks,
    isLoading,
  ]);

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};

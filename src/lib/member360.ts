/**
 * Member-360 (staff) — adapter from the staff app's in-memory state to the member-portal snapshot
 * shape, so the staff Member-360 page runs the EXACT same view builders the member sees on the
 * portal (buildPortalView + buildVerticalViews → the S0 / staff functions). One formula per figure
 * (RULE 2): staff, portal and each source page (Loan Register, Dairy passbook, Member Statement,
 * Member Credit) can never disagree.
 *
 * Mirrors member_portal_snapshot() (064/065) row selection: this member only, soft-deleted rows
 * excluded (RULE 5), share-capital vouchers only (1102), APPROVED distributions and only this
 * member's line. One deliberate difference: staff sees the FULL milk history (no FY window).
 * PURE — no React, no network.
 */
import type {
  Member, Voucher, Loan, KccLoan, DepositAccount, DepositTransaction, MilkEntry, DairySettlement,
  DairyInputIssue, DairyDistribution, MaintenanceBill, HousingFlat, SalesReturn, PatronageRun,
} from '@/types';
import { buildPortalView, SHARE_CAP_ACCOUNT_ID, type PortalSnapshot, type PortalView } from './memberPortalView';
import { buildVerticalViews, type PortalVerticalPayload, type VerticalViews } from './memberPortalVerticals';
import { ACC_DIVIDEND, ACC_NET_SURPLUS, type DistributionRun } from './distribution/dividendRuns';
import { getVoucherLines } from './voucherUtils';

export interface Member360Sources {
  society?: { name?: string; nameHi?: string; address?: string };
  vouchers: readonly Voucher[];
  loans: readonly Loan[];
  depositAccounts: readonly DepositAccount[];
  depositTransactions: readonly DepositTransaction[];
  kccLoans: readonly KccLoan[];
  accounts: readonly { id: string; name?: string; nameHi?: string; subtype?: string; isGroup?: boolean }[];
  milkEntries?: readonly MilkEntry[];
  dairySettlements?: readonly DairySettlement[];
  dairyInputIssues?: readonly DairyInputIssue[];
  dairyDistributions?: readonly DairyDistribution[];
  maintenanceBills?: readonly MaintenanceBill[];
  housingFlats?: readonly HousingFlat[];
  sales?: readonly { id: string; saleNo?: string; date: string; memberId?: string; paymentMode: string; grandTotal: number; netAmount: number; isDeleted?: boolean }[];
  memberRecoveries?: readonly Voucher[];
  salesReturns?: readonly SalesReturn[];
  patronageRuns?: readonly PatronageRun[];
  /** member_distribution_runs (066). */
  distributionRuns?: readonly DistributionRun[];
}

export interface Member360 { snapshot: PortalSnapshot & PortalVerticalPayload; view: PortalView; verticals: VerticalViews }

const live = <T extends { isDeleted?: boolean }>(rows: readonly T[] | undefined): T[] => (rows ?? []).filter((r) => !r.isDeleted);

/** Same masking as the 064 RPC: Aadhaar → XXXX-XXXX-1234, PAN → XXXXX + last 5. */
export function maskAadhaar(a?: string): string | null {
  const d = String(a ?? '').replace(/\D/g, '');
  return d ? `XXXX-XXXX-${d.slice(-4)}` : null;
}
export function maskPan(p?: string): string | null {
  const s = String(p ?? '');
  return s ? `XXXXX${s.slice(-5)}` : null;
}

export function toMemberSnapshot(member: Member, src: Member360Sources): PortalSnapshot & PortalVerticalPayload {
  const id = member.id;
  const activeVouchers = live(src.vouchers);
  const myDeposits = src.depositAccounts.filter((d) => d.memberId === id);
  const myDepositIds = new Set(myDeposits.map((d) => d.id));
  const myBills = live(src.maintenanceBills).filter((b) => b.memberId === id);
  const myBillIds = new Set(myBills.map((b) => b.id));
  const ownLine = <L extends { memberId: string }>(lines: readonly L[] | undefined) => (lines ?? []).find((l) => l.memberId === id);

  return {
    ok: true,
    society: src.society ?? null,
    member: {
      id, memberId: member.memberId, name: member.name, fatherName: member.fatherName, address: member.address,
      phone: member.phone, memberType: member.memberType, joinDate: member.joinDate, status: member.status,
      shareCapital: member.shareCapital, shareCount: member.shareCount, shareFaceValue: member.shareFaceValue,
      shareCertNo: member.shareCertNo, nomineeName: member.nomineeName, nomineeRelation: member.nomineeRelation,
      nominees: member.nominees ?? [], kycStatus: member.kycStatus,
      aadhaarMasked: maskAadhaar(member.aadhaar), panMasked: maskPan(member.pan),
    },
    shareVouchers: activeVouchers.filter((v) => v.memberId === id && (v.creditAccountId === SHARE_CAP_ACCOUNT_ID || v.debitAccountId === SHARE_CAP_ACCOUNT_ID)),
    loans: live(src.loans).filter((l) => l.memberId === id),
    deposits: myDeposits,
    depositTransactions: src.depositTransactions.filter((t) => myDepositIds.has(t.depositAccountId)),
    kccLoans: live(src.kccLoans as readonly (KccLoan & { isDeleted?: boolean })[]).filter((k) => k.memberId === id),

    // Dairy — full history for staff (the portal windows milk to FY + previous month).
    milkEntries: (src.milkEntries ?? []).filter((e) => e.memberId === id) as unknown as Record<string, unknown>[],
    dairySettlements: live(src.dairySettlements).filter((s) => s.memberId === id) as unknown as Record<string, unknown>[],
    dairyInputIssues: live(src.dairyInputIssues).filter((i) => i.memberId === id) as unknown as Record<string, unknown>[],
    dairyInputAccounts: src.accounts.filter((a) => !a.isGroup) as unknown as Record<string, unknown>[],
    dairyDistributions: live(src.dairyDistributions)
      .filter((r) => r.status === 'approved' && ownLine(r.lines))
      .map((r) => ({ id: r.id, kind: r.kind, from: r.from, to: r.to, fyLabel: r.fyLabel, basis: r.basis, rate: r.rate, approvedAt: r.approvedAt, line: ownLine(r.lines) })),

    // Housing — this member's bills, the receipt/interest vouchers OF those bills, flats.
    maintenanceBills: myBills as unknown as Record<string, unknown>[],
    maintenanceVouchers: activeVouchers.filter((v) => (v.refType === 'maintenance.receipt' || v.refType === 'maintenance.interest') && !!v.refId && myBillIds.has(v.refId)) as unknown as Record<string, unknown>[],
    housingFlats: live(src.housingFlats).filter((f) => f.memberId === id) as unknown as Record<string, unknown>[],

    // Consumer — credit sales, recoveries, credit-adjusted returns, approved patronage lines.
    creditSales: live(src.sales).filter((s) => s.memberId === id && s.paymentMode === 'credit') as unknown as Record<string, unknown>[],
    creditRecoveries: live(src.memberRecoveries).filter((v) => v.memberId === id).map((v) => ({ id: v.id, voucherNo: v.voucherNo, date: v.date, memberId: v.memberId, amount: v.amount })),
    creditReturns: live(src.salesReturns).filter((r) => r.memberId === id && r.refundMode === 'credit-adjust').map((r) => ({ id: r.id, returnNo: r.returnNo, date: r.date, memberId: r.memberId, grandTotal: r.grandTotal, refundMode: r.refundMode })),
    patronageRuns: live(src.patronageRuns)
      .filter((r) => r.status === 'approved' && ownLine(r.lines))
      .map((r) => ({ id: r.id, kind: r.kind ?? 'patronage', fyLabel: r.fyLabel, from: r.from, to: r.to, ratePct: r.ratePct, approvedAt: r.approvedAt, line: ownLine(r.lines) })),

    // General dividend — runs carry ONLY this member's line (other members never leave), plus the
    // appropriation vouchers (Dr 1208 / Cr 1211) and this member's dividend payments (Dr 1211).
    dividendRuns: (src.distributionRuns ?? [])
      .filter((r) => !r.isDeleted && r.kind === 'dividend' && r.status === 'approved')
      .map((r) => ({ ...r, lines: r.lines.filter((l) => l.memberId === id) })) as unknown as Record<string, unknown>[],
    dividendVouchers: activeVouchers.filter((v) => {
      const lines = getVoucherLines(v);
      const isAppropriation = lines.some((l) => l.accountId === ACC_NET_SURPLUS && l.type === 'Dr') && lines.some((l) => l.accountId === ACC_DIVIDEND && l.type === 'Cr');
      const isMyPayment = v.memberId === id && lines.some((l) => l.accountId === ACC_DIVIDEND && l.type === 'Dr');
      return isAppropriation || isMyPayment;
    }) as unknown as Record<string, unknown>[],
  };
}

/** The staff Member-360: the same view the member sees on the portal, fed from staff state. */
export function buildMember360(member: Member, src: Member360Sources, asOf: string): Member360 {
  const snapshot = toMemberSnapshot(member, src);
  return { snapshot, view: buildPortalView(snapshot), verticals: buildVerticalViews(member.id, snapshot, asOf) };
}

/**
 * Member Portal S4b — the member's DAIRY, HOUSING and CONSUMER views, built from the 065 snapshot
 * payload with the SAME pure functions the staff pages run (RULE 2):
 *   dairy     buildMemberPassbook (Dairy Registers → passbook) + memberInputOutstanding
 *   housing   buildMemberStatement (Member Statement — Maintenance)
 *   consumer  memberOutstanding + memberAgeing (Consumer → Member Credit)
 * PURE — no network, no React. A vertical is `null` when the member has nothing in it, so the page
 * shows only what applies to them (no separate capability rule).
 */
import type { MilkEntry, DairySettlement, DairyInputIssue, MaintenanceBill, Voucher } from '@/types';
import { buildMemberPassbook, type MemberPassbook } from './dairy/registers';
import { memberInputOutstanding, type InputBalance } from './dairy/inputs';
import { resolveMemberInputReceivableAccountId } from './dairy/accounts';
import { buildMemberStatement, type MemberStatement } from './housing/statement';
import { memberOutstanding, memberAgeing, memberCreditLedger, type Ageing, type CreditLedgerRow } from './consumer/credit';

type Row = Record<string, unknown>;

/** The S4 keys of member_portal_snapshot() (065). All optional: a 064-only database omits them. */
export interface PortalVerticalPayload {
  milkFrom?: string;
  milkEntries?: Row[];
  dairySettlements?: Row[];
  dairyInputIssues?: Row[];
  dairyInputAccounts?: Row[];
  dairyDistributions?: Row[];
  maintenanceBills?: Row[];
  maintenanceVouchers?: Row[];
  housingFlats?: Row[];
  creditSales?: Row[];
  creditRecoveries?: Row[];
  creditReturns?: Row[];
  patronageRuns?: Row[];
}

export interface DistributionItem {
  id: string;
  kind: string;          // bonus | dividend | patronage
  period: string;        // "fy" or "from – to"
  base: number;
  amount: number;
  approvedAt?: string;
}

export interface DairyView {
  milkFrom?: string;
  passbook: MemberPassbook;
  inputs: InputBalance;
  inputIssues: DairyInputIssue[];
  distributions: DistributionItem[];
}
export interface HousingView {
  statement: MemberStatement;
  flats: { id: string; flatNo: string; blockNo?: string; area?: number; monthlyMaintenance?: number }[];
}
export interface ConsumerView {
  outstanding: number;
  ageing: Ageing;
  creditSales: { id: string; saleNo?: string; date: string; amount: number }[];
  /** Sales (Dr), recoveries + credit-adjusted returns (Cr) — the SAME ledger the staff Member Credit page shows. */
  ledger: CreditLedgerRow[];
  distributions: DistributionItem[];
}
export interface VerticalViews { dairy: DairyView | null; housing: HousingView | null; consumer: ConsumerView | null }

const num = (n: unknown) => Number(n) || 0;
const str = (s: unknown) => (s == null ? '' : String(s));
const arr = (a: Row[] | undefined) => (Array.isArray(a) ? a : []);

function distributions(runs: Row[], fallbackKind: string): DistributionItem[] {
  return runs.map((r) => {
    const line = (r.line ?? {}) as Row;
    const period = r.fyLabel ? str(r.fyLabel) : [str(r.from), str(r.to)].filter(Boolean).join(' – ');
    return { id: str(r.id), kind: str(r.kind) || fallbackKind, period, base: num(line.base), amount: num(line.amount), approvedAt: r.approvedAt ? str(r.approvedAt) : undefined };
  });
}

export function buildVerticalViews(memberId: string, p: PortalVerticalPayload, asOf: string): VerticalViews {
  // ── Dairy ──
  const entries = arr(p.milkEntries).map((e) => ({ ...e, qty: num(e.qty), fat: num(e.fat), snf: num(e.snf), rate: num(e.rate), amount: num(e.amount) })) as unknown as MilkEntry[];
  const settlements = arr(p.dairySettlements).map((s) => ({
    ...s, gross: num(s.gross), netPayable: num(s.netPayable), amountPaid: num(s.amountPaid),
    deductionLines: (Array.isArray(s.deductionLines) ? s.deductionLines : []).map((l: Row) => ({ ...l, amount: num(l.amount) })),
  })) as unknown as DairySettlement[];
  const issues = arr(p.dairyInputIssues).map((i) => ({ ...i, qty: i.qty == null ? undefined : num(i.qty), amount: num(i.amount) })) as unknown as DairyInputIssue[];
  const dairyDist = distributions(arr(p.dairyDistributions), 'bonus');
  const dairy: DairyView | null = entries.length || settlements.length || issues.length || dairyDist.length
    ? {
        milkFrom: p.milkFrom,
        passbook: buildMemberPassbook(entries, settlements, memberId),
        inputs: memberInputOutstanding(issues, settlements, memberId,
          resolveMemberInputReceivableAccountId(arr(p.dairyInputAccounts) as unknown as Parameters<typeof resolveMemberInputReceivableAccountId>[0]) || ''),
        inputIssues: issues,
        distributions: dairyDist,
      }
    : null;

  // ── Housing ──
  const bills = arr(p.maintenanceBills).map((b) => ({ ...b, amount: num(b.amount), paidAmount: num(b.paidAmount) })) as unknown as MaintenanceBill[];
  const mVouchers = arr(p.maintenanceVouchers).map((v) => ({ ...v, amount: num(v.amount) })) as unknown as Voucher[];
  const flats = arr(p.housingFlats).map((f) => ({
    id: str(f.id), flatNo: str(f.flatNo), blockNo: f.blockNo ? str(f.blockNo) : undefined,
    area: f.area == null ? undefined : num(f.area), monthlyMaintenance: f.monthlyMaintenance == null ? undefined : num(f.monthlyMaintenance),
  }));
  const housing: HousingView | null = bills.length || flats.length
    ? { statement: buildMemberStatement(bills, mVouchers), flats }
    : null;

  // ── Consumer ──
  const sales = arr(p.creditSales).map((s) => ({
    id: str(s.id), memberId: str(s.memberId), paymentMode: str(s.paymentMode), date: str(s.date),
    grandTotal: num(s.grandTotal), netAmount: num(s.netAmount), saleNo: s.saleNo ? str(s.saleNo) : undefined,
  }));
  const recoveries = arr(p.creditRecoveries).map((r) => ({ id: str(r.id), date: str(r.date), ref: r.voucherNo ? str(r.voucherNo) : undefined, memberId: str(r.memberId), amount: num(r.amount) }));
  const returns = arr(p.creditReturns).map((r) => ({ id: str(r.id), date: str(r.date), ref: r.returnNo ? str(r.returnNo) : undefined, memberId: str(r.memberId), grandTotal: num(r.grandTotal), refundMode: str(r.refundMode) }));
  const patronage = distributions(arr(p.patronageRuns), 'patronage');
  const consumer: ConsumerView | null = sales.length || recoveries.length || returns.length || patronage.length
    ? {
        outstanding: memberOutstanding(sales, recoveries, memberId, returns),
        ageing: memberAgeing(sales, recoveries, memberId, asOf, returns),
        creditSales: sales.map((s) => ({ id: s.id, saleNo: s.saleNo, date: s.date, amount: s.grandTotal > 0 ? s.grandTotal : s.netAmount })),
        ledger: memberCreditLedger(sales, recoveries, returns, memberId),
        distributions: patronage,
      }
    : null;

  return { dairy, housing, consumer };
}

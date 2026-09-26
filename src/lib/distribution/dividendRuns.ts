/**
 * General dividend runs (Profit Distribution) — step 2 of "patronage / equity for all societies".
 * PURE.
 *
 * Before: the page posted one dividend voucher and, at payment time, re-split it by THAT DAY's share
 * capital — a share change between posting and payment silently changed every member's share, and no
 * per-member record existed for Member-360 / the portal. Now the split is frozen into a run (066) when
 * the dividend is posted, using the shared distribution engine.
 *
 * The VOUCHER stays the authority. A run is honoured only while a live dividend voucher for its FY
 * exists with the same total (liveRunFor) — an orphan from a failed post is simply ignored, and a
 * re-post reuses its id. Years posted before runs existed keep working (dividendBreakdown):
 *   paid       → the actual per-member payment vouchers are the record (nothing re-computed);
 *   not paid   → the old proportional split, which an admin can freeze with "हिस्से पक्के करें".
 */
import { linesFromBases, round2, type DistributionLine } from './engine';
import { getVoucherLines } from '../voucherUtils';

export type DistributionKind = 'dividend' | 'patronage' | 'bonus';

export interface DistributionRun {
  id: string;
  fyLabel: string;
  kind: DistributionKind;
  basis: string;
  ratePct?: number | null;
  total: number;
  lines: DistributionLine[];
  status: 'draft' | 'approved';
  voucherId?: string | null;
  source: 'posted' | 'snapshot';
  createdBy?: string | null;
  createdAt?: string;
  isDeleted?: boolean;
}

type MemberLike = { id: string; name: string; shareCapital?: number; status?: string; approvalStatus?: string };

/** Who receives the general dividend — same rule the page always used: active AND approved. */
export function eligibleDividendMembers<M extends MemberLike>(members: ReadonlyArray<M>): M[] {
  return members.filter((m) => m.status === 'active' && (!m.approvalStatus || m.approvalStatus === 'approved'));
}

/** Per-member dividend lines = ratePct% of paid-up share capital (same arithmetic as before). */
export function dividendRunLines(members: ReadonlyArray<MemberLike>, ratePct: number): DistributionLine[] {
  return linesFromBases(
    eligibleDividendMembers(members).map((m) => ({ memberId: m.id, memberName: m.name, base: m.shareCapital || 0 })),
    (base) => base * (ratePct || 0) / 100,
  );
}

/** The run that belongs to the live voucher of this FY + kind (orphans of failed posts are ignored). */
export function liveRunFor(runs: ReadonlyArray<DistributionRun>, fyLabel: string, kind: DistributionKind, voucherAmount: number | undefined): DistributionRun | undefined {
  if (voucherAmount == null) return undefined;
  return runs.find((r) => !r.isDeleted && r.fyLabel === fyLabel && r.kind === kind && Math.abs((r.total || 0) - voucherAmount) < 0.005);
}

/** Any existing run for this FY + kind (live or orphan) — a re-post overwrites it (one live run per FY). */
export function existingRunFor(runs: ReadonlyArray<DistributionRun>, fyLabel: string, kind: DistributionKind): DistributionRun | undefined {
  return runs.find((r) => !r.isDeleted && r.fyLabel === fyLabel && r.kind === kind);
}

export type BreakdownSource = 'run' | 'payments' | 'proportional';
export interface BreakdownRow { id: string; name: string; dividend: number; base?: number }

/**
 * Each member's entitled dividend for a POSTED year, and where it came from.
 *   run          — frozen at posting (or frozen later by an admin): the record.
 *   payments     — a legacy year already paid: the per-member payment vouchers ARE the record.
 *   proportional — a legacy year not yet paid: today's share-capital split (can be frozen).
 */
export function dividendBreakdown(args: {
  run?: DistributionRun;
  postedAmount: number;
  members: ReadonlyArray<MemberLike>;
  paidByMember: ReadonlyMap<string, { amount: number }>;
}): { rows: BreakdownRow[]; source: BreakdownSource } {
  const { run, postedAmount, members, paidByMember } = args;
  if (run) {
    return { source: 'run', rows: run.lines.map((l) => ({ id: l.memberId, name: l.memberName, dividend: l.amount, base: l.base })) };
  }
  if (paidByMember.size > 0) {
    const nameOf = new Map(members.map((m) => [m.id, m.name]));
    return {
      source: 'payments',
      rows: [...paidByMember.entries()]
        .map(([id, p]) => ({ id, name: nameOf.get(id) ?? id, dividend: round2(p.amount) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }
  const eligible = eligibleDividendMembers(members);
  const totalShareCapital = eligible.reduce((s, m) => s + (m.shareCapital || 0), 0);
  if (!(postedAmount > 0) || totalShareCapital <= 0) return { source: 'proportional', rows: [] };
  return {
    source: 'proportional',
    rows: eligible
      .map((m) => ({ id: m.id, name: m.name, base: m.shareCapital || 0, dividend: Math.round((m.shareCapital || 0) / totalShareCapital * postedAmount * 100) / 100 }))
      .filter((r) => r.dividend > 0),
  };
}

/** Freeze a legacy proportional split into run lines (total stays the POSTED amount). */
export function snapshotLines(rows: ReadonlyArray<BreakdownRow>): DistributionLine[] {
  return rows.map((r) => ({ memberId: r.id, memberName: r.name, base: round2(r.base ?? 0), amount: r.dividend }));
}

// ── Voucher matchers — THE rule for "is this FY's dividend posted / paid", shared by the Profit
// Distribution page, the staff Member-360 and the member portal (RULE 2). ─────────────────────────
export const ACC_NET_SURPLUS = '1208';
export const ACC_DIVIDEND = '1211';

type VoucherLike = Parameters<typeof getVoucherLines>[0];

/** The live appropriation voucher of an FY: Dr `debitId` / Cr `creditId`, narration names the FY. */
export function postedAppropriation<V extends VoucherLike>(vouchers: ReadonlyArray<V>, debitId: string, creditId: string, fy: string): V | undefined {
  return vouchers.find((v) =>
    !v.isDeleted
    && getVoucherLines(v).some((l) => l.accountId === debitId && l.type === 'Dr')
    && getVoucherLines(v).some((l) => l.accountId === creditId && l.type === 'Cr')
    && (v.narration || '').includes(fy));
}

/** Per-member dividend PAYMENTS of an FY (Dr 1211, memberId-tagged, "dividend paid" narration). */
export function dividendPaymentsByMember(vouchers: ReadonlyArray<VoucherLike>, fy: string): Map<string, { amount: number; voucherNo: string; date: string }> {
  const m = new Map<string, { amount: number; voucherNo: string; date: string }>();
  for (const v of vouchers) {
    if (v.isDeleted || !v.memberId || !v.narration?.includes(fy)) continue;
    if (!/dividend paid|डिविडेंड भुगतान/i.test(v.narration)) continue;
    if (!getVoucherLines(v).some((l) => l.accountId === ACC_DIVIDEND && l.type === 'Dr')) continue;
    const prev = m.get(v.memberId);
    m.set(v.memberId, { amount: Math.round(((prev?.amount || 0) + v.amount) * 100) / 100, voucherNo: v.voucherNo || prev?.voucherNo || '', date: v.date });
  }
  return m;
}

export interface MemberDividendRow {
  fyLabel: string;
  entitled: number;
  paid: number;
  due: number;
  source: 'run' | 'payments';
}

const FY_IN_NARRATION = /FY\s*(\d{4}-\d{2})/i;

/**
 * One member's dividend history across FYs — what Member-360 and the portal show. Per FY with a live
 * appropriation voucher:
 *   frozen run (liveRunFor)          → entitled = the member's line;
 *   legacy year already paid         → entitled = what the payment vouchers paid (the record);
 *   legacy year NOT paid, no run     → NOT shown (the split is not final — founder decision).
 * Orphan runs (no live voucher of the same total) never show.
 */
export function memberDividendHistory(
  memberId: string,
  runs: ReadonlyArray<DistributionRun>,
  vouchers: ReadonlyArray<VoucherLike>,
): MemberDividendRow[] {
  const fys = new Set<string>();
  for (const r of runs) if (!r.isDeleted && r.kind === 'dividend') fys.add(r.fyLabel);
  for (const v of vouchers) {
    const m = (v.narration || '').match(FY_IN_NARRATION);
    if (m) fys.add(m[1]);
  }
  const rows: MemberDividendRow[] = [];
  for (const fy of fys) {
    const posted = postedAppropriation(vouchers, ACC_NET_SURPLUS, ACC_DIVIDEND, fy);
    if (!posted) continue;
    const payments = dividendPaymentsByMember(vouchers, fy);
    const paid = payments.get(memberId)?.amount ?? 0;
    const run = liveRunFor(runs, fy, 'dividend', posted.amount);
    if (run) {
      const line = run.lines.find((l) => l.memberId === memberId);
      if (!line && paid <= 0) continue;
      const entitled = line?.amount ?? 0;
      rows.push({ fyLabel: fy, entitled, paid, due: round2(Math.max(0, entitled - paid)), source: 'run' });
    } else if (paid > 0) {
      rows.push({ fyLabel: fy, entitled: paid, paid, due: 0, source: 'payments' });
    }
  }
  return rows.sort((a, b) => b.fyLabel.localeCompare(a.fyLabel));
}

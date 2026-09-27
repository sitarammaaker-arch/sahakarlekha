/**
 * Phantom-voucher diagnostics (RM-01, S0 emergency safety fix).
 *
 * The load path used to WRITE accounting data: a member auto-voucher loop posted Cash receipts for
 * share capital / admission fee, and a "REPAIR v2" loop created, re-routed and soft-deleted
 * sale/purchase vouchers. RM-01 removes both writes. What they tried to "fix" is now only REPORTED
 * here, so a person can review it and act explicitly.
 *
 * PURE and READ-ONLY: takes plain arrays, returns plain rows, never mutates its input and never
 * touches the database. Tested by scripts/test-rm01-no-load-writes.mjs.
 */

export interface DiagVoucherLine { accountId: string; type: 'Dr' | 'Cr'; amount: number }
export interface DiagVoucher {
  id: string;
  voucherNo?: string;
  date?: string;
  amount?: number;
  narration?: string;
  createdBy?: string;
  memberId?: string;
  debitAccountId?: string;
  creditAccountId?: string;
  lines?: DiagVoucherLine[] | null;
  refType?: string;
  refId?: string;
  isDeleted?: boolean;
}
export interface DiagMember { id: string; name?: string; isDeleted?: boolean }
export interface DiagSale { id: string; saleNo?: string; voucherId?: string; isDeleted?: boolean }
export interface DiagPurchase { id: string; purchaseNo?: string; voucherId?: string; isDeleted?: boolean }

/** Account ids the old auto-voucher loop credited (ACCOUNT_IDS.SHARE_CAP / ADM_FEE). */
export const SHARE_CAPITAL_ACCOUNT = '1102';
export const ADMISSION_FEE_ACCOUNT = '4407';

export const AUTO_SHARE_NARRATION = 'Share Capital received from ';
export const AUTO_ADMISSION_NARRATION = 'Admission Fee received from ';

export interface AutoMemberVoucherRow {
  voucherId: string;
  voucherNo: string;
  memberId: string;
  memberName: string;
  kind: 'share_capital' | 'admission_fee';
  narration: string;
  createdBy: string;
  date: string;
  amount: number;
  /** Another live voucher also credits the same account for this member → a likely duplicate. */
  hasOtherPosting: boolean;
  /** The member row is missing or soft-deleted. */
  memberMissingOrDeleted: boolean;
}

export interface SalePurchaseGapRow {
  kind: 'sale_without_voucher' | 'purchase_without_voucher' | 'voucher_without_parent' | 'duplicate_ref_voucher';
  documentId: string;
  documentNo: string;
  voucherId: string;
  voucherNo: string;
  narration: string;
}

export interface PhantomVoucherDiagnostics {
  autoMemberVouchers: AutoMemberVoucherRow[];
  autoMemberVoucherCount: number;
  suspectedDuplicateCount: number;
  salePurchaseGaps: SalePurchaseGapRow[];
}

const isLive = (v: { isDeleted?: boolean }) => !v.isDeleted;

/** The legs of a voucher — its `lines`, or the legacy two-leg Dr/Cr fields. */
function legs(v: DiagVoucher): DiagVoucherLine[] {
  if (Array.isArray(v.lines) && v.lines.length > 0) return v.lines;
  const out: DiagVoucherLine[] = [];
  const amt = Number(v.amount) || 0;
  if (v.debitAccountId && amt > 0) out.push({ accountId: v.debitAccountId, type: 'Dr', amount: amt });
  if (v.creditAccountId && amt > 0) out.push({ accountId: v.creditAccountId, type: 'Cr', amount: amt });
  return out;
}

const creditsAccount = (v: DiagVoucher, accountId: string) =>
  legs(v).some(l => l.type === 'Cr' && l.accountId === accountId && (Number(l.amount) || 0) > 0);

function autoKind(v: DiagVoucher): AutoMemberVoucherRow['kind'] | null {
  if (v.createdBy !== 'System' || !v.memberId) return null;
  const n = v.narration || '';
  if (n.startsWith(AUTO_SHARE_NARRATION)) return 'share_capital';
  if (n.startsWith(AUTO_ADMISSION_NARRATION)) return 'admission_fee';
  return null;
}

/**
 * Live vouchers shaped like the old load-loop's output (createdBy 'System', the loop's narration,
 * tagged to a member). NOTE: addMember's own explicit receipts use the same shape, so a row here is
 * "auto-style", not proof of a phantom — `hasOtherPosting` marks the likely duplicates.
 */
export function findAutoMemberVouchers(vouchers: readonly DiagVoucher[], members: readonly DiagMember[]): AutoMemberVoucherRow[] {
  const memberById = new Map(members.map(m => [m.id, m]));
  const live = vouchers.filter(isLive);
  const rows: AutoMemberVoucherRow[] = [];
  for (const v of live) {
    const kind = autoKind(v);
    if (!kind) continue;
    const account = kind === 'share_capital' ? SHARE_CAPITAL_ACCOUNT : ADMISSION_FEE_ACCOUNT;
    const hasOtherPosting = live.some(o => o.id !== v.id && o.memberId === v.memberId && creditsAccount(o, account));
    const m = memberById.get(v.memberId!);
    rows.push({
      voucherId: v.id,
      voucherNo: v.voucherNo || '',
      memberId: v.memberId!,
      memberName: m?.name || '',
      kind,
      narration: v.narration || '',
      createdBy: v.createdBy || '',
      date: v.date || '',
      amount: Number(v.amount) || 0,
      hasOtherPosting,
      memberMissingOrDeleted: !m || !!m.isDeleted,
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.voucherNo.localeCompare(b.voucherNo));
}

/** Sales/purchases without a live voucher, ref vouchers without a live parent, and duplicate ref vouchers. */
export function findSalePurchaseVoucherGaps(
  sales: readonly DiagSale[],
  purchases: readonly DiagPurchase[],
  vouchers: readonly DiagVoucher[],
): SalePurchaseGapRow[] {
  const live = vouchers.filter(isLive);
  const liveById = new Map(live.map(v => [v.id, v]));
  const byRef = new Map<string, DiagVoucher[]>();
  for (const v of live) {
    if ((v.refType === 'sale' || v.refType === 'purchase') && v.refId) {
      const k = `${v.refType}:${v.refId}`;
      byRef.set(k, [...(byRef.get(k) || []), v]);
    }
  }
  const rows: SalePurchaseGapRow[] = [];
  const docs: { kind: 'sale' | 'purchase'; id: string; no: string; voucherId?: string; isDeleted?: boolean }[] = [
    ...sales.map(s => ({ kind: 'sale' as const, id: s.id, no: s.saleNo || '', voucherId: s.voucherId, isDeleted: s.isDeleted })),
    ...purchases.map(p => ({ kind: 'purchase' as const, id: p.id, no: p.purchaseNo || '', voucherId: p.voucherId, isDeleted: p.isDeleted })),
  ];
  const liveDocKeys = new Set<string>();
  for (const d of docs) {
    if (d.isDeleted) continue;
    liveDocKeys.add(`${d.kind}:${d.id}`);
    const hasVoucher = (d.voucherId && liveById.has(d.voucherId)) || (byRef.get(`${d.kind}:${d.id}`)?.length ?? 0) > 0;
    if (!hasVoucher) {
      rows.push({ kind: d.kind === 'sale' ? 'sale_without_voucher' : 'purchase_without_voucher', documentId: d.id, documentNo: d.no, voucherId: d.voucherId || '', voucherNo: '', narration: '' });
    }
  }
  for (const [key, vs] of byRef) {
    const [, id] = key.split(':');
    if (!liveDocKeys.has(key)) {
      for (const v of vs) rows.push({ kind: 'voucher_without_parent', documentId: id, documentNo: '', voucherId: v.id, voucherNo: v.voucherNo || '', narration: v.narration || '' });
    } else if (vs.length > 1) {
      for (const v of vs) rows.push({ kind: 'duplicate_ref_voucher', documentId: id, documentNo: '', voucherId: v.id, voucherNo: v.voucherNo || '', narration: v.narration || '' });
    }
  }
  return rows;
}

/** One read-only report of everything the removed load-time writers used to "fix". */
export function phantomVoucherDiagnostics(input: {
  vouchers: readonly DiagVoucher[];
  members: readonly DiagMember[];
  sales: readonly DiagSale[];
  purchases: readonly DiagPurchase[];
}): PhantomVoucherDiagnostics {
  const autoMemberVouchers = findAutoMemberVouchers(input.vouchers, input.members);
  return {
    autoMemberVouchers,
    autoMemberVoucherCount: autoMemberVouchers.length,
    suspectedDuplicateCount: autoMemberVouchers.filter(r => r.hasOtherPosting).length,
    salePurchaseGaps: findSalePurchaseVoucherGaps(input.sales, input.purchases, input.vouchers),
  };
}

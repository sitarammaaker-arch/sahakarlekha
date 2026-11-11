/**
 * Which ledger(s) a document's GST goes to (RM-17). PURE — the ONE rule every posting site shares
 * (sales, purchases, their returns, housing maintenance bills, transport trips).
 *
 * WHY: CGST Act s.49(5) bars cross-utilisation of central and State tax credit, and s.35 / CGST Rules
 * r.56 want output tax and input credit tracked head-wise. One combined "GST Payable" (2201) and one
 * "GST Input Credit" (3310) cannot show that; the split amounts were only in the narration.
 *
 * RULE:
 *  - New postings go head-wise: Output CGST / SGST / IGST (2291–2293), Input CGST / SGST / IGST (3391–3393).
 *  - A document whose EXISTING voucher used the combined ledger stays on it when edited, and a return
 *    reverses on the ledger the original bill used (`legacy`) — so old balances unwind where they sit and
 *    no posted history moves between ledgers.
 *  - If the head-wise amounts do not add up to the tax, or a head the document needs is not in the
 *    society's chart (or exists on this screen only, not yet in the database), the WHOLE tax goes to the
 *    combined ledger. Never a partial split, never an unbalanced voucher, never a blocked save.
 *
 * The legs always sum to exactly `total` (paise).
 */
import { toMinor as toPaise } from '../money';

export type GstSide = 'output' | 'input';
export type GstHead = 'cgst' | 'sgst' | 'igst';

/** The combined ledgers every chart has carried so far (kept, never renamed). */
export const GST_COMBINED_ID: Record<GstSide, string> = { output: '2201', input: '3310' };

/** The head-wise ledgers added by migration 156 (ACCOUNTS_TO_ADD_156 in lib/storage). */
export const GST_HEAD_ID: Record<GstSide, Record<GstHead, string>> = {
  output: { cgst: '2291', sgst: '2292', igst: '2293' },
  input: { cgst: '3391', sgst: '3392', igst: '3393' },
};

const HEADS: GstHead[] = ['cgst', 'sgst', 'igst'];
const SIDE_TYPE: Record<GstSide, string> = { output: 'liability', input: 'asset' };

/** Same patterns as the role catalog (lib/accounting/roles: gst.output.* / gst.input.*). */
const headPattern = (side: GstSide, head: GstHead): RegExp =>
  side === 'output'
    ? new RegExp(`output.*\\b${head}\\b|\\b${head}\\b.*(output|payable)`, 'i')
    : new RegExp(`input.*\\b${head}\\b|\\b${head}\\b.*(input|itc)`, 'i');

export interface GstAccountLike { id: string; name: string; type: string; isGroup?: boolean }

export interface GstLeg { accountId: string; amount: number; head: GstHead | 'combined' }

export interface GstLegOptions {
  /** The document's existing voucher (or, for a return, the original bill's) used the combined ledger. */
  legacy?: boolean;
  /** Account ids shown on screen that the database does not hold yet (migration not run). */
  unavailableIds?: ReadonlySet<string>;
}

/**
 * The society's ledger for one GST head, or null. The standard code wins when that account really is
 * this head (a society may have made its own account at that code); otherwise a single account the
 * society named for this head itself. Ambiguous → null (the caller falls back to the combined ledger).
 */
export function gstHeadAccountId(side: GstSide, head: GstHead, accounts: readonly GstAccountLike[], unavailableIds?: ReadonlySet<string>): string | null {
  const re = headPattern(side, head);
  const fits = (a: GstAccountLike) => !a.isGroup && a.type === SIDE_TYPE[side] && re.test(a.name) && !unavailableIds?.has(a.id);
  const std = accounts.find((a) => a.id === GST_HEAD_ID[side][head]);
  if (std && fits(std)) return std.id;
  const named = accounts.filter(fits);
  return named.length === 1 ? named[0].id : null;
}

/** True when a voucher carries a line on the combined GST ledger of this side. */
export function usesCombinedGst(side: GstSide, ...vouchers: Array<{ lines?: Array<{ accountId: string }> | null } | null | undefined>): boolean {
  return vouchers.some((v) => !!v?.lines?.some((l) => l.accountId === GST_COMBINED_ID[side]));
}

/** The GST legs of one document. Amounts only — the caller decides Dr / Cr. Sums to exactly `total`. */
export function gstLedgerLegs(
  side: GstSide,
  parts: { cgst?: number; sgst?: number; igst?: number; total: number },
  accounts: readonly GstAccountLike[],
  opts: GstLegOptions = {},
): GstLeg[] {
  const totalP = toPaise(parts.total || 0);
  if (!(totalP > 0)) return [];
  const combined: GstLeg[] = [{ accountId: GST_COMBINED_ID[side], amount: totalP / 100, head: 'combined' }];
  if (opts.legacy) return combined;
  const paise = HEADS.map((h) => toPaise(parts[h] || 0));
  if (paise.some((p) => p < 0) || paise.reduce((s, p) => s + p, 0) !== totalP) return combined;
  const legs: GstLeg[] = [];
  for (let i = 0; i < HEADS.length; i++) {
    if (paise[i] === 0) continue;
    const accountId = gstHeadAccountId(side, HEADS[i], accounts, opts.unavailableIds);
    if (!accountId) return combined;
    legs.push({ accountId, amount: paise[i] / 100, head: HEADS[i] });
  }
  return legs.length ? legs : combined;
}

/** Halves a State-internal tax into CGST + SGST in exact paise (the odd paisa goes to SGST). */
export function halveIntraStateGst(total: number): { cgst: number; sgst: number; igst: number; total: number } {
  const t = toPaise(total || 0);
  const c = Math.floor(t / 2);
  return { cgst: c / 100, sgst: (t - c) / 100, igst: 0, total: t / 100 };
}

/** Short narration for a GST leg. */
export const gstLegLabel = (side: GstSide, leg: GstLeg): string =>
  leg.head === 'combined' ? (side === 'output' ? 'GST' : 'GST ITC') : `${side === 'output' ? 'Output' : 'Input'} ${leg.head.toUpperCase()}`;

/**
 * Inter-godown transfer (ECR-20 warehouse). Moves stock from one godown to another WITHOUT
 * changing society-wide stock. Modelled as a pair of `adjustment` movements so NONE of the ~6
 * stock-formula implementations (RULE-2) need to change:
 *   • OUT leg — a NEGATIVE adjustment at the source godown → the formula subtracts it.
 *   • IN  leg — a POSITIVE adjustment at the destination godown → the formula adds it.
 * The two net to zero society-wide (total stock unchanged) while per-godown balances shift.
 * Both legs share a TRF/ reference so the pair is identifiable in the stack card / audit.
 *
 * A dedicated 'transfer' movement type is a future refinement; reusing 'adjustment' keeps the
 * canonical formula (and its many call sites) untouched, which is the whole point.
 *
 * Pure module: no React, no I/O — unit-tested by scripts/test-godown-transfer.mjs.
 */
export interface TransferValidateInput {
  fromGodownId: string;
  toGodownId: string;
  qty: number;
  availableQty: number; // on-hand at the source godown
}

export interface TransferValidation {
  ok: boolean;
  error?: string;
}

/** Validate a transfer request (Hindi-first error). */
export function validateTransfer(input: TransferValidateInput): TransferValidation {
  if (!input.fromGodownId || !input.toGodownId) return { ok: false, error: 'स्रोत और गंतव्य गोदाम चुनें।' };
  if (input.fromGodownId === input.toGodownId) return { ok: false, error: 'स्रोत और गंतव्य गोदाम अलग होने चाहिए।' };
  if (!(input.qty > 0)) return { ok: false, error: 'मात्रा 0 से अधिक होनी चाहिए।' };
  if (input.qty > input.availableQty) return { ok: false, error: `स्रोत गोदाम में केवल ${input.availableQty} उपलब्ध है।` };
  return { ok: true };
}

export interface TransferLegsInput {
  itemId: string;
  fromGodownId: string;
  toGodownId: string;
  qty: number;
  rate: number;       // avg cost — moves value with the qty (for godown-wise valuation)
  date: string;
  transferNo: string; // shared reference (e.g. "TRF/1")
  fromLabel?: string; // godown names for the narration
  toLabel?: string;
}

/** A transfer leg = the data for one stock movement (id/createdAt stamped by the caller). */
export interface TransferLeg {
  date: string;
  itemId: string;
  type: 'adjustment';
  qty: number;         // negative for OUT, positive for IN
  rate: number;
  amount: number;
  referenceNo: string;
  narration: string;
  godownId: string;
}

/** Build the [OUT, IN] movement pair for a transfer. */
export function buildTransferLegs(input: TransferLegsInput): [TransferLeg, TransferLeg] {
  const q = Math.abs(input.qty);
  const from = input.fromLabel || input.fromGodownId;
  const to = input.toLabel || input.toGodownId;
  const common = { date: input.date, itemId: input.itemId, type: 'adjustment' as const, rate: input.rate, amount: q * input.rate, referenceNo: input.transferNo };
  const out: TransferLeg = { ...common, qty: -q, godownId: input.fromGodownId, narration: `गोदाम स्थानांतरण (जावक) → ${to}` };
  const inn: TransferLeg = { ...common, qty: q, godownId: input.toGodownId, narration: `गोदाम स्थानांतरण (आवक) ← ${from}` };
  return [out, inn];
}

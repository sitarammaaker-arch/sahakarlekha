/**
 * Inter-branch accounting (ECR-17 Phase 2).
 *
 * A transfer of funds between two branches posts TWO branch-stamped, self-balancing
 * vouchers through an Inter-Branch Control account:
 *   From branch:  Dr Inter-Branch Control / Cr Cash-Bank
 *   To branch:    Dr Cash-Bank            / Cr Inter-Branch Control
 * Each leg balances (Dr = Cr) within its branch, and CONSOLIDATED the control
 * account nets to zero (from Dr = to Cr) and the cash-bank nets to zero (money just
 * moved within the society). Pure & tested by scripts/test-inter-branch.mjs.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;

export const INTER_BRANCH_CONTROL_ID = '2110';

export interface TransferLine { accountId: string; type: 'Dr' | 'Cr'; amount: number }
export interface TransferLeg { branchId: string; lines: TransferLine[] }

/** Build the two branch-stamped legs of an inter-branch transfer. */
export function buildInterBranchTransfer(input: {
  fromBranchId: string;
  toBranchId: string;
  amount: number;
  fromAccountId: string;   // cash/bank the FROM branch pays out of
  toAccountId: string;     // cash/bank the TO branch receives into
  controlAccountId?: string;
}): { from: TransferLeg; to: TransferLeg } {
  const amt = r2(Math.max(0, input.amount || 0));
  const control = input.controlAccountId || INTER_BRANCH_CONTROL_ID;
  return {
    from: { branchId: input.fromBranchId, lines: [
      { accountId: control, type: 'Dr', amount: amt },
      { accountId: input.fromAccountId, type: 'Cr', amount: amt },
    ] },
    to: { branchId: input.toBranchId, lines: [
      { accountId: input.toAccountId, type: 'Dr', amount: amt },
      { accountId: control, type: 'Cr', amount: amt },
    ] },
  };
}

const legDr = (leg: TransferLeg) => r2(leg.lines.filter(l => l.type === 'Dr').reduce((s, l) => s + l.amount, 0));
const legCr = (leg: TransferLeg) => r2(leg.lines.filter(l => l.type === 'Cr').reduce((s, l) => s + l.amount, 0));

/** True when each leg balances (Dr = Cr). */
export function legsBalanced(t: { from: TransferLeg; to: TransferLeg }): boolean {
  return legDr(t.from) === legCr(t.from) && legDr(t.to) === legCr(t.to);
}

/** Net movement of the control account across both legs — should be 0 consolidated. */
export function controlNet(t: { from: TransferLeg; to: TransferLeg }, controlAccountId = INTER_BRANCH_CONTROL_ID): number {
  let net = 0;
  for (const leg of [t.from, t.to]) {
    for (const l of leg.lines) {
      if (l.accountId === controlAccountId) net += l.type === 'Dr' ? l.amount : -l.amount;
    }
  }
  return r2(net);
}

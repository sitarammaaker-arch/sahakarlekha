/**
 * Marketing D2a — bardana (gunny bag) COUNT register. Founder 2026-10-25: a register only, no ledger
 * posting; the bag cost recovered from farmers, when any, is a per-bag deduction rule. PURE.
 * 'in'  = bags received by the society (from the agency, or returned by a farmer / arhtiya);
 * 'out' = bags handed out (to a farmer / arhtiya for filling, or back to the agency).
 */
export type BardanaParty = 'agency' | 'farmer' | 'arhtiya' | 'other';

export interface BardanaMovement {
  id: string;
  date: string;              // YYYY-MM-DD
  bardanaTypeId?: string;
  direction: 'in' | 'out';
  partyType: BardanaParty;
  partyId?: string;
  partyName?: string;
  lotId?: string;
  bags: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BardanaPartyRow { partyType: BardanaParty; partyId: string; partyName?: string; issued: number; received: number; balance: number }

/**
 * Per-party balance. For a farmer / arhtiya: bags they still hold = out − in. For the agency: bags the
 * society still owes back = in − out. Stock in hand (society) = Σ in − Σ out over everyone.
 */
export function bardanaBalances(movements: ReadonlyArray<BardanaMovement>): { parties: BardanaPartyRow[]; inHand: number } {
  const map = new Map<string, BardanaPartyRow>();
  let inHand = 0;
  for (const m of movements) {
    const n = Math.max(0, Math.trunc(Number(m.bags) || 0));
    if (!n) continue;
    inHand += m.direction === 'in' ? n : -n;
    const key = `${m.partyType}|${m.partyId || m.partyName || ''}`;
    const row = map.get(key) ?? { partyType: m.partyType, partyId: m.partyId || '', partyName: m.partyName, issued: 0, received: 0, balance: 0 };
    if (m.direction === 'out') row.issued += n; else row.received += n;
    row.balance = m.partyType === 'agency' ? row.received - row.issued : row.issued - row.received;
    map.set(key, row);
  }
  return { parties: [...map.values()].filter(r => r.issued || r.received), inHand };
}

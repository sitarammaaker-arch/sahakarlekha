/**
 * Federation graph — typed cooperative tiers (T-34 / ADR-0009; INV-6; IRR-4).
 *
 * PURE. A national cooperative ERP is a network of networks: primary societies roll up into a
 * district/DCCB, districts into a state/apex, states into the national federation. This module is
 * the SSOT for that graph and its traversals — the structure consolidation rolls UP and data
 * governance scopes DOWN (ADR-0009).
 *
 *   validateGraph — the tier order is real: no cycles, every parent exists, and a child's tier is
 *                   STRICTLY BELOW its parent's (a primary rolls up into a district, never the
 *                   reverse). A malformed pyramid is rejected, not silently consolidated.
 *   descendants / subtree / ancestorPath — the roll-up scope and lineage.
 *
 * The live `societies`-table graph is the wire layer; the algebra is here. No I/O; deterministic.
 */

export type FederationTier = 'primary' | 'district' | 'state' | 'national';
const TIER_RANK: Record<FederationTier, number> = { primary: 0, district: 1, state: 2, national: 3 };

export interface FederationNode {
  id: string;
  tier: FederationTier;
  jurisdiction: string;
  /** The parent-tier node this rolls up into (absent for the apex/national root). */
  parentId?: string;
}

export interface GraphVerdict {
  ok: boolean;
  problems: string[];
}

/**
 * PURE — validate the federation graph (INV-6). Rejects: a duplicate id; a parentId that doesn't
 * exist; a child whose tier is not strictly below its parent's (the pyramid must point up); and any
 * cycle in the parent chain.
 */
export function validateGraph(nodes: readonly FederationNode[]): GraphVerdict {
  const problems: string[] = [];
  const byId = new Map<string, FederationNode>();
  for (const n of nodes) {
    if (byId.has(n.id)) problems.push(`duplicate node id "${n.id}"`);
    byId.set(n.id, n);
  }
  for (const n of nodes) {
    if (n.parentId == null) continue;
    const parent = byId.get(n.parentId);
    if (!parent) { problems.push(`node "${n.id}" has unknown parent "${n.parentId}"`); continue; }
    if (TIER_RANK[n.tier] >= TIER_RANK[parent.tier]) {
      problems.push(`node "${n.id}" (${n.tier}) must roll up into a HIGHER tier, not "${parent.id}" (${parent.tier})`);
    }
  }
  // Cycle detection via parent-chain walk, bounded by node count.
  for (const start of nodes) {
    const seen = new Set<string>();
    let cur: FederationNode | undefined = start;
    while (cur && cur.parentId != null) {
      if (seen.has(cur.id)) { problems.push(`cycle detected at node "${cur.id}"`); break; }
      seen.add(cur.id);
      cur = byId.get(cur.parentId);
    }
  }
  return { ok: problems.length === 0, problems };
}

function childrenMap(nodes: readonly FederationNode[]): Map<string, FederationNode[]> {
  const m = new Map<string, FederationNode[]>();
  for (const n of nodes) {
    if (n.parentId == null) continue;
    const arr = m.get(n.parentId) ?? [];
    arr.push(n);
    m.set(n.parentId, arr);
  }
  return m;
}

/** PURE — every node that rolls up into `rootId` (its descendant subtree), excluding the root. */
export function descendants(nodes: readonly FederationNode[], rootId: string): FederationNode[] {
  const children = childrenMap(nodes);
  const out: FederationNode[] = [];
  const stack = [...(children.get(rootId) ?? [])];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (seen.has(n.id)) continue; // guard against a malformed cyclic graph
    seen.add(n.id);
    out.push(n);
    for (const c of children.get(n.id) ?? []) stack.push(c);
  }
  return out;
}

/** PURE — the consolidation scope: the root node plus all its descendants (the subtree to roll up). */
export function subtree(nodes: readonly FederationNode[], rootId: string): FederationNode[] {
  const root = nodes.find((n) => n.id === rootId);
  return root ? [root, ...descendants(nodes, rootId)] : [];
}

/** PURE — the lineage from a node up to the apex (its consolidation ancestors, nearest first). */
export function ancestorPath(nodes: readonly FederationNode[], nodeId: string): FederationNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: FederationNode[] = [];
  const seen = new Set<string>();
  let cur = byId.get(nodeId);
  while (cur && cur.parentId != null) {
    if (seen.has(cur.id)) break;
    seen.add(cur.id);
    const parent = byId.get(cur.parentId);
    if (!parent) break;
    out.push(parent);
    cur = parent;
  }
  return out;
}

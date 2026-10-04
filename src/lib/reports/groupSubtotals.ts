/**
 * PURE — roll flat statement lines up into Head / Sub-head groups with subtotals (the Balance Sheet's
 * presentation), for the statements that print a flat list (Income & Expenditure, Trading, Receipts &
 * Payments, Trial Balance).
 *
 * Presentation only: every input line is emitted exactly once with its own amount, so the statement's
 * totals do not change; a group row's amount is the sum of the lines beneath it, to any depth. The group
 * chain comes from the chart of accounts (`parentId`). Lines without a known group stay loose: those that
 * came BEFORE the first grouped line (e.g. "Gross Profit from Trading") are printed first, the rest last.
 * Groups print in chart order. Group rows that would only repeat a root head (`rootIds`) are skipped.
 */

export interface GroupableLine {
  name: string;
  amount: number;
  parentId?: string;
  /** Further figures that roll up the same way (e.g. a Trial Balance's opening / debit / credit). */
  vals?: number[];
}
export interface ChartNode { id: string; name: string; parentId?: string; isGroup?: boolean }

export interface GroupedRow<T extends GroupableLine = GroupableLine> {
  kind: 'group' | 'item';
  name: string;
  amount: number;
  depth: number;          // 0 = top level; items inside a group are depth + 1
  vals?: number[];        // groups: element-wise sum of the lines beneath; items: the line's own
  line?: T;               // the original line (items only)
  groupId?: string;       // groups only
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function groupWithSubtotals<T extends GroupableLine>(
  lines: readonly T[],
  chart: readonly ChartNode[] | undefined,
  rootIds: readonly string[],
): GroupedRow<T>[] {
  const byId = new Map((chart ?? []).map((a, i) => [a.id, { a, i }]));
  const roots = new Set(rootIds);

  // chain of group ids from the outermost sub-group down to the line's own parent
  const chainOf = (parentId?: string): string[] => {
    const chain: string[] = [];
    let cur = parentId;
    const seen = new Set<string>();
    while (cur && !roots.has(cur) && byId.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      chain.unshift(cur);
      cur = byId.get(cur)!.a.parentId;
    }
    return chain;
  };

  interface Node { id: string; items: T[]; kids: Map<string, Node>; }
  const top = new Map<string, Node>();
  const loose: { line: T; idx: number }[] = [];
  let firstGrouped = -1;
  lines.forEach((line, idx) => {
    const chain = chainOf(line.parentId);
    if (chain.length === 0) { loose.push({ line, idx }); return; }
    if (firstGrouped < 0) firstGrouped = idx;
    let level = top;
    let node: Node | undefined;
    for (const gid of chain) {
      node = level.get(gid) ?? { id: gid, items: [], kids: new Map() };
      level.set(gid, node);
      level = node.kids;
    }
    node!.items.push(line);
  });

  const sumVals = (n: Node): number[] | undefined => {
    const parts: number[][] = [];
    n.items.forEach(l => { if (l.vals) parts.push(l.vals); });
    [...n.kids.values()].forEach(k => { const v = sumVals(k); if (v) parts.push(v); });
    if (parts.length === 0) return undefined;
    return parts[0].map((_, i) => r2(parts.reduce((s, p) => s + (p[i] || 0), 0)));
  };
  const total = (n: Node): number => r2(n.items.reduce((s, l) => s + l.amount, 0) + [...n.kids.values()].reduce((s, k) => s + total(k), 0));
  const order = (m: Map<string, Node>) => [...m.values()].sort((x, y) => (byId.get(x.id)?.i ?? 0) - (byId.get(y.id)?.i ?? 0));

  const out: GroupedRow<T>[] = [];
  const emitLoose = (l: { line: T }) => out.push({ kind: 'item', name: l.line.name, amount: l.line.amount, depth: 0, vals: l.line.vals, line: l.line });
  const emit = (n: Node, depth: number) => {
    out.push({ kind: 'group', name: byId.get(n.id)!.a.name, amount: total(n), depth, groupId: n.id, vals: sumVals(n) });
    n.items.forEach(l => out.push({ kind: 'item', name: l.name, amount: l.amount, depth: depth + 1, vals: l.vals, line: l }));
    order(n.kids).forEach(k => emit(k, depth + 1));
  };

  loose.filter(l => firstGrouped < 0 || l.idx < firstGrouped).forEach(emitLoose);
  order(top).forEach(n => emit(n, 0));
  loose.filter(l => firstGrouped >= 0 && l.idx > firstGrouped).forEach(emitLoose);
  return out;
}

/**
 * Form 16A statement rows (report leftovers after RPT-15, 2026-11-21).
 *
 * The page listed only TDS on PURCHASES, grouped deductees by NAME, and showed no challan. A Form 16A statement is
 * every non-salary deduction for the deductee in the year, with the challan it was deposited under. This builds
 * those rows from purchases + the manual TDS register entries (tds_entries) and resolves each row's challan through
 * tds_challan_links (keyed on the entry id: `pur-<purchaseId>` for a purchase, the entry's own id otherwise — the
 * same keys the TDS Register writes).
 *
 * Salary TDS (section 192) is excluded: it belongs to Form 16, not 16A.
 */
export interface F16Purchase {
  id: string; date: string; purchaseNo?: string; supplierId?: string; supplierName: string;
  netAmount: number; tdsPct: number; tdsAmount: number; isDeleted?: boolean;
}
export interface F16Party { section: string; deducteePan: string }
export interface F16Manual {
  id: string; date: string; deducteeName: string; deducteePan?: string; section: string; natureOfPayment?: string;
  grossAmount: number; tdsRate: number; tdsAmount: number; purchaseId?: string; isDeleted?: boolean;
}
export interface F16Challan { id: string; bsrCode: string; challanDate: string; challanSerial: string; isDeleted?: boolean }
export interface F16Link { entryId: string; challanId: string }

export interface Form16aRow {
  entryId: string;
  source: 'purchase' | 'manual';
  date: string;
  docNo: string;
  /** Stable grouping key: the supplier id, else the PAN, else the name (two suppliers with one name stay apart). */
  deducteeKey: string;
  deducteeName: string;
  deducteePan: string;
  section: string;
  grossAmount: number;
  tdsPct: number;
  tdsAmount: number;
  challan: { bsrCode: string; challanDate: string; challanSerial: string } | null;
}

const isSalary = (section: string) => /^192/.test(String(section || '').trim());

export function deducteeKeyOf(supplierId: string | undefined, pan: string | undefined, name: string): string {
  if (supplierId) return `id:${supplierId}`;
  const p = String(pan || '').trim().toUpperCase();
  if (/^[A-Z]{5}\d{4}[A-Z]$/.test(p)) return `pan:${p}`;
  return `name:${String(name || '').trim().toLowerCase()}`;
}

export function buildForm16aRows(input: {
  purchases: F16Purchase[];
  partyOf: (p: F16Purchase) => F16Party;
  manual: F16Manual[];
  challans: F16Challan[];
  links: F16Link[];
  from: string;
  to: string;
}): Form16aRow[] {
  const { purchases, partyOf, manual, challans, links, from, to } = input;
  const liveChallan = new Map(challans.filter((c) => !c.isDeleted).map((c) => [c.id, c]));
  const challanOf = (entryId: string) => {
    const l = links.find((x) => x.entryId === entryId);
    const c = l ? liveChallan.get(l.challanId) : undefined;
    return c ? { bsrCode: c.bsrCode, challanDate: c.challanDate, challanSerial: c.challanSerial } : null;
  };
  const inYear = (d: string) => d >= from && d <= to;
  const rows: Form16aRow[] = [];
  const purchaseIds = new Set<string>();
  for (const p of purchases) {
    if (p.isDeleted || !inYear(p.date) || !(p.tdsAmount > 0)) continue;
    const party = partyOf(p);
    if (isSalary(party.section)) continue;
    purchaseIds.add(p.id);
    rows.push({
      entryId: `pur-${p.id}`, source: 'purchase', date: p.date, docNo: p.purchaseNo || p.id.slice(-6),
      deducteeKey: deducteeKeyOf(p.supplierId, party.deducteePan, p.supplierName), deducteeName: p.supplierName,
      deducteePan: party.deducteePan, section: party.section, grossAmount: p.netAmount, tdsPct: p.tdsPct, tdsAmount: p.tdsAmount,
      challan: challanOf(`pur-${p.id}`),
    });
  }
  for (const m of manual) {
    if (m.isDeleted || !inYear(m.date) || !(m.tdsAmount > 0) || isSalary(m.section)) continue;
    if (m.purchaseId && purchaseIds.has(m.purchaseId)) continue;   // a manual mirror of a purchase is not counted twice
    rows.push({
      entryId: m.id, source: 'manual', date: m.date, docNo: m.natureOfPayment || '—',
      deducteeKey: deducteeKeyOf(undefined, m.deducteePan, m.deducteeName), deducteeName: m.deducteeName,
      deducteePan: String(m.deducteePan || '').toUpperCase(), section: m.section, grossAmount: m.grossAmount, tdsPct: m.tdsRate,
      tdsAmount: m.tdsAmount, challan: challanOf(m.id),
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.entryId.localeCompare(b.entryId));
}

export interface Form16aGroup { key: string; name: string; pan: string; rows: Form16aRow[]; gross: number; tds: number }

/** Group rows by deductee key; the label is the latest name used, sorted by name. */
export function groupForm16a(rows: Form16aRow[]): Form16aGroup[] {
  const map = new Map<string, Form16aGroup>();
  for (const r of rows) {
    const g = map.get(r.deducteeKey) ?? { key: r.deducteeKey, name: r.deducteeName, pan: r.deducteePan, rows: [], gross: 0, tds: 0 };
    g.rows.push(r);
    g.name = r.deducteeName || g.name;
    g.pan = r.deducteePan || g.pan;
    g.gross = Math.round((g.gross + r.grossAmount) * 100) / 100;
    g.tds = Math.round((g.tds + r.tdsAmount) * 100) / 100;
    map.set(r.deducteeKey, g);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

export const challanLabel = (c: Form16aRow['challan']): string =>
  c ? `BSR ${c.bsrCode} · ${c.challanDate} · ${c.challanSerial || '-'}` : 'Not linked to a challan';

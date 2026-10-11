/**
 * Balance Sheet LAYOUT — the rows the Balance Sheet page, its PDF and its Excel/CSV all print (RULE 2: one
 * presentation, three outputs; the PDF used to rebuild its own grouping and the export its own rows).
 *
 * Presentation follows the society's CA-audited balance sheet (2026-10-11, Rania FY 2023-24 / 2024-25) and
 * NABARD CAS Annexure IV:
 *  • two money columns: `line` rows carry the AMOUNT column, the head total goes on the head's LAST line
 *    (CA style). A sub-group is ONE line (its subtotal); its ledgers are `detail` rows, printed only in
 *    "full detail" in a separate DETAIL column — so no column ever holds a subtotal and its own parts.
 *  • fixed assets net of depreciation: the accumulated-depreciation contra stays with the fixed assets as
 *    "Less:" lines (balanceSheetLeaves keeps it on the asset side).
 *  • ONE profit & loss line: the brought-forward balance (1208, either side) + this year's result, inside the
 *    reserves head ("Add: Net Profit" in the CA's sheet). A loss shows as a "Less:" line there — the totals
 *    are exactly the app's (where a loss sits, CA vs CAS style, is a pending CA question; phase B).
 *  • the unposted closing stock (inventory-valued) is a line of the Inventory head, never a loose row.
 *  • a balance shown on the side opposite its type (a creditor gone Dr, an asset gone Cr) is a line named
 *    after its immediate sub-group ("Market Supplier Kharia (Dr शेष)") with its ledgers as details — in the
 *    ⚠ reversed-balance head when it looks like an error, else in Current Assets / Current Liabilities.
 * Every leaf lands in exactly one section; side totals == balanceSheetLeaves totals (pinned by tests).
 * PURE.
 */
import type { AccountBalance, LedgerAccount } from '@/types';
import { isAbnormalBalance } from '@/lib/abnormalBalance';
import { isAccumulatedDepreciation } from '@/lib/balanceSheetLeaves';

export interface BsRow {
  key: string;
  /** line → AMOUNT column (summed into the head total); detail → DETAIL column (full detail only, never summed). */
  kind: 'line' | 'detail';
  label: string;
  labelHi: string;
  amount: number;          // side-positive (a Cr balance is positive on the liability side)
  py: number;              // prior-year, same sign convention
  depth: number;           // detail indent (1 = directly under the line)
  accountId?: string;      // a ledger → clickable
  /** less = a deduction line (depreciation, a loss); subhead = a nested group heading among details (amount = its subtotal). */
  tone?: 'less' | 'subhead';
}
export interface BsSection { id: string; title: string; titleHi: string; rows: BsRow[]; total: number; pyTotal: number; warn?: boolean }
export interface BsSide { sections: BsSection[]; total: number; pyTotal: number }
export interface BsLayout { liabilities: BsSide; assets: BsSide; profitAndLoss: number; /** the bridged opening gap (Dr − Cr), 0 when none */ openingDifference: number }

export interface BsLayoutInput {
  accounts: readonly LedgerAccount[];
  assetLeaves: readonly AccountBalance[];
  capLiabLeaves: readonly AccountBalance[];
  unpostedStock: number;
  netProfit: number;
  /** Prior-year balances by account id, Dr positive / Cr negative (as getTrialBalance's netBalance). */
  py?: Record<string, number>;
  /** Prior year's result (Cr positive) — so the prior-year P&L line, and the comparative totals, tie. */
  pyNetProfit?: number;
  /** Σ opening Dr − Σ opening Cr of all ledgers. Non-zero ⇒ a Tally-style "Difference in opening balances" line on
   *  the short side, so the gap is SHOWN as such instead of an unexplained mismatch (2026-10-11). The dashboards'
   *  tally (balanceSheetTallied) does not use it — a sheet with an opening gap still reads "not balanced" there. */
  openingDifference?: number;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const isSurplus = (a: { id: string; subtype?: string }) => a.subtype === 'surplus' || a.id === '1208';
const HEAD_NAMES: Record<string, { en: string; hi: string }> = {
  '3400': { en: 'Closing Stock', hi: 'समापन माल' },
  '3300': { en: 'Current Assets & Cash/Bank', hi: 'चालू संपत्ति एवं नकद/बैंक' },
};

function buildSide(
  input: BsLayoutInput, leaves: readonly AccountBalance[], tops: string[], liab: boolean,
): { sections: BsSection[]; byGroup: Map<string, BsSection> } {
  const sign = liab ? -1 : 1;
  const py = input.py ?? {};
  const amt = (b: AccountBalance) => r2(sign * b.netBalance);
  const pyOf = (id: string) => r2(sign * (py[id] ?? 0)) || 0;
  const nz = (b: AccountBalance) => Math.abs(b.netBalance) >= 0.005 || Math.abs(py[b.account.id] ?? 0) >= 0.005;
  const live = leaves.filter(nz);
  const kids = (parentId: string) => input.accounts.filter((a) => a.isGroup && a.parentId === parentId);
  const leafRows = (parentId: string) => live.filter((b) => b.account.parentId === parentId && !b.account.isGroup);
  const captured = new Set<string>();
  const nameOf = (a: { name: string; nameHi?: string }) => ({ label: a.name, labelHi: a.nameHi || a.name });

  // Sum (and py) of every live leaf under a group, any depth.
  const tree = (gid: string): { amount: number; py: number; has: boolean } => {
    let amount = 0, p = 0, has = false;
    for (const b of leafRows(gid)) { amount += amt(b); p += pyOf(b.account.id); has = true; }
    for (const g of kids(gid)) { const t = tree(g.id); amount += t.amount; p += t.py; has = has || t.has; }
    return { amount: r2(amount), py: r2(p), has };
  };
  // Details of a sub-group: its ledgers, then each nested group as a subhead + its own details.
  const details = (gid: string, depth: number): BsRow[] => {
    const out: BsRow[] = [];
    for (const b of leafRows(gid)) {
      captured.add(b.account.id);
      out.push({ key: `d-${b.account.id}`, kind: 'detail', ...nameOf(b.account), amount: amt(b), py: pyOf(b.account.id), depth, accountId: b.account.id });
    }
    for (const g of kids(gid)) {
      const t = tree(g.id);
      if (!t.has) continue;
      out.push({ key: `s-${g.id}`, kind: 'detail', tone: 'subhead', ...nameOf(g), amount: t.amount, py: t.py, depth });
      out.push(...details(g.id, depth + 1));
    }
    return out;
  };
  const lessLabel = (a: { name: string; nameHi?: string }) => ({ label: `Less: ${a.name}`, labelHi: `घटाएँ: ${a.nameHi || a.name}` });

  const byGroup = new Map<string, BsSection>();
  const sections: BsSection[] = [];
  for (const group of input.accounts.filter((a) => a.isGroup && tops.includes(a.parentId || ''))) {
    const rows: BsRow[] = [];
    // Direct ledgers — a depreciation contra goes after the cost lines, as "Less:".
    const direct = leafRows(group.id);
    const contra = direct.filter((b) => !liab && isAccumulatedDepreciation(b.account) && b.netBalance <= 0);
    for (const b of direct.filter((x) => !contra.includes(x))) {
      captured.add(b.account.id);
      rows.push({ key: `l-${b.account.id}`, kind: 'line', ...nameOf(b.account), amount: amt(b), py: pyOf(b.account.id), depth: 0, accountId: b.account.id });
    }
    // Sub-groups — one line each (the subtotal), its ledgers as details.
    for (const g of kids(group.id)) {
      const t = tree(g.id);
      if (!t.has) continue;
      rows.push({ key: `g-${g.id}`, kind: 'line', ...nameOf(g), amount: t.amount, py: t.py, depth: 0 });
      rows.push(...details(g.id, 1));
    }
    for (const b of contra) {
      captured.add(b.account.id);
      rows.push({ key: `l-${b.account.id}`, kind: 'line', tone: 'less', ...lessLabel(b.account), amount: amt(b), py: pyOf(b.account.id), depth: 0, accountId: b.account.id });
    }
    const named = HEAD_NAMES[group.id];
    const sec: BsSection = { id: group.id, title: named?.en ?? group.name, titleHi: named?.hi ?? (group.nameHi || group.name), rows, total: 0, pyTotal: 0 };
    byGroup.set(group.id, sec);
    sections.push(sec);
  }

  // Leaves no head captured — mostly balances shown on the side opposite their type (balanceSheetLeaves'
  // sign rule: a creditor gone Dr on the asset side, an asset gone Cr on the liability side). Never dropped.
  // 2026-10-11 (founder): such a ledger is shown under its IMMEDIATE sub-group's name with that sub-group's
  // total on this side ("Market Supplier Kharia (Dr शेष)"), its ledgers as details — not a loose row:
  //  • a reversed (error-looking) balance → inside the "⚠ reversed balance" head, still grouped;
  //  • an intentional one (a ₹0-opening contra, an advance built up by vouchers) → a line of the current
  //    head (Current Assets 3300 / Current Liabilities 2100; its own head when the chart has none).
  // Anything else unclaimed (a ledger with no parent group on this side's tree) stays under "Other".
  const orphans = live.filter((b) => !captured.has(b.account.id));
  const orphanLine = (b: AccountBalance): BsRow => ({ key: `l-${b.account.id}`, kind: 'line', ...nameOf(b.account), amount: amt(b), py: pyOf(b.account.id), depth: 0, accountId: b.account.id });
  const flipped = (b: AccountBalance) => (liab ? b.account.type === 'asset' : b.account.type === 'liability' || b.account.type === 'equity');
  const parentGroup = (b: AccountBalance) => input.accounts.find((a) => a.isGroup && a.id === b.account.parentId);
  const suffix = liab ? { en: 'Cr balances', hi: 'Cr शेष' } : { en: 'Dr balances', hi: 'Dr शेष' };
  // One line per immediate parent sub-group (its total on this side) + its ledgers as details; no parent → own line.
  const bySubGroup = (list: AccountBalance[], tag: string): BsRow[] => {
    const out: BsRow[] = [];
    const order: string[] = [];
    const groups = new Map<string, AccountBalance[]>();
    for (const b of list) {
      const g = parentGroup(b);
      if (!g) { captured.add(b.account.id); out.push(orphanLine(b)); continue; }
      if (!groups.has(g.id)) { groups.set(g.id, []); order.push(g.id); }
      groups.get(g.id)!.push(b);
    }
    for (const gid of order) {
      const g = input.accounts.find((a) => a.id === gid)!;
      const members = groups.get(gid)!;
      out.push({ key: `f-${tag}-${gid}`, kind: 'line', label: `${g.name} (${suffix.en})`, labelHi: `${g.nameHi || g.name} (${suffix.hi})`,
        amount: r2(members.reduce((t, b) => t + amt(b), 0)), py: r2(members.reduce((t, b) => t + pyOf(b.account.id), 0)), depth: 0 });
      for (const b of members) {
        captured.add(b.account.id);
        out.push({ key: `d-${b.account.id}`, kind: 'detail', ...nameOf(b.account), amount: amt(b), py: pyOf(b.account.id), depth: 1, accountId: b.account.id });
      }
    }
    return out;
  };
  const reversed = orphans.filter((b) => isAbnormalBalance(b.account, b.netBalance));
  if (reversed.length) sections.push({ id: 'reversed', title: '⚠ Accounts with a reversed balance — check', titleHi: '⚠ उलटे शेष वाले खाते — जाँचें', rows: bySubGroup(reversed, 'rev'), total: 0, pyTotal: 0, warn: true });
  const intentional = orphans.filter((b) => !reversed.includes(b) && flipped(b));
  if (intentional.length) {
    const rows = bySubGroup(intentional, 'cur');
    const home = byGroup.get(liab ? '2100' : '3300');
    if (home) home.rows.push(...rows);
    else sections.push({ id: liab ? 'cur-liab' : 'cur-asset', title: liab ? 'Current Liabilities' : 'Current Assets', titleHi: liab ? 'चालू देनदारियाँ' : 'चालू संपत्ति', rows, total: 0, pyTotal: 0 });
  }
  const other = orphans.filter((b) => !reversed.includes(b) && !intentional.includes(b));
  if (other.length) sections.push({ id: 'other', title: 'Other', titleHi: 'अन्य', rows: other.map(orphanLine), total: 0, pyTotal: 0 });
  return { sections, byGroup };
}

const finish = (sections: BsSection[]): BsSide => {
  const kept = sections.filter((s) => s.rows.some((r) => r.kind === 'line'));
  for (const s of kept) {
    const lines = s.rows.filter((r) => r.kind === 'line');
    s.total = r2(lines.reduce((t, r) => t + r.amount, 0));
    s.pyTotal = r2(lines.reduce((t, r) => t + r.py, 0));
  }
  return { sections: kept, total: r2(kept.reduce((t, s) => t + s.total, 0)), pyTotal: r2(kept.reduce((t, s) => t + s.pyTotal, 0)) };
};

export function buildBalanceSheetLayout(input: BsLayoutInput): BsLayout {
  const py = input.py ?? {};
  // ONE profit & loss figure: the brought-forward balance (either side) + this year's result.
  const surplusLeaves = [...input.capLiabLeaves, ...input.assetLeaves].filter((b) => isSurplus(b.account));
  const bf = r2(surplusLeaves.reduce((t, b) => t - b.netBalance, 0));
  const pyBf = r2(surplusLeaves.reduce((t, b) => t - (py[b.account.id] ?? 0), 0));
  const profitAndLoss = r2(bf + input.netProfit);
  const pyPL = r2(pyBf + (input.pyNetProfit ?? 0));

  const liab = buildSide(input, input.capLiabLeaves.filter((b) => !isSurplus(b.account)), ['1000', '2000'], true);
  const asset = buildSide(input, input.assetLeaves.filter((b) => !isSurplus(b.account)), ['3000'], false);

  // P&L line — in the head that holds the surplus ledger (Reserves & Surplus), else its own head.
  if (Math.abs(profitAndLoss) >= 0.005 || Math.abs(pyPL) >= 0.005) {
    const home = input.accounts.find((a) => isSurplus(a) && !a.isGroup)?.parentId;
    const homeSec = (home && liab.byGroup.get(home)) || null;
    const loss = profitAndLoss < 0;
    const plRows: BsRow[] = [
      { key: 'pl', kind: 'line', tone: loss ? 'less' : undefined,
        label: loss ? 'Less: Profit & Loss A/c (deficit)' : 'Profit & Loss A/c (balance)',
        labelHi: loss ? 'घटाएँ: लाभ-हानि खाता (घाटा)' : 'लाभ-हानि खाता (शेष)',
        amount: profitAndLoss, py: pyPL, depth: 0, accountId: surplusLeaves[0]?.account.id },
      { key: 'pl-bf', kind: 'detail', label: 'Balance brought forward', labelHi: 'पिछला शेष', amount: bf, py: pyBf, depth: 1 },
      { key: 'pl-cy', kind: 'detail', label: input.netProfit >= 0 ? 'Add: Net profit for the year' : 'Less: Net loss for the year', labelHi: input.netProfit >= 0 ? 'जोड़ें: इस वर्ष का शुद्ध लाभ' : 'घटाएँ: इस वर्ष का शुद्ध घाटा', amount: r2(input.netProfit), py: r2(input.pyNetProfit ?? 0), depth: 1 },
    ];
    if (homeSec) homeSec.rows.push(...plRows);
    else liab.sections.push({ id: 'pl', title: 'Profit & Loss A/c', titleHi: 'लाभ-हानि खाता', rows: plRows, total: 0, pyTotal: 0 });
  }

  // Closing stock valued from inventory — a line of the Inventory head (its own head when the chart has none).
  if (Math.abs(input.unpostedStock) > 0.005) {
    const csRow: BsRow = { key: 'cs', kind: 'line', label: 'Closing stock (inventory + goods put into stock this year)', labelHi: 'समापन माल (इन्वेंट्री + इस वर्ष स्टॉक खाते में आया माल)', amount: r2(input.unpostedStock), py: 0, depth: 0 };
    const inv = asset.byGroup.get('3400');
    if (inv) inv.rows.unshift(csRow);
    else asset.sections.push({ id: '3400', title: 'Closing Stock', titleHi: 'समापन माल', rows: [csRow], total: 0, pyTotal: 0 });
  }

  // Difference in opening balances (Tally) — on the side the gap leaves short: Dr excess ⇒ liability side.
  const od = r2(input.openingDifference ?? 0);
  if (Math.abs(od) >= 0.01) {
    const odSec: BsSection = { id: 'opening-diff', title: 'Difference in opening balances', titleHi: 'ओपनिंग बैलेंस का अंतर', warn: true, total: 0, pyTotal: 0,
      // Openings are the genesis balance, so the prior-year column carries the same gap.
      rows: [{ key: 'od', kind: 'line', label: 'Opening Dr and Cr do not match - correct in Opening Balances', labelHi: 'ओपनिंग Dr और Cr बराबर नहीं - Opening Balances में ठीक करें', amount: Math.abs(od), py: input.py ? Math.abs(od) : 0, depth: 0 }] };
    (od > 0 ? liab : asset).sections.push(odSec);
  }

  return { liabilities: finish(liab.sections), assets: finish(asset.sections), profitAndLoss, openingDifference: Math.abs(od) >= 0.01 ? od : 0 };
}

/** A period's result (Cr positive) from a set of balances — income/expense ledgers, so a prior-year column can
 *  carry its own P&L line and tie (the prior-year snapshot / trial balance holds those ledgers unclosed). */
export function pyResult(balances: Record<string, number>, accounts: readonly LedgerAccount[]): number {
  let t = 0;
  for (const a of accounts) if (!a.isGroup && (a.type === 'income' || a.type === 'expense')) t -= balances[a.id] ?? 0;
  return r2(t);
}

/** The rows a mode prints: summary = lines only; full = lines + their details. */
export const visibleRows = (s: BsSection, full: boolean): BsRow[] => (full ? s.rows : s.rows.filter((r) => r.kind === 'line'));

/** Flat rows for Excel / CSV — [Side, Head, Particulars, Detail, Amount, Head total, Prior year] — the SAME layout. */
export function balanceSheetExportRows(layout: BsLayout, full: boolean, hi: boolean): (string | number)[][] {
  const out: (string | number)[][] = [];
  const side = (name: string, s: BsSide) => {
    for (const sec of s.sections) {
      const rows = visibleRows(sec, full);
      rows.forEach((r, i) => {
        const label = (hi ? r.labelHi : r.label);
        const indent = '  '.repeat(r.kind === 'detail' ? r.depth : 0);
        out.push([name, i === 0 ? (hi ? sec.titleHi : sec.title) : '', indent + label,
          r.kind === 'detail' ? r.amount : '', r.kind === 'line' ? r.amount : '',
          i === rows.length - 1 ? sec.total : '', r.py || '']);
      });
    }
    out.push([name, '', hi ? 'कुल योग' : 'GRAND TOTAL', '', '', s.total, s.pyTotal || '']);
  };
  side(hi ? 'देनदारियाँ' : 'Capital & Liabilities', layout.liabilities);
  side(hi ? 'संपत्तियाँ' : 'Assets', layout.assets);
  return out;
}
export const BS_EXPORT_HEADERS = (hi: boolean, pyLabel: string) => hi
  ? ['पक्ष', 'हेड', 'विवरण', 'ब्योरा', 'राशि', 'हेड योग', `पिछला वर्ष ${pyLabel}`.trim()]
  : ['Side', 'Head', 'Particulars', 'Detail', 'Amount', 'Head total', `Prior year ${pyLabel}`.trim()];

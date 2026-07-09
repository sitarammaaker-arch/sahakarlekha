/**
 * Ledger Hygiene (ECR-28) — pure, tested. A read-only diagnostic that flags problems
 * in the chart of accounts: dangling voucher references, deleted-party accounts that
 * are now safe to remove (or correctly retained per RULE-3), unused heads, duplicate
 * names, empty groups and blank names.
 *
 * The caller (LedgerHygiene page) computes a usage snapshot from context — voucher-line
 * references (via getVoucherLines, incl. legacy Dr/Cr), balances (getAccountBalance) and
 * party links (supplier/customer/department accountId) — and passes it in, so this stays
 * side-effect-free. Mirrors scripts/test-ledger-hygiene.mjs.
 */
import type { LedgerAccount } from '@/types';

export type HygieneSeverity = 'error' | 'warning' | 'cleanup' | 'info';

export type HygieneCategory =
  | 'dangling-reference'   // a voucher line points at an account id that no longer exists
  | 'deleted-removable'    // deleted-party marker account, no live refs, zero balance → safe to remove
  | 'deleted-retained'     // deleted-party marker account still referenced → correctly kept (RULE-3)
  | 'unused-head'          // postable account with no opening balance and no usage
  | 'duplicate-name'       // 2+ accounts share the same name (ambiguity / merge candidate)
  | 'empty-group'          // group/header account with no child
  | 'blank-name';          // missing name or nameHi

export interface HygieneAccountRef {
  id: string;
  name: string;
  detail?: string;   // short context, e.g. "3 voucher ref(s)" / "2× \"Cash\""
}

export interface HygieneFinding {
  category: HygieneCategory;
  severity: HygieneSeverity;
  accounts: HygieneAccountRef[];
}

/** Usage snapshot supplied by the caller (keeps this module free of context/deps). */
export interface LedgerUsage {
  voucherRefCount: Record<string, number>; // accountId → number of live voucher legs referencing it
  balance: Record<string, number>;         // accountId → signed balance (abs is used for the zero test)
  linkedParty: Record<string, string>;     // accountId → party label (supplier/customer/dept) when linked
}

const DELETED_MARKERS = ['[Supplier deleted]', '[Customer deleted]', '[Department deleted]', '[Deleted]', '[हटाया'];
const ZERO = 0.005;
const norm = (s?: string): string => (s || '').trim().toLowerCase();

/** True when a name carries a RULE-3 / synthetic deleted marker. */
export function hasDeletedMarker(...names: (string | undefined)[]): boolean {
  return names.some(n => DELETED_MARKERS.some(m => (n || '').includes(m)));
}

export function analyzeLedgerHygiene(
  accounts: ReadonlyArray<LedgerAccount>,
  usage: LedgerUsage,
): HygieneFinding[] {
  const findings: HygieneFinding[] = [];
  const accountIds = new Set(accounts.map(a => a.id));
  const refCount = (id: string) => usage.voucherRefCount[id] || 0;
  const bal = (id: string) => Math.abs(usage.balance[id] || 0);
  const linked = (id: string) => usage.linkedParty[id];

  // 1. Dangling references — a referenced id with no matching account.
  const dangling = Object.keys(usage.voucherRefCount)
    .filter(id => refCount(id) > 0 && !accountIds.has(id))
    .map(id => ({ id, name: `[Deleted] ${id.slice(0, 8)}…`, detail: `${refCount(id)} voucher ref(s)` }));
  if (dangling.length) findings.push({ category: 'dangling-reference', severity: 'error', accounts: dangling });

  // 2 & 3. Deleted-party marker accounts → removable vs retained.
  const removable: HygieneAccountRef[] = [];
  const retained: HygieneAccountRef[] = [];
  for (const a of accounts) {
    if (!hasDeletedMarker(a.name, a.nameHi)) continue;
    if (refCount(a.id) === 0 && bal(a.id) < ZERO) removable.push({ id: a.id, name: a.name });
    else retained.push({ id: a.id, name: a.name, detail: refCount(a.id) > 0 ? `${refCount(a.id)} voucher ref(s)` : 'non-zero balance' });
  }
  if (removable.length) findings.push({ category: 'deleted-removable', severity: 'cleanup', accounts: removable });
  if (retained.length) findings.push({ category: 'deleted-retained', severity: 'info', accounts: retained });

  // 4. Unused heads — postable (non-group), non-system, no marker, no linked party,
  //    zero opening balance, zero live usage.
  const unused: HygieneAccountRef[] = [];
  for (const a of accounts) {
    if (a.isGroup || a.isSystem) continue;
    if (hasDeletedMarker(a.name, a.nameHi)) continue; // covered by cat 2/3
    if (linked(a.id)) continue;
    const openingZero = Math.abs(a.openingBalance || 0) < ZERO;
    if (refCount(a.id) === 0 && bal(a.id) < ZERO && openingZero) unused.push({ id: a.id, name: a.name });
  }
  if (unused.length) findings.push({ category: 'unused-head', severity: 'warning', accounts: unused });

  // 5. Duplicate names — 2+ non-marker accounts sharing a normalized name.
  const byName = new Map<string, LedgerAccount[]>();
  for (const a of accounts) {
    if (hasDeletedMarker(a.name, a.nameHi)) continue;
    const key = norm(a.name);
    if (!key) continue;
    const group = byName.get(key);
    if (group) group.push(a); else byName.set(key, [a]);
  }
  const dupes: HygieneAccountRef[] = [];
  for (const group of byName.values()) {
    if (group.length > 1) for (const a of group) dupes.push({ id: a.id, name: a.name, detail: `${group.length}× "${a.name}"` });
  }
  if (dupes.length) findings.push({ category: 'duplicate-name', severity: 'warning', accounts: dupes });

  // 6. Empty groups — group/header with no child (no account has parentId === its id).
  const parentIds = new Set(accounts.map(a => a.parentId).filter(Boolean) as string[]);
  const emptyGroups = accounts.filter(a => a.isGroup && !parentIds.has(a.id)).map(a => ({ id: a.id, name: a.name }));
  if (emptyGroups.length) findings.push({ category: 'empty-group', severity: 'info', accounts: emptyGroups });

  // 7. Blank names — missing name or nameHi.
  const blanks = accounts.filter(a => !norm(a.name) || !norm(a.nameHi))
    .map(a => ({ id: a.id, name: a.name || a.nameHi || a.id, detail: 'missing name' }));
  if (blanks.length) findings.push({ category: 'blank-name', severity: 'warning', accounts: blanks });

  return findings;
}

export interface HygieneSummary {
  total: number;
  errors: number;
  warnings: number;
  cleanups: number;
  infos: number;
}

export function hygieneSummary(findings: ReadonlyArray<HygieneFinding>): HygieneSummary {
  const bySev = (s: HygieneSeverity) => findings.filter(f => f.severity === s).reduce((n, f) => n + f.accounts.length, 0);
  return {
    total: findings.reduce((n, f) => n + f.accounts.length, 0),
    errors: bySev('error'), warnings: bySev('warning'), cleanups: bySev('cleanup'), infos: bySev('info'),
  };
}

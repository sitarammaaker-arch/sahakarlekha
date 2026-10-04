/**
 * Readable ledger codes.
 *
 * Template accounts use their numeric id as the code ('1100' group → '1101' ledger). Accounts a
 * user creates get a crypto.randomUUID() id (DataContext addAccount) — unreadable, and it must
 * never change because vouchers reference it. So the readable code lives in a separate
 * `accounts.code` column (migration 109), assigned once: the next free code in the parent
 * group's range. The id stays the key; the code is display/search only.
 *
 * PURE — no React, no Supabase.
 */
import type { LedgerAccount } from '@/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidId(id: string | null | undefined): boolean {
  return UUID_RE.test(id || '');
}

type CodeFields = Pick<LedgerAccount, 'id'> & { code?: string | null };

// Template root group per account type — a parentless account (e.g. the many party ledgers created
// without a group) is coded inside its type's root range.
const ROOT_BY_TYPE: Partial<Record<LedgerAccount['type'], string>> = {
  equity: '1000', liability: '2000', asset: '3000', income: '4000', expense: '5000',
};

/** The code to SHOW: the stored code, else a non-UUID id, else '' (no readable code yet). */
export function accountCode(acc: CodeFields | null | undefined): string {
  if (!acc) return '';
  if (acc.code) return acc.code;
  return isUuidId(acc.id) ? '' : acc.id;
}

/** Every code already in use in this chart (ids that are codes + stored codes), for uniqueness. */
function usedCodes(accounts: ReadonlyArray<CodeFields>): Set<string> {
  const used = new Set<string>();
  for (const a of accounts) {
    if (!isUuidId(a.id)) used.add(a.id);
    if (a.code) used.add(a.code);
  }
  return used;
}

/**
 * Next free code for a new account under `parentId`.
 *  - parent 'X000' (top level): groups take X100…X900, ledgers X001…X099
 *  - parent 'XY00' (group):     XY01…XY99
 *  - anything else, or the numeric range is full: '<parentCode>-01', '-02', … (unbounded)
 * No parent → the type's root group ('2000' for a liability, …). Returns undefined when the parent
 * has no readable code (or neither parent nor a known type) — the account then shows "—" until it
 * is given one.
 */
export function nextAccountCode(
  accounts: ReadonlyArray<CodeFields>,
  parentId: string | null | undefined,
  isGroup: boolean,
  type?: LedgerAccount['type'],
): string | undefined {
  let pc: string;
  if (!parentId) {
    pc = (type && ROOT_BY_TYPE[type]) || '';
  } else {
    const parent = accounts.find(a => a.id === parentId);
    pc = parent ? accountCode(parent) : (isUuidId(parentId) ? '' : parentId);
  }
  if (!pc) return undefined;
  const used = usedCodes(accounts);

  const candidates: string[] = [];
  if (/^\d000$/.test(pc)) {
    const base = parseInt(pc, 10);
    if (isGroup) for (let i = 100; i <= 900; i += 100) candidates.push(String(base + i));
    else for (let i = 1; i <= 99; i++) candidates.push(String(base + i));
  } else if (/^\d\d00$/.test(pc)) {
    const base = parseInt(pc, 10);
    for (let i = 1; i <= 99; i++) candidates.push(String(base + i));
  }
  const numeric = candidates.find(c => !used.has(c));
  if (numeric) return numeric;
  // Suffix form, unbounded (a society can have hundreds of party ledgers under one group).
  for (let i = 1; i < 100000; i++) {
    const c = `${pc}-${String(i).padStart(2, '0')}`;
    if (!used.has(c)) return c;
  }
  return undefined;
}

/**
 * Codes for every account that has none (UUID id, no stored code), parents before children so a
 * child of a just-coded group derives from that group's new code. Deterministic: siblings in
 * name order. Returns id → code for the accounts that could be coded.
 */
export function planMissingCodes(accounts: ReadonlyArray<LedgerAccount & { code?: string | null }>): Map<string, string> {
  const plan = new Map<string, string>();
  const working = accounts.map(a => ({ ...a }));
  const byId = new Map(working.map(a => [a.id, a]));
  const depth = (a: { parentId?: string }, seen = new Set<string>()): number => {
    if (!a.parentId || seen.has(a.parentId)) return 0;
    const p = byId.get(a.parentId);
    if (!p) return 0;
    seen.add(a.parentId);
    return 1 + depth(p, seen);
  };
  const missing = working
    .filter(a => isUuidId(a.id) && !a.code)
    .sort((a, b) => depth(a) - depth(b) || (a.name || '').localeCompare(b.name || '') || a.id.localeCompare(b.id));
  for (const a of missing) {
    const code = nextAccountCode(working, a.parentId, !!a.isGroup, a.type);
    if (!code) continue;
    a.code = code;
    plan.set(a.id, code);
  }
  return plan;
}

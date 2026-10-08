/**
 * Inline "create" from a picker (account / customer / supplier / bank / stock item) — the rules, PURE.
 *
 * WHO may create: exactly the roles that may open the master's own page (founder decision 2026-10-08:
 * "same as the Ledger Heads page"). The SAME role gate the sidebar uses (navVisibility): a mapped 17-role
 * name goes through ROLE_MODULE_ACCESS, a legacy name through the module's requiredRoles — so a role that
 * cannot open Ledger Heads cannot create a ledger from a voucher either. Capabilities are not checked here:
 * they gate whether the PAGE exists for a society type, not who may add a record.
 */
import { MODULE_CATALOG } from '@/lib/navigation/moduleCatalog';
import { roleModuleAccess, roleGrantsModule } from '@/lib/navigation/roleAccess';

export type MasterModule = 'ledgerHeads' | 'customers' | 'suppliers' | 'inventory' | 'members';

export function roleCanCreateMaster(role: string | null | undefined, module: MasterModule): boolean {
  if (!role) return false;
  const m = MODULE_CATALOG.find((x) => x.id === module);
  if (!m) return false;
  const access = roleModuleAccess(role);
  if (access) return roleGrantsModule(access, m);
  return !m.requiredRoles || (m.requiredRoles as string[]).includes(role);
}

/** Normalise a name for duplicate checks: trim, collapse spaces, lower-case (Devanagari is unaffected). */
export function normName(s: string | null | undefined): string {
  return String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * An existing record with the same name (English or Hindi), so the dialog can offer it instead of making a
 * duplicate. For accounts pass `type` to match like Ledger Heads / migrateAccounts (same name + same type).
 */
export function findDuplicateByName<T extends { name?: string; nameHi?: string; type?: string; isGroup?: boolean }>(
  list: ReadonlyArray<T>, name: string, opts: { type?: string; includeGroups?: boolean } = {},
): T | undefined {
  const n = normName(name);
  if (!n) return undefined;
  return list.find((x) =>
    (opts.includeGroups || !x.isGroup) &&
    (!opts.type || x.type === opts.type) &&
    (normName(x.name) === n || normName(x.nameHi) === n));
}

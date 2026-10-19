/**
 * Transport operations — the ledgers trips and vehicle expenses post to. PURE.
 *
 * The heads are the transport chart's own (src/lib/templates/transport.ts — the SINGLE source of their
 * names/ids). A Transport society has them from day one; a multipurpose / CM-PACS / marketing society
 * that got the `transport` capability later does not, so they are also domain-provisioning specs
 * (src/lib/domainAccounts/provisioning.ts) created from Ledger Hygiene — never at load time.
 *
 * Resolution, same rule as the other domains: the conventional id when it is a ledger of the right type,
 * else a ledger of the right type with the template's English or Hindi name (a hand-made or provisioned
 * ledger with a UUID id is honoured, never duplicated).
 */
import type { LedgerAccount } from '@/types';
import { TRANSPORT_EXTRA_ACCOUNTS } from '@/lib/templates/transport';

export const TRANSPORT_ACCOUNT_IDS = {
  freight: '4501',
  hire: '4502',
  loading: '4503',
  detention: '4504',
  diesel: '5701',
  tyres: '5702',
  repairs: '5703',
  insurance: '5704',
  taxPermit: '5705',
  toll: '5706',
  tripAllowance: '5707',
  hiredVehicle: '5708',
} as const;
export type TransportAccountRole = keyof typeof TRANSPORT_ACCOUNT_IDS;

export const TRANSPORT_INCOME_ROLES: readonly TransportAccountRole[] = ['freight', 'hire', 'loading', 'detention'];
export const TRANSPORT_EXPENSE_ROLES: readonly TransportAccountRole[] = ['diesel', 'tyres', 'repairs', 'insurance', 'taxPermit', 'toll', 'tripAllowance', 'hiredVehicle'];

type Acc = Pick<LedgerAccount, 'id' | 'name' | 'nameHi' | 'isGroup'> & Partial<Pick<LedgerAccount, 'type'>>;

/** The chart template for a role (from templates/transport.ts). */
export function transportTemplate(role: TransportAccountRole): LedgerAccount {
  const t = TRANSPORT_EXTRA_ACCOUNTS.find(a => a.id === TRANSPORT_ACCOUNT_IDS[role]);
  if (!t) throw new Error(`transport template missing for ${role}`);
  return t;
}

const norm = (s: string | undefined) => (s || '').trim().toLowerCase();

/** Every ledger the resolver COULD pick for this role. */
export function transportAccountMatches(a: Acc, role: TransportAccountRole): boolean {
  const t = transportTemplate(role);
  if (a.isGroup) return false;
  if (a.type && a.type !== t.type) return false;
  if (a.id === t.id) return true;
  return norm(a.name) === norm(t.name) || (!!a.nameHi && a.nameHi.trim() === t.nameHi);
}

/** The ledger a role posts to, or null when the society has none (→ provision on Ledger Hygiene). */
export function resolveTransportAccountId(accounts: ReadonlyArray<Acc>, role: TransportAccountRole): string | null {
  const t = transportTemplate(role);
  const byId = accounts.find(a => a.id === t.id && !a.isGroup && (!a.type || a.type === t.type));
  if (byId) return byId.id;
  return accounts.find(a => transportAccountMatches(a, role))?.id ?? null;
}

/** role → resolved id (null where missing). */
export function resolveTransportAccounts(accounts: ReadonlyArray<Acc>): Record<TransportAccountRole, string | null> {
  const out = {} as Record<TransportAccountRole, string | null>;
  for (const role of Object.keys(TRANSPORT_ACCOUNT_IDS) as TransportAccountRole[]) out[role] = resolveTransportAccountId(accounts, role);
  return out;
}

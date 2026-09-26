/**
 * Which catalog module gates a given route. MODULE_CATALOG lists exact list-page paths; a DETAIL view
 * under a list page (e.g. the staff Member-360 at /members/:id) must inherit that list page's gate —
 * otherwise CapabilityGuard would treat it as "no catalog entry ⇒ universal" and any role that cannot
 * open Members could still open a member's full account by URL.
 */
import { MODULE_CATALOG } from './moduleCatalog';

/** Detail-route prefix → the list-page route whose visibility rule it inherits. */
export const DETAIL_ROUTE_PARENTS: ReadonlyArray<{ prefix: string; parent: string }> = [
  { prefix: '/members/', parent: '/members' },
];

export function moduleForRoute(pathname: string) {
  const exact = MODULE_CATALOG.find((m) => m.route === pathname);
  if (exact) return exact;
  const detail = DETAIL_ROUTE_PARENTS.find((d) => pathname.startsWith(d.prefix) && pathname.length > d.prefix.length);
  return detail ? MODULE_CATALOG.find((m) => m.route === detail.parent) : undefined;
}

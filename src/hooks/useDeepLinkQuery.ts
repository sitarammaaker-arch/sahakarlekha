/**
 * useDeepLinkQuery (ECR-25 Phase 2) — lets the global-search palette focus a record
 * on the destination page. When the URL carries a `?q=<term>`, this applies it to the
 * page's own search box (via the passed setter) and then strips the param from the URL,
 * so a later manual clear or reload does not re-force the filter.
 *
 * Usage on a list page:  useDeepLinkQuery(setSearchQuery)
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useDeepLinkQuery(apply: (q: string) => void): void {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';

  useEffect(() => {
    if (!q) return;
    apply(q);
    const next = new URLSearchParams(params);
    next.delete('q');
    setParams(next, { replace: true });
    // Intentionally keyed on `q` only — apply/params/setParams are stable enough and
    // re-running on their identity would strip the param before apply lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
}

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * "＋ नई entry" deep link (lib/navigation/createMenu): when the URL carries ?new=1, call the page's OWN "add" handler
 * (the one its "नया …" button calls) once, then drop the flag so a refresh / back does not reopen the form. Works on a
 * page that is already open too (the param changing re-runs it). `enabled` mirrors the page's own gate on that button.
 */
export function useOpenOnNew(open: () => void, enabled = true) {
  const [params, setParams] = useSearchParams();
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    if (params.get('new') !== '1') return;
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
    if (enabled) openRef.current();
  }, [params, setParams, enabled]);
}

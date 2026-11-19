import { useRef } from 'react';

/**
 * A ref that always holds the latest render's value. X-1: a domain update (paid amount, status) is applied in the
 * voucher's onSaved — an async moment later — so it must start from the CURRENT row, not the one captured when the
 * user pressed Save, or a change made in between would be overwritten.
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

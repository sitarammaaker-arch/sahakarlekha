import { useRef } from 'react';

/**
 * X-1: domain records are now written only in the voucher's onSaved, so between "Save" and the server's answer the
 * screen still shows the OLD state (draft, unpaid, last number). A second click in that window would approve twice,
 * pay twice or mint the same number. One key per record (or per create-kind) is held from the click until onSaved /
 * onFailed; a second attempt is refused with a message instead of posting a second voucher.
 */
export function useInFlight(onBusy: () => void) {
  const keys = useRef(new Set<string>());
  return {
    /** true = go ahead (and the key is now held); false = already in flight (onBusy was called). */
    begin(key: string): boolean {
      if (keys.current.has(key)) { onBusy(); return false; }
      keys.current.add(key);
      return true;
    },
    end(key: string): void { keys.current.delete(key); },
  };
}

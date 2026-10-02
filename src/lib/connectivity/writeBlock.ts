/**
 * Phase-2 F1 — offline policy (founder decision अ, 2026-10-02): ONLINE-ONLY entry.
 *
 * When the browser is offline, or the society's data did not fully load, the screen is showing
 * incomplete numbers (supabase-js RESOLVES a network failure as `{ data: null, error }`, so the old
 * catch-based localStorage fallback never ran and the app showed ₹0 / empty registers with no
 * warning). Entering data against that picture is unsafe, so every mutation is refused and a
 * banner explains why. Nothing is queued and nothing syncs later — there is nothing to send.
 *
 * This module is the single source both for the banner and for every context's mutation guard
 * (DataContext + the five domain contexts), so they always agree (RULE 2). Pure decision +
 * a tiny external store (useSyncExternalStore-compatible); no React import.
 */

/** Load parts whose failure blocks entry: the books every entry is validated / numbered against. */
export const CORE_PARTS = [
  'vouchers', 'accounts', 'members', 'society_settings', 'stock_items', 'stock_movements', 'sales', 'purchases',
] as const;

export const PART_LABEL_HI: Record<string, string> = {
  vouchers: 'वाउचर', accounts: 'खाते', members: 'सदस्य', society_settings: 'सोसाइटी settings',
  stock_items: 'स्टॉक', stock_movements: 'स्टॉक movement', sales: 'बिक्री', purchases: 'ख़रीद',
  loans: 'ऋण', assets: 'संपत्ति', audit_objections: 'ऑडिट आपत्तियाँ', employees: 'कर्मचारी',
  salary_records: 'वेतन', suppliers: 'सप्लायर', customers: 'ग्राहक', kcc_loans: 'KCC ऋण',
  recoverables: 'वसूली योग्य', kachi_aarat_entries: 'कच्ची आढ़त', p7_entries: 'P7',
};

export type BlockReason = 'offline' | 'incomplete' | null;

export interface ConnectivityState {
  online: boolean;
  /** Load parts that returned an error on the last load (empty = full load or not loaded yet). */
  failedParts: readonly string[];
}

export interface WriteBlockDecision {
  blocked: boolean;
  reason: BlockReason;
  failedCore: string[];
  /** Non-core parts that failed: shown as a warning, never block entry. */
  failedOther: string[];
}

const CORE = new Set<string>(CORE_PARTS);

/** Pure: offline always blocks; online blocks only when a CORE part failed to load. */
export function decideWriteBlock(s: ConnectivityState): WriteBlockDecision {
  const failedCore = s.failedParts.filter(p => CORE.has(p));
  const failedOther = s.failedParts.filter(p => !CORE.has(p));
  if (!s.online) return { blocked: true, reason: 'offline', failedCore, failedOther };
  if (failedCore.length > 0) return { blocked: true, reason: 'incomplete', failedCore, failedOther };
  return { blocked: false, reason: null, failedCore, failedOther };
}

/** Hindi-first toast text for a refused mutation. */
export function blockMessage(d: WriteBlockDecision): { title: string; description: string } {
  if (d.reason === 'offline') {
    return {
      title: 'इंटरनेट नहीं है — entry बंद',
      description: 'इंटरनेट आने पर entry अपने-आप चालू हो जाएगी। आपका data cloud में सुरक्षित है। (Offline — entry is paused; nothing was saved.)',
    };
  }
  return {
    title: 'Data पूरा load नहीं हुआ — entry बंद',
    description: `load नहीं हुआ: ${d.failedCore.map(p => PART_LABEL_HI[p] ?? p).join(', ')}। ऊपर "फिर से load करें" दबाएँ। आपका data cloud में सुरक्षित है। (Data incomplete — entry is paused.)`,
  };
}

type ToastFn = (t: { title: string; description: string; variant: 'destructive'; duration: number }) => unknown;

/** Mutation guard shared by every context: returns true (and toasts) when entry is blocked. */
export function refuseIfWriteBlocked(toast: ToastFn): boolean {
  const d = getWriteBlock();
  if (!d.blocked) return false;
  lastRefusalAt = Date.now();
  toast({ ...blockMessage(d), variant: 'destructive', duration: 10000 });
  return true;
}

let lastRefusalAt = 0;
/** Window after a refusal in which a page's unconditional success toast is dropped (see use-toast). */
export const SUPPRESS_MS = 3000;

/** True while entry is blocked AND a mutation was refused in the last SUPPRESS_MS. */
export function suppressAfterRefusal(now: number = Date.now()): boolean {
  return decision.blocked && now - lastRefusalAt < SUPPRESS_MS;
}

// ── external store ──────────────────────────────────────────────────────────
let state: ConnectivityState = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  failedParts: [],
};
let decision = decideWriteBlock(state);
const listeners = new Set<() => void>();

function set(next: ConnectivityState) {
  state = next;
  decision = decideWriteBlock(state);
  listeners.forEach(l => l());
}

export function setOnline(online: boolean) {
  if (online !== state.online) set({ ...state, online });
}

/** Called once per society load with the parts that errored (an empty list clears the block). */
export function setLoadFailures(parts: readonly string[]) {
  set({ ...state, failedParts: [...parts] });
}

export function getWriteBlock(): WriteBlockDecision {
  return decision;
}

export function subscribeWriteBlock(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

let wired = false;
/** Wire browser online/offline events once (idempotent). */
export function initConnectivityListeners() {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));
}

/**
 * ARCH-08 (product audit 2026-11-17): a bulk import fires one save per row. The summary
 * ("N imported") may only be shown once EVERY save has answered — counted from the cloud,
 * never from the loop (RULE 1).
 *
 * Each row gets one handle. A handle settles once: the first of ok() / fail() counts, a
 * repeat is ignored (a save that both refuses synchronously AND calls onFailed is counted
 * once). When the last handle settles, `done` fires exactly once with the totals. close()
 * says the loop is over, so a batch whose rows all answered synchronously still finishes,
 * and an empty batch finishes at once.
 */
export interface BulkTotals { saved: number; failed: number }
export interface BulkHandle { ok: () => void; fail: () => void }

export function createBulkTally(done: (t: BulkTotals) => void) {
  let saved = 0, failed = 0, open = 0, closed = false, finished = false;
  const check = () => {
    if (finished || !closed || open > 0) return;
    finished = true;
    done({ saved, failed });
  };
  return {
    item(): BulkHandle {
      open++;
      let settled = false;
      const settle = (good: boolean) => {
        if (settled) return;
        settled = true;
        open--;
        if (good) saved++; else failed++;
        check();
      };
      return { ok: () => settle(true), fail: () => settle(false) };
    },
    close() { closed = true; check(); },
  };
}

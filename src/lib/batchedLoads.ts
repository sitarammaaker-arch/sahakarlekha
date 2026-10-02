/**
 * J5 · apply several independent table loads in ONE React commit.
 *
 * A context that loads N tables with N separate `.then(setX)` calls re-renders every consumer N times
 * after login (each resolve is its own task, so React cannot batch them). This waits for all of them
 * (allSettled — one failure never blocks the others) and applies every result inside one callback, which
 * React batches into a single commit. Each table keeps its own fallback: an error, a rejection or a missing
 * table falls back to that table's cached copy, exactly like the per-table `.then(ok, fail)` it replaces.
 */

/** [query, state setter, cached-copy getter]. The setter takes the table's row type. */
export type BatchedLoad = [
  PromiseLike<{ data: unknown[] | null; error: unknown }>,
  (rows: never[]) => void,
  () => unknown[],
];

export function applyLoadsTogether(loads: BatchedLoad[], label: string): Promise<void> {
  return Promise.allSettled(loads.map(([q]) => q)).then(results => results.forEach((r, i) => {
    const [, set, cached] = loads[i];
    try {
      set((r.status === 'fulfilled' && !r.value.error && r.value.data ? r.value.data : cached()) as never[]);
    } catch (e) { console.warn(`${label}: applying a loaded table failed:`, e); }
  }));
}

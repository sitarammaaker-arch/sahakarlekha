/**
 * Numbering reservation-blocks for offline capture (T-33 / ADR-0005; TASK3.6 §21; CA-03).
 *
 * PURE. Statutory audit demands GAPLESS, non-duplicated document numbers (T-03). An offline device
 * cannot call the server sequence per capture, so the server RESERVES a contiguous block of numbers
 * to a device; the device assigns from its block offline; on sync the numbers reconcile without gaps
 * or cross-device collisions. This module is the SSOT for that block algebra:
 *
 *   • reserveBlock — the server issues a block just past its high-water mark, so blocks TILE the
 *     sequence (contiguous, disjoint) and the global order stays gapless.
 *   • assignFromBlock — offline assignment; FAIL-CLOSED when the block is exhausted (request a new
 *     block, never overflow or reuse — no collision).
 *   • unusedNumbers — the reserved-but-unused tail, so the server can RECLAIM it and the committed
 *     sequence stays gapless.
 *   • blocksOverlap / isGaplessCoverage — the integrity invariants: no two devices share a number,
 *     no gap in issuance.
 *
 * The live high-water store and per-device block hand-out are the wire layer; the algebra is here.
 * No I/O; deterministic.
 */

export interface ReservationBlock {
  book: string;   // register prefix, e.g. 'RV'
  fy: string;     // '2025-26'
  deviceId: string;
  /** First reserved seq (inclusive). */
  start: number;
  /** Last reserved seq (inclusive). */
  end: number;
  /** How many numbers have been assigned from this block (0..size). */
  used: number;
}

export interface ReserveResult {
  block: ReservationBlock;
  /** The server's advanced high-water mark after issuing this block. */
  highWater: number;
}

/** PURE — the count of numbers in a block. */
export function blockSize(b: ReservationBlock): number {
  return b.end - b.start + 1;
}

/**
 * PURE — reserve a contiguous block of `size` numbers for a device, starting just after the current
 * high-water mark. Issued contiguously so blocks tile the sequence (gapless, collision-free).
 */
export function reserveBlock(highWater: number, size: number, book: string, fy: string, deviceId: string): ReserveResult {
  if (!Number.isInteger(highWater) || highWater < 0) throw new RangeError('reservation: highWater must be a non-negative integer');
  if (!Number.isInteger(size) || size < 1) throw new RangeError('reservation: block size must be a positive integer');
  const start = highWater + 1;
  const end = highWater + size;
  return { block: { book, fy, deviceId, start, end, used: 0 }, highWater: end };
}

export type AssignResult =
  | { ok: true; seq: number; block: ReservationBlock }
  | { ok: false; reason: string };

/**
 * PURE — assign the next number from a block, offline. FAIL-CLOSED: when the block is exhausted the
 * device must request a new block rather than reuse or overflow — that is what prevents a
 * cross-device collision (two devices issuing the same number).
 */
export function assignFromBlock(block: ReservationBlock): AssignResult {
  if (block.used >= blockSize(block)) {
    return { ok: false, reason: 'reservation block exhausted — request a new block online (never reuse/overflow)' };
  }
  const seq = block.start + block.used;
  return { ok: true, seq, block: { ...block, used: block.used + 1 } };
}

/** PURE — the reserved-but-unused numbers of a block, for the server to RECLAIM so the committed
 *  sequence stays gapless. */
export function unusedNumbers(block: ReservationBlock): number[] {
  const out: number[] = [];
  for (let s = block.start + block.used; s <= block.end; s++) out.push(s);
  return out;
}

/** PURE — do two blocks share any number? (The cross-device collision check.) */
export function blocksOverlap(a: ReservationBlock, b: ReservationBlock): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/**
 * PURE — do these blocks tile a contiguous range with NO gap and NO overlap? The issuance
 * invariant: every number between the first start and the last end is reserved exactly once — no
 * cross-device collision, no gap in the audited sequence.
 */
export function isGaplessCoverage(blocks: readonly ReservationBlock[]): boolean {
  if (blocks.length === 0) return true;
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].end < sorted[i].start) return false; // malformed
    if (i > 0 && sorted[i].start !== sorted[i - 1].end + 1) return false; // gap or overlap
  }
  return true;
}

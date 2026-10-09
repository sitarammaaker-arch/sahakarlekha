/**
 * FIFO ageing of a party's LEDGER balance (2026-10-09, duplicate-page audit batch 3).
 *
 * The Aging Analysis page spread every signed voucher line into the bucket of ITS OWN date: a recent receipt
 * went NEGATIVE into 0–30 while the old invoice stayed in 90+ — so buckets went below zero and ageing was
 * overstated. It also ignored the opening balance, so its total did not tie to the party's ledger.
 *
 * FIFO (Tally's ageing when bills are not tracked): every amount that REDUCES the balance is applied to the
 * OLDEST amount that increased it. What remains, by the date it arose, is the ageing. The total always equals
 * the ledger balance (opening included). A net balance on the wrong side (an advance) is shown as `advance`,
 * never as negative buckets. Bill-by-bill ageing stays on the Bills Outstanding page. PURE, paise-exact.
 */
export interface FifoBuckets {
  total: number;      // ledger balance on the expected side (negative = advance / overpaid)
  b0_30: number;
  b31_60: number;
  b61_90: number;
  b91_180: number;
  bOver180: number;
  advance: number;    // balance on the OTHER side (e.g. a customer who paid in advance), ≥ 0
}

/** `signed` > 0 increases the balance on the expected side (Dr for a debtor, Cr for a creditor). */
export function fifoAging(entries: readonly { date: string; signed: number }[], asOf: string): FifoBuckets {
  const minor = (n: number) => Math.round((Number(n) || 0) * 100);
  const live = entries.filter((e) => e.date <= asOf).slice().sort((a, b) => a.date.localeCompare(b.date));
  const open: { date: string; amt: number }[] = [];   // increases not yet used up, oldest first
  let credit = 0;                                     // reductions not yet applied (an advance)
  for (const e of live) {
    let m = minor(e.signed);
    if (m > 0) {
      // A later increase first eats any earlier advance.
      const use = Math.min(credit, m); credit -= use; m -= use;
      if (m > 0) open.push({ date: e.date, amt: m });
    } else if (m < 0) {
      let r = -m;
      while (r > 0 && open.length) {
        const take = Math.min(r, open[0].amt);
        open[0].amt -= take; r -= take;
        if (open[0].amt === 0) open.shift();
      }
      credit += r;
    }
  }
  const out = { b0_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, bOver180: 0 };
  const asOfMs = Date.parse(asOf + 'T00:00:00Z');
  for (const o of open) {
    const days = Math.max(0, Math.floor((asOfMs - Date.parse(o.date + 'T00:00:00Z')) / 86_400_000));
    if (days <= 30) out.b0_30 += o.amt;
    else if (days <= 60) out.b31_60 += o.amt;
    else if (days <= 90) out.b61_90 += o.amt;
    else if (days <= 180) out.b91_180 += o.amt;
    else out.bOver180 += o.amt;
  }
  const openSum = out.b0_30 + out.b31_60 + out.b61_90 + out.b91_180 + out.bOver180;
  return {
    total: (openSum - credit) / 100,
    b0_30: out.b0_30 / 100, b31_60: out.b31_60 / 100, b61_90: out.b61_90 / 100,
    b91_180: out.b91_180 / 100, bOver180: out.bOver180 / 100,
    advance: credit / 100,
  };
}

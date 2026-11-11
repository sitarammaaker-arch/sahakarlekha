// RM-17 · head-wise GST posting (src/lib/accounting/gstLedgers.ts) — the one rule every posting site shares.
// Pins: new documents post balanced vouchers to Output / Input CGST · SGST · IGST; a document whose existing
// voucher sits on the combined 2201 / 3310 stays there (edit, return); and anything that cannot be split
// cleanly falls back to the combined ledger — never a partial split, never an unbalanced voucher.
import { readFileSync } from 'node:fs';
await import('./gen-migration-156.mjs');   // registers the "@/…" + extension-less resolver
const G = await import(new URL('../src/lib/accounting/gstLedgers.ts', import.meta.url).href);
const S = await import(new URL('../src/lib/storage.ts', import.meta.url).href);
const H = await import(new URL('../src/lib/housing/billing.ts', import.meta.url).href);
const T = await import(new URL('../src/lib/transport/gtaGst.ts', import.meta.url).href);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const p = (n) => Math.round(n * 100);
const sum = (legs) => legs.reduce((s, l) => s + p(l.amount), 0);
const ids = (legs) => legs.map((l) => l.accountId).join(',');

const chart = S.fullChartForType('marketing_processing');
const oldChart = chart.filter((a) => !S.ACCOUNTS_TO_ADD_156.some((x) => x.id === a.id));   // a society before migration 156

// ── New documents: head-wise ────────────────────────────────────────────────────────────────────
{
  const intra = G.gstLedgerLegs('output', { cgst: 90, sgst: 90, igst: 0, total: 180 }, chart);
  ok(ids(intra) === '2291,2292' && intra.every((l) => l.amount === 90), 'sale within the State → Cr Output CGST 90 + Output SGST 90');
  const inter = G.gstLedgerLegs('output', { cgst: 0, sgst: 0, igst: 180, total: 180 }, chart);
  ok(ids(inter) === '2293' && inter[0].amount === 180, 'sale to another State → Cr Output IGST 180');
  const pIntra = G.gstLedgerLegs('input', { cgst: 855, sgst: 855, igst: 0, total: 1710 }, chart);
  ok(ids(pIntra) === '3391,3392' && sum(pIntra) === 171000, 'purchase within the State → Dr Input CGST + Input SGST');
  const pInter = G.gstLedgerLegs('input', { igst: 1710, total: 1710 }, chart);
  ok(ids(pInter) === '3393', 'purchase from another State → Dr Input IGST');
  ok(G.gstLedgerLegs('output', { cgst: 0, sgst: 0, igst: 0, total: 0 }, chart).length === 0, 'no tax → no GST leg');
  const odd = G.gstLedgerLegs('output', { cgst: 30.85, sgst: 30.85, igst: 0, total: 61.7 }, chart);
  ok(sum(odd) === 6170, 'paise: 30.85 + 30.85 = 61.70 exactly');
}

// ── A whole voucher balances (the shape DataContext builds) ─────────────────────────────────────
{
  const sale = (parts, c, opts) => [{ accountId: 'DEBTOR', type: 'Dr', amount: 1000 + parts.total }, { accountId: '4101', type: 'Cr', amount: 1000 },
    ...G.gstLedgerLegs('output', parts, c, opts).map((g) => ({ accountId: g.accountId, type: 'Cr', amount: g.amount }))];
  const bal = (v) => v.reduce((s, l) => s + (l.type === 'Dr' ? 1 : -1) * p(l.amount), 0);
  for (const [name, parts, c, opts] of [
    ['split', { cgst: 25, sgst: 25, igst: 0, total: 50 }, chart, {}],
    ['igst', { cgst: 0, sgst: 0, igst: 50, total: 50 }, chart, {}],
    ['legacy', { cgst: 25, sgst: 25, igst: 0, total: 50 }, chart, { legacy: true }],
    ['old chart', { cgst: 25, sgst: 25, igst: 0, total: 50 }, oldChart, {}],
    ['parts do not tie', { cgst: 25, sgst: 24, igst: 0, total: 50 }, chart, {}],
    ['no parts', { total: 50 }, chart, {}],
  ]) ok(bal(sale(parts, c, opts)) === 0, `sale voucher balances — ${name}`);
}

// ── Old documents stay on the combined ledger ───────────────────────────────────────────────────
{
  const oldSaleVoucher = { lines: [{ accountId: 'DEBTOR' }, { accountId: '4101' }, { accountId: '2201' }] };
  const newSaleVoucher = { lines: [{ accountId: 'DEBTOR' }, { accountId: '4101' }, { accountId: '2291' }, { accountId: '2292' }] };
  ok(G.usesCombinedGst('output', oldSaleVoucher) && !G.usesCombinedGst('output', newSaleVoucher), 'a voucher with a 2201 line is an old-style sale; a head-wise one is not');
  ok(!G.usesCombinedGst('output', null, undefined, { lines: null }) && !G.usesCombinedGst('input', oldSaleVoucher), 'missing voucher / other side → not legacy');
  ok(G.usesCombinedGst('input', { lines: [{ accountId: '3310' }] }), 'a voucher with a 3310 line is an old-style purchase');
  const edit = G.gstLedgerLegs('output', { cgst: 90, sgst: 90, total: 180 }, chart, { legacy: G.usesCombinedGst('output', oldSaleVoucher) });
  ok(ids(edit) === '2201' && edit[0].amount === 180, 'editing an OLD sale keeps the whole tax on 2201');
  // Old sale ₹180 on 2201, half returned: the return debits 2201 by 90 → 2201 nets to the other half.
  const ret = G.gstLedgerLegs('output', { cgst: 45, sgst: 45, total: 90 }, chart, { legacy: true });
  ok(ids(ret) === '2201' && 180 - ret[0].amount === 90, 'return of an OLD sale reverses on 2201 — the old ledger unwinds where it sits');
  const retNew = G.gstLedgerLegs('output', { cgst: 45, sgst: 45, total: 90 }, chart, { legacy: G.usesCombinedGst('output', newSaleVoucher) });
  ok(ids(retNew) === '2291,2292', 'return of a NEW sale reverses head-wise');
  const pret = G.gstLedgerLegs('input', { igst: 100, total: 100 }, chart, { legacy: true });
  ok(ids(pret) === '3310', 'return of an OLD purchase reverses on 3310');
}

// ── Fallbacks: never a partial split ────────────────────────────────────────────────────────────
{
  ok(ids(G.gstLedgerLegs('output', { cgst: 90, sgst: 90, total: 180 }, oldChart)) === '2201', 'chart without the new heads (migration not run) → combined 2201');
  ok(ids(G.gstLedgerLegs('input', { cgst: 90, sgst: 90, total: 180 }, oldChart)) === '3310', 'chart without the new heads → combined 3310');
  const noSgst = chart.filter((a) => a.id !== '2292');
  ok(ids(G.gstLedgerLegs('output', { cgst: 90, sgst: 90, total: 180 }, noSgst)) === '2201', 'one needed head missing → the WHOLE tax on 2201, not half');
  ok(ids(G.gstLedgerLegs('output', { igst: 180, total: 180 }, noSgst)) === '2293', 'a head the document does not need may be missing');
  ok(ids(G.gstLedgerLegs('output', { cgst: 90, sgst: 80, total: 180 }, chart)) === '2201', 'CGST + SGST + IGST ≠ tax → combined');
  ok(ids(G.gstLedgerLegs('output', { total: 180 }, chart)) === '2201', 'no head-wise amounts recorded → combined');
  ok(ids(G.gstLedgerLegs('output', { cgst: -10, sgst: 190, total: 180 }, chart)) === '2201', 'a negative head → combined');
  const screenOnly = new Set(['2291', '2292', '2293']);
  ok(ids(G.gstLedgerLegs('output', { cgst: 90, sgst: 90, total: 180 }, chart, { unavailableIds: screenOnly })) === '2201', 'heads on screen but not in the database → combined (the server would refuse the voucher)');
  // A society's own account at a new code is not a GST head.
  const taken = chart.map((a) => (a.id === '2291' ? { ...a, name: 'Staff Welfare Payable' } : a));
  ok(ids(G.gstLedgerLegs('output', { cgst: 90, sgst: 90, total: 180 }, taken)) === '2201', "a society's own account at code 2291 is never posted GST");
  // …but a society that named its own CGST ledger is honoured.
  const named = [...taken, { id: 'X1', name: 'CGST Payable', type: 'liability', isGroup: false }];
  ok(ids(G.gstLedgerLegs('output', { cgst: 90, sgst: 90, total: 180 }, named)) === 'X1,2292', "a society's own single 'CGST Payable' ledger is used");
  const twoNamed = [...named, { id: 'X2', name: 'CGST Output (old)', type: 'liability', isGroup: false }];
  ok(ids(G.gstLedgerLegs('output', { cgst: 90, sgst: 90, total: 180 }, twoNamed)) === '2201', 'two candidates for one head → ambiguous → combined');
  ok(G.gstHeadAccountId('output', 'cgst', [{ id: '2291', name: 'Output CGST', type: 'liability', isGroup: true }]) === null, 'a group is never posted to');
  ok(G.gstHeadAccountId('input', 'cgst', [{ id: '2291', name: 'Output CGST', type: 'liability' }]) === null, 'an output head is never used for input credit');
  ok(G.gstHeadAccountId('output', 'cgst', [{ id: '2201', name: 'GST Payable', type: 'liability' }]) === null
    && G.gstHeadAccountId('input', 'cgst', [{ id: '3310', name: 'GST Input Credit (ITC)', type: 'asset' }]) === null, 'the combined ledgers are never read as a head');
}

// ── Housing: maintenance GST is always within the State → CGST + SGST ───────────────────────────
{
  const lines = [{ chargeHeadId: 'a', name: 'Maintenance', accountId: '4101', isFund: false, gstable: true, amount: 8000 }];
  const gst = H.gstLineForBill(lines, { enabled: true, rate: 18, gstAccountId: G.GST_COMBINED_ID.output });
  ok(gst && gst.amount === 1440 && gst.accountId === '2201', 'the GST amount rule itself is unchanged (18% of 8,000 = 1,440)');
  const split = H.gstBillLines(gst, 18, G.gstLedgerLegs('output', G.halveIntraStateGst(gst.amount), chart));
  ok(split.length === 2 && split[0].accountId === '2291' && split[1].accountId === '2292' && split[0].amount === 720 && split[1].amount === 720, 'bill carries CGST 720 (2291) + SGST 720 (2292)');
  ok(split[0].name === 'CGST @9%' && split[1].name === 'SGST @9%' && split.every((l) => !l.gstable && !l.isFund), 'named CGST @9% / SGST @9%');
  const legs = H.demandLegs('REC', [...lines, ...split]);
  ok(legs.reduce((s, l) => s + (l.type === 'Dr' ? 1 : -1) * p(l.amount), 0) === 0 && legs.find((l) => l.type === 'Dr').amount === 9440, 'the demand voucher balances: Dr member 9,440');
  const same = H.gstBillLines(gst, 18, G.gstLedgerLegs('output', G.halveIntraStateGst(gst.amount), oldChart));
  ok(same.length === 1 && same[0].accountId === '2201' && same[0].amount === 1440 && same[0].name === gst.name, 'chart without the heads → the single GST line on 2201, as before');
  const h = G.halveIntraStateGst(100.01);
  ok(p(h.cgst) + p(h.sgst) === 10001 && h.cgst === 50 && h.sgst === 50.01, 'an odd paisa goes to SGST; the halves add up exactly');
}

// ── Transport: forward-charge GTA tax ───────────────────────────────────────────────────────────
{
  const intra = T.gtaTax('fcm18', '2026-11-01', 10000, false);
  ok(intra && ids(G.gstLedgerLegs('output', intra, chart)) === '2291,2292' && sum(G.gstLedgerLegs('output', intra, chart)) === p(intra.total), 'trip within the State → Output CGST + SGST, summing to the tax');
  const inter = T.gtaTax('fcm18', '2026-11-01', 10000, true);
  ok(inter && ids(G.gstLedgerLegs('output', inter, chart)) === '2293', 'trip to another State → Output IGST');
}

// ── Reports: the audit-format GST lines read the old and the new ledgers together ───────────────
{
  const src = readFileSync(new URL('../src/lib/stateAuditFormats.ts', import.meta.url), 'utf8');
  ok(/id: 'VI-10'[^\n]*accountIds: \['3310', '3391', '3392', '3393'\]/.test(src), 'VI-10 (ITC) = 3310 + the three input heads');
  ok(/id: 'VII-11'[^\n]*accountIds: \['2201', '2291', '2292', '2293'\]/.test(src), 'VII-11 (GST payable) = 2201 + the three output heads');
}

// ── No posting site hard-codes the combined ledger any more ─────────────────────────────────────
{
  for (const f of ['contexts/DataContext.tsx', 'contexts/ConsumerDataContext.tsx', 'contexts/HousingDataContext.tsx', 'contexts/TransportOpsContext.tsx']) {
    const src = readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
    ok(!/accountId: '(2201|3310)'/.test(src) && !/=== '(2201|3310)'/.test(src), `${f}: no hard-coded 2201 / 3310 posting line`);
    ok(/gstLegs\(/.test(src), `${f}: posts GST through gstLegs`);
  }
}

console.log(`GST ledgers (RM-17): ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

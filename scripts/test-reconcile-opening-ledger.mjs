// Opening reconcile (T-09) — proves the invariant scripts/reconcile-opening-ledger.mjs relies on:
// for an account whose journal opening has DRIFTED from its current opening, appending ONE corrective
// planOpeningDelta (prev = the journal's current opening sum, new = the account's current opening)
// brings ledgerParity back to green — append-only, no event deleted. Reproduces the observed Rania
// shape (one account +₹25k in the journal, a bank −₹25k), the deleted-account zeroing, and idempotency.
// Run: node scripts/test-reconcile-opening-ledger.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const { ledgerParity } = await import(abs('../src/lib/ledger/parity.ts'));
const { planOpeningEvents, planOpeningDelta } = await import(abs('../src/lib/ledger/genesis.ts'));
const { toMinor } = await import(abs('../src/lib/money.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// The journal's current signed opening (Dr − Cr, paise) and highest sequence for one account — the
// exact reducer scripts/reconcile-opening-ledger.mjs uses to derive `prevSignedMinor`.
const journalOpening = (events, accountId) => {
  let signedMinor = 0, maxSeq = 0;
  for (const e of events) {
    if (e.eventType !== 'account.opening' || e.aggregateId !== accountId) continue;
    for (const l of e.payload.lines || []) signedMinor += l.drCr === 'Dr' ? l.amountMinor : -l.amountMinor;
    if (e.sequence > maxSeq) maxSeq = e.sequence;
  }
  return { signedMinor, maxSeq };
};

// The script's core decision for one (account, currentOpening): append a delta iff the journal drifted.
const reconcileDelta = (events, account, sid = 'SOC001') => {
  const { signedMinor, maxSeq } = journalOpening(events, account.id);
  return planOpeningDelta(account, signedMinor, maxSeq + 1, sid, { producer: { kind: 'import', id: 'opening-reconcile' } });
};

// ── The observed Rania shape ────────────────────────────────────────────────────────────────────
// Genesis seeded openings 3301 = ₹25,000 Dr and the bank = ₹75,000 Dr. Later an opening correction
// moved ₹25,000 off 3301 (→ ₹0) onto the bank (→ ₹1,00,000) — but the delta never reached the journal.
const staleJournal = planOpeningEvents(
  [
    { id: '3301', openingBalance: 25000, openingBalanceType: 'debit' },
    { id: 'bank-1859', openingBalance: 75000, openingBalanceType: 'debit' },
  ],
  'SOC001',
  { openingDate: '2000-01-01' },
);
const accountsNow = [
  { id: '3301', openingBalance: 0, openingBalanceType: 'debit' },
  { id: 'bank-1859', openingBalance: 100000, openingBalanceType: 'debit' },
];

// 1. The drift the parity gate reports: 3301 journal ahead by ₹25k, bank behind by ₹25k.
const before = ledgerParity(staleJournal, [], accountsNow);
ok(!before.matches && before.diffs.length === 2, 'stale opening journal → trialBalance parity FAILS on 2 accounts');
const d3301 = before.diffs.find((d) => d.accountId === '3301');
const dBank = before.diffs.find((d) => d.accountId === 'bank-1859');
ok(d3301 && d3301.actual === toMinor(25000) && d3301.expected === 0, '3301: journal ₹25,000 ≠ vouchers ₹0');
ok(dBank && dBank.actual === toMinor(75000) && dBank.expected === toMinor(100000), 'bank: journal ₹75,000 ≠ vouchers ₹1,00,000');

// 2. Reconcile: one corrective delta per drifted account, APPENDED (nothing deleted) → parity green.
const deltas = accountsNow.map((a) => reconcileDelta(staleJournal, a)).filter(Boolean);
ok(deltas.length === 2, 'reconcile plans exactly one delta per drifted account');
const reconciled = [...staleJournal, ...deltas];
ok(reconciled.length === staleJournal.length + 2, 'append-only: original events all retained, deltas added');
const after = ledgerParity(reconciled, [], accountsNow);
ok(after.matches && after.diffs.length === 0, 'after appending deltas → trialBalance parity is GREEN');

// 3. The delta ids are the live-path shape (opening-<id>-<seq>), so a live edit and a reconcile can’t collide.
ok(deltas.every((e) => /-2$/.test(e.eventId)), 'delta event ids follow opening-<id>-<seq> (seq after genesis = 2)');

// 4. Deleted account: journal still carries an opening for an account no longer in the chart → target 0.
const withGhost = [
  ...planOpeningEvents([{ id: 'ghost', openingBalance: 5000, openingBalanceType: 'debit' }], 'SOC001', { openingDate: '2000-01-01' }),
];
const ghostDelta = reconcileDelta(withGhost, { id: 'ghost', openingBalance: 0, openingBalanceType: 'credit' });
const ghostFixed = [...withGhost, ghostDelta];
ok(journalOpening(ghostFixed, 'ghost').signedMinor === 0, 'deleted-account opening reconciles to zero in the journal');
ok(ledgerParity(ghostFixed, [], []).matches, 'ghost account with zeroed opening → parity matches (no live account)');

// 5. Idempotent: a second reconcile pass finds journal == current and appends nothing.
const secondPass = accountsNow.map((a) => reconcileDelta(reconciled, a)).filter(Boolean);
ok(secondPass.length === 0, 'idempotent: re-running reconcile on a synced journal plans zero deltas');

console.log(`\nOpening reconcile (T-09): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

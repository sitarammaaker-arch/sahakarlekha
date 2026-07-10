// Replay assertion for voucher_entries (T-33 / gap EXP-03).
//
// `voucher_entries` is the registry's only `replay` entity: a restore regenerates it rather
// than inserting the archived rows, then asserts the regeneration reproduces the backup.
//
// The assertion is worth exactly as much as the function it replays through. If the restore
// rebuilt entries with its OWN copy of the posting rule, the comparison would prove that
// copy A agrees with copy B and nothing at all about the ledger the society posts. So the
// first test here is not about entries — it is that there is only one posting rule.
//
// Run: node scripts/test-restore-replay.mjs   (npm run test:restore-replay)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as pathResolve } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      const SUPABASE = pathToFileURL(pathResolve(SRC, 'lib', 'supabase.ts')).href;

      export async function resolve(spec, ctx, next) {
        if (spec === '@/lib/supabase') return { url: SUPABASE, shortCircuit: true };
        if (spec.startsWith('@/')) {
          const base = pathResolve(SRC, spec.slice(2));
          for (const cand of [base + '.ts', base + '.tsx', base + '/index.ts', base]) {
            if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
          }
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
            const u = new URL(cand, ctx.parentURL);
            if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
          }
        }
        return next(spec, ctx);
      }

      export async function load(url, ctx, next) {
        if (url === SUPABASE) {
          return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' };
        }
        return next(url, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let replayMod, utilsMod;
try {
  replayMod = await import(abs('../src/lib/restore/replay.ts'));
  utilsMod = await import(abs('../src/lib/voucherUtils.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the replay modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { replayEntries, compareReplay, summarizeReplay, REPLAY_FIELDS } = replayMod;
const { buildVoucherEntries } = utilsMod;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. ONE POSTING RULE ──────────────────────────────────────────────────────
//
// This is the assertion that gives every other assertion in this file its meaning.

const ctxSrc = readFileSync(pathResolve(SRC, 'contexts', 'DataContext.tsx'), 'utf8');
ok(/import \{[^}]*buildVoucherEntries[^}]*\} from '@\/lib\/voucherUtils'/.test(ctxSrc),
  'DataContext posts through voucherUtils.buildVoucherEntries');
ok(!/const buildEntries\s*=/.test(ctxSrc),
  'DataContext no longer carries its OWN copy of the posting rule — a replay against a second copy proves nothing');

const replaySrc = readFileSync(pathResolve(SRC, 'lib', 'restore', 'replay.ts'), 'utf8');
ok(replaySrc.includes("import { buildVoucherEntries }"),
  'replay.ts regenerates through that same function, not a reimplementation');
ok(!/dr:\s*l\.type === 'Dr'/.test(replaySrc), 'and does not inline the Dr/Cr rule itself');

// These two are STRUCTURAL, and cannot be otherwise. A faithful reimplementation of the
// posting rule produces identical rows today, so no behavioural test can see it — the harm
// arrives later, the first time one copy is fixed and the other is not. Verified by
// sabotage: inlining the Dr/Cr rule into replay.ts turns exactly the grep above red, and
// every behavioural assertion below stays green. That is the whole argument for the grep.

// ── 2. THE POSTING RULE ──────────────────────────────────────────────────────

const multiLine = {
  id: 'V1', isDeleted: false, amount: 0,
  lines: [
    { id: 'L1', accountId: '4101', type: 'Cr', amount: 1500, narration: 'बिक्री' },
    { id: 'L2', accountId: '1101', type: 'Dr', amount: 1500 },
  ],
};

const built = buildVoucherEntries(multiLine, 'SOC1');
ok(built.length === 2, 'one entry row per Dr/Cr leg');
ok(built[0].id === 'V1-L1' && built[0].cr === 1500 && built[0].dr === 0, 'a Cr leg posts to cr, and dr is 0');
ok(built[1].dr === 1500 && built[1].cr === 0, 'a Dr leg posts to dr');
ok(built[0].societyId === 'SOC1', 'the society is threaded in, not read from a context');
ok(!('workOrderId' in built[0]), 'an absent dimension is not written as undefined');

const withDim = buildVoucherEntries({ ...multiLine, workOrderId: 'WO-1' }, 'SOC1');
ok(withDim[0].workOrderId === 'WO-1', 'a present dimension is denormalized onto the entry');

// A legacy single-entry voucher synthesizes its two legs.
const legacy = { id: 'V2', amount: 500, debitAccountId: '1101', creditAccountId: '4101' };
const legacyEntries = buildVoucherEntries(legacy, 'SOC1');
ok(legacyEntries.length === 2 && legacyEntries[0].dr === 500 && legacyEntries[1].cr === 500,
  'a legacy single-entry voucher still posts two legs');

// ── 3. REPLAY OVER A SET OF VOUCHERS ─────────────────────────────────────────

const cancelled = { ...multiLine, id: 'V3', isDeleted: true };
const replayed = replayEntries([multiLine, cancelled], 'SOC1');
ok(replayed.length === 2, 'a soft-deleted voucher produces NO entries');
ok(!replayed.some(e => e.voucherId === 'V3'),
  'RULE 5: replaying a cancelled voucher would resurrect a reversed transaction into the Trial Balance');
ok(replayEntries([], 'SOC1').length === 0, 'no vouchers, no entries');

// ── 4. THE COMPARISON ────────────────────────────────────────────────────────

/** What Postgres hands back: numerics as strings, the tenant column duplicated. */
const asDbRow = (e) => ({
  ...e,
  dr: e.dr.toFixed(2),           // "1500.00"
  cr: e.cr.toFixed(2),
  society_id: 'SOC1',            // the storage duplicate of societyId
  created_at: '2026-01-01T00:00:00Z',
});

const archived = replayed.map(asDbRow);
const clean = compareReplay(replayed, archived);
ok(clean.ok === true, 'a faithful replay matches the archive');
ok(clean.disagreements.length === 0, 'with no disagreements');
ok(clean.replayedCount === 2 && clean.archivedCount === 2, 'and counts both sides');

// The two normalisations that would otherwise make EVERY row disagree.
ok(compareReplay([{ ...replayed[0], dr: 0, cr: 1500 }], [{ ...archived[0], cr: '1500.000' }]).ok,
  'a numeric read back as "1500.000" equals the number 1500 — otherwise every row disagrees');
ok(compareReplay([{ id: 'x', voucherId: 'V', dr: 0, cr: 0, accountId: 'a', societyId: 'S' }],
                 [{ id: 'x', voucherId: 'V', dr: 0, cr: 0, accountId: 'a', societyId: 'S', narration: null }]).ok,
  'an absent narration equals a null narration');

// A storage column the posting rule never produced is not a disagreement.
ok(clean.ok, 'society_id and created_at are storage detail, not the posting rule\'s output');

// ── 5. DISAGREEMENT ──────────────────────────────────────────────────────────

// A posting-rule change: the amount that lands on the ledger is different now.
const changed = compareReplay(replayed, [{ ...archived[0], cr: '1400.00' }, archived[1]]);
ok(changed.ok === false, 'a changed amount is a disagreement');
ok(changed.disagreements.length === 1 && changed.disagreements[0].field === 'cr', 'the field is named');
ok(changed.disagreements[0].replayed === '1500' && changed.disagreements[0].archived === '1400',
  'and both sides are shown');
ok(changed.vouchers.join() === 'V1', 'the VOUCHER is named — "417 entry rows differ" is not actionable');

// A leg that no longer exists, and one that appeared.
const missingLeg = compareReplay(replayed, [archived[0]]);
ok(missingLeg.ok === false && missingLeg.unexpected.join() === 'V1-L2', 'a leg the archive lacks is unexpected');

const extraLeg = compareReplay([replayed[0]], archived);
ok(extraLeg.ok === false && extraLeg.missing.join() === 'V1-L2', 'a leg the replay did not produce is missing');
ok(extraLeg.vouchers.join() === 'V1', 'and its voucher is named even though only the archive has the row');

// Every differing field, not just the first.
const twoFields = compareReplay(replayed, [{ ...archived[0], cr: '1400.00', accountId: '9999' }, archived[1]]);
ok(twoFields.disagreements.length === 2, 'every differing field is reported, not just the first');

// A voucher whose entries vanished entirely (e.g. it was cancelled after the backup).
const gone = compareReplay([], archived);
ok(gone.ok === false && gone.missing.length === 2 && gone.vouchers.join() === 'V1',
  'entries with no replayed counterpart name their voucher');

ok(summarizeReplay(clean, false).includes('match the backup exactly'), 'a clean replay says so');
ok(summarizeReplay(changed, false).includes('1 voucher(s)'), 'a dirty replay counts vouchers, not rows');
ok(summarizeReplay(changed, true).includes('रोक दिया'), 'and says the restore was stopped, in Hindi');

// ── 6. THE FIELD LIST ────────────────────────────────────────────────────────

ok(Object.isFrozen(REPLAY_FIELDS), 'the compared field list cannot be mutated at runtime');
for (const f of ['id', 'voucherId', 'accountId', 'dr', 'cr', 'societyId']) {
  ok(REPLAY_FIELDS.includes(f), `${f} is compared`);
}
// Deliberately absent, and the module says why.
ok(!REPLAY_FIELDS.includes('society_id'), 'society_id is NOT compared — it is a storage duplicate');
ok(!REPLAY_FIELDS.includes('created_at'), 'created_at is NOT compared — the posting rule does not produce it');
ok(replaySrc.includes('would NOT be caught here'), 'and the cost of that choice is written down, not hidden');

// ── 7. PURITY ────────────────────────────────────────────────────────────────

for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random', '.insert(']) {
  ok(!replaySrc.includes(forbidden), `replay.ts is pure (found "${forbidden}")`);
}

console.log(`\nRestore replay: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

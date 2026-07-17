// payloadWithoutMissingColumn — the RULE 1 guard that stops one un-migrated column
// from silently dropping every other column in a step-2 "extras" update.
//
// THE INCIDENT: purchases.rcmApplicable (added by ECR-22) was missing from the live DB.
// The step-2 update bundled it with cgst/sgst/igst/tds/taxAmount/grandTotal, so PostgREST
// rejected the WHOLE update (PGRST204) and every society's purchase GST silently vanished
// for months — only a console.warn was written. This helper drops the offending column so
// the caller retries and lands the rest.
//
// Imports the REAL src/lib/dbRetry.ts — not a reimplementation.
//
// Run: node scripts/test-db-retry.mjs   (npm run test:db-retry)

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
      import { pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        return next(spec, ctx);
      }
    `),
);

const { payloadWithoutMissingColumn } = await import(abs('../src/lib/dbRetry.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. THE ACTUAL INCIDENT: rcmApplicable missing, everything else must survive ──
const extras = { cgstPct: 0, sgstPct: 0, igstPct: 18, tdsPct: 0, tcsPct: 2, taxAmount: 738542, grandTotal: 4923611, supplierId: 'sup-1', rcmApplicable: false };
const err204 = { code: 'PGRST204', message: "Could not find the 'rcmApplicable' column of 'purchases' in the schema cache" };
const trimmed = payloadWithoutMissingColumn(err204, extras);
ok(trimmed !== null, 'a PGRST204 missing-column error yields a trimmed payload, not null');
ok(!('rcmApplicable' in trimmed), 'the offending column rcmApplicable is dropped');
ok(trimmed.igstPct === 18 && trimmed.tcsPct === 2 && trimmed.grandTotal === 4923611, 'every OTHER column survives — the GST/TCS that months of purchases lost');
ok(Object.keys(trimmed).length === Object.keys(extras).length - 1, 'exactly one key removed, no more');

// ── 2. It never mutates the caller's payload ─────────────────────────────────
ok('rcmApplicable' in extras, 'the original payload is left intact (no in-place delete)');

// ── 3. Message-shape robustness — column named without the word "schema cache" ──
ok(payloadWithoutMissingColumn({ code: 'PGRST204', message: "Could not find the 'tcsAmount' column" }, { tcsAmount: 5, x: 1 })?.tcsAmount === undefined,
  'parses the column name from a bare "Could not find the X column" message');

// ── 4. Loop to convergence — a DB missing TWO columns ────────────────────────
let pay = { a: 1, b: 2, cgstPct: 9, rcmApplicable: false };
pay = payloadWithoutMissingColumn({ code: 'PGRST204', message: "Could not find the 'rcmApplicable' column of 'x'" }, pay);
pay = payloadWithoutMissingColumn({ code: 'PGRST204', message: "Could not find the 'b' column of 'x'" }, pay);
ok(pay && pay.a === 1 && pay.cgstPct === 9 && !('b' in pay) && !('rcmApplicable' in pay), 'iterating drops each missing column, keeps the real data (a, cgstPct)');

// ── 5. SAFETY: a non-column error must NOT trim anything (caller surfaces it) ──
ok(payloadWithoutMissingColumn({ code: '23505', message: 'duplicate key value violates unique constraint' }, extras) === null, 'a unique-violation is NOT treated as a missing column');
ok(payloadWithoutMissingColumn({ code: '42501', message: 'permission denied for table purchases' }, extras) === null, 'an RLS/permission error is NOT treated as a missing column — never silently drops columns on a real failure');
ok(payloadWithoutMissingColumn(null, extras) === null, 'no error ⇒ null');
ok(payloadWithoutMissingColumn(undefined, extras) === null, 'undefined error ⇒ null');

// ── 6. SAFETY: a missing-column error naming a column NOT in the payload ⇒ null ──
// (Can't fix it by trimming; caller must stop and warn rather than loop forever.)
ok(payloadWithoutMissingColumn({ code: 'PGRST204', message: "Could not find the 'someOtherCol' column" }, { cgstPct: 9 }) === null,
  'unparseable-vs-payload ⇒ null, so the caller stops instead of looping');

// ── 7. The empty-result case: last column was the missing one ────────────────
ok(Object.keys(payloadWithoutMissingColumn({ code: 'PGRST204', message: "Could not find the 'only' column" }, { only: 1 })).length === 0,
  'dropping the sole column yields an empty object (caller checks length and stops)');

console.log(`\nDB retry (missing-column guard): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

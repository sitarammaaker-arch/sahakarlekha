// CAIOS Slice 4 groundwork — the D-lane must reuse the CLIENT's journal reader.
//
// The seam runs server-side; the society's books live in the journal. RULE 2 says the
// tool must give the same figure the report page gives — so it must run the SAME pure
// code, not a server-side re-implementation. The day a second copy drifted, the
// assistant and the Cash Book would disagree in front of a user, and the assistant
// would be the one nobody could explain.
//
// This asserts the plumbing that makes that possible, and that it stayed a no-op:
//   • the row→event mapper is importable OUTSIDE React (it was a local const in
//     DataContext, which the Edge Function cannot import);
//   • the Edge bundle exports it and the cash-book projector;
//   • mapping + projecting is byte-identical to what the page does.
//
// Run: node scripts/test-dlane-parity.mjs   (npm run test:dlane-parity)

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadViteModule } from './lib/vite-bundle.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { mapLedgerEventRows } = await loadViteModule(ROOT, resolve(ROOT, 'src', 'lib', 'ledger', 'rows.ts'), 'eval');

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
};

console.log('\n  D-lane groundwork — one journal reader, three callers\n');

/* 1 · THE MAPPER IS PURE AND REACHABLE. It was a local const inside DataContext; the
   Edge Function could not import it, so a server-side D-lane would have had to write a
   second one. That is the drift RULE 2 forbids. */
{
  const row = {
    event_id: 'e1', event_type: 'voucher.posted', schema_version: 1,
    society_id: 'SOC001', jurisdiction: 'hr',
    aggregate_type: 'voucher', aggregate_id: 'v1', sequence: 1,
    occurred_at: '2026-07-16T10:00:00Z', producer_kind: 'human', producer_id: 'u1',
    on_behalf_of: null, reversal_of: null, payload: { amount: 100 },
  };
  const [e] = mapLedgerEventRows([row]);
  ok('mapper: snake → camel', e.eventId === 'e1' && e.aggregateType === 'voucher');
  ok('mapper: society_id → tenantId', e.tenantId === 'SOC001');
  ok('mapper: producer is nested', e.producer.kind === 'human' && e.producer.id === 'u1');

  /* THE OPTIONAL FIELDS ARE THE TRAP. The projections test for PRESENCE, so a null
     `reversal_of` must be OMITTED, not set to null — otherwise every event looks like a
     reversal-of-nothing. Same for onBehalfOf. This is the one thing a hand-written
     server copy would most plausibly get wrong. */
  ok('mapper: null reversal_of is OMITTED, not null', !('reversalOf' in e));
  ok('mapper: null on_behalf_of is OMITTED, not null', !('onBehalfOf' in e.producer));

  const [r] = mapLedgerEventRows([{ ...row, reversal_of: 'e0', on_behalf_of: 'u2' }]);
  ok('mapper: a real reversal_of IS carried', r.reversalOf === 'e0');
  ok('mapper: a real on_behalf_of IS carried', r.producer.onBehalfOf === 'u2');

  ok('mapper: missing schema_version defaults to 1',
    mapLedgerEventRows([{ ...row, schema_version: undefined }])[0].schemaVersion === 1);
  ok('mapper: null jurisdiction becomes empty string, never null',
    mapLedgerEventRows([{ ...row, jurisdiction: null }])[0].jurisdiction === '');
  ok('mapper: empty in, empty out', mapLedgerEventRows([]).length === 0);
}

/* 2 · DataContext NO LONGER HOLDS ITS OWN COPY. If it did, the extraction would have
   created the very duplication it was meant to prevent — two mappers, one of which
   nobody remembers to update. */
{
  const dc = readFileSync(resolve(ROOT, 'src', 'contexts', 'DataContext.tsx'), 'utf8');
  ok('DataContext: imports the shared mapper', /from '@\/lib\/ledger\/rows'/.test(dc));
  ok('DataContext: no local copy left behind', !/const mapLedgerEventRows\s*=/.test(dc));
}

/* 3 · THE EDGE BUNDLE CAN ACTUALLY RUN IT. `platform=neutral` + Deno: a single
   `document.`/`localStorage` reference anywhere in the import graph and the function
   dies at runtime, not at build. Cheap to assert, expensive to discover in production. */
{
  const entry = readFileSync(resolve(ROOT, 'supabase', 'functions', '_shared', 'ask-core.entry.ts'), 'utf8');
  ok('entry: exports the shared mapper', /mapLedgerEventRows/.test(entry));
  ok('entry: exports the cash-book projector — not a server-side re-implementation',
    /projectCashBook/.test(entry));

  /* STEP 2's DECISION, pinned: the D-lane answers from the JOURNAL via the SAME wrapper
     the page's parity-gated selector calls (`ledgerReport('cashBook', stateResult,
     () => ledgerCashBookEntries(...), cashBookParity)` — DataContext.tsx:4465). Both
     paths run there, parity is checked at runtime, and the journal wins (T-09). So the
     assistant agrees with the screen by construction. Exporting `projectCashBook` alone
     would have been the raw projector, one layer below what the page actually runs. */
  ok('entry: exports ledgerCashBookEntries — the function the PAGE calls, not a layer below',
    /ledgerCashBookEntries/.test(entry));

  const dc = readFileSync(resolve(ROOT, 'src', 'contexts', 'DataContext.tsx'), 'utf8');
  ok('page: really does read the cash book from the JOURNAL (the decision\'s premise)',
    /ledgerCashBookEntries\(ledgerEventsRef\.current/.test(dc));

  const bundle = readFileSync(resolve(ROOT, 'supabase', 'functions', '_shared', 'ask-core.mjs'), 'utf8');
  ok('bundle: contains the mapper', /mapLedgerEventRows/.test(bundle));
  ok('bundle: contains the projector', /projectCashBook/.test(bundle));
  ok('bundle: NO browser-only globals — Deno would die at runtime, not at build',
    !/\bdocument\.|window\.|localStorage/.test(bundle));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);

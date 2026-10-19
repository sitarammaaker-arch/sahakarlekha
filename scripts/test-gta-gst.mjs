// GTA GST on transport trips — rates and conditions read from the notification texts (lib/transport/gtaGst).
//
// Guards: forward 5% = CGST 2.5; forward with ITC = CGST 6 before 22.09.2025 and 9 from it (15/2025); reverse
// charge = 5% shown for the recipient, never posted; pre-18.07.2022 dates refuse (regime not modelled);
// inter-state → IGST; forward charge needs a GSTIN, a state and the Annexure V confirmation; RCM needs a
// customer GSTIN or the 13/2017 category confirmation; the forward-charge narration carries the Annexure III
// declaration; and the context posts a 2201 line only for forward charge.
//
// Run: node scripts/test-gta-gst.mjs   (npm run test:gta-gst)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

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
      export async function resolve(spec, ctx, next) {
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
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;


import { readFileSync } from 'node:fs';
const G = await import(abs('../src/lib/transport/gtaGst.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

ok(G.gtaCgstPct('none', '2026-10-19') === 0, 'none → 0');
ok(G.gtaCgstPct('fcm5', '2026-10-19') === 2.5 && G.gtaCgstPct('rcm', '2026-10-19') === 2.5, '5% options → CGST 2.5');
ok(G.gtaCgstPct('fcm18', '2025-09-21') === 6 && G.gtaCgstPct('fcm18', '2025-09-22') === 9, 'with-ITC option: 6 → 9 on 22.09.2025 (15/2025)');
ok(G.gtaCgstPct('fcm18', '2022-07-17') === null && G.gtaCgstPct('rcm', '2022-07-17') === null && G.gtaCgstPct('fcm5', '2022-07-18') === 2.5, 'before 18.07.2022 → not modelled');

ok(eq(G.gtaTax('fcm18', '2026-10-19', 10000, false), { cgst: 900, sgst: 900, igst: 0, total: 1800, ratePct: 18 }), 'intra-state 18%: 900 + 900');
ok(eq(G.gtaTax('fcm5', '2026-10-19', 10000, true), { cgst: 0, sgst: 0, igst: 500, total: 500, ratePct: 5 }), 'inter-state 5%: IGST 500');
ok(G.gtaTax('fcm18', '2025-01-01', 1000, false).total === 120, 'before 22.09.2025 the with-ITC option is 12%');
ok(G.gtaTax('fcm5', '2026-10-19', 333.33, false).cgst === 8.33, 'rounded to paise');

const base = { date: '2026-10-19', societyGstin: '06ABCDE1234F1Z5', societyStateCode: '06', customerHasGstin: false };
ok(G.gtaModeProblem({ ...base, mode: 'none' }) === null, 'none never blocks');
ok(G.gtaModeProblem({ ...base, mode: 'rcm' }) !== null && G.gtaModeProblem({ ...base, mode: 'rcm', rcmRecipientConfirmed: true }) === null && G.gtaModeProblem({ ...base, mode: 'rcm', customerHasGstin: true }) === null, 'RCM needs a GSTIN or the 13/2017 category confirmation');
ok(G.gtaModeProblem({ ...base, mode: 'fcm18' }) !== null && G.gtaModeProblem({ ...base, mode: 'fcm18', forwardOptionConfirmed: true }) === null, 'forward charge needs the Annexure V confirmation');
ok(G.gtaModeProblem({ ...base, societyGstin: '', mode: 'fcm5', forwardOptionConfirmed: true }) !== null, 'forward charge needs the society GSTIN');
ok(G.gtaModeProblem({ ...base, societyStateCode: '', mode: 'fcm5', forwardOptionConfirmed: true }) !== null, 'forward charge needs the society state');
ok(G.gtaModeProblem({ ...base, date: '2022-01-01', mode: 'rcm', rcmRecipientConfirmed: true }) !== null, 'pre-July-2022 trip refuses a GST mode');

const fcmNote = G.gtaNarration('fcm18', G.gtaTax('fcm18', '2026-10-19', 1000, false), '2026-27');
ok(fcmNote.includes('exercised the option to pay tax on services of GTA') && fcmNote.includes('2026-27'), 'forward-charge note carries the Annexure III declaration with the FY');
ok(G.gtaNarration('rcm', G.gtaTax('rcm', '2026-10-19', 1000, false), '2026-27').includes('13/2017'), 'RCM note cites 13/2017');
ok(G.gtaNarration('none', null, '2026-27') === '', 'none → no note');
ok(G.GTA_GST_SOURCES.length >= 5 && G.GTA_GST_SOURCES.every(s => /^https:\/\//.test(s.url) && s.ref && s.says), 'every rule carries a source URL');

// The context posts GST only for forward charge.
const ctx = readFileSync(new URL('../src/contexts/TransportOpsContext.tsx', import.meta.url), 'utf8');
ok(/const forward = \(gstMode === 'fcm5' \|\| gstMode === 'fcm18'\)/.test(ctx) && /accountId: gstAccountId!, type: 'Cr'/.test(ctx), 'context adds the Cr 2201 line only when forward');

console.log(`\ngta-gst: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

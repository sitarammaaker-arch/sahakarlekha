// Governance authority for financial finalization (T-23 / UCAS CM-2; AI Art. III; API-P8; CL-7).
//
// Proves the "human authority" the AI/API constitutions invoke is grounded in a recorded
// governance act: appropriation/dividend need AGM adoption, FY-close a board resolution, a loan
// the loan committee; the attestation must carry a reference + date + authorizer; SoD forbids
// the authorizer being the preparer; and the recorded attestation is what gets stamped on the
// finalization event (composing T-20 appropriation + T-06 event).
//
// Run: node scripts/test-governance-authority.mjs   (npm run test:governance-authority)

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

let gov, ap, money, ev;
try {
  gov = await import(abs('../src/lib/governance/authority.ts'));
  ap = await import(abs('../src/lib/rules/appropriation.ts'));
  money = await import(abs('../src/lib/money.ts'));
  ev = await import(abs('../src/lib/ledger/event.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the governance/appropriation modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { FINALIZATION_AUTHORITY, authorizeFinalization } = gov;
const { computeAppropriation, appropriationToLines } = ap;
const { toMinor } = money;
const { buildEvent } = ev;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const AGM = { kind: 'agm_adoption', reference: 'AGM/2026/Res-4', date: '2026-09-15', authorizedBy: 'chairman' };

// ── 1. WHICH ACT NEEDS WHICH AUTHORITY (UCAS CM-2) ───────────────────────────
ok(FINALIZATION_AUTHORITY.appropriation === 'agm_adoption', 'appropriation of surplus needs AGM adoption');
ok(FINALIZATION_AUTHORITY.dividend_declaration === 'agm_adoption', 'dividend declaration needs AGM adoption');
ok(FINALIZATION_AUTHORITY.fy_close === 'board_resolution', 'FY close needs a board resolution');
ok(FINALIZATION_AUTHORITY.loan_sanction === 'loan_committee', 'a loan is sanctioned by the loan committee');

// ── 2. AUTHORIZED — correct authority + SoD ──────────────────────────────────
const good = authorizeFinalization({ act: 'appropriation', preparedBy: 'secretary', attestation: AGM });
ok(good.ok && good.recorded && good.recorded.reference === 'AGM/2026/Res-4',
  'appropriation with a valid AGM adoption (by the chairman, prepared by the secretary) is authorized, and the attestation is returned to record');

// ── 3. REFUSED — no authority, wrong authority, incomplete, SoD ──────────────
ok(!authorizeFinalization({ act: 'appropriation', preparedBy: 'secretary' }).ok, 'no attestation → refused');
ok(authorizeFinalization({ act: 'appropriation', preparedBy: 'secretary' }).problems[0].includes('agm_adoption'),
  'and the reason names the required authority');
ok(!authorizeFinalization({ act: 'appropriation', preparedBy: 'secretary', attestation: { ...AGM, kind: 'board_resolution' } }).ok,
  'the WRONG authority (board resolution for an appropriation) → refused');
ok(!authorizeFinalization({ act: 'appropriation', preparedBy: 'secretary', attestation: { ...AGM, reference: '' } }).ok,
  'an attestation with no reference → refused');
ok(!authorizeFinalization({ act: 'appropriation', preparedBy: 'secretary', attestation: { ...AGM, date: '' } }).ok,
  'an attestation with no date → refused');

// SoD: the authorizer must not be the preparer.
const sod = authorizeFinalization({ act: 'appropriation', preparedBy: 'chairman', attestation: AGM });
ok(!sod.ok && sod.problems.some((p) => p.includes('segregation of duties')),
  'SoD: the authorizer cannot also be the preparer (AI Art. III.2 / API AUTH-6)');

// loan_sanction with the right authority passes.
ok(authorizeFinalization({ act: 'loan_sanction', preparedBy: 'clerk', attestation: { kind: 'loan_committee', reference: 'LC/2026/12', date: '2026-05-01', authorizedBy: 'committee' } }).ok,
  'a loan sanctioned by the loan committee is authorized');

// ── 4. END-TO-END — authority is stamped on the finalization event (T-20/T-06) ─
const plan = computeAppropriation({ netSurplusMinor: toMinor(100000), shareCapitalMinor: toMinor(200000) }, { asOf: '2026-06-01' });
const verdict = authorizeFinalization({ act: 'appropriation', preparedBy: 'secretary', attestation: AGM });
ok(verdict.ok, 'the appropriation is authorized before it is posted');
const legs = appropriationToLines(plan, { appropriation: 'P&L-APPROP', reserve_fund: 'RESERVE', education_fund: 'EDU', bye_law_reserves: 'BYELAW', dividend: 'DIV', patronage_bonus: 'BONUS', charitable: 'CHARITY' });
const apprEvent = buildEvent(
  { eventType: 'appropriation.posted', tenantId: 'S', aggregateType: 'appropriation', aggregateId: 'FY26', sequence: 1,
    producer: { kind: 'human', id: 'secretary' }, payload: { lines: legs, authority: verdict.recorded } },
  { eventId: 'appr1', occurredAt: '2026-09-15T00:00:00Z' },
);
ok(apprEvent.payload.authority && apprEvent.payload.authority.reference === 'AGM/2026/Res-4',
  'the posted appropriation event RECORDS the AGM authority (the audit chain: figure → governance act, CL-7)');

console.log(`\nGovernance authority: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

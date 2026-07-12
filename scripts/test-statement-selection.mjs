// Statement selection — which statements a society renders (T-21 / UCAS Part D; ADR-0002).
//
// Proves the statement set is driven by CAPABILITIES, not type: a trading society gets a
// Trading A/c (not I&E), a service society gets I&E (not Trading), a credit society gets a DCB,
// statutory returns gate on the legal type, and a Multipurpose society selects several at once.
// The end-to-end cases resolve REAL capabilities per society type (composing T-11).
//
// Run: node scripts/test-statement-selection.mjs   (npm run test:statement-selection)

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
        if (url === SUPABASE) return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' };
        return next(url, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let st, res;
try {
  st = await import(abs('../src/lib/reports/statements.ts'));
  res = await import(abs('../src/lib/navigation/capabilityResolver.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the statement/resolver modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { STATEMENT_REGISTRY, selectStatements, selectStatementCodes } = st;
const { resolveCapabilities } = res;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const codesFor = (caps, legalType = 'other') => selectStatementCodes({ capabilities: new Set(caps), legalType });

// ── 1. UNIVERSAL statements are always rendered ──────────────────────────────
const none = codesFor([]);
for (const u of ['trial_balance', 'receipts_payments', 'pl_appropriation', 'balance_sheet']) {
  ok(none.includes(u), `${u} is universal — rendered even with no capabilities`);
}

// ── 2. TRADING vs SERVICE — mutually exclusive on inventory_sales ─────────────
const trading = codesFor(['inventory_sales', 'gst']);
ok(trading.includes('trading_ac') && trading.includes('profit_loss'), 'a trading society (inventory_sales) renders Trading + P&L');
ok(!trading.includes('income_expenditure'), 'and NOT Income & Expenditure');

const service = codesFor(['housing', 'tds']);
ok(service.includes('income_expenditure'), 'a service society (no inventory_sales) renders Income & Expenditure');
ok(!service.includes('trading_ac'), 'and NOT a Trading A/c');
ok(service.includes('maintenance_dues'), 'a housing society renders Maintenance Dues');

// ── 3. CAPABILITY registers ──────────────────────────────────────────────────
ok(codesFor(['lending']).includes('dcb'), 'a credit society (lending) renders the DCB');
ok(!codesFor(['inventory_sales']).includes('dcb'), 'a non-credit society does NOT render the DCB');
ok(codesFor(['deposit_ledger']).includes('deposit_statement'), 'deposits → the Deposit Statement');
ok(codesFor(['dairy_collection']).includes('milk_payment_sheet'), 'dairy → the Milk Payment Sheet');
ok(codesFor(['subsidy_reconciliation']).includes('subsidy_claim'), 'subsidy → the Subsidy Claim Statement');

// ── 4. STATUTORY — the ONE legal-type gate ───────────────────────────────────
ok(selectStatementCodes({ capabilities: new Set(['lending']), legalType: 'pacs' }).includes('nabard_return'),
  'a PACS renders the NABARD/RCS statutory return (Tier-3 legal-type gate)');
ok(!selectStatementCodes({ capabilities: new Set(['lending']), legalType: 'consumer' }).includes('nabard_return'),
  'a non-PACS with the same capabilities does NOT render the NABARD return (type gates ONLY statutory reports)');

// ── 5. MULTIPURPOSE — many statements at once (real capabilities, T-11) ───────
const multiCaps = resolveCapabilities('multipurpose', [], Date.parse('2026-07-12T00:00:00Z'));
const multi = selectStatementCodes({ capabilities: multiCaps, legalType: 'multipurpose' });
ok(multi.includes('trading_ac') && multi.includes('dcb') && multi.includes('milk_payment_sheet') && multi.includes('deposit_statement'),
  'a Multipurpose society renders Trading + DCB + Milk sheet + Deposit statement CONCURRENTLY (the multipurpose thesis)');
ok(!multi.includes('income_expenditure'), 'and NOT I&E — it trades (has inventory_sales)');

// A dairy society (real caps) → milk sheet + Trading, no DCB.
const dairyCaps = resolveCapabilities('dairy', [], Date.parse('2026-07-12T00:00:00Z'));
const dairy = selectStatementCodes({ capabilities: dairyCaps, legalType: 'dairy' });
ok(dairy.includes('milk_payment_sheet') && dairy.includes('trading_ac') && !dairy.includes('dcb'),
  'a dairy society renders the Milk sheet + Trading, but not the DCB');

// ── 6. REGISTRY consistency ──────────────────────────────────────────────────
const allCodes = STATEMENT_REGISTRY.map((s) => s.code);
ok(new Set(allCodes).size === allCodes.length, 'statement codes are unique');
ok(STATEMENT_REGISTRY.every((s) => s.code && s.label && s.labelHi && s.tier), 'every statement has code, label, Hindi label and tier');
ok(STATEMENT_REGISTRY.every((s) =>
  (s.tier !== 'capability' || !!s.requiredCapability) &&
  (s.tier !== 'negative_capability' || !!s.absentCapability) &&
  (s.tier !== 'statutory' || (Array.isArray(s.requiredLegalTypes) && s.requiredLegalTypes.length > 0))),
  'each tier carries the field it needs (capability / absentCapability / legalTypes)');

console.log(`\nStatement selection (UCAS Part D): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

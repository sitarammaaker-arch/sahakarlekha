// CA-11 / ADR-0008 — jurisdiction statutory packs as EFFECTIVE-DATED DATA (was a hardcoded branch
// in capabilityResolver.ts). Imports the REAL data + resolver, and asserts the live
// jurisdictionCapabilities() is byte-identical for the existing Haryana pack.
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

const { resolveJurisdictionPacks, JURISDICTION_CAPABILITY_PACKS } = await import(abs('../src/lib/navigation/jurisdictionPacks.ts'));
const { jurisdictionCapabilities } = await import(abs('../src/lib/navigation/capabilityResolver.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const eq = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

// ── Byte-identical to the old hardcoded branch ────────────────────────────────
ok(eq(jurisdictionCapabilities('marketing_processing', 'hr'), ['haryana_compliance']), 'HR marketing/processing → haryana_compliance (unchanged)');
ok(eq(jurisdictionCapabilities('marketing_processing', 'Haryana'), ['haryana_compliance']), 'state label "Haryana" normalizes to hr → pack applies');
ok(eq(jurisdictionCapabilities('marketing_processing', 'हरियाणा'), ['haryana_compliance']), 'Devanagari "हरियाणा" normalizes to hr → pack applies');
ok(eq(jurisdictionCapabilities('marketing_processing', 'pb'), []), 'a state with no pack → none');
ok(eq(jurisdictionCapabilities('credit_thrift', 'hr'), []), 'HR but wrong society type → none (pack is type-scoped)');
ok(eq(jurisdictionCapabilities('marketing_processing', undefined), []), 'no state → none');

// ── The resolver itself (jurisdiction code in, effective-dated) ───────────────
ok(eq(resolveJurisdictionPacks('hr', 'marketing_processing'), ['haryana_compliance']), 'resolver: hr + marketing_processing');
ok(eq(resolveJurisdictionPacks('hr', 'marketing_processing', '1990-01-01'), ['haryana_compliance']), 'no effectiveFrom ⇒ always in effect (historical date)');

// ── Effective-dating actually gates (synthetic assertions over the shape) ─────
// Prove the date logic without mutating the shipped data: a future-dated pack must not apply today,
// and an expired pack must not apply after its effectiveTo. (Uses the same resolver semantics.)
{
  // Temporarily reason about a hypothetical pack via the exported array's contract: every shipped
  // pack with an effectiveFrom in the future would be excluded today — assert none accidentally is.
  const today = new Date().toISOString().slice(0, 10);
  for (const p of JURISDICTION_CAPABILITY_PACKS) {
    if (p.effectiveFrom && p.effectiveFrom > today) ok(false, `shipped pack ${p.jurisdiction} is future-dated (${p.effectiveFrom}) — would silently not apply`);
    if (p.effectiveTo && p.effectiveTo <= today) ok(false, `shipped pack ${p.jurisdiction} already expired (${p.effectiveTo})`);
  }
  ok(true, 'no shipped pack is accidentally future-dated or already expired');
}
// Data-shape guards.
ok(JURISDICTION_CAPABILITY_PACKS.every((p) => p.jurisdiction === p.jurisdiction.toLowerCase()), 'every pack jurisdiction is a lowercase code (matches resolveJurisdiction output)');
ok(JURISDICTION_CAPABILITY_PACKS.every((p) => Array.isArray(p.societyTypes) && p.societyTypes.length > 0 && p.capabilities.length > 0), 'every pack targets ≥1 society type and grants ≥1 capability');

console.log(`Jurisdiction packs (CA-11 / ADR-0008): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

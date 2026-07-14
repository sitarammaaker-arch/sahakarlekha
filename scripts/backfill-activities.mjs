// Activity backfill (T-12 / ADR-0003, MR-1) — seeds `society_activities` from each society's TYPE,
// so a per-tenant cutover (society_settings.activitiesCutoverEnabled = true) resolves capabilities
// with EMPTY-DIFF parity. PURE decisions live in src/lib/navigation/activityInference.ts
// (planActivityBackfill); this script only does the Supabase I/O.
//
// SAFE BY DESIGN:
//   • DRY-RUN by default — prints the plan and writes nothing. Pass --commit to write.
//   • Only societies whose inferred activities reproduce their CURRENT entitlement (hasCutoverParity)
//     are seeded. A society with a license grant no activity covers is SKIPPED and listed for manual
//     review — never silently backfilled into a module loss.
//   • Writing rows is DORMANT: the resolver ignores society_activities until that tenant's cutover
//     flag is flipped. This script NEVER flips the flag — the cutover stays a separate manual step.
//   • Idempotent: deterministic row ids + skip already-declared activities, so re-runs are safe.
//
// Env: SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY (preferred — bypasses RLS to read every tenant)
//      or SUPABASE_ANON_KEY. Run:
//   node scripts/backfill-activities.mjs             # dry-run (report only)
//   node scripts/backfill-activities.mjs --commit    # actually write the rows
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

const COMMIT = process.argv.includes('--commit');
const env = process.env;
const URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.error('Missing env. Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY.');
  process.exit(2);
}
const USING_SERVICE = !!env.SUPABASE_SERVICE_ROLE_KEY;

const { planActivityBackfill } = await import(abs('../src/lib/navigation/activityInference.ts'));
const { createClient } = await import('@supabase/supabase-js');
const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const fail = (msg, err) => { console.error(`✗ ${msg}${err ? ': ' + (err.message || err) : ''}`); process.exit(1); };

// ── Read the three inputs ──────────────────────────────────────────────────────────────────────
const { data: societies, error: sErr } = await db.from('society_settings').select('id, society_id, societyType, state');
if (sErr) fail('read society_settings', sErr);
const { data: caps, error: cErr } = await db.from('society_capabilities').select('society_id, capability, mode, source, expires_at');
if (cErr) fail('read society_capabilities', cErr);
const { data: acts, error: aErr } = await db.from('society_activities').select('society_id, activity, status, isDeleted');
if (aErr) fail('read society_activities', aErr);

// ── Group by society and build the planner input ─────────────────────────────────────────────────
const sidOf = (r) => r.society_id ?? r.id;
const capsBySid = new Map();
for (const r of caps ?? []) {
  const list = capsBySid.get(r.society_id) ?? [];
  list.push({ capability: r.capability, mode: r.mode, source: r.source, expiresAt: r.expires_at ?? null });
  capsBySid.set(r.society_id, list);
}
const existingBySid = new Map();
for (const r of acts ?? []) {
  if (r.isDeleted) continue;
  const list = existingBySid.get(r.society_id) ?? [];
  list.push(r.activity);
  existingBySid.set(r.society_id, list);
}
const inputs = (societies ?? []).map((s) => {
  const societyId = sidOf(s);
  return {
    societyId,
    societyType: s.societyType ?? 'other',
    state: s.state,
    rows: capsBySid.get(societyId) ?? [],
    existing: existingBySid.get(societyId) ?? [],
  };
});

const plans = planActivityBackfill(inputs);

// ── Report ───────────────────────────────────────────────────────────────────────────────────────
const toWrite = plans.filter((p) => p.rowsToInsert.length > 0);
const noParity = plans.filter((p) => p.skipped === 'no-parity');
const already = plans.filter((p) => p.skipped === 'already-declared');
const allRows = toWrite.flatMap((p) => p.rowsToInsert);

console.log(`\nActivity backfill ${COMMIT ? '(COMMIT)' : '(DRY-RUN)'} — key: ${USING_SERVICE ? 'service-role' : 'anon'}`);
console.log(`  societies read:        ${inputs.length}`);
console.log(`  to seed (parity ok):   ${toWrite.length}  →  ${allRows.length} society_activities rows`);
console.log(`  already declared:      ${already.length}`);
console.log(`  SKIPPED (no parity):   ${noParity.length}${noParity.length ? '  ⚠ manual review:' : ''}`);
for (const p of noParity) console.log(`      - ${p.societyId} (${p.societyType}) — inferred [${p.inferred.join(', ')}] does not cover its entitlement`);
for (const p of toWrite) console.log(`    + ${p.societyId} (${p.societyType}): ${p.rowsToInsert.map((r) => r.activity).join(', ')}`);

if (!COMMIT) {
  console.log('\nDRY-RUN — nothing written. Re-run with --commit to seed the rows above.');
  console.log('Note: seeding is DORMANT until you set society_settings.activitiesCutoverEnabled = true per tenant.');
  process.exit(0);
}

if (allRows.length === 0) { console.log('\nNothing to write.'); process.exit(0); }

// ── Commit — upsert on the deterministic id (idempotent). Never touches the cutover flag. ──────────
const { error: wErr } = await db.from('society_activities').upsert(allRows, { onConflict: 'id' });
if (wErr) fail('write society_activities', wErr);
console.log(`\n✓ Wrote ${allRows.length} society_activities rows across ${toWrite.length} societies (dormant — flag not flipped).`);
if (noParity.length) console.log(`⚠ ${noParity.length} society(ies) skipped for manual review — see the list above BEFORE flipping their cutover flag.`);
process.exit(0);

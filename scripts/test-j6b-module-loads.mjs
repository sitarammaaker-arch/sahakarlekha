#!/usr/bin/env node
// J6b · domain contexts load their tables only when their capability is on — resolved with the SAME
// resolver the sidebar/CapabilityGuard use. Pins what each production society type gets, so a type
// never silently loses its module data, and the wiring in the three contexts.
// Run: node scripts/test-j6b-module-loads.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as PR } from 'node:path';
import { readFileSync } from 'node:fs';
const root = PR(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = PR(root, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }`));
const { navigationService } = await import(pathToFileURL(PR(SRC, 'lib/navigation/navigationService.ts')).href);
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };

const has = (type, cap) => navigationService.resolveCapabilities(type, [], 'hr', [], false).has(cap);
const report = {};
for (const t of ['marketing_processing', 'other', 'consumer', 'housing', 'labour', 'dairy', 'pacs', 'multipurpose']) {
  report[t] = ['housing', 'labour', 'pf_esi', 'dairy_collection'].filter((c) => has(t, c)).join(',') || '—';
}
console.log('  capability by type:', JSON.stringify(report));
ok('housing societies load housing', has('housing', 'housing'));
ok('labour societies load labour', has('labour', 'labour'));
ok('dairy societies load dairy', has('dairy', 'dairy_collection'));
ok('a marketing society loads none of housing/labour/dairy', !has('marketing_processing', 'housing') && !has('marketing_processing', 'labour') && !has('marketing_processing', 'dairy_collection'));

for (const [ctx, caps] of [['Housing', "['housing']"], ['Labour', "['labour', 'pf_esi']"], ['Dairy', "['dairy_collection']"]]) {
  const s = readFileSync(PR(SRC, `contexts/${ctx}DataContext.tsx`), 'utf8');
  ok(`${ctx}: loads gated on ${caps}`, s.includes(`useCapabilityEnabled(${caps})`) && s.includes('const loadSid = moduleOn ? user?.societyId : undefined;'));
  ok(`${ctx}: every load effect keys on loadSid (none on the raw society id)`, !s.includes('const sid = user?.societyId;') && !s.includes('}, [user?.societyId]);'));
}
const hook = readFileSync(PR(SRC, 'contexts/useCapabilityEnabled.ts'), 'utf8');
const guard = readFileSync(PR(SRC, 'components/CapabilityGuard.tsx'), 'utf8');
ok('the hook resolves exactly like CapabilityGuard', /navigationService\.resolveCapabilities\(\s*society\.societyType \?\? 'other', societyCapabilities, society\.state,\s*declaredActivities\(societyActivities\), society\.activitiesCutoverEnabled/.test(hook)
  && /navigationService\.resolveCapabilities\(societyType, societyCapabilities, society\.state, declaredActivities\(societyActivities\), society\.activitiesCutoverEnabled\)/.test(guard));

console.log(`\nJ6b module loads: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

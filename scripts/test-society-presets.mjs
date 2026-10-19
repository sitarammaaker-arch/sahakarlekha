// CM-PACS preset (Phase 1) — a preset is a NAME on a legal type, never a new SocietyType.
//
// Guards: CM-PACS saves as legal type 'multipurpose' + Haryana; picking a plain type CLEARS the
// variant with null (undefined would be dropped from the upsert JSON and the DB would keep 'cm_pacs');
// a variant that does not match the saved legal type is ignored for display and the dropdown;
// SocietyType is unchanged (no 'cm_pacs' type leaks into capability templates).
//
// Run: node scripts/test-society-presets.mjs   (npm run test:society-presets)

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

const P = await import(abs('../src/lib/societyPresets.ts'));
const C = await import(abs('../src/lib/constants.ts'));
const STC = await import(abs('../src/lib/navigation/societyTypeCapabilities.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const cm = P.SOCIETY_PRESETS.cm_pacs;
ok(cm.legalType === 'multipurpose' && cm.state === 'hr', 'CM-PACS = multipurpose + Haryana');
ok(C.SOCIETY_TYPES.some(t => t.value === cm.legalType), 'preset legal type is a real SocietyType');
ok(C.INDIAN_STATES.some(s => s.value === cm.state), 'preset state is a real INDIAN_STATES code');
ok(!('cm_pacs' in STC.SOCIETY_TYPE_CAPABILITIES) && !C.SOCIETY_TYPES.some(t => t.value === 'cm_pacs'), 'no cm_pacs SocietyType');

ok(eq(P.resolveTypeChoice(P.presetChoice('cm_pacs')), { societyType: 'multipurpose', societyVariant: 'cm_pacs', state: 'hr' }), 'preset choice → multipurpose + cm_pacs + hr');
ok(eq(P.resolveTypeChoice('pacs'), { societyType: 'pacs', societyVariant: null }), 'plain type clears the variant with null');
ok(P.resolveTypeChoice('preset:bogus').societyVariant === null, 'unknown preset → no variant');

ok(P.typeChoiceOf('multipurpose', 'cm_pacs') === 'preset:cm_pacs', 'saved CM-PACS → preset option');
ok(P.typeChoiceOf('multipurpose', null) === 'multipurpose', 'plain multipurpose stays plain');
ok(P.typeChoiceOf('pacs', 'cm_pacs') === 'pacs', 'variant on a mismatched legal type is ignored');
ok(P.typeChoiceOf('', null) === '', 'nothing chosen → empty');

ok(P.presetsForState('hr').length === 1 && P.presetsForState('pb').length === 0 && P.presetsForState('').length === 1, 'CM-PACS offered only for Haryana (or before a state is picked)');

const T = C.SOCIETY_TYPES;
ok(P.societyTypeDisplay({ societyType: 'multipurpose', societyVariant: 'cm_pacs' }, T, true).startsWith('CM-PACS (हरियाणा)'), 'Hindi display = CM-PACS (हरियाणा)');
ok(P.societyTypeDisplay({ societyType: 'multipurpose', societyVariant: 'cm_pacs' }, T, false).startsWith('CM-PACS (Haryana)'), 'English display = CM-PACS (Haryana)');
ok(P.societyTypeDisplay({ societyType: 'pacs', societyVariant: 'cm_pacs' }, T, false) === T.find(t => t.value === 'pacs').label, 'mismatched variant → plain type label');
ok(P.societyTypeDisplay({ societyType: 'dairy' }, T, true) === T.find(t => t.value === 'dairy').labelHi, 'no variant → type label');

console.log(`\nsociety-presets: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

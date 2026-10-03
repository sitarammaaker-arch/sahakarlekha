// GSTR-1 place of supply helpers (audit C-11: '09' was hard-coded for every society;
// C-12: B2B detection read only the legacy gstNo field).
// Run: node scripts/test-gst-pos.mjs   (npm run test:gst-pos)
import { partyGstin, societyStateCode, placeOfSupply } from '../src/lib/gstStates.ts';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

ok(partyGstin({ gstin: '06aaaaa0000a1z5' }) === '06AAAAA0000A1Z5', 'gstin read + uppercased');
ok(partyGstin({ gstNo: '07AAAAA0000A1Z5' }) === '07AAAAA0000A1Z5', 'legacy gstNo still read');
ok(partyGstin({ gstin: '06AAAAA0000A1Z5', gstNo: '07AAAAA0000A1Z5' }) === '06AAAAA0000A1Z5', 'gstin wins over gstNo');
ok(partyGstin(undefined) === '' && partyGstin(null) === '', 'missing party -> empty (B2C)');

ok(societyStateCode({ gstin: '06AAAAA0000A1Z5' }) === '06', 'society code from GSTIN prefix (Haryana)');
ok(societyStateCode({ gstin: '29AAAAA0000A1Z5', state: 'hr' }, 'Haryana') === '29', 'GSTIN beats state label');
ok(societyStateCode({ state: 'hr' }, 'Haryana') === '06', 'falls back to state name');
ok(societyStateCode({}) === '', 'unknown -> empty (never a guessed 09)');
ok(societyStateCode({ gstin: 'bad', state: 'xx' }, 'Nowhere') === '', 'garbage GSTIN + unknown state -> empty');

ok(placeOfSupply('09AAAAA0000A1Z5', undefined, '06') === '09', 'registered recipient: inter-state POS from its GSTIN');
ok(placeOfSupply(undefined, 'Punjab', '06') === '03', 'unregistered recipient with state name');
ok(placeOfSupply(undefined, undefined, '06') === '06', 'no recipient info: supplier state (intra-state default)');
ok(placeOfSupply('06AAAAA0000A1Z5', undefined, '') === '06', 'GSTIN prefix works even if society code unknown');

console.log(`\nGST place of supply: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

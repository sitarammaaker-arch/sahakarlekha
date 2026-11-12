// Asset ledgers are resolved per chart, never by a fixed id that means another head there
// (2026-11-12 chart audit, F-03): housing 5502 is "Dep. - Lift", dairy 5502 "Dep. - Chilling Plant", housing 3104
// "Lift / Elevator" — a Furniture / Vehicle asset must not post to them. lib/assetHeads decides; the purchase,
// disposal and depreciation paths use it and refuse when a head is missing.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await import('./gen-migration-163.mjs');   // registers the '@/…' loader
const imp = (p) => import(new URL('../src/' + p, import.meta.url).href);
const S = await imp('lib/storage.ts');
const H = await imp('lib/assetHeads.ts');
const D = await imp('lib/assetDisposal.ts');
const DEP = await imp('lib/depreciation.ts');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const src = (p) => readFileSync(path.join(ROOT, 'src', p), 'utf8');
const CATS = ['Land', 'Building', 'Furniture', 'Vehicle', 'Equipment', 'Computer', 'Other'];
const name = (chart, id) => chart.find((a) => a.id === id)?.name;

// ── Charts where the conventional ids ARE the heads: nothing changes ─────────────────────────────────────────
for (const t of ['marketing_processing', 'pacs', 'consumer', 'transport']) {
  const chart = S.fullChartForType(t);
  for (const c of CATS) {
    const h = H.resolveAssetHeads(c, chart);
    ok(h.costId === D.ASSET_ACCOUNTS[c], `${t}: ${c} cost → ${D.ASSET_ACCOUNTS[c]} (${name(chart, D.ASSET_ACCOUNTS[c])})`);
    const dep = DEP.DEP_ACCOUNTS[c];
    ok(h.expenseId === (dep?.expenseId ?? null) && h.accumId === (dep?.accumId ?? null), `${t}: ${c} depreciation heads are the conventional ones${dep ? ` (${dep.expenseId} / ${dep.accumId})` : ' (none for Land)'}`);
  }
}

// ── Charts where a conventional id is ANOTHER head: never resolved to it ─────────────────────────────────────
const housing = S.fullChartForType('housing');
const dairy = S.fullChartForType('dairy');
const sugar = S.fullChartForType('sugar');
ok(name(housing, '5502') === 'Dep. - Lift' && name(housing, '3104') === 'Lift / Elevator' && name(dairy, '5502') === 'Dep. - Chilling Plant', 'fixture: the housing / dairy charts really reuse these ids');
ok(H.resolveAssetHead('depExpense', 'Furniture', housing) !== '5502' && H.resolveAssetHead('depExpense', 'Furniture', dairy) !== '5502', 'Furniture depreciation never goes to "Dep. - Lift" / "Dep. - Chilling Plant"');
ok(H.resolveAssetHead('accumDep', 'Furniture', housing) !== '3109' && H.resolveAssetHead('accumDep', 'Furniture', dairy) !== '3109', '… nor its accumulated depreciation to the Lift / Chilling Plant head');
ok(H.resolveAssetHead('cost', 'Vehicle', housing) !== '3104', 'a Vehicle is never capitalised under "Lift / Elevator"');
ok(H.resolveAssetHead('depExpense', 'Vehicle', housing) !== '5503' && H.resolveAssetHead('accumDep', 'Vehicle', housing) !== '3110', 'housing: Vehicle depreciation never goes to the "Equipment" heads at 5503 / 3110');
// Every resolved id, in every chart, is a ledger of the right kind whose name says the category.
const WORDS = { Land: /land/i, Building: /build/i, Furniture: /furnitur/i, Vehicle: /vehicle/i, Equipment: /plant|machin|refriger|cold storage|generator|pump/i, Computer: /comput|office equip|it equip/i, Other: /equip/i };
for (const [t, chart] of [['housing', housing], ['dairy', dairy], ['sugar', sugar]]) {
  let bad = 0, resolved = 0;
  for (const c of CATS) for (const k of ['cost', 'depExpense', 'accumDep']) {
    const id = H.resolveAssetHead(k, c, chart);
    if (!id) continue;
    resolved++;
    const a = chart.find((x) => x.id === id);
    const rightKind = k === 'depExpense' ? a.type === 'expense' : a.type === 'asset' && (k === 'accumDep') === /accum/i.test(a.name);
    if (a.isGroup || !rightKind || !WORDS[c].test(a.name)) { bad++; console.error(`    ${t} ${c} ${k} → ${id} "${a.name}"`); }
  }
  ok(bad === 0 && resolved > 0, `${t}: every resolved head is a ledger of the right kind named for its category (${resolved} resolved)`);
}
ok(H.resolveAssetHead('depExpense', 'Building', housing) === '5501' && H.resolveAssetHead('accumDep', 'Building', dairy) === '3108', 'a head that IS right at its conventional id is still used (Building)');
ok(H.resolveAssetHead('cost', 'Equipment', dairy) === '3105' && name(dairy, '3105') === 'Chilling Plant & BMC', 'dairy: plant is plant');

// A society that made its own ledger: found by name when exactly one fits; two ⇒ unresolved, never a guess.
const withOwn = [...housing, { id: 'u1', name: 'Dep. - Furniture', type: 'expense', parentId: '5500', isGroup: false }];
ok(H.resolveAssetHead('depExpense', 'Furniture', withOwn) === 'u1', 'a single ledger named for the category is used');
ok(H.resolveAssetHead('depExpense', 'Furniture', [...withOwn, { id: 'u2', name: 'Furniture Depreciation', type: 'expense', parentId: '5500', isGroup: false }]) === null, 'two candidates ⇒ unresolved');
ok(H.resolveAssetHead('cost', 'Furniture', [{ id: '3103', name: 'Furniture and Fixture', type: 'asset', isGroup: true }]) === null, 'a GROUP at the conventional id is never a posting target');
ok(H.resolveAssetHead('depExpense', 'Land', housing) === null && H.resolveAssetHead('accumDep', 'Land', housing) === null, 'Land has no depreciation heads');
ok(H.missingAssetHeads('Furniture', housing, ['cost', 'depExpense', 'accumDep']).join() === ['cost', 'depExpense', 'accumDep'].filter((k) => !H.resolveAssetHead(k, 'Furniture', housing)).join(), 'missingAssetHeads lists exactly the unresolved kinds');
ok(/Furniture: /.test(H.missingAssetHeadsText('Furniture', ['depExpense'], true)) && /ह्रास/.test(H.missingAssetHeadsText('Furniture', ['depExpense'], true)), 'the message names the category and the ledger kind, in Hindi');

// ── The postings take the resolved ledgers ───────────────────────────────────────────────────────────────────
const p = D.assetDisposalPosting({ category: 'Furniture', cost: 1000, accumDep: 400, saleProceeds: 700, cashBankAccount: '3301', costAccount: 'own-cost', accumAccount: 'own-accum' });
ok(p.lines.some((l) => l.accountId === 'own-cost' && l.type === 'Cr') && p.lines.some((l) => l.accountId === 'own-accum' && l.type === 'Dr') && !p.lines.some((l) => l.accountId === '3103' || l.accountId === '3109'), 'disposal uses the resolved cost and accumulated-depreciation ledgers');
const p0 = D.assetDisposalPosting({ category: 'Furniture', cost: 1000, accumDep: 400, saleProceeds: 700, cashBankAccount: '3301' });
ok(p0.lines.some((l) => l.accountId === '3103') && p0.lines.some((l) => l.accountId === '3109'), 'without overrides the posting is unchanged');
ok(D.assetAcquisitionPosting('Vehicle', 5000, '3301', 'own-veh').assetAccount === 'own-veh' && D.assetAcquisitionPosting('Vehicle', 5000, '3301').assetAccount === '3104', 'acquisition takes the resolved ledger; default unchanged');

const dc = src('contexts/DataContext.tsx');
ok(/const costId = resolveAssetHead\('cost', data\.category, accounts\);\s+if \(!costId\) \{[\s\S]{0,700}return \{ \.\.\.data, id: '' \}/.test(dc), 'addAsset refuses to capitalise when the chart has no ledger for the category');
ok(/const heads = resolveAssetHeads\(asset\.category, accounts\);[\s\S]{0,900}return false;/.test(dc), 'disposeAsset refuses when a ledger is missing');
ok(/resolveAssetHead\('depExpense', asset\.category, accounts\)[\s\S]{0,500}unresolved\.add\(/.test(dc) && /if \(unresolved\.size\) \{\s+toastRef\.current\(/.test(dc), 'the depreciation run skips such an asset and tells the user');
ok(!/debitAccountId:\s+DEP_ACCOUNTS\[/.test(dc), 'the depreciation run no longer posts to DEP_ACCOUNTS ids directly');
const ar = src('pages/AssetRegister.tsx');
ok(/resolveAssetHeads\(editAsset\.category, accounts\)/.test(ar) && !/Building: '3102', Furniture: '3103'/.test(ar), 'the Asset Register disposal journal uses the resolver, no id table left');

console.log(`Asset heads: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

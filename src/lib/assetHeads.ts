/**
 * Which ledger does an asset category post to in THIS society's chart?
 *
 * The asset code used fixed ids (lib/depreciation DEP_ACCOUNTS, lib/assetDisposal ASSET_ACCOUNTS /
 * ACCUM_DEP_ACCOUNTS): Furniture → cost 3103, depreciation 5502, accumulated 3109, and so on. Those ids are
 * right for the marketing / PACS / consumer charts, but the dairy, housing and sugar charts use the same ids
 * for other heads — 5502 is "Dep. - Lift" in housing and "Dep. - Chilling Plant" in dairy, 3104 is
 * "Lift / Elevator" in housing — so a Furniture asset's depreciation was booked under "Lift" (2026-11-12
 * chart audit, F-03). Totals were right; the head was wrong.
 *
 * The rule: the conventional id is used only when the ledger sitting there IS that head by name. Otherwise a
 * ledger of the right kind whose name says the category is used when exactly one exists. Otherwise the head is
 * UNRESOLVED and the caller refuses to post, naming what to create — never a wrong head. PURE.
 */
import type { AssetCategory } from '@/types';

export type AssetHeadKind = 'cost' | 'depExpense' | 'accumDep';

type Acc = { id: string; name: string; nameHi?: string; type?: string; isGroup?: boolean; parentId?: string; subtype?: string };

/** Conventional ids (the marketing chart's). Land carries no depreciation. */
export const CONVENTIONAL_ASSET_HEAD: Record<AssetHeadKind, Partial<Record<AssetCategory, string>>> = {
  cost:       { Land: '3101', Building: '3102', Furniture: '3103', Vehicle: '3104', Equipment: '3105', Other: '3106', Computer: '3107' },
  depExpense: { Building: '5501', Furniture: '5502', Vehicle: '5503', Equipment: '5504', Computer: '5505', Other: '5505' },
  accumDep:   { Building: '3108', Furniture: '3109', Vehicle: '3110', Equipment: '3111', Computer: '3112', Other: '3112' },
};

/** What a ledger's name must say to be the head for a category. */
const CATEGORY_WORDS: Record<AssetCategory, RegExp> = {
  Land: /\bland\b|भूमि/i,
  Building: /build|भवन/i,
  Furniture: /furnitur|फर्नीचर/i,
  Vehicle: /vehicle|वाहन/i,
  // Each chart's plant slot: "Plant & Machinery", "Chilling Plant & BMC" (dairy), "Cold Storage / Refrigeration"
  // (consumer), "Water Pump / Generator" (housing).
  Equipment: /plant|machin|refriger|cold storage|generator|pump|संयंत्र|मशीन/i,
  Computer: /comput|office equip|\bit equip|कंप्यूटर/i,
  Other: /office equip|equipment|\bequip\b|उपकरण/i,
};

const isAccum = (a: Acc) => a.subtype === 'accumulated_dep' || /accum|संचित/i.test(a.name) || /संचित/.test(a.nameHi || '');
const isDepExpense = (a: Acc) => a.type === 'expense' && (a.parentId === '5500' || a.subtype === 'depreciation_expense' || /\bdep\b|dep\.|depreciat|ह्रास/i.test(`${a.name} ${a.nameHi || ''}`));
const ofKind = (a: Acc, kind: AssetHeadKind): boolean =>
  kind === 'cost' ? a.type === 'asset' && !isAccum(a)
    : kind === 'accumDep' ? a.type === 'asset' && isAccum(a)
      : isDepExpense(a);
const says = (a: Acc, category: AssetCategory) => CATEGORY_WORDS[category].test(a.name) || CATEGORY_WORDS[category].test(a.nameHi || '');

export const ASSET_HEAD_LABEL: Record<AssetHeadKind, { en: string; hi: string }> = {
  cost: { en: 'fixed-asset ledger', hi: 'स्थायी संपत्ति का खाता' },
  depExpense: { en: 'depreciation expense ledger', hi: 'ह्रास (depreciation) ख़र्च का खाता' },
  accumDep: { en: 'accumulated depreciation ledger', hi: 'संचित ह्रास का खाता' },
};

/** The ledger id for (kind, category) in this chart, or null when the chart has no head that is clearly it. */
export function resolveAssetHead(kind: AssetHeadKind, category: AssetCategory, accounts: ReadonlyArray<Acc>): string | null {
  const conventional = CONVENTIONAL_ASSET_HEAD[kind][category];
  if (!conventional) return null;
  const atId = accounts.find((a) => a.id === conventional);
  if (atId && !atId.isGroup && ofKind(atId, kind) && says(atId, category)) return atId.id;
  const byName = accounts.filter((a) => !a.isGroup && ofKind(a, kind) && says(a, category));
  return byName.length === 1 ? byName[0].id : null;
}

export interface AssetHeads { costId: string | null; expenseId: string | null; accumId: string | null }

/** All three heads for a category (expense / accumulated are null for Land by design). */
export function resolveAssetHeads(category: AssetCategory, accounts: ReadonlyArray<Acc>): AssetHeads {
  return {
    costId: resolveAssetHead('cost', category, accounts),
    expenseId: resolveAssetHead('depExpense', category, accounts),
    accumId: resolveAssetHead('accumDep', category, accounts),
  };
}

/** The kinds a category needs but this chart cannot resolve — for a precise "create these" message. */
export function missingAssetHeads(category: AssetCategory, accounts: ReadonlyArray<Acc>, need: readonly AssetHeadKind[]): AssetHeadKind[] {
  return need.filter((k) => CONVENTIONAL_ASSET_HEAD[k][category] !== undefined && resolveAssetHead(k, category, accounts) === null);
}

/** "Furniture: depreciation expense ledger, accumulated depreciation ledger" in the user's language. */
export function missingAssetHeadsText(category: AssetCategory, kinds: readonly AssetHeadKind[], hi: boolean): string {
  return `${category}: ${kinds.map((k) => (hi ? ASSET_HEAD_LABEL[k].hi : ASSET_HEAD_LABEL[k].en)).join(', ')}`;
}

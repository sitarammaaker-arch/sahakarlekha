/**
 * society_settings is saved as ONE whole-row upsert. A key the caller CLEARS by passing undefined
 * (period unlock, FY unlock request, "not recorded" liability type, an emptied numeric limit …) is
 * dropped by JSON.stringify, so the DB kept the old value while the screen showed it empty — and the
 * old value came back on refresh (RULE 1). These keys must travel as null. PURE.
 */
export function clearedKeysAsNull(data: Record<string, unknown>): Record<string, null> {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v === undefined).map(([k]) => [k, null]));
}

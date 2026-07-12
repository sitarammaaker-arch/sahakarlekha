/**
 * AI kill switch & graceful degradation (T-31 / AI Constitution AI-G4; ADR-0010).
 *
 * PURE. Any AI capability can be disabled INSTANTLY — globally, per-society, or per-feature —
 * without breaking core accounting. AI is additive, never load-bearing for correctness: the product
 * must remain fully operable by humans with NO AI. This module resolves the flags; the important
 * discipline is at the call sites — ONLY AI paths consult isAiEnabled, and every non-AI accounting
 * path ignores it entirely, so flipping the switch can never affect the books.
 *
 * The kill switch IS the rollback for every AI feature. No I/O; deterministic.
 */

export interface AiFlags {
  /** Global master. `false` = a global kill: all AI, everywhere, off. */
  globalEnabled: boolean;
  /** Per-society override. An explicit `false` disables AI for that society; absent = not killed. */
  societyEnabled?: Record<string, boolean>;
  /** Per-feature (global) override. An explicit `false` disables that feature; absent = not killed. */
  featureEnabled?: Record<string, boolean>;
}

/**
 * PURE — AI-G4: is an AI feature enabled for a tenant right now? A global kill overrides everything;
 * then a per-society disable; then a per-feature disable. Any explicit `false` at any level turns it
 * off instantly. An absent society/feature entry is "not killed" (the opt-in entitlement gate is a
 * separate concern — ADR-0002/T-29). This gate is consulted ONLY by AI paths.
 */
export function isAiEnabled(flags: AiFlags, tenantId: string, feature: string): boolean {
  if (!flags.globalEnabled) return false;
  if (flags.societyEnabled && flags.societyEnabled[tenantId] === false) return false;
  if (flags.featureEnabled && flags.featureEnabled[feature] === false) return false;
  return true;
}

/** PURE — the global kill: flags with all AI off. Convenience for an instant, total disable. */
export function killAllAi(flags: AiFlags): AiFlags {
  return { ...flags, globalEnabled: false };
}

/** PURE — disable AI for a single society without touching any other society (per-society kill). */
export function killSocietyAi(flags: AiFlags, tenantId: string): AiFlags {
  return { ...flags, societyEnabled: { ...(flags.societyEnabled ?? {}), [tenantId]: false } };
}

/** PURE — disable one AI feature globally (per-feature kill). */
export function killFeatureAi(flags: AiFlags, feature: string): AiFlags {
  return { ...flags, featureEnabled: { ...(flags.featureEnabled ?? {}), [feature]: false } };
}

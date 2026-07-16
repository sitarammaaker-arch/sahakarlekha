/**
 * The AI flag provider — killSwitch's first real source of truth (AI-G4).
 *
 * `killSwitch.ts` has always taken `AiFlags` as a parameter and never had anywhere to
 * get them from, so `isAiEnabled` had zero call sites: a kill switch wired to nothing.
 * This resolves flags from the environment, which makes the switch actually throwable.
 *
 * ENV IS DELIBERATE, AND IT IS THE POINT. A kill switch that needs a database read is
 * useless in the exact incident where you need it — the one where the database is the
 * problem. Env is read at boot with no I/O and cannot fail; setting AI_ENABLED=false
 * and redeploying is seconds, and it cannot be defeated by anything downstream.
 *
 * A per-society UI toggle is a later, additive concern (it would merge INTO
 * societyEnabled). Note the asymmetry that makes that safe: an absent entry means
 * "not killed", but any explicit `false` at any level wins — so a future database
 * source can only ever turn AI OFF, never override an env kill back on.
 */

import type { AiFlags } from './killSwitch';

/** Parse "SOC001,SOC002" → { SOC001: false, SOC002: false } — a per-society kill list. */
function killList(raw: string | undefined): Record<string, boolean> | undefined {
  const ids = (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return undefined;
  return Object.fromEntries(ids.map((id) => [id, false]));
}

/**
 * Resolve flags from an env bag (Deno.env in the Edge Function, import.meta.env in the
 * browser — the caller supplies it, this module reads no globals).
 *
 * DEFAULT IS OFF. `AI_ENABLED` must be an explicit "true" to enable the assistant.
 * A missing, misspelled, or unset variable therefore fails CLOSED — the product falls
 * back to plain search, which works. Defaulting on would mean a typo in a deploy
 * config silently enables AI on a system of statutory record, and AI is additive by
 * law (AI-G4), so the safe default costs nothing.
 */
export function resolveAiFlags(env: Record<string, string | undefined>): AiFlags {
  return {
    globalEnabled: env.AI_ENABLED === 'true',
    societyEnabled: killList(env.AI_KILL_SOCIETIES),
    featureEnabled: killList(env.AI_KILL_FEATURES),
  };
}

/** Flags with everything off — the honest default when no env is available at all. */
export const AI_OFF: AiFlags = { globalEnabled: false };

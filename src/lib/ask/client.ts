/**
 * The web channel's adapter to the seam (blueprint §5, CAIOS-K5).
 *
 * Channels are thin: this file translates a transport into an AskRequest, POSTs the
 * one seam, and renders what comes back. It holds NO retrieval, NO prompt and NO
 * intelligence — a channel that grows its own is a defect, however convenient.
 *
 * FALLS BACK TO LOCAL SEARCH ON ANY FAILURE, and that is the design, not a safety net:
 * the seam is not deployed yet, `AI_ENABLED` defaults to off, and rural connectivity is
 * a fact of this product's life. Under every one of those conditions /ask must behave
 * exactly as it does today. This is CAIOS-K1 made concrete — with no server, no
 * network and no AI, the product still works (AI-G4: AI is additive, never
 * load-bearing). The worst outage this design permits looks like today's /ask.
 */

import { supabase } from '@/lib/supabase';
import { search } from '@/lib/siteSearch';
import type { AskAnswer } from './core';

/** Where the answer came from — surfaced so we never imply a guard ran when it didn't. */
export type AskSource = 'seam' | 'local';

export interface AskOutcome {
  answer: AskAnswer | null;
  /** the local ranked list — the fallback, and also the "related" links either way */
  local: ReturnType<typeof search>;
  source: AskSource;
  answerId?: string;
}

/* HOW LONG TO WAIT — and why 4s was wrong once the seam grew a D-lane.
   4s was set when the seam only ranked documents. Then it started reading the society's
   actual journal: measured latency for "मेरी समिति का रोकड़ शेष कितना है" on a 1846-event,
   586-account book came in at 3335ms, 3991ms and 5187ms — straddling the deadline. So the
   seam computed a correct answer, the audit row recorded `answered: true`, and the browser
   had already given up and shown local search. The user saw "इसका सीधा जवाब अभी नहीं मिला"
   about a question the system had, in fact, answered. A timeout that discards finished work
   is not a safety net.

   The old comment said a slow assistant is worse than an instant plain search. That is true
   for a document lookup and false for your own cash balance — and it was never the tradeoff
   here anyway: this page renders the local corpus IMMEDIATELY and only lets the seam
   override it, so waiting costs an empty screen exactly nothing. Nobody waits on a spinner;
   they read local results while the real answer lands.

   12s: comfortably past a D-lane read (which pages the journal in 1000-row chunks, so it
   grows with the book), still short enough that a dead seam does not feel like a hang. */
const TIMEOUT_MS = 12_000;

/** The local path: today's /ask, unchanged. Instant, free, works offline. */
function localOnly(q: string): AskOutcome {
  return { answer: null, local: search(q, 8), source: 'local' };
}

/**
 * Ask the seam; fall back to local retrieval on anything at all.
 *
 * NOTE THERE IS NO `societyId` PARAMETER, and that is the design. The seam derives
 * identity from the verified JWT on the Authorization header — a client-asserted
 * societyId is a claim, not an identity (AI-P2), and the function ignores it. Passing
 * one here would only invite a caller to believe it meant something.
 *
 * `state` is still passed: it selects a jurisdiction for PUBLIC rule lookups, and no
 * society data sits behind it. It moves to the society row when D-lane tools land.
 */
export async function askSeam(
  q: string,
  ctx: { state?: string } = {},
): Promise<AskOutcome> {
  const query = q.trim();
  if (!query) return { answer: null, local: [], source: 'local' };

  try {
    const invoke = supabase.functions.invoke('ai-ask', {
      body: { text: query, channel: 'web', ...ctx },
    });
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS));
    const { data, error } = (await Promise.race([invoke, timeout])) as Awaited<typeof invoke>;

    // `degraded` means the kill switch is off — not an error, just "no assistant".
    // Local search is then the RIGHT answer, not a consolation prize.
    if (error || !data || data.degraded) return localOnly(query);

    return {
      answer: data as AskAnswer,
      local: search(query, 8),
      source: 'seam',
      answerId: (data as { answer_id?: string }).answer_id,
    };
  } catch {
    // Not deployed, offline, timed out, CORS — all the same to the user, and all
    // land on a working product. Deliberately silent: this path is expected, not
    // exceptional, so it must not shout in the console on every keystroke.
    return localOnly(query);
  }
}

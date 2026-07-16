/**
 * ai-ask — THE SEAM. Every channel's question enters here (blueprint §5, CAIOS-K5).
 *
 * One brain, many mouths: web /ask, the in-app copilot, WhatsApp and whatever calls in
 * 2031 all POST the same shape. Nothing else may ever call a model. A channel that
 * grows its own retrieval or prompt is a defect, however convenient.
 *
 * This file is the I/O shell and nothing else. Every decision — gate, lane, guard —
 * lives in the pure ask-core (src/lib/ask/core.ts), which is why it can be tested
 * without a server and shared with the browser. The shell does three things the core
 * cannot: read env, take the clock, and write the audit row.
 *
 * NO MODEL RUNS HERE YET (Slice 1). The mechanism is proved at zero token cost first;
 * the model slots into stage 6 later and must beat this one's eval score to ship.
 *
 * Deno runtime — this is NOT the app's TypeScript. It runs on Supabase's servers.
 * Deploy:  supabase functions deploy ai-ask
 * Enable:  supabase secrets set AI_ENABLED=true      (default is OFF — fails closed)
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { ask, CORPUS, resolveAiFlags } from '../_shared/ask-core.mjs';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const started = Date.now();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }

  const text = typeof body.text === 'string' ? body.text.slice(0, 500) : '';
  if (!text.trim()) return json({ error: 'text required' }, 400);

  // answer_id is minted here so the caller can quote it back with feedback (§4.9) and
  // an auditor can find the exact row (AI-A2).
  const answerId = crypto.randomUUID();

  /* IDENTITY COMES FROM THE VERIFIED TOKEN — NEVER FROM THE BODY (AI-P2).
     A client-asserted societyId is a claim, not an identity: anyone could POST
     {"societyId":"SOC001"} and, once D-lane tools exist (Slice 4), read another
     society's ledger. Nothing here reads society data yet, which is exactly why this
     lands NOW — the day a tool arrives, the hole would already be load-bearing.
     Note the JWT carries user_role and user_branch_id (migrations 028/038) but NOT
     society_id, so it is resolved from society_users, keyed on the verified email. */
  let societyId: string | undefined;
  let userEmail: string | undefined;
  const authHeader = req.headers.get('Authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const supaUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // The anon key is itself a JWT and is what an anonymous /ask visitor sends. Treat it
  // as no user at all — otherwise every public visitor would look authenticated.
  if (bearer && bearer !== anonKey && supaUrl && anonKey) {
    try {
      const { data, error } = await createClient(supaUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      }).auth.getUser();
      if (!error && data?.user?.email) {
        userEmail = data.user.email.toLowerCase();
        if (svcKey) {
          const { data: row } = await createClient(supaUrl, svcKey)
            .from('society_users')
            .select('society_id')
            .eq('email', userEmail)
            .eq('is_active', true)
            .maybeSingle();
          societyId = (row as { society_id?: string } | null)?.society_id ?? undefined;
        }
      }
    } catch {
      // A token we cannot verify is a token we do not honour: stay anonymous. Never fall
      // back to the body — that is the whole hole this closes.
      societyId = undefined;
    }
  }

  const answer = ask(
    {
      text,
      channel: (body.channel as string) === 'whatsapp' ? 'whatsapp' : (body.channel as string) === 'app' ? 'app' : 'web',
      // From the VERIFIED token only — see above. `body.societyId` / `body.userId` are
      // deliberately ignored: they are claims, not identity (AI-P2). Absent/invalid
      // token ⇒ anonymous, which is a first-class context (§4.3), not a degraded one.
      societyId,
      userId: userEmail,
      // `state` still comes from the body. It is safe today because it only selects a
      // jurisdiction for PUBLIC rule lookups — no society data is behind it. Once
      // D-lane tools land it must come from the society row, not the caller.
      state: typeof body.state === 'string' ? body.state : undefined,
      asOf: typeof body.asOf === 'string' ? body.asOf : undefined,
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
    },
    CORPUS,
    resolveAiFlags(Deno.env.toObject()),
    new Date().toISOString().slice(0, 10),
  );

  const latencyMs = Date.now() - started;

  /* RECORD — stage 8. Every answer, on the SAME append-only trail as human actions
     (AI-A1: never a separate, weaker log). No new table: audit_log is already WORM
     (insert+select policies only, no update/delete) and its shape is generic.
     This is IRR-3 — you cannot reconstruct "AI ने इस समिति को उस दिन क्या कहा था"
     after the fact, so it ships BEFORE the model does, not after.

     Fire-and-forget, exactly like the client's audit writes: a failed log must never
     cost the user their answer. It is awaited only so Deno does not kill the isolate
     mid-insert. */
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (url && key) {
      await createClient(url, key).from('audit_log').insert({
        // The VERIFIED identity, not the body's claim. An audit row that records what the
        // caller said it was would be worse than none: it would look like evidence.
        society_id: societyId || 'anonymous',
        actor_name: userEmail || null,
        actor_role: 'ai_agent',
        entity_type: 'ai_answer',
        entity_id: answerId,
        action: 'ask',
        // `before` stays null: an answer changes nothing. That asymmetry is the point —
        // a proposal that DID change something would carry both (AI-A3).
        after: {
          query: text,
          channel: answer.trace ? (body.channel ?? 'web') : 'web',
          lane: answer.lane,
          answered: !!answer.answer,
          unanswered: answer.unanswered ?? null,
          degraded: !!answer.degraded,
          confidence: answer.confidence,
          cites: answer.cites.map((c: { id: string }) => c.id),
          trace: answer.trace,
          latencyMs,
          // model/tokens/cost land here when stage 6 does. Their absence is itself the
          // record: this answer cost nothing and no model saw it.
        },
        reason: answer.trace?.reason ?? null,
        source: 'ai-ask',
      });
    }
  } catch {
    // swallowed on purpose — see above
  }

  return json({ answer_id: answerId, ...answer, latencyMs });
});

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
import { ask, CORPUS, resolveAiFlags, classify, mapLedgerEventRows } from '../_shared/ask-core.mjs';

/* CORS — and the bug that made this seam unreachable from a browser for a day.
   The allow-list used to be a hand-written 'authorization, content-type, apikey'. But
   supabase-js sets X-Client-Info on EVERY request (DEFAULT_HEADERS, supabase-js/dist/
   index.mjs) and may add x-region. A preflight asking for a header the response does not
   allow FAILS — and a failed preflight means the browser never sends the POST at all.
   The symptom is silent and deeply misleading: Invocations showed a wall of OPTIONS 200
   with not one POST, /ask quietly fell back to local search (client.ts), and no audit row
   was ever written — so the trail said "anonymous", which sent us hunting an auth bug
   that did not exist.

   So do not hand-maintain a list of the SDK's headers: echo what the preflight asks for.
   The next header the SDK adds must not take the assistant down again.

   Safe here: allow-origin is '*', so the browser sends no cookies and this grants a
   caller nothing. CORS is not this seam's security boundary — the verified JWT is
   (#218), and it is enforced below regardless of who was allowed to ask. */
const corsFor = (req: Request) => ({
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    req.headers.get('access-control-request-headers') ??
    'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  // Without this Chrome re-flies the preflight every few seconds — a needless round
  // trip on a rural connection, for every keystroke-triggered ask.
  'access-control-max-age': '86400',
});

Deno.serve(async (req: Request) => {
  const CORS = corsFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

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
  /** ECR-17: the branch the user is scoped to, from the JWT claim (mig 038) — not the body. */
  let userBranchId: string | undefined;
  const authHeader = req.headers.get('Authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const supaUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  /* WHY IDENTITY RESOLUTION ENDED WHERE IT DID — recorded on the audit row.
     A logged-in founder was landing here as `anonymous` and the trail could not say
     which of the four branches below dropped him: no bearer, the anon key, a rejected
     token, or no society_users row. "Anonymous" is a conclusion; this is the reason.
     Booleans and error messages only — a token or a key must never reach a log. */
  const authTrace: Record<string, unknown> = {
    bearer: !bearer ? 'none' : bearer === anonKey ? 'anon-key' : 'user-jwt',
    env: { url: !!supaUrl, anon: !!anonKey, svc: !!svcKey },
    step: 'skipped',
  };

  // The anon key is itself a JWT and is what an anonymous /ask visitor sends. Treat it
  // as no user at all — otherwise every public visitor would look authenticated.
  if (bearer && bearer !== anonKey && supaUrl && anonKey) {
    try {
      authTrace.step = 'getUser';
      const { data, error } = await createClient(supaUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      }).auth.getUser();
      if (error) authTrace.getUserError = error.message;
      else if (!data?.user?.email) authTrace.getUserError = 'verified but no email on user';
      if (!error && data?.user?.email) {
        userEmail = data.user.email.toLowerCase();
        // The branch claim the auth hook stamps (mig 038). Read from the VERIFIED user,
        // so a caller cannot widen their own scope by asking nicely.
        const claims = (data.user as { app_metadata?: Record<string, unknown> }).app_metadata ?? {};
        const bid = (data.user.user_metadata?.user_branch_id ?? claims.user_branch_id) as string | undefined;
        userBranchId = typeof bid === 'string' && bid ? bid : undefined;
        if (svcKey) {
          authTrace.step = 'societyLookup';
          const { data: row, error: sErr } = await createClient(supaUrl, svcKey)
            .from('society_users')
            .select('society_id')
            .eq('email', userEmail)
            .eq('is_active', true)
            .maybeSingle();
          if (sErr) authTrace.societyError = sErr.message;
          // The lookup is case-sensitive and filtered on is_active: a real user whose row
          // is stored `Foo@x.com`, or deactivated, resolves to no society and answers as
          // a stranger. Silent today; named here.
          else if (!row) authTrace.societyError = 'no active society_users row for this email';
          societyId = (row as { society_id?: string } | null)?.society_id ?? undefined;
        }
      }
      authTrace.step = 'done';
    } catch (e) {
      // A token we cannot verify is a token we do not honour: stay anonymous. Never fall
      // back to the body — that is the whole hole this closes.
      societyId = undefined;
      authTrace.threw = e instanceof Error ? e.message : String(e);
    }
  }

  /* LOAD THE BOOKS — only for a verified society, only for a D-lane question.
     Fetching a journal for "दोहरा लेखा क्या है" would be pure waste, and the K/F/N lanes
     answer without it. So classify cheaply first: the load is the expensive, risky part
     and it should happen only when it is the answer.

     Everything is scoped to the VERIFIED societyId (never the body — #218). RLS is the
     backstop, not the plan: the service-role client bypasses it, so the `.eq('society_id')`
     here IS the tenant boundary. That is the one line in this function that, if wrong,
     shows one society another's cash. */
  let society: Parameters<typeof ask>[5];
  if (societyId && svcKey && supaUrl) {
    const probe = classify(text, true);
    if (probe.lane === 'D') {
      try {
        const db = createClient(supaUrl, svcKey);
        const [evRes, acctRes, brRes] = await Promise.all([
          // Ordered the way the projection expects to read them; the deterministic
          // tie-break lives inside projectCashBook, so this only needs to be stable.
          db.from('ledger_events').select('*').eq('society_id', societyId).order('occurred_at', { ascending: true }),
          db.from('accounts').select('*').eq('society_id', societyId),
          db.from('branches').select('id, isHeadOffice').eq('society_id', societyId),
        ]);
        if (!evRes.error && !acctRes.error) {
          society = {
            events: mapLedgerEventRows(evRes.data ?? []),
            accounts: (acctRes.data ?? []) as never,
            // Branch comes from the VERIFIED token, never the body (AI-P2). Absent claim
            // ⇒ consolidated, which is what a society with no branches sees anyway.
            activeBranchId: userBranchId ?? '',
            headOfficeBranchId: (brRes.data ?? []).find((b: { isHeadOffice?: boolean }) => b.isHeadOffice)?.id,
          };
        }
      } catch {
        // Leave `society` undefined: the D-lane then refuses with "बही लोड नहीं हुई",
        // which is true. Never let a failed load fall through to a document answer.
      }
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
    8,
    society,   // undefined ⇒ the D-lane refuses with "बही लोड नहीं हुई" — true, not a fallback
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
          // WAS THE SOCIETY'S LEDGER READ, and how much of it. The whole point of the
          // audit trail is that an auditor can reconstruct what the AI saw — "it answered
          // ₹51,000" is not reconstructible; "it read 412 events and 37 accounts of
          // SOC001, branch BR1" is. This is the first time the seam touches the books, so
          // it is the first time this matters (AI-A2/AI-A5).
          ledgerRead: society
            ? { events: society.events.length, accounts: society.accounts.length, branch: society.activeBranchId || 'consolidated' }
            : null,
          // WHY the identity above is what it is. `society_id: 'anonymous'` on its own is
          // unfalsifiable — this makes it explain itself (AI-A5).
          authTrace,
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

/**
 * health-check — a tiny, READ-ONLY smoke test for the D1 server tier.
 *
 * Its only job is to prove the plumbing works in YOUR Supabase, which cannot be verified
 * from the dev workspace:
 *   1. an Edge Function deploys and runs at all;
 *   2. the auto-injected service-role env vars are present;
 *   3. a service-role read reaches the database (RLS bypassed, as a server job must).
 *
 * It writes NOTHING. It reads a single COUNT from audit_log (the WORM table, always present)
 * and returns it as JSON. Delete it once the real functions are in place.
 *
 * Deno runtime — this is NOT the app's TypeScript. It runs on Supabase's servers.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async () => {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const result: Record<string, unknown> = {
    ok: true,
    functionRan: true,
    hasUrl: !!url,
    hasServiceRole: !!serviceKey,
  };

  if (url && serviceKey) {
    try {
      const supabase = createClient(url, serviceKey);
      // head:true + count:'exact' reads ZERO rows — just the count. Nothing is written.
      const { count, error } = await supabase
        .from('audit_log')
        .select('*', { count: 'exact', head: true });
      result.serviceRoleReadWorks = !error;
      result.auditLogRowCount = count ?? null;
      if (error) result.readError = error.message;
    } catch (e) {
      result.serviceRoleReadWorks = false;
      result.readError = e instanceof Error ? e.message : String(e);
    }
  }

  return new Response(JSON.stringify(result, null, 2), {
    headers: { 'content-type': 'application/json' },
  });
});

/**
 * Bundle entry for the server-side rehearsal core (T-35 — server half).
 *
 * A rehearsal proves a backup restores to the SAME books. The browser already does this
 * (Restore Center → runRehearsal, client half). This entry re-exports the EXACT same pure
 * proof so the scheduled-rehearsal Edge Function reaches the SAME verdict with the SAME
 * posting rule (RULE 2 — one rule, never a second copy). esbuild bundles the real src/
 * modules into one Deno-friendly ESM file (rehearsal-core.mjs); if this drifted from the
 * client the server verdict would diverge from the operator's — the exact failure this
 * reuse prevents (mirrors _shared/backup-core.entry.ts).
 *
 * The whole chain is client-free (verified): archive → verify/manifest/ndjson/crypto,
 * rehearsalRun → replay → voucherUtils (types only). No @/lib/supabase is pulled in, so the
 * bundle carries no Supabase client — the Edge Function supplies its own service-role I/O.
 *
 * Regenerate after any change to the backup/restore libs or the registry:
 *   npm run build:rehearsal-core
 */
export { REGISTRY } from '../../../src/lib/export/registry';
export { loadArchive } from '../../../src/lib/restore/archive';
export { runRehearsal } from '../../../src/lib/backup/rehearsalRun';
export type { EntityDescriptor } from '../../../src/lib/export/registry.types';
export type { Row } from '../../../src/lib/backup/ndjson';

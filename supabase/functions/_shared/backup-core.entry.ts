/**
 * Bundle entry for the server-side backup core (D1).
 *
 * This re-exports the EXACT client backup builders so the Edge Function produces byte-for-byte
 * the same `.slbak` format the browser does — the same manifest, the same digests, the same
 * reproducible zip. It is NOT a second implementation; esbuild bundles the real src/ modules
 * into one Deno-friendly ESM file (backup-core.mjs). If this drifted from the client, a
 * server backup would fail the client's own verifier — the exact failure this reuse prevents.
 *
 * Regenerate the bundle after any change to the backup libs or the registry:
 *   npm run build:backup-core
 */
export { backupEntities, REGISTRY } from '../../../src/lib/export/registry';
export { buildArchive, archiveFileName, planArchive } from '../../../src/lib/backup/writer';
export { BACKUP_FORMAT_VERSION } from '../../../src/lib/backup/manifest';
export { encryptArchive } from '../../../src/lib/backup/crypto';
export { sha256Bytes } from '../../../src/lib/backup/integrity';
export type { EntityDescriptor } from '../../../src/lib/export/registry.types';
export type { Row } from '../../../src/lib/backup/ndjson';

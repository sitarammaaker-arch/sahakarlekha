// Open a sealed backup file (.slbak) — an archive OR a bill copy from the off-site store (voucher-docs/…/*.slbak).
// Disaster recovery only. The key is read from BACKUP_ENCRYPTION_PASSPHRASE (never a command-line argument, so it
// stays out of the shell history). Usage:  node scripts/decrypt-backup-file.mjs <in.slbak> <out-file>
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

import { readFileSync, writeFileSync } from 'node:fs';
const { decryptArchive, readContainerHeader } = await import(abs('../src/lib/backup/crypto.ts'));

const [, , inFile, outFile] = process.argv;
const key = process.env.BACKUP_ENCRYPTION_PASSPHRASE || '';
if (!inFile || !outFile) { console.error('usage: node scripts/decrypt-backup-file.mjs <in.slbak> <out-file>'); process.exit(2); }
if (!key) { console.error('Set BACKUP_ENCRYPTION_PASSPHRASE first (the backup key).'); process.exit(2); }
const bytes = new Uint8Array(readFileSync(inFile));
let header, plain;
try {
  header = readContainerHeader(bytes);
  plain = await decryptArchive(bytes, key);
} catch (e) {
  console.error(`Could not open ${inFile}: ${e?.name === 'WrongPassphraseError' ? 'wrong key (check its SHA-256 fingerprint against `npx supabase secrets list`)' : e?.message ?? e}`);
  process.exit(1);
}
writeFileSync(outFile, plain);
console.log(`opened ${inFile} → ${outFile} (${plain.length} bytes; ${header.trigger || header.formatVersion})`);

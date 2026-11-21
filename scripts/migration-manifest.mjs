#!/usr/bin/env node
// OPS-02 (product audit 2026-11-17) — which numbered migrations does THIS build expect production to have run?
//
// Migrations are pasted into the Supabase SQL Editor by hand, so code that needs migration N can go live before N is
// run (#904 was merged before 185; a rollback file was once run by mistake). Every numbered migration from 072 on
// registers itself in public.app_migrations. This script lists those versions, and the build ships them as
// dist/migrations.json. The email-health function (every 30 min) compares that list with app_migrations and alerts
// the platform admins when one is still missing 2 hours after the deploy.
//
//   node scripts/migration-manifest.mjs            check (CI: npm run test:migration-manifest)
//   node scripts/migration-manifest.mjs --write    write dist/migrations.json (build:cloudflare runs this)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = resolve(ROOT, 'supabase/migrations');
const REG = /insert into public\.app_migrations\s*\(version,\s*name\)\s*values\s*\('(\d{3,})'/;
// Numbered files from before tracking began, or that predate the self-registration convention. Frozen: every
// migration after 193 must register itself (checked below), so this list never grows.
export const UNTRACKED = ['094', '108', '109', '110', '149', '150', '151', '169', '170', '171'];

export function manifest() {
  const files = readdirSync(DIR).filter((f) => /^\d{3}_.*\.sql$/.test(f) && !f.endsWith('_down.sql')).sort();
  const expected = [];
  const unregistered = [];
  for (const f of files) {
    const v = f.slice(0, 3);
    const m = readFileSync(resolve(DIR, f), 'utf8').match(REG);
    if (m) { if (m[1] !== v) unregistered.push(`${f} registers ${m[1]}`); else expected.push(v); }
    else if (v >= '072' && !UNTRACKED.includes(v)) unregistered.push(f);
  }
  return { expected: [...new Set(expected)].sort(), unregistered };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain && process.argv.includes('--write')) {
  const { expected } = manifest();
  const dist = resolve(ROOT, 'dist');
  if (!existsSync(dist)) { console.error('dist/ does not exist — run the build first'); process.exit(1); }
  writeFileSync(resolve(dist, 'migrations.json'), JSON.stringify({ builtAt: new Date().toISOString(), expected }) + '\n');
  console.log(`migrations.json: ${expected.length} expected (latest ${expected.at(-1)})`);
  process.exit(0);
}

if (isMain) {
let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); } };
const { expected, unregistered } = manifest();
ok('every numbered migration after the frozen list registers itself in app_migrations (with its own number)', unregistered.length === 0,
  `add "insert into public.app_migrations (version, name) values ('NNN', '<name>') on conflict (version) do nothing;" to: ${unregistered.join(', ')}`);
ok('the manifest starts at 072 and is sorted', expected[0] === '072' && expected.every((v, i) => i === 0 || v > expected[i - 1]));
ok('the frozen untracked list only names real files', UNTRACKED.every((v) => readdirSync(DIR).some((f) => f.startsWith(v + '_'))));
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
ok('build:cloudflare writes dist/migrations.json', /migration-manifest\.mjs --write/.test(pkg.scripts['build:cloudflare'] || ''));
console.log(`\nmigration manifest: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
}

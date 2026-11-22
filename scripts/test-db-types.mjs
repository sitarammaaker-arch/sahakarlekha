// Generated DB types (TEST-04 follow-up, 2026-11-22). src/types/database.ts is produced from production's schema with
// `npm run db:types` (supabase gen types, read-only). The Supabase client is created as createClient<Database>, so
// every table name, column filter (.eq / .order / .select), RPC name and returned row is checked by `npm run typecheck`
// — a renamed or misspelled column no longer compiles.
// This test keeps that true:
//   • the generated file describes the SAME tables and columns as the production snapshot (DB-01) — after a migration
//     both are refreshed together, or this fails;
//   • the typed client stays typed; the untyped view (supabaseLoose) is used only where the table name is a runtime
//     string; the deliberate write / RPC escape hatches (src/lib/dbRow.ts) do not spread.
// Run: node scripts/test-db-types.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

// ── 1. generated types == production snapshot (tables + columns) ──
const gen = read('src/types/database.ts');
const pub = gen.slice(gen.indexOf('\n  public: {'));
const tablesBlock = pub.slice(pub.indexOf('\n    Tables: {'), pub.indexOf('\n    Views: {'));
const genCols = new Map();
for (const m of tablesBlock.matchAll(/\n {6}(\w+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/g)) {
  genCols.set(m[1], new Set([...m[2].matchAll(/^ {10}"?(\w+)"?\??: /gm)].map((x) => x[1])));
}
const snap = read('supabase/schema/production-schema.txt').split('\n');
const snapCols = new Map();
for (const l of snap) {
  if (l.startsWith('table ')) snapCols.set(l.split(' ')[1], snapCols.get(l.split(' ')[1]) ?? new Set());
  if (l.startsWith('column ')) { const [t, c] = l.split(' ')[1].split('.'); (snapCols.get(t) ?? snapCols.set(t, new Set()).get(t)).add(c); }
}
ok(genCols.size > 100, `database.ts lists the public tables (${genCols.size})`);
const onlyGen = [...genCols.keys()].filter((t) => !snapCols.has(t));
const onlySnap = [...snapCols.keys()].filter((t) => !genCols.has(t));
ok(onlyGen.length === 0 && onlySnap.length === 0, `same tables as the production snapshot — run npm run db:types after a migration (only in types: ${onlyGen.join(', ') || '-'}; only in snapshot: ${onlySnap.join(', ') || '-'})`);
const colDiff = [];
for (const [t, cols] of genCols) {
  const s = snapCols.get(t); if (!s) continue;
  for (const c of cols) if (!s.has(c)) colDiff.push(`+${t}.${c}`);
  for (const c of s) if (!cols.has(c)) colDiff.push(`-${t}.${c}`);
}
ok(colDiff.length === 0, `same columns as the production snapshot (${colDiff.slice(0, 8).join(', ') || 'none'}${colDiff.length > 8 ? ' …' : ''})`);
// column NAMES such as mfa_secret are fine; a VALUE (a JWT, a live key, a long quoted token) would not be
ok(!/eyJhbGci|sk_(live|test)_|["'](?=[^"'\n]*[A-Z])(?=[^"'\n]*\d)[A-Za-z0-9+/=_-]{40,}["']/.test(gen), 'the generated file carries no secret value (identifiers such as long constraint names are fine)');

// ── 2. the client is typed ──
const client = read('src/lib/supabase.ts');
ok(client.includes("import type { Database } from '@/types/database';") && client.includes('createClient<Database>('), 'the Supabase client is createClient<Database>');
ok(JSON.parse(read('package.json')).scripts['db:types']?.includes('supabase gen types typescript --linked --schema public'), 'npm run db:types regenerates the file from the linked project');

// ── 3. the escape hatches stay small ──
const files = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(n)) files.push(p); } };
walk(join(ROOT, 'src'));
const rel = (p) => relative(ROOT, p).replace(/\\/g, '/');
const LOOSE_OK = new Set(['src/lib/supabase.ts', 'src/lib/supabaseService.ts', 'src/lib/supabasePaging.ts', 'src/lib/rowPatch.ts', 'src/lib/export/source.ts', 'src/lib/export/preflight.ts', 'src/contexts/DataContext.tsx', 'src/contexts/MarketingDataContext.tsx']);
const looseUsers = files.filter((f) => /\bsupabaseLoose\b/.test(readFileSync(f, 'utf8'))).map(rel);
const strayLoose = looseUsers.filter((f) => !LOOSE_OK.has(f));
ok(strayLoose.length === 0, `supabaseLoose (untyped) only where the table name is a runtime string (new: ${strayLoose.join(', ') || 'none'} — add a typed call, or justify it here)`);
const count = (re) => files.reduce((n, f) => n + (readFileSync(f, 'utf8').match(re) || []).length, 0);
const CEIL = { asDbArgs: 29, asDbRow: 12, dbRowAs: 11, LooseRow: 22 };   // 2026-11-22 — lower when you remove one
for (const [name, max] of Object.entries(CEIL)) {
  const n = count(new RegExp(`\\b${name}\\b`, 'g'));
  ok(n <= max, `${name} uses do not grow (now ${n}, ceiling ${max})`);
}
ok(read('src/lib/dbRow.ts').includes('Use LooseRow ONLY as the return type of such a payload helper'), 'dbRow.ts documents when the escape hatches may be used');

console.log(`DB types: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

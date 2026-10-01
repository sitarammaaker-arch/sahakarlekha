#!/usr/bin/env node
// Every Supabase edge function must at least PARSE. Nothing in CI builds the Deno functions, so a
// syntax error only surfaced at `supabase functions deploy` time (2026-10-01: a helper inserted inside a
// multi-line import broke member-portal-admin on main). This transpiles each index.ts with the
// TypeScript compiler (syntax only — Deno types/imports are not resolved) and fails on any diagnostic.
//
// Run: node scripts/test-edge-functions-parse.mjs

import ts from 'typescript';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const FN_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../supabase/functions');
let pass = 0, fail = 0;
for (const name of readdirSync(FN_DIR)) {
  const file = join(FN_DIR, name, 'index.ts');
  if (!existsSync(file)) continue;
  const { diagnostics = [] } = ts.transpileModule(readFileSync(file, 'utf8'), {
    reportDiagnostics: true, fileName: file,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
  });
  if (diagnostics.length === 0) { pass++; console.log(`  ✓ ${name}`); continue; }
  fail++;
  console.log(`  ✗ ${name}: ${diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; ')}`);
}
console.log(`\nedge functions parse: ${pass} passed, ${fail} failed`);
process.exit(fail || pass === 0 ? 1 : 0);

#!/usr/bin/env node
// S3-f-1 fix · migration 081: _official_doc_no finds a free number for ANY number format (the Rania
// pilot's 4-part `RV/2026/27/914` voucher numbers). Static checks; CI-safe. Behaviour on a restored
// backup: scripts/db-harness/tests/s3f1-post-stock-document.mjs ("Four-part voucher numbers…").
//
// Run: node scripts/test-s3f1-doc-number.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(pathResolve(HERE, '../supabase/migrations/081_official_doc_no_any_format.sql'), 'utf8');
const code = raw.replace(/--[^\n]*/g, ' ');
const down = readFileSync(pathResolve(HERE, '../supabase/migrations/081_official_doc_no_any_format_down.sql'), 'utf8');
const b = code.slice(code.indexOf('begin', code.indexOf('as $$')));

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };

ok('same signature, SECURITY DEFINER, search_path public (next_document_number resolves document_sequences)',
  /create or replace function public\._official_doc_no\(p_sid text, p_provisional text, p_table text, p_column text\)/.test(code) && /security definer\s+set search_path = public, pg_temp/.test(code));
ok('any <prefix>/<digits> is understood (not only BOOK/FY/SEQ)', /substring\(coalesce\(p_provisional, ''\) from '\^\(\.\*\)\/\[0-9\]\+\$'\)/.test(code));
ok('1: server sequence only for the 3-part shape, bounded', /if v_parts = 3 then\s*for i in 1\.\.20 loop/.test(b));
ok('2: a free provisional number is kept', b.indexOf('into v_taken using p_sid, p_provisional') > 0 && /if not v_taken then return p_provisional; end if;/.test(b));
ok('3: max(existing SEQ for the prefix) + 1, zero-pad width kept', /coalesce\(max\(\(substring\(%I from ''\/\(\[0-9\]\+\)\$''\)\)::bigint\), 0\)/.test(b) && /lpad\(v_n::text, greatest\(v_width, length\(v_n::text\)\), '0'\)/.test(b));
ok('steps run in that order', b.indexOf('if v_parts = 3') < b.indexOf('using p_sid, p_provisional') && b.indexOf('using p_sid, p_provisional') < b.indexOf('coalesce(max('));
ok('every lookup is scoped to the society', (b.match(/society_id::text = \$1/g) || []).length >= 3);
ok('still private (no client grant)', /revoke all on function public\._official_doc_no\(text, text, text, text\) from public, anon, authenticated/.test(code) && !/grant execute on function public\._official_doc_no/.test(code));
ok("records '081' last; down restores 080's helper and removes the record", /values \('081', 'official_doc_no_any_format'\)\s*on conflict \(version\) do nothing;\s*commit;\s*$/.test(raw)
  && /create or replace function public\._official_doc_no/.test(down) && /version = '081'/.test(down));

console.log(`\nS3-f-1 doc number (081): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

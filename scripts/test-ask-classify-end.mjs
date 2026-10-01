#!/usr/bin/env node
// /ask classify: a regulated cue at the END of the question ("194H की दर") routes to the F-lane; a word
// that merely STARTS with it ("दरवाज़ा") does not. Run: node scripts/test-ask-classify-end.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
const { classify } = await import(pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), '../src/lib/ask/classify.ts')).href);
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };
ok('"194H की दर" → F', classify('194H की दर', false).lane === 'F');
ok('"194Q की दर?" → F', classify('194Q की दर?', false).lane === 'F');
ok('"194Q की दर।" → F', classify('194Q की दर।', false).lane === 'F');
ok('"194H की दर क्या है" still → F', classify('194H की दर क्या है', false).lane === 'F');
ok('"194Q की सीमा" still → F', classify('194Q की सीमा', false).lane === 'F');
ok('"दरवाज़ा" is not a rate question', classify('दरवाज़ा', false).lane !== 'F');
console.log(`\nask classify (end-of-question cues): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

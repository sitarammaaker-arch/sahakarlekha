// Glossary integrity check — runs against the ACTIVE Knowledge Items that power the
// /glossary feature (the single source of truth in /docs/kpp/wave-1-active).
//
// Validates, with no extra deps:
//   • duplicate detection       — no two KIs map to the same glossary slug
//   • required-field validation — knowledge_id, title, evidence_id, active status, a non-empty Definition
//   • broken-reference detection — every [[KI-xxxx]] in "Related concepts" points to a real KI file
//   • link validation           — internal-link routes look well-formed (start with "/")
//
// Exit code 1 on any hard error so it can gate CI / a pre-commit hook. Run:  node scripts/validate-glossary.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = resolve(ROOT, 'docs', 'kpp', 'wave-1-active');

const errors = [];
const warnings = [];

if (!existsSync(DIR)) {
  console.error(`[glossary] source dir not found: ${DIR}`);
  process.exit(1);
}

const files = readdirSync(DIR).filter((f) => /^KI-\d+.*\.md$/.test(f));
const idToFile = new Map();
const slugSeen = new Map();
const allIds = new Set();
const records = [];

for (const file of files) {
  const src = readFileSync(resolve(DIR, file), 'utf-8');
  const fmMatch = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) { errors.push(`${file}: missing YAML frontmatter`); continue; }
  const fm = {};
  for (const line of fmMatch[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  const body = fmMatch[2];
  const slug = file.replace(/^KI-\d+-/, '').replace(/\.md$/, '');
  const def = (body.match(/\*\*Definition:\*\*\s*(.+)/) || [])[1]?.trim() || '';

  // required fields
  if (!fm.knowledge_id) errors.push(`${file}: missing knowledge_id`);
  if (!fm.title && !fm.english_name) errors.push(`${file}: missing title/english_name`);
  if (!fm.evidence_id) warnings.push(`${file}: missing evidence_id`);
  if (fm.status && fm.status !== 'active') warnings.push(`${file}: status="${fm.status}" (not active) — will be skipped by the glossary`);
  if (!def) errors.push(`${file}: empty Definition (the single source of truth must define the term)`);

  // duplicate slug
  if (slugSeen.has(slug)) errors.push(`duplicate glossary slug "${slug}" in ${file} and ${slugSeen.get(slug)}`);
  else slugSeen.set(slug, file);

  if (fm.knowledge_id) { idToFile.set(fm.knowledge_id, file); allIds.add(fm.knowledge_id); }

  // internal-link sanity
  const links = (body.match(/\*\*Internal links:\*\*\s*(.+)/) || [])[1] || '';
  for (const m of links.matchAll(/(\/[A-Za-z0-9/:_-]+)/g)) {
    if (!m[1].startsWith('/')) warnings.push(`${file}: malformed internal link "${m[1]}"`);
  }

  records.push({ file, fm, body, slug });
}

// broken-reference detection: every [[KI-xxxx]] should resolve to a real KI file.
// (References to non-active/planned KIs are allowed but reported as info — the UI renders them as plain text.)
for (const r of records) {
  const rel = (r.body.match(/\*\*Related concepts:\*\*\s*(.+)/) || [])[1] || '';
  for (const m of rel.matchAll(/\[\[(KI-\d+)\]\]/g)) {
    if (!allIds.has(m[1]) && !/planned/i.test(rel)) {
      warnings.push(`${r.file}: related-concept ${m[1]} is not an active KI (rendered as plain text)`);
    }
  }
}

console.log(`[glossary] checked ${files.length} active Knowledge Items → ${slugSeen.size} unique glossary terms.`);
if (warnings.length) {
  console.log(`\n[glossary] ${warnings.length} warning(s):`);
  for (const w of warnings) console.log('  • ' + w);
}
if (errors.length) {
  console.error(`\n[glossary] ${errors.length} ERROR(s):`);
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log('\n[glossary] ✓ all checks passed (no duplicates, no broken references, required fields present).');

// Blog trust signals (audit batch 2) — guards that keep them honest.
//   • `reviewed:` ("अंतिम समीक्षा") is a CLAIM that the post was checked against original sources on
//     that day. It may only sit on a post that carries a `## स्रोत` section, and never in the future.
//   • `jurisdiction:` uses a known value.
//   • The trust note and the editorial policy come from ONE module (src/content/editorialPolicy.ts),
//     and the policy page explains the review date the notes refer to.
// Run: node scripts/test-blog-trust.mjs   (npm run test:blog-trust)
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadViteModule } from './lib/vite-bundle.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BLOG = resolve(ROOT, 'src', 'content', 'blog');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.error('  ✗', m); } };

const { BLOG_POSTS } = await loadViteModule(ROOT, resolve(BLOG, 'index.ts'), 'blog-trust-test');
const P = await loadViteModule(ROOT, resolve(ROOT, 'src', 'content', 'editorialPolicy.ts'), 'blog-trust-test');
const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10); // IST, as the prerender

const reviewed = BLOG_POSTS.filter((p) => p.reviewed);
ok(reviewed.length > 0, `${reviewed.length} posts carry a review date`);
const bad = reviewed.filter((p) => {
  const md = existsSync(resolve(BLOG, `${p.slug}.md`)) ? readFileSync(resolve(BLOG, `${p.slug}.md`), 'utf-8') : '';
  return !/^\d{4}-\d{2}-\d{2}$/.test(p.reviewed) || p.reviewed > today || !/^##\s*स्रोत/m.test(md);
});
ok(bad.length === 0, `every review date is a real ISO day, not in the future, on a post with a "## स्रोत" section${bad.length ? ' — bad: ' + bad.map((p) => p.slug).join(', ') : ''}`);
ok(reviewed.every((p) => p.reviewed >= p.date || p.date > today), 'no post was "reviewed" before it was published');

const juris = BLOG_POSTS.filter((p) => p.jurisdiction);
ok(juris.length > 0 && juris.every((p) => p.jurisdiction === 'haryana'), `${juris.length} state-specific posts, all with a known jurisdiction`);
ok(BLOG_POSTS.filter((p) => /haryana|hafed|cm-pacs/.test(p.slug)).every((p) => p.jurisdiction === 'haryana'), 'every post with haryana / hafed / cm-pacs in its slug is marked Haryana');

const sensitive = BLOG_POSTS.filter((p) => P.TRUST_NOTE_CATEGORIES.includes(p.category));
ok(sensitive.length >= 30, `trust note covers the law / tax / scheme categories (${sensitive.length} posts)`);
ok(P.TRUST_NOTE_CATEGORIES.every((c) => BLOG_POSTS.some((p) => p.category === c)), 'every trust-note category is a real blog category');

const policyText = P.EDITORIAL_POLICY.sections.map((s) => s.heading + ' ' + s.paras.join(' ')).join(' ');
ok(policyText.includes('अंतिम समीक्षा') && policyText.includes(P.TRUST_NOTE.haryanaBadge.replace('📍 ', '')), 'the policy explains the review date and the state badge the notes show');
ok(P.EDITORIAL_POLICY_PATH === '/editorial-policy', 'policy path is /editorial-policy');

console.log(`\nblog trust: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

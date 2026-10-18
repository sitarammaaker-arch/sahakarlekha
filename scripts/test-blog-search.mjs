// The /blog search box (src/lib/blogSearch.ts) over the REAL blog registry.
//   • it finds articles by English, Hindi, synonym, nukta-less and one-typo queries
//   • it only ever returns posts it was given (the pages pass live posts only, so a
//     scheduled drip post can never surface; a category page passes only its own posts)
//   • /search indexes each blog post with the very same document (RULE 2: one formula)
// Run: node scripts/test-blog-search.mjs   (npm run test:blog-search)
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadViteModule } from './lib/vite-bundle.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'src');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.error('  ✗', m); } };

const blog = await loadViteModule(ROOT, resolve(SRC, 'content', 'blog', 'index.ts'), 'blog-search-test');
const { searchBlogPosts, blogSearchDoc } = await loadViteModule(ROOT, resolve(SRC, 'lib', 'blogSearch.ts'), 'blog-search-test');
const site = await loadViteModule(ROOT, resolve(SRC, 'lib', 'siteSearch.ts'), 'blog-search-test');

const all = blog.BLOG_POSTS;
ok(all.length > 50, `real registry loaded (${all.length} posts)`);
const slugs = (q, posts = all) => searchBlogPosts(posts, q).map((p) => p.slug);
const top = (q, slug, n = 3, posts = all) => slugs(q, posts).slice(0, n).includes(slug);

ok(slugs('').length === 0 && slugs('   ').length === 0, 'empty query → no results (the page shows its normal layout)');
ok(top('GST', 'gst-for-cooperatives'), '"GST" → the GST article in the top 3');
ok(top('जीएसटी', 'gst-for-cooperatives'), '"जीएसटी" (synonym) → the GST article in the top 3');
ok(top('tds', 'tds-and-26q-for-societies'), '"tds" (lower case) → the TDS/26Q article in the top 3');
ok(top('डेप्रिसिएशन', 'depreciation-explained'), '"डेप्रिसिएशन" → the depreciation article in the top 3');
ok(top('ghisai', 'depreciation-explained'), '"ghisai" (roman Hindi synonym) → the depreciation article in the top 3');
ok(top('talpat', 'trial-balance-explained'), '"talpat" (तलपट, roman) → the trial balance article in the top 3');
// Nukta is optional in practice: a title word written with ज़/फ़/ड़… must be found when typed without the dot.
{
  const NUKTA = /[क़-य़]|़/;
  const p = all.find((x) => x.title.split(/\s+/).some((w) => NUKTA.test(w) && w.length > 3));
  const word = p.title.split(/\s+/).find((w) => NUKTA.test(w) && w.length > 3).replace(/[^\p{L}\p{M}]/gu, '');
  const bare = word.normalize('NFD').replace(/़/g, '').normalize('NFC');
  ok(bare !== word && slugs(bare).includes(p.slug), `"${bare}" (typed without nukta) still finds "${p.shortTitle}"`);
}
ok(slugs('bank reconciliation').includes('bank-reconciliation-guide'), '"bank reconciliation" → the BRS article');
ok(slugs('HAFED').some((s) => s.startsWith('hafed-')), '"HAFED" → a HAFED article');
ok(slugs('zzqxwv').length === 0, 'nonsense → no results (the page offers /search and /ask instead)');

// Scope: results come only from the list passed in.
const auditCat = all.filter((p) => p.category === 'रिपोर्ट, ऑडिट व वर्ष-अंत');
const scoped = searchBlogPosts(auditCat, 'ऑडिट');
ok(scoped.length > 0 && scoped.every((p) => p.category === 'रिपोर्ट, ऑडिट व वर्ष-अंत'), 'category-scoped search stays inside its category');
const live = all.filter((p) => p.date <= '2026-10-18');
const future = all.filter((p) => p.date > '2026-10-18').map((p) => p.slug);
ok(future.every((s) => !slugs(s.replace(/-/g, ' '), live).includes(s)), 'a post not in the given list (scheduled) is never returned');

// RULE 2: /search builds its blog docs with the same function.
const siteBlogDocs = site.buildIndex().filter((d) => d.type === 'blog');
ok(siteBlogDocs.length === all.length, '/search indexes every blog post');
ok(siteBlogDocs.every((d) => {
  const p = all.find((x) => `blog:${x.slug}` === d.id);
  return p && JSON.stringify(blogSearchDoc(p)) === JSON.stringify(d);
}), '/search blog docs are byte-identical to blogSearchDoc()');

console.log(`\nblog search: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

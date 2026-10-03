#!/usr/bin/env node
// /downloads hub (src/content/downloads.ts): at most five real resources, each showing format, use, state and year
// applicability, a review date and an honest expert-review status; no resource claims to be a statutory form; every
// related link resolves; PDFs use the existing engine; the page asks for no email.
//
// Run: node scripts/test-downloads.mjs   (npm run test:downloads)
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadViteModule } from './lib/vite-bundle.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const { DOWNLOADS, DOWNLOADS_META } = await loadViteModule(ROOT, resolve(ROOT, 'src/content/downloads.ts'), 'eval');

const guide = new Set(JSON.parse(rd('scripts/guide-manifest.json')).map((e) => e.slug));
const glossary = new Set(readdirSync(resolve(ROOT, 'docs/kpp/wave-1-active')).filter((f) => /^KI-\d+/.test(f)).map((f) => f.replace(/^KI-\d+-/, '').replace(/\.md$/, '')));
const blog = new Set(rd('src/content/blog/index.ts').split(/\r?\n  \{\r?\n/).slice(1).map((c) => (c.match(/slug: '([^']+)'/) || [])[1]).filter(Boolean));
const tools = new Set([...rd('src/content/calculators/index.ts').matchAll(/^    slug: '([^']+)'/gm)].map((m) => m[1]));
const resolves = (href) => {
  const [, kind, slug] = href.split('/');
  if (kind === 'guide') return guide.has(slug);
  if (kind === 'blog') return blog.has(slug);
  if (kind === 'glossary') return glossary.has(slug);
  if (kind === 'tools') return tools.has(slug);
  return false;
};

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); } };

ok('1–5 resources (start small)', DOWNLOADS.length >= 1 && DOWNLOADS.length <= 5, String(DOWNLOADS.length));
ok('slugs unique', new Set(DOWNLOADS.map((r) => r.slug)).size === DOWNLOADS.length);
for (const r of DOWNLOADS) {
  ok(`${r.slug}: shows format, use, state, year`, [r.format, r.use, r.applicability, r.year].every((x) => typeof x === 'string' && x.length > 5));
  ok(`${r.slug}: has an ISO review date`, /^\d{4}-\d{2}-\d{2}$/.test(r.reviewed));
  ok(`${r.slug}: says expert review is pending / not statutory`, /लंबित/.test(r.expertReview) && /वैधानिक/.test(r.expertReview));
  ok(`${r.slug}: no authoritative claim ("सरकारी/वैधानिक/आधिकारिक प्रारूप" asserted)`, !/(सरकारी|आधिकारिक|official|statutory) (प्रारूप|form)/i.test(r.title + ' ' + r.englishTitle + ' ' + r.use));
  ok(`${r.slug}: is a real resource (PDF spec or an existing page)`,
    (r.kind === 'pdf' && r.pdf && r.pdf.columns.length >= 2 && r.pdf.signatures.length > 0) || (r.kind === 'page' && !!r.href && resolves(r.href)));
  if (r.pdf) ok(`${r.slug}: PDF text is English (jsPDF base font)`, !/[ऀ-ॿ]/.test(JSON.stringify(r.pdf)));
  ok(`${r.slug}: every related link resolves`, r.related.every((l) => resolves(l.href)), r.related.filter((l) => !resolves(l.href)).map((l) => l.href).join(','));
}
const pdf = rd('src/lib/pdf.ts');
ok('PDF built with the existing engine (addHeader + autoTable + signatures)', /export function generateBlankFormatPDF/.test(pdf) && /generateBlankFormatPDF[\s\S]*?addHeader\(doc[\s\S]*?autoTable\(doc[\s\S]*?addSignatureBlock/.test(pdf));
ok('every PDF carries the "not a statutory form" footer', /Not a statutory form/.test(pdf));
const page = rd('src/pages/DownloadsHub.tsx');
ok('page loads the PDF engine only on click (dynamic import)', /await import\('@\/lib\/pdf'\)/.test(page) && !/^import .*@\/lib\/pdf/m.test(page));
ok('no email gate on the page', !/type=["']email["']/.test(page) && !/ईमेल (डालें|दें|ज़रूरी)/.test(page));
ok('meta title/description present', DOWNLOADS_META.title.length > 10 && DOWNLOADS_META.description.length > 50);
ok('route /downloads registered', /path="\/downloads" element=\{<DownloadsHub \/>\}/.test(rd('src/App.tsx')));
ok('prerendered (same registry)', /function downloadsPages\(DATA\)/.test(rd('scripts/prerender-guide.mjs')));

console.log(`\ndownloads: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

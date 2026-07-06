// Post-build prerender for public SEO routes (guide/software/states/blog/help/
// cookbook/glossary/tools/pricing/faq).
//
// The app is a client-rendered SPA. This script clones dist/index.html into
// dist/<path>/index.html with, per page:
//   1. its own <title>, description, canonical, OG/Twitter tags and JSON-LD in <head>;
//   2. a REAL static HTML body inside <div id="root"> (GOS-01) — rendered from the
//      SAME sources the app uses (markdown files / content registries), so crawlers
//      that don't execute JS still see the full content. React's createRoot()
//      replaces it on load, so the live app is unaffected.
// It also regenerates the sitemap as a SITEMAP INDEX (GOS-02): dist/sitemap.xml
// (index) → dist/sitemap-<family>.xml, with HONEST per-content lastmod dates
// (never the build date — a daily rebuild must not mark every URL as changed).
//
// Sources:
//   - guide:    scripts/guide-manifest.json + src/content/guide/<slug>.md
//   - blog:     src/content/blog/index.ts (regex; has import.meta.glob so it can't
//               be esbuild-loaded) + src/content/blog/<slug>.md
//   - glossary: docs/kpp/wave-1-active/KI-*.md (frontmatter + **Label:** sections)
//   - help/cookbook/tools/software/states/faq: their TS registries, loaded as real
//     data via esbuild (bundled to node_modules/.cache/prerender and imported).
// Fail-soft: any problem logs a warning and degrades (meta-only page, or skipped
// body, or flat fallback) — a build is never blocked.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { marked } from 'marked';

const SITE = 'https://sahakarlekha.com';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const TEMPLATE = resolve(DIST, 'index.html');
const MANIFEST = resolve(ROOT, 'scripts', 'guide-manifest.json');
const SOCIETY_TYPES = resolve(ROOT, 'src', 'content', 'societyTypes.tsx');
const STATES_FILE = resolve(ROOT, 'src', 'content', 'states.ts');
const BLOG_FILE = resolve(ROOT, 'src', 'content', 'blog', 'index.ts');
const BLOG_DIR = resolve(ROOT, 'src', 'content', 'blog');
const GUIDE_DIR = resolve(ROOT, 'src', 'content', 'guide');
const HELP_FILE = resolve(ROOT, 'src', 'content', 'help', 'index.ts');
const COOKBOOK_FILE = resolve(ROOT, 'src', 'content', 'cookbook', 'index.ts');
const GLOSSARY_DIR = resolve(ROOT, 'docs', 'kpp', 'wave-1-active');
const CALC_FILE = resolve(ROOT, 'src', 'content', 'calculators', 'index.ts');
const FAQ_FILE = resolve(ROOT, 'src', 'content', 'faq.ts');
const COURSE = 'सहकारी समिति लेखांकन व ऑडिट — सम्पूर्ण कोर्स';

// Honest per-surface "content last changed" dates. These change ONLY when the
// underlying content actually changes (a per-entry `updated:` field overrides,
// blog uses its own dates, glossary uses KI `last_updated`). NEVER the build date.
const LASTMOD = {
  guide: '2026-06-20',
  software: '2026-06-20',
  state: '2026-06-20',
  help: '2026-06-27',
  cookbook: '2026-06-27',
  calc: '2026-06-27',
  faq: '2026-06-19',
  pricing: '2026-06-19',
  static: '2026-06-19',
};

marked.setOptions({ gfm: true });

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const md = (s) => (s ? marked.parse(String(s)) : '');
const mdInline = (s) => (s ? marked.parseInline(String(s)) : '');
const maxDate = (dates, fallback) => {
  const ds = dates.filter(Boolean).sort();
  return ds.length ? ds[ds.length - 1] : fallback;
};

const crumb = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.item })),
});

/* ---------------- static body shell (GOS-01) ---------------- */

const HUB_LINKS = [
  ['/', 'होम'], ['/register', 'मुफ्त रजिस्टर करें'], ['/guide', 'गाइड'], ['/blog', 'ब्लॉग'],
  ['/help', 'मदद केंद्र'], ['/cookbook', 'एंट्री कुकबुक'], ['/glossary', 'शब्दकोश'],
  ['/tools', 'कैलकुलेटर'], ['/software', 'सॉफ्टवेयर'], ['/faq', 'FAQ'],
];

/**
 * Wrap page content in a minimal, readable semantic shell. Shown only until the
 * SPA mounts (createRoot replaces #root children); crawlers see it as the page.
 * crumbs: [[href, label], ...] + current (string).
 */
function shell({ crumbs = [], current = '', html }) {
  const bc = crumbs.length || current
    ? `<nav aria-label="breadcrumb" style="font-size:.9rem;margin-bottom:14px;color:#556">` +
      [...crumbs.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`), current ? esc(current) : null]
        .filter(Boolean).join(' › ') +
      `</nav>`
    : '';
  const explore =
    `<hr style="margin:28px 0 14px;border:none;border-top:1px solid #ddd">` +
    `<nav aria-label="explore" style="font-size:.9rem"><p><strong>और देखें:</strong> ` +
    HUB_LINKS.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join(' · ') +
    `</p></nav>`;
  return (
    `<div style="max-width:48rem;margin:0 auto;padding:24px 16px;font-family:'Hind','Inter',system-ui,sans-serif;line-height:1.75;color:#1a202c">` +
    bc + html + explore + `</div>`
  );
}

const registerCta = (next) =>
  `<p style="margin-top:24px"><a href="/register${next ? `?next=${encodeURIComponent(next)}` : ''}"><strong>अपनी समिति का खाता मुफ्त में डिजिटल कीजिए — रजिस्टर करें →</strong></a></p>`;

/* ---------------- registry data via esbuild (pure-data TS modules) ---------------- */

async function loadModule(entry) {
  const esbuild = await import('esbuild');
  const out = resolve(ROOT, 'node_modules', '.cache', 'prerender', basename(entry).replace(/\.tsx?$/, '') + '.mjs');
  mkdirSync(dirname(out), { recursive: true });
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: out,
    alias: { '@': resolve(ROOT, 'src') },
    jsx: 'automatic',
    logLevel: 'silent',
  });
  return await import(pathToFileURL(out).href + `?t=${Date.now()}`);
}

/** Load every esbuild-safe registry; each is null on failure (fail-soft). */
async function loadData() {
  const data = {};
  const jobs = [
    ['help', HELP_FILE, 'HELP_TASKS'],
    ['cookbook', COOKBOOK_FILE, 'COOKBOOK_ENTRIES'],
    ['calc', CALC_FILE, 'CALCULATORS'],
    ['faq', FAQ_FILE, 'FAQ_CATEGORIES'],
    ['society', SOCIETY_TYPES, 'SOCIETY_TYPES'],
    ['states', STATES_FILE, 'STATES'],
  ];
  for (const [key, file, exportName] of jobs) {
    try {
      if (!existsSync(file)) { data[key] = null; continue; }
      const mod = await loadModule(file);
      data[key] = mod[exportName] || null;
      if (!data[key]) console.warn(`[prerender] ${exportName} not found in ${basename(file)} — bodies skipped for that surface.`);
    } catch (e) {
      data[key] = null;
      console.warn(`[prerender] could not data-load ${basename(file)} (${e && e.message}) — bodies skipped for that surface.`);
    }
  }
  return data;
}

/* ---------------- guide routes (manifest meta + chapter .md body) ---------------- */

function guidePages() {
  if (!existsSync(MANIFEST)) return [];
  const entries = JSON.parse(readFileSync(MANIFEST, 'utf-8'));
  const chapters = entries.filter((e) => e && e.slug);

  const pages = [{
    path: '/guide',
    title: 'सहकारी समिति लेखांकन गाइड — मुफ्त कोर्स, प्रमाणपत्र सहित | SahakarLekha',
    description: 'लेखांकन की नींव से ऑडिट तक — सहकारी समितियों के लिए मुफ्त हिन्दी कोर्स। 9 भाग, क्विज़ व प्रमाणपत्र।',
    lastmod: LASTMOD.guide,
    jsonLd: [
      {
        '@context': 'https://schema.org', '@type': 'Course', name: COURSE,
        description: 'सहकारी समिति लेखांकन व ऑडिट का मुफ्त, हिन्दी-प्रथम ऑनलाइन कोर्स।',
        provider: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
        url: `${SITE}/guide`, inLanguage: 'hi', isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      },
      crumb([{ name: 'गाइड', item: `${SITE}/guide` }]),
    ],
    body: shell({
      current: 'गाइड',
      html:
        `<h1>${esc(COURSE)}</h1><p>लेखांकन की नींव से ऑडिट तक — सहकारी समितियों के लिए मुफ्त हिन्दी कोर्स। नीचे सभी अध्याय:</p>` +
        (() => {
          const bySection = new Map();
          for (const e of chapters) {
            const s = e.section || 'भूमिका';
            if (!bySection.has(s)) bySection.set(s, []);
            bySection.get(s).push(e);
          }
          let out = '';
          for (const [section, items] of bySection) {
            out += `<h2>${esc(section)}</h2><ul>` +
              items.map((e) => `<li><a href="/guide/${e.slug}">${esc(e.title)}</a></li>`).join('') + `</ul>`;
          }
          return out;
        })() +
        registerCta(),
    }),
  }];

  for (const e of chapters) {
    const path = `/guide/${e.slug}`;
    const url = SITE + path;
    let body;
    try {
      const mdFile = resolve(GUIDE_DIR, `${e.slug}.md`);
      if (existsSync(mdFile)) {
        body = shell({
          crumbs: [['/guide', 'गाइड']],
          current: e.title,
          html: md(readFileSync(mdFile, 'utf-8')) + registerCta(),
        });
      }
    } catch { /* body optional */ }
    pages.push({
      path,
      title: `${e.title} — सहकार लेखा गाइड`,
      description: e.description || '',
      lastmod: LASTMOD.guide,
      body,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: e.title,
          description: e.description || '',
          inLanguage: 'hi',
          url,
          isPartOf: { '@type': 'Course', name: COURSE, url: `${SITE}/guide` },
          ...(e.section ? { articleSection: e.section } : {}),
          publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
        },
        crumb([
          { name: 'गाइड', item: `${SITE}/guide` },
          { name: e.title, item: url },
        ]),
      ],
    });
  }
  return pages;
}

/* ---------------- software routes (registry data body; regex meta fallback) ---------------- */

function softwarePages(DATA) {
  const types = DATA.society || [];
  const pages = [
    {
      path: '/software',
      title: 'सहकारी समिति लेखा सॉफ्टवेयर — हर प्रकार के लिए | Cooperative Society Software',
      description: 'PACS, दुग्ध, विपणन, उपभोक्ता, आवास, चीनी, श्रमिक व बहुउद्देशीय — हर प्रकार की सहकारी समिति के लिए मुफ़्त लेखा सॉफ्टवेयर। अपनी समिति का प्रकार चुनें।',
      lastmod: LASTMOD.software,
      jsonLd: [crumb([{ name: 'Software', item: `${SITE}/software` }])],
      body: types.length
        ? shell({
            current: 'सॉफ्टवेयर',
            html:
              `<h1>हर प्रकार की सहकारी समिति के लिए मुफ़्त लेखा सॉफ्टवेयर</h1>` +
              `<p>अपनी समिति का प्रकार चुनें:</p><ul>` +
              types.map((t) => `<li><a href="/software/${t.slug}">${esc(t.nameHi)} (${esc(t.nameEn)})</a> — ${esc(t.introHi || '')}</li>`).join('') +
              `</ul><h2>राज्य के अनुसार</h2><ul>` +
              (DATA.states || []).map((s) => `<li><a href="/cooperative-software/${s.slug}">${esc(s.nameHi)} (${esc(s.nameEn)})</a></li>`).join('') +
              `</ul>` + registerCta(),
          })
        : undefined,
    },
  ];
  if (existsSync(SOCIETY_TYPES)) {
    const src = readFileSync(SOCIETY_TYPES, 'utf-8');
    const re = /slug:\s*'([^']+)'[\s\S]*?metaTitle:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?metaDescription:\s*'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(src))) {
      const [, slug, title, description] = m;
      const url = `${SITE}/software/${slug}`;
      const t = types.find((x) => x.slug === slug);
      const body = t
        ? shell({
            crumbs: [['/software', 'सॉफ्टवेयर']],
            current: t.nameHi,
            html:
              `<h1>${esc(t.h1Hi || t.nameHi)}</h1>` +
              `<p>${esc(t.introHi || '')}</p>` +
              (t.painsHi && t.painsHi.length ? `<h2>आम चुनौतियाँ</h2><ul>${t.painsHi.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '') +
              (t.solvesHi && t.solvesHi.length ? `<h2>SahakarLekha कैसे मदद करता है</h2><ul>${t.solvesHi.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '') +
              (t.seoEn ? `<p lang="en">${esc(t.seoEn)}</p>` : '') +
              `<p><a href="/guide">मुफ़्त गाइड से सीखें</a> · <a href="/software">सभी समिति-प्रकार देखें</a></p>` +
              registerCta(),
          })
        : undefined;
      pages.push({
        path: `/software/${slug}`,
        title,
        description,
        lastmod: LASTMOD.software,
        body,
        jsonLd: [crumb([
          { name: 'Software', item: `${SITE}/software` },
          { name: title, item: url },
        ])],
      });
    }
  }
  return pages;
}

/* ---------------- state routes ---------------- */

function statePages(DATA) {
  const states = DATA.states || [];
  const pages = [];
  if (existsSync(STATES_FILE)) {
    const src = readFileSync(STATES_FILE, 'utf-8');
    const re = /slug:\s*'([^']+)'[\s\S]*?metaTitle:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?metaDescription:\s*'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(src))) {
      const [, slug, title, description] = m;
      const url = `${SITE}/cooperative-software/${slug}`;
      const s = states.find((x) => x.slug === slug);
      const body = s
        ? shell({
            crumbs: [['/software', 'सॉफ्टवेयर']],
            current: s.nameHi,
            html:
              `<h1>${esc(s.h1Hi || s.nameHi)}</h1>` +
              `<p>${esc(s.introHi || '')}</p>` +
              (s.act ? `<p><strong>लागू कानून:</strong> ${esc(s.act)}</p>` : '') +
              (s.ecosystem && s.ecosystem.length
                ? `<h2>${esc(s.nameHi)} का सहकारी तंत्र</h2><table border="1" cellpadding="6" style="border-collapse:collapse"><thead><tr><th>क्षेत्र</th><th>संस्था</th><th>SahakarLekha में</th></tr></thead><tbody>` +
                  s.ecosystem.map((r) => `<tr><td>${esc(r.area)}</td><td>${esc(r.body)}</td><td>${esc(r.fits)}</td></tr>`).join('') +
                  `</tbody></table>`
                : '') +
              (s.compliance && s.compliance.length ? `<h2>अनुपालन</h2><ul>${s.compliance.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : '') +
              (s.seoEn ? `<p lang="en">${esc(s.seoEn)}</p>` : '') +
              `<p><a href="/software">सभी समिति-प्रकार</a> · <a href="/guide">मुफ़्त गाइड</a></p>` +
              registerCta(),
          })
        : undefined;
      pages.push({
        path: `/cooperative-software/${slug}`,
        title,
        description,
        lastmod: LASTMOD.state,
        body,
        jsonLd: [crumb([
          { name: 'Software', item: `${SITE}/software` },
          { name: title, item: url },
        ])],
      });
    }
  }
  return pages;
}

/* ---------------- blog routes (regex meta + .md body; can't esbuild-load) ---------------- */

function blogPages() {
  const posts = [];
  if (existsSync(BLOG_FILE)) {
    const src = readFileSync(BLOG_FILE, 'utf-8');
    // per post, in declared order: slug, metaTitle, metaDescription, date [, updated]
    const re = /slug:\s*'([^']+)'[\s\S]*?metaTitle:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?metaDescription:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?date:\s*'([^']+)'(?:,\s*\r?\n\s*updated:\s*'([^']+)')?/g;
    let m;
    const today = new Date().toISOString().slice(0, 10);
    while ((m = re.exec(src))) {
      const [, slug, title, description, date, updated] = m;
      if (date > today) continue; // scheduled (future-dated) post — not live yet
      posts.push({ slug, title, description, date, updated });
    }
  }
  posts.sort((a, b) => (a.date < b.date ? 1 : -1));

  const pages = [
    {
      path: '/blog',
      title: 'सहकार लेखा ब्लॉग — सहकारी समिति लेखांकन, ऑडिट व प्रबंधन',
      description: 'सहकारी समितियों के लिए डिजिटल लेखांकन, वाउचर एंट्री, ऑडिट, अनुपालन व प्रबंधन पर सरल हिन्दी लेख।',
      lastmod: maxDate(posts.map((p) => p.updated || p.date), LASTMOD.static),
      jsonLd: [crumb([{ name: 'ब्लॉग', item: `${SITE}/blog` }])],
      body: posts.length
        ? shell({
            current: 'ब्लॉग',
            html:
              `<h1>सहकार लेखा ब्लॉग</h1><p>सहकारी समितियों के लिए डिजिटल लेखांकन, वाउचर एंट्री, ऑडिट व अनुपालन पर सरल हिन्दी लेख।</p><ul>` +
              posts.map((p) => `<li><a href="/blog/${p.slug}">${esc(p.title)}</a> <small>(${p.date})</small></li>`).join('') +
              `</ul>` + registerCta(),
          })
        : undefined,
    },
  ];
  for (const p of posts) {
    const url = `${SITE}/blog/${p.slug}`;
    let body;
    try {
      const mdFile = resolve(BLOG_DIR, `${p.slug}.md`);
      if (existsSync(mdFile)) {
        body = shell({
          crumbs: [['/blog', 'ब्लॉग']],
          current: p.title,
          html: md(readFileSync(mdFile, 'utf-8')) + registerCta(),
        });
      }
    } catch { /* body optional */ }
    pages.push({
      path: `/blog/${p.slug}`,
      title: p.title,
      description: p.description,
      lastmod: p.updated || p.date,
      body,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: p.title,
          description: p.description,
          inLanguage: 'hi',
          url,
          mainEntityOfPage: url,
          datePublished: p.date,
          dateModified: p.updated || p.date,
          author: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
          publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
        },
        crumb([
          { name: 'ब्लॉग', item: `${SITE}/blog` },
          { name: p.title, item: url },
        ]),
      ],
    });
  }
  return pages;
}

/* ---------------- help routes (regex meta + registry-data body) ---------------- */

function helpBody(t) {
  return shell({
    crumbs: [['/help', 'मदद केंद्र']],
    current: t.title,
    html:
      `<h1>${esc(t.title)}</h1>` +
      `<p><small>${esc(t.category)} · ${esc(t.estTime || '')}</small></p>` +
      (t.tldr ? `<blockquote><strong>संक्षेप में:</strong> ${esc(t.tldr)}</blockquote>` : '') +
      (t.prerequisites && t.prerequisites.length
        ? `<h2>पहले यह तैयार रखें</h2><ul>${t.prerequisites.map((p) => `<li>${esc(p.label)}</li>`).join('')}</ul>` : '') +
      (t.steps && t.steps.length
        ? `<h2>स्टेप-बाय-स्टेप</h2><ol>${t.steps.map((s) => `<li>${mdInline(s)}</li>`).join('')}</ol>` : '') +
      (t.commonMistakes && t.commonMistakes.length
        ? `<h2>आम गलतियाँ</h2><ul>${t.commonMistakes.map((s) => `<li>${mdInline(s)}</li>`).join('')}</ul>` : '') +
      (t.faqs && t.faqs.length
        ? `<h2>अक्सर पूछे जाने वाले प्रश्न</h2>` + t.faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('') : '') +
      (t.guideSlug ? `<p>पूरा समझें: <a href="/guide/${t.guideSlug}">गहराई से गाइड अध्याय</a></p>` : '') +
      (t.related && t.related.length
        ? `<p>जुड़े काम: ${t.related.map((r) => `<a href="/help/${r}">${r.replace(/-/g, ' ')}</a>`).join(' · ')}</p>` : '') +
      registerCta(t.deepLink && t.deepLink.route),
  });
}

function helpPages(DATA) {
  const tasks = DATA.help || [];
  const pages = [
    {
      path: '/help',
      title: 'मदद केंद्र (Help Center) — कैसे करें | SahakarLekha',
      description: 'सहकारी समिति लेखांकन के रोज़मर्रा के काम — Member कैसे जोड़ें, Opening Balance कैसे डालें, Voucher कैसे करें — आसान स्टेप-बाय-स्टेप।',
      lastmod: maxDate(tasks.map((t) => t.updated), LASTMOD.help),
      jsonLd: [crumb([{ name: 'मदद केंद्र', item: `${SITE}/help` }])],
      body: tasks.length
        ? shell({
            current: 'मदद केंद्र',
            html:
              `<h1>मदद केंद्र — "कैसे करें"</h1><p>रोज़मर्रा के काम, आसान स्टेप-बाय-स्टेप:</p>` +
              (() => {
                const byCat = new Map();
                for (const t of tasks) {
                  if (!byCat.has(t.category)) byCat.set(t.category, []);
                  byCat.get(t.category).push(t);
                }
                let out = '';
                for (const [cat, items] of byCat) {
                  out += `<h2>${esc(cat)}</h2><ul>` +
                    items.map((t) => `<li><a href="/help/${t.slug}">${esc(t.title)}</a></li>`).join('') + `</ul>`;
                }
                return out;
              })() + registerCta(),
          })
        : undefined,
    },
  ];
  if (existsSync(HELP_FILE)) {
    const src = readFileSync(HELP_FILE, 'utf-8');
    const re = /slug:\s*'([^']+)'[\s\S]*?metaTitle:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?metaDescription:\s*'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(src))) {
      const [, slug, title, description] = m;
      const url = `${SITE}/help/${slug}`;
      const t = tasks.find((x) => x.slug === slug);
      pages.push({
        path: `/help/${slug}`,
        title,
        description,
        lastmod: (t && t.updated) || LASTMOD.help,
        body: t ? helpBody(t) : undefined,
        jsonLd: [
          { '@context': 'https://schema.org', '@type': 'Article', headline: title, description, inLanguage: 'hi', url, publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE } },
          crumb([
            { name: 'मदद केंद्र', item: `${SITE}/help` },
            { name: title, item: url },
          ]),
        ],
      });
    }
  }
  return pages;
}

/* ---------------- cookbook routes (regex meta + registry-data body) ---------------- */

function cookbookBody(e) {
  return shell({
    crumbs: [['/cookbook', 'एंट्री कुकबुक']],
    current: e.title,
    html:
      `<h1>${esc(e.title)}</h1>` +
      `<p><small>${esc(e.category)}</small></p>` +
      (e.scenario ? `<p><strong>कब:</strong> ${esc(e.scenario)}</p>` : '') +
      (e.lines && e.lines.length
        ? `<h2>एंट्री (Journal)</h2><table border="1" cellpadding="6" style="border-collapse:collapse"><thead><tr><th>खाता</th><th>Dr/Cr</th><th>नोट</th></tr></thead><tbody>` +
          e.lines.map((l) => `<tr><td>${esc(l.account)}</td><td>${esc(l.type)}</td><td>${esc(l.note || '')}</td></tr>`).join('') +
          `</tbody></table>`
        : '') +
      (e.narration ? `<p><strong>विवरण (Narration):</strong> ${esc(e.narration)}</p>` : '') +
      (e.notes && e.notes.length ? `<h2>ध्यान रखें</h2><ul>${e.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '') +
      (e.guideSlug ? `<p>पूरा समझें: <a href="/guide/${e.guideSlug}">गाइड अध्याय</a></p>` : '') +
      (e.related && e.related.length
        ? `<p>जुड़ी एंट्रियाँ: ${e.related.map((r) => `<a href="/cookbook/${r}">${r.replace(/-/g, ' ')}</a>`).join(' · ')}</p>` : '') +
      registerCta(e.deepLink && e.deepLink.route),
  });
}

function cookbookPages(DATA) {
  const entries = DATA.cookbook || [];
  const pages = [
    {
      path: '/cookbook',
      title: 'एंट्री कुकबुक (Accounting Entries) — कौन-सी एंट्री कैसे करें | SahakarLekha',
      description: 'सहकारी समिति की आम journal entries — बिक्री-खरीद, शेयर पूँजी, ऋण-ब्याज, वेतन, डेप्रिसिएशन, क्लोज़िंग स्टॉक, HAFED कमीशन — हर एक का Dr/Cr उदाहरण सहित।',
      lastmod: maxDate(entries.map((e) => e.updated), LASTMOD.cookbook),
      jsonLd: [crumb([{ name: 'एंट्री कुकबुक', item: `${SITE}/cookbook` }])],
      body: entries.length
        ? shell({
            current: 'एंट्री कुकबुक',
            html:
              `<h1>एंट्री कुकबुक</h1><p>"X दर्ज करना हो तो कौन-सी एंट्री करें" — हर स्थिति का Dr/Cr उदाहरण:</p>` +
              (() => {
                const byCat = new Map();
                for (const e of entries) {
                  if (!byCat.has(e.category)) byCat.set(e.category, []);
                  byCat.get(e.category).push(e);
                }
                let out = '';
                for (const [cat, items] of byCat) {
                  out += `<h2>${esc(cat)}</h2><ul>` +
                    items.map((e) => `<li><a href="/cookbook/${e.slug}">${esc(e.title)}</a></li>`).join('') + `</ul>`;
                }
                return out;
              })() + registerCta(),
          })
        : undefined,
    },
  ];
  if (existsSync(COOKBOOK_FILE)) {
    const src = readFileSync(COOKBOOK_FILE, 'utf-8');
    const re = /slug:\s*'([^']+)'[\s\S]*?metaTitle:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?metaDescription:\s*'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(src))) {
      const [, slug, title, description] = m;
      const url = `${SITE}/cookbook/${slug}`;
      const e = entries.find((x) => x.slug === slug);
      pages.push({
        path: `/cookbook/${slug}`,
        title,
        description,
        lastmod: (e && e.updated) || LASTMOD.cookbook,
        body: e ? cookbookBody(e) : undefined,
        jsonLd: [
          { '@context': 'https://schema.org', '@type': 'Article', headline: title, description, inLanguage: 'hi', url, publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE } },
          crumb([
            { name: 'एंट्री कुकबुक', item: `${SITE}/cookbook` },
            { name: title, item: url },
          ]),
        ],
      });
    }
  }
  return pages;
}

/* ---------------- glossary routes (KI markdown → full-body term pages, GOS-03) ---------------- */

function parseKiSections(body) {
  const out = {};
  const re = /\*\*([^*\n]+?):\*\*/g;
  const marks = [];
  let m;
  while ((m = re.exec(body))) marks.push({ label: m[1].trim(), start: m.index, end: m.index + m[0].length });
  for (let i = 0; i < marks.length; i++) {
    const next = i + 1 < marks.length ? marks[i + 1].start : body.length;
    out[marks[i].label.replace(/\([^)]*\)/g, '').trim().toLowerCase()] = body.slice(marks[i].end, next).trim();
  }
  return out;
}

const kiPlain = (s) =>
  (s || '')
    .replace(/\[\[[^\]]*\]\]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function glossaryPages() {
  const pages = [
    {
      path: '/glossary',
      title: 'सहकारी लेखांकन शब्दकोश (Glossary) — हर शब्द आसान भाषा में | SahakarLekha',
      description: 'रोकड़ बही से बैलेंस शीट तक — सहकारी समिति लेखांकन के मुख्य शब्दों का आसान हिन्दी व English शब्दकोश।',
      lastmod: LASTMOD.static,
      jsonLd: [crumb([{ name: 'शब्दकोश', item: `${SITE}/glossary` }])],
    },
  ];
  if (!existsSync(GLOSSARY_DIR)) return pages;
  const files = readdirSync(GLOSSARY_DIR).filter((f) => /^KI-\d+.*\.md$/.test(f));

  // pass 1 — parse all KIs (need the id→slug map for related-concept links)
  const terms = [];
  for (const file of files) {
    const src = readFileSync(resolve(GLOSSARY_DIR, file), 'utf-8');
    const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) continue;
    const field = (k) => (fm[1].match(new RegExp(`^${k}:\\s*(.*)$`, 'm')) || [])[1]?.trim() || '';
    if (field('status') && field('status') !== 'active') continue;
    const body = src.slice(fm[0].length);
    terms.push({
      slug: file.replace(/^KI-\d+-/, '').replace(/\.md$/, ''),
      id: field('knowledge_id'),
      hindi: field('hindi_name'),
      en: field('english_name') || field('title'),
      lastUpdated: field('last_updated'),
      sections: parseKiSections(body),
    });
  }
  const idToSlug = new Map(terms.map((t) => [t.id, t.slug]));

  // glossary hub body — A–Z list of every active term (crawlable link hub)
  pages[0].lastmod = maxDate(terms.map((t) => t.lastUpdated), LASTMOD.static);
  pages[0].body = shell({
    current: 'शब्दकोश',
    html:
      `<h1>सहकारी लेखांकन शब्दकोश</h1><p>हर शब्द आसान हिन्दी व English में — ${terms.length} शब्द:</p><ul>` +
      [...terms].sort((a, b) => a.en.localeCompare(b.en))
        .map((t) => `<li><a href="/glossary/${t.slug}">${esc(t.hindi ? `${t.hindi} (${t.en})` : t.en)}</a></li>`).join('') +
      `</ul>` + registerCta(),
  });

  for (const t of terms) {
    const s = t.sections;
    const name = t.hindi ? `${t.hindi} (${t.en})` : t.en;
    const def = kiPlain(s['definition']);
    const url = `${SITE}/glossary/${t.slug}`;

    // related-concept links (only to other ACTIVE terms)
    const related = [];
    const relRe = /\[\[(KI-\d+)\]\]\s*([^·\n]*)/g;
    let rm;
    while ((rm = relRe.exec(s['related concepts'] || ''))) {
      const slug = idToSlug.get(rm[1]);
      const label = rm[2].replace(/\(planned\)/i, '').trim();
      if (slug) related.push(`<a href="/glossary/${slug}">${esc(label)}</a>`);
      else if (label) related.push(esc(label));
    }
    const internalLinks = Array.from((s['internal links'] || '').matchAll(/(^|[\s·])(\/[a-z0-9/:_-]+)/gi)).map((mm) => mm[2]);

    pages.push({
      path: `/glossary/${t.slug}`,
      title: `${name} — सहकारी लेखांकन शब्दकोश | SahakarLekha`,
      description: def.slice(0, 158),
      lastmod: t.lastUpdated || LASTMOD.static,
      body: shell({
        crumbs: [['/glossary', 'शब्दकोश']],
        current: t.hindi || t.en,
        html:
          `<h1>${esc(t.hindi || t.en)}</h1><p><em>${esc(t.en)}</em></p>` +
          (def ? `<p><strong>परिभाषा:</strong> ${esc(def)}</p>` : '') +
          (s['plain-language explanation'] ? `<h2>आसान शब्दों में</h2><p>${esc(kiPlain(s['plain-language explanation']))}</p>` : '') +
          (s['hindi explanation'] ? `<h2>हिन्दी में</h2><p lang="hi">${esc(kiPlain(s['hindi explanation']))}</p>` : '') +
          (s['english explanation'] ? `<h2>In English</h2><p lang="en">${esc(kiPlain(s['english explanation']))}</p>` : '') +
          (s['why it matters'] ? `<h2>यह क्यों ज़रूरी है</h2><p>${esc(kiPlain(s['why it matters']))}</p>` : '') +
          (s['common misconceptions'] ? `<h2>आम गलतफ़हमियाँ</h2>${md(s['common misconceptions'].replace(/\[\[[^\]]*\]\]/g, ''))}` : '') +
          (s['learning objectives'] ? `<h2>सीखने के लक्ष्य</h2>${md(s['learning objectives'].replace(/\[\[[^\]]*\]\]/g, ''))}` : '') +
          (related.length ? `<h2>जुड़े विषय</h2><p>${related.join(' · ')}</p>` : '') +
          (internalLinks.length ? `<p>और पढ़ें: ${internalLinks.map((l) => `<a href="${l}">${l}</a>`).join(' · ')}</p>` : '') +
          registerCta(),
      }),
      jsonLd: [
        {
          '@context': 'https://schema.org', '@type': 'DefinedTerm', name, description: def,
          inLanguage: 'hi', url, termCode: t.id,
          inDefinedTermSet: { '@type': 'DefinedTermSet', name: 'SahakarLekha Glossary', url: `${SITE}/glossary` },
        },
        crumb([
          { name: 'शब्दकोश', item: `${SITE}/glossary` },
          { name: t.en, item: url },
        ]),
      ],
    });
  }
  return pages;
}

/* ---------------- calculator routes (regex meta + registry-data body) ---------------- */

function calcBody(c) {
  return shell({
    crumbs: [['/tools', 'कैलकुलेटर']],
    current: c.hindiName,
    html:
      `<h1>${esc(c.hindiName)} (${esc(c.englishName)})</h1>` +
      (c.intro ? `<p>${esc(c.intro)}</p>` : '') +
      `<p><em>इंटरैक्टिव कैलकुलेटर पेज लोड होते ही चालू हो जाता है — नीचे सूत्र व उदाहरण पढ़ें।</em></p>` +
      (c.formula ? `<h2>सूत्र</h2>${md(c.formula)}` : '') +
      (c.explanation ? `<h2>यह कैसे काम करता है</h2>${md(c.explanation)}` : '') +
      (c.example ? `<h2>उदाहरण</h2>${md(c.example)}` : '') +
      (c.mistakes ? `<h2>आम गलतियाँ</h2>${md(c.mistakes)}` : '') +
      (c.faqs && c.faqs.length
        ? `<h2>अक्सर पूछे जाने वाले प्रश्न</h2>` + c.faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('') : '') +
      (c.relatedGlossary && c.relatedGlossary.length
        ? `<p>जुड़े शब्द: ${c.relatedGlossary.map((g) => `<a href="/glossary/${g}">${g.replace(/-/g, ' ')}</a>`).join(' · ')}</p>` : '') +
      (c.relatedArticles && c.relatedArticles.length
        ? `<p>गहराई से पढ़ें: ${c.relatedArticles.map((a) => `<a href="/blog/${a.slug}">${esc(a.title)}</a>`).join(' · ')}</p>` : '') +
      (c.related && c.related.length
        ? `<p>और कैलकुलेटर: ${c.related.map((r) => `<a href="/tools/${r}">${r.replace(/-/g, ' ')}</a>`).join(' · ')}</p>` : '') +
      registerCta(),
  });
}

function calculatorPages(DATA) {
  const calcs = DATA.calc || [];
  const pages = [
    {
      path: '/tools',
      title: 'सहकारी लेखांकन कैलकुलेटर (Calculators) — मुफ्त | SahakarLekha',
      description: 'ब्याज, EMI, मूल्यह्रास, GST, TDS, अंश पूँजी, रोकड़ अंतर, प्रतिशत व कार्यशील पूँजी — सहकारी समिति के लिए मुफ्त, आसान कैलकुलेटर।',
      lastmod: maxDate(calcs.map((c) => c.updated), LASTMOD.calc),
      jsonLd: [crumb([{ name: 'कैलकुलेटर', item: `${SITE}/tools` }])],
      body: calcs.length
        ? shell({
            current: 'कैलकुलेटर',
            html:
              `<h1>मुफ्त कैलकुलेटर</h1><p>सहकारी समिति के हिसाब के लिए — हर कैलकुलेटर के साथ सूत्र, उदाहरण व आम गलतियाँ:</p><ul>` +
              calcs.map((c) => `<li><a href="/tools/${c.slug}">${esc(c.hindiName)}</a> — ${esc(c.intro || '')}</li>`).join('') +
              `</ul>` + registerCta(),
          })
        : undefined,
    },
  ];
  if (existsSync(CALC_FILE)) {
    const src = readFileSync(CALC_FILE, 'utf-8');
    // per calculator: slug, metaTitle, metaDescription in order. Tempered `(?!slug:)` so an
    // inner slug: (relatedArticles/relatedHelp) never bridges to the NEXT config's meta.
    const re = /slug:\s*'([^']+)'(?:(?!slug:)[\s\S])*?metaTitle:\s*'((?:[^'\\]|\\.)*)'(?:(?!slug:)[\s\S])*?metaDescription:\s*'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(src))) {
      const [, slug, title, description] = m;
      const url = `${SITE}/tools/${slug}`;
      const c = calcs.find((x) => x.slug === slug);
      pages.push({
        path: `/tools/${slug}`,
        title,
        description,
        lastmod: (c && c.updated) || LASTMOD.calc,
        body: c ? calcBody(c) : undefined,
        jsonLd: [
          {
            '@context': 'https://schema.org', '@type': 'WebApplication', name: title, description,
            inLanguage: 'hi', url, applicationCategory: 'FinanceApplication', operatingSystem: 'Web',
            isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
            publisher: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
          },
          crumb([
            { name: 'कैलकुलेटर', item: `${SITE}/tools` },
            { name: title, item: url },
          ]),
        ],
      });
    }
  }
  return pages;
}

/* ---------------- pricing + faq (GOS-05: static publics, now prerendered) ---------------- */

function staticExtraPages(DATA) {
  const pages = [];

  pages.push({
    path: '/pricing',
    title: 'मूल्य — SahakarLekha हमेशा मुफ़्त | Free Cooperative Accounting',
    description: 'SahakarLekha सहकारी समितियों के लिए हमेशा मुफ़्त — कोई छिपा शुल्क नहीं. मुफ़्त बनाम प्रीमियम सुविधाओं की तुलना देखें. Free forever for cooperative societies; compare free vs premium features.',
    lastmod: LASTMOD.pricing,
    jsonLd: [crumb([{ name: 'मूल्य', item: `${SITE}/pricing` }])],
    body: shell({
      current: 'मूल्य',
      html:
        `<h1>SahakarLekha हमेशा मुफ़्त है</h1>` +
        `<p>सहकारी समितियों के लिए पूरा लेखा सॉफ्टवेयर — वाउचर, लेजर, ट्रायल बैलेंस, बैलेंस शीट, TDS/GST सारांश, ऑडिट रिपोर्ट — <strong>100% मुफ़्त</strong>। कोई छिपा शुल्क नहीं, कोई ट्रायल अवधि नहीं, कोई क्रेडिट कार्ड नहीं।</p>` +
        `<ul><li>असीमित वाउचर व सदस्य</li><li>सभी रिपोर्ट PDF/Excel में</li><li>हिन्दी + English</li><li>क्लाउड बैकअप</li></ul>` +
        `<p><a href="/faq">अक्सर पूछे जाने वाले प्रश्न देखें</a></p>` +
        registerCta(),
    }),
  });

  const cats = DATA.faq || [];
  const faqJsonLd = cats.length
    ? [{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: cats.flatMap((c) => c.items).map((it) => ({
          '@type': 'Question',
          name: it.q,
          acceptedAnswer: { '@type': 'Answer', text: `${it.aHi} ${it.aEn}` },
        })),
      }]
    : [];
  pages.push({
    path: '/faq',
    title: 'अक्सर पूछे जाने वाले प्रश्न (FAQ) — SahakarLekha',
    description: 'क्या यह वाकई मुफ़्त है? ऑडिटर रिपोर्ट स्वीकार करेंगे? डेटा सुरक्षित है? Tally से कैसे आएँ? — SahakarLekha के सभी सामान्य प्रश्नों के उत्तर हिंदी व English में.',
    lastmod: LASTMOD.faq,
    jsonLd: [...faqJsonLd, crumb([{ name: 'FAQ', item: `${SITE}/faq` }])],
    body: cats.length
      ? shell({
          current: 'FAQ',
          html:
            `<h1>अक्सर पूछे जाने वाले प्रश्न</h1>` +
            cats.map((c) =>
              `<h2>${esc(c.label)}</h2>` +
              c.items.map((it) => `<h3>${esc(it.q)}</h3><p lang="hi">${esc(it.aHi)}</p><p lang="en">${esc(it.aEn)}</p>`).join('')
            ).join('') +
            registerCta(),
        })
      : undefined,
  });

  return pages;
}

/* ---------------- sitemap index + per-family child sitemaps (GOS-02) ---------------- */

function familyOf(path) {
  if (path === '/blog' || path.startsWith('/blog/')) return 'blog';
  if (path === '/guide' || path.startsWith('/guide/')) return 'guide';
  if (path === '/glossary' || path.startsWith('/glossary/')) return 'glossary';
  if (path === '/tools' || path.startsWith('/tools/')) return 'tools';
  if (path === '/help' || path.startsWith('/help/')) return 'help';
  if (path === '/cookbook' || path.startsWith('/cookbook/')) return 'cookbook';
  if (path === '/software' || path.startsWith('/software/') || path.startsWith('/cooperative-software/')) return 'software';
  return 'pages';
}

function rank(path) {
  if (path === '/') return { changefreq: 'weekly', priority: '1.0' };
  if (path === '/blog' || path === '/guide') return { changefreq: 'weekly', priority: '0.9' };
  if (path === '/software' || path === '/glossary' || path === '/tools') return { changefreq: 'weekly', priority: '0.8' };
  if (path === '/register') return { changefreq: 'monthly', priority: '0.9' };
  if (path === '/login') return { changefreq: 'monthly', priority: '0.8' };
  if (path.startsWith('/tools/')) return { changefreq: 'monthly', priority: '0.7' };
  if (path.startsWith('/blog/')) return { changefreq: 'monthly', priority: '0.8' };
  if (path.startsWith('/software/') || path.startsWith('/cooperative-software/')) return { changefreq: 'monthly', priority: '0.8' };
  if (path.startsWith('/glossary/')) return { changefreq: 'monthly', priority: '0.6' };
  if (path.startsWith('/guide/quiz/')) return { changefreq: 'monthly', priority: '0.4' };
  if (path.startsWith('/guide/')) return { changefreq: 'monthly', priority: '0.7' };
  if (path === '/privacy' || path === '/terms') return { changefreq: 'yearly', priority: '0.3' };
  return { changefreq: 'monthly', priority: '0.6' };
}

function buildSitemaps(dynamicPages, blogMax) {
  // Static public routes (not prerendered, or app-entry pages worth indexing).
  const STATIC = [
    { path: '/', lastmod: blogMax },
    { path: '/register', lastmod: LASTMOD.static },
    { path: '/login', lastmod: LASTMOD.static },
    { path: '/about', lastmod: LASTMOD.static },
    { path: '/contact', lastmod: LASTMOD.static },
    { path: '/privacy', lastmod: '2026-06-20' },
    { path: '/terms', lastmod: LASTMOD.static },
    { path: '/guide/quick-start', lastmod: LASTMOD.guide },
    { path: '/guide/certificate', lastmod: LASTMOD.guide },
    { path: '/guide/verify', lastmod: LASTMOD.guide },
  ];
  for (let i = 1; i <= 10; i++) STATIC.push({ path: `/guide/quiz/part-${i}`, lastmod: LASTMOD.guide });

  const all = [
    ...STATIC,
    ...dynamicPages.filter((p) => p && p.path).map((p) => ({ path: p.path, lastmod: p.lastmod || LASTMOD.static })),
  ];
  const seen = new Set();
  const urls = all.filter((u) => (seen.has(u.path) ? false : (seen.add(u.path), true)));

  // group by family
  const groups = new Map();
  for (const u of urls) {
    const fam = familyOf(u.path);
    if (!groups.has(fam)) groups.set(fam, []);
    groups.get(fam).push(u);
  }

  const files = new Map();
  const indexEntries = [];
  for (const [fam, items] of groups) {
    const name = `sitemap-${fam}.xml`;
    const body = items.map((u) => {
      const r = rank(u.path);
      return `  <url>\n    <loc>${SITE}${u.path}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`;
    }).join('\n');
    files.set(name, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
    indexEntries.push({ name, lastmod: maxDate(items.map((i) => i.lastmod), LASTMOD.static), count: items.length });
  }

  const index = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    indexEntries.map((e) => `  <sitemap>\n    <loc>${SITE}/${e.name}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </sitemap>`).join('\n') +
    `\n</sitemapindex>\n`;
  files.set('sitemap.xml', index);
  return { files, total: urls.length, perFamily: indexEntries };
}

/* ---------------- head + body transform ---------------- */

function transform(template, page) {
  const url = SITE + page.path;
  let html = template;

  // Subpages: drop the homepage-only template schemas (SoftwareApplication + the
  // 5-question FAQPage) so each page carries ONLY its own JSON-LD + Organization.
  html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>\s*/g, (m0, body) =>
    /"@type":\s*"(SoftwareApplication|FAQPage)"/.test(body) ? '' : m0);

  const sub = (re, value) => { if (re.test(html)) html = html.replace(re, value); };
  sub(/<title>[\s\S]*?<\/title>/, `<title>${esc(page.title)}</title>`);
  sub(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(page.description)}" />`);
  sub(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}" />`);
  sub(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${url}" />`);
  sub(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(page.title)}" />`);
  sub(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(page.description)}" />`);
  sub(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(page.title)}" />`);
  sub(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(page.description)}" />`);
  if (page.jsonLd && page.jsonLd.length) {
    // Escape "<" so a value containing "</script>" can never break out of the tag (safe JSON-in-HTML).
    const json = JSON.stringify(page.jsonLd).replace(/</g, '\\u003c');
    const ld = `<script type="application/ld+json">${json}</script>\n  </head>`;
    html = html.replace('</head>', ld);
  }
  // GOS-01: real static body inside #root (React's createRoot replaces it on mount).
  if (page.body) {
    html = html.replace(/<div id="root">\s*<\/div>/, `<div id="root">${page.body}</div>`);
  }
  return html;
}

/* ---------------- main ---------------- */

try {
  if (!existsSync(TEMPLATE)) {
    console.warn('[prerender] dist/index.html not found — skipping.');
    process.exit(0);
  }
  const template = readFileSync(TEMPLATE, 'utf-8');
  const DATA = await loadData();

  const blog = blogPages();
  const pages = [
    ...guidePages(),
    ...softwarePages(DATA),
    ...statePages(DATA),
    ...blog,
    ...helpPages(DATA),
    ...cookbookPages(DATA),
    ...glossaryPages(),
    ...calculatorPages(DATA),
    ...staticExtraPages(DATA),
  ];

  let n = 0, withBody = 0;
  for (const page of pages) {
    if (!page || !page.path) continue;
    const outDir = resolve(DIST, page.path.replace(/^\//, ''));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, 'index.html'), transform(template, page), 'utf-8');
    n++;
    if (page.body) withBody++;
  }
  console.log(`[prerender] wrote ${n} static pages (${withBody} with full HTML body).`);

  try {
    const blogMax = maxDate(blog.map((p) => p.lastmod), LASTMOD.static);
    const { files, total, perFamily } = buildSitemaps(pages, blogMax);
    for (const [name, xml] of files) writeFileSync(resolve(DIST, name), xml, 'utf-8');
    console.log(`[prerender] wrote sitemap index + ${files.size - 1} child sitemaps (${total} URLs): ` +
      perFamily.map((e) => `${e.name.replace('sitemap-', '').replace('.xml', '')}=${e.count}`).join(', '));
  } catch (e) {
    console.warn('[prerender] sitemap generation skipped:', e && e.message ? e.message : e);
  }
} catch (err) {
  console.warn('[prerender] skipped due to error:', err && err.message ? err.message : err);
  process.exit(0); // never block the build
}

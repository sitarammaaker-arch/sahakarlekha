// Run a Vite-coupled `src/` module under plain node.
//
// Several content registries use `import.meta.glob`, which is a Vite compile-time
// transform — so `src/content/{glossary,guide,blog}` and anything importing them
// (siteSearch) cannot be imported or esbuild-loaded directly. prerender-guide.mjs
// works around this by regex-parsing those files; that costs a second parser which
// drifts from the real one.
//
// This does it properly: esbuild rewrites `import.meta.glob(...)` to `__viteGlob(...)`
// via `define`, and we supply that function. The module then runs unmodified, so
// callers measure/serve the SAME code the browser ships.
//
// Pattern semantics:
//   • root-relative ("/docs/kpp/wave-1-active/KI-*.md") → real files, keyed exactly
//     as Vite keys them. This is how the KI corpus loads.
//   • relative ("./*.md") → {}. Bundling erases the importing file's directory, so
//     the base is unrecoverable. Safe today because every relative glob in this repo
//     carries only RAW ARTICLE BODIES (loadBlogRaw / loadGuideRaw), which the search
//     index never reads — it indexes the TS-literal metadata beside them. If a
//     relative glob ever becomes load-bearing, this returns {} silently, so assert on
//     what you loaded rather than trusting it.

import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Install the glob shim on globalThis. Must run before the bundled module evaluates. */
export function installViteGlob(root) {
  globalThis.__viteGlob = (pattern) => {
    if (typeof pattern !== 'string' || !pattern.startsWith('/')) return {};
    const cut = pattern.lastIndexOf('/');
    const dir = pattern.slice(0, cut);
    const rx = new RegExp(
      '^' + pattern.slice(cut + 1).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
    );
    const abs = resolve(root, dir.slice(1));
    const out = {};
    if (!existsSync(abs)) return out;
    for (const f of readdirSync(abs)) {
      if (rx.test(f)) out[`${dir}/${f}`] = readFileSync(resolve(abs, f), 'utf8');
    }
    return out;
  };
}

/**
 * esbuild-bundle a src/ module (globs rewritten) and import it.
 * Mirrors scripts/prerender-guide.mjs:143 — same cache dir convention, same aliasing.
 */
export async function loadViteModule(root, entry, cacheName = 'vite') {
  installViteGlob(root);
  const esbuild = await import('esbuild');
  const out = resolve(root, 'node_modules', '.cache', cacheName, basename(entry).replace(/\.tsx?$/, '') + '.mjs');
  mkdirSync(dirname(out), { recursive: true });
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: out,
    alias: { '@': resolve(root, 'src') },
    jsx: 'automatic',
    define: { 'import.meta.glob': 'globalThis.__viteGlob' },
    logLevel: 'silent',
  });
  return import(pathToFileURL(out).href + `?t=${Date.now()}`);
}

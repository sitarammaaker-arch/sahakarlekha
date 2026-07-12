// Vernacular i18n — locale registry, fallback & script integrity (T-38 / RULE 7, RULE 8, RULE 2).
//
// Proves the vernacular principle extends beyond Hindi:
//   • message resolution falls back requested → Hindi → English → key; never blank (RULE 7);
//   • script-integrity guard rejects mojibake & wrong-script corruption (RULE 8, Devanagari-safe);
//   • localized amounts transliterate digits per locale WITHOUT changing the figure (RULE 2/exact).
//
// Run: node scripts/test-i18n-locale.mjs   (npm run test:i18n-locale)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

// locale.ts imports '../money' (relative, no ext) — resolve it.
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath } from 'node:url';
  const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
      for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
        const u = new URL(cand, ctx.parentURL);
        if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
      }
    }
    return next(spec, ctx);
  }
`));

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let L;
try {
  L = await import(abs('../src/lib/i18n/locale.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the i18n/locale module.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { LOCALES, fallbackChain, resolveMessage, hasMojibake, isScriptClean, toNativeDigits, localizeAmount } = L;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. REGISTRY — beyond Hindi ───────────────────────────────────────────────
ok(LOCALES.mr.script === 'Devanagari' && LOCALES.ta.script === 'Tamil' && LOCALES.gu.script === 'Gujarati',
  'the registry covers regional languages with their scripts (Marathi reuses Devanagari)');
ok(Object.keys(LOCALES).length >= 10, 'at least ten locales are supported beyond hi/en');

// ── 2. FALLBACK RESOLUTION (RULE 7 Hindi-first) ──────────────────────────────
ok(JSON.stringify(fallbackChain('mr')) === JSON.stringify(['mr', 'hi', 'en']), 'the fallback chain is requested → Hindi → English');
ok(JSON.stringify(fallbackChain('hi')) === JSON.stringify(['hi', 'en']), 'Hindi de-dupes in its own chain');
const packs = {
  en: { save: 'Save', reserve: 'Reserve Fund' },
  hi: { save: 'सेव करें', reserve: 'रिज़र्व फंड' },
  mr: { save: 'जतन करा' }, // reserve is MISSING in Marathi
};
ok(resolveMessage(packs, 'mr', 'save') === 'जतन करा', 'a key present in the requested language is used');
ok(resolveMessage(packs, 'mr', 'reserve') === 'रिज़र्व फंड', 'a missing Marathi key falls back to Hindi (RULE 7)');
ok(resolveMessage(packs, 'ta', 'save') === 'सेव करें', 'a language with no pack falls back to Hindi');
ok(resolveMessage(packs, 'ta', 'unknown_key') === 'unknown_key', 'a wholly unknown key returns the key itself — never blank');

// ── 3. SCRIPT INTEGRITY (RULE 8) ─────────────────────────────────────────────
ok(isScriptClean('रिज़र्व फंड', 'Devanagari'), 'clean Devanagari passes');
ok(isScriptClean('Reserve Fund 2025', 'Latin'), 'clean Latin+digits passes');
ok(isScriptClean('रिज़र्व फंड ₹1,234.00', 'Devanagari'), 'Devanagari mixed with ASCII digits, ₹, and punctuation passes');
ok(hasMojibake('रि�') && !hasMojibake('रिज़र्व'), 'the U+FFFD replacement char is detected as mojibake; clean text is not');
ok(!isScriptClean('रि�', 'Devanagari'), 'a string containing the mojibake marker is rejected (RULE 8)');
ok(!isScriptClean('रिज़र्व ગુજરાતી', 'Devanagari'), 'Gujarati characters inside a Devanagari string are rejected (wrong-script corruption)');
ok(!isScriptClean('தமிழ்', 'Devanagari'), 'Tamil text is not clean Devanagari');
ok(isScriptClean('தமிழ்', 'Tamil'), 'Tamil text is clean under the Tamil script');

// ── 4. VERNACULAR NUMERALS + EXACT AMOUNT (RULE 2) ───────────────────────────
ok(toNativeDigits('123', 'hi') === '१२३', 'ASCII digits transliterate to Devanagari numerals');
ok(toNativeDigits('123', 'gu') === '૧૨૩', 'ASCII digits transliterate to Gujarati numerals');
ok(toNativeDigits('123', 'en') === '123', 'Latin locale leaves digits unchanged');
ok(toNativeDigits('₹1,234.50', 'hi') === '₹१,२३४.५०', 'only digits change — grouping, decimal and ₹ are preserved');
// the VALUE is identical across locales — only glyphs differ (never diverges, RULE 2).
const enAmt = localizeAmount(123450, 'en', { symbol: true });
const hiAmt = localizeAmount(123450, 'hi', { symbol: true });
ok(enAmt === '₹1,234.50', 'the English amount uses Indian grouping from money.formatMinor');
ok(hiAmt === '₹१,२३४.५०', 'the Hindi amount is the same figure in Devanagari numerals');
ok(toNativeDigits(enAmt, 'hi') === hiAmt, 'the Hindi amount is exactly the English amount with digits transliterated — same figure, no divergence (RULE 2)');
// negative + exact paise preserved.
ok(localizeAmount(-5, 'hi') === '-०.०५', 'a negative exact paise amount localizes correctly');

// ── 5. PURITY ────────────────────────────────────────────────────────────────
const code = readFileSync(pathResolve(SRC, 'lib', 'i18n', 'locale.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
  ok(!code.includes(forbidden), `i18n/locale is pure & does no I/O (no "${forbidden}")`);
}

console.log(`\nVernacular i18n — locale, fallback & script integrity: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

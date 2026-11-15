// In-app messages follow the chosen language (founder 2026-11-15: the app must read fully in Hindi OR English).
// For the files listed below, every Hindi string inside a toast call must be the Hindi half of tr('हिंदी', 'English')
// (lib/uiLang), and the English half must carry no Devanagari at all. A new Hindi-only toast fails.
// Stored data (voucher narrations, audit text) is NOT a toast and stays Hindi — this test only looks inside toasts.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = [
  'src/contexts/DataContext.tsx',
  'src/contexts/MarketingDataContext.tsx',
  'src/contexts/ConsumerDataContext.tsx',
  'src/contexts/HousingDataContext.tsx',
  'src/contexts/DairyDataContext.tsx',
  'src/contexts/LabourDataContext.tsx',
  'src/contexts/TransportOpsContext.tsx',
  'src/hooks/useDomainAccountProvisioning.ts',
];
const DEV = /[ऀ-ॿ]/;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

/** [start, end) of every string / template literal, skipping comments; nested templates inside ${} are skipped. */
function literals(s) {
  const res = []; const n = s.length; let i = 0;
  const quoted = (k, q) => { let j = k + 1; while (j < n) { if (s[j] === '\\') { j += 2; continue; } if (s[j] === q || s[j] === '\n') return j + 1; j++; } return j; };
  const template = (k) => {
    let j = k + 1;
    while (j < n) {
      if (s[j] === '\\') { j += 2; continue; }
      if (s[j] === '`') return j + 1;
      if (s[j] === '$' && s[j + 1] === '{') {
        j += 2; let depth = 1;
        while (j < n && depth) {
          const c = s[j];
          if (c === '`') { j = template(j); continue; }
          if (c === "'" || c === '"') { j = quoted(j, c); continue; }
          if (c === '{') depth++; else if (c === '}') depth--;
          j++;
        }
        continue;
      }
      j++;
    }
    return j;
  };
  while (i < n) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '/') { while (i < n && s[i] !== '\n') i++; continue; }
    if (c === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === "'" || c === '"') { const e = quoted(i, c); res.push([i, e]); i = e; continue; }
    if (c === '`') { const e = template(i); res.push([i, e]); i = e; continue; }
    i++;
  }
  return res;
}
/** Text outside ${…} of a template literal body. */
function outsideExprs(t) {
  let out = '', i = 0;
  while (i < t.length) {
    if (t[i] === '$' && t[i + 1] === '{') { let depth = 1; i += 2; while (i < t.length && depth) { if (t[i] === '{') depth++; else if (t[i] === '}') depth--; i++; } continue; }
    out += t[i]; i++;
  }
  return out;
}

let wrapped = 0;
for (const rel of FILES) {
  const src = readFileSync(resolve(ROOT, rel), 'utf8');
  const lits = literals(src);
  const starts = new Map(lits.map(([a, b]) => [a, b]));
  // toast call spans, literal-aware paren matching
  const calls = [];
  const re = /\b(toastRef\.current|toast)\(/g; let m;
  while ((m = re.exec(src))) {
    let j = m.index + m[0].length, depth = 1;
    while (j < src.length && depth) {
      if (starts.has(j)) { j = starts.get(j); continue; }
      if (src[j] === '(') depth++; else if (src[j] === ')') depth--;
      j++;
    }
    calls.push([m.index, j]);
  }
  const inCall = (a) => calls.some(([x, y]) => a > x && a < y);
  const lineOf = (a) => src.slice(0, a).split('\n').length;
  for (const [a, b] of lits) {
    if (!inCall(a)) continue;
    const text = src.slice(a, b);
    if (!DEV.test(outsideExprs(text))) continue;
    const before = src.slice(Math.max(0, a - 4), a);
    if (/tr\($/.test(before)) {
      // the English half: the literal right after ", "
      const rest = src.slice(b).match(/^\s*,\s*/);
      const enStart = rest ? b + rest[0].length : -1;
      const enEnd = starts.get(enStart);
      ok(enEnd != null, `${rel}:${lineOf(a)} tr() without an English literal`);
      // the English half may hold no Devanagari at all — not even a Hindi literal inside one of its ${…} parts
      if (enEnd != null) { ok(!DEV.test(src.slice(enStart, enEnd)), `${rel}:${lineOf(a)} English half has Devanagari → ${src.slice(enStart, enEnd).slice(0, 80)}`); wrapped++; }
      continue;
    }
    // an English half itself (tr('हिं', `…${'हिं'}…`)) is fine when its Devanagari sits only inside ${}
    ok(false, `${rel}:${lineOf(a)} Hindi-only toast text → ${text.slice(0, 80)}`);
  }
}
// tr() follows the language LanguageProvider sets (Hindi by default)
const ui = await import(new URL('../src/lib/uiLang.ts', import.meta.url).href).catch(() => null);
if (ui) {
  ok(ui.tr('हाँ', 'Yes') === 'हाँ', 'tr() is Hindi by default');
  ui.setUiLanguage('en'); ok(ui.tr('हाँ', 'Yes') === 'Yes', 'tr() is English after setUiLanguage(en)');
  ui.setUiLanguage('hi'); ok(ui.tr('हाँ', 'Yes') === 'हाँ', 'tr() back to Hindi');
}
const lc = readFileSync(resolve(ROOT, 'src/contexts/LanguageContext.tsx'), 'utf8');
ok(/setUiLanguage\(language\);/.test(lc), 'LanguageProvider keeps lib/uiLang in step with the chosen language');

console.log(`[toast-english] ${wrapped} Hindi toast strings carry an English twin · ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

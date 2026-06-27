// After language modernization, an old "shuddh (common)" gloss like "अंश (शेयर)" can
// collapse to "शेयर (शेयर)". Drop a parenthetical ONLY when it duplicates the word(s)
// right before it (or the last word of a phrase). Legit glosses — "नाम (Debit)",
// "नकद (संपत्ति)" — are kept because the gloss differs from the preceding term.
import fs from 'node:fs';

const re = /([\p{L}\p{M}]+(?:[ -][\p{L}\p{M}]+){0,2})\s\(([\p{L}\p{M}]+(?:[ -][\p{L}\p{M}]+){0,2})\)/gu;
let totalFiles = 0, totalHits = 0;
for (const f of process.argv.slice(2)) {
  const before = fs.readFileSync(f, 'utf8');
  let hits = 0;
  const after = before.replace(re, (m, term, gloss) => {
    const lastWord = term.split(/[ -]/).pop();
    if (gloss === term || gloss === lastWord) { hits++; return term; }
    return m;
  });
  if (after !== before) { fs.writeFileSync(f, after, 'utf8'); totalFiles++; totalHits += hits; console.log(`  ${hits}  ${f}`); }
}
console.log(`\n[dedup-gloss] removed ${totalHits} redundant parentheticals in ${totalFiles} files.`);

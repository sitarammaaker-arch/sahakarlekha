// TDS section references resolved by DATE — the Income-tax Act 2025 renumbering.
//
// The fact: the 2025 Act came into force 1-4-2026 and the 1961 Act stands repealed;
// sections were renumbered. Every TDS register / 26Q / certificate still prints 1961
// numbers.
//
// The load-bearing assertions are that this is a LOOKUP, not a rename: the stored key
// never changes, an old entry still resolves to its old section, and the new mapping is
// never presented as settled. Renaming the column would falsify history — the 2025 Act's
// own transitional provisions keep the 1961 Act alive for earlier tax years.
//
// Run: node scripts/test-tds-sections.mjs   (npm run test:tds-sections)

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadViteModule } from './lib/vite-bundle.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { resolveSectionRef, describeSectionRef, isAct2025, ACT_2025_FROM } =
  await loadViteModule(ROOT, resolve(ROOT, 'src', 'lib', 'rules', 'tdsSections.ts'), 'eval');

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
};

console.log('\n  TDS sections — the Act 2025 renumbering, resolved by date\n');

/* 1 · THE COMMENCEMENT — one date decides everything. */
{
  ok('act: 1 April 2026 is the boundary', ACT_2025_FROM === '2026-04-01');
  ok('act: 31 March 2026 is still the 1961 Act', !isAct2025('2026-03-31'));
  ok('act: 1 April 2026 is the 2025 Act', isAct2025('2026-04-01'));
  ok('act: today is the 2025 Act', isAct2025('2026-07-16'));
}

/* 2 · HISTORY IS NOT REWRITTEN — the whole reason this is a lookup. */
{
  const old = resolveSectionRef('194C', '2024-06-01');
  ok('history: a 2024 entry still prints 194C', old.label === '194C' && old.act === '1961');
  ok('history: the 1961 numbering is not in doubt', old.verified === true);
  ok('history: March-2026 is still 194C', resolveSectionRef('194C', '2026-03-31').label === '194C');
}

/* 3 · THE RENUMBERING — and the structure the CA flagged: "393" alone is not an answer. */
{
  const c = resolveSectionRef('194C', '2026-07-16');
  ok('2025: 194C → 393(1) Table 6 Sl.(i)', c.label === '393(1) Table 6 Sl.(i)' && c.act === '2025');
  ok('2025: the reference is STRUCTURED, not a string', c.section === '393' && c.table === '6' && c.serial === 'i');
  ok('2025: 192 → 392 (salary is its own section)', resolveSectionRef('192', '2026-07-16').label === '392');
  ok('2025: 194Q → 393(1) Table 8 Sl.(ii)', resolveSectionRef('194Q', '2026-07-16').table === '8');
  ok('2025: 195 → 393(2)', resolveSectionRef('195', '2026-07-16').label === '393(2)');
  // 194C and 194J share section 393 Table 6 — distinguished ONLY by serial. This is
  // exactly why storing "393" without table+serial would lose information.
  const j = resolveSectionRef('194J', '2026-07-16');
  ok('2025: 194C and 194J share Table 6 — only the serial separates them',
    j.table === c.table && j.serial !== c.serial);
}

/* 4 · NEVER PRESENTED AS SETTLED — CA-confirmed but single-sourced (AI-N8). */
{
  const c = resolveSectionRef('194C', '2026-07-16');
  ok('unverified: every 2025 mapping is verified:false', c.verified === false);
  ok('unverified: the cite says VERIFY before filing', c.cite.includes('VERIFY'));
  ok('unverified: the UI line warns', describeSectionRef(c).includes('⚠️'));
  ok('verified: the 1961 line does NOT warn', !describeSectionRef(resolveSectionRef('194C', '2024-06-01')).includes('⚠️'));
}

/* 5 · THE STORED KEY IS THE KEY — meaning is carried across, not lost. */
{
  ok('nature: survives the renumbering (same payment, new number)',
    resolveSectionRef('194C', '2026-07-16').nature === 'Contractor' &&
    resolveSectionRef('194C', '2024-06-01').nature === 'Contractor');
  ok('input: tolerates "Sec 194C" and case', resolveSectionRef('sec 194c', '2026-07-16').table === '6');
}

/* 6 · UNKNOWN INPUT DEGRADES, NEVER INVENTS — a register that crashes is worse. */
{
  const u = resolveSectionRef('194ZZ', '2026-07-16');
  ok('unknown: falls back to the stored key, invents nothing', u.label === '194ZZ' && u.act === '1961');
  const bad = resolveSectionRef('194C', 'not-a-date');
  ok('bad date: falls back to 1961, never throws', bad.act === '1961' && bad.label === '194C');
  ok('empty: does not crash', typeof resolveSectionRef('', '2026-07-16').label === 'string');
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);

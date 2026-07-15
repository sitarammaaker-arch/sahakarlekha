// Unit tests for the PURE backup-retention planner (supabase/functions/_shared/retention-plan.mjs).
// This is the deletion policy for the weekly backup bucket — every rule is proven here in CI
// before the Edge Function is allowed to remove a single file.
import { planRetention } from '../supabase/functions/_shared/retention-plan.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const NOW = new Date('2026-07-15T00:00:00Z');

/** n weekly files ending at NOW, newest first named w0 (newest) … w<n-1> (oldest). */
function weekly(n) {
  return Array.from({ length: n }, (_, i) => ({
    name: `w${i}`,
    createdAt: new Date(NOW.getTime() - i * 7 * 24 * 3600 * 1000).toISOString(),
  }));
}

// ── 1. Under the recent window → nothing is ever deleted ────────────────────
{
  const { del } = planRetention(weekly(5), { now: NOW });
  ok(del.length === 0, 'fewer files than keepRecent → no deletions');
}
{
  const { del } = planRetention([], { now: NOW });
  ok(del.length === 0, 'empty bucket → no deletions');
}

// ── 2. The newest keepRecent always survive ──────────────────────────────────
{
  const files = weekly(30); // ~7 months of weeklies
  const { keep, del } = planRetention(files, { keepRecent: 12, keepMonths: 12, now: NOW });
  for (let i = 0; i < 12; i++) ok(keep.includes(`w${i}`), `newest file w${i} kept`);
  ok(!del.includes('w0'), 'the just-uploaded newest file can never be deleted');
}

// ── 3. Monthly anchors beyond the recent window ──────────────────────────────
{
  const files = weekly(30);
  const { keep, del } = planRetention(files, { keepRecent: 12, keepMonths: 12, now: NOW });
  // Beyond w0..w11, each calendar month keeps exactly its newest file.
  const beyond = files.slice(12);
  const byMonth = new Map();
  for (const f of beyond) {
    const k = f.createdAt.slice(0, 7);
    if (!byMonth.has(k)) byMonth.set(k, f.name); // files are newest-first
  }
  for (const [, name] of byMonth) ok(keep.includes(name), `monthly anchor ${name} kept`);
  ok(del.length === beyond.length - byMonth.size, 'everything else beyond the window is deleted');
}

// ── 4. Months older than keepMonths lose even their anchor ──────────────────
{
  const old = [{ name: 'ancient', createdAt: '2024-01-01T00:00:00Z' }];
  const { del } = planRetention([...weekly(13), ...old], { keepRecent: 12, keepMonths: 12, now: NOW });
  ok(del.includes('ancient'), 'a 2.5-year-old file beyond keepMonths is deleted');
}
{
  const { keep } = planRetention([...weekly(13), { name: 'edge', createdAt: '2025-07-20T00:00:00Z' }], { keepRecent: 12, keepMonths: 12, now: NOW });
  ok(keep.includes('edge'), 'a file exactly 12 months back keeps its monthly anchor');
}

// ── 5. Fail-safe: undated files are never deleted ────────────────────────────
{
  const { keep, del } = planRetention(
    [...weekly(20), { name: 'nodate' }, { name: 'baddate', createdAt: 'not-a-date' }],
    { keepRecent: 3, keepMonths: 0, now: NOW },
  );
  ok(keep.includes('nodate') && keep.includes('baddate'), 'undated/unparseable files are kept');
  ok(!del.includes('nodate') && !del.includes('baddate'), 'undated files never appear in the delete list');
}

// ── 6. keepMonths=0 keeps only the recent window ─────────────────────────────
{
  const { keep, del } = planRetention(weekly(20), { keepRecent: 4, keepMonths: 0, now: NOW });
  // current-month files beyond the window still anchor (monthsBetween = 0 ≤ 0)
  ok(keep.length >= 4, 'recent window always kept');
  ok(del.length > 0 && del.length <= 16, 'older files deleted under a zero-month policy');
}

// ── 7. Determinism / idempotence: re-planning the kept set deletes nothing ──
{
  const files = weekly(40);
  const first = planRetention(files, { keepRecent: 12, keepMonths: 12, now: NOW });
  const survivors = files.filter((f) => first.keep.includes(f.name));
  const second = planRetention(survivors, { keepRecent: 12, keepMonths: 12, now: NOW });
  ok(second.del.length === 0, 'running retention twice deletes nothing new (idempotent)');
}

console.log(`Backup retention planner: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

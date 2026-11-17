// Unit tests for the PURE "which societies are due a backup" picker
// (supabase/functions/_shared/backup-due.mjs) — the hourly scheduled-backup cron (BKP-00/BKP-07).
import { pickDueSocieties, attemptsFromAuditRows } from '../supabase/functions/_shared/backup-due.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const NOW = new Date('2026-11-17T10:00:00Z');
const ago = (h) => new Date(NOW.getTime() - h * 3600 * 1000).toISOString();
const A = (societyId, hoursAgo, failed = false) => ({ societyId, createdAt: ago(hoursAgo), failed });

// 1. Never backed up → due.
{
  const r = pickDueSocieties(['s1'], [], { now: NOW });
  ok(r.due.length === 1 && r.due[0] === 's1', 'a society with no backup is due');
}
// 2. Success 2 days ago → fresh, not due.
{
  const r = pickDueSocieties(['s1'], [A('s1', 48)], { now: NOW });
  ok(r.due.length === 0 && r.fresh === 1, 'a backup 2 days old is fresh');
}
// 3. Success 9 days ago (the 2026-11-08 → 11-17 gap) → due.
{
  const r = pickDueSocieties(['s1'], [A('s1', 9 * 24)], { now: NOW });
  ok(r.due[0] === 's1', 'a backup 9 days old is due');
}
// 4. A failure does not count as a backup; a failure 1h ago backs off; 7h ago retries.
{
  ok(pickDueSocieties(['s1'], [A('s1', 9 * 24), A('s1', 1, true)], { now: NOW }).backingOff === 1, 'failed 1h ago → backing off');
  ok(pickDueSocieties(['s1'], [A('s1', 9 * 24), A('s1', 7, true)], { now: NOW }).due[0] === 's1', 'failed 7h ago → retried');
  ok(pickDueSocieties(['s1'], [A('s1', 2, true)], { now: NOW }).due.length === 0, 'never succeeded, failed 2h ago → backing off');
}
// 5. A newer failure does not hide an older fresh success.
{
  const r = pickDueSocieties(['s1'], [A('s1', 24), A('s1', 2, true)], { now: NOW });
  ok(r.fresh === 1 && r.due.length === 0, 'fresh success stays fresh despite a later failure');
}
// 6. Order: never-backed-up first, then oldest success; limit respected; dueTotal counts all.
{
  const ids = ['b', 'a', 'c', 'd'];
  const r = pickDueSocieties(ids, [A('a', 30 * 24), A('b', 8 * 24), A('c', 10 * 24)], { now: NOW, limit: 3 });
  ok(JSON.stringify(r.due) === JSON.stringify(['d', 'a', 'c']), `order oldest-first, got ${JSON.stringify(r.due)}`);
  ok(r.dueTotal === 4, 'dueTotal counts every due society');
}
// 7. Duplicates and blanks in the society list are ignored; garbage timestamps ignored.
{
  const r = pickDueSocieties(['s1', 's1', '', null], [{ societyId: 's1', createdAt: 'nonsense', failed: false }], { now: NOW });
  ok(r.due.length === 1, 'duplicates/blank ids collapse; bad timestamps do not count as backups');
}
// 8. Every society eventually gets a turn: with 36 societies and limit 6, six hourly runs cover all.
{
  const ids = Array.from({ length: 36 }, (_, i) => `s${String(i).padStart(2, '0')}`);
  const attempts = [];
  const covered = new Set();
  for (let run = 0; run < 6; run++) {
    const now = new Date(NOW.getTime() + run * 3600 * 1000);
    const r = pickDueSocieties(ids, attempts, { now, limit: 6 });
    for (const sid of r.due) { covered.add(sid); attempts.push({ societyId: sid, createdAt: now.toISOString(), failed: false }); }
  }
  ok(covered.size === 36, `36 societies covered in 6 runs (got ${covered.size})`);
}
// 9. Audit rows → attempts: retention rows dropped, failures flagged.
{
  const att = attemptsFromAuditRows([
    { society_id: 's1', created_at: ago(1), after: { trigger: 'scheduled', filename: 'x' } },
    { society_id: 's1', created_at: ago(2), after: { trigger: 'scheduled', status: 'failed', error: 'e' } },
    { society_id: 's1', created_at: ago(3), after: { trigger: 'retention', deleted: 2 } },
    { society_id: 's1', created_at: ago(4), after: null },
  ]);
  ok(att.length === 2 && att[0].failed === false && att[1].failed === true, 'audit rows map to attempts');
}

console.log(`backup-due: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

// Step 2a — general dividend runs (066). The bug: Profit Distribution re-split a POSTED dividend by
// the share capital of the day it was PAID, so a share change in between silently changed every
// member's share, and nothing per-member existed for Member-360 / portal. Now the split is frozen
// into a run at posting; the voucher stays the authority; legacy years keep working.
// Run: node scripts/test-dividend-runs.mjs
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const SRC = pathResolve(ROOT, 'src');
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);
const imp = (rel) => import(pathToFileURL(pathResolve(ROOT, rel)).href);
const R = await imp('src/lib/distribution/dividendRuns.ts');
const { linesTotal } = await imp('src/lib/distribution/engine.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── Verbatim copies of the pre-066 page logic (ProfitDistribution.tsx) ──
const legacyActive = (members) => members.filter((m) => m.status === 'active' && (!m.approvalStatus || m.approvalStatus === 'approved'));
const legacyMemberDividends = (members, rate) => legacyActive(members).map((m) => ({ ...m, dividend: Math.round((m.shareCapital || 0) * rate / 100 * 100) / 100 }));
const legacySettlementRows = (members, posted) => {
  const act = legacyActive(members); const tot = act.reduce((s, m) => s + (m.shareCapital || 0), 0);
  if (tot <= 0) return [];
  return act.map((m) => ({ id: m.id, name: m.name, dividend: Math.round((m.shareCapital || 0) / tot * posted * 100) / 100 })).filter((r) => r.dividend > 0);
};

// ── 1. The run's lines are exactly the amounts the page always showed ──
let seed = 66; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rnd() * a.length)];
let mism = 0;
for (let t = 0; t < 800; t++) {
  const members = Array.from({ length: 1 + Math.floor(rnd() * 8) }, (_, i) => ({ id: `m${i}`, name: pick(['राम', 'Sita', 'Asha', 'bina', 'Zed']), status: pick(['active', 'active', 'inactive', 'resigned', undefined]), approvalStatus: pick([undefined, 'approved', 'pending', 'rejected']), shareCapital: pick([0, 100, 250.5, 1000, 3333.33, Math.round(rnd() * 1e5) / 100]) }));
  const rate = pick([5, 7.5, 10, 12.25, 0]);
  const lines = R.dividendRunLines(members, rate);
  const legacy = legacyMemberDividends(members, rate).filter((m) => m.dividend > 0);
  const byId = new Map(lines.map((l) => [l.memberId, l.amount]));
  if (lines.length !== legacy.length || legacy.some((m) => byId.get(m.id) !== m.dividend)) mism++;
  if (Math.abs(linesTotal(lines) - legacy.reduce((s, m) => s + m.dividend, 0)) > 0.005) mism++;
  // legacy-unpaid fallback is the old split, unchanged
  const posted = linesTotal(lines);
  const br = R.dividendBreakdown({ run: undefined, postedAmount: posted, members, paidByMember: new Map() });
  if (br.source !== 'proportional' || !same(br.rows.map(({ id, name, dividend }) => ({ id, name, dividend })), legacySettlementRows(members, posted))) mism++;
}
ok(mism === 0, '800 random societies: run lines = the amounts the page always posted; legacy-unpaid split = the old proportional split');

// ── 2. THE BUG: share capital changes between posting and payment ──
const atPosting = [
  { id: 'a', name: 'Asha', status: 'active', shareCapital: 1000 },
  { id: 'b', name: 'Bina', status: 'active', shareCapital: 1000 },
];
const lines = R.dividendRunLines(atPosting, 10);            // 100 + 100 = 200 posted
const run = { id: 'r1', fyLabel: '2026-27', kind: 'dividend', basis: 'share_capital', ratePct: 10, total: linesTotal(lines), lines, status: 'approved', source: 'posted' };
const atPayment = [{ ...atPosting[0], shareCapital: 3000 }, atPosting[1]];   // Asha bought shares after posting
const legacyAtPayment = legacySettlementRows(atPayment, 200);
ok(legacyAtPayment.find((r) => r.id === 'a').dividend === 150 && legacyAtPayment.find((r) => r.id === 'b').dividend === 50, 'OLD behaviour reproduced: Asha 150 / Bina 50 — Bina silently lost ₹50');
const fixed = R.dividendBreakdown({ run, postedAmount: 200, members: atPayment, paidByMember: new Map() });
ok(fixed.source === 'run' && fixed.rows.find((r) => r.id === 'a').dividend === 100 && fixed.rows.find((r) => r.id === 'b').dividend === 100, 'NEW: frozen at posting — Asha 100 / Bina 100, whatever happens to shares later');

// ── 3. The voucher is the authority ──
ok(R.liveRunFor([run], '2026-27', 'dividend', 200) === run, 'run honoured when a live voucher with the same total exists');
ok(R.liveRunFor([run], '2026-27', 'dividend', 250) === undefined, 'orphan (total ≠ voucher) ignored — a failed post can never create or hide money');
ok(R.liveRunFor([run], '2026-27', 'dividend', undefined) === undefined, 'no voucher ⇒ no run honoured');
ok(R.liveRunFor([{ ...run, isDeleted: true }], '2026-27', 'dividend', 200) === undefined, 'deleted run ignored');
ok(R.liveRunFor([run], '2025-26', 'dividend', 200) === undefined && R.liveRunFor([run], '2026-27', 'patronage', 200) === undefined, 'other FY / kind ignored');
ok(R.existingRunFor([{ ...run, total: 999 }], '2026-27', 'dividend')?.id === 'r1', 'a re-post reuses the orphan\'s id (one live run per FY)');

// ── 4. Legacy paid year: the payment vouchers ARE the record ──
const paid = new Map([['a', { amount: 150 }], ['b', { amount: 50 }]]);
const legacyPaid = R.dividendBreakdown({ run: undefined, postedAmount: 200, members: atPosting, paidByMember: paid });
ok(legacyPaid.source === 'payments' && legacyPaid.rows.find((r) => r.id === 'a').dividend === 150, 'legacy paid year: rows = actual payments (nothing re-computed)');

// ── 5. Freeze a legacy unpaid split ──
const legacyRows = R.dividendBreakdown({ run: undefined, postedAmount: 200, members: atPosting, paidByMember: new Map() }).rows;
const frozen = R.snapshotLines(legacyRows);
ok(frozen.length === 2 && frozen.every((l) => l.amount === 100 && l.base === 1000), 'snapshot freezes the legacy split with its base');

// ── 6. Static guards: page, hook, migration, master schema, export ──
const strip = (f) => readFileSync(pathResolve(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const page = strip('src/pages/ProfitDistribution.tsx');
const post = page.slice(page.indexOf('const handlePost = async'), page.indexOf('setConfirmOpen(false)', page.indexOf('const handlePost = async')));
ok(/if \(society\.fyLocked\)/.test(post), 'RULE 6: handlePost bails when FY is locked');
ok(post.indexOf('await saveRun(run)') > -1 && post.indexOf('await saveRun(run)') < post.indexOf('addVoucher('), 'RULE 1: the split is saved to the cloud BEFORE the voucher is created');
ok(/if \(!saved\.ok && !tableMissing\) \{[\s\S]*?variant: 'destructive', duration: 10000,\s*\}\);\s*\} else \{[\s\S]*?addVoucher\(/.test(post), 'failed save (table present) ⇒ destructive toast ≥10s and NO voucher (addVoucher only in the else branch)');
ok(/amount: total,/.test(post), 'voucher amount = the run total (never out of step)');
ok(/const tableMissing = !saved\.ok && \/member_distribution_runs\|does not exist/.test(post) && /if \(!saved\.ok && !tableMissing\)/.test(post), 'before 066 is run (table missing) the page posts the old way with a warning — year-end never blocked');
ok(/dividendBreakdown\(\{ run: liveDividendRun/.test(page) && /const settlementRows = dividendSplit\.rows/.test(page), 'payment uses the frozen split (not a fresh share-capital split)');
ok(/user\?\.role === 'admin' && \(\s*<Button[^>]*onClick=\{freezeLegacySplit\}/.test(page), '"हिस्से पक्के करें" is admin-only');
ok(/const freezeLegacySplit = async \(\) => \{\s*if \(society\.fyLocked\)/.test(page), 'freeze respects the FY lock');
const hook = strip('src/hooks/useDistributionRuns.ts');
ok(/const \{ error \} = await supabase\.from\(TABLE\)\.upsert/.test(hook) && hook.indexOf('if (error) return') < hook.indexOf('setRuns((prev)'), 'hook is non-optimistic: state changes only after the cloud confirmed');
const mig = strip('supabase/migrations/066_member_distribution_runs.sql');
ok(/enable row level security/.test(mig) && (mig.match(/create policy member_distribution_runs_tenant_\w+/g) || []).length === 4, '066: RLS on + 4 tenant policies');
ok(!/using\s*\(\s*true\s*\)|with check\s*\(\s*true\s*\)/i.test(mig), '066: no permissive policy');
ok(/jwt_can_write\(\)/.test(mig) && /jwt_can_delete\(\)/.test(mig), '066: write/delete role gates like 030/031/063');
ok(/create unique index if not exists member_distribution_runs_one_live[\s\S]*?where not "isDeleted"/.test(mig), '066: one live run per society + FY + kind');
const master = strip('supabase-tables.sql');
const block = master.slice(master.indexOf('create table if not exists member_distribution_runs'), master.indexOf('alter table member_distribution_runs enable row level security'));
ok(block.length > 0 && !/create policy/i.test(block), 'master schema declares the table with NO policy (066 owns them)');
ok(/table: 'member_distribution_runs'/.test(strip('src/lib/export/entities/core.ts')) && /backupPolicy: 'full'/.test(strip('src/lib/export/entities/core.ts')), 'backed up (export registry, full)');

console.log(`dividend runs (066): ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

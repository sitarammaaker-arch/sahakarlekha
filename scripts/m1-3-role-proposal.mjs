#!/usr/bin/env node
// M1-3 · per-society role → account PROPOSAL (Phase-3 RM-05). READ-ONLY.
//
// Reads every society's chart of accounts from the linked Supabase project (one read-only SELECT,
// via the RM-02 runner) and runs proposeRoleMap (src/lib/accounting/roles.ts) on it. Nothing is
// written anywhere but the output file: seeding account_roles is a separate, reviewed step (M1-4).
//
// Usage (from a `supabase link`ed checkout, or pass --workdir):
//   node scripts/m1-3-role-proposal.mjs --out <file.json> [--workdir <dir>]
// The output holds society and account names — keep it out of git.

import { writeFileSync } from 'node:fs';
import { runReadOnlyQuery } from './rm02-diagnostics.mjs';
import { proposeRoleMap, ROLE_CATALOG } from '../src/lib/accounting/roles.ts';

export const CHART_SQL = `
select a.society_id::text as society_id,
       coalesce(s."name", so.name) as society_name,
       s."societyType" as society_type,
       a.id, a.name, a."nameHi" as name_hi, a.type, a.subtype, coalesce(a."isGroup", false) as is_group
from accounts a
left join society_settings s on s.society_id::text = a.society_id::text
left join societies so on so.id::text = a.society_id::text
order by 1, a.id`;

/** Group chart rows by society and propose a role map for each (pure). */
export function proposalsBySociety(rows) {
  const bySoc = new Map();
  for (const r of rows) {
    if (!bySoc.has(r.society_id)) bySoc.set(r.society_id, { societyId: r.society_id, societyName: r.society_name, societyType: r.society_type, chart: [] });
    bySoc.get(r.society_id).chart.push({ id: r.id, name: r.name, nameHi: r.name_hi, type: r.type, subtype: r.subtype, isGroup: r.is_group });
  }
  return [...bySoc.values()].map((s) => {
    const proposals = proposeRoleMap(s.chart);
    const names = new Map(s.chart.map((a) => [a.id, a.name]));
    return {
      societyId: s.societyId,
      societyName: s.societyName,
      societyType: s.societyType,
      accounts: s.chart.length,
      summary: {
        matched: proposals.filter((p) => p.basis === 'matched').length,
        preferredId: proposals.filter((p) => p.basis === 'preferred_id').length,
        ambiguous: proposals.filter((p) => p.basis === 'ambiguous').length,
        missing: proposals.filter((p) => p.basis === 'missing').length,
        idCollisions: proposals.filter((p) => p.idCollision).length,
      },
      proposals: proposals.map((p) => ({ ...p, accountName: p.accountId ? names.get(p.accountId) : null, candidateNames: p.candidates.map((id) => `${id} ${names.get(id)}`) })),
    };
  });
}

function main() {
  const i = process.argv.indexOf('--out');
  const out = i > 0 ? process.argv[i + 1] : null;
  if (!out) { console.error('usage: node scripts/m1-3-role-proposal.mjs --out <file.json> [--workdir <dir>]'); process.exit(2); }
  const w = process.argv.indexOf('--workdir');
  const socs = proposalsBySociety(runReadOnlyQuery(CHART_SQL, w > 0 ? process.argv[w + 1] : undefined));
  writeFileSync(out, JSON.stringify({ capturedAt: new Date().toISOString(), roles: ROLE_CATALOG.length, societies: socs }, null, 2));
  console.log(`M1-3 role proposal: ${socs.length} societies × ${ROLE_CATALOG.length} roles → ${out}`);
  for (const s of socs.sort((a, b) => b.accounts - a.accounts)) {
    const { matched, preferredId, ambiguous, missing, idCollisions } = s.summary;
    console.log(`  ${String(s.societyName || s.societyId).slice(0, 38).padEnd(38)} ${String(s.societyType || '?').padEnd(20)} proposed ${String(matched + preferredId).padStart(2)} · ambiguous ${ambiguous} · missing ${missing} · id-collision ${idCollisions}`);
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/m1-3-role-proposal.mjs')) main();

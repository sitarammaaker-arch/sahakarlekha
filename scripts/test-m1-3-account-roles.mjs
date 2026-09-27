#!/usr/bin/env node
// M1-3 · role catalog + read-only proposal (src/lib/accounting/roles.ts) and a static guard on
// migration 074. CI-safe (no database). The DB behaviour is tested against a restored backup by
// scripts/db-harness/tests/m1-3-account-roles.mjs.
//
// Run: node scripts/test-m1-3-account-roles.mjs

import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

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

const { ROLE_CATALOG, REPORT_CLASSES, proposeRoleMap } = await import(abs('../src/lib/accounting/roles.ts'));
const { SOCIETY_TEMPLATES } = await import(abs('../src/lib/storage.ts'));

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};
const deepFreeze = (o) => { Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v)); return Object.freeze(o); };
const role = (p, r) => p.find((x) => x.role === r);

console.log('Catalog');
const keys = ROLE_CATALOG.map((r) => r.role);
ok('role keys are unique', new Set(keys).size === keys.length);
ok('every key matches the DB check (^[a-z][a-z_]*(\\.[a-z][a-z_]*)*$)', keys.every((k) => /^[a-z][a-z_]*(\.[a-z][a-z_]*)*$/.test(k)), keys.filter((k) => !/^[a-z][a-z_]*(\.[a-z][a-z_]*)*$/.test(k)).join(','));
ok('every role names at least one account type', ROLE_CATALOG.every((r) => r.types.length > 0));
for (const r of ['cash', 'bank.default', 'member.share_capital', 'customer.receivable', 'supplier.payable', 'gst.output.cgst', 'gst.input.igst',
  'tds.payable', 'msp.receivable', 'salary.payable', 'sales.default', 'purchase.default', 'surplus.unappropriated', 'reserve.statutory', 'dividend.payable']) {
  ok(`design role ${r} is in the catalog`, keys.includes(r));
}
ok('legacy GST roles name the item that retires them (RM-17)', ROLE_CATALOG.filter((r) => r.legacy).every((r) => r.legacy === 'RM-17' && r.role.startsWith('gst.')));

console.log('report_class matches migration 074');
const mig = readFileSync(pathResolve(HERE, '../supabase/migrations/074_account_roles.sql'), 'utf8');
const inMig = [...mig.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).filter((v) => REPORT_CLASSES.includes(v));
ok('every REPORT_CLASSES value is allowed by the check constraint', REPORT_CLASSES.every((c) => inMig.includes(c)));
const checkBody = mig.slice(mig.indexOf('report_class in ('), mig.indexOf('));', mig.indexOf('report_class in (')));
const allowed = [...checkBody.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
ok('the check constraint allows nothing beyond REPORT_CLASSES', allowed.length === REPORT_CLASSES.length && allowed.every((c) => REPORT_CLASSES.includes(c)));

console.log('Proposal on every template');
const types = Object.keys(SOCIETY_TEMPLATES).filter((t) => !['labour', 'other'].includes(t));
for (const t of types) {
  const chart = deepFreeze(structuredClone(SOCIETY_TEMPLATES[t]));
  const p = proposeRoleMap(chart);
  for (const r of ['cash', 'bank.default', 'member.share_capital', 'member.admission_fee', 'surplus.unappropriated', 'reserve.statutory', 'supplier.payable']) {
    ok(`${t}: ${r} proposed`, !!role(p, r).accountId, role(p, r).basis);
  }
  const byId = new Map(chart.map((a) => [a.id, a]));
  ok(`${t}: never proposes a group account`, p.every((x) => !x.accountId || !byId.get(x.accountId).isGroup));
  ok(`${t}: every proposal has an allowed account type`, p.every((x) => !x.accountId || ROLE_CATALOG.find((d) => d.role === x.role).types.includes(byId.get(x.accountId).type)));
}

console.log('Known collisions are flagged, not followed');
const pacs = proposeRoleMap(SOCIETY_TEMPLATES.pacs);
ok('PACS customer.receivable: 3303 (KCC loans) flagged, not proposed', role(pacs, 'customer.receivable').accountId === null && role(pacs, 'customer.receivable').idCollision?.id === '3303');
ok('PACS member.loan.kcc → 3303', role(pacs, 'member.loan.kcc').accountId === '3303');
const cms = proposeRoleMap(SOCIETY_TEMPLATES.marketing_processing);
ok('CMS customer.receivable → 3303 (Sundry Debtors)', role(cms, 'customer.receivable').accountId === '3303');
ok('CMS loan.interest_receivable prefers 3313 (member loan interest)', role(cms, 'loan.interest_receivable').accountId === '3313');
const housing = proposeRoleMap(SOCIETY_TEMPLATES.housing);
ok('Housing professional_tax.payable: 2207 (Property Tax) flagged', role(housing, 'professional_tax.payable').accountId === null && role(housing, 'professional_tax.payable').idCollision?.id === '2207');
ok('Housing sales.default: 4101 (Maintenance Charges) flagged', role(housing, 'sales.default').accountId === null && role(housing, 'sales.default').idCollision?.id === '4101');
const sugar = proposeRoleMap(SOCIETY_TEMPLATES.sugar);
ok('Sugar purchase.default: 5101 (Cane Procurement) flagged', role(sugar, 'purchase.default').accountId === null && role(sugar, 'purchase.default').idCollision?.id === '5101');

console.log('Duplicates and look-alikes');
const acc = (id, name, type, extra = {}) => ({ id, name, type, isGroup: false, ...extra });
const dupNoPref = proposeRoleMap([acc('u1', 'Sundry Creditors', 'liability'), acc('u2', 'Sundry Creditors', 'liability')]);
ok('two look-alikes and no conventional id → ambiguous, nothing proposed', role(dupNoPref, 'supplier.payable').basis === 'ambiguous' && role(dupNoPref, 'supplier.payable').accountId === null
  && role(dupNoPref, 'supplier.payable').candidates.length === 2);
const dupPref = proposeRoleMap([acc('u1', 'Sundry Creditors', 'liability'), acc('2101', 'Sundry Creditors', 'liability')]);
ok('look-alikes including the conventional id → that id, basis preferred_id', role(dupPref, 'supplier.payable').accountId === '2101' && role(dupPref, 'supplier.payable').basis === 'preferred_id');
const wrongType = proposeRoleMap([acc('2201', 'GST Payable', 'asset')]);
ok('a name match with the wrong account type is not proposed', role(wrongType, 'gst.output.combined').accountId === null);
const group = proposeRoleMap([acc('3301', 'Cash in Hand', 'asset', { isGroup: true })]);
ok('a group account is not proposed', role(group, 'cash').accountId === null);
const edli = proposeRoleMap([acc('5209', 'EPF EDLI & Admin Charges', 'expense')]);
ok('EPF EDLI charges are not the PF employer contribution', role(edli, 'pf.employer_expense').accountId === null);
const assetSale = proposeRoleMap([acc('4410', 'Profit on Sale of Assets', 'income', { nameHi: 'संपत्ति बिक्री पर लाभ', subtype: 'other_income' }), acc('4107', 'PDS / Ration Goods Sales', 'income', { subtype: 'trading_income' })]);
ok('profit on sale of assets is never the default sales account (Hindi बिक्री)', !role(assetSale, 'sales.default').candidates.includes('4410') && role(assetSale, 'sales.default').accountId === '4107');
const bdf = proposeRoleMap([acc('1205', 'Bad and Doubtful Fund', 'equity')]);
ok("'Bad and Doubtful Fund' is recognised as the bad debt fund", role(bdf, 'fund.bad_debt').accountId === '1205');
// Production shape found by the proposal run (2026-09-27): 4407 still typed equity under 1200 in 7 societies.
const oldAdm = proposeRoleMap([acc('4407', 'Admission Fee', 'equity', { subtype: 'reserve' })]);
ok('4407 Admission Fee still typed equity is flagged, not proposed', role(oldAdm, 'member.admission_fee').accountId === null && role(oldAdm, 'member.admission_fee').idCollision?.id === '4407');
const input = deepFreeze([acc('3301', 'Cash in Hand', 'asset')]);
let threw = false; try { proposeRoleMap(input); } catch { threw = true; }
ok('proposal never mutates its input (deep-frozen chart)', !threw);

console.log('Migration 074 is additive only');
const code = mig.replace(/--[^\n]*/g, ' ').replace(/'(?:[^']|'')*'/g, "''").toLowerCase();
const noPriv = code.replace(/\b(revoke|grant)\b[^;]*;/g, ' ');
ok('wrapped in begin … commit', /^\s*begin;[\s\S]*commit;\s*$/.test(code));
ok('no UPDATE / DELETE / TRUNCATE', !/\bupdate\s+(public\.)?\w+\s+set\b|\bdelete\s+from\b|\btruncate\b/.test(noPriv));
ok('no DROP TABLE / DROP COLUMN', !/\bdrop\s+(table|column)\b/.test(noPriv));
const alters = [...noPriv.matchAll(/alter\s+table\s+(?:public\.)?(\w+)\s+(\w+(?:\s+\w+){0,6})/g)].map((m) => `${m[1]} ${m[2]}`);
ok('ALTERs: RLS on account_roles; accounts only gains a column and a check', alters.every((a) => a.startsWith('account_roles enable row level security') || a.startsWith('accounts add column if not exists report_class') || a.startsWith('accounts add constraint accounts_report_class_check')), alters.join(' | '));
ok('report_class column is nullable (no NOT NULL / DEFAULT)', /add column if not exists report_class text;/.test(noPriv));
ok('composite FK to accounts (id, society_id)', /foreign key \(account_id, society_id\)\s*references public\.accounts \(id, society_id\)/.test(noPriv));
ok('exactly one policy, SELECT, tenant-scoped', (noPriv.match(/create policy/g) || []).length === 1 && /for select using \(society_id::text = get_current_society_id\(\)\)/.test(noPriv));
ok('writes revoked from anon/authenticated', /revoke insert, update, delete, truncate on public\.account_roles from anon, authenticated/.test(code));
ok("records '074' in app_migrations as the last statement", /values \('074', 'account_roles'\)\s*on conflict \(version\) do nothing;\s*commit;\s*$/.test(mig));
ok('does not seed any role', !/insert into public\.account_roles/.test(noPriv));
const down = readFileSync(pathResolve(HERE, '../supabase/migrations/074_account_roles_down.sql'), 'utf8').toLowerCase();
ok('down drops account_roles, the check and the column, and its 074 record', /drop table if exists public\.account_roles/.test(down)
  && /drop column if exists report_class/.test(down) && /drop constraint if exists accounts_report_class_check/.test(down) && /version = '074'/.test(down));

console.log(`\nM1-3 account roles: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

// Compliance calendar due-date engine (ECR-13) — imports the REAL src/lib/complianceCalendar.ts via the '@/' loader.
// Run: node scripts/test-compliance-calendar.mjs
import { register } from 'node:module';
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

const { buildComplianceCalendar, complianceNotifications } = await import(abs('../src/lib/complianceCalendar.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const find = (items, pred) => items.find(pred);

// As-of 10 May 2024. April liability → PF/ESI 15 May, TDS 7 May, GSTR-3B 20 May, GSTR-1 11 May.
const full = buildComplianceCalendar('2024-05-10', { hasEmployees: true, tan: true, gstin: true });

// 1. PF/ESI for April due 15 May.
const pf = find(full, i => i.category === 'PF' && i.dueDate === '2024-05-15');
ok(pf && pf.daysLeft === 5 && pf.status === 'due-soon', 'April EPF due 15-May → 5 days → due-soon');
ok(find(full, i => i.category === 'ESI' && i.dueDate === '2024-05-15'), 'ESI mirrors PF date');

// 2. TDS deposit 7 May (April) already passed → overdue.
const tdsApr = find(full, i => i.category === 'TDS' && i.dueDate === '2024-05-07');
ok(tdsApr && tdsApr.daysLeft === -3 && tdsApr.status === 'overdue', 'April TDS due 7-May → overdue (3d ago)');

// 3. March-liability TDS is due 30 April (not 7th).
const marchTds = find(full, i => i.id === 'tds-2024-03');
ok(marchTds && marchTds.dueDate === '2024-04-30', 'March TDS liability → 30 April');

// 4. GST rows present with correct dates.
ok(find(full, i => i.id === 'gstr3b-2024-04' && i.dueDate === '2024-05-20'), 'GSTR-3B April due 20-May');
ok(find(full, i => i.id === 'gstr1-2024-04' && i.dueDate === '2024-05-11'), 'GSTR-1 April due 11-May');

// 5. Applicability gating.
const noneApp = buildComplianceCalendar('2024-05-10', { hasEmployees: false, tan: false, gstin: false });
ok(!noneApp.some(i => ['PF', 'ESI', 'TDS', 'GST'].includes(i.category)), 'no employees/tan/gstin → no PF/ESI/TDS/GST');
ok(noneApp.some(i => i.category === 'IncomeTax' || i.category === 'Audit'), 'annual IT/Audit always present');
const gstOnly = buildComplianceCalendar('2024-05-10', { gstin: true });
ok(gstOnly.some(i => i.category === 'GST') && !gstOnly.some(i => i.category === 'PF'), 'gstin only → GST but no PF');

// 6. 24Q quarterly: Q1 due 31-Jul-2024 shows up as upcoming.
ok(find(full, i => i.dueDate === '2024-07-31' && i.title.includes('Q1')), '24Q Q1 due 31-Jul');

// 7. Window: nothing older than 45d or beyond 150d.
ok(full.every(i => i.daysLeft >= -45 && i.daysLeft <= 150), 'items within [-45, 150] day window');

// 8. Sorted ascending by due date.
ok(full.every((it, i) => i === 0 || full[i - 1].dueDate <= it.dueDate), 'sorted by due date');

// 9. Filed tracking — a filed item shows status 'filed' (never overdue), others unaffected.
const withFiled = buildComplianceCalendar('2024-05-10', { hasEmployees: true, tan: true, gstin: true }, { filedIds: ['tds-2024-04'] });
const filedTds = find(withFiled, i => i.id === 'tds-2024-04');
ok(filedTds && filedTds.status === 'filed', 'filed TDS shows status filed (not overdue)');
ok(find(withFiled, i => i.id === 'gstr3b-2024-04').status !== 'filed', 'other items unaffected by filing');
ok(withFiled.filter(i => i.status === 'overdue').length < full.filter(i => i.status === 'overdue').length, 'filing reduces overdue count');

// 10. complianceNotifications = overdue + due-soon only (filed/upcoming excluded).
const alerts = complianceNotifications(full);
ok(alerts.length > 0 && alerts.every(a => a.status === 'overdue' || a.status === 'due-soon'), 'notifications are overdue/due-soon only');
ok(complianceNotifications(withFiled).length < alerts.length, 'filing reduces notifications');
ok(complianceNotifications(full).every(a => a.status !== 'upcoming' && a.status !== 'filed'), 'upcoming/filed excluded from notifications');

console.log(`\nCompliance calendar (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

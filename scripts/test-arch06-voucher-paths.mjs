// ARCH-06 (product audit 2026-11-17): "React Query is mounted and never used; three voucher write paths each with
// its own rollback and numbering rules." After ARCH-03 every society saves through the posting service; the
// journal-first path (T-09) could never switch on — production has no column for its flag and nothing sets it.
// Now: two paths (posting service + the client save behind the emergency switch), one failure message, one restamp,
// and no React Query.
// Run: node scripts/test-arch06-voucher-paths.mjs
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

const dc = read('src/contexts/DataContext.tsx');
const between = (from, to) => { const a = dc.indexOf(from); return dc.slice(a, dc.indexOf(to, a)); };

// ── 1. the dormant path is gone ──
ok(!dc.includes('journalFirstWrites') && !/journalFirst\b/.test(dc), 'no journal-first branch left in DataContext (add / update / cancel)');
ok(!dc.includes('persistEventAuthoritative,') && !/persistEventAuthoritative\(/.test(dc), 'its single-event authoritative append is no longer imported or called');
ok(!read('src/types/index.ts').includes('journalFirstWrites'), 'the never-set SocietySettings flag is gone');
ok(!read('supabase/schema/production-schema.txt').includes('journalFirstWrites'), 'production has no column for it (DB-01 snapshot) — the removal cannot change behaviour');
ok(dc.includes('persistEventsAuthoritative(allEvents, ledgerAppendIO)'), 'the batch append used elsewhere is kept');

// ── 2. what remains: posting service first, the client save behind the switch ──
{
  const add = between('const addVoucher = useCallback(', '// ── ECR-17 Phase 2: inter-branch transfer');
  const svc = add.indexOf('if (postingServiceRef.current && newVoucher.approvalStatus === \'pending\')');
  const posted = add.indexOf('if (postingServiceRef.current && shadowEvent)');
  const client = add.indexOf('// ── Client save: the emergency switch');
  ok(svc > 0 && posted > svc && client > posted, 'addVoucher: pending save → posting service → client save, in that order');
  ok((add.match(/postingServiceRef\.current/g) || []).length === 2, 'addVoucher has exactly the two posting-service branches');
  const upd = between('const updateVoucher = useCallback(', 'const cancelVoucher = useCallback(');
  ok(upd.includes("if (postingServiceRef.current && current.approvalStatus !== 'pending')") && upd.includes('// ── Client save: the emergency switch (posting_service = false), or an edit of a PENDING voucher'), 'updateVoucher: posting service, else the client save (switch off, or a pending voucher) — the comment says when');
  const can = between('const cancelVoucher = useCallback(', 'const reverseVoucher = useCallback(');
  ok(can.includes('if (postingServiceRef.current) {') && can.includes('// ── Emergency switch (posting_service = false): table-first soft-delete (RULE 1). ──'), 'cancelVoucher: posting service, else the client soft-delete');
  ok(dc.includes('const postingServiceRef = useRef(true);') && dc.includes("postingServiceRef.current = data?.posting_service !== false;"), 'the switch defaults ON; only an explicit false row turns the client save on');
}

// ── 3. one message, one restamp ──
{
  ok((dc.match(/'❌ वाउचर क्लाउड में सेव नहीं हुआ'/g) || []).length === 1, 'the "voucher not saved" message exists once (toastVoucherNotSaved)');
  ok((dc.match(/toastVoucherNotSaved\(msg\);/g) || []).length === 3, 'client save, pending save and posting service all use it');
  ok(dc.includes('const restampVoucherNo = (id: string, officialNo: string) => {') && (dc.match(/restampVoucherNo\(/g) || []).length === 2, 'one restamp of the official number, used by the client save and the pending save');
  ok(!dc.includes('opts.isUpdate || opts.journalFirst') && dc.includes("attemptBase(baseCols, 0);   // an update keeps its number"), 'numbering: an update keeps its number; a new client save asks the server for the official one (no special case left)');
}

// ── 4. React Query is gone ──
{
  const app = read('src/App.tsx');
  ok(!app.includes('@tanstack/react-query') && !app.includes('QueryClientProvider'), 'App no longer mounts React Query');
  const pkg = JSON.parse(read('package.json'));
  ok(!pkg.dependencies?.['@tanstack/react-query'] && !pkg.devDependencies?.['@tanstack/react-query'], 'the dependency is removed');
}

console.log(`ARCH-06 voucher paths: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

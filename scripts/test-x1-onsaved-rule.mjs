// X-1 (product audit 2026-11-17) — "a domain row is written only in onSaved".
// Housing, Dairy, Consumer and Labour saved their bill / settlement / payment / return right after addVoucher returned
// its optimistic voucher, and passed no callbacks. When the server refused the voucher late (closed year, period lock,
// permission) DataContext rolled the voucher back — and the domain row stayed, pointing at a voucher that does not exist.
//
// THE RULE, enforced statically on all four contexts so new code cannot slip back:
//   1. every addVoucher(...) call passes an options object with onFailed;
//   2. after the call returns, the rest of that function writes NOTHING domain-side (no state setter, no .upsert,
//      no commit…(), no addStockMovement, no updateHousingFlat) — those live inside onSaved;
//   3. an update applied in onSaved starts from the CURRENT row (…Latest.current), never the captured one;
//   4. a record with a save in flight cannot be saved again (inFlight) — the screen still shows the old state then.
// Run: node scripts/test-x1-onsaved-rule.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

/** Every addVoucher( call in `src`: its full argument text, the function it sits in, and that function's text after it. */
function calls(src) {
  const out = [];
  let i = 0;
  while ((i = src.indexOf('addVoucher(', i)) >= 0) {
    if (/[\w.]/.test(src[i - 1] || '')) { i += 10; continue; }   // e.g. a property named …addVoucher(
    let depth = 0, j = i + 'addVoucher'.length;
    for (; j < src.length; j++) { if (src[j] === '(') depth++; else if (src[j] === ')') { depth--; if (depth === 0) break; } }
    const fnStart = src.lastIndexOf('= useCallback(', i);
    const fnName = (src.slice(src.lastIndexOf('const ', fnStart), fnStart).match(/const (\w+)/) || [])[1] || '?';
    const fnEnd = src.indexOf('\n  }, [', i);
    out.push({ line: src.slice(0, i).split('\n').length, fn: fnName, args: src.slice(i, j + 1), rest: src.slice(j + 1, fnEnd) });
    i = j;
  }
  return out;
}

const FILES = {
  Housing: 'src/contexts/HousingDataContext.tsx',
  Dairy: 'src/contexts/DairyDataContext.tsx',
  Consumer: 'src/contexts/ConsumerDataContext.tsx',
  Labour: 'src/contexts/LabourDataContext.tsx',
};
const DOMAIN_WRITE = /set[A-Z]\w*State\(|\.upsert\(|\bcommit[A-Z]\w*\(|addStockMovement\(|updateHousingFlat\(|persistSettlement\(/;
let total = 0;

for (const [name, file] of Object.entries(FILES)) {
  const src = read(file);
  const list = calls(src);
  total += list.length;
  ok(list.length > 0, `${name}: has addVoucher calls`);
  for (const c of list) {
    ok(/\bonFailed\s*:/.test(c.args), `${name}:${c.line} ${c.fn} — addVoucher passes onFailed`);
    // The code after the call (outside the callbacks, which are inside c.args) must not write domain state.
    // generateMaintenanceBills's after-loop flat backfill is the one allowed write (best-effort, not tied to a voucher).
    const rest = c.fn === 'generateMaintenanceBills' ? c.rest.replace(/if \(flatRecUpdates\.size > 0\) \{[\s\S]*?\n    \}\n/, '') : c.rest;
    ok(!DOMAIN_WRITE.test(rest), `${name}:${c.line} ${c.fn} — nothing domain-side is written after addVoucher returns (it belongs in onSaved)`);
  }
  ok(/const voucherRefused = \(title: string\) => voucherRefusedToast\(toastRef\.current, title\);/.test(src), `${name}: a refused voucher says the record was not made either`);
  ok(/const inFlight = useInFlight\(\(\) => inFlightToast\(toastRef\.current\)\);/.test(src), `${name}: has the in-flight guard`);
}
ok(total === 27, `all 27 call sites are covered (found ${total})`);

// ── Updates in onSaved start from the CURRENT row ──
{
  const latestUse = {
    Labour: ['departmentBillsLatest.current', 'workerAdvancesLatest.current', 'pfEsiRunsLatest.current'],
    Dairy: ['settlementsLatest.current', 'dispatchesLatest.current', 'distributionsLatest.current'],
    Housing: ['maintenanceBillsLatest.current', 'fundInvestmentsLatest.current'],
    Consumer: ['patronageRunsLatest.current'],
  };
  for (const [name, refs] of Object.entries(latestUse)) {
    const src = read(FILES[name]);
    for (const r of refs) ok(src.includes(r), `${name}: an onSaved update reads ${r}`);
  }
}

// ── The edited return no longer cancels the old credit/debit note before the new one is accepted ──
{
  const src = read(FILES.Consumer);
  for (const fn of ['updateSalesReturn', 'updatePurchaseReturn']) {
    const body = src.slice(src.indexOf(`const ${fn} = useCallback(`), src.indexOf('\n  }, [', src.indexOf(`const ${fn} = useCallback(`)));
    const callAt = body.indexOf('addVoucher(');
    const cancelOld = body.indexOf('cancelVoucher(cur.voucherId');
    ok(callAt > 0 && cancelOld > callAt && body.slice(callAt, cancelOld).includes('onSaved: (sv) => {'), `${fn}: the old note is cancelled only inside the new note's onSaved`);
    ok(/cancelVoucher\(sv\.id, '(Sales|Purchase) return edit withdrawn/.test(body), `${fn}: if the old note cannot be cancelled, the new one is withdrawn — never two live notes`);
  }
}

// ── Helpers ──
{
  const h = read('src/hooks/useInFlight.ts');
  ok(/begin\(key: string\): boolean/.test(h) && /if \(keys\.current\.has\(key\)\) \{ onBusy\(\); return false; \}/.test(h) && /end\(key: string\): void \{ keys\.current\.delete\(key\); \}/.test(h), 'useInFlight: a held key refuses a second save; end releases it');
  ok(/ref\.current = value;/.test(read('src/hooks/useLatest.ts')), 'useLatest: always the latest render\'s value');
  const t = read('src/lib/voucherRefused.ts');
  ok(/इसलिए यह रिकॉर्ड भी दर्ज नहीं हुआ/.test(t) && /so this record was not made either/.test(t), 'the refusal message is Hindi-first (RULE 7)');
}

console.log(`X-1 onSaved rule: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

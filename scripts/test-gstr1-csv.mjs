// GSTR-1 working sheet from subscription invoices (billing slice 3) — imports the REAL src/lib/billing/gstr1Csv.ts
// via the @/ loader. Totals are proven to the paisa; B2B/B2C split and the B2C summary are checked.
// Run: node scripts/test-gstr1-csv.mjs   (npm run test:gstr1-csv)
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

const { buildGstr1Rows, GSTR1_HEADERS, gstr1FileStem } = await import(abs('../src/lib/billing/gstr1Csv.ts'));
const { buildCsv } = await import(abs('../src/lib/exportUtils.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const inv = (o) => ({
  id: o.no, invoice_no: o.no, invoice_date: o.date, order_id: 'o' + o.no, payment_id: null, plan: 'starter', kind: 'new',
  seller_name: 'S', seller_gstin: '06ABCDE1234F1Z5', seller_address: 'A', seller_state_code: '06',
  buyer_name: o.buyer ?? 'Buyer', buyer_address: null, buyer_state_code: o.pos, buyer_gstin: o.gstin ?? null,
  place_of_supply: o.pos, sac: 'SAC-TBD', gst_rate_pct: '18',
  taxable_paise: o.t, cgst_paise: o.c ?? 0, sgst_paise: o.c ?? 0, igst_paise: o.i ?? 0, total_paise: o.t + 2 * (o.c ?? 0) + (o.i ?? 0),
});
const list = [
  inv({ no: 'SL/2026-27/0010', date: '2026-10-20', pos: '06', t: 127034, c: 11433 }),
  inv({ no: 'SL/2026-27/0002', date: '2026-10-05', pos: '07', t: 127034, i: 22866, gstin: '07ABCDE1234F1Z5', buyer: 'Delhi Coop' }),
  inv({ no: 'SL/2026-27/0003', date: '2026-10-05', pos: '06', t: 338898, c: 30501 }),
  inv({ no: 'SL/2026-27/0004', date: '2026-10-09', pos: '08', t: 847373, i: 152527 }),
];
const rows = buildGstr1Rows(list);
const data = rows.filter((r) => r[0] === 'B2B' || r[0] === 'B2C');
const col = (name) => GSTR1_HEADERS.indexOf(name);

ok(data.length === 4, 'one row per invoice');
ok(data.map((r) => r[1]).join() === 'SL/2026-27/0002,SL/2026-27/0003,SL/2026-27/0004,SL/2026-27/0010', 'sorted by date, then invoice number numerically (0010 after 0004)');
ok(data[0][0] === 'B2B' && data[0][col('Buyer GSTIN')] === '07ABCDE1234F1Z5' && data[0][col('Supply Type')] === 'Inter-State', 'GSTIN buyer → B2B, inter-state');
ok(data.slice(1).every((r) => r[0] === 'B2C' && r[col('Buyer GSTIN')] === ''), 'no GSTIN → B2C');
ok(data[1][col('Place of Supply')] === '06 - Haryana' && data[1][col('Supply Type')] === 'Intra-State', 'intra-state labelled with state name');
ok(data[1][col('CGST')] === '305.01' && data[1][col('SGST')] === '305.01' && data[1][col('IGST')] === '0.00', 'CGST/SGST rupees to the paisa');
ok(data.every((r) => r[col('Rate %')] === 18), 'rate as a number');

const summary = rows.filter((r) => r[0] === 'B2C Summary');
ok(summary.length === 2, `B2C summary: one row per place of supply + type + rate (${summary.length})`);
const hr = summary.find((r) => r[col('Place of Supply')] === '06 - Haryana');
ok(hr && hr[1] === '2 invoice(s)' && hr[col('Taxable Value')] === '4659.32' && hr[col('CGST')] === '419.34', 'Haryana B2C summed in paise (1270.34 + 3388.98; 114.33 + 305.01)');

const total = rows[rows.length - 1];
const want = list.reduce((s, i) => s + i.total_paise, 0);
ok(total[0] === 'TOTAL' && total[1] === '4 invoice(s)' && total[col('Invoice Value')] === (want / 100).toFixed(2), 'period total = sum of invoice values');
const tx = (k) => list.reduce((s, i) => s + i[k], 0) / 100;
ok(Number(total[col('Taxable Value')]) + Number(total[col('IGST')]) + Number(total[col('CGST')]) + Number(total[col('SGST')]) === want / 100 && Number(total[col('IGST')]) === tx('igst_paise'), 'total: taxable + taxes = invoice value');

const b2bOnly = buildGstr1Rows([list[1]]);
ok(!b2bOnly.some((r) => r[0] === 'B2C Summary'), 'no B2C summary when every buyer has a GSTIN');
const empty = buildGstr1Rows([]);
ok(empty.length === 2 && empty[1][1] === '0 invoice(s)' && empty[1][col('Invoice Value')] === '0.00', 'no invoices → just a zero total');

const csv = buildCsv(GSTR1_HEADERS, rows);
ok(csv.split('\r\n')[0].startsWith('"Section","Invoice No."'), 'CSV header row');
ok(!/=|\+|@/.test(buildCsv(GSTR1_HEADERS, buildGstr1Rows([inv({ no: 'X', date: '2026-10-01', pos: '06', t: 100, buyer: '=HYPERLINK("x")' })])).split('\r\n')[1].split(',')[3].slice(1, 2)), 'formula-looking buyer names are neutralised by buildCsv');
ok(gstr1FileStem('2026-10-01', '2026-10-31') === 'SahakarLekha_GSTR1_Sheet_2026-10-01_to_2026-10-31', 'file stem');

console.log(`gstr1-csv: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

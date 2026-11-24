// Off-site copy of bill files — the pure planner used by scheduled-backup (supabase/functions/_shared/bill-offsite.mjs).
// Run: node scripts/test-bill-offsite.mjs
import { readFileSync } from 'node:fs';
const B = await import(new URL('../supabase/functions/_shared/bill-offsite.mjs', import.meta.url).href);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

ok(B.billOffsiteKey('S1/V1/a.jpg', true) === 'voucher-docs/S1/V1/a.jpg.slbak', 'sealed key gets .slbak');
ok(B.billOffsiteKey('/S1/V1/a.jpg', false) === 'voucher-docs/S1/V1/a.jpg', 'plain key, leading slash dropped');
ok(B.billOffsitePrefix('S-1') === 'voucher-docs/S-1/' && B.billOffsitePrefix('a/b') === 'voucher-docs/a_b/', 'prefix per society, path-safe');

const paths = ['S1/V2/b.jpg', 'S1/V1/a.jpg', 'S1/V3/c.pdf', 'S1/V1/a.jpg', '', null];
const present = new Set(['voucher-docs/S1/V1/a.jpg.slbak']);
const p = B.planBillCopies(paths, present, true, 1);
ok(p.total === 3 && p.alreadyThere === 1, `3 unique files, 1 already off-site (got ${JSON.stringify(p)})`);
ok(p.toCopy.length === 1 && p.toCopy[0] === 'S1/V2/b.jpg' && p.deferred === 1, 'limit 1 → one now (sorted), one deferred');
const q = B.planBillCopies(paths, present, false, 40);
ok(q.alreadyThere === 0 && q.toCopy.length === 3, 'an unsealed run does not count the sealed copy as present');
ok(B.planBillCopies([], present, true, 40).total === 0, 'no bills → nothing to do');
ok(B.planBillCopies(paths, present, true, 0).toCopy.length === 0, 'limit 0 copies nothing');

const page1 = '<ListBucketResult><IsTruncated>true</IsTruncated><Contents><Key>voucher-docs/S1/V1/a.jpg.slbak</Key></Contents><Contents><Key>voucher-docs/S1/x&amp;y.pdf</Key></Contents><NextContinuationToken>tok/1=</NextContinuationToken></ListBucketResult>';
const r1 = B.parseListPage(page1);
ok(r1.keys.length === 2 && r1.keys[1] === 'voucher-docs/S1/x&y.pdf' && r1.next === 'tok/1=', 'list page: keys (XML-unescaped) and the next token');
const r2 = B.parseListPage('<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>');
ok(r2.keys.length === 0 && r2.next === null, 'last page: no token');

// The function wires it in: bills are copied after the archive, best effort, and reported in the audit row.
const fn = readFileSync(new URL('../supabase/functions/scheduled-backup/index.ts', import.meta.url), 'utf8');
ok(fn.includes("from '../_shared/bill-offsite.mjs'"), 'scheduled-backup imports the planner');
ok(/if \(S3_ENABLED\)[\s\S]{0,400}replicateBillFiles\(supabase, societyId/.test(fn), 'bills are copied only when the off-site store is configured');
ok(/billFiles,/.test(fn), 'the audit row records the bill-copy result');
ok(/storage\.from\(BILL_BUCKET\)\.download\(/.test(fn) && /encryptArchive\(bytes, ENC_PASSPHRASE/.test(fn), 'each bill is read from the bucket and sealed with the backup key');

console.log(`\nBill off-site copy: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

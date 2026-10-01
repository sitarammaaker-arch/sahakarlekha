#!/usr/bin/env node
// Phase-2 C · year-close client helpers + wiring. Run: node scripts/test-fy-close-client.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { fyEndOf, closingStockMinorFor, closeFyMessage } = await import(pathToFileURL(resolve(root, 'src/lib/fyClose.ts')).href);
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };
ok('2026-27 ends 2027-03-31', fyEndOf('2026-27') === '2027-03-31');
ok('bad label → undefined', fyEndOf('x') === undefined);
ok('closing stock rupees → paise', closingStockMinorFor({ totalClosingStock: 1234.56 }) === 123456);
ok('no stock / non-trading → null (server posts no stock journal)', closingStockMinorFor({ totalClosingStock: 0 }) === null && closingStockMinorFor(undefined) === null);
ok('server reason extracted', closeFyMessage('close_fy:authority_required — बोर्ड प्रस्ताव का हवाला देना ज़रूरी है।') === 'बोर्ड प्रस्ताव का हवाला देना ज़रूरी है।');
ok('post_voucher failure named', /no_open_fy_for_date/.test(closeFyMessage('post_voucher:no_open_fy_for_date')));
const dc = readFileSync(resolve(root, 'src/contexts/DataContext.tsx'), 'utf8');
ok('the trading A/c recognises the year-close stock journal (either direction)', /refType === 'fy\.close\.stock' && v\.narration\.includes\(fy\)/.test(dc) && /closingViaLegacy \|\| closingViaDedicated \|\| closingViaYearClose/.test(dc));
const card = readFileSync(resolve(root, 'src/components/fy/YearCloseCard.tsx'), 'utf8');
ok('the card calls close_financial_year with the authority and the closing stock', /rpc\('close_financial_year', \{ p_fy_label: y\.fy_label, p_authority: authority\.trim\(\), p_closing_stock_minor: stockMinor \}\)/.test(card));
ok('the card announces success only when the server returned no error', card.indexOf('if (error)') < card.indexOf('close हो गया'));
ok('the card is for admins and only for closing years', /user\?\.role !== 'admin' \|\| years\.length === 0/.test(card) && /\.eq\('status', 'closing'\)/.test(card));
ok('SocietySetup shows the card', /<YearCloseCard \/>/.test(readFileSync(resolve(root, 'src/pages/SocietySetup.tsx'), 'utf8')));
console.log(`\nFY close client: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

// Member-area re-audit 2026-10-17 — stage D (UX, speed, accessibility). Pure paging + the wiring that matters.
// Run: node scripts/test-member-stage-d.mjs   (npm run test:member-stage-d)
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const P = await import(pathToFileURL(resolve(ROOT, 'src/lib/paging.ts')).href);
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// ── paging ──
const rows = Array.from({ length: 2034 }, (_, i) => i);
const p0 = P.pageSlice(rows, 0);
ok(p0.rows.length === 50 && p0.from === 1 && p0.to === 50 && p0.pages === 41, 'first page of 2,034: 1–50 of 41 pages');
const last = P.pageSlice(rows, 40);
ok(last.rows.length === 34 && last.from === 2001 && last.to === 2034, 'last page holds the remainder');
ok(P.pageSlice(rows, 99).page === 40 && P.pageSlice(rows, -3).page === 0, 'page clamped to the range');
const empty = P.pageSlice([], 0);
ok(empty.rows.length === 0 && empty.pages === 1 && empty.from === 0, 'empty list: one empty page');

// ── Members page ──
const mem = read('src/pages/Members.tsx');
ok(mem.includes('const pg = pageSlice(filtered, memberPage);') && mem.includes('{pg.rows.map(member => (') && mem.includes('<ListPager {...pg} total={filtered.length} setPage={setMemberPage} hi={hi} />'), 'Members: rows rendered a page at a time');
ok(mem.includes('const q = useDebounced(searchQuery).toLowerCase();') && mem.includes('useEffect(() => { setMemberPage(0); }, [q, statusFilter, typeFilter, activeTab]);'), 'Members: debounced search, page resets on filter/tab');
const rowBlock = mem.slice(mem.indexOf('{pg.rows.map(member => ('), mem.indexOf('<ListPager {...pg}'));
// Each icon button = from `size="icon"` to its `</Button>` (an arrow `=>` inside onClick breaks a [^>]* match).
const iconButtons = rowBlock.split('size="icon"').slice(1).map((t) => t.slice(0, t.indexOf('</Button>')));
ok(iconButtons.length >= 10 && iconButtons.every((b) => b.includes('aria-label=')), `every row icon button has an aria-label (${iconButtons.length})`);
ok(mem.includes("'फिर से स्वीकृत करें (अपील/पुनर्विचार के बाद)'"), 'Rejected tab: the approve button says it re-admits');
ok(!mem.includes("new Date().toISOString().split('T')[0]") && read('src/pages/MemberApplication.tsx').indexOf("new Date().toISOString().split('T')[0]") < 0, 'member pages use the local date (todayStr), not UTC');
ok(mem.includes('`/share-register?q=${encodeURIComponent(form.memberId || \'\')}`'), 'edit form links to the Share Register for this member');
ok(mem.includes('grid grid-cols-1 sm:grid-cols-2 gap-3') && !/<div className="grid grid-cols-2 gap-3">/.test(mem.slice(mem.indexOf('const MemberForm'), mem.indexOf('const Members: React.FC') > 0 ? mem.indexOf('const Members: React.FC') : undefined)), 'member form stacks on a phone');
ok(mem.includes("window.confirm(hi ? 'सदस्य की फ़ोटो हटाएँ?"), 'removing a photo asks first');

// ── application form ──
const app = read('src/pages/MemberApplication.tsx');
ok(app.includes("'नामांकित का नाम' : 'Nominee Name'}<span className=\"text-destructive\"> *</span>"), 'application: nominee marked required');
ok(app.includes('const leave = () => {') && app.includes('window.confirm(') && app.includes('onClick={leave}'), 'application: leaving a filled form asks first');

// ── Share Register, Nomination, Voters, Election, Member-360 ──
const sr = read('src/pages/ShareRegister.tsx');
ok(sr.includes("useState(() => searchParams.get('q') || '')") && sr.includes('const q = useDebounced(search).toLowerCase();') && sr.includes('paged.rows.map((m, i) => (') && sr.includes('<ListPager {...paged} hi={hi} />'), 'Share Register: ?q= deep link, debounced, paged (reconciliation for 50 rows)');
const nr = read('src/pages/NominationRegister.tsx');
ok(nr.includes("const canEdit = can('update');") && nr.includes('{canEdit && (') && nr.includes('paged.rows.map((m, i) => ('), 'Nomination Register: edit only for writers; paged');
ok(read('src/pages/VotersList.tsx').includes('const votersPage = usePaged(roll.voters, asOn);'), 'Voters list paged (PDF / Excel still full)');
ok(read('src/pages/ElectionModule.tsx').includes('<MemberPicker value={c.memberId === \'__none__\' ? \'\' : c.memberId} options={activeMembers}'), 'Election: searchable candidate picker over the voters roll');
ok(read('src/components/MemberPicker.tsx').includes('options?: readonly Member[];'), 'MemberPicker accepts a candidate list');
ok(read('src/pages/Member360.tsx').includes('`/share-register${member?.memberId ? `?q=${encodeURIComponent(member.memberId)}` : \'\'}`'), 'Member-360 opens the Share Register filtered to the member');

// ── Dashboard + portal link ──
const dash = read('src/pages/Dashboard.tsx');
ok(dash.includes("route: '/members?tab=pending'") && dash.includes('admissionClock(applicationReceivedOn(m), todayStr()'), 'Dashboard: pending applications advisory (overdue = critical)');
const dlg = read('src/components/members/MemberPortalDialog.tsx');
ok(dlg.includes('portalUrl(window.location.origin, memberPortalPath(user.societyId))') && dlg.includes('onClick={copyLink}'), 'portal dialog: copy the society portal link (no PIN) any time');

console.log(`member-stage-d: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

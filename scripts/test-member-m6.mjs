// Member-audit M6 — the remaining audit items (2026-10-17).
//   s.40 photograph (private bucket, tenant-scoped storage policies) + correspondence address · s.18 associate member
//   (no vote, no dividend — nominal too) · r.14 / r.15 eligibility confirmed at approval (audited) + declared on the
//   application form. Migration 119 columns ride their own updates (RULE 1).
// Run: node scripts/test-member-m6.mjs   (npm run test:member-m6)
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts']) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(u)) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const imp = (p) => import(pathToFileURL(resolve(SRC, p)).href);
const P = await imp('lib/members/photo.ts');
const V = await imp('lib/members/voters.ts');
const D = await imp('lib/distribution/dividendRuns.ts');
const L = await imp('lib/memberLifecycle.ts');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// ── photo helpers ──
ok(P.memberPhotoPath('9ef456de-b509', 'abc-123') === '9ef456de-b509/abc-123.jpg', 'path = <society>/<member>.jpg (the policy checks the first folder)');
ok(P.memberPhotoPath('S/../x', 'a b') === 'S____x/a_b.jpg', 'path cannot escape its society folder');
ok(P.photoFileError({ type: 'image/jpeg', size: 3_000_000 }) === null && P.photoFileError({ type: 'image/heic', size: 10 }) === null, 'phone photos accepted');
ok(P.photoFileError({ type: 'application/pdf', size: 10 }) && P.photoFileError({ type: 'image/png', size: 11 * 1024 * 1024 }) && P.photoFileError(undefined), 'non-image / huge / missing refused');
ok(JSON.stringify(P.fitWithin(4000, 3000)) === JSON.stringify({ width: 480, height: 360 }) && JSON.stringify(P.fitWithin(300, 200)) === JSON.stringify({ width: 300, height: 200 }), 'downscale to 480 on the long side, never upscale');

// ── associate / nominal: no vote, no dividend ──
const mem = (id, o = {}) => ({ id, memberId: id, name: id, status: 'active', joinDate: '2020-01-01', memberType: 'member', shareCapital: 1000, ...o });
const ms = [mem('A'), mem('B', { memberType: 'associate' }), mem('C', { memberType: 'nominal' })];
const roll = V.voterRoll(ms, [], [], '2026-10-17');
ok(roll.voters.map((m) => m.id).join() === 'A' && roll.excluded.filter((x) => x.reason === 'nominal').length === 2, 'associate + nominal excluded from the voters list (s.20)');
ok(D.eligibleDividendMembers(ms).map((m) => m.id).join() === 'A', 'associate + nominal get no dividend (s.18(2))');
ok(D.dividendRunLines(ms, 10).length === 1, 'dividend lines only for the regular member');
ok(L.memberTypeLabel('associate', true) === 'सहयोगी सदस्य' && L.memberTypeLabel('nominal', true) === 'नाममात्र सदस्य' && L.memberTypeLabel(undefined) === 'Member', 'type labels (no "नॉमिनल")');
for (const f of ['src/pages/Members.tsx', 'src/pages/MemberApplication.tsx', 'src/pages/Form1MemberList.tsx']) ok(!read(f).includes('नॉमिनल') && !read(f).includes('नामिनल'), `${f}: "नाममात्र", never "नॉमिनल" (sounds like नामांकित)`);
ok(read('src/lib/importTemplates.ts').includes("['member', 'nominal', 'associate']"), 'importer accepts associate');

// ── migration 119 ──
const up = read('supabase/migrations/119_member_photo_contact.sql');
for (const f of ['correspondenceAddress', 'photoPath']) {
  ok(up.includes(`alter table public.members add column if not exists "${f}"`), `119 adds ${f}`);
  ok(read('supabase-tables.sql').includes(`alter table members add column if not exists "${f}" text;`), `supabase-tables.sql has ${f}`);
  ok(read('supabase/functions/_shared/backup-core.mjs').includes(`"${f}"`), `backup bundle carries ${f}`);
}
ok(/insert into storage\.buckets[\s\S]*'member-photos', 'member-photos', false, 1048576/.test(up), 'PRIVATE bucket, 1 MB per file');
for (const pol of ['select', 'insert', 'update', 'delete']) ok(up.includes(`create policy "member_photos_${pol}" on storage.objects for ${pol} to authenticated`), `storage policy: ${pol}`);
ok((up.match(/\(storage\.foldername\(name\)\)\[1\] in \(select public\.current_user_society_ids\(\)\)/g) || []).length === 5, 'every policy checks the society folder (tenant isolation)');
ok((up.match(/public\.jwt_can_write\(\)/g) || []).length === 4, 'writes need a writer role');
ok(!/\sto (anon|public)\b/.test(up), 'no anonymous / public access');
ok(read('supabase/migrations/119_member_photo_contact_down.sql').includes('not exists (select 1 from storage.objects o where o.bucket_id = b.id)'), 'down never deletes a bucket that still holds photos');

// ── wiring ──
const dc = read('src/contexts/DataContext.tsx');
ok(dc.includes('for (const f of MEMBER_CONTACT_FIELDS) delete base[f];') && dc.includes('delete base[MEMBER_PHOTO_FIELD];'), 'base upsert never carries the 119 columns');
ok(/const persistMemberContact = [\s\S]*?Migration 119 चलाएँ/.test(dc), 'correspondence address in its own step-2 update');
const up2 = dc.slice(dc.indexOf('const uploadMemberPhoto = useCallback('), dc.indexOf('const removeMemberPhoto = useCallback('));
ok(up2.indexOf('.upload(path, blob') > 0 && up2.indexOf(".update({ photoPath: path })") > up2.indexOf('.upload(path, blob'), 'photoPath moves only after the file is stored');
ok(up2.includes("guardPermission('update'") && up2.includes('guardFYLocked()') && up2.includes('photoFileError(file)') && up2.includes("action: 'update'"), 'upload: role + FY guard, validation, audited');
ok(dc.includes('createSignedUrl(path, 600)'), 'photos shown through short-lived signed URLs (private bucket)');
ok(dc.includes('eligibilityConfirmed: decision?.eligibility ?? null'), 'r.14 / r.15 confirmations recorded in the approval audit');
const mp = read('src/pages/Members.tsx');
ok(mp.includes('notInsolvent') && mp.includes('noOtherCreditSociety') && mp.includes('eligibility: declared'), 'approve dialog asks r.14 / r.15');
ok(mp.includes("'पत्राचार का पता (अलग हो तो)'") && mp.includes('uploadMemberPhoto(viewMember.id, file)'), 'members: correspondence address + photo');
ok(read('src/lib/pdf.ts').includes('not a member of any other primary credit society'), 'application PDF declares r.14 / r.15');

// Photo in the admission forms (founder 2026-10-17: "दोनों मेंबर अड्मिशन फॉर्म में फोटो का ऑप्शन नहीं मिला").
const picker = read('src/components/members/MemberPhotoPicker.tsx');
ok(picker.includes('capture="environment"') && picker.includes('photoFileError(f)') && picker.includes('r.readAsDataURL(file)'), 'picker: camera, validation, data-URL preview');
ok(mp.includes('<MemberPhotoPicker file={photoFile} onChange={onPhoto}') && mp.includes('photoFile={formPhoto} onPhoto={setFormPhoto} onPhotoError={photoError}'), 'record-an-admitted-member + edit forms have the photo');
ok(mp.includes('if (photoToUpload) void uploadMemberPhoto(m.id, photoToUpload);') && mp.includes('if (formPhoto) void uploadMemberPhoto(editMember.id, formPhoto);'), 'photo uploaded only after the member row is saved');
ok(!/photoFile[,:]/.test(mp.slice(mp.indexOf('const EMPTY_FORM'), mp.indexOf('interface MemberFormProps'))), 'the photo never rides the member form / row');
const ap = read('src/pages/MemberApplication.tsx');
ok(ap.includes('<MemberPhotoPicker file={photo} onChange={setPhoto}') && ap.includes('if (chosenPhoto) void uploadMemberPhoto(m.id, chosenPhoto);'), 'new application has the photo, uploaded after the save');
ok(ap.includes('generateMemberApplicationPDF(newMember, society, photoUrl)'), 'application PDF gets the photo');
const pdf2 = read('src/lib/pdf.ts');
ok(pdf2.includes('generateMemberApplicationPDF(member: Member, society: SocietySettings, photoDataUrl?: string)') && pdf2.includes("doc.addImage(photoDataUrl, 'JPEG'") && pdf2.includes("doc.text('Affix'"), 'application PDF: photo box — the photo, or "Affix Photograph"');

// The stored photo on the reprints (founder 2026-10-17 "फोटो देखें": reprinted application, passbook, Member-360 print).
ok(mp.includes('const photoForPdf = async (m: Member) => (m.photoPath ? urlToDataUrl(await memberPhotoUrl(m.photoPath)) : null);'), 'reprints fetch the stored photo (signed URL → data URL)');
ok(mp.includes('generateMemberApplicationPDF(member, society, (await photoForPdf(member)) ?? undefined)') && mp.includes('generateMemberPassbookPDF(ledgerMember, entries, society, await photoForPdf(ledgerMember))'), 'pending-list application PDF + passbook carry the photo');
const pdf3 = read('src/lib/pdf.ts');
ok(pdf3.includes('photoDataUrl?: string | null,') && pdf3.includes("doc.addImage(photoDataUrl, 'JPEG', pageW - 33.5, startY - 1.5, 18, 22)") && pdf3.includes('startY: startY + (photoDataUrl ? 24 : 18)'), 'passbook: photo box + table moved below it');
const m360 = read('src/pages/Member360.tsx');
ok(m360.includes('memberPhotoUrl(member.photoPath)') && m360.includes('<img src={photoUrl} alt={member.name}'), 'Member-360 header (and its print) shows the photo');

console.log(`member-m6: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

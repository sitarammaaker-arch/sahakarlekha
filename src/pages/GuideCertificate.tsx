/**
 * GuideCertificate — /guide/certificate (bilingual). Unlocks once all
 * part-quizzes are passed; the learner gives name + email (a lightweight,
 * password-less record stored server-side) and gets a professional certificate
 * with a unique, verifiable number.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QUIZ_PART_IDS } from '@/content/guide/quizzes';
import { localizedQuiz } from '@/content/guide/quizzes.en';
import { useGuideQuizzes } from '@/lib/guideQuiz';
import { useGuideLang, useGuideT } from '@/lib/guideLang';
import LangToggle from '@/components/guide/LangToggle';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { makeCertNumber, formatCertDate } from '@/lib/guideCertId';
import RatingWidget from '@/components/RatingWidget';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';
import { Award, Printer, CheckCircle2, Circle, ArrowRight, Home, ChevronRight, ShieldCheck, Pencil, Loader2, Download, MessageCircle } from 'lucide-react';

const NAME_KEY = 'sl_guide_name';
const EMAIL_KEY = 'sl_guide_email';
const SOCIETY_KEY = 'sl_guide_society';
const CLAIMED_KEY = 'sl_guide_claimed';
const DATE_KEY = 'sl_guide_cert_date';

const GOLD = '#C9A227';
const NAVY = '#1F497D';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const lsGet = (k: string) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

const Seal: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 100 128" className={className} aria-hidden="true">
    <path d="M38 78 L30 124 L44 112 L50 122 L56 112 L70 124 L62 78 Z" fill={GOLD} opacity="0.9" />
    <path d="M38 78 L30 124 L44 112 L50 122 L50 78 Z" fill="#A9851E" opacity="0.9" />
    {Array.from({ length: 24 }).map((_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return <circle key={i} cx={50 + Math.cos(a) * 38} cy={42 + Math.sin(a) * 38} r="4.5" fill={GOLD} />;
    })}
    <circle cx="50" cy="42" r="36" fill={GOLD} />
    <circle cx="50" cy="42" r="30" fill="#fff" />
    <circle cx="50" cy="42" r="29" fill="none" stroke={NAVY} strokeWidth="1.5" />
    <path d="M50 22 L56 38 L73 38 L59 48 L64 64 L50 54 L36 64 L41 48 L27 38 L44 38 Z" fill={NAVY} />
  </svg>
);

const GuideCertificate: React.FC = () => {
  const lang = useGuideLang();
  const t = useGuideT();
  const brand = lang === 'en' ? 'SahakarLekha' : 'सहकार लेखा';

  useDocumentMeta({
    title: lang === 'en' ? 'Completion Certificate — SahakarLekha Guide' : 'पूर्णता प्रमाणपत्र — सहकार लेखा गाइड',
    description: lang === 'en'
      ? 'Earn a uniquely-numbered, verifiable completion certificate for the SahakarLekha complete accounting course.'
      : 'सहकार लेखा सम्पूर्ण लेखांकन कोर्स पूरा करने पर यूनीक क्रमांक वाला, सत्यापन-योग्य पूर्णता प्रमाणपत्र प्राप्त करें।',
    canonicalPath: '/guide/certificate',
  });

  const passed = useGuideQuizzes();
  const [name, setName] = React.useState(() => lsGet(NAME_KEY));
  const [email, setEmail] = React.useState(() => lsGet(EMAIL_KEY));
  const [society, setSociety] = React.useState(() => lsGet(SOCIETY_KEY));
  const [consent, setConsent] = React.useState(false);
  const [claimed, setClaimed] = React.useState(() => lsGet(CLAIMED_KEY) === '1');
  const [submitting, setSubmitting] = React.useState(false);
  const [serverNote, setServerNote] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);

  React.useEffect(() => { lsSet(NAME_KEY, name); }, [name]);
  React.useEffect(() => { lsSet(EMAIL_KEY, email); }, [email]);
  React.useEffect(() => { lsSet(SOCIETY_KEY, society); }, [society]);

  const passedCount = QUIZ_PART_IDS.filter((id) => passed.has(id)).length;
  const total = QUIZ_PART_IDS.length;
  const eligible = passedCount === total;

  const [isoDate, setIsoDate] = React.useState<string>(() => lsGet(DATE_KEY));
  React.useEffect(() => {
    if (eligible && !isoDate) {
      const iso = new Date().toISOString().slice(0, 10);
      lsSet(DATE_KEY, iso);
      setIsoDate(iso);
    }
  }, [eligible, isoDate]);

  const effectiveIso = isoDate || new Date().toISOString().slice(0, 10);
  const displayDate = formatCertDate(effectiveIso, lang);
  const certNo = name.trim() ? makeCertNumber(name, effectiveIso) : 'SL-________-______';

  const nameOk = name.trim().length >= 2;
  const emailOk = EMAIL_RE.test(email.trim());
  const canClaim = nameOk && emailOk && consent && !submitting;

  const handleClaim = async () => {
    if (!canClaim) return;
    setSubmitting(true);
    setServerNote(null);
    let iso = isoDate;
    if (!iso) { iso = new Date().toISOString().slice(0, 10); lsSet(DATE_KEY, iso); setIsoDate(iso); }
    const number = makeCertNumber(name, iso);
    try {
      const { error } = await supabase.rpc('issue_certificate', {
        p_cert_no: number,
        p_holder_name: name.trim(),
        p_email: email.trim(),
        p_society_name: society.trim(),
        p_parts_passed: total,
      });
      if (error) throw error;
    } catch {
      setServerNote(t('cert.servernote'));
    }
    lsSet(CLAIMED_KEY, '1');
    setClaimed(true);
    setSubmitting(false);
    // GOS-20: course-completion conversion (count only, no holder details).
    trackEvent('certificate_earned', { parts: total });
  };

  const handleDownloadPdf = async () => {
    const el = document.getElementById('cert-print');
    if (!el) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const img = canvas.toDataURL('image/jpeg', 0.92);
      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(img, 'JPEG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Sahakar-Lekha-Certificate-${certNo}.pdf`);
    } catch {
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    const el = document.getElementById('cert-print');
    if (!el) return;
    setPrinting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const data = canvas.toDataURL('image/png');
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      document.body.appendChild(iframe);
      const idoc = iframe.contentWindow?.document;
      if (!idoc) { iframe.remove(); window.print(); return; }
      idoc.open();
      idoc.write('<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:auto;margin:8mm}html,body{margin:0;padding:0}img{width:100%;display:block}</style></head><body><img src="' + data + '"></body></html>');
      idoc.close();
      const img = idoc.querySelector('img');
      const doPrint = () => { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); setTimeout(() => iframe.remove(), 1500); };
      if (img && !img.complete) img.onload = doPrint;
      else setTimeout(doPrint, 150);
    } catch {
      window.print();
    } finally {
      setPrinting(false);
    }
  };

  return (
    <PublicLayout>
      <style>{`@media print {
        @page { size: auto; margin: 10mm; }
        html, body { height: auto !important; background: #fff !important; }
        body * { visibility: hidden !important; }
        #cert-print, #cert-print * { visibility: visible !important; }
        #cert-print { position: absolute; left: 0; top: 0; width: 100%; }
        .no-print { display: none !important; }
      }`}</style>

      <div className="mx-auto px-4 py-8 md:py-12 max-w-4xl">
        <div className="flex items-center justify-between gap-3 mb-6 no-print">
          <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground min-w-0">
            <Link to="/guide" className="inline-flex items-center gap-1 hover:text-primary">
              <Home className="h-3.5 w-3.5" /> {t('ch.home')}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">{t('cert.breadcrumb')}</span>
          </nav>
          <LangToggle className="flex-shrink-0" />
        </div>

        {!eligible ? (
          <>
            <div className="text-center mb-8 no-print">
              <Award className="h-12 w-12 text-primary mx-auto mb-3" />
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t('cert.locked.title')}</h1>
              <p className="text-muted-foreground mt-2">{t('cert.locked.desc', { total })}</p>
              <p className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                {t('cert.progress', { done: passedCount, total })}
              </p>
            </div>

            <div className="space-y-2 no-print">
              {QUIZ_PART_IDS.map((id) => {
                const isPassed = passed.has(id);
                return (
                  <Link key={id} to={`/guide/quiz/${id}`}>
                    <Card className={`transition-all hover:border-primary/50 ${isPassed ? 'border-green-300 dark:border-green-800' : ''}`}>
                      <CardContent className="p-4 flex items-center gap-3">
                        {isPassed ? <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
                        <span className="flex-1 font-medium text-foreground">{localizedQuiz(id, lang)?.title}</span>
                        {isPassed
                          ? <span className="text-xs text-green-700 dark:text-green-300">{t('cert.quiz.passed')}</span>
                          : <span className="inline-flex items-center gap-1 text-sm text-primary">{t('cert.quiz.solve')} <ArrowRight className="h-3.5 w-3.5" /></span>}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>

            <div className="mt-6 text-center no-print">
              <Link to="/guide/verify" className="text-sm text-primary inline-flex items-center gap-1.5 hover:underline">
                <ShieldCheck className="h-4 w-4" /> {t('cert.verifylink')}
              </Link>
            </div>
          </>
        ) : !claimed ? (
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-6">
              <Award className="h-12 w-12 text-primary mx-auto mb-3" />
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t('cert.claim.title')}</h1>
              <p className="text-muted-foreground mt-2 text-sm">{t('cert.claim.desc', { total })}</p>
            </div>
            <Card>
              <CardContent className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t('cert.f.name')} <span className="text-red-500">*</span></label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('cert.ph.name')}
                    className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t('cert.f.email')} <span className="text-red-500">*</span></label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com"
                    className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
                  {email && !emailOk && <p className="text-xs text-red-500 mt-1">{t('cert.email.invalid')}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t('cert.f.society')} <span className="text-muted-foreground">{t('cert.f.optional')}</span></label>
                  <input value={society} onChange={(e) => setSociety(e.target.value)} placeholder={t('cert.ph.society')}
                    className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
                </div>
                <label className="flex items-start gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                  <span>{t('cert.consent')} (<Link to="/privacy" className="text-primary hover:underline">{t('cert.privacy')}</Link>).</span>
                </label>
                <Button onClick={handleClaim} disabled={!canClaim} className="w-full gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
                  {t('cert.create')}
                </Button>
              </CardContent>
            </Card>
            <div className="mt-5 text-center">
              <Link to="/guide/verify" className="text-sm text-primary inline-flex items-center gap-1.5 hover:underline">
                <ShieldCheck className="h-4 w-4" /> {t('cert.verifylink')}
              </Link>
            </div>
          </div>
        ) : (
          <>
            {serverNote && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm px-4 py-2.5 no-print">⚠️ {serverNote}</div>
            )}
            <div className="flex items-center justify-between mb-4 no-print">
              <p className="text-sm text-muted-foreground">{t('cert.holder')}: <span className="font-medium text-foreground">{name}</span></p>
              <button onClick={() => { setClaimed(false); lsSet(CLAIMED_KEY, '0'); }} className="text-sm text-primary inline-flex items-center gap-1 hover:underline">
                <Pencil className="h-3.5 w-3.5" /> {t('cert.editdetails')}
              </button>
            </div>

            <div id="cert-print">
              <div className="mx-auto rounded-sm p-2 md:p-2.5" style={{ background: `linear-gradient(135deg, ${GOLD}, #EBD98B, ${GOLD}, #B8901F)` }}>
                <div className="relative bg-white overflow-hidden px-6 py-10 sm:px-10 md:px-16 md:py-14" style={{ border: `2px solid ${NAVY}` }}>
                  <span className="absolute top-2 left-2 w-10 h-10 border-t-2 border-l-2" style={{ borderColor: GOLD }} />
                  <span className="absolute top-2 right-2 w-10 h-10 border-t-2 border-r-2" style={{ borderColor: GOLD }} />
                  <span className="absolute bottom-2 left-2 w-10 h-10 border-b-2 border-l-2" style={{ borderColor: GOLD }} />
                  <span className="absolute bottom-2 right-2 w-10 h-10 border-b-2 border-r-2" style={{ borderColor: GOLD }} />

                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                    <span className="text-[170px] md:text-[240px] font-black" style={{ color: NAVY, opacity: 0.04 }}>स</span>
                  </div>

                  <div className="relative text-center text-slate-800">
                    <p className="text-sm font-semibold tracking-[0.2em]" style={{ color: NAVY }}>{brand}</p>
                    <p className="text-[11px] tracking-[0.25em] text-slate-500 uppercase">sahakarlekha.com</p>

                    <div className="mt-5 flex items-center justify-center gap-3">
                      <span className="h-px w-12 sm:w-20" style={{ background: GOLD }} />
                      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-wide" style={{ color: NAVY }}>{t('cert.title')}</h1>
                      <span className="h-px w-12 sm:w-20" style={{ background: GOLD }} />
                    </div>
                    <p className="text-xs tracking-[0.3em] uppercase text-slate-500 mt-1">{t('cert.subtitle')}</p>

                    <p className="mt-7 text-slate-600">{t('cert.this')}</p>
                    <div className="inline-block" style={{ marginTop: '12px', marginBottom: '8px', paddingLeft: '28px', paddingRight: '28px' }}>
                      <p className="text-2xl sm:text-3xl md:text-4xl font-bold" style={{ color: NAVY, lineHeight: 1.7, marginBottom: '6px' }}>
                        {name.trim() || '__________________'}
                      </p>
                      <div style={{ height: '3px', background: GOLD, marginTop: '8px' }} />
                    </div>
                    {society.trim() && <p className="text-sm text-slate-500">({society.trim()})</p>}
                    <p className="mt-3 text-slate-600 max-w-2xl mx-auto leading-relaxed">{t('cert.completed', { total })}</p>

                    <div className="my-6 flex justify-center">
                      <Seal className="w-16 h-20 sm:w-20 sm:h-24" />
                    </div>

                    <div className="flex items-end justify-between gap-4 mt-2 text-left">
                      <div className="text-xs sm:text-sm">
                        <p className="text-slate-500">{t('cert.date')}</p>
                        <p className="font-semibold" style={{ color: NAVY }}>{displayDate}</p>
                        <p className="text-slate-500 mt-2">{t('cert.certno')}</p>
                        <p className="font-mono font-semibold tracking-wide" style={{ color: NAVY }}>{certNo}</p>
                      </div>
                      <div className="text-right text-xs sm:text-sm">
                        <p className="font-[cursive] text-lg sm:text-xl" style={{ color: NAVY }}>{brand}</p>
                        <p className="border-t pt-1 mt-1" style={{ borderColor: GOLD }}>{t('cert.authorized')}</p>
                      </div>
                    </div>

                    <p className="mt-6 text-[10px] sm:text-xs text-slate-400">{t('cert.verifyfooter')}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-center mt-6 no-print">
              <Button onClick={handleDownloadPdf} disabled={downloading} className="gap-2">
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t('cert.download')}
              </Button>
              <Button variant="outline" onClick={handlePrint} disabled={printing} className="gap-2">
                {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} {t('cert.print')}
              </Button>
              <Link to={`/guide/verify?id=${encodeURIComponent(certNo)}`}>
                <Button variant="outline" className="gap-2"><ShieldCheck className="h-4 w-4" /> {t('cert.verify')}</Button>
              </Link>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  lang === 'en'
                    ? `I completed the SahakarLekha cooperative society accounting course ✅\nCertificate no. ${certNo} — verify: https://sahakarlekha.com/guide/verify?id=${certNo}\nLearn it free too: https://sahakarlekha.com/guide`
                    : `मैंने SahakarLekha का सहकारी समिति लेखांकन कोर्स पूरा किया ✅\nप्रमाणपत्र क्रमांक ${certNo} — सत्यापित करें: https://sahakarlekha.com/guide/verify?id=${certNo}\nआप भी मुफ़्त सीखें: https://sahakarlekha.com/guide`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="gap-2 border-green-300 text-green-700 hover:bg-green-50 hover:text-green-800">
                  <MessageCircle className="h-4 w-4" /> {lang === 'en' ? 'Share on WhatsApp' : 'WhatsApp पर शेयर'}
                </Button>
              </a>
              <Link to="/guide"><Button variant="ghost">{t('cert.back')}</Button></Link>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-3 no-print">
              {t('cert.filename')} <span className="font-mono">Sahakar-Lekha-Certificate-{certNo}.pdf</span>
            </p>

            {/* Happy-moment ask: rate the course */}
            <div className="mt-10 max-w-lg mx-auto no-print">
              <RatingWidget />
            </div>
          </>
        )}
      </div>
    </PublicLayout>
  );
};

export default GuideCertificate;

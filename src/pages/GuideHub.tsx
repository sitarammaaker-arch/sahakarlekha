/**
 * GuideHub — the /guide learning hub (bilingual: हिंदी / English).
 * Lists the full 30-chapter cooperative-accounting course, links to the
 * screenshot-based Quick Start, and offers the full PDF book.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FRONT_MATTER, GUIDE_PARTS, GUIDE_ORDER } from '@/content/guide';
import { GUIDE_QUIZZES, QUIZ_PART_IDS } from '@/content/guide/quizzes';
import { localizedPartTitle, localizedEntry } from '@/content/guide/i18n';
import GuideSearch from '@/components/guide/GuideSearch';
import LangToggle from '@/components/guide/LangToggle';
import { useGuideProgress } from '@/lib/guideProgress';
import { useGuideQuizzes } from '@/lib/guideQuiz';
import { useGuideLang, useGuideT } from '@/lib/guideLang';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import {
  BookOpen, GraduationCap, Download, Rocket, ArrowRight, FileText, Layers,
  CheckCircle2, BookMarked, Award, HelpCircle, ShieldCheck,
} from 'lucide-react';

const ChapterCard: React.FC<{
  slug: string; badge: string; title: string; summary: string; done?: boolean;
}> = ({ slug, badge, title, summary, done }) => (
  <Link to={`/guide/${slug}`} className="group block h-full">
    <Card className={`h-full transition-all hover:border-primary/50 hover:shadow-md ${done ? 'border-green-300 dark:border-green-800' : ''}`}>
      <CardContent className="p-4 flex gap-3 h-full">
        <div className={`relative flex-shrink-0 w-9 h-9 rounded-lg font-bold flex items-center justify-center text-sm ${done ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-primary/10 text-primary'}`}>
          {done ? <CheckCircle2 className="h-5 w-5" /> : badge}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">{title}</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{summary}</p>
        </div>
      </CardContent>
    </Card>
  </Link>
);

const GuideHub: React.FC = () => {
  const lang = useGuideLang();
  const t = useGuideT();

  useDocumentMeta({
    title: lang === 'en'
      ? 'SahakarLekha Guide — Complete Cooperative Accounting Course'
      : 'सहकार लेखा गाइड — सम्पूर्ण सहकारी लेखांकन कोर्स (हिंदी)',
    description: lang === 'en'
      ? 'A complete accounting guide for cooperative societies — sales, purchases, stock, GST/TDS, final accounts, audit & year-end. 30 chapters, free.'
      : 'सहकारी समितियों के लिए सम्पूर्ण लेखांकन गाइड — बिक्री, खरीद, स्टॉक, GST/TDS, अंतिम खाते, ऑडिट व वर्षांत। 30 अध्याय, सरल हिंदी, बिल्कुल मुफ़्त।',
    canonicalPath: '/guide',
    // Course structured data → eligible for Google's "Course" rich result.
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: lang === 'en'
        ? 'Cooperative Society Accounting & Audit — Complete Course'
        : 'सहकारी समिति लेखांकन व ऑडिट — सम्पूर्ण कोर्स',
      description: lang === 'en'
        ? 'A free, self-paced course teaching cooperative society accounting from first principles to final accounts, GST/TDS, audit and year-end — 30 chapters with quizzes and a verifiable certificate.'
        : 'सहकारी समिति लेखांकन सिखाने वाला मुफ़्त, स्व-गति कोर्स — मूल सिद्धांतों से अंतिम खातों, GST/TDS, ऑडिट व वर्षांत तक। 30 अध्याय, क्विज़ व सत्यापन-योग्य प्रमाणपत्र।',
      url: 'https://sahakarlekha.com/guide',
      inLanguage: lang === 'en' ? 'en' : 'hi',
      isAccessibleForFree: true,
      educationalCredentialAwarded: lang === 'en' ? 'Certificate of Completion' : 'पूर्णता प्रमाणपत्र',
      provider: {
        '@type': 'Organization',
        name: 'SahakarLekha',
        url: 'https://sahakarlekha.com',
      },
      offers: {
        '@type': 'Offer',
        category: 'Free',
        price: '0',
        priceCurrency: 'INR',
      },
      hasCourseInstance: {
        '@type': 'CourseInstance',
        courseMode: 'online',
        courseWorkload: 'PT10H',
        inLanguage: lang === 'en' ? 'en' : 'hi',
      },
    },
  });

  const done = useGuideProgress();
  const passedQuizzes = useGuideQuizzes();
  const quizzesPassed = QUIZ_PART_IDS.filter((id) => passedQuizzes.has(id)).length;
  const totalQuizzes = QUIZ_PART_IDS.length;
  const allChapterSlugs = GUIDE_PARTS.flatMap((p) => p.chapters.filter((c) => c.kind === 'chapter').map((c) => c.slug));
  const totalChapters = allChapterSlugs.length;
  const completed = allChapterSlugs.filter((s) => done.has(s)).length;
  const pct = totalChapters ? Math.round((completed / totalChapters) * 100) : 0;
  const resume = GUIDE_ORDER.find((e) => !done.has(e.slug)) ?? GUIDE_ORDER[0];

  return (
    <PublicLayout>
      <div className="mx-auto px-4 py-10 md:py-16 max-w-6xl">
        {/* Language toggle */}
        <div className="flex justify-end mb-4">
          <LangToggle />
        </div>

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <GraduationCap className="h-4 w-4" />
            {t('hub.badge')}
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-3">{t('hub.title')}</h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">{t('hub.desc', { n: totalChapters })}</p>
        </div>

        {/* Search */}
        <div className="mb-8"><GuideSearch /></div>

        {/* Progress */}
        <Card className="mb-8 bg-muted/30">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <BookMarked className="h-4 w-4 text-primary" /> {t('hub.progress')}
                </p>
                <p className="text-sm text-muted-foreground">{t('hub.progress.count', { done: completed, total: totalChapters, pct })}</p>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <Link to={`/guide/${resume.slug}`} className="flex-shrink-0">
              <Button className="gap-2 w-full sm:w-auto">
                {completed === 0 ? t('hub.start') : completed === totalChapters ? t('hub.reread') : t('hub.continue')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Top action cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          <Link to="/guide/quick-start" className="group block">
            <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
              <CardContent className="p-5">
                <Rocket className="h-7 w-7 text-primary mb-2" />
                <p className="font-bold text-foreground">{t('hub.quickstart')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('hub.quickstart.desc')}</p>
                <span className="inline-flex items-center gap-1 text-primary text-sm mt-2 group-hover:gap-2 transition-all">{t('hub.open')} <ArrowRight className="h-3.5 w-3.5" /></span>
              </CardContent>
            </Card>
          </Link>

          <Link to={`/guide/${FRONT_MATTER.slug}`} className="group block">
            <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
              <CardContent className="p-5">
                <BookOpen className="h-7 w-7 text-primary mb-2" />
                <p className="font-bold text-foreground">{t('hub.intro')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('hub.intro.desc')}</p>
                <span className="inline-flex items-center gap-1 text-primary text-sm mt-2 group-hover:gap-2 transition-all">{t('hub.read')} <ArrowRight className="h-3.5 w-3.5" /></span>
              </CardContent>
            </Card>
          </Link>

          <a href="/sahakar-lekha-guide.pdf" target="_blank" rel="noopener noreferrer" className="group block">
            <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
              <CardContent className="p-5">
                <Download className="h-7 w-7 text-primary mb-2" />
                <p className="font-bold text-foreground">{t('hub.pdf')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('hub.pdf.desc', { n: totalChapters })}</p>
                <span className="inline-flex items-center gap-1 text-primary text-sm mt-2 group-hover:gap-2 transition-all">{t('hub.download')} <ArrowRight className="h-3.5 w-3.5" /></span>
              </CardContent>
            </Card>
          </a>
        </div>

        {/* Parts → chapters */}
        <div className="space-y-10">
          {GUIDE_PARTS.map((part) => (
            <section key={part.id}>
              <div className="flex items-center gap-2 mb-4">
                <Layers className="h-5 w-5 text-primary" />
                <h2 className="text-xl md:text-2xl font-bold text-foreground">{localizedPartTitle(part, lang)}</h2>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {part.chapters.map((c) => {
                  const m = localizedEntry(c, lang);
                  return (
                    <ChapterCard
                      key={c.slug}
                      slug={c.slug}
                      badge={c.kind === 'appendix' ? (c.title.match(/(?:परिशिष्ट|Appendix)\s+([A-Z])/)?.[1] ?? '·') : String(c.num)}
                      title={m.shortTitle}
                      summary={m.summary}
                      done={done.has(c.slug)}
                    />
                  );
                })}
              </div>
              {GUIDE_QUIZZES[part.id] && (
                <Link to={`/guide/quiz/${part.id}`} className="group inline-flex items-center gap-2 mt-3 text-sm font-medium text-primary hover:gap-3 transition-all">
                  {passedQuizzes.has(part.id) ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <HelpCircle className="h-4 w-4" />}
                  {passedQuizzes.has(part.id) ? t('hub.quiz.passed') : t('hub.quiz.take', { n: GUIDE_QUIZZES[part.id].questions.length })}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </section>
          ))}
        </div>

        {/* Certificate CTA */}
        <section className="mt-12">
          <Card className="bg-gradient-to-r from-primary/10 to-transparent border-primary/20">
            <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4">
              <Award className="h-10 w-10 text-primary flex-shrink-0" />
              <div className="flex-1 text-center sm:text-left">
                <p className="font-bold text-foreground">{t('hub.cert.title')}</p>
                <p className="text-sm text-muted-foreground">{t('hub.cert.desc', { done: quizzesPassed, total: totalQuizzes })}</p>
              </div>
              <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                <Link to="/guide/certificate" className="w-full">
                  <Button variant={quizzesPassed === totalQuizzes ? 'default' : 'outline'} className="gap-2 w-full sm:w-auto">
                    <Award className="h-4 w-4" /> {quizzesPassed === totalQuizzes ? t('hub.cert.get') : t('hub.cert.view')}
                  </Button>
                </Link>
                <Link to="/guide/verify" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> {t('hub.cert.verify')}
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA */}
        <section className="mt-12 py-8 border-t">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6 md:p-8 text-center">
              <FileText className="h-10 w-10 text-primary mx-auto mb-3" />
              <h2 className="text-2xl font-bold mb-2">{t('hub.cta.title')}</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto mb-4">{t('hub.cta.desc')}</p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link to="/register"><Button className="gap-2">{t('hub.cta.start')} <ArrowRight className="h-4 w-4" /></Button></Link>
                <Link to="/guide/quick-start"><Button variant="outline">{t('hub.quickstart')}</Button></Link>
                <Link to="/faq"><Button variant="ghost">FAQ</Button></Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </PublicLayout>
  );
};

export default GuideHub;

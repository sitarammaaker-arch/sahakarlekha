/**
 * GuideHub — the /guide learning hub.
 * Lists the full 30-chapter cooperative-accounting course (भाग → अध्याय),
 * links to the screenshot-based Quick Start, and offers the full PDF book.
 * Public page — no auth required. Same content also ships as the Word/PDF book.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FRONT_MATTER, GUIDE_PARTS, GUIDE_ORDER } from '@/content/guide';
import { GUIDE_QUIZZES, QUIZ_PART_IDS } from '@/content/guide/quizzes';
import GuideSearch from '@/components/guide/GuideSearch';
import { useGuideProgress } from '@/lib/guideProgress';
import { useGuideQuizzes } from '@/lib/guideQuiz';
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
          <p className="font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
            {title}
          </p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{summary}</p>
        </div>
      </CardContent>
    </Card>
  </Link>
);

const GuideHub: React.FC = () => {
  useDocumentMeta({
    title: 'सहकार लेखा गाइड — सम्पूर्ण सहकारी लेखांकन कोर्स (हिंदी)',
    description:
      'सहकारी समितियों के लिए सम्पूर्ण लेखांकन गाइड — बिक्री, खरीद, स्टॉक, GST/TDS, अंतिम खाते, ऑडिट व वर्षांत। 30 अध्याय, सरल हिंदी, बिल्कुल मुफ़्त।',
    canonicalPath: '/guide',
  });

  const done = useGuideProgress();
  const passedQuizzes = useGuideQuizzes();
  const quizzesPassed = QUIZ_PART_IDS.filter((id) => passedQuizzes.has(id)).length;
  const totalQuizzes = QUIZ_PART_IDS.length;
  const allChapterSlugs = GUIDE_PARTS.flatMap((p) =>
    p.chapters.filter((c) => c.kind === 'chapter').map((c) => c.slug),
  );
  const totalChapters = allChapterSlugs.length;
  const completed = allChapterSlugs.filter((s) => done.has(s)).length;
  const pct = totalChapters ? Math.round((completed / totalChapters) * 100) : 0;
  // first not-yet-read entry in reading order (skip front matter if already done)
  const resume = GUIDE_ORDER.find((e) => !done.has(e.slug)) ?? GUIDE_ORDER[0];

  return (
    <PublicLayout>
      <div className="mx-auto px-4 py-10 md:py-16 max-w-6xl">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <GraduationCap className="h-4 w-4" />
            सीखें · Complete Learning Course
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-3">
            सहकार लेखा से सम्पूर्ण Accounting सीखें
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            लेखांकन की नींव से लेकर बिक्री, खरीद, स्टॉक, GST/TDS, अंतिम खाते, ऑडिट व वर्षांत तक —
            <span className="font-semibold text-foreground"> {totalChapters} अध्याय</span> की सरल हिंदी गाइड।
            हर सदस्य, क्लर्क, लेखाकार व ऑडिटर के लिए — बिल्कुल मुफ़्त, ऑनलाइन।
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <GuideSearch />
        </div>

        {/* Progress */}
        <Card className="mb-8 bg-muted/30">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <BookMarked className="h-4 w-4 text-primary" /> आपकी प्रगति
                </p>
                <p className="text-sm text-muted-foreground">{completed} / {totalChapters} अध्याय · {pct}%</p>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <Link to={`/guide/${resume.slug}`} className="flex-shrink-0">
              <Button className="gap-2 w-full sm:w-auto">
                {completed === 0 ? 'पढ़ना शुरू करें' : completed === totalChapters ? 'फिर से पढ़ें' : 'पढ़ना जारी रखें'}
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
                <p className="font-bold text-foreground">त्वरित गाइड · Quick Start</p>
                <p className="text-sm text-muted-foreground mt-1">
                  ऐप कैसे चलाएँ — screenshots व step-by-step क्लिक निर्देश।
                </p>
                <span className="inline-flex items-center gap-1 text-primary text-sm mt-2 group-hover:gap-2 transition-all">
                  खोलें <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </CardContent>
            </Card>
          </Link>

          <Link to={`/guide/${FRONT_MATTER.slug}`} className="group block">
            <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
              <CardContent className="p-5">
                <BookOpen className="h-7 w-7 text-primary mb-2" />
                <p className="font-bold text-foreground">भूमिका · Introduction</p>
                <p className="text-sm text-muted-foreground mt-1">
                  यह कोर्स किसके लिए है, कैसे पढ़ें, और तीन सुनहरे सूत्र।
                </p>
                <span className="inline-flex items-center gap-1 text-primary text-sm mt-2 group-hover:gap-2 transition-all">
                  पढ़ें <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </CardContent>
            </Card>
          </Link>

          <a href="/sahakar-lekha-guide.pdf" target="_blank" rel="noopener noreferrer" className="group block">
            <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
              <CardContent className="p-5">
                <Download className="h-7 w-7 text-primary mb-2" />
                <p className="font-bold text-foreground">पूरी किताब · PDF</p>
                <p className="text-sm text-muted-foreground mt-1">
                  सम्पूर्ण {totalChapters}-अध्याय गाइड एक printable PDF में — ऑफ़लाइन पढ़ें/छापें।
                </p>
                <span className="inline-flex items-center gap-1 text-primary text-sm mt-2 group-hover:gap-2 transition-all">
                  डाउनलोड <ArrowRight className="h-3.5 w-3.5" />
                </span>
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
                <h2 className="text-xl md:text-2xl font-bold text-foreground">{part.title}</h2>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {part.chapters.map((c) => (
                  <ChapterCard
                    key={c.slug}
                    slug={c.slug}
                    badge={c.kind === 'appendix' ? c.slug.split('-')[1]?.toUpperCase() ?? '·' : String(c.num)}
                    title={c.shortTitle}
                    summary={c.summary}
                    done={done.has(c.slug)}
                  />
                ))}
              </div>
              {GUIDE_QUIZZES[part.id] && (
                <Link to={`/guide/quiz/${part.id}`} className="group inline-flex items-center gap-2 mt-3 text-sm font-medium text-primary hover:gap-3 transition-all">
                  {passedQuizzes.has(part.id)
                    ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                    : <HelpCircle className="h-4 w-4" />}
                  {passedQuizzes.has(part.id) ? 'क्विज़ उत्तीर्ण ✓ — दोबारा करें' : `इस भाग की क्विज़ हल करें (${GUIDE_QUIZZES[part.id].questions.length} प्रश्न)`}
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
                <p className="font-bold text-foreground">पूर्णता प्रमाणपत्र</p>
                <p className="text-sm text-muted-foreground">
                  सभी {totalQuizzes} भागों की क्विज़ उत्तीर्ण करें और अपना प्रमाणपत्र पाएँ — {quizzesPassed}/{totalQuizzes} पूरे।
                </p>
              </div>
              <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                <Link to="/guide/certificate" className="w-full">
                  <Button variant={quizzesPassed === totalQuizzes ? 'default' : 'outline'} className="gap-2 w-full sm:w-auto">
                    <Award className="h-4 w-4" /> {quizzesPassed === totalQuizzes ? 'प्रमाणपत्र पाएँ' : 'प्रमाणपत्र देखें'}
                  </Button>
                </Link>
                <Link to="/guide/verify" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> प्रमाणपत्र सत्यापित करें
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
              <h2 className="text-2xl font-bold mb-2">तैयार हैं? अपनी समिति शुरू करें</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto mb-4">
                पढ़ते जाइए, साथ-साथ अपनी समिति में अभ्यास कीजिए — सहकार लेखा बिल्कुल मुफ़्त है।
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link to="/register"><Button className="gap-2">अभी शुरू करें <ArrowRight className="h-4 w-4" /></Button></Link>
                <Link to="/guide/quick-start"><Button variant="outline">त्वरित गाइड</Button></Link>
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
